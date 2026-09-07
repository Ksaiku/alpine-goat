// ALPINE GOAT — 全パラメータ定数
// マジックナンバーをコード中に直接書かず、必ずこのファイルから参照すること。
// ここに並ぶ物理値は仮の値であり、実装後に手触りを見て調整する前提。

// ===== 画面 =====
export const LOGICAL_WIDTH  = 960;      // 論理解像度の幅（px）。すべての座標計算はこの空間で行う
export const LOGICAL_HEIGHT = 540;      // 論理解像度の高さ（px）
export const TILE_SIZE      = 32;       // 1タイルの一辺（px）。地形はタイル単位で設計する
export const FIXED_DT       = 1 / 60;   // 固定タイムステップ（秒）。update には常にこの値が渡る
export const MAX_FRAME_TIME = 0.25;     // 1フレームで消化する最大時間（秒）。スパイラル・オブ・デス防止

// ===== ヤギの物理（単位は px / 秒）=====
export const GRAVITY             = 2200;   // 重力加速度（px/s^2）
export const MAX_FALL_SPEED      = 1200;   // 落下速度の上限（px/s）
export const MOVE_SPEED          = 260;    // 最高水平速度（px/s）
export const ACCEL_GROUND        = 2000;   // 地上での水平加速度（px/s^2）
export const ACCEL_AIR          = 1200;   // 空中での水平加速度（px/s^2）
export const FRICTION_GROUND     = 2400;   // 地上での減速（摩擦）加速度（px/s^2）
export const OVERSPEED_DECEL     = 1800;   // 最高速を超えている間の減速度(px/s^2)。突進の勢いを尾を引かせて逃がす
export const JUMP_VELOCITY       = -800;   // ジャンプ初速。最高到達点 138.8px（4.34タイル）
export const JUMP_CUT_MULTIPLIER = 0.45;   // ジャンプキーを離した瞬間、上昇速度に乗算する係数
export const COYOTE_TIME         = 0.09;   // 地面を離れてもジャンプを受け付ける猶予（秒）
export const JUMP_BUFFER_TIME    = 0.12;   // 着地前のジャンプ入力を先行受付する時間（秒）

// ===== 頭突き（ダッシュ突進）=====
export const DASH_SPEED          = 620;    // 突進中の水平速度（px/s）
export const DASH_DURATION       = 0.26;   // 突進の継続時間（秒）
export const DASH_COOLDOWN       = 0.60;   // 突進終了後、再発動できない時間（秒）
export const DASH_AIR_COOLDOWN   = 0;      // 空中で突進が終わったときのクールダウン(秒)。0 = すぐ撃ち直せる
export const DASH_GRAVITY_SCALE  = 0.35;   // 突進中に掛ける重力の倍率

// ===== 踏みつけ・被弾 =====
export const STOMP_BOUNCE        = -520;   // 踏みつけ成功時に与える跳ね返り速度（px/s、上向きが負）
export const STOMP_TOLERANCE     = 16;     // 踏みつけ成立とみなす、敵上端からの許容距離（px）
export const INVINCIBLE_TIME     = 1.2;    // リスポーン後の無敵時間（秒）
export const DEATH_ANIM_TIME     = 0.6;    // 死亡演出の長さ（秒）

// ===== ヤギの当たり判定 =====
export const GOAT_HITBOX_WIDTH   = 40;     // ヤギの当たり判定矩形の幅（px）
export const GOAT_HITBOX_HEIGHT  = 48;     // ヤギの当たり判定矩形の高さ（px）

// ===== デバッグ =====
export const DEBUG = false;                // 開発用のデバッグ表示。公開時は false（true に戻すと再び出る）

// ===== タッチUI（仮想パッド）のレイアウト =====
// 座標はすべて論理座標（960×540）。canvas上に直接描画するため、画面拡大に自動追従する。
export const TOUCH_BTN_LEFT    = { x:  90, y: 452, r: 44 };  // 左移動ボタン
export const TOUCH_BTN_RIGHT   = { x: 196, y: 452, r: 44 };  // 右移動ボタン
export const TOUCH_BTN_JUMP    = { x: 872, y: 452, r: 48 };  // Aボタン（ジャンプ）
export const TOUCH_BTN_DASH    = { x: 762, y: 412, r: 40 };  // Bボタン（頭突き）
export const TOUCH_BTN_PAUSE   = { x: 924, y:  36, r: 24 };  // ポーズボタン
export const TOUCH_HIT_PADDING = 12;                         // 当たり判定を見た目の半径より広げる量(px)。押しやすさのため
export const TOUCH_UI_ALPHA    = 0.35;                       // 仮想パッドの不透明度

// ===== カメラ =====
export const CAMERA_DEADZONE_X = 80;   // 画面中心からこの距離内にヤギがいる間はカメラを動かさない(px)
export const CAMERA_DEADZONE_Y = 60;   // 同上（縦方向）
export const CAMERA_SMOOTHING  = 8;    // 追従の速さ（1秒あたり）。大きいほど機敏
export const CAMERA_LOOKAHEAD  = 48;   // 進行方向へカメラを先行させる距離(px)。前方が見やすくなる

