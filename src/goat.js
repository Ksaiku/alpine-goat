// ALPINE GOAT — ヤギの物理と状態機械
// Phase 6: アニメーション用の値（phase / animTime / timeSinceLanded）を持ち、描画は goatRenderer.js へ委譲。
// Phase 7: 頭突き（ダッシュ突進）の挙動を追加。
// Phase 9: 死亡演出・復帰・無敵時間（SPEC 第9章）。空中突進のクールダウンを 0 に。

import {
  GOAT_HITBOX_WIDTH,
  GOAT_HITBOX_HEIGHT,
  GRAVITY,
  MAX_FALL_SPEED,
  MOVE_SPEED,
  ACCEL_GROUND,
  ACCEL_AIR,
  FRICTION_GROUND,
  OVERSPEED_DECEL,
  JUMP_VELOCITY,
  JUMP_CUT_MULTIPLIER,
  COYOTE_TIME,
  JUMP_BUFFER_TIME,
  DASH_SPEED,
  DASH_DURATION,
  DASH_COOLDOWN,
  DASH_AIR_COOLDOWN,
  DASH_GRAVITY_SCALE,
  DEATH_ANIM_TIME,
  DEATH_JUMP_VELOCITY,
  DEATH_SPIN_SPEED,
  INVINCIBLE_TIME,
  GOAT_STRIDE_MIN,
  GOAT_STRIDE_MAX,
  GOAT_STRIDE_SCALE,
  GOAT_LIFT_MIN,
  GOAT_LIFT_MAX,
  GOAT_LIFT_SCALE,
  GOAT_STANCE_RATIO,
} from './config.js';
import { Input } from './input.js';
import { moveAndCollide } from './world.js';
import { renderGoat } from './goatRenderer.js';

export class Goat {
  /**
   * @param {number} x 当たり判定矩形の左上 x
   * @param {number} y 当たり判定矩形の左上 y
   */
  constructor(x, y) {
    this.x = x;                       // 当たり判定矩形の左上座標
    this.y = y;
    this.width = GOAT_HITBOX_WIDTH;   // 当たり判定の幅
    this.height = GOAT_HITBOX_HEIGHT; // 当たり判定の高さ
    this.vx = 0;                      // 水平速度（px/秒）
    this.vy = 0;                      // 垂直速度（px/秒）。上向きが負
    this.onGround = false;            // 接地しているか
    this.facing = 1;                  // 向き。右が 1、左が -1
    this.state = 'idle';             // 'idle' / 'walk' / 'run' / 'jump' / 'fall'
    this.coyoteTimer = 0;             // 地面を離れてからのジャンプ猶予の残り（秒）
    this.jumpBufferTimer = 0;         // 先行入力の残り（秒）
    this.touchingSpike = false;       // 棘に接触しているか（Phase 4 では検出のみ）

    // --- 頭突き（ダッシュ突進）（Phase 7）---
    this.isDashing = false;          // 突進中か
    this.dashTimer = 0;              // 突進の残り時間（秒）
    this.dashCooldown = 0;           // 再発動できるまでの残り時間（秒）
    this.dashStartedInAir = false;   // 空中で発動したか（終了判定に使う）

    // --- 死亡・無敵（Phase 9）---
    this.isDead = false;             // 死亡演出中か
    this.deathTimer = 0;             // 死亡演出の残り時間（秒）
    this.deathRotation = 0;          // 死亡中の回転角（ラジアン）
    this.invincibleTimer = 0;        // 無敵の残り時間（秒）

    // --- 描画アニメーション用（Phase 6 / 6.5）---
    this.phase = 0;                  // 歩行サイクルの位相（0〜1）。毎フレーム積み上げる（速度変化で飛ばない）
    this.stride = 0;                 // いまの歩幅（px）。速度に応じて変える
    this.lift = 0;                   // いまの足の持ち上げ高さ（px）。速度に応じて変える
    this.animTime = 0;               // 経過時間の累積。待機モーション（呼吸）に使う
    this.timeSinceLanded = 999;      // 着地からの経過秒。着地の沈み込み演出に使う
  }

