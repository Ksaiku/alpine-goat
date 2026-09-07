// ALPINE GOAT — カメラ（ヤギ追従・デッドゾーン・スムージング・ステージ端クランプ）

import {
  CAMERA_DEADZONE_X,
  CAMERA_DEADZONE_Y,
  CAMERA_SMOOTHING,
  CAMERA_LOOKAHEAD,
} from './config.js';

export class Camera {
  /**
   * @param {number} viewWidth  視界の幅（論理px）
   * @param {number} viewHeight 視界の高さ（論理px）
   * @param {import('./world.js').World} world クランプに使う地形
   */
  constructor(viewWidth, viewHeight, world) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.world = world;
    this.x = 0; // 映している範囲の左上ワールド座標
    this.y = 0;
  }

  /**
   * 追いたい点（ヤギの中心 + 進行方向への先読み）を返す。
   * @param {{x:number,y:number,width:number,height:number,facing:number}} target
   * @returns {{cx:number, cy:number}}
   */
  _focusPoint(target) {
    const cx = target.x + target.width / 2 + target.facing * CAMERA_LOOKAHEAD;
    const cy = target.y + target.height / 2;
    return { cx, cy };
  }

  /** ステージ外が見えないよう x/y をクランプする。 */
  _clamp() {
    // ステージが画面より小さいと上限が負になるため Math.max(0, ...) で守る
    const maxX = Math.max(0, this.world.widthPx - this.viewWidth);
    const maxY = Math.max(0, this.world.heightPx - this.viewHeight);
    this.x = Math.min(Math.max(this.x, 0), maxX);
    this.y = Math.min(Math.max(this.y, 0), maxY);
  }

  /**
   * 追従処理。手順1〜4の順で実装。
   * @param {{x:number,y:number,width:number,height:number,facing:number}} target
   * @param {number} dt 固定タイムステップ（秒）
   */
  follow(target, dt) {
    // 手順1. 追いたい点
    const { cx, cy } = this._focusPoint(target);

    // 手順2. デッドゾーンを考慮した目標位置
    let targetX = this.x;
    let targetY = this.y;
    const relX = cx - (this.x + this.viewWidth / 2); // カメラ中心からのずれ
    const relY = cy - (this.y + this.viewHeight / 2);
    if (relX > CAMERA_DEADZONE_X) targetX = this.x + (relX - CAMERA_DEADZONE_X);
    if (relX < -CAMERA_DEADZONE_X) targetX = this.x + (relX + CAMERA_DEADZONE_X);
    if (relY > CAMERA_DEADZONE_Y) targetY = this.y + (relY - CAMERA_DEADZONE_Y);
    if (relY < -CAMERA_DEADZONE_Y) targetY = this.y + (relY + CAMERA_DEADZONE_Y);

    // 手順3. なめらかに寄せる（フレームレート非依存の指数補間）
    const t = 1 - Math.exp(-CAMERA_SMOOTHING * dt);
    this.x += (targetX - this.x) * t;
    this.y += (targetY - this.y) * t;

    // 手順4. ステージ端でクランプ
    this._clamp();
  }

  /**
   * スムージングなしで即座に目標へ合わせる（起動時・復帰時に使う）。
   * 手順1の cx,cy にカメラ中心を直接合わせ、手順4のクランプだけ行う。
   * @param {{x:number,y:number,width:number,height:number,facing:number}} target
   */
  snapTo(target) {
    const { cx, cy } = this._focusPoint(target);
    this.x = cx - this.viewWidth / 2;
    this.y = cy - this.viewHeight / 2;
    this._clamp();
  }

  /**
   * ワールド座標へ描画を移すための平行移動をかける。
   * ちらつき防止のため整数へ丸める。
   * @param {CanvasRenderingContext2D} ctx
   */
  applyTo(ctx) {
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }
}
