# 実装依頼 Phase 10 — 画面遷移・ゴール・HUD・進捗保存

## 前提

- 作業ディレクトリ: `D:\desktop\python\side-scroller-game`
- `SPEC.md`（特に**第15章「画面遷移」**）と `TASKS.md` を**必ず最初に読んでください**。
- Phase 1〜9 は完了・検証済みです。**Phase 9 は合格です。**
- 技術は同じ: **Vanilla JS (ES Modules) + Canvas 2D のみ。外部ライブラリ・CDN・画像ファイル・TypeScript は禁止。**
- コメントは**すべて日本語**。描画関数は `ctx.save()` / `ctx.restore()` で囲むこと。

## このフェーズのゴール

**「タイトル画面から始めて、ゴールして、クリア画面が出る」まで通します。** これが完成すると、ゲームとして一周遊べる状態になります。

---

## 変更するファイル

| ファイル | 変更内容 |
|---|---|
| `src/config.js` | ゴールとUIの定数を追加 |
| `src/stages/stage1.js` | ゴール旗を追加 |
| `src/world.js` | ゴールの抽出・判定・描画 |
| `src/storage.js` | **新規作成**（進捗の保存と読み込み） |
| `src/hud.js` | **新規作成**（HUDと各画面の描画） |
| `src/goatRenderer.js` | 奥の脚の色を少し暗くする（1行） |
| `src/main.js` | 画面の状態機械 |

**この7ファイル以外は作成・変更しないこと。**

---

# 作業A — ゴール

## A-1. `src/stages/stage1.js` の変更

1. `name` を **`'山麓の斜面'`** に変更する（「Phase 5 検証用」などの但し書きを外す）
2. `tiles` を以下に差し替える。**変更点はゴール旗 `G` を `col 58, row 18` に追加しただけです。**
   **一字一句そのまま使うこと**（各行ちょうど60文字）。

```
............................................................
............................................................
............................................................
............................................................
............................................................
............................................................
............................................................
............................................................
............................................................
............................................................
............................................................
......................####...................#####..........
............................................######..........
...........................................#######..........
........................Y.................########..........
.....................######.**.....E.....#########..........
..====...............######.**..........##########....====..
.......M.............######.**.........###########..........
......####....^^...C.######.**...M..C.############........G.
##########...###############################################
##########...###############################################
##########...###############################################
##########...###############################################
##########...###############################################
```

## A-2. `src/config.js` に追加

```
// ===== ゴール =====
GOAL_POLE_COLOR   = '#e8e2d6'  // ゴールの旗ざお
GOAL_FLAG_COLOR   = '#f2c14e'  // ゴールの旗（金色）
GOAL_POLE_HEIGHT  = 96         // ゴールの旗ざおの高さ(px)。チェックポイントより高くする

// ===== UI =====
UI_TEXT           = '#f4f1ea'  // 文字色
UI_TEXT_DIM       = '#9aa0a6'  // 補助的な文字色
UI_ACCENT         = '#f2c14e'  // 選択中・強調の色
UI_PANEL          = 'rgba(12, 18, 26, 0.82)'  // 画面を覆うパネルの色
UI_FONT           = 'sans-serif'
```

## A-3. `src/world.js` の変更

チェックポイント（`C`）と**まったく同じ方式**で `G` を扱う。

1. グリッド構築時に `G` を見つけたら `this.goal = { col, row, x: col*TILE_SIZE, y: (row-1)*TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE*2 }` を保持し、**そのタイルを `'.'` に書き換える**。`goal` の初期値は `null`。
2. `isTouchingGoal(entity)` メソッドを追加する（AABB の重なりを `boolean` で返す。`goal` が `null` なら `false`）。
3. `renderGoal(ctx)` メソッドを追加する。`renderCheckpoints(ctx)` と同じ描き方だが:
   - 旗ざおの高さは `GOAL_POLE_HEIGHT`、色は `GOAL_POLE_COLOR`
   - 旗は `GOAL_FLAG_COLOR`、サイズは幅30 × 高さ20（チェックポイントより大きい）
   - **常に `Math.sin(this.time * 3) * 3` で揺れる**（ゴールは目立たせる）
4. `render(ctx, camera)` の中で `renderCheckpoints(ctx)` の直後に `renderGoal(ctx)` を呼ぶ。

---

# 作業B — 進捗の保存（`src/storage.js` 新規作成）

## 公開する関数（この2つだけ）

```js
export function loadProgress()          // 進捗を読み込む
export function saveProgress(progress)  // 進捗を保存する
```

