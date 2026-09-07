# 実装依頼 Phase 2 — 入力システム（キーボード + タッチ）

## 前提

- 作業ディレクトリ: `D:\desktop\python\side-scroller-game`
- `SPEC.md`（特に第3章「操作」と第4章「座標系」）と `TASKS.md` を**必ず最初に読んでください**。
- Phase 1 は完了・検証済みです。既存の `index.html` / `style.css` / `src/config.js` / `src/main.js` を土台にします。
- 技術は Phase 1 と同じ: **Vanilla JS (ES Modules) + Canvas 2D のみ。外部ライブラリ・CDN・ビルドツール・TypeScript は禁止。**
- コメントは**すべて日本語**。

## このフェーズのゴール

キーボードとタッチを**同一のインターフェース**に正規化した入力モジュールを作り、Phase 1 の「自動往復する矩形」を「プレイヤーが操作して動く矩形」に置き換える。

**物理（重力・ジャンプ・加速度）は Phase 3 の担当です。このフェーズでは実装しないでください。**

---

## 変更するファイル

| ファイル | 変更内容 |
|---|---|
| `src/input.js` | **新規作成** |
| `src/main.js` | 入力モジュールを組み込むよう修正 |
| `src/config.js` | タッチUIの座標定数を追記 |

**この3ファイル以外は作成・変更しないこと。**

---

## 1. `src/config.js` への追記

末尾に以下のセクションを追加する（既存の定数は変更しないこと）。座標はすべて**論理座標（960×540空間）**。

```
// ===== タッチUI（仮想パッド）のレイアウト =====
// 座標はすべて論理座標（960×540）。canvas上に直接描画するため、画面拡大に自動追従する。
TOUCH_BTN_LEFT    = { x:  90, y: 452, r: 44 }   // 左移動ボタン
TOUCH_BTN_RIGHT   = { x: 196, y: 452, r: 44 }   // 右移動ボタン
TOUCH_BTN_JUMP    = { x: 872, y: 452, r: 48 }   // Aボタン（ジャンプ）
TOUCH_BTN_DASH    = { x: 762, y: 412, r: 40 }   // Bボタン（頭突き）
TOUCH_BTN_PAUSE   = { x: 924, y:  36, r: 24 }   // ポーズボタン
TOUCH_HIT_PADDING = 12                          // 当たり判定を見た目の半径より広げる量(px)。押しやすさのため
TOUCH_UI_ALPHA    = 0.35                        // 仮想パッドの不透明度
```

---

## 2. `src/input.js` の仕様

### 公開するもの

`Input` という名前の**単一のオブジェクト**を `export` する（`export const Input = { ... }`）。

### アクション名（論理入力）

以下の6つの文字列定数のみを使う。**キーコードを input.js の外に漏らさないこと。**

`'left'` / `'right'` / `'jump'` / `'dash'` / `'pause'` / `'confirm'`

### キーマップ（`e.code` で判定すること。`e.key` や `e.keyCode` は使わない）

| アクション | キー |
|---|---|
| `left` | `ArrowLeft`, `KeyA` |
| `right` | `ArrowRight`, `KeyD` |
| `jump` | `Space`, `ArrowUp`, `KeyW` |
| `dash` | `ShiftLeft`, `ShiftRight`, `KeyJ` |
| `pause` | `Escape`, `KeyP` |
| `confirm` | `Space`, `Enter` |

- `Space` と矢印キーはページスクロールを起こすため、`keydown` で `e.preventDefault()` を呼ぶこと。
- `e.repeat` が `true` のキーリピートは **`wasPressed` を発火させないこと**（押しっぱなしで連射させない）。

### API（この5つ + 1つのゲッターを、この名前で必ず実装すること）

| メンバ | 仕様 |
|---|---|
| `Input.init(canvas)` | イベントリスナを登録する。canvas はタッチ座標変換に使う |
| `Input.isDown(action)` | そのアクションが**現在押されているか** を `boolean` で返す |
| `Input.wasPressed(action)` | **この update ステップで押され始めたか** を `boolean` で返す |
| `Input.wasReleased(action)` | **この update ステップで離されたか** を `boolean` で返す |
| `Input.endFrame()` | 「押され始め」「離され」のエッジ情報をクリアする |
| `Input.renderTouchControls(ctx)` | 仮想パッドを canvas に描画する |
| `Input.touchMode` （ゲッター） | 仮想パッドを表示すべきか を `boolean` で返す |

### ★最重要: `endFrame()` の呼び出しタイミング

ゲームループは固定タイムステップのため、**1フレームで `update()` が複数回呼ばれることがある**。
このとき `wasPressed()` が複数回 `true` を返すと、ジャンプが二重に発動するなどのバグになる。

したがって `Input.endFrame()` は **`update()` の呼び出し1回ごとの直後**に呼ぶ。
`main.js` のループを次の形にすること:

```js
while (accumulator >= FIXED_DT) {
  update(FIXED_DT);
  Input.endFrame();      // ← update 1回につき必ず1回
  accumulator -= FIXED_DT;
}
```

`render()` の後や、while ループの外で呼んではならない。

### タッチ入力の実装方針

1. **canvas上に描画した仮想ボタン**として実装する（DOM要素のボタンは作らない）。理由: canvas は CSS で拡大縮小されるため、論理座標に描いておけば拡大率に自動追従するから。

2. **座標変換**: タッチ座標（clientX/clientY）を論理座標に変換する関数を必ず用意する。
   ```js
   const rect = canvas.getBoundingClientRect();
   const lx = (clientX - rect.left) / rect.width  * LOGICAL_WIDTH;
   const ly = (clientY - rect.top)  / rect.height * LOGICAL_HEIGHT;
   ```

