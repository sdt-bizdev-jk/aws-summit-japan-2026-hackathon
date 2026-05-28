# cycle-5 Requirements — Entertainment Portal Page

作成日: 2026-05-28
深度: Standard
スコープ: Chrome 拡張機能内蔵の娯楽ポータルページ (Netflix 風 UI)

---

## 1. 背景 / Why

cycle-1〜4 で完成した WaitLess は、AI 待ち時間発生時に **事前登録した URL** へ自動遷移する。しかし:

- ユーザーは「待ち時間に何を見るか」を毎回事前に登録する必要がある
- 登録した URL 1 つだけに固定されると気分や状況で変えにくい
- 「気分転換」自体が目的のとき、選択の自由度が低い

そこで **遷移先として開かれるための娯楽ポータルページ** を Chrome 拡張機能内に内蔵する。ユーザーは AI 待ち時間に Netflix 風のカード一覧から好きな娯楽サイトを 1 クリックで選べる。

cycle-3 で導入した内蔵 Reader Page と同じ位置付け = **拡張機能内蔵の遷移先コンテンツ** の第二弾。

---

## 2. ゴール (FR)

| ID | 要件 | 優先度 |
|---|---|---|
| **FR-51** | Chrome 拡張内蔵のポータルページ (`portal/portal.html`) を新規追加する | High |
| **FR-52** | ポータルページは Netflix 風カードグリッドで、ジャンル別に水平スクロール可能な行で複数カードを表示する | High |
| **FR-53** | ジャンルは **10〜12 種類**、各ジャンルあたり **5〜8 カード**、合計 **60〜80 枚** のカードを表示する | High |
| **FR-54** | カードには (a) サイトの絵文字/シンボル、(b) サイト名、(c) サイト URL / カテゴリラベル を表示する | High |
| **FR-55** | カードをクリックすると **同タブで** その URL に遷移する (`window.location.href = url`) | High |
| **FR-56** | ポータルページ自体の URL は `chrome-extension://[id]/portal/portal.html` で、`manifest.json` の `web_accessible_resources` に追加する | High |
| **FR-57** | ポータルページの URL を Chrome 拡張 Options Page の空状態案内に追加する (Reader Page と同様、サンプル URL 注入機能を使う) | Medium |
| **FR-58** | UI は Netflix 風レイアウトを踏襲しつつ、AI WaitLess の独自アクセント色 (ダーク基調 + 独自色) を用いる | Medium |
| **FR-59** | カード一覧データはコード内 (JS 配列、`portal_data.js` 等) に静的定義する。外部 API は使わない | High |
| **FR-60** | レスポンシブ最低限: 横幅 1280px / 1024px / 768px で破綻しないこと | Medium |

---

## 3. ジャンルとカード候補 (案、Application Design で確定)

**12 ジャンル × 各 6 カード = 72 カード** を想定 (FR-53 の中央値)。

| # | ジャンル | カテゴリ絵文字 | カード候補 (6 枚) |
|---|---|---|---|
| 1 | 動画視聴 | 🎬 | YouTube / Netflix / Amazon Prime Video / Hulu / Disney+ / ABEMA |
| 2 | 音楽 | 🎵 | Spotify / YouTube Music / Apple Music / Amazon Music / SoundCloud / AWA |
| 3 | EC | 🛒 | Amazon / 楽天市場 / Yahoo!ショッピング / ZOZOTOWN / メルカリ / ヨドバシ.com |
| 4 | ゲーム | 🎮 | Steam / Epic Games / Nintendo Store / PlayStation Store / itch.io / Yahoo!ゲーム |
| 5 | SNS | 💬 | X (Twitter) / Instagram / Facebook / TikTok / Reddit / Threads |
| 6 | ニュース | 📰 | Yahoo!ニュース / NHK ニュース / ITmedia / Bloomberg / Gizmodo Japan / GIGAZINE |
| 7 | 読書 | 📖 | Reader Page (内蔵) / Kindle 本ストア / 青空文庫 / note / Zenn / カクヨム |
| 8 | 漫画 | 📚 | 少年ジャンプ+ / ピッコマ / LINE Manga / コミックシーモア / マガポケ / めちゃコミック |
| 9 | スポーツ | ⚽ | DAZN / スポナビ / NBA Japan / J.LEAGUE / 大相撲 / Number Web |
| 10 | 料理 | 🍳 | クックパッド / DELISH KITCHEN / kurashiru / Nadia / 楽天レシピ / シェフごはん |
| 11 | 旅行 | ✈️ | じゃらん / 楽天トラベル / Booking.com / Airbnb / トリップアドバイザー / Expedia |
| 12 | リラックス | 🧘 | YouTube ヨガ検索 / Headspace / Calm / VR Chat / ストレッチ動画検索 / 焚き火動画 |

