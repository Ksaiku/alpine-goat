// ALPINE GOAT — エントリポイント / ゲームループ / 画面遷移
// Phase 8: 敵（マーモット/ワシ/ヤマアラシ）と踏みつけ判定を統合。
// Phase 9: 死亡演出・チェックポイント・無敵。
// Phase 10: 画面の状態機械（タイトル→選択→プレイ→クリア）、ゴール、HUD、進捗保存。

import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  FIXED_DT,
  MAX_FRAME_TIME,
  TILE_SIZE,
  GOAT_HITBOX_WIDTH,
  GOAT_HITBOX_HEIGHT,
  TEMP_FALL_LIMIT,
  DEBUG,
} from './config.js';
import { Input } from './input.js';
import { Goat } from './goat.js';
import { World } from './world.js';
import { Camera } from './camera.js';
import { Background } from './background.js';
import { Enemy, resolveGoatEnemyCollisions, isEnemyActive } from './enemies.js';
import { stage1 } from './stages/stage1.js';
import { stage2 } from './stages/stage2.js';
import { stage3 } from './stages/stage3.js';
import { loadProgress, saveProgress } from './storage.js';
import {
  drawPlayHud,
  drawTitle,
  drawStageSelect,
  drawPause,
  drawClear,
  drawRotateNotice,
} from './hud.js';

// ===== canvas と描画コンテキストの取得 =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// 実際に使用している devicePixelRatio（上限2にクランプした値）
let dpr = 1;

// ===== ステージの一覧 =====
const STAGES = [stage1, stage2, stage3];

// ===== 画面の状態機械 =====
let screen = 'title'; // 'title' | 'select' | 'play' | 'paused' | 'clear'

// ===== ステージ進行に伴って作り直すもの（const ではなく let）=====
let world = null;
let goat = null;
let enemies = [];
let camera = null;

// 背景はステージごとに配色を差し替えるため作り直す（startStage で生成）。
// タイトル・ステージ選択では既定＝ステージ1の配色を使う。起動時とゲーム離脱時に new Background() で戻す。
let background = new Background();

// ===== プレイ状態 =====
let currentStage = 0; // 遊んでいるステージの添字
let selected = 0;     // ステージ選択画面で選んでいる添字
let elapsed = 0;      // 経過時間（秒）
let deaths = 0;       // 死亡回数
let uiTime = 0;       // 画面演出用の時間（毎フレーム加算）
let progress = loadProgress();
let clearInfo = null; // クリア画面に渡す情報

// 復帰地点（チェックポイントで更新される）
let respawnX = 0;
let respawnY = 0;

// ===== ジャンプ到達高さ（peak）の計測用（デバッグ表示） =====
let jumpPeak = 0;
let jumpStartY = 0;

// デバッグの IN: 行に列挙するアクション（表示順）
const DEBUG_ACTIONS = ['left', 'right', 'jump', 'dash', 'pause', 'confirm'];

// ===== FPS 計測用（直近60フレームの実経過時間を保持）=====
const frameTimes = [];
const FPS_SAMPLE_COUNT = 60;

// ===== ゲームループ用の時間管理 =====
let lastTimestamp = 0;
let accumulator = 0;
let started = false;

// ウィンドウが縦長のとき true。スマホの縦持ちを想定。
// 縦画面の間は update を止め、全画面で「横向きにしてください」の案内を出す。
let isPortrait = false;
function updateOrientation() {
  isPortrait = window.innerHeight > window.innerWidth;
}

/**
 * canvas の内部解像度を論理解像度 × dpr に設定し、
 * 以降の描画を論理座標系（960×540）で行えるよう変換をかける。
 */
function setupCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = LOGICAL_WIDTH * dpr;
  canvas.height = LOGICAL_HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * ステージ index を最初から開始する。world / camera / goat / 敵をすべて作り直す。
 * @param {number} index STAGES の添字
 */
