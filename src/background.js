// ALPINE GOAT — パララックス背景（3層プロシージャル）
// 形状はコンストラクタで1回だけ生成し、render では使い回す。
// render の中で Math.random() を呼ぶと毎フレーム形が変わってちらつくため禁止。

import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  BG_PATTERN_WIDTH,
  BG_SKY_TOP,
  BG_SKY_BOTTOM,
  BG_FAR_FILL,
  BG_FAR_EDGE,
  BG_MID_FILL,
  BG_NEAR_FILL,
  BG_FAR_FACTOR,
  BG_MID_FACTOR,
  BG_NEAR_FACTOR,
  BG_FAR_BASE,
  BG_FAR_AMP,
  BG_MID_BASE,
  BG_NEAR_BASE,
  BG_NEAR_AMP,
  BG_CAVE_STALACTITE_SPACING,
  BG_CAVE_STALAGMITE_SPACING,
  BG_CAVE_FLOOR_HEIGHT,
  BG_CAVE_ICE_SHINE,
  BG_CAVE_CEILING_Y,
  BG_CAVE_CEILING_HEIGHT,
  BG_CAVE_VIGNETTE_COLOR,
  BG_CAVE_VIGNETTE_INNER,
  BG_SUMMIT_PEAK_BASE,
  BG_SUMMIT_PEAK_AMP,
  BG_SUMMIT_CLOUD_BASE,
  BG_SUMMIT_CLOUD_SPACING,
  BG_SUMMIT_SPIRE_SPACING,
  BG_SUMMIT_SPIRE_BASE,
} from './config.js';

// 各層の塗りは「画面下端 + 200px」まで伸ばして、縦スクロール時も下が途切れないようにする
const FILL_BOTTOM = LOGICAL_HEIGHT + 200;

export class Background {
  /**
   * @param {object} [palette] ステージ固有の配色。省略時は config の既定値（＝ステージ1の配色）を使う。
   *   受け付けるキー: skyTop / skyBottom / farFill / farEdge / midFill / nearFill
   * @param {string} [theme] 'alpine'（既定）/ 'cave' / 'summit'。背景の「形」を切り替える。
   */
  constructor(palette, theme) {
    this.theme = theme || 'alpine';

    // 既定値に、渡されたパレットの値だけを上書きする
    this.palette = {
      skyTop: BG_SKY_TOP,
      skyBottom: BG_SKY_BOTTOM,
      farFill: BG_FAR_FILL,
      farEdge: BG_FAR_EDGE,
      midFill: BG_MID_FILL,
      nearFill: BG_NEAR_FILL,
      ...(palette || {}),
    };

    // 形状の生成はテーマごとに分ける。乱数はここ（コンストラクタ）でのみ使う。
    if (this.theme === 'cave') this._generateCaveShapes();
    else if (this.theme === 'summit') this._generateSummitShapes();
    else this._generateAlpineShapes();
  }

  /** アルプス（既定）テーマの形状を生成する。Phase 5 以来この内容は変えていない。 */
  _generateAlpineShapes() {
    // 層1 遠景：雪山。0〜960pxを16分割した17点（間隔60px）。高さ BG_FAR_BASE ± BG_FAR_AMP。
    // 17点目は1点目と同じ値にして繰り返しの継ぎ目で稜線が途切れないようにする。
    this.farHeights = [];
    for (let k = 0; k < 17; k++) {
      this.farHeights.push(BG_FAR_BASE + (Math.random() * 2 - 1) * BG_FAR_AMP);
    }
    this.farHeights[16] = this.farHeights[0];

    // 層2 中景：針葉樹林。48px間隔で20本。二等辺三角形、底辺 y=BG_MID_BASE。
    // 「柵」に見えないよう、各木の位置に ±14px のずれ、高さ 50〜105、底辺幅 28〜46 のばらつきを付ける。
    this.midTrees = [];
    for (let i = 0; i < 20; i++) {
      this.midTrees.push({
        x: i * 48 + 24 + (Math.random() * 2 - 1) * 14, // 48px間隔 ± 14px のずれ
        height: 50 + Math.random() * 55,               // 50〜105
        half: (28 + Math.random() * 18) / 2,            // 底辺幅 28〜46 の半分
      });
    }

    // 層3 近景：岩肌。0〜960pxを8分割した9点（間隔120px）。高さ BG_NEAR_BASE ± BG_NEAR_AMP。
    // 9点目は1点目と同じ。
    this.nearHeights = [];
    for (let k = 0; k < 9; k++) {
      this.nearHeights.push(BG_NEAR_BASE + (Math.random() * 2 - 1) * BG_NEAR_AMP);
    }
    this.nearHeights[8] = this.nearHeights[0];
  }

