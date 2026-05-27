/**
 * Service Worker (background) エントリ
 *
 * Manifest V3 対応。type: "module" で起動される前提。
 * - 起動時に RuntimeState を session ストレージから復元
 * - MessageRouter を初期化
 * - chrome.action.onClicked でオプションページを開く (Q8=A)
 * - chrome.runtime.onInstalled をハンドル (BR-21)
 *
 * 関連 FR: NFR-01, FR-09 (オプション開示)
 */

import * as RuntimeState from './sw/runtime_state.js';
import * as MessageRouter from './sw/message_router.js';

// 起動時の同期初期化
MessageRouter.init();

// 非同期で session 状態を復元 (BR-16)
RuntimeState.restoreFromSession().catch((e) => {
  console.warn('[WaitLess] restoreFromSession failed', e);
});

// ツールバーアイコンクリック → オプションページを開く (Q8=A)
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// インストール時のハンドラ (BR-21)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.info('[WaitLess] installed');
    // 必要なら初回案内のためにオプションページを開く (現在は自動開示なし、ユーザー操作待ち)
  } else if (details.reason === 'update') {
    console.info('[WaitLess] updated to version', chrome.runtime.getManifest().version);
  }
});
