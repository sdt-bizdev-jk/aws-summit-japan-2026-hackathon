/**
 * PlaybackTrigger (Content Script、娯楽タブに動的注入)
 *
 * 切替先タブで動画再生を試行する。サイト固有セレクタ -> 汎用 <video>.play() の順に試す。
 * 失敗は静かに許容 (BR-10, BR-11)。
 *
 * 関連 FR: FR-06 (動画再生試行)
 *
 * IIFE 即時実行
 */

(() => {
  'use strict';

  // サイト固有の再生ボタンセレクタ (主要サイト 2〜3 件、Q3=D)
  // 実機確認時に追加・修正想定
  const SITE_SELECTORS = [
    // YouTube (動画ページ)
    '.ytp-large-play-button',
    '.ytp-play-button[aria-label*="再生"]',
    '.ytp-play-button[aria-label*="Play"]',
    '.ytp-play-button',
    // Vimeo
    'button.vp-controls-play',
    'button[aria-label="Play"]',
    // ニコニコ動画
    '.MainVideoPlayer button[aria-label="再生"]',
  ];

  // リトライ設定 (要素が遅れて出現するサイト向け)
  const MAX_ATTEMPTS = 8;
  const RETRY_INTERVAL_MS = 500;

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function tryClickFirst(selectors) {
    for (const sel of selectors) {
      let el;
      try {
        el = document.querySelector(sel);
      } catch (_e) {
        continue;
      }
      if (el && isVisible(el)) {
        try {
          el.click();
          return true;
        } catch (_e) {
          // 黙って次へ
        }
      }
    }
    return false;
  }

  function tryPlayVideoElements() {
    const videos = document.querySelectorAll('video');
    for (const v of videos) {
      // 既に再生中のものはスキップ
      if (!v.paused && !v.ended) {
        return true;
      }
      try {
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => { /* オートプレイ拒否は黙って許容 (BR-11) */ });
        }
        return true;
      } catch (_e) {
        // 続行
      }
    }
    return false;
  }

  function attemptPlay() {
    if (tryClickFirst(SITE_SELECTORS)) return true;
    if (tryPlayVideoElements()) return true;
    return false;
  }

  // 試行順序 (BR-10):
  // 1. サイト固有セレクタをクリック
  // 2. 汎用 <video> 要素を play()
  // 3. 全て失敗したら何もしない
  // 即時試行 → 失敗ならリトライ (要素遅延出現対策)
  let attempts = 0;
  function loop() {
    attempts++;
    if (attemptPlay()) return;
    if (attempts >= MAX_ATTEMPTS) return;
    setTimeout(loop, RETRY_INTERVAL_MS);
  }
  loop();
})();
