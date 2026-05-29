# cycle-6 Code Generation Summary — dashboard-page

最終更新: 2026-05-29

ダッシュボード UI (dashboard-page ユニット) の生成結果。

---

## 新規ファイル

### `extension/dashboard/dashboard.html`
- ヘッダ (タイトル + ポータルへの動線) / 空状態 / サマリグリッド / 余暇種別内訳 / 週次トレンド (トグル) / フッタ
- data-testid 付与 (dashboard-summary-grid, dashboard-genre-list, dashboard-trend-chart, dashboard-toggle-*, dashboard-empty-state)
- stats_aggregator.js → dashboard.js の順で通常スクリプト読み込み (ESM 不使用、依存ゼロ)

### `extension/dashboard/dashboard.css`
- CSS 変数でダーク基調 (#0a0a0f) + 紫アクセント (#7c3aed)、ポータルと統一 (FR-83)
- サマリカード (hero カード含む) / 構成比バー / 週次トレンド棒グラフ (div height %)
- 空状態 / レスポンシブ (768px)。canvas/svg/画像なし (NFR-72)

### `extension/dashboard/stats_aggregator.js` (≈ 200 行)
- `window.StatsAggregator` に公開 (通常スクリプト)
- `aggregate(events, now)`: M-01〜07 + 週次トレンドを算出 (BR-99/100)
- `toDateKey` / `formatDuration` / `GENRE_LABELS` (12 ジャンル + other ラベル内蔵)
- 純粋関数、防御的 (NaN/負値→0、null 除外)

### `extension/dashboard/dashboard.js`
- `readEvents`: chrome.storage.local.stats_events を直接読み (A3=B)
- `renderSummaryCards` (6 指標: ダメ時間 hero/待ち時間/回数/離脱継続率/集中復帰平均/戻れなかった回数)
- `renderGenreBreakdown` (構成比バー M-03)
- `renderWeeklyTrend` (M-01/M-02 トグル F7=C、最大値正規化、当日強調)
- `renderEmptyState` (BR-101)、ポータル動線解決

---

## 改修ファイル

### `extension/manifest.json`
- version 0.5.0 → 0.6.0、description に統計ダッシュボード追記
- web_accessible_resources に dashboard/* 4 件追加

### `extension/portal/portal.html` + `portal.js` + `portal.css`
- ヘッダに「📊 統計を見る」リンク追加、portal.js の `setupDashboardLink()` で href 動的解決
- hero-nav スタイル追加、footer バージョン v0.5.0 → v0.6.0

### `extension/options/options.html` + `options.js` + `options.css`
- サイトセクション見出し下に「統計ダッシュボードを開く」バナー (常時表示, FR-84)
- options.js の `injectDashboardLink()` で href 動的解決
- dashboard-banner スタイル追加 (紫アクセント)

---

## 検証
- `node --check`: stats_aggregator.js / dashboard.js / portal.js / options.js すべて OK
- `JSON.parse`: manifest.json valid

## トレーサビリティ
- FR-79,80,81,82,83,84,85, M-01〜07, BR-99〜102, C11

## NFR-72 依存ゼロ
- 外部ライブラリ・画像なし、グラフは純粋 HTML/CSS、ビルド不要
