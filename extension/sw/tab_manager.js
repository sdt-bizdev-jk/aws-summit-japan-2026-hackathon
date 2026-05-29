/**
 * TabManager
 *
 * chrome.tabs.* 操作を集約。優先順位ベースの娯楽タブ探索 (現在ウィンドウ + ドメイン一致)、
 * アクティブ化、新規作成、PlaybackTrigger 動的注入を提供する。
 *
 * 関連 FR: FR-05, FR-06, FR-08
 * 関連ルール: BR-07, BR-08, BR-09, BR-10, BR-15
 */

const CLAUDE_URL_PATTERN = 'https://claude.ai/*';

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][TabManager]', ...args);
}

/**
 * URL からドメインを抽出 (www. 除去)
 * @returns {string} 抽出失敗時は空文字
 */
export function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_e) {
    return '';
  }
}

/**
 * 現在のフォーカスウィンドウのタブから、登録された娯楽サイトを優先順位順に探索する。
 *
 * 探索戦略 (2パス):
 *   Pass 1: 優先順位順に各サイトについて URL 完全一致タブを探す
 *           → ヒットしたら遷移なしでアクティブ化 (続きから再生)
 *   Pass 2: 優先順位順に各サイトについてドメイン一致タブを探す
 *           → ヒットしたら登録 URL に navigate
 *   Pass 3: いずれも無ければ priority 1位 の URL で新規タブを開く
 *
 * @param {Array<{ domain: string, url: string, priority: number }>} sites priority 昇順
 * @returns {Promise<{ tabId: number, opened: 'existing' | 'navigated' | 'new' } | null>}
 */
export async function findOrOpenPlaySite(sites) {
  if (!Array.isArray(sites) || sites.length === 0) {
    dlog('findOrOpenPlaySite: no sites');
    return null;
  }

  let currentWindow;
  try {
    currentWindow = await chrome.windows.getLastFocused({ populate: true });
  } catch (e) {
    console.warn('[WaitLess][TabManager] getLastFocused failed', e);
    return null;
  }

  const tabs = (currentWindow && currentWindow.tabs) || [];
  dlog('findOrOpenPlaySite: scanning', tabs.length, 'tabs in current window',
    tabs.map((t) => ({ id: t.id, url: t.url })));

  // Pass 1: URL 完全一致を最優先 (続きから再生したい意図)
  for (const site of sites) {
    for (const tab of tabs) {
      if (tab.url && tab.url === site.url) {
        dlog('hit existing tab (url match)', { tabId: tab.id, domain: site.domain });
        // タブをアクティブ化しウィンドウもフォーカス (Chrome を前面に出す)
        try {
          await chrome.tabs.update(tab.id, { active: true });
          if (currentWindow.id != null) {
            await chrome.windows.update(currentWindow.id, { focused: true });
          }
        } catch (e) {
          console.warn('[WaitLess][TabManager] activate on hit failed', e);
        }
        return { tabId: tab.id, opened: 'existing' };
      }
    }
  }

  // Pass 2: ドメイン一致 → 登録 URL に navigate
  for (const site of sites) {
    for (const tab of tabs) {
      if (tab.url && extractDomain(tab.url) === site.domain) {
        dlog('hit existing tab (domain only); navigating to registered url',
          { tabId: tab.id, domain: site.domain, from: tab.url, to: site.url });
        try {
          await chrome.tabs.update(tab.id, { url: site.url, active: true });
          if (currentWindow.id != null) {
            await chrome.windows.update(currentWindow.id, { focused: true });
          }
        } catch (e) {
          console.warn('[WaitLess][TabManager] tabs.update navigate failed', e);
        }
        return { tabId: tab.id, opened: 'navigated' };
      }
    }
  }

  // Pass 3: ヒットなし → 優先順位 1位 の URL で新規作成 (BR-09)
  const top = sites[0];
  dlog('no existing tab; opening new', top.url);
  try {
    const newTab = await chrome.tabs.create({
      url: top.url,
      active: true,
      windowId: currentWindow.id,
    });
    if (currentWindow.id != null) {
      try {
        await chrome.windows.update(currentWindow.id, { focused: true });
      } catch (e) {
        console.warn('[WaitLess][TabManager] windows.update focus failed', e);
      }
    }
    return { tabId: newTab.id, opened: 'new' };
  } catch (e) {
    console.error('[WaitLess][TabManager] tabs.create failed', e);
    return null;
  }
}

/**
 * 指定タブをアクティブ化 (ウィンドウもフォーカス)
 */
export async function activateTab(tabId) {
  if (tabId == null) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab && tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  } catch (e) {
    console.warn('[WaitLess] activateTab failed', e);
  }
}

/**
 * URL で新規タブを開く
 */
export async function openNewTab(url, active = true) {
  try {
    const t = await chrome.tabs.create({ url, active });
    return t.id;
  } catch (e) {
    console.error('[WaitLess] openNewTab failed', e);
    return null;
  }
}

/**
 * 動的に PlaybackTrigger を注入する (失敗を黙って許容)
 * タブが まだ loading 中の場合は完了を待ってから注入する。
 */
export async function injectPlaybackTrigger(tabId) {
  if (tabId == null) return;

  // タブのロードが完了しているか確認、未完了なら待つ
  try {
    await waitForTabComplete(tabId);
  } catch (e) {
    console.warn('[WaitLess][TabManager] waitForTabComplete failed', e);
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/playback_trigger.js'],
    });
    dlog('PlaybackTrigger injected into tab', tabId);
  } catch (e) {
    console.warn('[WaitLess][TabManager] PlaybackTrigger injection failed', e);
  }
}

/**
 * 動的に PlaybackPause を注入する (失敗を黙って許容)
 * 娯楽タブから AI タブに戻る直前に呼び、動画を一時停止する。
 */
export async function injectPlaybackPause(tabId) {
  if (tabId == null) return;
  try {
    const t = await chrome.tabs.get(tabId);
    if (!t) return;
  } catch (_e) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/playback_pause.js'],
    });
    dlog('PlaybackPause injected into tab', tabId);
  } catch (e) {
    console.warn('[WaitLess][TabManager] PlaybackPause injection failed', e);
  }
}

/**
 * 指定タブの status が 'complete' になるまで待つ (最大 timeoutMs)。
 */
export function waitForTabComplete(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try { chrome.tabs.onUpdated.removeListener(listener); } catch (_e) {}
      resolve();
    };

    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        finish();
      }
    };

    // 既に complete ならすぐ解決
    chrome.tabs.get(tabId, (tab) => {
      const _ = chrome.runtime.lastError;
      if (!tab) return finish();
      if (tab.status === 'complete') return finish();
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(finish, timeoutMs); // 最大待ち時間
    });
  });
}

/**
 * 現在開いている Claude.ai タブを 1つ探す (フォールバック用)
 * 複数あれば最後にアクティブだったもの (best-effort)
 * @returns {Promise<number | null>}
 */
export async function findClaudeTab() {
  try {
    const tabs = await chrome.tabs.query({ url: CLAUDE_URL_PATTERN });
    if (!tabs || tabs.length === 0) return null;
    // lastAccessed が無い場合は配列順
    tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    return tabs[0].id;
  } catch (e) {
    console.warn('[WaitLess] findClaudeTab failed', e);
    return null;
  }
}

/**
 * 指定タブが現存するか
 */
export async function tabExists(tabId) {
  if (tabId == null) return false;
  try {
    const t = await chrome.tabs.get(tabId);
    return !!t;
  } catch (_e) {
    return false;
  }
}
