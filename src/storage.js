// ALPINE GOAT — 進捗の保存と読み込み（localStorage）
//
// 設計方針: 進捗の保存は「あると嬉しい機能」であって必須ではない。
// プライベートウィンドウやブラウザ設定では localStorage へのアクセス自体が
// 例外を投げることがあるため、読み書きは必ず try/catch で囲み、
// 失敗しても例外を外へ投げず、常に妥当な進捗オブジェクトを返す。

// 保存キー（バージョン付き。データ形式を変えるときは v2 にする）
const STORAGE_KEY = 'alpine-goat-progress-v1';

// ステージ数は3で固定（Phase 11 で3ステージを作る）
const STAGE_COUNT = 3;

/**
 * 初期状態の進捗オブジェクトを新規に作って返す。
 * 参照を共有しないよう、呼ばれるたびに新しい配列を作る。
 * @returns {{cleared: boolean[], bestTime: (number|null)[], bestDeaths: (number|null)[]}}
 */
function defaultProgress() {
  return {
    cleared: new Array(STAGE_COUNT).fill(false),
    bestTime: new Array(STAGE_COUNT).fill(null),
    bestDeaths: new Array(STAGE_COUNT).fill(null),
  };
}

/**
 * 読み込んだ値が「長さ STAGE_COUNT の配列」かどうかを検証する。
 * @param {unknown} arr
 * @returns {boolean}
 */
function isValidArray(arr) {
  return Array.isArray(arr) && arr.length === STAGE_COUNT;
}

/**
 * 進捗を読み込む。
 * 失敗した場合・保存が無い場合・データが壊れている場合のいずれでも初期値を返す。
 * 例外を外に投げない。
 * @returns {{cleared: boolean[], bestTime: (number|null)[], bestDeaths: (number|null)[]}}
 */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();

    const data = JSON.parse(raw);
    // 3つの配列がそろっていて、いずれも長さ3であることを必須とする
    if (
      !data ||
      !isValidArray(data.cleared) ||
      !isValidArray(data.bestTime) ||
      !isValidArray(data.bestDeaths)
    ) {
      return defaultProgress();
    }

    // 型を正規化しつつ、初期オブジェクトへ値を移す（余計なキーは捨てる）
    const p = defaultProgress();
    for (let i = 0; i < STAGE_COUNT; i++) {
      p.cleared[i] = data.cleared[i] === true;
      p.bestTime[i] =
        typeof data.bestTime[i] === 'number' && isFinite(data.bestTime[i])
          ? data.bestTime[i]
          : null;
      p.bestDeaths[i] =
        typeof data.bestDeaths[i] === 'number' && isFinite(data.bestDeaths[i])
          ? data.bestDeaths[i]
          : null;
    }
    return p;
  } catch (e) {
    // アクセス自体が失敗する環境（プライベートウィンドウ等）でもゲームは遊べるようにする
    return defaultProgress();
  }
}

/**
 * 進捗を保存する。失敗しても例外を外に投げない。
 * @param {{cleared: boolean[], bestTime: (number|null)[], bestDeaths: (number|null)[]}} progress
 */
export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    // 保存できなくても続行する（進捗はセッション内には残る）
  }
}
