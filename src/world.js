// ALPINE GOAT — 地形データの解釈と衝突判定
// Phase 4: タイルマップ（32px単位）、AABB衝突の軸分離解決、実体/すり抜け床/棘/破壊可能岩。
// Phase 7: 頭突きによる破壊可能岩の破壊と破片（デブリ）。
// Phase 8: 敵の出現位置の抽出。破片を敵の撃破エフェクトにも使えるよう汎用化。
// カメラ・死亡処理は後続フェーズ。ここでは棘は「検出のみ」。

import {
  TILE_SIZE,
  GRAVITY,
  CHECKPOINT_POLE_COLOR,
  CHECKPOINT_FLAG_OFF,
  CHECKPOINT_FLAG_ON,
  CHECKPOINT_POLE_HEIGHT,
  GOAL_POLE_COLOR,
  GOAL_FLAG_COLOR,
  GOAL_POLE_HEIGHT,
  TILE_ROCK,
  TILE_ROCK_TOP,
  TILE_BREAKABLE,
  TILE_BREAKABLE_TOP,
  TILE_CRACK,
  TILE_ONEWAY,
  TILE_SPIKE,
} from './config.js';

// 実体（全方向から衝突する）として扱う記号。'*'（破壊可能岩）も Phase 4 では通常の壁。
const SOLID_CHARS = new Set(['#', '*']);

// 敵記号 → 種別名
const ENEMY_TYPES = { M: 'marmot', E: 'eagle', Y: 'porcupine' };