  /**
   * 物理と状態の更新。dt は固定タイムステップ（秒）。
   * 処理順序は仕様どおり厳守すること（順番が変わると挙動が変わる）。
   * @param {number} dt
   * @param {import('./world.js').World} world 地形
   */
  /**
   * 死亡させる（死亡演出つき）。死因は敵・棘。
   */
  die() {
    if (this.isDead) return; // 二重に死なない
    this.isDead = true;
    this.deathTimer = DEATH_ANIM_TIME;
    this.deathRotation = 0;
    this.vx = 0;
    this.vy = DEATH_JUMP_VELOCITY; // 上へ跳ねる
    this.isDashing = false;
    this.state = 'dead';
  }

  /**
   * 復帰地点へリスポーンする（無敵時間つき）。
   * @param {number} x 当たり判定の左上 x
   * @param {number} y 当たり判定の左上 y
   */
  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isDead = false;
    this.deathTimer = 0;
    this.deathRotation = 0;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.invincibleTimer = INVINCIBLE_TIME;
    this.state = 'idle';
    this.phase = 0;
  }

  update(dt, world) {
    // --- 死亡演出中は通常処理を一切行わず、演出だけ進める ---
    if (this.isDead) {
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      this.deathRotation += DEATH_SPIN_SPEED * dt;
      this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
      this.y += this.vy * dt; // ★地形を無視してそのまま落ちる
      this.state = 'dead';
      return; // 入力・衝突・棘・チェックポイントの判定は一切行わない
    }

    // この更新の衝突解決より前の接地状態（着地判定に使う）
    const wasOnGround = this.onGround;

    // --- 1. タイマーを減らす ---
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    if (this.isDashing) this.dashTimer = Math.max(0, this.dashTimer - dt);

    // --- 突進の開始判定（手順2の直前）---
    // 発動条件: 突進キーが押された かつ 突進中でない かつ クールダウンが終わっている
    if (Input.wasPressed('dash') && !this.isDashing && this.dashCooldown <= 0) {
      this.isDashing = true;
      this.dashTimer = DASH_DURATION;
      this.dashStartedInAir = !this.onGround;
      this.vx = this.facing * DASH_SPEED;
      this.vy = 0; // 空中で撃っても水平に突っ込むよう、縦速度を消す
    }

    // --- 2. 水平入力から vx を更新する（突進中は丸ごとスキップ）---
    if (!this.isDashing) {
      const dir = (Input.isDown('right') ? 1 : 0) + (Input.isDown('left') ? -1 : 0);

      if (dir !== 0) {
        // すでに最高速以上で同じ向きに進んでいるときは、それ以上加速しない
        const sameDir = Math.sign(this.vx) === dir;
        if (!(sameDir && Math.abs(this.vx) >= MOVE_SPEED)) {
          const accel = this.onGround ? ACCEL_GROUND : ACCEL_AIR;
          this.vx += dir * accel * dt;
        }
      }

      // 最高速を超えている間は、切り詰めずになめらかに最高速まで落とす（突進の勢いを尾を引かせて逃がす）
      const sp = Math.abs(this.vx);
      if (sp > MOVE_SPEED) {
        this.vx = Math.sign(this.vx) * Math.max(MOVE_SPEED, sp - OVERSPEED_DECEL * dt);
      }

      // 入力なし かつ 接地 かつ 最高速以下 のときだけ摩擦をかける
      if (dir === 0 && this.onGround && Math.abs(this.vx) <= MOVE_SPEED) {
        const drop = FRICTION_GROUND * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - drop);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + drop);
      }
    }
    // 突進中は vx を開始時の値（facing * DASH_SPEED）のまま保つ

    // --- 3. ジャンプ入力を処理する ---
    // ジャンプ押下は先行入力バッファに積む
    if (Input.wasPressed('jump')) this.jumpBufferTimer = JUMP_BUFFER_TIME;
    // 成立条件: バッファが残っていて、かつコヨーテ猶予が残っている
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = JUMP_VELOCITY;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.onGround = false;
    }
    // 上昇中にジャンプキーを離したら上昇速度を減衰（短押しで低く跳ぶ）
    if (Input.wasReleased('jump') && this.vy < 0) {
      this.vy *= JUMP_CUT_MULTIPLIER;
    }

    // --- 4. 重力を適用する（突進中は重力を弱める）---
    const gravityScale = this.isDashing ? DASH_GRAVITY_SCALE : 1;
    this.vy += GRAVITY * gravityScale * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // --- 5 の直前: 破壊可能岩の破壊判定（必ず衝突解決の前に）---
    if (this.isDashing) {
      world.breakDestructibleAhead(this);
    }

    // --- 5・6. 位置更新と地形衝突（水平→垂直の順に軸分離で解決）---
    moveAndCollide(this, dt, world);

    // 世界の左右端からはみ出さないようクランプ（壁に当たったら水平速度を殺す）
    const maxX = world.widthPx - this.width;
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    } else if (this.x > maxX) {
      this.x = maxX;
      this.vx = 0;
    }

    // --- 突進の終了判定（moveAndCollide の後）---
    if (this.isDashing) {
      const ended =
        this.dashTimer <= 0 ||
        (this.dashStartedInAir && this.onGround) ||
        this.vx === 0;
      if (ended) {
        this.isDashing = false;
        // クールダウンは「接地しているときだけ」適用。空中で時間切れ終了なら 0（すぐ撃ち直せる）。
        this.dashCooldown = this.onGround ? DASH_COOLDOWN : DASH_AIR_COOLDOWN;
        // 速度の丸め込みはしない。手順2の OVERSPEED_DECEL が 0.2 秒かけて 620 → 260 に落とす。
      }
    }

    // 棘との接触を検出（突進中も通常どおり。突進は無敵ではない）
    this.touchingSpike = world.isTouchingSpike(this);

    // --- 7. 接地していれば猶予タイマーを満タンにする（必ず手順6の後）---
    if (this.onGround) this.coyoteTimer = COYOTE_TIME;

    // --- 8. 向きと状態を更新する ---
    if (this.vx > 0) this.facing = 1;
    else if (this.vx < 0) this.facing = -1;
    // vx === 0 のときは前の向きを維持する

    if (this.isDashing) {
      // 突進中は他のどの条件よりも優先
      this.state = 'dash';
    } else if (!this.onGround && this.vy < 0) {
      this.state = 'jump';
    } else if (!this.onGround) {
      this.state = 'fall';
    } else if (Math.abs(this.vx) < 10) {
      this.state = 'idle';
    } else if (Math.abs(this.vx) < MOVE_SPEED * 0.6) {
      this.state = 'walk';
    } else {
      this.state = 'run';
    }

    // --- 手順8の後：描画アニメーション用の値を更新する ---
    const speed = Math.abs(this.vx);
    // 歩幅と持ち上げ高さは速度に応じて変える
    this.stride = Math.min(
      GOAT_STRIDE_MAX,
      Math.max(GOAT_STRIDE_MIN, GOAT_STRIDE_MIN + speed * GOAT_STRIDE_SCALE)
    );
    this.lift = Math.min(
      GOAT_LIFT_MAX,
      Math.max(GOAT_LIFT_MIN, GOAT_LIFT_MIN + speed * GOAT_LIFT_SCALE)
    );
    // 接地した足が滑らない、1サイクルぶんの移動距離（歩幅から逆算）
    const stepLength = (2 * this.stride) / GOAT_STANCE_RATIO;
    // 位相は「距離÷サイクル長」ではなく毎フレーム積み上げる（速度変化で位相が飛ばない）
    if (this.onGround) {
      this.phase = (this.phase + (speed * dt) / stepLength) % 1;
    }
    // 経過時間は毎フレーム積む
    this.animTime += dt;
    // 着地の瞬間（非接地→接地）に沈み込みタイマーを 0 リセット
    if (!wasOnGround && this.onGround) this.timeSinceLanded = 0;
    else this.timeSinceLanded += dt;
  }

  /**
   * 描画は goatRenderer.js に委譲する（プロシージャルな関節駆動の描画）。
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    renderGoat(ctx, this);
  }
}