## 進捗のデータ形式

```js
{
  cleared:    [false, false, false],  // 各ステージをクリアしたか
  bestTime:   [null,  null,  null],   // 各ステージの最短タイム（秒・小数）
  bestDeaths: [null,  null,  null],   // 各ステージの最少死亡回数
}
```

**ステージ数は3で固定**して構いません（Phase 11 で3ステージを作ります）。

## 必須の要件

- 保存キーは **`'alpine-goat-progress-v1'`**
- **`localStorage` の読み書きは必ず `try` / `catch` で囲むこと。**
  プライベートウィンドウやブラウザの設定によっては、アクセスした瞬間に例外が投げられます。
- `loadProgress()` は、**失敗した場合・保存が無い場合・データが壊れている場合のいずれでも、上記の初期値を返す**こと。**例外を外に投げないこと。**
- 読み込んだデータは、`cleared` などの配列が存在し長さが3であることを**必ず検証**すること。壊れていたら初期値を使う。

> **設計方針:** 進捗の保存が失敗しても、ゲームは普通に遊べなければなりません。保存は「あると嬉しい機能」であって、必須の機能ではありません。

---

# 作業C — 画面と HUD（`src/hud.js` 新規作成）

## 公開する関数

```js
export function drawPlayHud(ctx, info)     // プレイ中の情報表示
export function drawTitle(ctx, info)       // タイトル画面
export function drawStageSelect(ctx, info) // ステージ選択画面
export function drawPause(ctx, info)       // ポーズ画面
export function drawClear(ctx, info)       // クリア画面
export function formatTime(seconds)        // 秒 → "M:SS.mm" の文字列
```

**すべて画面座標で描くこと**（カメラ変換の外）。**すべて `ctx.save()` / `ctx.restore()` で囲むこと。**

## C-1. `formatTime(seconds)`

`83.456` → `"1:23.45"` の形式（分:秒.百分の一秒）。秒は必ず2桁、百分の一秒も必ず2桁にすること。

## C-2. `drawPlayHud(ctx, info)`

`info` は `{ stageName, time, deaths }`。**画面の左上**に次を描く。

```
<ステージ名>          16px, UI_TEXT
TIME  <formatTime>    20px, UI_TEXT
DEATH <死亡回数>       16px, UI_TEXT_DIM
```

- 位置は左から16px、上から14px。行間は22px
- **文字が背景に埋もれないよう、各行に `rgba(0,0,0,0.5)` の影を付ける**（`ctx.shadowColor` と `ctx.shadowBlur = 4` を使う）

## C-3. 共通のパネル

`drawTitle` / `drawStageSelect` / `drawPause` / `drawClear` は、**まず画面全体を `UI_PANEL` で塗りつぶしてから**内容を描く（プレイ画面が透けて見える）。

## C-4. `drawTitle(ctx, info)`

中央揃えで、上から順に:

| 内容 | サイズ | 色 |
|---|---|---|
| `ALPINE GOAT` | 56px 太字 | `UI_ACCENT` |
| `アルプスの山を駆けるヤギ` | 18px | `UI_TEXT_DIM` |
| （余白） | | |
| `SPACE / A ボタンで開始` | 20px | `UI_TEXT`。**`Math.sin(info.time * 3)` で透明度を 0.5〜1.0 に脈動させる** |
| （余白） | | |
| 操作説明（下記） | 14px | `UI_TEXT_DIM` |

操作説明の内容:
```
移動 ← →  /  ジャンプ SPACE  /  頭突き SHIFT
スマホは画面のボタンで操作できます
```

## C-5. `drawStageSelect(ctx, info)`

`info` は `{ stages, progress, selected }`。`stages` は `{name}` の配列、`selected` は選択中の添字。

- 見出し `ステージ選択` 28px を上部中央に
- 各ステージを**縦に並べる**（1行 = 64px）。各行に:
  - `STAGE 1  山麓の斜面` 20px
  - クリア済みなら右側に `✓ 1:23.45 / 死亡 3` を 14px・`UI_TEXT_DIM` で
  - **解放されていないステージは `UI_TEXT_DIM` で描き、名前の代わりに `？？？` と表示**
- **選択中の行は `UI_ACCENT` で描き、左に `▶` を付ける**
- 下部に `← → で選択  /  SPACE で決定` を 14px

**解放の規則:** ステージ1は常に解放。ステージ N は、ステージ N-1 がクリア済みなら解放。

## C-6. `drawPause(ctx, info)`

中央に `PAUSE` 40px。その下に `SPACE で再開  /  ESC でタイトルへ` 16px。

