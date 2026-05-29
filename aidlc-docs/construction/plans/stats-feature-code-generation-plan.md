# cycle-6 Code Generation Plan — stats-feature

最終更新: 2026-05-29

このプランが Code Generation の単一の真実源 (single source of truth)。
ワークスペースルート: `/Users/nt-240003/workspace/aws-summit-japan-2026-hackathon`、Brownfield。
アプリコードは `extension/` および `vscode-extension/` 配下 (NEVER aidlc-docs/)。
ドキュメントサマリは `aidlc-docs/construction/stats-feature/code/`。

---

## 生成対象ファイル一覧

### 新規ファイル (6)
| パス | 内容 |
|------|------|
| `extension/sw/leisure_classifier.js` | 余暇種別 12 ジャンル分類 (BR-87〜89) |
| `extension/sw/stats_repository.js` | 統計レコード CRUD + リングバッファ (BR-81〜86, 96〜98) |
| `extension/dashboard/dashboard.html` | ダッシュボード DOM 骨格 |
| `extension/dashboard/dashboard.css` | ダーク+紫テーマ (FR-83) |
| `extension/dashboard/stats_aggregator.js` | 集計純粋関数 (M-01〜07) |
| `extension/dashboard/dashboard.js` | 描画 + storage 直接読み (A3=B) |

### 改修ファイル (8)
| パス | 変更概要 |
|------|---------|
| `extension/sw/runtime_state.js` | `statsPending` フィールド追加 (get/set) |
| `extension/sw/wait_orchestrator.js` | begin/attach/finalize 記録呼び出し追加 (BR-83〜86) |
| `extension/sw/message_router.js` | RESUME_ACTION / RE_LEFT ルーティング追加 |
| `extension/content/claude_site_adapter.js` | 復帰操作検知 + 再離脱検知 (BR-90〜94) |
| `extension/sw/ide_bridge.js` | STATS_RECORD 受信 → stats_repository (BR-記録) |
| `extension/portal/portal.js` | ダッシュボードへの動線注入 (FR-84) |
| `extension/options/options.js` (+html/css) | 空状態にダッシュボード動線追加 |
| `extension/manifest.json` | web_accessible_resources に dashboard/* + version 0.6.0 |
| `vscode-extension/src/extension.ts` | STATS_RECORD 送信 + IpcMessageType 拡張 (C9) |

---

## ステップ (依存順: stats-core → dashboard-page → ide-stats-bridge)

### 【stats-core】
- [x] **Step 1**: `leisure_classifier.js` 生成 — GenreDef 12 ジャンル定義 + classify (段階マッチ BR-87/88/89) + getGenreDefs。ES Module export。純粋関数。
- [x] **Step 2**: `stats_repository.js` 生成 — appendEvent/resolveResume/markReLeft/recordCycle/getAllEvents/pruneIfNeeded + toDateKey。`chrome.storage.local.stats_events` のみ操作 (BR-98)。best-effort (BR-97)。MAX_EVENTS=5000。
- [x] **Step 3**: `runtime_state.js` 改修 — `statsPending` フィールド + getStatsPending/setStatsPending を追加 (既存 state に統合、session 永続化)。
- [x] **Step 4**: `wait_orchestrator.js` 改修 — onWaitDetected で beginCycle + 切替成功時 attachLeisure (classify)、onCompletionDetected で finalizeCycle。try/catch で best-effort。既存ロジック無変更。
- [x] **Step 5**: `message_router.js` 改修 — RESUME_ACTION / RE_LEFT の case 追加 → stats_repository へ。
- [x] **Step 6**: `claude_site_adapter.js` 改修 — COMPLETION 送信後に復帰監視 arm (操作検知→RESUME_ACTION、120sタイムアウト→RESUME_ACTION outcome=timeout)、再離脱監視 arm (stayWindow 30s 内 hidden→RE_LEFT、新サイクル STREAMING 再検知時は送らない BR-91)。
- [x] **Step 7**: stats-core サマリ — `aidlc-docs/construction/stats-feature/code/stats-core-summary.md`

### 【dashboard-page】
- [x] **Step 8**: `dashboard.html` 生成 — frontend-components.md の DOM 階層。data-testid 付与。
- [x] **Step 9**: `dashboard.css` 生成 — ダーク+紫テーマ、サマリグリッド、構成比バー、週次トレンド棒グラフ、空状態、レスポンシブ。
- [x] **Step 10**: `stats_aggregator.js` 生成 — aggregate/toDateKey/formatDuration (M-01〜07、BR-99/100/101)。純粋関数。
- [x] **Step 11**: `dashboard.js` 生成 — init/readEvents(直接storage)/renderSummaryCards/renderGenreBreakdown/renderWeeklyTrend(トグルF7=C)/renderEmptyState。
- [x] **Step 12**: 動線 + manifest 改修 — `portal.js` にダッシュボードリンク注入、`options.{html,js,css}` 空状態に動線、`manifest.json` に dashboard/* 4 件 + version 0.6.0 + description。
- [x] **Step 13**: dashboard-page サマリ — `aidlc-docs/construction/stats-feature/code/dashboard-page-summary.md`

### 【ide-stats-bridge】
- [x] **Step 14**: `ide_bridge.js` (STATS_RECORD 受信 → leisure_classifier で分類 → stats_repository.recordCycle) + `vscode-extension/src/extension.ts` (IpcMessageType に STATS_RECORD 追加、WaitOrchestratorIde に待ち時刻記録 + endWaiting で STATS_RECORD notify 送信) 改修。ide-stats-bridge サマリ生成。

---

## ストーリートレーサビリティ

| Step | FR/BR |
|------|-------|
| 1 | FR-74, BR-87〜89 |
| 2 | FR-71,72,73,78, BR-81〜86,96〜98 |
| 3 | BR-81 (statsPending) |
| 4 | FR-71,73, BR-83〜86, NFR-74 |
| 5 | FR-75,76 |
| 6 | FR-75,76, BR-90〜95, C2/C5 |
| 8〜11 | FR-79,80,81,82,83,85, BR-99〜102, M-01〜07 |
| 12 | FR-84, C11 |
| 14 | FR-77, A4, F4, S2 |

---

## 制約 (全 Step 共通)
- NFR-71: 既存コアは追記のみ。tab_manager.js / settings_repository.js / reader/* / playback_*.js は無変更。
- NFR-72: 依存ゼロ、画像/外部ライブラリなし、ビルド不要 (VS Code 拡張のみ tsc)。
- Brownfield: 既存ファイルは in-place 改修 (コピー作成禁止)。
- data-testid を対話要素に付与 (ダッシュボード)。
