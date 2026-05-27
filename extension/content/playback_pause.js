/**
 * PlaybackPause (Content Script、娯楽タブに動的注入)
 *
 * Claude.ai の応答完了で娯楽タブから AI タブへ戻る前に、娯楽タブの動画を一時停止する。
 * 次に同じタブが切替先になった時に、PlaybackTrigger の play() で続きから再開できる。
 *
 * 関連 FR: FR-08 (戻り時の補助動作)
 *
 * IIFE 即時実行
 */

(() => {
  'use strict';

  // サイト固有の一時停止ボタン候補 (再生ボタンと同じ要素が状態切替えるサイトが多いが、
  // 念のため "Pause" ラベル系も入れる)
  const PAUSE_SELECTORS = [
    // YouTube
    '.ytp-play-button[aria-label*="一時停止"]',
    '.ytp-play-button[aria-label*="Pause"]',
    // Vimeo
    'button.vp-controls-pause',
  ];

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function pauseVideoElements() {
    const videos = document.querySelectorAll('video');
    let paused = false;
    for (const v of videos) {
      try {
        if (!v.paused && !v.ended) {
          v.pause();
          paused = true;
        }
      } catch (_e) { /* 黙って続行 */ }
    }
    return paused;
  }

  function tryClickPauseButton() {
    for (const sel of PAUSE_SELECTORS) {
      let el;
      try { el = document.querySelector(sel); } catch (_e) { continue; }
      if (el && isVisible(el)) {
        try { el.click(); return true; } catch (_e) {}
      }
    }
    return false;
  }

  // 試行順序:
  // 1. 汎用 <video>.pause() (全 videos に対応)
  // 2. サイト固有の一時停止ボタン
  // 失敗してもユーザー体験は止めない
  if (!pauseVideoElements()) {
    tryClickPauseButton();
  }
})();
