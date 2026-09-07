# 実装依頼 Phase 1 — プロジェクト土台とゲームループ

あなたはこのプロジェクトの実装担当です。以下の指示に**厳密に**従って実装してください。

## 前提

- 作業ディレクトリ: `D:\desktop\python\side-scroller-game`
- 同ディレクトリの `SPEC.md`（仕様書）と `TASKS.md`（分解表）を**必ず最初に読んでください**。
- 技術: **Vanilla JavaScript (ES Modules) + Canvas 2D API のみ**
- **外部ライブラリ・CDN・npm パッケージ・ビルドツールは一切使用禁止**
- **TypeScript 禁止**（拡張子は `.js`）
- コード中のコメントは**すべて日本語**で書くこと

## このフェーズのゴール

ゲーム本体はまだ作りません。**後続の全機能が乗る土台**だけを作ります。

---

## 作成するファイル（この4つだけ。それ以外のファイルを作らないこと）

### 1. `index.html`

- `<!DOCTYPE html>`、`lang="ja"`、`<meta charset="utf-8">`
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">`
- `<title>ALPINE GOAT</title>`
- body 直下に `<div id="game-wrapper"><canvas id="game-canvas"></canvas></div>`
- `<script type="module" src="./src/main.js"></script>`
- HTML内にJavaScriptを直接書かないこと

### 2. `style.css`

以下を**そのまま**満たすこと（値を変えないこと）:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
body { display: flex; align-items: center; justify-content: center;
       touch-action: none; user-select: none; -webkit-user-select: none; }
#game-canvas {
  display: block;
  width:  min(100vw, calc(100vh * 16 / 9));
  height: min(100vh, calc(100vw * 9 / 16));
}
```

（`#game-wrapper` に必要な指定があれば追加してよい）

### 3. `src/config.js`

**すべて `export const` で公開する。** 現時点で使わない値も含めて、以下を**過不足なく全部**定義すること（後続フェーズで使用する）。

```
// 画面
LOGICAL_WIDTH  = 960
LOGICAL_HEIGHT = 540
TILE_SIZE      = 32
FIXED_DT       = 1 / 60          // 固定タイムステップ（秒）
MAX_FRAME_TIME = 0.25            // 1フレームで消化する最大時間（秒）

// ヤギの物理（単位は px / 秒）
GRAVITY             = 2200
MAX_FALL_SPEED      = 1200
MOVE_SPEED          = 260
ACCEL_GROUND        = 2000
ACCEL_AIR           = 1200
FRICTION_GROUND     = 2400
JUMP_VELOCITY       = -760
JUMP_CUT_MULTIPLIER = 0.45
COYOTE_TIME         = 0.09
JUMP_BUFFER_TIME    = 0.12

// 頭突き（ダッシュ突進）
DASH_SPEED          = 620
DASH_DURATION       = 0.26
DASH_COOLDOWN       = 0.60
DASH_GRAVITY_SCALE  = 0.35

// 踏みつけ・被弾
STOMP_BOUNCE        = -520
STOMP_TOLERANCE     = 16         // 踏みつけ成立とみなす上端からの許容距離(px)
INVINCIBLE_TIME     = 1.2
DEATH_ANIM_TIME     = 0.6

// ヤギの当たり判定
GOAT_HITBOX_WIDTH   = 40
GOAT_HITBOX_HEIGHT  = 48

// デバッグ
DEBUG = true                     // true のときFPS等のデバッグ情報を描画
```

各値には**何を意味するのかを1行の日本語コメント**で添えること。

### 4. `src/main.js`

以下の責務を持つ。**この4つの関数を必ずこの名前で定義すること。**

| 関数 | 責務 |
|---|---|
| `setupCanvas()` | canvas の内部解像度を `LOGICAL_WIDTH * dpr` × `LOGICAL_HEIGHT * dpr` に設定し、`ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` で論理座標系に変換する |
| `update(dt)` | ゲームロジックの更新。`dt` は常に `FIXED_DT`（秒）が渡される |
| `render()` | 描画。1フレームにつき1回だけ呼ばれる |
| `loop(timestamp)` | `requestAnimationFrame` のコールバック |

#### ゲームループの仕様（厳密に守ること）

1. **固定タイムステップのアキュムレータ方式**を使う。
2. 前フレームからの経過時間を秒に変換し、`MAX_FRAME_TIME` を上限にクランプする（**スパイラル・オブ・デスの防止。必須**）。
3. クランプした時間をアキュムレータに加算し、`accumulator >= FIXED_DT` である間 `update(FIXED_DT)` を繰り返し呼び、そのたびアキュムレータから `FIXED_DT` を引く。
4. その後 `render()` を1回呼ぶ。
5. 描画の補間は行わない。

#### DPR（高解像度ディスプレイ）対応

- `window.devicePixelRatio` を使用する。ただし上限を 2 にクランプすること（スマホでの過剰な負荷を避けるため）。
- `window.addEventListener('resize', ...)` で `setupCanvas()` を再実行すること。

#### 描画内容（このフェーズの暫定表示）

1. 背景を空色 `#7fb3d5` で塗りつぶす。
2. 画面下部（y = 460 から下）を岩色 `#5a5148` で塗りつぶす（地面のプレースホルダ）。
3. **ヤギの仮プレースホルダ**として、`GOAT_HITBOX_WIDTH` × `GOAT_HITBOX_HEIGHT` の茶色 `#8b5e3c` の矩形を1つ描く。
   - 初期位置は x = 100、足元が y = 460 に接する位置。
   - 水平速度 200 px/s で右へ移動し、画面右端（x + 幅 >= 960）に達したら左へ反転、左端（x <= 0）で右へ反転する。
   - **この移動は必ず `update(dt)` の中で `dt` を掛けて計算すること**（フレーム数に依存させない）。
4. `DEBUG` が `true` のとき、**左上に以下を白文字 14px で描画**する:
   - `FPS: <直近60フレームの平均fpsを小数第1位まで>`
   - `DPR: <使用中のdevicePixelRatio>`
   - `x: <プレースホルダのx座標を整数で>`

---

## 禁止事項

- 外部ライブラリ・CDN・npm の使用
- `setInterval` によるゲームループ（`requestAnimationFrame` を使うこと）
- `update` の外で位置を変更すること
- SPEC.md に書かれていない機能を先回りして実装すること（**Phase 1 の範囲を厳守**）
- ファイルを4つ以外に増やすこと

---

## 完了条件（すべて満たすこと）

1. `python -m http.server 8000` を起動し `http://localhost:8000` を開くと、エラーなくゲーム画面が表示される。
2. ブラウザのコンソールにエラーおよび警告が**1件も出ていない**。
3. 茶色い矩形が画面内を左右に往復し、端で正しく反転する。
4. 左上に FPS / DPR / x が表示され、FPS が約60を示している。
5. ブラウザウィンドウを**横長・縦長のどちらに変形させても**、canvas が 16:9 のアスペクト比を保ち、はみ出さず中央に表示される。
6. ブラウザの拡大率を変えても表示が崩れない。

---

## 実装後の報告フォーマット

以下の形式で日本語で報告してください:

```
## 完了報告 Phase 1
### 作成ファイル
- （ファイルパスと行数）
### 実装内容
- （箇条書きで3〜6行）
### 動作確認結果
- 完了条件1〜6のそれぞれについて、確認できたか / できなかったか
### 判断が必要だった点・仕様の曖昧さ
- （なければ「なし」）
```