3. **マルチタッチ必須**（左移動しながらジャンプできること）。
   実装方法: `touchstart` / `touchmove` / `touchend` / `touchcancel` のすべてで、
   **`e.touches` に現存する全タッチ点を走査し、各ボタンの押下状態を毎回まるごと再計算する。**
   （個々のタッチを追跡するのではなく、毎回全走査して再構築する方が堅牢です）

4. **当たり判定**は円形。半径は `r + TOUCH_HIT_PADDING` を使う（見た目より広く取る）。

5. すべてのタッチイベントで `e.preventDefault()` を呼ぶ（ブラウザのスクロール・ダブルタップズームを抑止）。

6. **`touchMode` の判定ロジック:**
   - 初期値は `window.matchMedia('(pointer: coarse)').matches`
   - `touchstart` が発生したら `true` にする
   - `keydown` が発生したら `false` にする
   （＝最後に使った入力デバイスに追従する）

### `renderTouchControls(ctx)` の描画仕様

- `Input.touchMode` が `false` のときは**何も描画せず即 return** する。
- 各ボタンを、`TOUCH_UI_ALPHA` の不透明度で塗った白い円 + 白い輪郭線で描く。
- **押されているボタンは不透明度を上げる**（例: `TOUCH_UI_ALPHA + 0.25`）ことで、押下が視覚的に分かるようにする。
- 各ボタンの中央に記号を描く: 左=`◀` 右=`▶` ジャンプ=`A` 頭突き=`B` ポーズ=`II`
- **描画の前後を `ctx.save()` / `ctx.restore()` で必ず囲むこと**（後述の描画規約）。

---

## 3. `src/main.js` の変更

1. Phase 1 の**自動往復ロジックを削除**する。
2. 起動時に `Input.init(canvas)` を呼ぶ。
3. `update(dt)` を次の挙動に変更する（**物理はまだ入れない。等速移動のみ**）:
   - `Input.isDown('left')` なら `x -= 200 * dt`
   - `Input.isDown('right')` なら `x += 200 * dt`
   - 両方押されている、またはどちらも押されていない場合は静止
   - x は 0 〜 `LOGICAL_WIDTH - 幅` の範囲にクランプする
4. `render()` の**最後**に `Input.renderTouchControls(ctx)` を呼ぶ。
5. デバッグ表示（`DEBUG === true` のとき）を以下に拡張する:
   - 既存の `FPS` / `DPR` / `x`
   - `IN: ` に続けて、現在押されているアクション名を空白区切りで列挙（例: `IN: right jump`）。何も押されていなければ `IN: -`
   - `JUMP: <n>` — `wasPressed('jump')` が `true` になった**累計回数**
   - `DASH: <n>` — `wasPressed('dash')` が `true` になった累計回数

---

## 4. 描画規約（このフェーズから全フェーズで適用する新ルール）

Phase 1 のコードは `render()` 内で `ctx.fillStyle` / `font` / `textAlign` / `textBaseline` を設定したまま関数を抜けています。
今は描画関数が1つなので問題になっていませんが、Phase 5 以降で背景・ヤギ・敵・HUD の描画関数が並ぶと、**前の関数が残した ctx の状態を引き継いで表示が崩れる**バグの温床になります。

**したがって以下を規約とします:**

> 描画を行う関数は、その処理全体を `ctx.save()` と `ctx.restore()` で囲むこと。
> `ctx` の状態を、呼び出し元に漏らしてはならない。

Phase 1 で書かれた `render()` 内のデバッグ情報描画にも、この規約を**遡って適用**してください。

---

## 禁止事項

- 外部ライブラリ・CDN の使用
- 重力・ジャンプ・加速度・摩擦などの**物理の実装**（Phase 3 の担当）
- タッチUIを DOM 要素（`<button>` 等）で作ること
- `e.key` / `e.keyCode` の使用（`e.code` を使うこと）
- `Input.endFrame()` を while ループの外や `render()` の後で呼ぶこと
- 上記3ファイル以外の作成・変更

---

## 完了条件（すべて満たすこと）

1. `python -m http.server 8000` → `http://localhost:8000` で、コンソールにエラー・警告が**1件も出ない**。
2. PCで `←` `→`（および `A` `D`）を押すと矩形が左右に動き、離すと止まる。画面端で止まりはみ出さない。
3. `Space` を1回押すと `JUMP:` カウンタが **ちょうど1** 増える（**押しっぱなしにしても増え続けないこと**）。同様に `Shift` で `DASH:` が1増える。
4. `IN:` に現在押されているアクション名が正しく表示される。`←` と `Space` を同時押しすると `IN: left jump` のように両方出る。
5. Chrome DevTools のデバイスエミュレーション（スマホ）に切り替えると、**仮想パッドが画面に表示される**。
6. エミュレーション上で仮想パッドをタッチすると矩形が動き、押しているボタンの色が濃くなる。
7. **左ボタンを押したままAボタンをタッチすると、`IN: left jump` になる**（マルチタッチが機能している）。
8. エミュレーション中に PC のキーボードを押すと仮想パッドが消え、再びタッチすると復活する。
9. ページ上でスペースキーや矢印キーを押しても、ページがスクロールしない。

---

## 実装後の報告フォーマット

```
## 完了報告 Phase 2
### 変更ファイル
- （パスと行数、新規/修正の別）
### 実装内容
- （箇条書きで4〜7行）
### 動作確認結果
- 完了条件1〜9のそれぞれについて、確認できたか / できなかったか
### 判断が必要だった点・仕様の曖昧さ
- （なければ「なし」）
```
