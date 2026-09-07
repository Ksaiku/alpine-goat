// ALPINE GOAT — ヤギのプロシージャル描画（関節駆動）
// 画像は一切使わず、Canvas のパス描画だけで描く。
// スプライトのコマ切り替えではなく、関節（＝足先の目標位置）を計算し、
// そこから各部位のパスを生成して描くことで、速度に応じた歩幅や着地の沈み込みが
// 連続的に出る。
// Phase 6.5: 歩容の値（phase / stride / lift）は goat.js 側で計算した値を読むだけ。
// Phase 7: 体型を Phase 6 の「ずんぐり」へ巻き戻し（脚の骨だけ 18）。突進 dash の姿勢を追加。
// Phase 9: 脚を太く。無敵中の点滅と、死亡中の回転（姿勢は fall と同じ）。

import {
  DEBUG,
  GOAT_COLOR_BACK,
  GOAT_COLOR_BELLY,
  GOAT_COLOR_LEG,
  GOAT_COLOR_HOOF,
  GOAT_COLOR_HORN,
  GOAT_COLOR_EYE,
  GOAT_COLOR_NOSE,
  GOAT_STANCE_RATIO,
  BLINK_RATE,
} from './config.js';

// --- 骨の長さ ---
// 脚の見た目の長さは「付け根の高さ(30)」で決まる。骨を長くしても脚は長く見えず膝が曲がるだけ。
// ただし 15+15 だと歩幅16のとき足先(必要距離34)に届かず骨が伸びて破綻するため 18+18 にする。
const L_UPPER = 18; // 上腿
const L_LOWER = 18; // 下腿
const L_HOOF = 5;   // 蹄

// --- 骨格の基準位置（ローカル座標：足元中央が原点、上が負y、右向き）---
const BODY = { x: 0, y: -32 };      // 胴体の中心
const SHOULDER = { x: 15, y: -30 }; // 前脚の付け根（肩）
const HIP = { x: -17, y: -30 };     // 後脚の付け根（腰）
const NECK = { x: 19, y: -38 };     // 首の付け根
const HEAD = { x: 30, y: -49 };     // 頭の中心
const TAIL = { x: -24, y: -37 };    // 尾の付け根

/**
 * 点 (px,py) を中心 (cx,cy) まわりに ang ラジアン回転した座標を返す。
 */