カードの具体的な URL は Application Design 段階で確定する (公式トップ URL を基本とする)。

---

## 4. 非機能要件 (NFR)

| ID | 要件 | 優先度 |
|---|---|---|
| **NFR-51** | 外部 CDN / 外部 JS / 外部 CSS / 外部画像を使わない (オフラインでも完全に動作)。Cycle-1 NFR-09 (外部依存禁止) を継承 | High |
| **NFR-52** | 画像はサムネイル PNG/JPG を含めず、**絵文字 + CSS のみ** で表現する (バンドルサイズ最小化、cycle-3 と同方針) | High |
| **NFR-53** | ページ読み込み完了まで 500ms 以内 (ローカル静的ファイル、依存ゼロのため余裕で達成) | Medium |
| **NFR-54** | 既存 cycle-1〜4 のコード (`extension/sw/*`, `extension/content/*`, `extension/options/*`, `extension/reader/*`, `extension/service_worker.js`) は **完全無変更** にする。cycle-3 と同方針 (後方互換性) | High |
| **NFR-55** | 既存 `extension/manifest.json` への変更は **最小** (`web_accessible_resources` の追記のみ)。version は `0.4.0` → `0.5.0` に bump | High |
| **NFR-56** | 既存 `extension/options/options.{html,js}` への変更は **空状態案内テキスト + サンプル URL 注入** のみ。core ロジックは無変更 | High |
| **NFR-57** | アクセシビリティ: カードは `<a href="...">` ベースで、キーボード操作 (Tab / Enter) で遷移可能 | Medium |
| **NFR-58** | ダークテーマ前提 (システムテーマ追従はしない、固定ダーク) | Low |
| **NFR-59** | カードデータの追加 / 削除 / 並び替えは `portal_data.js` 1 ファイルの編集で完結する | Medium |

---

## 5. ビジネスルール (BR) — Application Design で精緻化

### BR-71. ポータルページ構造
- DOM 構造: `<header>` (タイトル + サブタイトル) + `<main>` (`.genre-row` を 10〜12 個) + `<footer>` (ナビリンク + 著作権)
- 各 `.genre-row` は `.genre-title` (ジャンル名 + 絵文字) と `.card-strip` (横スクロール可能なカードコンテナ) を持つ

### BR-72. カード要素
- `<a class="card" href="${url}">` で1枚を構成
- 構造: `.card-emoji` (絵文字)、`.card-title` (サイト名)、`.card-hostname` (ドメイン)
- ホバーで 1.05x 拡大 + 影 (CSS transition)

### BR-73. 横スクロール挙動
- `overflow-x: auto`, `scroll-snap-type: x mandatory`, カードに `scroll-snap-align: start`
- スクロールバーは細く表示 (`::-webkit-scrollbar`)、マウスホイール水平スクロール対応

### BR-74. データソース
- `portal_data.js` に `window.PORTAL_DATA` グローバル配列で定義 (ES Module ではない、`<script>` で読み込み)
- スキーマ: `{ genre: string, emoji: string, cards: Array<{ name, url, hostname?, emoji? }> }`

### BR-75. URL バリデーション
- カードクリック時、URL が `http:` / `https:` / `chrome-extension:` のいずれかであることを `new URL` で再検証してから遷移 (BR-02 と同様)
- 不正な URL の場合は `console.warn` でログのみ (リンクが押された痕跡を残す)

### BR-76. 既読 / 履歴の永続化
- **cycle-5 では履歴/お気に入りなし** (将来 backlog)。状態を `chrome.storage.local` に書き込まない (Reader Page の `reader_state` のような専用キーは追加しない)

---

## 6. 制約 / アンチスコープ

