// ALPINE GOAT — 入力システム
// キーボードとタッチを、6つの論理アクションからなる同一インターフェースに正規化する。
// キーコード（e.code）はこのファイルの外へ一切漏らさない。

import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  TOUCH_BTN_LEFT,
  TOUCH_BTN_RIGHT,
  TOUCH_BTN_JUMP,
  TOUCH_BTN_DASH,
  TOUCH_BTN_PAUSE,
  TOUCH_HIT_PADDING,
  TOUCH_UI_ALPHA,
} from './config.js';

// ===== 論理アクション（この6つのみ）=====
const ACTIONS = ['left', 'right', 'jump', 'dash', 'pause', 'confirm'];

// ===== キーマップ（e.code → アクション名の配列）=====
// 1つのキーが複数アクションを兼ねる場合がある（例: Space はジャンプと決定）。
const KEY_MAP = {
  ArrowLeft:  ['left'],
  KeyA:       ['left'],
  ArrowRight: ['right'],
  KeyD:       ['right'],
  Space:      ['jump', 'confirm'],
  ArrowUp:    ['jump'],
  KeyW:       ['jump'],
  ShiftLeft:  ['dash'],
  ShiftRight: ['dash'],
  KeyJ:       ['dash'],
  Escape:     ['pause'],
  KeyP:       ['pause'],
  Enter:      ['confirm'],
};

// keydown 時にページスクロール等を抑止するため preventDefault するキー
const PREVENT_DEFAULT_CODES = new Set([
  'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
]);

// ===== 仮想ボタンの定義（描画順・当たり判定の両方に使う）=====
const TOUCH_BUTTONS = [
  { def: TOUCH_BTN_LEFT,  action: 'left',  glyph: '◀' }, // ◀
  { def: TOUCH_BTN_RIGHT, action: 'right', glyph: '▶' }, // ▶
  { def: TOUCH_BTN_JUMP,  action: 'jump',  glyph: 'A' },
  { def: TOUCH_BTN_DASH,  action: 'dash',  glyph: 'B' },
  { def: TOUCH_BTN_PAUSE, action: 'pause', glyph: 'II' },
];

// ===== 内部状態 =====
const kbHeld = {};       // アクション → キーボードで現在押されているか
const touchHeld = {};    // アクション → タッチで現在押されているか
const combined = {};     // アクション → 統合した現在の押下状態
const edgePressed = {};  // アクション → この update ステップで押され始めたか
const edgeReleased = {}; // アクション → この update ステップで離されたか
for (const a of ACTIONS) {
  kbHeld[a] = false;
  touchHeld[a] = false;
  combined[a] = false;
  edgePressed[a] = false;
  edgeReleased[a] = false;
}

let canvasRef = null;    // タッチ座標変換に使う canvas 要素
let touchModeFlag = false; // 仮想パッドを表示すべきか（最後に使った入力デバイスに追従）

/**
 * キーボード・タッチのいずれかの押下状態が変わったとき、
 * 統合状態を再計算し、必要ならエッジ情報（押され始め／離され）を立てる。
 * @param {string} action アクション名
 */
function recompute(action) {
  const now = kbHeld[action] || touchHeld[action];
  if (now && !combined[action]) edgePressed[action] = true;
  if (!now && combined[action]) edgeReleased[action] = true;
  combined[action] = now;
}

/**
 * 全アクションの押下状態を強制的に解除する。
 * ウィンドウがフォーカスを失うと keyup が届かずキーが押しっぱなしのまま残るため、
 * blur / visibilitychange で呼んで固着を防ぐ。
 * combined を直接書き換えず必ず recompute() を経由し、
 * 押されていたアクションに wasReleased が正しく立つようにする
 *（後続フェーズの「ジャンプキーを離すと上昇が止まる」処理が wasReleased を見るため）。
 */
function clearAll() {
  for (const a of ACTIONS) {
    kbHeld[a] = false;
    touchHeld[a] = false;
    recompute(a);
  }
}

// ===== キーボード =====

/**
 * keydown ハンドラ。
 * @param {KeyboardEvent} e
 */
function onKeyDown(e) {
  // 矢印キー・スペースはページスクロールを起こすため既定動作を止める
  // （キャンセル不可のイベントで preventDefault を呼ぶとコンソール警告が出るため e.cancelable を確認）
  if (PREVENT_DEFAULT_CODES.has(e.code) && e.cancelable) e.preventDefault();

  // 何かキーが押された = 直近の入力デバイスはキーボード
  touchModeFlag = false;

  const actions = KEY_MAP[e.code];
  if (!actions) return;

  // OS のキーリピートでは「押され始め」を発火させない（連射防止）
  if (e.repeat) return;

  for (const a of actions) {
    kbHeld[a] = true;
    recompute(a);
  }
}

/**
 * keyup ハンドラ。
 * @param {KeyboardEvent} e
 */
function onKeyUp(e) {
  const actions = KEY_MAP[e.code];
  if (!actions) return;
  for (const a of actions) {
    kbHeld[a] = false;
    recompute(a);
  }
}

// ===== タッチ =====