function rotAround(px, py, cx, cy, ang) {
  const s = Math.sin(ang);
  const c = Math.cos(ang);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

/**
 * 2本の骨（長さ L1, L2）で付け根 (hx,hy) から足先 (fx,fy) へ届かせるときの膝の位置。
 * bend: 膝の曲がる向き（前脚 -1 / 後脚 +1）。
 */
function solveKnee(hx, hy, fx, fy, L1, L2, bend) {
  const dx = fx - hx;
  const dy = fy - hy;
  let d = Math.hypot(dx, dy);
  // 下限は「脚を伸ばしきった長さの半分」。近すぎるときに極端に折り畳まれて
  // 膝が大きく飛び出すのを防ぐ。上限は伸びきりロック防止。
  d = Math.min(Math.max(d, (L1 + L2) * 0.5), L1 + L2 - 0.01);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const mx = hx + ux * a;
  const my = hy + uy * a;
  return { x: mx - uy * h * bend, y: my + ux * h * bend };
}

/**
 * ヤギを描く。座標はすべて「足元中央が原点、上が負y、右向き」のローカル座標。
 * @param {CanvasRenderingContext2D} ctx  main.js でカメラ変換をかけた後の ctx
 * @param {import('./goat.js').Goat} goat
 */
export function renderGoat(ctx, goat) {
  // --- 無敵中の点滅：「消える側」なら何も描かず return する（ctx.save() より前に）---
  if (
    goat.invincibleTimer > 0 &&
    Math.floor(goat.invincibleTimer * BLINK_RATE) % 2 === 1
  ) {
    return;
  }

  // --- デバッグ：当たり判定の枠（ワールド座標のまま、塗らずに枠線）---
  if (DEBUG) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,0,0,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(goat.x, goat.y, goat.width, goat.height);
    ctx.restore();
  }

  ctx.save();
  // 原点をヤギの足元中央へ。左向きは水平反転（以降は常に右向きとして描けばよい）。
  ctx.translate(goat.x + goat.width / 2, goat.y + goat.height);
  if (goat.facing === -1) ctx.scale(-1, 1);
  // 死亡中は胴体の中心(0,-32)を軸に回転させる
  if (goat.isDead) {
    ctx.translate(0, -32);
    ctx.rotate(goat.deathRotation);
    ctx.translate(0, 32);
  }

  // ================= 姿勢パラメータ =================
  // 死亡中は姿勢を fall と同じものにする
  const state = goat.state === 'dead' ? 'fall' : goat.state; // 'idle'/'walk'/'run'/'jump'/'fall'/'dash'
  const phase = goat.phase;   // 歩行サイクルの位相（goat.js が積み上げた値）
  const stride = goat.stride; // 歩幅（goat.js が速度から算出）
  const lift = goat.lift;     // 足の持ち上げ高さ（同上）

  let tilt = 0; // 胴体の傾き（ラジアン、頭が上へ＝負）
  let bob = 0;  // 胴体の上下動
  if (state === 'walk' || state === 'run') {
    tilt = -0.05;
    bob = Math.sin(phase * Math.PI * 4) * (lift * 0.35);
  } else if (state === 'jump') {
    tilt = -0.2;
  } else if (state === 'fall') {
    tilt = 0.12;
  } else if (state === 'dash') {
    tilt = 0.16; // 頭側が下がる（角を前へ突き出す姿勢）
  } else {
    // idle：呼吸で胴体がゆっくり上下（振幅を大きめにして目で分かるように）
    bob = Math.sin(goat.animTime * 2) * 2.0;
  }

  // 突進中は首・頭を前へ突き出し、下げる
  let neckPos = { x: NECK.x, y: NECK.y };
  let headPos = { x: HEAD.x, y: HEAD.y };
  if (state === 'dash') {
    neckPos = { x: NECK.x + 2, y: NECK.y + 4 };
    headPos = { x: HEAD.x + 6, y: HEAD.y + 10 };
  }

  // 着地の沈み込み（胴体まわりと脚の付け根を下げる。足先は下げない）
  let squash = 0;
  if (goat.timeSinceLanded < 0.18) {
    squash = (1 - goat.timeSinceLanded / 0.18) * 6;
  }
  const bodyDrop = bob + squash; // 胴体・首・頭・脚の付け根に共通で足す縦オフセット

  // ================= 足先の目標位置 =================
  // baseX: 脚の付け根の基準 x（SHOULDER.x か HIP.x）
  function footFor(baseX, isFront, legPhase) {
    if (state === 'idle') return { x: baseX, y: 0 };
    if (state === 'fall') return { x: baseX, y: 4 };
    if (state === 'jump') {
      return isFront
        ? { x: baseX + 18, y: -8 }   // 前脚は前方へ強く伸ばす
        : { x: baseX - 12, y: -18 }; // 後脚は後ろへ・高く畳む
    }
    if (state === 'dash') {
      return isFront
        ? { x: baseX - 6, y: -12 }   // 前脚は後ろへ畳む
        : { x: baseX - 15, y: -5 };  // 後脚は後ろへ蹴り出す
    }
    // walk / run：位相ベースの歩行サイクル（足先の式そのものは変えない）
    const p = legPhase;
    if (p < GOAT_STANCE_RATIO) {
      // 接地期：地面につけたまま後ろへ送る
      const t = p / GOAT_STANCE_RATIO;
      return { x: baseX + stride - stride * 2 * t, y: 0 };
    }
    // 遊脚期：持ち上げて前へ振り出す
    const t = (p - GOAT_STANCE_RATIO) / (1 - GOAT_STANCE_RATIO);
    return { x: baseX - stride + stride * 2 * t, y: -lift * Math.sin(Math.PI * t) };
  }

  // ================= 脚を1本描く =================
  // baseRoot: 付け根の基準位置 / isFront: 前脚か / legPhase: この脚の位相
  // legColor: 上腿・下腿の色 / depthDX: 奥行き表現の横ずらし / widthDelta: 線幅の増減（奥は -1）
  function drawLeg(baseRoot, isFront, legPhase, legColor, depthDX, widthDelta) {
    // 付け根：基準位置を胴体の傾きで回し、bodyDrop を足す（体が傾いても脚が取り残されないように）
    const r = rotAround(baseRoot.x, baseRoot.y, BODY.x, BODY.y, tilt);
    const rootX = r.x + depthDX;
    const rootY = r.y + bodyDrop;
    // 足先の目標
    const f = footFor(baseRoot.x, isFront, legPhase);
    const footX = f.x + depthDX;
    const footY = f.y;
    // 膝
    const bend = isFront ? -1 : 1;
    const knee = solveKnee(rootX, rootY, footX, footY, L_UPPER, L_LOWER, bend);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 上腿（手前7px / 奥6px）
    ctx.strokeStyle = legColor;
    ctx.lineWidth = 7 + widthDelta;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.lineTo(knee.x, knee.y);
    ctx.stroke();
    // 下腿（手前6px / 奥5px）
    ctx.lineWidth = 6 + widthDelta;
    ctx.beginPath();
    ctx.moveTo(knee.x, knee.y);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // 蹄（手前4px / 奥3px）：膝→足先の向きへ L_HOOF だけ延長
    let ex = footX - knee.x;
    let ey = footY - knee.y;
    const el = Math.hypot(ex, ey) || 1;
    ex /= el;
    ey /= el;
    ctx.strokeStyle = GOAT_COLOR_HOOF;
    ctx.lineWidth = 4 + widthDelta;
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + ex * L_HOOF, footY + ey * L_HOOF);
    ctx.stroke();
    ctx.restore();
  }

  // ================= 胴体まわりの共通変換（傾き＋縦オフセット）=================
  function withBody(dropY, fn) {
    ctx.save();
    ctx.translate(0, dropY);
    ctx.translate(BODY.x, BODY.y);
    ctx.rotate(tilt);
    ctx.translate(-BODY.x, -BODY.y);
    fn();
    ctx.restore();
  }

  // ================= 各部位 =================
  function drawTail() {
    // 付け根から上後方へ跳ね上がる毛の房。二股を「独立した2枚の小三角」として明示的に描く。
    // 等倍でも分かるよう、各三角を一回り大きく・2枚の間の隙間を広げてある。
    ctx.fillStyle = GOAT_COLOR_BACK;
    // 房1（上向き寄り）
    ctx.beginPath();
    ctx.moveTo(-20, -36);
    ctx.lineTo(-27, -41);
    ctx.lineTo(-33, -52);
    ctx.closePath();
    ctx.fill();
    // 房2（後ろ向き寄り）
    ctx.beginPath();
    ctx.moveTo(-22, -33);
    ctx.lineTo(-25, -40);
    ctx.lineTo(-39, -42);
    ctx.closePath();
    ctx.fill();
  }

  function drawBodyShape() {
    // 幅約48 × 高さ約28 のなめらかな閉曲線（ずんぐり体型）。前（右）をやや高く、後ろ（左）をやや細く。
    const g = ctx.createLinearGradient(0, BODY.y - 15, 0, BODY.y + 14);
    g.addColorStop(0, GOAT_COLOR_BACK);
    g.addColorStop(1, GOAT_COLOR_BELLY);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(22, -45); // 前上（肩口）
    ctx.bezierCurveTo(12, -49, -12, -47, -22, -41); // 背中（上輪郭、前が高い）
    ctx.bezierCurveTo(-26, -37, -26, -23, -21, -20); // 尻（後ろ輪郭、細め）
    ctx.bezierCurveTo(-9, -15, 12, -16, 22, -19); // 腹（下輪郭）
    ctx.bezierCurveTo(28, -23, 27, -39, 22, -45); // 胸（前輪郭）
    ctx.closePath();
    ctx.fill();
  }

  function drawFur() {
    // 胴体の下側の輪郭に沿った短い毛。14本・薄い色で「質感」に留める（落書きに見えないように）。
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      const t = i / 13; // 0..1（後ろ→前）
      const bx = -21 + t * 42; // 胴体下側の x 範囲
      const by = -17 + Math.sin(t * Math.PI) * 2; // ゆるい弧（中央がやや下）
      const len = 4 + ((i * 3) % 5); // 4〜8px
      const ang = 1.9 + ((i * 5) % 6) * 0.06; // ほぼ下向き＋ばらつき
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNeck() {
    // 首の付け根から頭の中心へ向かう台形（付け根側14、頭側10）
    let px = headPos.x - neckPos.x;
    let py = headPos.y - neckPos.y;
    const pl = Math.hypot(px, py) || 1;
    px /= pl;
    py /= pl;
    const perpX = -py;
    const perpY = px;
    ctx.fillStyle = GOAT_COLOR_BACK;
    ctx.beginPath();
    ctx.moveTo(neckPos.x + perpX * 7, neckPos.y + perpY * 7);
    ctx.lineTo(headPos.x + perpX * 5, headPos.y + perpY * 5);
    ctx.lineTo(headPos.x - perpX * 5, headPos.y - perpY * 5);
    ctx.lineTo(neckPos.x - perpX * 7, neckPos.y - perpY * 7);
    ctx.closePath();
    ctx.fill();
  }

  function drawHeadGroup() {
    ctx.save();
    ctx.translate(headPos.x, headPos.y);
    ctx.rotate((15 * Math.PI) / 180); // 鼻先がやや下（水平から傾ける）※現状維持

    // 頭（長さ約24 × 高さ約14、鼻先が細くなる）
    ctx.fillStyle = GOAT_COLOR_BACK;
    ctx.beginPath();
    ctx.moveTo(-9, -6); // 額（後上）
    ctx.bezierCurveTo(4, -8, 13, -5, 16, -1); // 鼻筋
    ctx.bezierCurveTo(17, 2, 14, 5, 11, 5); // 鼻先
    ctx.bezierCurveTo(2, 7, -7, 7, -9, 3); // 顎ライン
    ctx.closePath();
    ctx.fill();

    // 顎髭（頭の下側から下へ垂れる。長さ14・やや暗い色。根元を鼻側へ寄せて頭の下に潜らないように）
    ctx.fillStyle = '#8d8171';
    ctx.beginPath();
    ctx.moveTo(-5, 3);
    ctx.lineTo(2, 4);
    ctx.lineTo(-3, 17);
    ctx.closePath();
    ctx.fill();

    // 耳（頭の後方上から斜め後ろ下へ伸びる細い葉形、長さ11）
    ctx.fillStyle = GOAT_COLOR_BELLY;
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.quadraticCurveTo(-14, -3, -17, 2);
    ctx.quadraticCurveTo(-12, -1, -7, -1);
    ctx.closePath();
    ctx.fill();

    // 角（後ろへ湾曲する曲線を2本。手前と奥で3pxずらし、奥は細く）※形状は現状維持
    ctx.strokeStyle = GOAT_COLOR_HORN;
    ctx.lineCap = 'round';
    // 奥の角（線幅3px）
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.quadraticCurveTo(-17, -17, -24, -9);
    ctx.stroke();
    // 手前の角（線幅4px、3pxぶん手前へ）
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.quadraticCurveTo(-14, -16, -21, -6);
    ctx.stroke();

    // 目（頭の前寄り上部、半径1.6）
    ctx.fillStyle = GOAT_COLOR_EYE;
    ctx.beginPath();
    ctx.arc(4, -1, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // 鼻（鼻先、半径1.4）
    ctx.fillStyle = GOAT_COLOR_NOSE;
    ctx.beginPath();
    ctx.arc(13, 2, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ================= 描画（必ずこの順）=================
  const pA = phase;
  const pB = (phase + 0.5) % 1;

  // 1. 奥の脚（奥の後脚 → 奥の前脚）。横オフセット -7・線幅 -1。
  //    脚を太くした分だけ手前と重なって見えやすいので、奥へ 1px 余分に逃がし、
  //    色も config の GOAT_COLOR_LEG_FAR より一段暗い '#8a8071' を直接指定して手前と差を強める。
  drawLeg(HIP, false, pA, '#8a8071', -7, -1);
  drawLeg(SHOULDER, true, pB, '#8a8071', -7, -1);
  // 2. 尾（傾き＋上下動のみ。沈み込みは付けない）
  withBody(bob, drawTail);
  // 3. 首（胴体より先に描く。胴体が根元を覆い、つなぎ目の「襟」線が隠れる）
  withBody(bodyDrop, drawNeck);
  // 4. 胴体
  withBody(bodyDrop, drawBodyShape);
  // 5. 毛のストローク
  withBody(bodyDrop, drawFur);
  // 6. 手前の脚（手前の後脚 → 手前の前脚）
  drawLeg(HIP, false, pB, GOAT_COLOR_LEG, 0, 0);
  drawLeg(SHOULDER, true, pA, GOAT_COLOR_LEG, 0, 0);
  // 7. 頭 → 顎髭 → 耳 → 角 → 目 → 鼻
  withBody(bodyDrop, drawHeadGroup);

  // 8. 突進中はヤギの後方にスピードライン3本（本体を描いたあと）
  if (state === 'dash') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const lens = [18, 26, 20];
    const ys = [-42, -32, -22];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-34, ys[i]);
      ctx.lineTo(-34 - lens[i], ys[i]);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
