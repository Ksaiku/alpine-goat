// ALPINE GOAT — HUD と各画面（タイトル / ステージ選択 / ポーズ / クリア）の描画
//
// すべて「画面座標」で描く（カメラ変換の外で呼ぶこと）。
// すべて ctx.save() / ctx.restore() で囲む。ロジックは持たず、渡された info を描くだけ。

import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  UI_TEXT,
  UI_TEXT_DIM,
  UI_ACCENT,
  UI_PANEL,
  UI_FONT,
} from './config.js';

/**
 * 秒を "M:SS.mm"（分:秒.百分の一秒）の文字列にする。秒と百分の一秒は必ず2桁。
 * 例: 83.456 → "1:23.45"
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  // 不正値は 0 として扱う
  const s = typeof seconds === 'number' && isFinite(seconds) && seconds > 0 ? seconds : 0;
  // 百分の一秒の整数に落とす。s*100 の2進表現による僅かな誤差（例: 65.1*100 = 6509.9999…）で
  // 1cs 取りこぼすのを防ぐため、ごく小さい値を足してから切り捨てる。
  const totalCs = Math.floor(s * 100 + 1e-6);
  const minutes = Math.floor(totalCs / 6000);
  const secs = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  const ss = secs < 10 ? '0' + secs : String(secs);
  const mm = cs < 10 ? '0' + cs : String(cs);
  return minutes + ':' + ss + '.' + mm;
}

/**
 * 画面全体を UI_PANEL で塗る（プレイ画面がうっすら透けるオーバーレイ）。
 * @param {CanvasRenderingContext2D} ctx
 */
function drawPanel(ctx) {
  ctx.fillStyle = UI_PANEL;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

/**
 * プレイ中の情報表示。画面最上部の進行度バーと、その下に影付きで3行。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{stageName: string, time: number, deaths: number,
 *          progress: number, checkpoints: {ratio: number, reached: boolean}[],
 *          goalRatio: (number|null)}} info
 */
export function drawPlayHud(ctx, info) {
  ctx.save();

  // --- 進行度バー（画面最上部・高さ5px）---
  const BAR_H = 5;
  // 背景
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, BAR_H);
  // 進行部分
  const p = Math.min(1, Math.max(0, info.progress || 0));
  ctx.fillStyle = UI_ACCENT;
  ctx.fillRect(0, 0, LOGICAL_WIDTH * p, BAR_H);
  // チェックポイント印（幅2。到達済みは強調色、未到達は半透明白）
  for (const cp of info.checkpoints || []) {
    const cx = Math.round(LOGICAL_WIDTH * cp.ratio);
    ctx.fillStyle = cp.reached ? UI_ACCENT : 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(cx - 1, 0, 2, BAR_H);
  }
  // ゴール印（幅3・白）
  if (info.goalRatio != null) {
    const gx = Math.round(LOGICAL_WIDTH * info.goalRatio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx - 1, 0, 3, BAR_H);
  }

  // --- 情報の文字（バーと重ならないよう y=22 から）---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // 背景に埋もれないよう各行に半透明の影を落とす
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;

  const x = 16;
  let y = 22;
  const lh = 22;

  ctx.fillStyle = UI_TEXT;
  ctx.font = '16px ' + UI_FONT;
  ctx.fillText(info.stageName, x, y);
  y += lh;

  ctx.font = '20px ' + UI_FONT;
  ctx.fillText('TIME  ' + formatTime(info.time), x, y);
  y += lh;

  ctx.fillStyle = UI_TEXT_DIM;
  ctx.font = '16px ' + UI_FONT;
  ctx.fillText('DEATH ' + info.deaths, x, y);

  ctx.restore();
}

/**
 * タイトル画面。中央揃え。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{time: number}} info
 */