  /**
   * 洞窟テーマの形状を生成する。すべて幅 BG_PATTERN_WIDTH(960) を1単位として横に繰り返す。
   * 乱数はここでのみ使い、render では使わない（＝毎フレーム形が変わらない）。
   */
  _generateCaveShapes() {
    // 層1 遠景：上下から迫る岩壁のシルエット
    // 上から垂れる岩：140px間隔で7個。下向き三角形。底辺100〜160・高さ80〜200。y=0 から。
    this.caveFarTop = [];
    for (let i = 0; i < 7; i++) {
      this.caveFarTop.push({
        x: i * 140,
        half: (100 + Math.random() * 60) / 2, // 底辺100〜160の半分
        height: 80 + Math.random() * 120,     // 80〜200
      });
    }
    // 下から立ち上がる岩：160px間隔で6個。上向き三角形。底辺120〜200・高さ60〜140。y=LOGICAL_HEIGHT から。
    this.caveFarBottom = [];
    for (let i = 0; i < 6; i++) {
      this.caveFarBottom.push({
        x: i * 160,
        half: (120 + Math.random() * 80) / 2, // 底辺120〜200の半分
        height: 60 + Math.random() * 80,      // 60〜140
      });
    }

    // 層2 中景：天井から垂れる氷柱。BG_CAVE_STALACTITE_SPACING(48px) 間隔で20本。
    // 下向きの細い三角形。底辺14〜26・高さ50〜150。y=0 から。
    this.stalactites = [];
    for (let i = 0; i < 20; i++) {
      this.stalactites.push({
        x: i * BG_CAVE_STALACTITE_SPACING,
        half: (14 + Math.random() * 12) / 2, // 底辺14〜26の半分
        height: 50 + Math.random() * 100,    // 50〜150
      });
    }

    // 層3 近景：石筍。BG_CAVE_STALAGMITE_SPACING(56px) 間隔で18本。
    // 上向きの三角形。底辺20〜40・高さ40〜110。岩床の上端から。
    this.stalagmites = [];
    for (let i = 0; i < 18; i++) {
      this.stalagmites.push({
        x: i * BG_CAVE_STALAGMITE_SPACING,
        half: (20 + Math.random() * 20) / 2, // 底辺20〜40の半分
        height: 40 + Math.random() * 70,     // 40〜110
      });
    }
  }

  /**
   * 山頂テーマの形状を生成する。「森林限界を超え、雲海の上に出た夕暮れの山頂」。木は描かない。
   * 乱数はここでのみ使い、render では使わない。
   */
  _generateSummitShapes() {
    // 層1 遠景：雲海の向こうに覗く峰。alpine の雪山と同じ作り（17点・基準線と振れ幅だけ違う）。
    this.summitPeaks = [];
    for (let k = 0; k < 17; k++) {
      this.summitPeaks.push(BG_SUMMIT_PEAK_BASE + (Math.random() * 2 - 1) * BG_SUMMIT_PEAK_AMP);
    }
    this.summitPeaks[16] = this.summitPeaks[0]; // 継ぎ目対策

    // 層2 中景：雲海の水面のふくらみ。BG_SUMMIT_CLOUD_SPACING(70px) 間隔で14個の半円。半径26〜52。
    this.summitClouds = [];
    for (let i = 0; i < 14; i++) {
      this.summitClouds.push({
        x: i * BG_SUMMIT_CLOUD_SPACING,
        r: 26 + Math.random() * 26, // 26〜52
      });
    }
    // 水面より少し上に浮かぶちぎれ雲6個（横長楕円・不透明度0.7で描く）。
    this.summitWisps = [];
    for (let i = 0; i < 6; i++) {
      this.summitWisps.push({
        x: Math.random() * BG_PATTERN_WIDTH,               // 0〜960
        y: BG_SUMMIT_CLOUD_BASE - 20 - Math.random() * 70, // 水面の 20〜90px 上
        rx: 30 + Math.random() * 40,                       // 横半径 30〜70
        ry: 7 + Math.random() * 7,                         // 縦半径 7〜14
      });
    }

    // 層3 近景：逆光で黒く沈んだ岩峰。BG_SUMMIT_SPIRE_SPACING(96px) 間隔で11本。
    // 鋭い上向き三角形。底辺40〜80・高さ90〜200（石筍より細く高い）。
    this.summitSpires = [];
    for (let i = 0; i < 11; i++) {
      this.summitSpires.push({
        x: i * BG_SUMMIT_SPIRE_SPACING,
        half: (40 + Math.random() * 40) / 2, // 底辺40〜80の半分
        height: 90 + Math.random() * 110,    // 90〜200
      });
    }
  }