## C-7. `drawClear(ctx, info)`

`info` は `{ stageName, time, deaths, isBestTime, isBestDeaths }`。

| 内容 | サイズ | 色 |
|---|---|---|
| `STAGE CLEAR!` | 48px 太字 | `UI_ACCENT` |
| `<ステージ名>` | 20px | `UI_TEXT` |
| `TIME   <formatTime>` | 24px | `UI_TEXT`。`isBestTime` なら右に `NEW RECORD!` を `UI_ACCENT` で |
| `DEATH  <回数>` | 24px | `UI_TEXT`。`isBestDeaths` なら右に `BEST!` を `UI_ACCENT` で |
| `SPACE でステージ選択へ` | 18px | `UI_TEXT_DIM` |

---

# 作業D — 画面の状態機械（`src/main.js`）

## D-1. 画面の状態

```js
let screen = 'title';   // 'title' | 'select' | 'play' | 'paused' | 'clear'
```

## D-2. ステージの一覧と、状態を持つ変数

```js
const STAGES = [stage1];   // Phase 11 でステージ2・3を追加する
```

**`world` / `goat` / `enemies` / `camera` は `const` ではなく `let` で宣言し直すこと。**
ステージを開始するたびに作り直すためです。

その他に必要な変数:
```js
let currentStage = 0;   // 遊んでいるステージの添字
let selected = 0;       // ステージ選択画面で選んでいる添字
let elapsed = 0;        // 経過時間（秒）
let deaths = 0;         // 死亡回数
let uiTime = 0;         // 画面演出用の時間（毎フレーム加算）
let progress = loadProgress();
let clearInfo = null;   // クリア画面に渡す情報
```

## D-3. `startStage(index)` 関数

**ステージを最初から始めるための関数。次をすべて行うこと。**

```
1. currentStage = index
2. world = new World(STAGES[index])
3. camera = new Camera(LOGICAL_WIDTH, LOGICAL_HEIGHT, world)   ← world が変わるので作り直す
4. 敵を world.enemySpawns から作り直す（Phase 8 と同じ手順）
5. respawnX / respawnY を stage の spawn から計算
6. goat = new Goat(respawnX, respawnY)
7. elapsed = 0, deaths = 0
8. camera.snapTo(goat)
9. screen = 'play'
```

**`camera` を作り直すのを忘れないこと。** `Camera` は `world` を保持しており、古い `world` のままだとカメラのクランプ範囲が前のステージのものになります。

## D-4. `update(dt)` の分岐

```js
uiTime += dt;

switch (screen) {
  case 'title':
    // 決定が押されたら 'select' へ
    if (Input.wasPressed('confirm') || Input.wasPressed('jump')) screen = 'select';
    break;

  case 'select':
    // 左右で選択を移動（解放されていないステージは選べるが、決定しても始まらない）
    if (Input.wasPressed('left'))  selected = Math.max(0, selected - 1);
    if (Input.wasPressed('right')) selected = Math.min(STAGES.length - 1, selected + 1);
    if (Input.wasPressed('confirm') || Input.wasPressed('jump')) {
      if (isUnlocked(selected)) startStage(selected);
    }
    if (Input.wasPressed('pause')) screen = 'title';
    break;

  case 'play':
    if (Input.wasPressed('pause')) { screen = 'paused'; break; }
    elapsed += dt;
    // …Phase 9 までのゲームの更新処理をそのままここに入れる…
    // その最後に、ゴールの判定を追加する（下記 D-5）
    break;

  case 'paused':
    if (Input.wasPressed('confirm') || Input.wasPressed('jump')) screen = 'play';
    if (Input.wasPressed('pause')) screen = 'title';
    break;

  case 'clear':
    if (Input.wasPressed('confirm') || Input.wasPressed('jump')) screen = 'select';
    break;
}
```

**メニューでの決定を `confirm` と `jump` の両方で受けるのは、スマホの A ボタンが `jump` に割り当てられているためです。** 入力システム（`input.js`）は変更しないこと。

`isUnlocked(index)` は「`index === 0` または `progress.cleared[index - 1] === true`」とする。

## D-5. ゴールに触れたときの処理

`'play'` の更新の最後、**ヤギが死亡していないときだけ**判定する。

```
world.isTouchingGoal(goat) が true なら:
  1. progress.cleared[currentStage] = true
  2. isBestTime   = bestTime[currentStage] が null または elapsed より大きい
  3. isBestDeaths = bestDeaths[currentStage] が null または deaths より大きい
  4. それぞれ true なら記録を更新する
  5. saveProgress(progress)
  6. clearInfo = { stageName, time: elapsed, deaths, isBestTime, isBestDeaths }
  7. screen = 'clear'
```