export function drawTitle(ctx, info) {
  ctx.save();
  drawPanel(ctx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = LOGICAL_WIDTH / 2;

  ctx.fillStyle = UI_ACCENT;
  ctx.font = 'bold 56px ' + UI_FONT;
  ctx.fillText('ALPINE GOAT', cx, 150);

  ctx.fillStyle = UI_TEXT_DIM;
  ctx.font = '18px ' + UI_FONT;
  ctx.fillText('アルプスの山を駆けるヤギ', cx, 200);

  // 開始を促す文字は透明度を 0.5〜1.0 で脈動させる
  const pulse = 0.75 + 0.25 * Math.sin(info.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = UI_TEXT;
  ctx.font = '20px ' + UI_FONT;
  ctx.fillText('SPACE / A ボタンで開始', cx, 300);
  ctx.globalAlpha = 1;

  ctx.fillStyle = UI_TEXT_DIM;
  ctx.font = '14px ' + UI_FONT;
  ctx.fillText('移動 ← →  /  ジャンプ SPACE  /  頭突き SHIFT', cx, 400);
  ctx.fillText('スマホは画面のボタンで操作できます', cx, 424);

  ctx.restore();
}

/**
 * ステージ選択画面。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{stages: {name: string}[], progress: {cleared: boolean[], bestTime: (number|null)[], bestDeaths: (number|null)[]}, selected: number}} info
 */
export function drawStageSelect(ctx, info) {
  ctx.save();
  drawPanel(ctx);
  const cx = LOGICAL_WIDTH / 2;

  // 見出し
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = UI_TEXT;
  ctx.font = '28px ' + UI_FONT;
  ctx.fillText('ステージ選択', cx, 80);

  // 各ステージを縦に並べる（1行 64px）。
  // 行数は進捗データのスロット数（＝3）に合わせる。まだ作られていないステージ
  // （info.stages に無い添字）は未解放と同じく ？？？ で表示する。
  const rowCount = info.progress.cleared.length;
  const rowH = 64;
  const listX = cx - 220;      // 行の左端
  const firstY = 160;          // 1行目の中心 y
  for (let i = 0; i < rowCount; i++) {
    const y = firstY + i * rowH;
    const isSelected = i === info.selected;
    const stage = info.stages[i];
    // 解放条件: 添字0は常に解放 / それ以外は前ステージがクリア済み。
    // ただしステージ本体がまだ無ければ選べない扱い（？？？）。
    const unlocked = !!stage && (i === 0 || info.progress.cleared[i - 1] === true);

    // 色: 選択中は強調、未解放は減光、それ以外は通常
    const color = isSelected ? UI_ACCENT : unlocked ? UI_TEXT : UI_TEXT_DIM;
    ctx.fillStyle = color;

    // 選択中は左に ▶
    ctx.textAlign = 'left';
    if (isSelected) {
      ctx.font = '20px ' + UI_FONT;
      ctx.fillText('▶', listX - 28, y);
    }

    // 「STAGE n  <名前 or ???>」
    const label = unlocked ? stage.name : '？？？';
    ctx.font = '20px ' + UI_FONT;
    ctx.fillText('STAGE ' + (i + 1) + '  ' + label, listX, y);

    // クリア済みなら右側に記録
    if (info.progress.cleared[i]) {
      const bt = info.progress.bestTime[i];
      const bd = info.progress.bestDeaths[i];
      const rec =
        '✓ ' +
        (bt != null ? formatTime(bt) : '--') +
        ' / 死亡 ' +
        (bd != null ? bd : '--');
      ctx.fillStyle = UI_TEXT_DIM;
      ctx.font = '14px ' + UI_FONT;
      ctx.textAlign = 'right';
      ctx.fillText(rec, listX + 440, y);
    }
  }

  // 操作説明
  ctx.fillStyle = UI_TEXT_DIM;
  ctx.font = '14px ' + UI_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('← → で選択  /  SPACE で決定', cx, LOGICAL_HEIGHT - 48);

  ctx.restore();
}

/**
 * ポーズ画面。
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} info 未使用（インターフェースをそろえるため受け取る）
 */
export function drawPause(ctx, info) {
  ctx.save();
  drawPanel(ctx);
  const cx = LOGICAL_WIDTH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = UI_TEXT;
  ctx.font = '40px ' + UI_FONT;
  ctx.fillText('PAUSE', cx, LOGICAL_HEIGHT / 2 - 20);

  ctx.fillStyle = UI_TEXT_DIM;
  ctx.font = '16px ' + UI_FONT;
  ctx.fillText('SPACE で再開  /  ESC でタイトルへ', cx, LOGICAL_HEIGHT / 2 + 24);

  ctx.restore();
}

/**
 * クリア画面。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{stageName: string, time: number, deaths: number, isBestTime: boolean, isBestDeaths: boolean}} info
 */
export function drawClear(ctx, info) {
  ctx.save();
  drawPanel(ctx);
  const cx = LOGICAL_WIDTH / 2;
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'center';
  ctx.fillStyle = UI_ACCENT;
  ctx.font = 'bold 48px ' + UI_FONT;
  ctx.fillText('STAGE CLEAR!', cx, 130);

  ctx.fillStyle = UI_TEXT;
  ctx.font = '20px ' + UI_FONT;
  ctx.fillText(info.stageName, cx, 185);

  // TIME 行（中央に本文、右に NEW RECORD!）
  ctx.textAlign = 'left';
  const lineX = cx - 150;
  ctx.fillStyle = UI_TEXT;
  ctx.font = '24px ' + UI_FONT;
  ctx.fillText('TIME   ' + formatTime(info.time), lineX, 250);
  if (info.isBestTime) {
    ctx.fillStyle = UI_ACCENT;
    ctx.font = '18px ' + UI_FONT;
    ctx.fillText('NEW RECORD!', lineX + 200, 250);
  }

  ctx.fillStyle = UI_TEXT;
  ctx.font = '24px ' + UI_FONT;
  ctx.fillText('DEATH  ' + info.deaths, lineX, 295);
  if (info.isBestDeaths) {
    ctx.fillStyle = UI_ACCENT;
    ctx.font = '18px ' + UI_FONT;
    ctx.fillText('BEST!', lineX + 200, 295);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = UI_TEXT_DIM;
  ctx.font = '18px ' + UI_FONT;
  ctx.fillText('SPACE でステージ選択へ', cx, 370);

  ctx.restore();
}

/**
 * 縦画面のときに全画面で出す「横向きにしてください」の案内。
 * ゲーム画面を完全に隠すため、まず画面全体を UI_PANEL で塗る。
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawRotateNotice(ctx) {
  ctx.save();
  ctx.fillStyle = UI_PANEL;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const cx = LOGICAL_WIDTH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = UI_TEXT;
  ctx.font = '48px ' + UI_FONT;
  ctx.fillText('📱', cx, LOGICAL_HEIGHT / 2 - 50);

  ctx.font = '24px ' + UI_FONT;
  ctx.fillText('画面を横向きにしてください', cx, LOGICAL_HEIGHT / 2 + 10);

  ctx.fillStyle = UI_TEXT_DIM;
  ctx.font = '15px ' + UI_FONT;
  ctx.fillText('このゲームは横画面用です', cx, LOGICAL_HEIGHT / 2 + 44);

  ctx.restore();
}
