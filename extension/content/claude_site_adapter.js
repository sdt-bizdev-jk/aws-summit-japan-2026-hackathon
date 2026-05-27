/**
 * ClaudeSiteAdapter (Content Script、Claude.ai タブに静的注入)
 *
 * Claude.ai の DOM を MutationObserver で監視し、停止ボタンの存在を
 * シグナルとしてストリーミング状態を判定する。N秒以上 続いたら
 * Service Worker に WAIT_DETECTED を送信。完了 (停止ボタン消失) を
 * 検知したら、待ち発生サイクル中なら COMPLETION_DETECTED を送信。
 *
 * 関連 FR: FR-01, FR-02, FR-03, FR-07
 * 関連ルール: BR-19 (storage.onChanged で threshold 即時反映)
 *
 * IIFE 形式 (Content Script は ES Modules 非対応)
 */

(() => {
  'use strict';

  // ----- 定数 -----
  const DEFAULT_THRESHOLD_SEC = 5;
  // 停止ボタン候補セレクタ (属性ベース優先、Q2=C+D)
  // Claude.ai は送信直後に「メッセージを送信」ボタンが「停止」ボタンに置き換わる挙動。
  // 日本語UIを最優先、英語UIをフォールバック。
  const STOP_BUTTON_SELECTORS = [
    'button[aria-label="停止"]',
    'button[aria-label="応答を停止"]',
    'button[aria-label="応答の停止"]',
    'button[aria-label="Stop"]',
    'button[aria-label="Stop response"]',
    'button[data-testid="stop-button"]',
  ];
  const STOP_BUTTON_TEXT_FALLBACK = ['Stop response', 'Stop', '応答を停止', '停止する', '停止'];

  // 診断ログを有効化したい場合は true に (実機セレクタ調整に便利)
  const DEBUG = true;
  function debugLog(...args) {
    if (DEBUG) console.log('[WaitLess]', ...args);
  }

  // ----- 状態 -----
  /** @type {'IDLE' | 'STREAMING' | 'WAITING'} */
  let state = 'IDLE';
  let waitTimerId = null;
  let thresholdSec = DEFAULT_THRESHOLD_SEC;

  /**
   * 停止ボタンの存在を判定 (Q1=A, Q2=C+D)
   * 属性セレクタ -> テキストフォールバックの順
   */
  function detectStreamingState() {
    // 1) 属性ベース
    for (const sel of STOP_BUTTON_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) {
        return 'streaming';
      }
    }
    // 2) テキストフォールバック (button 要素のテキスト/タイトル/aria-label を見る)
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      const text = (b.textContent || '').trim();
      const title = b.getAttribute('title') || '';
      const aria = b.getAttribute('aria-label') || '';
      const haystack = `${text}\n${title}\n${aria}`;
      for (const needle of STOP_BUTTON_TEXT_FALLBACK) {
        if (haystack.includes(needle) && isVisible(b)) {
          return 'streaming';
        }
      }
    }
    return 'idle';
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function startWaitTimer() {
    cancelWaitTimer();
    debugLog(`STREAMING start. waiting ${thresholdSec}s before WAIT_DETECTED`);
    waitTimerId = setTimeout(() => {
      // N秒経過、ストリーミング継続中なら WAITING へ遷移して送信
      if (state === 'STREAMING') {
        state = 'WAITING';
        debugLog(`WAIT_DETECTED sent (${thresholdSec}s elapsed)`);
        sendMessage('WAIT_DETECTED', {
          claudeTabId: null, // SW で sender.tab.id を使う
          durationMs: thresholdSec * 1000,
        });
      }
      waitTimerId = null;
    }, thresholdSec * 1000);
  }

  function cancelWaitTimer() {
    if (waitTimerId != null) {
      clearTimeout(waitTimerId);
      waitTimerId = null;
    }
  }

  /**
   * Service Worker への送信 (一方向)
   * 拡張機能更新時の "Extension context invalidated" は Chrome の仕様。
   * その場合は以降の送信を抑止し、警告は一度だけに留める。
   */
  let contextInvalidated = false;
  function sendMessage(type, payload) {
    if (contextInvalidated) return;
    // chrome.runtime.id にアクセスできない時はコンテキスト無効
    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        markInvalidated();
        return;
      }
    } catch (_e) {
      markInvalidated();
      return;
    }

    try {
      chrome.runtime.sendMessage({ type, payload }, () => {
        const err = chrome.runtime.lastError;
        if (err && /context invalidated/i.test(err.message || '')) {
          markInvalidated();
        }
      });
    } catch (e) {
      if (/context invalidated/i.test(String(e))) {
        markInvalidated();
      } else {
        console.warn('[WaitLess] sendMessage failed', type, e);
      }
    }
  }

  function markInvalidated() {
    if (contextInvalidated) return;
    contextInvalidated = true;
    debugLog('extension context invalidated; reload this tab to resume.');
    cancelWaitTimer();
  }

  /**
   * DOM 変化のたびに呼ばれる。
   * 直前の state と現在の検知結果からステートマシン遷移を行う。
   */
  function onDomMutation() {
    const detected = detectStreamingState();
    const isStreaming = detected === 'streaming';

    if (isStreaming && state === 'IDLE') {
      state = 'STREAMING';
      startWaitTimer();
    } else if (!isStreaming && state === 'STREAMING') {
      // 短い応答 (N秒未満で完了) → タイマー破棄、何も送らない
      cancelWaitTimer();
      debugLog('streaming finished before threshold; no WAIT sent');
      state = 'IDLE';
    } else if (!isStreaming && state === 'WAITING') {
      // 完了検知
      debugLog('COMPLETION_DETECTED sent');
      sendMessage('COMPLETION_DETECTED', { claudeTabId: null });
      state = 'IDLE';
    }
    // それ以外 (state==STREAMING and isStreaming==true) はタイマー継続中
    // それ以外 (state==WAITING and isStreaming==true) はまだ続いている
  }

  /**
   * 起動時にしきい値をロードし、変化を監視する (BR-19)
   */
  function loadAndWatchThreshold() {
    try {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err && /context invalidated/i.test(err.message || '')) {
          markInvalidated();
          return;
        }
        if (resp && Number.isInteger(resp.thresholdSec)) {
          thresholdSec = resp.thresholdSec;
        }
      });
    } catch (e) {
      if (/context invalidated/i.test(String(e))) markInvalidated();
    }

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.threshold_sec) {
          const next = changes.threshold_sec.newValue;
          if (Number.isInteger(next)) {
            thresholdSec = next;
          }
        }
      });
    } catch (e) {
      if (/context invalidated/i.test(String(e))) markInvalidated();
    }
  }

  /**
   * エントリ
   */
  function init() {
    debugLog('init()');
    loadAndWatchThreshold();

    // MutationObserver で DOM 監視 (NFR-05: 影響最小化のため属性変化と subtree のみ)
    const observer = new MutationObserver(() => {
      // 連続変化のため、シングルマイクロタスクでまとめて処理
      onDomMutation();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'disabled', 'class'],
    });

    // 初回判定
    onDomMutation();
  }

  // document.body が出来てから観察開始
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();