// ===== 背景（アルプス山岳のパレット）=====
// Phase 11 でステージごとに差し替えられるよう、まとめて定義しておく
export const BG_PATTERN_WIDTH = 960;        // 各層の繰り返し1単位の幅(px)
export const BG_SKY_TOP       = '#4a7fb5';  // 空グラデーションの上端
export const BG_SKY_BOTTOM    = '#a8cfe8';  // 空グラデーションの下端
export const BG_FAR_FILL      = '#dfe9f2';  // 遠景：雪山の塗り
export const BG_FAR_EDGE      = '#b9cddd';  // 遠景：雪山の稜線
export const BG_MID_FILL      = '#3f5f52';  // 中景：針葉樹林
export const BG_NEAR_FILL     = '#3a3a44';  // 近景：岩肌
export const BG_FAR_FACTOR    = 0.15;       // 遠景のスクロール係数
export const BG_MID_FACTOR    = 0.40;       // 中景のスクロール係数
export const BG_NEAR_FACTOR   = 0.75;       // 近景のスクロール係数

// 背景各層の基準線（画面座標y）。地面が画面の70%に来る構図に合わせた値
export const BG_FAR_BASE   = 220;   // 遠景：雪山の稜線の基準の高さ
export const BG_FAR_AMP    = 70;    // 遠景：稜線の振れ幅(±)
export const BG_MID_BASE   = 345;   // 中景：木の底辺の高さ
export const BG_NEAR_BASE  = 435;   // 近景：岩肌の稜線の基準の高さ
export const BG_NEAR_AMP   = 40;    // 近景：稜線の振れ幅(±)

// ===== 洞窟テーマの背景（stage の theme: 'cave' で使う）=====
export const BG_CAVE_STALACTITE_SPACING = 48;                    // 氷柱の間隔(px)
export const BG_CAVE_STALAGMITE_SPACING = 56;                    // 石筍の間隔(px)
export const BG_CAVE_FLOOR_HEIGHT       = 70;                    // 近景の岩床の高さ(px)
export const BG_CAVE_ICE_SHINE          = 'rgba(255,255,255,0.35)'; // 氷柱のハイライト
export const BG_CAVE_CEILING_Y          = -80;                  // 天井の帯の上端(px)。画面外から始めて縦スクロールでも隙間が出ないように
export const BG_CAVE_CEILING_HEIGHT     = 160;                  // 天井の帯の高さ(px)。下端は y=80（＝氷柱の付け根）
export const BG_CAVE_VIGNETTE_COLOR     = 'rgba(3, 8, 14, 0.62)'; // 洞窟の周辺減光の色（外周側）
export const BG_CAVE_VIGNETTE_INNER     = 0.30;                 // 減光が始まる半径の割合（0=中心 1=外周）

// ===== 山頂テーマの背景（stage の theme: 'summit' で使う）=====
export const BG_SUMMIT_PEAK_BASE     = 190;  // 遠景：遠い峰の稜線の基準の高さ(px)
export const BG_SUMMIT_PEAK_AMP      = 80;   // 遠景：稜線の振れ幅(±)
export const BG_SUMMIT_CLOUD_BASE    = 330;  // 中景：雲海の水面の高さ(px)
export const BG_SUMMIT_CLOUD_SPACING = 70;   // 中景：雲のふくらみの間隔(px)
export const BG_SUMMIT_SPIRE_SPACING = 96;   // 近景：岩峰の間隔(px)
export const BG_SUMMIT_SPIRE_BASE    = 470;  // 近景：岩峰の根元の高さ(px)

// ===== 地形タイルの既定色（ステージ側の tilePalette で上書きできる）=====
export const TILE_ROCK           = '#5a5148';  // 岩の塗り
export const TILE_ROCK_TOP       = '#7d7266';  // 岩の上端3px
export const TILE_BREAKABLE      = '#7a6a55';  // 破壊可能岩の塗り
export const TILE_BREAKABLE_TOP  = '#9a8a72';  // 破壊可能岩の上端3px
export const TILE_CRACK          = '#4a4038';  // 破壊可能岩のひび
export const TILE_ONEWAY         = '#8a6b45';  // すり抜け床
export const TILE_SPIKE          = '#c9ccd1';  // 棘

// ===== Phase 9 までの仮設定 =====
export const TEMP_FALL_LIMIT = 200;    // ステージ下端からこの距離まで落ちたらスポーン地点へ戻す(px)

