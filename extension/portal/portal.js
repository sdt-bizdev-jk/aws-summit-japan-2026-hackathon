/**
 * WaitLess Portal Page (cycle-5)
 *
 * 役割:
 *   - window.PORTAL_DATA からジャンル行とカードを動的に生成する
 *   - URL バリデーション (BR-75)
 *   - クリックで <a href> のデフォルト挙動 = 同タブ遷移 (FR-55)
 *
 * 注意:
 *   - ES Module ではない (Reader Page と同じく <script> 直接読み込み)
 *   - chrome.runtime.getURL() が利用可能 (拡張機能ページ内で実行されるため)
 */

(() => {
  "use strict";

  const DEBUG = true;
  const log  = (...args) => DEBUG && console.log("[Portal]", ...args);
  const warn = (...args) => console.warn("[Portal]", ...args);

  const READER_PLACEHOLDER = "__READER_INTERNAL__";
  const ALLOWED_PROTOCOLS  = ["http:", "https:", "chrome-extension:"];

  // --------------------------------------------------------------------------
  // Bootstrap
  // --------------------------------------------------------------------------
  function bootstrap() {
    setupDashboardLink();

    const container = document.getElementById("genre-container");
    const loading   = document.getElementById("loading-message");

    if (!container) {
      warn("genre-container が見つかりません");
      return;
    }

    const data = window.PORTAL_DATA;
    if (!Array.isArray(data) || data.length === 0) {
      warn("PORTAL_DATA が未定義 / 空です");
      if (loading) loading.textContent = "データの読み込みに失敗しました。";
      return;
    }

    const fragment = document.createDocumentFragment();
    let renderedCardCount = 0;

    for (const genre of data) {
      const row = buildGenreRow(genre);
      if (row) {
        fragment.appendChild(row);
        renderedCardCount += row.dataset.cardCount ? Number(row.dataset.cardCount) : 0;
      }
    }

    // ローディング要素を削除してフラグメントを差し込む
    if (loading) loading.remove();
    container.appendChild(fragment);

    log(`render complete: ${data.length} genres / ${renderedCardCount} cards`);
  }

  // --------------------------------------------------------------------------
  // ダッシュボードへの動線 (cycle-6, FR-84)
  //   chrome.runtime.getURL("dashboard/dashboard.html") を href に注入
  // --------------------------------------------------------------------------
  function setupDashboardLink() {
    const link = document.getElementById("nav-dashboard");
    if (!link) return;
    try {
      if (chrome && chrome.runtime && chrome.runtime.getURL) {
        link.href = chrome.runtime.getURL("dashboard/dashboard.html");
      }
    } catch (e) {
      warn("dashboard リンクの解決に失敗:", e);
    }
  }

  // --------------------------------------------------------------------------
  // ジャンル行構築 (BR-72)
  // --------------------------------------------------------------------------
  function buildGenreRow(genre) {
    if (!genre || typeof genre !== "object") return null;
    if (!Array.isArray(genre.cards)) return null;

    const row = document.createElement("section");
    row.className = "genre-row";

    const heading = document.createElement("h2");
    heading.className = "genre-title";

    const emojiSpan = document.createElement("span");
    emojiSpan.className = "genre-emoji";
    emojiSpan.textContent = genre.emoji || "📁";

    const nameNode = document.createTextNode(genre.genre || "(無題)");

    heading.appendChild(emojiSpan);
    heading.appendChild(nameNode);

    const strip = document.createElement("div");
    strip.className = "card-strip";

    let cardCount = 0;
    for (const card of genre.cards) {
      const a = buildCardElement(card, genre.emoji);
      if (a) {
        strip.appendChild(a);
        cardCount += 1;
      }
    }

    row.appendChild(heading);
    row.appendChild(strip);
    row.dataset.cardCount = String(cardCount);
    return row;
  }

  // --------------------------------------------------------------------------
  // カード構築 (BR-73, BR-75)
  // --------------------------------------------------------------------------
  function buildCardElement(card, fallbackEmoji) {
    if (!card || typeof card !== "object") return null;
    if (typeof card.url !== "string" || card.url.length === 0) return null;

    // 内蔵 URL プレースホルダの解決 (Reader Page など)
    const resolvedUrl = resolveInternalUrl(card.url);
    if (!resolvedUrl) {
      warn("internal URL の解決に失敗:", card.url, "name:", card.name);
      return null;
    }

    // URL バリデーション (BR-75、二重防御)
    const u = safeParseUrl(resolvedUrl);
    if (!u) {
      warn("invalid URL:", resolvedUrl, "name:", card.name);
      return null;
    }

    const a = document.createElement("a");
    a.className   = "card";
    a.href        = resolvedUrl;
    a.target      = "_self";
    a.rel         = "noopener noreferrer";
    a.dataset.url = resolvedUrl;
    a.setAttribute("aria-label", `${card.name || "(無題)"} (${u.hostname})`);

    const emojiSpan = document.createElement("span");
    emojiSpan.className   = "card-emoji";
    emojiSpan.textContent = card.emoji || fallbackEmoji || "🔗";

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const titleSpan = document.createElement("span");
    titleSpan.className   = "card-title";
    titleSpan.textContent = card.name || "(無題)";

    const hostSpan = document.createElement("span");
    hostSpan.className   = "card-hostname";
    hostSpan.textContent = u.hostname;

    meta.appendChild(titleSpan);
    meta.appendChild(hostSpan);

    a.appendChild(emojiSpan);
    a.appendChild(meta);

    return a;
  }

  // --------------------------------------------------------------------------
  // 内蔵 URL プレースホルダ解決
  //   __READER_INTERNAL__ → chrome.runtime.getURL("reader/reader.html")
  // --------------------------------------------------------------------------
  function resolveInternalUrl(input) {
    if (input === READER_PLACEHOLDER) {
      try {
        if (chrome && chrome.runtime && chrome.runtime.getURL) {
          return chrome.runtime.getURL("reader/reader.html");
        }
      } catch (e) {
        warn("chrome.runtime.getURL 失敗:", e);
      }
      return null;
    }
    return input;
  }

  // --------------------------------------------------------------------------
  // URL バリデーション (BR-02 / BR-75 と同等)
  // --------------------------------------------------------------------------
  function safeParseUrl(input) {
    try {
      const u = new URL(input);
      if (!ALLOWED_PROTOCOLS.includes(u.protocol)) return null;
      return u;
    } catch (_e) {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // DOM Ready
  // --------------------------------------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