function startStage(index) {
  currentStage = index;
  const stage = STAGES[index];

  // world が変わるので camera も作り直す（Camera は world を保持しクランプ範囲に使う）
  world = new World(stage);
  camera = new Camera(LOGICAL_WIDTH, LOGICAL_HEIGHT, world);
  // 背景もステージ固有の配色・テーマで作り直す（palette / theme が無い stage1 は undefined → 既定値・alpine）
  background = new Background(stage.palette, stage.theme);

  // 敵を出現位置から作り直す（Phase 8 と同じ手順）
  enemies = world.enemySpawns.map((s) => {
    const e = new Enemy(s.type, s.col * TILE_SIZE, s.row * TILE_SIZE);
    e.x = s.col * TILE_SIZE + (TILE_SIZE - e.width) / 2;
    e.y = (s.row + 1) * TILE_SIZE - e.height;
    e.spawnX = e.x; // ワシの基準位置を補正後の値に
    e.baseY = e.y;
    return e;
  });

  // 復帰地点はステージの spawn から
  respawnX = stage.spawn.col * TILE_SIZE;
  respawnY = stage.spawn.row * TILE_SIZE - GOAT_HITBOX_HEIGHT;

  goat = new Goat(respawnX, respawnY);
  elapsed = 0;
  deaths = 0;
  jumpPeak = 0;
  jumpStartY = 0;

  camera.snapTo(goat);
  screen = 'play';
}

/**
 * ステージ index が解放されているか。
 * ステージ1（index 0）は常に解放。ステージ N は N-1 がクリア済みなら解放。
 * @param {number} index
 * @returns {boolean}
 */
function isUnlocked(index) {
  return index === 0 || progress.cleared[index - 1] === true;
}

/**
 * ヤギを死亡させる（死亡演出つき）。死因は敵・棘の2つ。
 * すでに死亡中、または無敵中なら何もしない。
 */
function killGoat() {
  if (goat.isDead || goat.invincibleTimer > 0) return;
  goat.die();
  deaths++;
}

/**
 * 復帰地点からヤギを復活させる。死亡演出の終了・穴への落下から呼ぶ。
 */
function respawnGoat() {
  goat.respawn(respawnX, respawnY);
  camera.snapTo(goat);
}

/**
 * プレイ中のゲームロジック更新（Phase 9 までの処理をそのまま）。
 * 最後にゴール判定を行う。
 * @param {number} dt 固定タイムステップ（秒）
 */
function updatePlay(dt) {
  const prevY = goat.y;
  const prevOnGround = goat.onGround;

  // 1. ヤギの更新
  goat.update(dt, world);

  // --- ジャンプ到達高さ（peak）の計測 ---
  if (prevOnGround && !goat.onGround) {
    jumpStartY = prevY;
    jumpPeak = 0;
  }
  if (!goat.onGround) {
    const h = jumpStartY - goat.y;
    if (h > jumpPeak) jumpPeak = h;
  }

  if (goat.isDead) {
    // 2. 死亡演出中: 演出が終わったら復帰。敵だけは動かし続ける（画面近くの敵だけ）。
    if (goat.deathTimer <= 0) respawnGoat();
    for (const e of enemies) {
      if (e.alive && isEnemyActive(e, camera)) e.update(dt, world);
    }
  } else if (goat.y > world.heightPx + TEMP_FALL_LIMIT) {
    // 3-a. 穴への落下: 演出なしで即復帰（死亡回数はカウント）。
    deaths++;
    respawnGoat();
  } else {
    // 3-b. 通常の生存中の処理
    if (goat.touchingSpike) killGoat();

    // 画面から遠い敵は動かさない（到着時の位置を毎回そろえ、計算も省く）
    for (const e of enemies) {
      if (e.alive && isEnemyActive(e, camera)) e.update(dt, world);
    }

    resolveGoatEnemyCollisions(goat, enemies, world, camera, killGoat);
    enemies = enemies.filter((e) => e.alive);

    // チェックポイント: 触れたら復帰地点を更新する
    const cp = world.checkCheckpoints(goat);
    if (cp) {
      respawnX = cp.x + (TILE_SIZE - GOAT_HITBOX_WIDTH) / 2;
      respawnY = (cp.row + 1) * TILE_SIZE - GOAT_HITBOX_HEIGHT;
    }

    // ゴール判定（死亡していないときだけ）
    if (world.isTouchingGoal(goat)) {
      progress.cleared[currentStage] = true;
      const bt = progress.bestTime[currentStage];
      const bd = progress.bestDeaths[currentStage];
      const isBestTime = bt == null || bt > elapsed;
      const isBestDeaths = bd == null || bd > deaths;
      if (isBestTime) progress.bestTime[currentStage] = elapsed;
      if (isBestDeaths) progress.bestDeaths[currentStage] = deaths;
      saveProgress(progress);
      clearInfo = {
        stageName: STAGES[currentStage].name,
        time: elapsed,
        deaths,
        isBestTime,
        isBestDeaths,
      };
      screen = 'clear';
    }
  }

  // 4. ワールドの更新（時間・破片）
  world.update(dt);

  // 5. カメラの追従
  camera.follow(goat, dt);
}

