/**
 * StatsRepository (cycle-6)
 *
 * 待ちサイクル統計レコードの永続化と取得を一元管理する。
 * chrome.storage.local の新規キー `stats_events` を所有する。
 * 既存 sites / threshold_sec / reader_state には干渉しない (BR-98, NFR-71)。
 *
 * 設計方針:
 *   - 確定済みサイクルのみ stats_events に push (BR-82)。進行中は RuntimeState 管理 (F1=B)
 *   - 上限 MAX_EVENTS 超過は古い順に削除 (BR-96 リングバッファ、A2=B)
 *   - 全操作 best-effort。失敗しても例外を投げない (BR-97, NFR-74)
 *   - 破損データは防御的に扱う (NFR-75)
 *
 * 関連 FR: FR-71, FR-72, FR-73, FR-78
 * 関連 BR: BR-81〜86, BR-96, BR-97, BR-98
 */

const STORAGE_KEY = 'stats_events';
const MAX_EVENTS = 5000; // F5=A

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][Stats]', ...args);
}
function dwarn(...args) {
  console.warn('[WaitLess][Stats]', ...args);
}

/**
 * @typedef {Object} StatsEvent
 * @property {string} id
 * @property {'chrome'|'ide'} source
 * @property {number} waitStartAt
 * @property {number} waitEndAt
 * @property {number|null} leisureStartAt
 * @property {number|null} leisureEndAt
 * @property {string|null} leisureGenreId
 * @property {string|null} leisureDomain
 * @property {number|null} resumeActionAt
 * @property {'resumed'|'timeout'|null} resumeOutcome
 * @property {boolean|null} reLeftWithinStay
 * @property {string} dateKey
 */

/**
 * epoch ms をローカル日付キー "YYYY-MM-DD" に変換する (BR-99, A6=A)。
 * @param {number} epochMs
 * @returns {string}
 */
export function toDateKey(epochMs) {
  const d = (typeof epochMs === 'number' && isFinite(epochMs)) ? new Date(epochMs) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 内部: stats_events 配列を読む (防御的、破損時は空配列)。
 * @returns {Promise<StatsEvent[]>}
 */
async function readEvents() {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const arr = res && Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
    return arr;
  } catch (e) {
    dwarn('readEvents failed', e);
    return [];
  }
}

/**
 * 内部: stats_events 配列を書く (リングバッファ適用後)。
 * @param {StatsEvent[]} events
 */
async function writeEvents(events) {
  try {
    const pruned = pruneIfNeeded(events);
    await chrome.storage.local.set({ [STORAGE_KEY]: pruned });
  } catch (e) {
    dwarn('writeEvents failed', e);
  }
}

/**
 * 上限 MAX_EVENTS を超えたら古い順 (waitStartAt 昇順) に削除する (BR-96)。
 * @param {StatsEvent[]} events
 * @returns {StatsEvent[]}
 */
export function pruneIfNeeded(events) {
  if (!Array.isArray(events) || events.length <= MAX_EVENTS) {
    return Array.isArray(events) ? events : [];
  }
  const sorted = [...events].sort((a, b) => (a.waitStartAt || 0) - (b.waitStartAt || 0));
  return sorted.slice(sorted.length - MAX_EVENTS);
}

/**
 * 確定済みの待ちサイクルレコードを 1 件追記する (BR-82)。
 * chrome/ide 共通の確定形 append。
 * @param {StatsEvent} event
 */
export async function appendEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.id !== 'string') {
    dwarn('appendEvent: invalid event, skipping');
    return;
  }
  try {
    const events = await readEvents();
    // 同一 id があれば置換 (再記録の冪等性)
    const idx = events.findIndex((e) => e && e.id === event.id);
    if (idx >= 0) {
      events[idx] = event;
    } else {
      events.push(event);
    }
    await writeEvents(events);
    dlog('appendEvent', event.id, event.source, 'genre=', event.leisureGenreId);
  } catch (e) {
    dwarn('appendEvent failed', e);
  }
}

/**
 * VS Code 由来の完結済みサイクルを記録する (S2, A4=A)。
 * leisureGenreId は呼び出し側 (IdeBridge) で分類済みのものを受け取る。
 * @param {Partial<StatsEvent>} record
 */
export async function recordCycle(record) {
  if (!record || typeof record !== 'object') return;
  const waitStartAt = Number(record.waitStartAt);
  if (!isFinite(waitStartAt)) {
    dwarn('recordCycle: invalid waitStartAt, skipping');
    return;
  }
  const event = {
    id: typeof record.id === 'string' ? record.id : `ide-${waitStartAt}`,
    source: 'ide',
    waitStartAt,
    waitEndAt: Number(record.waitEndAt) || waitStartAt,
    leisureStartAt: record.leisureStartAt != null ? Number(record.leisureStartAt) : null,
    leisureEndAt: record.leisureEndAt != null ? Number(record.leisureEndAt) : null,
    leisureGenreId: record.leisureGenreId != null ? String(record.leisureGenreId) : null,
    leisureDomain: record.leisureDomain != null ? String(record.leisureDomain) : null,
    resumeActionAt: null,      // ide は集中復帰秒数を記録しない (C4=B)
    resumeOutcome: null,
    reLeftWithinStay: null,
    dateKey: toDateKey(waitStartAt),
  };
  await appendEvent(event);
}

/**
 * 既存の確定レコード (chrome) に復帰結果を後追い更新する (BR-93, BR-94, M-05/M-07)。
 * @param {string} id
 * @param {{ resumeActionAt: number|null, outcome: 'resumed'|'timeout' }} params
 */
export async function resolveResume(id, { resumeActionAt, outcome }) {
  if (typeof id !== 'string') return;
  try {
    const events = await readEvents();
    const ev = events.find((e) => e && e.id === id);
    if (!ev) {
      dlog('resolveResume: id not found', id);
      return;
    }
    // 既に確定済みなら上書きしない (最初の操作を優先)
    if (ev.resumeOutcome === 'resumed') return;
    ev.resumeActionAt = (outcome === 'resumed' && isFinite(Number(resumeActionAt)))
      ? Number(resumeActionAt) : null;
    ev.resumeOutcome = outcome === 'resumed' ? 'resumed' : 'timeout';
    await writeEvents(events);
    dlog('resolveResume', id, outcome);
  } catch (e) {
    dwarn('resolveResume failed', e);
  }
}

/**
 * 既存の確定レコード (chrome) に再離脱フラグを記録する (BR-90, M-04)。
 * @param {string} id
 * @param {boolean} reLeft
 */
export async function markReLeft(id, reLeft) {
  if (typeof id !== 'string') return;
  try {
    const events = await readEvents();
    const ev = events.find((e) => e && e.id === id);
    if (!ev) {
      dlog('markReLeft: id not found', id);
      return;
    }
    ev.reLeftWithinStay = !!reLeft;
    await writeEvents(events);
    dlog('markReLeft', id, !!reLeft);
  } catch (e) {
    dwarn('markReLeft failed', e);
  }
}

/**
 * 全レコードを取得する (ダッシュボード以外の用途、防御的)。
 * @returns {Promise<StatsEvent[]>}
 */
export async function getAllEvents() {
  return readEvents();
}
