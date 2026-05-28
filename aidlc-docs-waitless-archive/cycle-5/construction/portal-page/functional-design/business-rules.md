# cycle-5 Functional Design — portal-page Business Rules

作成日: 2026-05-28
Unit: `portal-page`
対応 Requirements: BR-71〜76 (Requirements §5)

---

## BR-71. ポータルページ DOM 構造
- ルート: `<body>` → `<header.hero>` + `<main#genre-container>` + `<footer.site-footer>`
- ヘッダ: タイトル + サブタイトル (h1 + p)
- メイン: `.genre-row` を 10〜12 個 (script で動的生成)
- フッタ: バージョン情報 + プライバシー保証文言

## BR-72. ジャンル行構造
- `<section class="genre-row">`
- 内部に `<h2 class="genre-title">` (ジャンル絵文字 + 名前) と `<div class="card-strip">` (カード横並び)
- 各 genre-row は **1 行で 1 ジャンル**、上から下へジャンル順に並ぶ
- マージン: `margin-bottom: 3rem`

## BR-73. カード要素
- `<a class="card" href="${url}" target="_self" rel="noopener noreferrer">`
- 内部要素 (順序):
  1. `<span class="card-emoji">` — 絵文字 (デフォルト 3rem)
  2. `<span class="card-title">` — サイト名 (デフォルト 1rem 太字)
  3. `<span class="card-hostname">` — ホスト名 (デフォルト 0.75rem 灰)
- ホバー時: `transform: scale(1.05)` + box-shadow 強化 + transition 200ms
- focus 時もホバーと同じスタイル (キーボード操作可、NFR-57)

## BR-74. 横スクロール
- `.card-strip { overflow-x: auto; scroll-snap-type: x mandatory; }`
- `.card { scroll-snap-align: start; flex: 0 0 200px; aspect-ratio: 16/10; }`
- スクロールバーは細い表示 (`::-webkit-scrollbar`、`height: 8px`)
- マウスホイール水平スクロール: ブラウザのデフォルト挙動 (Shift+ホイール) を阻害しない

## BR-75. URL バリデーション
- カード生成時 (`buildCardElement`) に `new URL(card.url)` を実行
- protocol が `http:` / `https:` / `chrome-extension:` のいずれでもない場合は カードを生成せず、`console.warn` でログ出力 (BR-02 と同じ二重防御)
- 失敗カードは行に含まれない (他のカードに影響なし)

## BR-76. 履歴 / お気に入りなし
- cycle-5 では一切の状態を `chrome.storage.local` に書き込まない
- Reader Page の `reader_state` のような専用キーは追加しない
- ジャンル順 / カード順は `portal_data.js` の配列順 (常に同じ)

## BR-77. データロード方式
- `portal_data.js` を `portal.html` で `<script src="portal_data.js">` として読み込む
- `window.PORTAL_DATA` グローバル変数として注入される
- ES Module ではない (cycle-3 Reader Page と同じ方針、依存ゼロ)

## BR-78. 既存 Options Page 統合
- cycle-3 `injectReaderExampleUrl` と同じパターンで `injectPortalExampleUrl` を追加
- `chrome.runtime.getURL('portal/portal.html')` で実行時にフル URL を取得
- 空状態案内 (sites=0) のときのみ表示

## BR-79. manifest 変更最小化
- `web_accessible_resources.resources` 配列に portal 関連 4 ファイルを追加 (`portal/portal.html`, `portal/portal.css`, `portal/portal.js`, `portal/portal_data.js`)
- `matches` は既存と同じ `<all_urls>` を共有 (`resources` を 1 つのエントリにまとめる)
- version: 0.4.0 → 0.5.0
- description: 末尾に「娯楽ポータル (内蔵)」を追記

## BR-80. CSS 命名規則
- すべて `portal-` プレフィックス、もしくはセマンティックな名前 (`hero`, `card`, `genre-row` 等)
- `extension/options/options.css` や `extension/reader/reader.css` との名前衝突を避ける (どの CSS も独立した HTML のみで読まれるので物理的には衝突しないが、メンテナンス性向上のため)

---

## データスキーマ確定

```js
/**
 * @typedef {Object} PortalCard
 * @property {string} name      表示用サイト名 (例: "YouTube")
 * @property {string} url       完全URL (http(s):// or chrome-extension://)
 * @property {string} [emoji]   カードに表示する絵文字 (省略時はジャンル絵文字を継承)
 */

/**
 * @typedef {Object} PortalGenre
 * @property {string} genre     ジャンル名 (例: "動画視聴")
 * @property {string} emoji     ジャンルの代表絵文字 (例: "🎬")
 * @property {PortalCard[]} cards
 */

window.PORTAL_DATA: PortalGenre[]
```

---

## 12 ジャンル × 6 カード = 72 カードの確定リスト

| # | ジャンル | 絵文字 | カード 1 | カード 2 | カード 3 | カード 4 | カード 5 | カード 6 |
|---|---|---|---|---|---|---|---|---|
| 1 | 動画視聴 | 🎬 | YouTube | Netflix | Amazon Prime Video | Hulu | Disney+ | ABEMA |
| 2 | 音楽 | 🎵 | Spotify | YouTube Music | Apple Music | Amazon Music | SoundCloud | AWA |
| 3 | EC ショッピング | 🛒 | Amazon | 楽天市場 | Yahoo!ショッピング | ZOZOTOWN | メルカリ | ヨドバシ.com |
| 4 | ゲーム | 🎮 | Steam | Epic Games | Nintendo Store | PlayStation | itch.io | Yahoo!ゲーム |
| 5 | SNS | 💬 | X (Twitter) | Instagram | Facebook | TikTok | Reddit | Threads |
| 6 | ニュース | 📰 | Yahoo!ニュース | NHK ニュース | ITmedia | Bloomberg | Gizmodo Japan | GIGAZINE |
| 7 | 読書 | 📖 | Reader Page (内蔵) | Kindle Store | 青空文庫 | note | Zenn | カクヨム |
| 8 | 漫画 | 📚 | 少年ジャンプ+ | ピッコマ | LINE Manga | コミックシーモア | マガポケ | めちゃコミック |
| 9 | スポーツ | ⚽ | DAZN | スポナビ | NBA Japan | J.LEAGUE | 大相撲 | Number Web |
| 10 | 料理 | 🍳 | クックパッド | DELISH KITCHEN | kurashiru | Nadia | 楽天レシピ | E・レシピ |
| 11 | 旅行 | ✈️ | じゃらん | 楽天トラベル | Booking.com | Airbnb | トリップアドバイザー | Expedia |
| 12 | リラックス | 🧘 | YouTube ヨガ | Headspace | Calm | ストレッチ動画 | 焚き火動画 | 水族館ライブ |

URL は実装時に各サイトの公式トップを採用。Reader Page (内蔵) は `chrome.runtime.getURL('reader/reader.html')` で動的に組み立てる。