/**
 * クライアント座標（clientX/clientY）を論理座標（960×540空間）へ変換する。
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{lx:number, ly:number}}
 */
function toLogical(clientX, clientY) {
  const rect = canvasRef.getBoundingClientRect();
  const lx = (clientX - rect.left) / rect.width  * LOGICAL_WIDTH;
  const ly = (clientY - rect.top)  / rect.height * LOGICAL_HEIGHT;
  return { lx, ly };
}

/**
 * 現存する全タッチ点を走査し、各仮想ボタンの押下状態をまるごと再構築する。
 * 個々のタッチを追跡せず毎回全走査するため、マルチタッチでも堅牢。
 * @param {TouchList} touchList e.touches
 */
function rescanTouches(touchList) {
  // 全タッチ点を論理座標へ変換しておく
  const points = [];
  for (let i = 0; i < touchList.length; i++) {
    const t = touchList[i];
    points.push(toLogical(t.clientX, t.clientY));
  }

  // 各ボタンについて、いずれかのタッチ点が円内にあるかを判定する
  for (const btn of TOUCH_BUTTONS) {
    const hitR = btn.def.r + TOUCH_HIT_PADDING; // 当たり判定は見た目より広く取る
    let pressed = false;
    for (const p of points) {
      const dx = p.lx - btn.def.x;
      const dy = p.ly - btn.def.y;
      if (dx * dx + dy * dy <= hitR * hitR) {
        pressed = true;
        break;
      }
    }
    touchHeld[btn.action] = pressed;
    recompute(btn.action);
  }
}

/**
 * touchstart / touchmove / touchend / touchcancel 共通ハンドラ。
 * @param {TouchEvent} e
 */
function onTouch(e) {
  // ブラウザのスクロール・ダブルタップズームを抑止する。
  // touchcancel など cancelable=false のイベントで preventDefault を呼ぶと
  // コンソール警告が出るため、キャンセル可能なときだけ呼ぶ。
  if (e.cancelable) e.preventDefault();

  // タッチが始まったら、直近の入力デバイスはタッチ
  if (e.type === 'touchstart') touchModeFlag = true;

  rescanTouches(e.touches);
}

// ===== 公開 API =====

/**
 * イベントリスナを登録する。
 * @param {HTMLCanvasElement} canvas タッチ座標変換に使う canvas
 */
function init(canvas) {
  canvasRef = canvas;

  // 初期値は「粗いポインタ（＝タッチ環境）」かどうか
  touchModeFlag = window.matchMedia('(pointer: coarse)').matches;

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // passive:false にしないと touch イベント内で preventDefault が効かない
  canvas.addEventListener('touchstart', onTouch, { passive: false });
  canvas.addEventListener('touchmove', onTouch, { passive: false });
  canvas.addEventListener('touchend', onTouch, { passive: false });
  canvas.addEventListener('touchcancel', onTouch, { passive: false });

  // フォーカス喪失・タブ非表示でキーが固着しないよう、全入力を解除する
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearAll();
  });
}

/**
 * そのアクションが現在押されているか。
 * @param {string} action
 * @returns {boolean}
 */
function isDown(action) {
  return combined[action] === true;
}

/**
 * この update ステップで押され始めたか。
 * @param {string} action
 * @returns {boolean}
 */
function wasPressed(action) {
  return edgePressed[action] === true;
}

/**
 * この update ステップで離されたか。
 * @param {string} action
 * @returns {boolean}
 */
function wasReleased(action) {
  return edgeReleased[action] === true;
}

/**
 * 「押され始め」「離され」のエッジ情報をクリアする。
 * 固定タイムステップのため、update() の呼び出し1回ごとの直後に必ず呼ぶこと。
 */
function endFrame() {
  for (const a of ACTIONS) {
    edgePressed[a] = false;
    edgeReleased[a] = false;
  }
}

/**
 * 仮想パッドを canvas に描画する。ctx の状態は呼び出し元に漏らさない。
 * @param {CanvasRenderingContext2D} ctx
 */
function renderTouchControls(ctx) {
  // タッチモードでなければ何も描かない
  if (!touchModeFlag) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;

  for (const btn of TOUCH_BUTTONS) {
    const pressed = combined[btn.action] === true;
    // 押されているボタンは不透明度を上げて、押下を視覚化する
    const fillAlpha = pressed ? TOUCH_UI_ALPHA + 0.25 : TOUCH_UI_ALPHA;

    // 円の塗り
    ctx.beginPath();
    ctx.arc(btn.def.x, btn.def.y, btn.def.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + fillAlpha + ')';
    ctx.fill();

    // 白い輪郭線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    // 中央の記号（サイズはボタン半径に比例させる）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = Math.round(btn.def.r * 0.7) + 'px sans-serif';
    ctx.fillText(btn.glyph, btn.def.x, btn.def.y);
  }

  ctx.restore();
}

/**
 * 単一の入力オブジェクトとして公開する。
 */
export const Input = {
  init,
  isDown,
  wasPressed,
  wasReleased,
  endFrame,
  renderTouchControls,
  // 仮想パッドを表示すべきか（最後に使った入力デバイスに追従）
  get touchMode() {
    return touchModeFlag;
  },
};
