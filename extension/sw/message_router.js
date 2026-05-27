/**
 * MessageRouter
 *
 * chrome.runtime.onMessage の受信ハブ。タイプ別に
 * WaitOrchestrator / SettingsRepository へルーティングする。
 *
 * 関連ルール: BR-18 (不明タイプは黙って無視)
 */

import * as WaitOrchestrator from './wait_orchestrator.js';
import * as SettingsRepository from './settings_repository.js';

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][Router]', ...args);
}

/**
 * 起動時に 1回だけ呼ぶ。
 */
export function init() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    return handle(message, sender, sendResponse);
  });
}

/**
 * メッセージのディスパッチ。非同期応答時には true を返す。
 */
function handle(message, sender, sendResponse) {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  const type = message.type;
  const payload = message.payload || {};
  dlog('received', type, 'from tab', sender && sender.tab && sender.tab.id);

  switch (type) {
    case 'WAIT_DETECTED': {
      const tabId = (sender && sender.tab && sender.tab.id != null)
        ? sender.tab.id
        : payload.claudeTabId;
      // 非同期だが応答不要 (await しない)
      WaitOrchestrator.onWaitDetected(tabId, payload.durationMs).catch((e) => {
        console.error('[WaitLess] WAIT_DETECTED handling failed', e);
      });
      return false;
    }

    case 'COMPLETION_DETECTED': {
      const tabId = (sender && sender.tab && sender.tab.id != null)
        ? sender.tab.id
        : payload.claudeTabId;
      WaitOrchestrator.onCompletionDetected(tabId).catch((e) => {
        console.error('[WaitLess] COMPLETION_DETECTED handling failed', e);
      });
      return false;
    }

    case 'GET_SETTINGS': {
      SettingsRepository.getSettings()
        .then((s) => sendResponse(s))
        .catch((e) => {
          console.error('[WaitLess] GET_SETTINGS failed', e);
          sendResponse({ sites: [], thresholdSec: 5 });
        });
      return true;
    }

    case 'ADD_SITE': {
      SettingsRepository.addSite(payload)
        .then((r) => sendResponse(r))
        .catch((e) => {
          console.error('[WaitLess] ADD_SITE failed', e);
          sendResponse({ ok: false, reason: 'storage_error' });
        });
      return true;
    }

    case 'UPDATE_SITE': {
      SettingsRepository.updateSite(payload)
        .then((r) => sendResponse(r))
        .catch((e) => {
          console.error('[WaitLess] UPDATE_SITE failed', e);
          sendResponse({ ok: false, reason: 'storage_error' });
        });
      return true;
    }

    case 'DELETE_SITE': {
      SettingsRepository.deleteSite(payload.domain)
        .then((r) => sendResponse(r))
        .catch((e) => {
          console.error('[WaitLess] DELETE_SITE failed', e);
          sendResponse({ ok: false, reason: 'storage_error' });
        });
      return true;
    }

    case 'REORDER_SITES': {
      SettingsRepository.reorderSites(payload.orderedDomains)
        .then((r) => sendResponse(r))
        .catch((e) => {
          console.error('[WaitLess] REORDER_SITES failed', e);
          sendResponse({ ok: false, reason: 'storage_error' });
        });
      return true;
    }

    case 'SET_THRESHOLD': {
      SettingsRepository.setThresholdSec(payload.thresholdSec)
        .then((r) => sendResponse(r))
        .catch((e) => {
          console.error('[WaitLess] SET_THRESHOLD failed', e);
          sendResponse({ ok: false, reason: 'storage_error' });
        });
      return true;
    }

    default:
      // BR-18: 不明タイプは黙って無視
      return false;
  }
}
