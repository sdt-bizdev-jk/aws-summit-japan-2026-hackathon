/**
 * SettingsRepository
 *
 * chrome.storage.local に格納されたユーザー設定 (sites, threshold_sec) の
 * CRUD とバリデーションを集約する。
 *
 * Storage layer (snake_case) <-> App layer (camelCase) の変換境界。
 *
 * 関連 FR: FR-04, FR-09, FR-10, FR-11
 * 関連ルール: BR-01, BR-02, BR-03, BR-04, BR-05, BR-20, BR-17
 */

const DEFAULT_THRESHOLD_SEC = 5;
const THRESHOLD_MIN = 1;
const THRESHOLD_MAX = 60;

const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DOMAIN_MAX_LEN = 255;
const URL_MAX_LEN = 2048;

/**
 * domain を正規化 (小文字化 + www. 除去)
 */
function normalizeDomain(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().toLowerCase();
  return trimmed.replace(/^www\./, '');
}

/**
 * domain バリデーション (BR-01)
 * @returns {{ ok: boolean, value?: string, reason?: string }}
 */
function validateDomain(input) {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'invalid_domain' };
  }
  const normalized = normalizeDomain(input);
  if (normalized.length === 0 || normalized.length > DOMAIN_MAX_LEN) {
    return { ok: false, reason: 'invalid_domain' };
  }
  if (!DOMAIN_REGEX.test(normalized)) {
    return { ok: false, reason: 'invalid_domain' };
  }
  return { ok: true, value: normalized };
}

/**
 * URL バリデーション (BR-02)
 * @returns {{ ok: boolean, value?: string, reason?: string }}
 */
function validateUrl(input) {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'invalid_url' };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > URL_MAX_LEN) {
    return { ok: false, reason: 'invalid_url' };
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, reason: 'invalid_url' };
    }
    return { ok: true, value: trimmed };
  } catch (_e) {
    return { ok: false, reason: 'invalid_url' };
  }
}

/**
 * しきい値バリデーション (BR-04)
 */
function validateThreshold(input) {
  if (typeof input !== 'number' || !Number.isInteger(input)) {
    return { ok: false, reason: 'invalid_threshold' };
  }
  if (input < THRESHOLD_MIN || input > THRESHOLD_MAX) {
    return { ok: false, reason: 'invalid_threshold' };
  }
  return { ok: true, value: input };
}

/**
 * Storage の生データを安全にロードし、デフォルトを補完する (BR-20)
 * @returns {Promise<{ sites: Array, thresholdSec: number }>}
 */
export async function getSettings() {
  try {
    const raw = await chrome.storage.local.get(['sites', 'threshold_sec']);
    const sites = Array.isArray(raw.sites) ? sanitizeSites(raw.sites) : [];
    const thresholdSec = (Number.isInteger(raw.threshold_sec)
      && raw.threshold_sec >= THRESHOLD_MIN
      && raw.threshold_sec <= THRESHOLD_MAX)
      ? raw.threshold_sec
      : DEFAULT_THRESHOLD_SEC;
    return { sites, thresholdSec };
  } catch (e) {
    console.error('[WaitLess] getSettings failed', e);
    return { sites: [], thresholdSec: DEFAULT_THRESHOLD_SEC };
  }
}

/**
 * sites 配列を整形 (priority 連番化、不正データ除去)
 */
function sanitizeSites(rawSites) {
  const filtered = rawSites
    .filter((s) => s && typeof s.domain === 'string' && typeof s.url === 'string')
    .map((s) => ({ domain: s.domain, url: s.url, priority: Number(s.priority) || 0 }));
  // priority 昇順ソート (BR-06)
  filtered.sort((a, b) => a.priority - b.priority);
  // 1 から連番化 (BR-05)
  return filtered.map((s, i) => ({ domain: s.domain, url: s.url, priority: i + 1 }));
}

/**
 * sites のみ取得 (priority 昇順)
 */
export async function getSites() {
  const { sites } = await getSettings();
  return sites;
}

/**
 * しきい値のみ取得
 */
export async function getThresholdSec() {
  const { thresholdSec } = await getSettings();
  return thresholdSec;
}

/**
 * 内部: sites を保存
 */
async function saveSites(sites) {
  await chrome.storage.local.set({ sites });
}

/**
 * 内部: しきい値を保存
 */
async function saveThreshold(sec) {
  await chrome.storage.local.set({ threshold_sec: sec });
}

/**
 * サイト追加 (BR-01〜03, BR-05)
 */