export class World {
  /**
   * @param {{tiles: string[]}} stageData ステージデータ
   */
  constructor(stageData) {
    // 各行を1文字ずつの配列にして内部グリッドを作る
    this.grid = stageData.tiles.map((line) => line.split(''));
    this.rows = this.grid.length;
    this.cols = this.rows > 0 ? this.grid[0].length : 0;
    this.widthPx = this.cols * TILE_SIZE;
    this.heightPx = this.rows * TILE_SIZE;
    this.debris = []; // 破壊された岩の破片 / 敵の撃破エフェクト
    this.time = 0;    // 経過時間（秒）。旗の揺れなど時間を使う演出のため

    // 地形タイルの配色。既定色にステージの tilePalette を上書きする（形は変えず色だけ差し替え）
    this.tilePalette = {
      rock: TILE_ROCK,
      rockTop: TILE_ROCK_TOP,
      breakable: TILE_BREAKABLE,
      breakableTop: TILE_BREAKABLE_TOP,
      crack: TILE_CRACK,
      oneway: TILE_ONEWAY,
      spike: TILE_SPIKE,
      ...(stageData.tilePalette || {}),
    };

    // 敵の出現位置・チェックポイント・ゴールを抽出し、そのタイルは空にする
    this.enemySpawns = [];
    this.checkpoints = [];
    this.goal = null;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const ch = this.grid[row][col];
        const type = ENEMY_TYPES[ch];
        if (type) {
          this.enemySpawns.push({ type, col, row });
          this.grid[row][col] = '.';
        } else if (ch === 'C') {
          // チェックポイント: 判定はタイルの1つ上から2タイル分の高さ
          this.checkpoints.push({
            col,
            row,
            x: col * TILE_SIZE,
            y: (row - 1) * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE * 2,
            reached: false,
          });
          this.grid[row][col] = '.';
        } else if (ch === 'G') {
          // ゴール旗: チェックポイントと同じ方式（判定は2タイル分の高さ）
          this.goal = {
            col,
            row,
            x: col * TILE_SIZE,
            y: (row - 1) * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE * 2,
          };
          this.grid[row][col] = '.';
        }
      }
    }
  }

  /**
   * entity の当たり判定と重なる、まだ reached でないチェックポイントがあれば
   * reached を true にしてそのチェックポイントを返す。なければ null。
   * @param {{x:number,y:number,width:number,height:number}} entity
   * @returns {object|null}
   */
  checkCheckpoints(entity) {
    for (const cp of this.checkpoints) {
      if (cp.reached) continue;
      if (
        entity.x < cp.x + cp.width &&
        entity.x + entity.width > cp.x &&
        entity.y < cp.y + cp.height &&
        entity.y + entity.height > cp.y
      ) {
        cp.reached = true;
        return cp;
      }
    }
    return null;
  }

  /**
   * entity の当たり判定がゴール旗と重なっていれば true。goal が null なら false。
   * @param {{x:number,y:number,width:number,height:number}} entity
   * @returns {boolean}
   */
  isTouchingGoal(entity) {
    const g = this.goal;
    if (!g) return false;
    return (
      entity.x < g.x + g.width &&
      entity.x + entity.width > g.x &&
      entity.y < g.y + g.height &&
      entity.y + entity.height > g.y
    );
  }

  /**
   * ワールドの時間経過を進める。
   * @param {number} dt 固定タイムステップ（秒）
   */
  update(dt) {
    this.time += dt;
    this.updateDebris(dt);
  }

  /**
   * その位置のタイル文字を返す。範囲外は '.'（エラーにしない）。
   * @param {number} col
   * @param {number} row
   * @returns {string}
   */
  getTile(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return '.';
    const ch = this.grid[row][col];
    return ch === undefined ? '.' : ch;
  }

  /** '#' または '*' なら true */
  isSolid(col, row) {
    return SOLID_CHARS.has(this.getTile(col, row));
  }

  /** '=' なら true（すり抜け床） */
  isOneWay(col, row) {
    return this.getTile(col, row) === '=';
  }

  /** '^' なら true（棘） */
  isSpike(col, row) {
    return this.getTile(col, row) === '^';
  }

  /**
   * entity の当たり判定と重なるタイルに '^' があれば true。
   * @param {{x:number,y:number,width:number,height:number}} entity
   * @returns {boolean}
   */
  isTouchingSpike(entity) {
    const colFrom = Math.floor(entity.x / TILE_SIZE);
    const colTo = Math.floor((entity.x + entity.width - 1) / TILE_SIZE);
    const rowFrom = Math.floor(entity.y / TILE_SIZE);
    const rowTo = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);
    for (let row = rowFrom; row <= rowTo; row++) {
      for (let col = colFrom; col <= colTo; col++) {
        if (this.isSpike(col, row)) return true;
      }
    }
    return false;
  }

  /**
   * entity の進行方向側の「隣の列」を調べ、重なる行に '*'（破壊可能岩）があれば破壊する。
   * 必ず衝突解決の前に呼ぶこと（後だと壁に阻まれてから壊すことになり1フレーム引っかかる）。
   * facing を持たないオブジェクトが渡された場合は何もしない。
   * @param {{x:number,y:number,width:number,height:number,facing:number}} entity
   */
  breakDestructibleAhead(entity) {
    if (typeof entity.facing !== 'number') return;
    const col =
      entity.facing === 1
        ? Math.floor((entity.x + entity.width) / TILE_SIZE)
        : Math.floor((entity.x - 1) / TILE_SIZE);
    const rowFrom = Math.floor(entity.y / TILE_SIZE);
    const rowTo = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);
    for (let row = rowFrom; row <= rowTo; row++) {
      if (this.getTile(col, row) === '*') {
        this.grid[row][col] = '.';
        this.spawnDebris(
          col * TILE_SIZE + TILE_SIZE / 2,
          row * TILE_SIZE + TILE_SIZE / 2,
          this.tilePalette.breakable, // ステージの破壊可能岩の色に合わせる
          8
        );
      }
    }
  }

  /**
   * ワールド座標の中心から count 個の破片を発生させる（岩の破壊・敵の撃破に共用）。
   * 発生は1回きりのイベントなので Math.random() を使ってよい（毎フレーム変わらない）。
   * @param {number} centerX ワールド座標
   * @param {number} centerY ワールド座標
   * @param {string} color 破片の色
   * @param {number} count 個数
   */
  spawnDebris(centerX, centerY, color, count) {
    for (let i = 0; i < count; i++) {
      this.debris.push({
        x: centerX + (Math.random() * 2 - 1) * 10, // 中心 ± 10px
        y: centerY + (Math.random() * 2 - 1) * 10,
        vx: (Math.random() * 2 - 1) * 140, // -140〜+140
        vy: -60 - Math.random() * 200, // -260〜-60
        life: 0.5 + Math.random() * 0.4, // 0.5〜0.9 秒
        size: 3 + Math.random() * 3, // 3〜6 px
        color,
      });
    }
  }

  /**
   * 破片を更新し、寿命が尽きたものを取り除く。地形との衝突判定は不要（貫通してよい）。
   * @param {number} dt
   */
  updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vy += GRAVITY * 0.6 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      if (d.life <= 0) this.debris.splice(i, 1);
    }
  }

  /**
   * 破片を描画する。破壊可能岩と同じ色の正方形。寿命末期はフェードアウト。
   * @param {CanvasRenderingContext2D} ctx
   */
  renderDebris(ctx) {
    ctx.save();
    for (const d of this.debris) {
      ctx.globalAlpha = d.life < 0.25 ? d.life / 0.25 : 1;
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
    }
    ctx.restore();
  }

  /**
   * チェックポイントの旗を描画する。描画規約: 全体を save()/restore() で囲む。
   * @param {CanvasRenderingContext2D} ctx
   */
  renderCheckpoints(ctx) {
    ctx.save();
    for (const cp of this.checkpoints) {
      const poleX = cp.col * TILE_SIZE + 6;
      const poleBottom = (cp.row + 1) * TILE_SIZE;
      const poleTop = poleBottom - CHECKPOINT_POLE_HEIGHT;

      // 旗ざお
      ctx.strokeStyle = CHECKPOINT_POLE_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(poleX, poleBottom);
      ctx.lineTo(poleX, poleTop);
      ctx.stroke();

      // 旗（ざお上端から右へ伸びる三角形。幅22・高さ14）
      // 到達済みは先端の y を揺らす
      const wobble = cp.reached ? Math.sin(this.time * 4) * 2 : 0;
      ctx.fillStyle = cp.reached ? CHECKPOINT_FLAG_ON : CHECKPOINT_FLAG_OFF;
      ctx.beginPath();
      ctx.moveTo(poleX, poleTop);
      ctx.lineTo(poleX + 22, poleTop + 7 + wobble);
      ctx.lineTo(poleX, poleTop + 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * ゴール旗を描画する。renderCheckpoints と同じ描き方だが、ざお・旗ともに大きく、常に揺れる。
   * 描画規約: 全体を save()/restore() で囲む。
   * @param {CanvasRenderingContext2D} ctx
   */
  renderGoal(ctx) {
    if (!this.goal) return;
    ctx.save();
    const g = this.goal;
    const poleX = g.col * TILE_SIZE + 6;
    const poleBottom = (g.row + 1) * TILE_SIZE;
    const poleTop = poleBottom - GOAL_POLE_HEIGHT;

    // 旗ざお
    ctx.strokeStyle = GOAL_POLE_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(poleX, poleBottom);
    ctx.lineTo(poleX, poleTop);
    ctx.stroke();

    // 旗（ざお上端から右へ伸びる三角形。幅30・高さ20。常に揺らす）
    const wobble = Math.sin(this.time * 3) * 3;
    ctx.fillStyle = GOAL_FLAG_COLOR;
    ctx.beginPath();
    ctx.moveTo(poleX, poleTop);
    ctx.lineTo(poleX + 30, poleTop + 10 + wobble);
    ctx.lineTo(poleX, poleTop + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 地形を描画する。描画規約: 全体を save()/restore() で囲む。
   * カメラの可視範囲＋前後1タイルだけを走査する（画面端でタイルが欠けないよう余裕を持たせる）。
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   */
  render(ctx, camera) {
    ctx.save();
    const colFrom = Math.max(0, Math.floor(camera.x / TILE_SIZE) - 1);
    const colTo = Math.min(this.cols - 1, Math.floor((camera.x + camera.viewWidth) / TILE_SIZE) + 1);
    const rowFrom = Math.max(0, Math.floor(camera.y / TILE_SIZE) - 1);
    const rowTo = Math.min(this.rows - 1, Math.floor((camera.y + camera.viewHeight) / TILE_SIZE) + 1);
    for (let row = rowFrom; row <= rowTo; row++) {
      for (let col = colFrom; col <= colTo; col++) {
        const ch = this.grid[row][col];
        if (ch === '.' || ch === undefined) continue;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        if (ch === '#') {
          // 岩: 本体 + 上端3pxのハイライト
          ctx.fillStyle = this.tilePalette.rock;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = this.tilePalette.rockTop;
          ctx.fillRect(x, y, TILE_SIZE, 3);
        } else if (ch === '*') {
          // 破壊可能岩: 本体 + 上端3px + 対角のひび2本
          ctx.fillStyle = this.tilePalette.breakable;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = this.tilePalette.breakableTop;
          ctx.fillRect(x, y, TILE_SIZE, 3);
          ctx.strokeStyle = this.tilePalette.crack;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 7);
          ctx.lineTo(x + TILE_SIZE - 7, y + TILE_SIZE - 6);
          ctx.moveTo(x + TILE_SIZE - 8, y + 6);
          ctx.lineTo(x + 9, y + TILE_SIZE - 9);
          ctx.stroke();
        } else if (ch === '=') {
          // すり抜け床: タイル上端から高さ8pxの帯だけ
          ctx.fillStyle = this.tilePalette.oneway;
          ctx.fillRect(x, y, TILE_SIZE, 8);
        } else if (ch === '^') {
          // 棘: タイル幅を3等分した上向き三角形×3（底辺はタイル下端、頂点はタイル上端）
          ctx.fillStyle = this.tilePalette.spike;
          const third = TILE_SIZE / 3;
          for (let i = 0; i < 3; i++) {
            const bx = x + i * third;
            ctx.beginPath();
            ctx.moveTo(bx, y + TILE_SIZE);
            ctx.lineTo(bx + third, y + TILE_SIZE);
            ctx.lineTo(bx + third / 2, y);
            ctx.closePath();
            ctx.fill();
          }
        }
        // それ以外（C G M E Y など未実装記号）は描かず無視する
      }
    }

    // チェックポイントとゴールは地形の上・破片の下に描く
    this.renderCheckpoints(ctx);
    this.renderGoal(ctx);

    // 破片は地形の上に描く
    this.renderDebris(ctx);

    ctx.restore();
  }
}

/**
 * エンティティを速度ぶん移動させ、地形との衝突を「水平 → 垂直」の順に軸分離で解決する。
 * ヤギ専用ではなく、x / y / width / height / vx / vy / onGround を持つ任意のオブジェクトに使える。
 * @param {{x:number,y:number,width:number,height:number,vx:number,vy:number,onGround:boolean}} entity
 * @param {number} dt 固定タイムステップ（秒）
 * @param {World} world
 */
export function moveAndCollide(entity, dt, world) {
  // --- 手順1: 縦移動の前の足元位置を記録する ---
  const prevBottom = entity.y + entity.height;

  // --- 手順2: 水平移動と解決 ---
  entity.x += entity.vx * dt;

  // 当たり判定が重なる行の範囲
  const rowFrom = Math.floor(entity.y / TILE_SIZE);
  const rowTo = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);

  if (entity.vx > 0) {
    // 右へ移動中: 右端の列を調べる
    const col = Math.floor((entity.x + entity.width - 1) / TILE_SIZE);
    for (let row = rowFrom; row <= rowTo; row++) {
      if (world.isSolid(col, row)) {
        entity.x = col * TILE_SIZE - entity.width;
        entity.vx = 0;
        break;
      }
    }
  } else if (entity.vx < 0) {
    // 左へ移動中: 左端の列を調べる
    const col = Math.floor(entity.x / TILE_SIZE);
    for (let row = rowFrom; row <= rowTo; row++) {
      if (world.isSolid(col, row)) {
        entity.x = (col + 1) * TILE_SIZE;
        entity.vx = 0;
        break;
      }
    }
  }
  // すり抜け床（'='）は水平方向では衝突させない

  // --- 手順3: 垂直移動と解決 ---
  entity.y += entity.vy * dt;
  entity.onGround = false;

  // 当たり判定が重なる列の範囲
  const colFrom = Math.floor(entity.x / TILE_SIZE);
  const colTo = Math.floor((entity.x + entity.width - 1) / TILE_SIZE);

  if (entity.vy > 0) {
    // 落下中: 足元の行を調べる
    // ※足元直下の行を見るため、ここは -1 しない（-1 すると接地静止時に
    //   足元ラインがタイル境界と一致したとき1行上を見てしまい、着地判定が不安定になる）
    const row = Math.floor((entity.y + entity.height) / TILE_SIZE);
    for (let col = colFrom; col <= colTo; col++) {
      const solid = world.isSolid(col, row);
      // すり抜け床は「移動前の足元がその床の上面より上にあった」ときだけ乗る
      const landOnOneWay =
        world.isOneWay(col, row) && prevBottom <= row * TILE_SIZE;
      if (solid || landOnOneWay) {
        entity.y = row * TILE_SIZE - entity.height;
        entity.vy = 0;
        entity.onGround = true;
        break;
      }
    }
  } else if (entity.vy < 0) {
    // 上昇中: 頭上の行を調べる（すり抜け床は無視）
    const row = Math.floor(entity.y / TILE_SIZE);
    for (let col = colFrom; col <= colTo; col++) {
      if (world.isSolid(col, row)) {
        entity.y = (row + 1) * TILE_SIZE;
        entity.vy = 0;
        break;
      }
    }
  }
}