  /**
   * 背景を「画面座標」で描く（カメラの applyTo を適用する前に呼ぶこと）。
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   */
  render(ctx, camera) {
    ctx.save();

    // 1. 空のグラデーション（スクロールさせない・画面全体）
    const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    sky.addColorStop(0, this.palette.skyTop);
    sky.addColorStop(1, this.palette.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // 2. 遠景 → 中景 → 近景（層の数・スクロール係数はテーマ共通。描く形だけ切り替える）
    if (this.theme === 'cave') {
      this._drawParallax(ctx, camera, BG_FAR_FACTOR, (c) => this._drawCaveFar(c));
      this._drawParallax(ctx, camera, BG_MID_FACTOR, (c) => this._drawCaveMid(c));
      this._drawParallax(ctx, camera, BG_NEAR_FACTOR, (c) => this._drawCaveNear(c));
    } else if (this.theme === 'summit') {
      this._drawParallax(ctx, camera, BG_FAR_FACTOR, (c) => this._drawSummitFar(c));
      this._drawParallax(ctx, camera, BG_MID_FACTOR, (c) => this._drawSummitMid(c));
      this._drawParallax(ctx, camera, BG_NEAR_FACTOR, (c) => this._drawSummitNear(c));
    } else {
      this._drawParallax(ctx, camera, BG_FAR_FACTOR, (c) => this._drawFar(c));
      this._drawParallax(ctx, camera, BG_MID_FACTOR, (c) => this._drawMid(c));
      this._drawParallax(ctx, camera, BG_NEAR_FACTOR, (c) => this._drawNear(c));
    }

    ctx.restore();
  }

  /**
   * 洞窟テーマのとき、画面の外周を暗く落として「岩に囲まれた中にいる」感じを出す（周辺減光）。
   * それ以外のテーマでは何も描かない。
   * ★ゲームの世界（地形・ヤギ・敵）を描いたあと、HUD やメニューのパネルより前に呼ぶこと。
   * @param {CanvasRenderingContext2D} ctx
   */
  renderVignette(ctx) {
    if (this.theme !== 'cave') return;
    ctx.save();
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;
    // 中心から画面の角までの距離を「外周までの距離」とする
    const outer = Math.hypot(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    const inner = outer * BG_CAVE_VIGNETTE_INNER;
    const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    g.addColorStop(0, 'rgba(3, 8, 14, 0)');        // 中心付近は透明
    g.addColorStop(1, BG_CAVE_VIGNETTE_COLOR);     // 外周は暗く
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
  }

  /**
   * 1つの層を、カメラ位置に係数を掛けてずらしながら3回繰り返して描く。
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./camera.js').Camera} camera
   * @param {number} factor スクロール係数
   * @param {(ctx: CanvasRenderingContext2D) => void} drawShape 1単位ぶんの形を描く関数
   */
  _drawParallax(ctx, camera, factor, drawShape) {
    // 横方向：カメラ位置に係数を掛けてずらし、パターン幅で折り返す
    const offsetX = -((camera.x * factor) % BG_PATTERN_WIDTH);
    // 縦方向：控えめに動かす（係数をさらに半分に）
    const offsetY = -camera.y * factor * 0.5;
    // 画面を覆うため3回繰り返す
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(offsetX + i * BG_PATTERN_WIDTH, offsetY);
      drawShape(ctx);
      ctx.restore();
    }
  }

  /** 層1 遠景：雪山の折れ線と、その下の塗り＋稜線 */
  _drawFar(ctx) {
    const W = BG_PATTERN_WIDTH;
    // 塗り（稜線の下を FILL_BOTTOM まで）
    ctx.beginPath();
    ctx.moveTo(0, FILL_BOTTOM);
    for (let k = 0; k < this.farHeights.length; k++) {
      ctx.lineTo(k * 60, this.farHeights[k]);
    }
    ctx.lineTo(W + 1, FILL_BOTTOM); // 継ぎ目対策に1px重ねる
    ctx.closePath();
    ctx.fillStyle = this.palette.farFill;
    ctx.fill();
    // 稜線（2px線）
    ctx.beginPath();
    ctx.moveTo(0, this.farHeights[0]);
    for (let k = 1; k < this.farHeights.length; k++) {
      ctx.lineTo(k * 60, this.farHeights[k]);
    }
    ctx.strokeStyle = this.palette.farEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** 層2 中景：y=BG_MID_BASE の地面帯 + シルエットの木 */
  _drawMid(ctx) {
    ctx.fillStyle = this.palette.midFill;
    ctx.fillRect(0, BG_MID_BASE, BG_PATTERN_WIDTH + 1, FILL_BOTTOM - BG_MID_BASE);
    for (const t of this.midTrees) {
      ctx.beginPath();
      ctx.moveTo(t.x - t.half, BG_MID_BASE);
      ctx.lineTo(t.x + t.half, BG_MID_BASE);
      ctx.lineTo(t.x, BG_MID_BASE - t.height);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** 層3 近景：岩肌の折れ線と、その下の塗り */
  _drawNear(ctx) {
    const W = BG_PATTERN_WIDTH;
    ctx.beginPath();
    ctx.moveTo(0, FILL_BOTTOM);
    for (let k = 0; k < this.nearHeights.length; k++) {
      ctx.lineTo(k * 120, this.nearHeights[k]);
    }
    ctx.lineTo(W + 1, FILL_BOTTOM); // 継ぎ目対策に1px重ねる
    ctx.closePath();
    ctx.fillStyle = this.palette.nearFill;
    ctx.fill();
  }

  // ================= 洞窟テーマの各層 =================

  /** 洞窟 層1 遠景：上下から迫る岩壁のシルエット（farFill 塗り・farEdge 線幅2） */
  _drawCaveFar(ctx) {
    ctx.fillStyle = this.palette.farFill;
    ctx.strokeStyle = this.palette.farEdge;
    ctx.lineWidth = 2;
    // 上から垂れる岩（下向き三角形。画面上端 y=0 から）
    for (const r of this.caveFarTop) {
      ctx.beginPath();
      ctx.moveTo(r.x - r.half, 0);
      ctx.lineTo(r.x + r.half, 0);
      ctx.lineTo(r.x, r.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 下から立ち上がる岩（上向き三角形。画面下端 y=LOGICAL_HEIGHT から）
    for (const r of this.caveFarBottom) {
      ctx.beginPath();
      ctx.moveTo(r.x - r.half, LOGICAL_HEIGHT);
      ctx.lineTo(r.x + r.half, LOGICAL_HEIGHT);
      ctx.lineTo(r.x, LOGICAL_HEIGHT - r.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  /** 洞窟 層2 中景：天井の帯と、そこから垂れる氷柱（midFill 塗り + 氷のハイライト） */
  _drawCaveMid(ctx) {
    // 氷柱がぶら下がる天井の帯。画面外（BG_CAVE_CEILING_Y=-80）から高さ160px で、
    // 縦パララックスで中景が最大46px上へずれても下端(y=80)は画面内に残り、上端が必ず覆われる。
    const ceilBottom = BG_CAVE_CEILING_Y + BG_CAVE_CEILING_HEIGHT; // = 80（氷柱の付け根）
    ctx.fillStyle = this.palette.midFill;
    ctx.fillRect(0, BG_CAVE_CEILING_Y, BG_PATTERN_WIDTH + 1, BG_CAVE_CEILING_HEIGHT); // 継ぎ目対策に1px重ねる

    for (const s of this.stalactites) {
      // 下向きの細い三角形（付け根は帯の下端 ceilBottom。幅・高さ・ハイライトの式は Phase 12 から不変）
      ctx.fillStyle = this.palette.midFill;
      ctx.beginPath();
      ctx.moveTo(s.x - s.half, ceilBottom);
      ctx.lineTo(s.x + s.half, ceilBottom);
      ctx.lineTo(s.x, ceilBottom + s.height);
      ctx.closePath();
      ctx.fill();
      // 氷のハイライト：底辺の左から1/3の位置（x - half/3）から先端へ1本
      ctx.strokeStyle = BG_CAVE_ICE_SHINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - s.half / 3, ceilBottom);
      ctx.lineTo(s.x, ceilBottom + s.height);
      ctx.stroke();
    }
  }

  /** 洞窟 層3 近景：手前の岩床と、そこから立ち上がる石筍（nearFill 塗り） */
  _drawCaveNear(ctx) {
    const floorTop = LOGICAL_HEIGHT - BG_CAVE_FLOOR_HEIGHT;
    ctx.fillStyle = this.palette.nearFill;
    // 岩床の帯（下端から高さ BG_CAVE_FLOOR_HEIGHT。縦スクロールで下が抜けないよう FILL_BOTTOM まで塗る）
    ctx.fillRect(0, floorTop, BG_PATTERN_WIDTH + 1, FILL_BOTTOM - floorTop);
    // 石筍（上向きの三角形。岩床の上端から）
    for (const s of this.stalagmites) {
      ctx.beginPath();
      ctx.moveTo(s.x - s.half, floorTop);
      ctx.lineTo(s.x + s.half, floorTop);
      ctx.lineTo(s.x, floorTop - s.height);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ================= 山頂テーマの各層 =================

  /** 山頂 層1 遠景：雲海の向こうに覗く峰（alpine の雪山と同じ作り。基準線と振れ幅だけ違う） */
  _drawSummitFar(ctx) {
    const W = BG_PATTERN_WIDTH;
    ctx.beginPath();
    ctx.moveTo(0, FILL_BOTTOM);
    for (let k = 0; k < this.summitPeaks.length; k++) {
      ctx.lineTo(k * 60, this.summitPeaks[k]);
    }
    ctx.lineTo(W + 1, FILL_BOTTOM); // 継ぎ目対策に1px重ねる
    ctx.closePath();
    ctx.fillStyle = this.palette.farFill;
    ctx.fill();
    // 稜線（2px線）
    ctx.beginPath();
    ctx.moveTo(0, this.summitPeaks[0]);
    for (let k = 1; k < this.summitPeaks.length; k++) {
      ctx.lineTo(k * 60, this.summitPeaks[k]);
    }
    ctx.strokeStyle = this.palette.farEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** 山頂 層2 中景：雲海（水面の塗り + ふくらみの半円 + ちぎれ雲） */
  _drawSummitMid(ctx) {
    // 雲海の「水面」から下を塗りつぶす
    ctx.fillStyle = this.palette.midFill;
    ctx.fillRect(
      0,
      BG_SUMMIT_CLOUD_BASE,
      BG_PATTERN_WIDTH + 1, // 継ぎ目対策に1px重ねる
      FILL_BOTTOM - BG_SUMMIT_CLOUD_BASE
    );
    // 水面の上端のふくらみ（上半分の半円）
    for (const c of this.summitClouds) {
      ctx.beginPath();
      ctx.arc(c.x, BG_SUMMIT_CLOUD_BASE, c.r, Math.PI, Math.PI * 2); // π→2π = 上側の弧
      ctx.closePath();
      ctx.fill();
    }
    // 水面より上に浮かぶちぎれ雲（不透明度0.7の横長楕円）
    ctx.globalAlpha = 0.7;
    for (const w of this.summitWisps) {
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 山頂 層3 近景：逆光で黒く沈んだ、細く尖った岩峰のシルエット */
  _drawSummitNear(ctx) {
    ctx.fillStyle = this.palette.nearFill;
    ctx.fillRect(
      0,
      BG_SUMMIT_SPIRE_BASE,
      BG_PATTERN_WIDTH + 1, // 継ぎ目対策に1px重ねる
      FILL_BOTTOM - BG_SUMMIT_SPIRE_BASE
    );
    for (const s of this.summitSpires) {
      ctx.beginPath();
      ctx.moveTo(s.x - s.half, BG_SUMMIT_SPIRE_BASE);
      ctx.lineTo(s.x + s.half, BG_SUMMIT_SPIRE_BASE);
      ctx.lineTo(s.x, BG_SUMMIT_SPIRE_BASE - s.height);
      ctx.closePath();
      ctx.fill();
    }
  }
}
