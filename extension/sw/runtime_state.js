/**
 * RuntimeState
 *
 * 待ち中フラグ、Claude.ai タブID、娯楽タブID などの実行時状態を保持する。
 * Service Worker のメモリで持ちつつ、Service Worker のアイドルアンロード/再起動に
 * 耐えるため chrome.storage.session に永続化する。
 *
 * 関連ルール: BR-12, BR-13, BR-16, BR-22
 */

const SESSION_KEY = 'runtime_state';

const state = {
  isWaiting: false,
  claudeTabId: null,
  playTabId: null,
  // cycle-6: 進行中の統計サイクル (PendingCycle) を 1 件保持 (BR-81, F1=B)
  statsPending: null,
  // cycle-6: 復帰操作/再離脱の解決対象となる確定済みサイクル id (娯楽切替ありのみ)
  statsResumeTargetId: null,
};

/**
 * Service Worker 起動時に session ストレージから復元する (BR-16)
 */
export async function restoreFromSession() {
  try {
    const saved = await chrome.storage.session.get(SESSION_KEY);
    if (saved && saved[SESSION_KEY]) {
      Object.assign(state, saved[SESSION_KEY]);
    }
  } catch (e) {
    console.warn('[WaitLess] runtime_state restore failed', e);
  }
}

/**
 * 内部: 現在の状態を session に書き込む
 */
async function persist() {
  try {
    await chrome.storage.session.set({ [SESSION_KEY]: { ...state } });
  } catch (e) {
    console.warn('[WaitLess] runtime_state persist failed', e);
  }
}

export function isWaiting() {
  return state.isWaiting === true;
}

export async function setWaiting(bool) {
  state.isWaiting = !!bool;
  await persist();
}

export function getClaudeTabId() {
  return state.claudeTabId;
}

export async function setClaudeTabId(tabId) {
  state.claudeTabId = tabId == null ? null : Number(tabId);
  await persist();
}

export function getPlayTabId() {
  return state.playTabId;
}

export async function setPlayTabId(tabId) {
  state.playTabId = tabId == null ? null : Number(tabId);
  await persist();
}

/**
 * 異常系リカバリ: 全状態を初期値に戻す (BR-22)
 */
export async function reset() {
  state.isWaiting = false;
  state.claudeTabId = null;
  state.playTabId = null;
  state.statsPending = null;
  state.statsResumeTargetId = null;
  await persist();
}

/**
 * cycle-6: 進行中の統計サイクル (PendingCycle) を取得する (BR-81, F1=B)
 * @returns {object|null}
 */
export function getStatsPending() {
  return state.statsPending;
}

/**
 * cycle-6: 進行中の統計サイクルを保持する。null でクリア。
 * @param {object|null} pending
 */
export async function setStatsPending(pending) {
  state.statsPending = pending == null ? null : pending;
  await persist();
}

/**
 * cycle-6: 復帰操作/再離脱の解決対象 id を取得する。
 * @returns {string|null}
 */
export function getStatsResumeTargetId() {
  return state.statsResumeTargetId;
}

/**
 * cycle-6: 復帰操作/再離脱の解決対象 id を保持する。null でクリア。
 * @param {string|null} id
 */
export async function setStatsResumeTargetId(id) {
  state.statsResumeTargetId = id == null ? null : String(id);
  await persist();
}