| ID | 内容 |
|---|---|
| AS-51 | サムネイル画像 (PNG/JPG) は含めない (NFR-52) |
| AS-52 | カードのお気に入り機能 / 履歴 / 並び替え UI は cycle-5 のスコープ外 (backlog に記載) |
| AS-53 | サイトの API を叩いてリアルタイム情報 (動画タイトルなど) を取得しない (NFR-51) |
| AS-54 | ユーザー側でカードを追加・編集する UI は cycle-5 のスコープ外 (将来検討、現状は `portal_data.js` 直接編集) |
| AS-55 | ジャンルのフィルタリング / 検索機能はなし (規模 60〜80 カードなら不要) |
| AS-56 | 多言語化なし (日本語固定、cycle-1 と同じ NFR-06) |
| AS-57 | レスポンシブはデスクトップ幅のみ (1280 / 1024 / 768)。モバイル幅 < 768px は将来検討 |

---

## 7. 既存システムとの整合

### 7.1 既存コードへの影響

| ファイル | 変更 | 理由 |
|---|---|---|
| `extension/manifest.json` | `web_accessible_resources` の `resources` に `portal/*` 追加、version bump (0.4.0 → 0.5.0) | NFR-55 |
| `extension/options/options.html` | 空状態案内に「🎬 娯楽ポータル (内蔵)」を 1 行追加 | FR-57 |
| `extension/options/options.js` | `injectReaderExampleUrl` と同様の `injectPortalExampleUrl` を追加 | FR-57 |
| `extension/sw/*` | **無変更** | NFR-54 |
| `extension/content/*` | **無変更** | NFR-54 |
| `extension/reader/*` | **無変更** | NFR-54 |
| `extension/service_worker.js` | **無変更** | NFR-54 |
| `vscode-extension/*` | **無変更** | cycle-5 のスコープ外 |

### 7.2 新規追加ファイル

| ファイル | 内容 |
|---|---|
| `extension/portal/portal.html` | ポータルページ HTML |
| `extension/portal/portal.css` | スタイル (ダーク基調 + 独自アクセント) |
| `extension/portal/portal.js` | カードレンダリング + クリック遷移 |
| `extension/portal/portal_data.js` | ジャンル/カードデータ定義 |

### 7.3 既存 Reader Page との位置付け

- Reader Page (`extension/reader/`、cycle-3 追加) と並列の「内蔵遷移先コンテンツ」
- ユーザーは Options Page から **Reader Page or Portal Page** を AI 待ち遷移先として登録可能
- 両方を同時に登録することも可能 (Portal Page を上位、Reader を下位など)

---

## 8. 受入条件 (Acceptance Criteria)

cycle-5 完了の判定基準:

1. **AC-01**: Chrome 拡張をリロードし、ブラウザのアドレスバーに `chrome-extension://[id]/portal/portal.html` を入力するとポータルページが表示される
2. **AC-02**: ポータルページにヘッダ、10〜12 ジャンルの行、合計 60〜80 枚のカードが Netflix 風レイアウトで表示される
3. **AC-03**: 各ジャンル行は横スクロール可能で、ホバーでカードが拡大する
4. **AC-04**: 任意のカードをクリックすると同タブでそのサイト URL に遷移する
5. **AC-05**: Options Page の空状態 (sites=0) で「🎬 娯楽ポータル (内蔵)」が案内に表示され、その URL を 1 クリックで登録可能
6. **AC-06**: ポータル URL を sites に登録した状態で AI 待ちを発生させると、ポータルページがタブとして開かれる (cycle-1 タブ探索戦略の Pass 3 経路で動作)
7. **AC-07**: 既存 cycle-1〜4 の全機能 (Claude.ai 待ち検知、タブ探索、Reader Page、Kiro 拡張) が動作する (NFR-54、git diff で実証可能)
8. **AC-08**: ポータルページのスタイルがダーク基調で、デザイン的に Netflix 風 + AI WaitLess の独自色を反映

---

## 9. 関連ドキュメント

- 前 cycle 引き継ぎ: `docs/cycle-5-handover.md`
- 現状アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- cycle-3 Reader Page (参考、類似パターン): `aidlc-docs-waitless-archive/cycle-3/`
