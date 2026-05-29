/**
 * ResearchRepository (cycle-7)
 *
 * デスクリサーチのダイジェスト用レコードを永続化する。
 * chrome.storage.local の新規キー `research_events` を所有 (既存スキーマ非干渉)。
 *
 * 1 レコード = 「ある待ちサイクルで、どのタスク(プロジェクト)中に、どの外部ページを
 * 閲覧したか」+ ハードコードの Bedrock 風ダイジェスト。
 *
 * best-effort / 上限リングバッファ。失敗しても例外を投げない。
 */

const STORAGE_KEY = 'research_events';
const MAX_EVENTS = 1000;

const DEBUG = true;
function dlog(...args) { if (DEBUG) console.log('[WaitLess][Research]', ...args); }
function dwarn(...args) { console.warn('[WaitLess][Research]', ...args); }

/**
 * @typedef {Object} ResearchEvent
 * @property {string} id
 * @property {number} capturedAt
 * @property {string} dateKey
 * @property {string} taskTitle    AI タブのタスク/プロジェクト文脈 (会話タイトル等)
 * @property {string} taskText     直近のユーザー発話の抜粋 (任意)
 * @property {string} leisureTitle 閲覧した外部ページのタイトル
 * @property {string} leisureUrl
 * @property {string} leisureDomain
 * @property {string|null} leisureGenreId
 * @property {string} digest       ハードコードの要約文
 */

async function readEvents() {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    return res && Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
  } catch (e) {
    dwarn('readEvents failed', e);
    return [];
  }
}

async function writeEvents(events) {
  try {
    let pruned = Array.isArray(events) ? events : [];
    if (pruned.length > MAX_EVENTS) {
      pruned = [...pruned]
        .sort((a, b) => (a.capturedAt || 0) - (b.capturedAt || 0))
        .slice(pruned.length - MAX_EVENTS);
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: pruned });
  } catch (e) {
    dwarn('writeEvents failed', e);
  }
}

/**
 * 1 件追記する (best-effort)。
 * @param {ResearchEvent} event
 */
export async function appendResearch(event) {
  if (!event || typeof event !== 'object' || typeof event.id !== 'string') return;
  try {
    const events = await readEvents();
    events.push(event);
    await writeEvents(events);
    dlog('appendResearch', event.id, event.leisureDomain, 'task=', event.taskTitle);
  } catch (e) {
    dwarn('appendResearch failed', e);
  }
}

export async function getAllResearch() {
  return readEvents();
}
