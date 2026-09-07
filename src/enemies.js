// ALPINE GOAT — 敵（マーモット / ワシ / ヤマアラシ）と、ヤギ↔敵の当たり判定
// すべてプロシージャル描画。画像は使わない。描画関数は save()/restore() で囲む。

import {
  TILE_SIZE,
  GRAVITY,
  MAX_FALL_SPEED,
  STOMP_TOLERANCE,
  STOMP_BOUNCE,
  ENEMY_MARMOT_SPEED,
  ENEMY_EAGLE_SPEED,
  ENEMY_EAGLE_AMPLITUDE,
  ENEMY_EAGLE_PERIOD,
  ENEMY_EAGLE_RANGE,
  ENEMY_PORCUPINE_SPEED,
  ENEMY_MARMOT_W,
  ENEMY_MARMOT_H,
  ENEMY_EAGLE_W,
  ENEMY_EAGLE_H,
  ENEMY_PORCUPINE_W,
  ENEMY_PORCUPINE_H,
  ENEMY_MARMOT_BODY,
  ENEMY_MARMOT_BELLY,
  ENEMY_EAGLE_BODY,
  ENEMY_EAGLE_HEAD,
  ENEMY_EAGLE_BEAK,
  ENEMY_PORCUPINE_BODY,
  ENEMY_PORCUPINE_QUIL,
  ENEMY_ACTIVE_MARGIN,
} from './config.js';
import { moveAndCollide } from './world.js';

// 種別ごとの当たり判定サイズ
const SIZES = {
  marmot: { w: ENEMY_MARMOT_W, h: ENEMY_MARMOT_H },
  eagle: { w: ENEMY_EAGLE_W, h: ENEMY_EAGLE_H },
  porcupine: { w: ENEMY_PORCUPINE_W, h: ENEMY_PORCUPINE_H },
};

// 種別ごとの体の色（撃破エフェクトの破片色に使う）
const BODY_COLOR = {
  marmot: ENEMY_MARMOT_BODY,
  eagle: ENEMY_EAGLE_BODY,
  porcupine: ENEMY_PORCUPINE_BODY,
};