// ===== ヤギの描画（プロシージャル）=====
export const GOAT_COLOR_BACK    = '#e4ddd2';           // 背中側の毛（明るい）
export const GOAT_COLOR_BELLY   = '#a89c8a';           // 腹側の毛（暗い）
export const GOAT_COLOR_LEG     = '#c3b8a7';           // 手前の脚
export const GOAT_COLOR_LEG_FAR = '#9a8f7f';           // 奥の脚（奥行きを出すため暗く）
export const GOAT_COLOR_HOOF    = '#3a3229';           // 蹄
export const GOAT_COLOR_HORN    = '#7a6a55';           // 角
export const GOAT_COLOR_EYE     = '#1a1512';           // 目
export const GOAT_COLOR_NOSE    = '#6b5148';           // 鼻・口
export const GOAT_COLOR_FUR     = 'rgba(0,0,0,0.12)';  // 毛のストローク

// 歩容（1サイクルの距離は歩幅から逆算するため固定値は持たない）
export const GOAT_STRIDE_MIN   = 8;      // 歩幅の下限(px)
export const GOAT_STRIDE_MAX   = 16;     // 歩幅の上限(px)
export const GOAT_STRIDE_SCALE = 0.031;  // 速度(px/s)から歩幅への係数
export const GOAT_LIFT_MIN     = 2;      // 足を持ち上げる高さの下限(px)
export const GOAT_LIFT_MAX     = 9;      // 足を持ち上げる高さの上限(px)
export const GOAT_LIFT_SCALE   = 0.030;  // 速度から持ち上げ高さへの係数
export const GOAT_STANCE_RATIO = 0.6;    // 1サイクルのうち足が地面についている割合

// ===== 敵 =====
export const ENEMY_MARMOT_SPEED    = 60;    // マーモットの移動速度(px/s)
export const ENEMY_EAGLE_SPEED     = 90;    // ワシの水平移動速度(px/s)
export const ENEMY_EAGLE_AMPLITUDE = 48;    // ワシの上下の振れ幅(px)
export const ENEMY_EAGLE_PERIOD    = 2.0;   // ワシの上下運動の周期(秒)
export const ENEMY_EAGLE_RANGE     = 160;   // ワシが出現位置から左右に動ける距離(px)
export const ENEMY_PORCUPINE_SPEED = 45;    // ヤマアラシの移動速度(px/s)

// 長いステージ向け：画面の外側この距離までに入っている敵だけを動かす(px)。10タイル分。
// これより遠い敵は静止させ、プレイヤー到着時の位置を毎回そろえる（1発死ゲームの再現性のため）。
export const ENEMY_ACTIVE_MARGIN   = 320;

// 敵の当たり判定の大きさ
export const ENEMY_MARMOT_W    = 28;
export const ENEMY_MARMOT_H    = 22;
export const ENEMY_EAGLE_W     = 34;
export const ENEMY_EAGLE_H     = 20;
export const ENEMY_PORCUPINE_W = 32;
export const ENEMY_PORCUPINE_H = 24;

// 敵の色
export const ENEMY_MARMOT_BODY    = '#8a6b45';
export const ENEMY_MARMOT_BELLY   = '#b99b74';
export const ENEMY_EAGLE_BODY     = '#4a3b2c';
export const ENEMY_EAGLE_HEAD     = '#e8e4dc';
export const ENEMY_EAGLE_BEAK     = '#d8a13a';
export const ENEMY_PORCUPINE_BODY = '#4f4136';
export const ENEMY_PORCUPINE_QUIL = '#c9ccd1';

// ===== チェックポイント =====
export const CHECKPOINT_POLE_COLOR    = '#cfc8bd'; // 旗ざおの色
export const CHECKPOINT_FLAG_OFF      = '#7a7a7a'; // 未到達の旗の色
export const CHECKPOINT_FLAG_ON       = '#d94f3d'; // 到達済みの旗の色
export const CHECKPOINT_POLE_HEIGHT   = 60;        // 旗ざおの高さ(px)

// ===== 死亡演出 =====
export const DEATH_JUMP_VELOCITY = -420;  // 死んだ瞬間に上へ跳ねる初速(px/s)
export const DEATH_SPIN_SPEED    = 8;     // 死亡中の回転速度(ラジアン/秒)
export const BLINK_RATE          = 12;    // 無敵中の点滅の速さ(1秒あたりの切り替え回数)

// ===== ゴール =====
export const GOAL_POLE_COLOR   = '#e8e2d6';  // ゴールの旗ざお
export const GOAL_FLAG_COLOR   = '#f2c14e';  // ゴールの旗（金色）
export const GOAL_POLE_HEIGHT  = 96;         // ゴールの旗ざおの高さ(px)。チェックポイントより高くする

// ===== UI =====
export const UI_TEXT      = '#f4f1ea';               // 文字色
export const UI_TEXT_DIM  = '#9aa0a6';               // 補助的な文字色
export const UI_ACCENT    = '#f2c14e';               // 選択中・強調の色
export const UI_PANEL     = 'rgba(12, 18, 26, 0.82)'; // 画面を覆うパネルの色
export const UI_FONT      = 'sans-serif';
