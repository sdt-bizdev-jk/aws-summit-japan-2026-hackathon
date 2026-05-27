/**
 * Reader Page (ReaderApp)
 *
 * 拡張機能内蔵の読書ページ。組み込み小説テキスト (novel.txt) を表示し、
 * クリックで既読範囲を青色化、スクロール位置とクリック位置を
 * chrome.storage.local の `reader_state` キーに永続化する。
 *
 * 関連 FR: FR-31〜38
 * 関連 BR: BR-31, 32, 33, 34, 35, 36, 37
 */

(() => {
  'use strict';

  // ========================================================================
  // 定数
  // ========================================================================
  const STORAGE_KEY = 'reader_state';
  const NOVEL_PATH = 'reader/novel.txt';
  const NOVEL_ID = 'default';

  const INITIAL_STATE = {
    readOffset: 0,
    scrollY: 0,
    novelId: NOVEL_ID,
    updatedAt: 0,
  };

  // ========================================================================
  // ReaderApp
  // ========================================================================
  const ReaderApp = {
    state: { ...INITIAL_STATE },
    totalChars: 0, // 改行含む全文文字数

    // ----------------------------------------------------------------------
    // 起動シーケンス (FR-31, FR-36, BR-33)
    // ----------------------------------------------------------------------
    async init() {
      const content = await ReaderApp.loadNovel();
      if (content == null) {
        ReaderApp.renderError('テキストを読み込めませんでした');
        return;
      }

      const saved = await ReaderApp.loadState();
      ReaderApp.state = saved;

      const paragraphs = ReaderApp.splitIntoParagraphs(content);
      ReaderApp.totalChars = ReaderApp.computeTotalChars(paragraphs);

      // クリッピング: 読み込んだ readOffset が現在の totalChars を超えていたらクランプ (BR-37)
      ReaderApp.state.readOffset = Math.max(
        0, Math.min(ReaderApp.totalChars, ReaderApp.state.readOffset)
      );

      ReaderApp.renderText(paragraphs);

      // BR-33: 青色化 → スクロールの順
      ReaderApp.applyReadProgress(ReaderApp.state.readOffset);

      // requestAnimationFrame で次フレームに scrollTo (レイアウト確定後)
      requestAnimationFrame(() => {
        window.scrollTo({ top: ReaderApp.state.scrollY, behavior: 'auto' });
      });

      ReaderApp.bindEventListeners();
    },

    // ----------------------------------------------------------------------
    // テキストロード (FR-31)
    // ----------------------------------------------------------------------
    async loadNovel() {
      try {
        const url = chrome.runtime.getURL(NOVEL_PATH);
        const res = await fetch(url);
        if (!res.ok) {
          console.warn('[WaitLess Reader] novel fetch failed', res.status);
          return null;
        }
        return await res.text();
      } catch (e) {
        console.warn('[WaitLess Reader] loadNovel error', e);
        return null;
      }
    },

    // ----------------------------------------------------------------------
    // 段落分割 (BR-32 改行 1 文字カウント)
    // ----------------------------------------------------------------------
    splitIntoParagraphs(content) {
      // 空行で分割し、空文字を除外
      return content
        .split(/\r?\n\s*\r?\n/)
        .map((s) => s.replace(/\r?\n/g, '')) // 段落内の改行は単一行に正規化
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    },

    /**
     * 全段落の累積文字数 (各段落間に改行 1 文字を加算)
     */
    computeTotalChars(paragraphs) {
      let total = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        total += paragraphs[i].length;
        if (i < paragraphs.length - 1) total += 1; // 段落区切り 1 文字
      }
      return total;
    },

    // ----------------------------------------------------------------------
    // DOM レンダリング
    // ----------------------------------------------------------------------
    renderText(paragraphs) {
      const container = document.getElementById('reader-content');
      if (!container) return;
      container.innerHTML = '';

      let cumOffset = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        const text = paragraphs[i];
        const p = document.createElement('p');
        p.className = 'paragraph';
        p.dataset.start = String(cumOffset);
        p.dataset.length = String(text.length);
        p.textContent = text;
        container.appendChild(p);
        cumOffset += text.length;
        if (i < paragraphs.length - 1) cumOffset += 1; // 段落区切り
      }
    },

    renderError(message) {
      const container = document.getElementById('reader-content');
      if (!container) return;
      container.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'reader-error';
      div.dataset.testid = 'reader-error';
      div.textContent = message;
      container.appendChild(div);
    },

    // ----------------------------------------------------------------------
    // 既読範囲の青色化 (BR-31, BR-37)
    // ----------------------------------------------------------------------
    applyReadProgress(offset) {
      const clamped = Math.max(0, Math.min(ReaderApp.totalChars, offset));
      const paragraphs = document.querySelectorAll('#reader-content .paragraph');
      paragraphs.forEach((p) => {
        const start = parseInt(p.dataset.start, 10) || 0;
        const length = parseInt(p.dataset.length, 10) || 0;
        const end = start + length;

        if (clamped <= start) {
          ReaderApp.setParagraphAsUnread(p);
        } else if (clamped >= end) {
          ReaderApp.setParagraphAsRead(p);
        } else {
          ReaderApp.splitParagraph(p, clamped - start);
        }
      });
    },

    setParagraphAsUnread(p) {
      const text = p.textContent || '';
      p.innerHTML = '';
      p.textContent = text;
    },

    setParagraphAsRead(p) {
      const text = p.textContent || '';
      p.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'read';
      span.textContent = text;
      p.appendChild(span);
    },

    splitParagraph(p, inParaOffset) {
      const text = p.textContent || '';
      const readPart = text.slice(0, inParaOffset);
      const unreadPart = text.slice(inParaOffset);
      p.innerHTML = '';
      const readSpan = document.createElement('span');
      readSpan.className = 'read';
      readSpan.textContent = readPart;
      p.appendChild(readSpan);
      if (unreadPart.length > 0) {
        p.appendChild(document.createTextNode(unreadPart));
      }
    },

    // ----------------------------------------------------------------------
    // クリックハンドラ (BR-31, BR-36)
    // ----------------------------------------------------------------------
    onTextClick(event) {
      // BR-36: クリック対象が .paragraph 内のテキストか確認
      const target = event.target;
      if (!(target instanceof Element)) return;
      const paragraph = target.closest('.paragraph');
      if (!paragraph) return;

      const offset = ReaderApp.clickPointToCharOffset(event.clientX, event.clientY);
      if (offset < 0) return;

      const clamped = Math.max(0, Math.min(ReaderApp.totalChars, offset));

      // BR-31: 双方向クリック (絶対上書き)
      ReaderApp.state.readOffset = clamped;
      ReaderApp.applyReadProgress(clamped);

      // BR-34: クリック時に即時保存
      ReaderApp.saveState({
        readOffset: clamped,
        scrollY: Math.round(window.scrollY),
      });
    },

    /**
     * クリック座標 → ページ先頭からの累積文字オフセット変換 (BR-31)
     * Q2=A: caretRangeFromPoint を使用
     */
    clickPointToCharOffset(clientX, clientY) {
      try {
        const range = document.caretRangeFromPoint(clientX, clientY);
        if (!range) return -1;
        const container = range.startContainer;

        // クリックされたノードからの段落要素探索
        let paragraph = null;
        if (container.nodeType === Node.TEXT_NODE) {
          paragraph = container.parentElement
            ? container.parentElement.closest('.paragraph')
            : null;
        } else if (container instanceof Element) {
          paragraph = container.closest('.paragraph');
        }
        if (!paragraph) return -1;

        const start = parseInt(paragraph.dataset.start, 10) || 0;

        // テキストノードがクリックされた場合: 段落内オフセットを TreeWalker で計算
        if (container.nodeType === Node.TEXT_NODE) {
          const inParaOffset = ReaderApp.calcInParaOffset(
            paragraph,
            container,
            range.startOffset
          );
          return start + inParaOffset;
        }

        // 段落要素自体がクリックされた (テキスト外余白等) 場合は段落の先頭にスナップ
        return start;
      } catch (e) {
        console.warn('[WaitLess Reader] clickPointToCharOffset error', e);
        return -1;
      }
    },

    /**
     * 段落内のテキストノードを順に走査し、ターゲットに到達するまでの累積文字数を返す
     */
    calcInParaOffset(paragraph, targetNode, charOffsetInTarget) {
      const walker = document.createTreeWalker(
        paragraph,
        NodeFilter.SHOW_TEXT
      );
      let cumOffset = 0;
      let node = walker.nextNode();
      while (node) {
        if (node === targetNode) {
          return cumOffset + charOffsetInTarget;
        }
        cumOffset += node.nodeValue ? node.nodeValue.length : 0;
        node = walker.nextNode();
      }
      // フォールバック (理論上ここには来ない)
      return cumOffset;
    },

    // ----------------------------------------------------------------------
    // 永続化 (BR-32, BR-34, BR-35)
    // ----------------------------------------------------------------------
    async saveState({ readOffset, scrollY }) {
      const snapshot = {
        read_offset: Math.max(0, Math.min(ReaderApp.totalChars, readOffset || 0)),
        scroll_y: Math.max(0, Math.round(scrollY || 0)),
        novel_id: NOVEL_ID,
        updated_at: Date.now(),
      };
      try {
        await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
      } catch (e) {
        // BR-35: 保存失敗は黙って許容
        console.warn('[WaitLess Reader] saveState failed', e);
      }
    },

    /**
     * 離脱検知時の同期発火 (await しない、Promise を捨てる)
     * BR-34: 離脱時の scrollY 保存
     */
    savePartial({ scrollY }) {
      const snapshot = {
        read_offset: Math.max(
          0,
          Math.min(ReaderApp.totalChars, ReaderApp.state.readOffset || 0)
        ),
        scroll_y: Math.max(0, Math.round(scrollY || 0)),
        novel_id: NOVEL_ID,
        updated_at: Date.now(),
      };
      try {
        // Promise を捨てて同期的に発火
        chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
      } catch (e) {
        // BR-35
        console.warn('[WaitLess Reader] savePartial failed', e);
      }
    },

    async loadState() {
      try {
        const raw = await chrome.storage.local.get(STORAGE_KEY);
        const s = raw[STORAGE_KEY];
        if (s && ReaderApp.isValidSnapshot(s)) {
          return {
            readOffset: Math.max(0, s.read_offset),
            scrollY: Math.max(0, s.scroll_y),
            novelId: s.novel_id || NOVEL_ID,
            updatedAt: s.updated_at || 0,
          };
        }
      } catch (e) {
        console.warn('[WaitLess Reader] loadState failed', e);
      }
      return { ...INITIAL_STATE };
    },

    isValidSnapshot(s) {
      return (
        typeof s === 'object'
        && s !== null
        && typeof s.read_offset === 'number'
        && typeof s.scroll_y === 'number'
        && Number.isFinite(s.read_offset)
        && Number.isFinite(s.scroll_y)
      );
    },

    // ----------------------------------------------------------------------
    // イベントリスナ (BR-34, BR-36)
    // ----------------------------------------------------------------------
    bindEventListeners() {
      const content = document.getElementById('reader-content');
      if (content) {
        content.addEventListener('click', (ev) => ReaderApp.onTextClick(ev));
      }

      // 離脱検知 (BR-34)
      window.addEventListener('pagehide', () => {
        ReaderApp.savePartial({ scrollY: window.scrollY });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          ReaderApp.savePartial({ scrollY: window.scrollY });
        }
      });
    },
  };

  // ========================================================================
  // Bootstrap
  // ========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ReaderApp.init());
  } else {
    ReaderApp.init();
  }
})();