/**
 * ゲームロジックの更新。dt には常に FIXED_DT（秒）が渡る。
 * 画面の状態に応じて分岐する。
 * @param {number} dt 固定タイムステップ（秒）
 */
function update(dt) {
  if (isPortrait) return; // 縦画面の間はゲームを止める（タイムが進んだり気づかず死んだりしないため）

  uiTime += dt;

  switch (screen) {
    case 'title':
      if (Input.wasPressed('confirm') || Input.wasPressed('jump')) screen = 'select';
      break;

    case 'select':
      if (Input.wasPressed('left')) selected = Math.max(0, selected - 1);
      if (Input.wasPressed('right')) selected = Math.min(STAGES.length - 1, selected + 1);
      if (Input.wasPressed('confirm') || Input.wasPressed('jump')) {
        if (isUnlocked(selected)) startStage(selected);
      }
      if (Input.wasPressed('pause')) screen = 'title';
      break;

    case 'play':
      if (Input.wasPressed('pause')) {
        screen = 'paused';
        break;
      }
      elapsed += dt;
      updatePlay(dt);
      break;

    case 'paused':
      if (Input.wasPressed('confirm') || Input.wasPressed('jump')) screen = 'play';
      if (Input.wasPressed('pause')) {
        // タイトルへ戻る＝ゲームから抜けるので、背景を既定（ステージ1）の配色へ戻す
        background = new Background();
        screen = 'title';
      }
      break;

    case 'clear':
      if (Input.wasPressed('confirm') || Input.wasPressed('jump')) {
        // ステージ選択へ戻る＝ゲームから抜けるので、背景を既定の配色へ戻す
        background = new Background();
        screen = 'select';
      }
      break;
  }
}

/**
 * ゲーム世界（背景・地形・敵・ヤギ）を描く。play / paused / clear で共通。
 */
function renderGame() {
  background.render(ctx, camera);

  ctx.save();
  camera.applyTo(ctx);
  world.render(ctx, camera);
  // 描画も、動かしている（画面近くの）敵だけにする
  for (const e of enemies) {
    if (e.alive && isEnemyActive(e, camera)) e.render(ctx);
  }
  goat.render(ctx);
  ctx.restore();

  // 洞窟テーマのときだけ、画面外周の暗がり（周辺減光）を重ねる。
  // ゲームの世界を描いたあと・HUD やメニューのパネルより前。
  background.renderVignette(ctx);
}

/**
 * デバッグ情報を画面の右上に右揃えで描く（'play' のときだけ呼ぶ）。
 */