export class Enemy {
  /**
   * @param {'marmot'|'eagle'|'porcupine'} type
   * @param {number} x 当たり判定の左上 x
   * @param {number} y 当たり判定の左上 y
   */
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = SIZES[type].w;
    this.height = SIZES[type].h;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1; // 右が 1、左が -1
    this.alive = true;
    this.onGround = false;
    this.stompable = type !== 'porcupine'; // ヤマアラシだけ踏めない
    this.time = 0;
    // ワシ用（出現位置を基準に上下・左右する）
    this.baseY = y;
    this.spawnX = x;
  }

  /**
   * 挙動の更新。
   * @param {number} dt
   * @param {import('./world.js').World} world
   */
  update(dt, world) {
    this.time += dt;
    if (this.type === 'eagle') this._updateEagle(dt);
    else this._updateGround(dt, world);
  }

  /** マーモット / ヤマアラシ：地上を往復。壁と崖の端で反転。 */
  _updateGround(dt, world) {
    const speed =
      this.type === 'marmot' ? ENEMY_MARMOT_SPEED : ENEMY_PORCUPINE_SPEED;
    this.vx = this.facing * speed;

    // 重力を適用し、地形と衝突させる
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    moveAndCollide(this, dt, world);

    let turn = false;
    // 壁にぶつかって vx が 0 になった
    if (this.vx === 0) turn = true;
    // 進行方向の足元に地面がない（崖の端）
    const aheadX = this.facing === 1 ? this.x + this.width + 2 : this.x - 2;
    const col = Math.floor(aheadX / TILE_SIZE);
    const row = Math.floor((this.y + this.height + 2) / TILE_SIZE);
    if (!world.isSolid(col, row)) turn = true;

    if (turn) {
      this.facing = -this.facing;
      this.vx = this.facing * speed;
    }
  }

  /** ワシ：空中を水平移動しながら上下にサインカーブ。重力・地形衝突なし。 */
  _updateEagle(dt) {
    this.x += this.facing * ENEMY_EAGLE_SPEED * dt;
    this.y =
      this.baseY +
      ENEMY_EAGLE_AMPLITUDE *
        Math.sin((this.time * Math.PI * 2) / ENEMY_EAGLE_PERIOD);
    if (Math.abs(this.x - this.spawnX) >= ENEMY_EAGLE_RANGE) {
      // 出現位置から動ける距離に収め、向きを反転
      this.x = this.spawnX + Math.sign(this.x - this.spawnX) * ENEMY_EAGLE_RANGE;
      this.facing = -this.facing;
    }
  }

  /**
   * 描画。中心を原点に置き、左向きは水平反転する。
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    if (this.facing === -1) ctx.scale(-1, 1);
    if (this.type === 'marmot') this._drawMarmot(ctx);
    else if (this.type === 'eagle') this._drawEagle(ctx);
    else this._drawPorcupine(ctx);
    ctx.restore();
  }

  _drawMarmot(ctx) {
    // 横長の楕円の胴体
    ctx.fillStyle = ENEMY_MARMOT_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // 腹側（下半分）を明るく
    ctx.save();
    ctx.beginPath();
    ctx.rect(-14, 0, 28, 12);
    ctx.clip();
    ctx.fillStyle = ENEMY_MARMOT_BELLY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 後方の短く太い尾
    ctx.fillStyle = ENEMY_MARMOT_BODY;
    ctx.beginPath();
    ctx.ellipse(-14, 1, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 前方上部の丸い耳
    ctx.beginPath();
    ctx.arc(7, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    // 前後の短い脚
    ctx.strokeStyle = ENEMY_MARMOT_BODY;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.lineTo(-6, 13);
    ctx.moveTo(8, 9);
    ctx.lineTo(8, 13);
    ctx.stroke();
    // 前方の小さい黒い目
    ctx.fillStyle = '#1a1512';
    ctx.beginPath();
    ctx.arc(9, -2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawEagle(ctx) {
    const flap = Math.sin(this.time * 10) * 0.5; // ±0.5 ラジアン
    // 翼2枚（胴体の上から後方へ伸びる三角形。逆位相で羽ばたく）
    ctx.fillStyle = ENEMY_EAGLE_BODY;
    for (const s of [1, -1]) {
      ctx.save();
      ctx.translate(-2, -8); // 付け根を上げてどの羽ばたき位置でも胴体に隠れないように
      ctx.rotate(-0.4 + s * flap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-17, -3 - s * 2);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 胴体の楕円
    ctx.beginPath();
    ctx.ellipse(-2, 0, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // 前方の白い頭
    ctx.fillStyle = ENEMY_EAGLE_HEAD;
    ctx.beginPath();
    ctx.arc(10, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    // くちばし（三角）
    ctx.fillStyle = ENEMY_EAGLE_BEAK;
    ctx.beginPath();
    ctx.moveTo(15, -3);
    ctx.lineTo(22, -1);
    ctx.lineTo(15, 2);
    ctx.closePath();
    ctx.fill();
    // 目
    ctx.fillStyle = '#1a1512';
    ctx.beginPath();
    ctx.arc(11, -3, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawPorcupine(ctx) {
    // 横長の楕円の胴体（棘の分だけ下に寄せる）
    ctx.fillStyle = ENEMY_PORCUPINE_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 3, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // 背中側に沿って細い三角形の棘を9本。長さはインデックスから決めて毎フレーム同じに。
    ctx.fillStyle = ENEMY_PORCUPINE_QUIL;
    for (let i = 0; i < 9; i++) {
      const t = i / 8; // 0..1（後ろ→前）
      const bx = -12 + t * 24; // 背中の x 範囲
      // 楕円の上辺（中心 (0,3)、x半径14・y半径9）
      const k = Math.min(1, Math.abs(bx) / 14);
      const by = 3 - Math.sqrt(Math.max(0, 1 - k * k)) * 9;
      const lean = (t - 0.5) * 1.3; // 中央は真上、端は外へ倒す（±0.65 rad）
      const len = 9 + ((i * 3) % 4); // 9〜12px
      const dx = Math.sin(lean);
      const dy = -Math.cos(lean); // 上向き
      ctx.beginPath();
      ctx.moveTo(bx - dy * 1.8, by + dx * 1.8);
      ctx.lineTo(bx + dy * 1.8, by - dx * 1.8);
      ctx.lineTo(bx + dx * len, by + dy * len);
      ctx.closePath();
      ctx.fill();
    }
    // 前方の小さい目
    ctx.fillStyle = '#1a1512';
    ctx.beginPath();
    ctx.arc(11, 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // 短い脚2本
    ctx.strokeStyle = ENEMY_PORCUPINE_BODY;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 11);
    ctx.lineTo(-7, 14);
    ctx.moveTo(8, 11);
    ctx.lineTo(8, 14);
    ctx.stroke();
  }
}

/**
 * その敵が「動かすべき範囲」にいるかを返す。
 * 画面の左右に ENEMY_ACTIVE_MARGIN の余裕を持たせた矩形に、敵が少しでも入っていれば true。
 * 縦方向は判定しない（ステージ高さ768pxが画面540pxとほぼ同じで、絞ると高所の敵が止まる事故が怖いため）。
 * @param {Enemy} enemy
 * @param {import('./camera.js').Camera} camera
 * @returns {boolean}
 */