## D-6. `render()` の分岐

```
'title'  → 背景（Background）だけ描き、その上に drawTitle
'select' → 背景だけ描き、その上に drawStageSelect
'play'   → これまでどおりゲームを描き、最後に drawPlayHud
'paused' → ゲームを描いたうえで drawPause を重ねる
'clear'  → ゲームを描いたうえで drawClear を重ねる
```

**タイトルとステージ選択でも `Background` は描くこと**（真っ黒な画面にしない）。`camera` がまだ無い場合に備え、`{ x: 0, y: 0 }` のような仮のカメラを渡してよい。

**デバッグ表示（`DEBUG === true` のとき）は `'play'` のときだけ描き、画面の右上に右揃えで描くこと。**
左上は HUD が使うため、現在の位置のままだと重なります。

**仮想パッド（`Input.renderTouchControls`）は、すべての画面で最後に描くこと**（メニューの操作にも使うため）。

---

# 作業E — 奥の脚の色（1行の変更）

> あなたの指摘: 「脚を太くした副作用で、一瞬『脚が3本に見える』歩容フレームがある」

`src/goatRenderer.js` の**奥の脚の色**を、`GOAT_COLOR_LEG_FAR` の代わりに **`'#8a8071'`** を直接指定して、手前との差を強めること。
（`config.js` は変更しないこと。他の色は変更しないこと）

---

## 禁止事項

- 外部ライブラリ・CDN・画像ファイルの使用
- **ステージ2・3の制作**（Phase 11 の担当。`STAGES` は `[stage1]` のままにすること）
- **サウンドの実装**（SPEC 第16章のとおり v1 では実装しない）
- `src/input.js` を変更すること
- 物理定数・カメラ定数・背景・地形タイル・敵の色形を変更すること
- ヤギの骨格・体型・線の太さを変更すること（**奥の脚の色だけ**）
- ステージの**地形部分**を書き換えること
- `localStorage` の読み書きを `try`/`catch` の外で行うこと
- 上記7ファイル以外の作成・変更

---

## 完了条件（すべて満たすこと）

1. コンソールにエラー・警告が**1件も出ない**。
2. **起動するとタイトル画面が出る。** 背景の山が見えている。開始を促す文字が脈動している。
3. `Space` でステージ選択へ進む。**ステージ1が選択されており、ステージ2・3は `？？？` と表示される。**
4. `Space` でステージ1が始まる。
5. **プレイ中、左上にステージ名・タイム・死亡回数が表示される。** タイムが進む。
6. **死ぬと `DEATH` の数が増える。**
7. `Esc` でポーズし、`Space` で再開できる。ポーズ中はタイムが止まる。
8. ポーズ中に `Esc` を押すとタイトルへ戻る。
9. **ステージ右端の金色のゴール旗に触れるとクリア画面が出る。** タイム・死亡回数が表示される。
10. 初回クリア時は `NEW RECORD!` と `BEST!` が表示される。
11. `Space` でステージ選択に戻ると、**ステージ1に `✓` と記録が表示される。**
12. **ブラウザをリロードしても記録が残っている。**
13. **もう一度クリアして、前回より遅ければ `NEW RECORD!` が出ない。** 速ければ出て記録が更新される。
14. **同じステージを2回目に始めたとき、タイムと死亡回数が 0 にリセットされる。**
15. デバッグ表示が画面右上に出て、左上の HUD と重ならない。
16. スマホ表示で、**仮想パッドの ◀ ▶ でステージを選び、A ボタンで決定できる。** ポーズボタンも効く。
17. ゴールの旗が揺れており、チェックポイントの旗より大きく目立つ。
18. 奥の脚と手前の脚が、走行中のどのコマでもはっきり区別できる。
19. FPS が約60を維持している。

---

## 実装後の報告フォーマット

```
## 完了報告 Phase 10
### 変更ファイル
- （パスと行数、新規/修正の別）
### 実装内容
- （箇条書きで6〜10行）
### 動作確認結果
- 完了条件1〜19のそれぞれについて、確認できたか / できなかったか
- 完了条件12の「リロード後も記録が残ること」は必ず実機で確認すること
### 判断が必要だった点・仕様の曖昧さ
- （なければ「なし」）
### 見た目・手触りについて気づいた点
- 遊んでみて不自然に感じた点があれば率直に書いてください
```