function renderDebug() {
  const fps = calcAverageFps();
  const held = DEBUG_ACTIONS.filter((a) => Input.isDown(a));
  const inStr = held.length > 0 ? held.join(' ') : '-';

  const footCol = Math.floor((goat.x + goat.width / 2) / TILE_SIZE);
  const footRow = Math.floor((goat.y + goat.height) / TILE_SIZE);

  const lines = [
    'FPS: ' + fps.toFixed(1),
    'DPR: ' + dpr,
    'IN: ' + inStr,
    'state: ' + goat.state + '   ground: ' + goat.onGround + '   facing: ' + goat.facing,
    'pos: ' + Math.round(goat.x) + ', ' + Math.round(goat.y),
    'tile: ' + footCol + ',' + footRow + '   spike: ' + goat.touchingSpike,
    'vel: ' + Math.round(goat.vx) + ', ' + Math.round(goat.vy),
    'coyote: ' + goat.coyoteTimer.toFixed(2) + '   buffer: ' + goat.jumpBufferTimer.toFixed(2),
    'peak: ' + Math.round(jumpPeak),
    'cam: ' + Math.round(camera.x) + ', ' + Math.round(camera.y),
    'dash: ' + goat.isDashing + '  t: ' + goat.dashTimer.toFixed(2) + '  cd: ' + goat.dashCooldown.toFixed(2),
    'enemies: ' +
      enemies.filter((e) => e.alive && isEnemyActive(e, camera)).length +
      '/' +
      enemies.filter((e) => e.alive).length,
    'deaths: ' + deaths +
      '   inv: ' + goat.invincibleTimer.toFixed(2) +
      '   cp: ' + world.checkpoints.filter((c) => c.reached).length + '/' + world.checkpoints.length,
  ];

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], LOGICAL_WIDTH - 8, 8 + i * 18);
  }
  ctx.restore();
}

/**
 * 描画。1フレームにつき1回だけ呼ばれる。画面の状態に応じて分岐する。
 * 描画規約: 処理全体を ctx.save() / ctx.restore() で囲み、ctx の状態を漏らさない。
 */
function render() {
  ctx.save();

  // camera がまだ無い画面（タイトル・選択）用の仮カメラ
  const dummyCam = { x: 0, y: 0 };

  switch (screen) {
    case 'title':
      background.render(ctx, dummyCam);
      drawTitle(ctx, { time: uiTime });
      break;

    case 'select':
      background.render(ctx, dummyCam);
      drawStageSelect(ctx, { stages: STAGES, progress, selected });
      break;

    case 'play':
      renderGame();
      drawPlayHud(ctx, {
        stageName: STAGES[currentStage].name,
        time: elapsed,
        deaths,
        // 進行度バー用（ヤギの x とステージ横幅から算出）
        progress: Math.min(1, Math.max(0, goat.x / world.widthPx)),
        checkpoints: world.checkpoints.map((cp) => ({
          ratio: cp.x / world.widthPx,
          reached: cp.reached,
        })),
        goalRatio: world.goal ? world.goal.x / world.widthPx : null,
      });
      if (DEBUG) renderDebug();
      break;

    case 'paused':
      renderGame();
      drawPause(ctx, {});
      break;

    case 'clear':
      renderGame();
      drawClear(ctx, clearInfo);
      break;
  }

  // 仮想パッドはすべての画面で最後に描画する（メニューの操作にも使うため）
  Input.renderTouchControls(ctx);

  // 縦画面なら、すべての画面の上に「横向きにしてください」の案内を重ねる
  if (isPortrait) drawRotateNotice(ctx);

  ctx.restore();
}

/**
 * 直近 FPS_SAMPLE_COUNT フレームの平均 fps を返す。
 * @returns {number} 平均 fps
 */
function calcAverageFps() {
  if (frameTimes.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frameTimes.length; i++) sum += frameTimes[i];
  if (sum <= 0) return 0;
  return frameTimes.length / sum;
}

/**
 * requestAnimationFrame のコールバック。
 * 固定タイムステップのアキュムレータ方式でループを回す。
 * @param {number} timestamp 高精度タイムスタンプ（ミリ秒）
 */
function loop(timestamp) {
  if (!started) {
    started = true;
    lastTimestamp = timestamp;
    requestAnimationFrame(loop);
    return;
  }

  let frameTime = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (frameTime > 0) {
    frameTimes.push(frameTime);
    if (frameTimes.length > FPS_SAMPLE_COUNT) frameTimes.shift();
  }

  if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

  accumulator += frameTime;
  while (accumulator >= FIXED_DT) {
    update(FIXED_DT);
    Input.endFrame(); // update 1回につき必ず1回。エッジ情報の二重消費を防ぐ
    accumulator -= FIXED_DT;
  }

  render();

  requestAnimationFrame(loop);
}

// ===== 起動 =====
setupCanvas();
updateOrientation();
Input.init(canvas);
window.addEventListener('resize', () => {
  setupCanvas();
  updateOrientation();
});
requestAnimationFrame(loop);