export function isEnemyActive(enemy, camera) {
  const left = camera.x - ENEMY_ACTIVE_MARGIN;
  const right = camera.x + camera.viewWidth + ENEMY_ACTIVE_MARGIN;
  return enemy.x + enemy.width >= left && enemy.x <= right;
}

/**
 * ヤギと敵の当たり判定を解決する。
 * 重なっている生存中の敵について、次の順序で判定する（順序を変えないこと）。
 *   1. 突進中なら撃破（ヤギは止めない）
 *   2. 踏みつけ成立なら撃破（ヤギを跳ね返す）
 *   3. それ以外は被弾（onGoatHit を呼ぶ）
 * isEnemyActive が false の（画面から遠い）敵は判定の対象から外す。
 * @param {import('./goat.js').Goat} goat
 * @param {Enemy[]} enemies
 * @param {import('./world.js').World} world
 * @param {import('./camera.js').Camera} camera
 * @param {() => void} onGoatHit 被弾時のコールバック（スポーン復帰）
 */
export function resolveGoatEnemyCollisions(goat, enemies, world, camera, onGoatHit) {
  // 死亡演出中は何も判定しない（死体には当たらない）
  if (goat.isDead) return;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    // 画面から遠い敵は動いていないので当たり判定からも外す
    if (!isEnemyActive(enemy, camera)) continue;

    // AABB の重なり判定
    const overlap =
      goat.x < enemy.x + enemy.width &&
      goat.x + goat.width > enemy.x &&
      goat.y < enemy.y + enemy.height &&
      goat.y + goat.height > enemy.y;
    if (!overlap) continue;

    const cx = enemy.x + enemy.width / 2;
    const cy = enemy.y + enemy.height / 2;
    const color = BODY_COLOR[enemy.type];

    // 1. 突進中なら撃破
    if (goat.isDashing) {
      enemy.alive = false;
      world.spawnDebris(cx, cy, color, 8);
      continue; // ヤギは止めない
    }

    // 2. 踏みつけ成立なら撃破（判定は寛容側。条件を厳しくしないこと）
    if (
      enemy.stompable &&
      goat.vy > 0 &&
      goat.y + goat.height - enemy.y <= STOMP_TOLERANCE
    ) {
      enemy.alive = false;
      world.spawnDebris(cx, cy, color, 8);
      goat.vy = STOMP_BOUNCE;
      continue;
    }

    // 3. それ以外は被弾（無敵中はすり抜ける。撃破は無敵中でも上の 1・2 で成立する）
    if (goat.invincibleTimer > 0) continue;
    onGoatHit();
    return; // 被弾したらスポーン復帰済み。以降の判定は不要
  }
}
