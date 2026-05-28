# cycle-5 Application Design — Entertainment Portal Page

作成日: 2026-05-28
対応 Requirements: `aidlc-docs/inception/requirements/requirements.md`
Unit of Work: `portal-page` (単一 Unit)

---

## 1. 設計目標 (要件マッピング)

| 要件 | 設計上の対応 |
|---|---|
| FR-51〜56 (ポータル本体) | `extension/portal/portal.{html,css,js,_data.js}` の 4 ファイル構成 |
| FR-57 (Options 連携) | `options.html` の空状態案内に 1 行追加 + `options.js` の `injectPortalExampleUrl` 関数追加 |
| FR-58 (UI スタイル) | ダークテーマ (#0a0a0f 基調) + 独自アクセント (#7c3aed: 紫、AI 系の Calm な色) |
| FR-59 (静的データ) | `portal_data.js` で `window.PORTAL_DATA` を定義 |
| NFR-51, 52 (依存ゼロ + 絵文字代用) | 外部 CDN / 画像ファイル不使用、絵文字 (`<span>` テキスト) + CSS グラデで装飾 |
| NFR-54 (後方互換) | sw/* / content/* / reader/* / service_worker.js を一切触らない |

---

## 2. コンポーネント構成

```
extension/portal/
├── portal.html        ← エントリ HTML、CSS と JS を読み込む
├── portal.css         ← ダーク基調 + 独自アクセント (Netflix 風)
├── portal_data.js     ← window.PORTAL_DATA = [...] の静的データ
└── portal.js          ← レンダリング + クリックハンドラ
```

### 2.1 portal.html (DOM 骨格)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WaitLess Portal — 娯楽ポータル</title>
  <link rel="stylesheet" href="portal.css" />
</head>
<body>
  <header class="hero">
    <h1 class="hero-title">WaitLess Portal</h1>
    <p class="hero-subtitle">AI 待ちの時間、好きなものを 1 クリックで。</p>
  </header>
  <main id="genre-container">
    <!-- portal.js が動的生成 -->
  </main>
  <footer class="site-footer">
    <p>WaitLess Chrome Extension v0.5.0 · データは外部送信されません。</p>
  </footer>
  <script src="portal_data.js"></script>
  <script src="portal.js"></script>
</body>
</html>
```

### 2.2 portal_data.js (データスキーマ)

```js
// portal_data.js
window.PORTAL_DATA = [
  {
    genre: "動画視聴",
    emoji: "🎬",
    cards: [
      { name: "YouTube",            url: "https://www.youtube.com/",            emoji: "▶️" },
      { name: "Netflix",            url: "https://www.netflix.com/jp/",          emoji: "🎞️" },
      { name: "Amazon Prime Video", url: "https://www.amazon.co.jp/Prime-Video", emoji: "📺" },
      // ... 計 6 枚
    ],
  },
  // ... 12 ジャンル
];
```

**スキーマ**:
```
PORTAL_DATA: Array<GenreRow>
  GenreRow:
    genre: string       // 表示名 (例: "動画視聴")
    emoji: string       // ジャンルの代表絵文字
    cards: Array<Card>
      Card:
        name: string    // サイト名
        url:  string    // 遷移先 URL (http(s):// or chrome-extension://)
        emoji: string   // カードに表示する絵文字 (省略時は genre の emoji を継承)
```

### 2.3 portal.js (レンダリング)

擬似コード:

```js
(() => {
  "use strict";

  const data = window.PORTAL_DATA;
  if (!Array.isArray(data)) {
    console.error("[Portal] PORTAL_DATA が未定義です");
    return;
  }

  const container = document.getElementById("genre-container");
  const ALLOWED_PROTOCOLS = ["http:", "https:", "chrome-extension:"];

  function safeParseUrl(input) {
    try {
      const u = new URL(input);
      if (!ALLOWED_PROTOCOLS.includes(u.protocol)) return null;
      return u;
    } catch { return null; }
  }

  function buildCardElement(card, fallbackEmoji) {
    const u = safeParseUrl(card.url);
    if (!u) {
      console.warn("[Portal] invalid URL:", card.url);
      return null;
    }
    const a = document.createElement("a");
    a.className   = "card";
    a.href        = card.url;
    a.target      = "_self";
    a.rel         = "noopener noreferrer";
    a.dataset.url = card.url;

    const emoji = document.createElement("span");
    emoji.className = "card-emoji";
    emoji.textContent = card.emoji || fallbackEmoji || "🔗";

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = card.name;

    const host = document.createElement("span");
    host.className = "card-hostname";
    host.textContent = u.hostname;

    a.append(emoji, title, host);
    return a;
  }

  function buildGenreRow(genre) {
    const row = document.createElement("section");
    row.className = "genre-row";

    const h = document.createElement("h2");
    h.className = "genre-title";
    h.innerHTML = `<span class="genre-emoji">${genre.emoji}</span>${genre.genre}`;

    const strip = document.createElement("div");
    strip.className = "card-strip";
    for (const card of genre.cards) {
      const el = buildCardElement(card, genre.emoji);
      if (el) strip.appendChild(el);
    }

    row.append(h, strip);
    return row;
  }

  for (const genre of data) {
    container.appendChild(buildGenreRow(genre));
  }
})();
```

**ポイント**:
- ES Module ではない (`<script>` 直接読み込み)。理由: Reader Page と同じパターン、依存ゼロ
- URL バリデーション再実行 (BR-75)。`new URL()` パース失敗 + protocol チェック
- クリック挙動は `<a href>` のデフォルト動作 (`target="_self"` で同タブ遷移、FR-55)
- 失敗カードは `console.warn` のみで他のカードに影響を与えない (Robustness)

### 2.4 portal.css (スタイル方針)

| 要素 | 主なスタイル |
|---|---|
| `body` | `background: #0a0a0f; color: #f5f5f7; font-family: -apple-system, "Hiragino Sans", "Yu Gothic UI", sans-serif;` |
| `.hero` | グラデ背景 `linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #0a0a0f 100%)`、padding 大きめ |
| `.hero-title` | font-size 3rem、太字、white、文字影 |
| `.hero-subtitle` | font-size 1rem、color: #a78bfa (独自アクセント色の薄色) |
| `.genre-row` | margin-bottom 3rem |
| `.genre-title` | font-size 1.5rem、border-left 4px solid #7c3aed (独自アクセント色) |
| `.card-strip` | `display: flex; gap: 1rem; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 1rem;` |
| `.card` | flex: 0 0 200px、aspect-ratio 16/10、background gradient、border-radius 8px、scroll-snap-align start |
| `.card:hover` | transform: scale(1.05)、box-shadow 大、transition 0.2s |
| `.card-emoji` | font-size 3rem、ブロック中央配置 |
| `.card-title` | font-size 1rem、太字 |
| `.card-hostname` | font-size 0.75rem、color #888 |
| `.site-footer` | text-align center、padding、color #555 |
| `::-webkit-scrollbar` | width/height 8px、track #1a1a2e、thumb #7c3aed |

#### 独自アクセント色

| 役割 | 色 | 由来 |
|---|---|---|
| 背景 | `#0a0a0f` | より深い黒 (Netflix の `#141414` よりも紫寄り) |
| Hero グラデ | `#1a1a2e → #2d1b69 → #0a0a0f` | ダークパープル系 (AI 計算系の落ち着きを表現) |
| アクセント (primary) | `#7c3aed` | 紫 (Tailwind violet-600 相当)、Netflix の赤を避けて差別化 |
| アクセント (secondary) | `#a78bfa` | サブテキスト用 (violet-400) |
| カードグラデ (ベース) | `linear-gradient(135deg, #1f1f2e, #2d1b69)` | カードに奥行きを与える |

---

## 3. データフロー

```
[Chrome 起動 / ポータル URL アクセス]
  ↓
[portal.html ロード]
  ↓
[<script src="portal_data.js">]   ← window.PORTAL_DATA を定義
  ↓
[<script src="portal.js">]
  ├─ document.getElementById('genre-container')
  ├─ for each genre in PORTAL_DATA:
  │    └─ buildGenreRow → buildCardElement (×6)
  └─ container.appendChild
  ↓
[ユーザーがカードクリック]
  ↓
[<a href> のデフォルト動作で同タブ遷移]
```

**外部通信なし**。全てローカル静的ファイル。

---

## 4. Options Page との連携 (FR-57)

cycle-3 の Reader Page 統合と同パターン:

### 4.1 options.html の変更 (空状態案内)

cycle-3 で:
```html
<li>📖 読書 (内蔵): ...</li>
```
を追加した位置に、cycle-5 で:
```html
<li>🎬 娯楽ポータル (内蔵): カード一覧から好きな娯楽サイトへ 1 クリックで遷移</li>
```
を追加。

### 4.2 options.js の `injectPortalExampleUrl` 関数

cycle-3 の `injectReaderExampleUrl` を踏襲。`chrome.runtime.getURL('portal/portal.html')` で動的に URL を取得 → 空状態案内のリンクとして注入 + 「ワンクリック登録」ボタン。

```js
function injectPortalExampleUrl() {
  const url = chrome.runtime.getURL('portal/portal.html');
  const el  = document.querySelector('[data-portal-url-target]');
  if (el) el.textContent = url;
  // ボタン: クリック→ ADD_SITE メッセージで sites に登録
}
```

---

## 5. manifest.json 変更 (NFR-55)

cycle-3 で:
```json
"web_accessible_resources": [
  {
    "resources": ["reader/*"],
    "matches": ["<all_urls>"]
  }
]
```

cycle-5 で `portal/*` を追記:
```json
"web_accessible_resources": [
  {
    "resources": ["reader/*", "portal/*"],
    "matches": ["<all_urls>"]
  }
]
```

version: `0.4.0` → `0.5.0` (NFR-55)。

description (cycle-2 で更新済) は影響なし、`default_title` も影響なし。

---

## 6. 既存タブ探索戦略との整合

cycle-1 で確定した 2 パス探索戦略 (Architecture §9):

- ポータル URL `chrome-extension://[id]/portal/portal.html` は **完全一致 URL** なので Pass 1 でヒット
- ドメイン部分が `[id]` (32 文字英小数字) なので Pass 2 でも同じ拡張機能タブをヒットする
- 既にポータルタブを開いている状態で待ちが発生すると、Pass 1 で既存タブをアクティブ化のみ

Reader Page と全く同じヒット動作。

---

## 7. リスク評価

| リスク | 影響 | 対処 |
|---|---|---|
| 静的データの 60〜80 件メンテ性 | データ更新時に `portal_data.js` のみで完結 | NFR-59 で 1 ファイル運用を明文化 |
| ジャンルが偏る | UX 低下 | Application Design 段階で 12 ジャンルバランスを設計時に確認済 |
| URL が将来変わる (サイト側のドメイン変更等) | リンク切れ | cycle-5 のスコープ外 (backlog 候補)、リンク切れ検知は将来 |
| `<a target="_self">` で同タブ遷移するとブラウザの「戻る」で復帰できる前提 | OK | history API 操作は不要、デフォルト動作で十分 |
| カードが多すぎてスクロールが煩雑 | UX 低下 | ジャンル別に分けて 12 行に分散 → 1 行 6 カード ≤ 1 画面でほぼ収まる |

---

## 8. 実装順序 (Construction Phase で具体化)

1. `extension/portal/portal_data.js` — データ定義 (12 ジャンル × 6 カード = 72 カード)
2. `extension/portal/portal.html` — DOM 骨格
3. `extension/portal/portal.css` — ダーク基調 + Netflix 風スタイル
4. `extension/portal/portal.js` — レンダリングロジック
5. `extension/manifest.json` — `web_accessible_resources` 拡張 + version bump
6. `extension/options/options.html` — 空状態案内に 1 行追加
7. `extension/options/options.js` — `injectPortalExampleUrl` 追加
8. `extension/README.md` — Portal Page セクション追加
9. 動作確認 (Chrome 拡張リロード → URL 直叩き → 表示確認 → カードクリック)

---

## 9. ユニット境界 / Units Generation 判断

**単一 Unit (portal-page) として進める** (Units Generation はスキップ):
- 全コードが `extension/portal/` 配下に閉じる
- 既存 Unit (chrome-extension) への変更は manifest + options のみ
- 2 Unit に分けるオーバーヘッドが正当化できない

---

## 10. 関連ドキュメント

- Requirements: `aidlc-docs/inception/requirements/requirements.md`
- 既存 Architecture: `docs/architecture.md`
- cycle-3 Reader Page (類似パターン): `aidlc-docs-waitless-archive/cycle-3/inception/application-design/application-design.md`