export async function addSite({ domain, url } = {}) {
  const dv = validateDomain(domain);
  if (!dv.ok) return { ok: false, reason: dv.reason };
  const uv = validateUrl(url);
  if (!uv.ok) return { ok: false, reason: uv.reason };

  try {
    const current = await getSites();
    if (current.some((s) => s.domain === dv.value)) {
      return { ok: false, reason: 'duplicate_domain' };
    }
    const newSite = { domain: dv.value, url: uv.value, priority: current.length + 1 };
    const next = [...current, newSite]; // priority 連番は addSite 内で連続
    await saveSites(next);
    return { ok: true };
  } catch (e) {
    console.error('[WaitLess] addSite failed', e);
    return { ok: false, reason: 'storage_error' };
  }
}

/**
 * サイト更新 (BR-01〜03)
 * @param {{ originalDomain: string, domain: string, url: string }} payload
 */
export async function updateSite({ originalDomain, domain, url } = {}) {
  const origNorm = normalizeDomain(originalDomain || domain || '');
  const dv = validateDomain(domain);
  if (!dv.ok) return { ok: false, reason: dv.reason };
  const uv = validateUrl(url);
  if (!uv.ok) return { ok: false, reason: uv.reason };

  try {
    const current = await getSites();
    const targetIdx = current.findIndex((s) => s.domain === origNorm);
    if (targetIdx === -1) {
      return { ok: false, reason: 'not_found' };
    }
    // domain を変更する場合、変更後の domain が他に存在しないか確認 (BR-03)
    if (dv.value !== origNorm
        && current.some((s, i) => i !== targetIdx && s.domain === dv.value)) {
      return { ok: false, reason: 'duplicate_domain' };
    }
    const next = [...current];
    next[targetIdx] = { domain: dv.value, url: uv.value, priority: current[targetIdx].priority };
    await saveSites(next);
    return { ok: true };
  } catch (e) {
    console.error('[WaitLess] updateSite failed', e);
    return { ok: false, reason: 'storage_error' };
  }
}

/**
 * サイト削除 (BR-05 で再採番)
 */
export async function deleteSite(domain) {
  const norm = normalizeDomain(domain || '');
  try {
    const current = await getSites();
    const idx = current.findIndex((s) => s.domain === norm);
    if (idx === -1) {
      return { ok: false, reason: 'not_found' };
    }
    const next = current
      .filter((_s, i) => i !== idx)
      .map((s, i) => ({ ...s, priority: i + 1 }));
    await saveSites(next);
    return { ok: true };
  } catch (e) {
    console.error('[WaitLess] deleteSite failed', e);
    return { ok: false, reason: 'storage_error' };
  }
}

/**
 * 並び替え (BR-05 連番化)
 */
export async function reorderSites(orderedDomains) {
  if (!Array.isArray(orderedDomains)) {
    return { ok: false, reason: 'invalid_payload' };
  }
  try {
    const current = await getSites();
    const map = new Map(current.map((s) => [s.domain, s]));
    const next = [];
    const seen = new Set();
    for (const d of orderedDomains) {
      const norm = normalizeDomain(d);
      if (seen.has(norm)) continue;
      seen.add(norm);
      const s = map.get(norm);
      if (s) {
        next.push({ ...s, priority: next.length + 1 });
      }
    }
    // orderedDomains に含まれなかった既存 domain は末尾に維持
    for (const s of current) {
      if (!seen.has(s.domain)) {
        next.push({ ...s, priority: next.length + 1 });
      }
    }
    await saveSites(next);
    return { ok: true };
  } catch (e) {
    console.error('[WaitLess] reorderSites failed', e);
    return { ok: false, reason: 'storage_error' };
  }
}

/**
 * しきい値の設定 (BR-04)
 */
export async function setThresholdSec(sec) {
  const v = validateThreshold(sec);
  if (!v.ok) return { ok: false, reason: v.reason };
  try {
    await saveThreshold(v.value);
    return { ok: true };
  } catch (e) {
    console.error('[WaitLess] setThresholdSec failed', e);
    return { ok: false, reason: 'storage_error' };
  }
}

/**
 * 部分更新 (内部用、テスト容易性のため公開)
 */
export async function updateSettings(partial = {}) {
  if (Array.isArray(partial.sites)) await saveSites(partial.sites);
  if (Number.isInteger(partial.thresholdSec)) {
    const v = validateThreshold(partial.thresholdSec);
    if (v.ok) await saveThreshold(v.value);
  }
}
