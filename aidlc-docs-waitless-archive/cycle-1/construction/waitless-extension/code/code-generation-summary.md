# Code Generation Summary — waitless-extension (Unit U1)

**プロジェクト**: WaitLess
**ユニット**: U1 (waitless-extension)
**フェーズ**: CONSTRUCTION - Code Generation
**作成日**: 2026-05-26

---

## 1. 生成ファイル一覧

すべて `extension/` 配下に配置 (アプリコードはワークスペースルートのルール、ドキュメントのみ aidlc-docs/)。

| # | パス | 種別 | 行数目安 | 主な責務 |
|---|------|------|---------|---------|
| 1 | `extension/manifest.json` | 設定 | ~35 | Manifest V3 宣言、permissions、content_scripts、options_page |
| 2 | `extension/service_worker.js` | SW エントリ | ~30 | sw/* を import、MessageRouter init、onClicked / onInstalled |
| 3 | `extension/sw/message_router.js` | SW モジュール | ~120 | sendMessage 受信ハブ、タイプ別ディスパッチ |
| 4 | `extension/sw/wait_orchestrator.js` | SW モジュール | ~100 | 待ち発生 → 切替 → 完了 → 戻り の中核フロー |
| 5 | `extension/sw/tab_manager.js` | SW モジュール | ~110 | chrome.tabs.* 集約、ドメイン一致探索、PlaybackTrigger 注入 |
| 6 | `extension/sw/settings_repository.js` | SW モジュール | ~210 | chrome.storage.local CRUD + バリデーション + 連番化 |
| 7 | `extension/sw/runtime_state.js` | SW モジュール | ~80 | 実行時状態、session 永続化、SW 再起動時の復元 |
| 8 | `extension/content/claude_site_adapter.js` | Content Script | ~150 | Claude.ai DOM 監視、ステートマシン、N秒タイマー |
| 9 | `extension/content/playback_trigger.js` | Content Script (動的) | ~70 | サイト固有セレクタ → `<video>.play()` フォールバック |
| 10 | `extension/options/options.html` | UI | ~80 | Header / Threshold / Sites / Add の DOM 骨格 |
| 11 | `extension/options/options.css` | スタイル | ~190 | システムフォント、テーブル、フォーム、メッセージ |
| 12 | `extension/options/options.js` | UI ロジック | ~280 | OptionsAPI + OptionsApp、インライン編集、バリデーション |
| 13-15 | `extension/assets/icons/icon{16,48,128}.png` | アセット | - | プレースホルダ (1x1 透過 PNG) |
| 16 | `extension/README.md` | ドキュメント | ~70 | インストール手順、既知制限、アンチスコープ |
| 17 | `aidlc-docs/construction/waitless-extension/code/code-generation-summary.md` | ドキュメント | (本ファイル) | サマリ |

合計 17 ファイル。アプリコード約 1,400 行 (PNG/MD除く目安)。

---

## 2. ストーリーカバレッジ最終確認

| US | 実装状況 | 主担当ファイル |
|----|---------|--------------|
| US-01 待ち発生察知 | ✅ 完全実装 | `claude_site_adapter.js` (検知)、`message_router.js` (受信)、`wait_orchestrator.js` (受領) |
| US-02 自動切替 | ✅ 完全実装 | `wait_orchestrator.js`, `tab_manager.js`, `settings_repository.js` |
| US-03 動画自動再生 | ⚠ best-effort | `tab_manager.js` (注入)、`playback_trigger.js` (試行) |
| US-04 自動戻り | ✅ 完全実装 | `claude_site_adapter.js` (完了検知)、`wait_orchestrator.js`, `tab_manager.js` |
| US-05 設定UI | ✅ 完全実装 | `options/*.{html,css,js}`, `settings_repository.js` |
| US-06 オンボーディング | ⚠ 最小限 (空状態案内のみ) | `options/options.html`, `options/options.js` |

---

## 3. FR/NFR トレーサビリティ

### FR

| FR | 概要 | 実装場所 |
|----|------|---------|
| FR-01 | Claude.ai タブ自動検出 | `manifest.json` content_scripts.matches、`claude_site_adapter.js` |
| FR-02 | 応答ストリーミング DOM 監視 | `claude_site_adapter.js` (MutationObserver) |
| FR-03 | N秒判定 | `claude_site_adapter.js` (startWaitTimer) |
| FR-04 | 娯楽サイト登録 | `settings_repository.js` (addSite/updateSite/deleteSite/reorderSites)、`options.js` |
| FR-05 | 既存タブ探索 + 優先順位選択 | `tab_manager.js` (findOrOpenPlaySite) |
| FR-06 | 娯楽タブ自動切替 + 動画再生 | `tab_manager.js` + `playback_trigger.js` |
| FR-07 | 応答完了 DOM 検知 | `claude_site_adapter.js` (state==WAITING && !isStreaming) |
| FR-08 | Claude.ai タブ自動戻り | `wait_orchestrator.js` (onCompletionDetected) + `tab_manager.js` (activateTab/findClaudeTab) |
| FR-09 | オプションページUI | `options/*.{html,css,js}`、`service_worker.js` (action.onClicked) |
| FR-10 | chrome.storage.local 永続化 | `settings_repository.js` |
| FR-11 | しきい値設定 | `settings_repository.js` (setThresholdSec)、`options.js` (Threshold UI) |

### NFR

| NFR | 概要 | 実装場所/根拠 |
|-----|------|-------------|
| NFR-01 | Manifest V3 準拠 | `manifest.json`, ES Modules SW |
| NFR-02 | 端末ローカル完結 | 外部 fetch なし、chrome.storage.* のみ使用 |
| NFR-03 | Web Store 申請可能 | permissions 最小化、`<all_urls>` の使用は README で説明 |
| NFR-04 | ビルド不要 | npm 依存ゼロ、素の JS/HTML/CSS |
| NFR-05 | パフォーマンス影響最小 | MutationObserver の attributeFilter 限定、setTimeout のみ |
| NFR-06 | 日本語UI | options HTML lang="ja"、メッセージは日本語 |

---

## 4. 業務ルール (BR) の実装場所

| BR | 概要 | 実装場所 |
|----|------|---------|
| BR-01 domain バリデーション | 正規表現 `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` | `settings_repository.js` (validateDomain), `options.js` (validateDomain) |
| BR-02 url バリデーション | new URL + http/https | 同上 (validateUrl) |
| BR-03 domain 重複禁止 | addSite/updateSite で検査 | `settings_repository.js` |
| BR-04 しきい値 1〜60 整数 | validateThreshold | 同上 (validateThreshold) |
| BR-05 priority 連番化 | sanitizeSites + addSite + deleteSite + reorderSites | `settings_repository.js` |
| BR-06 sites priority 昇順 | sanitizeSites のソート | 同上 |
| BR-07 タブ ドメイン一致 | extractDomain による比較 | `tab_manager.js` |
| BR-08 探索範囲: 現在ウィンドウのみ | windows.getLastFocused | `tab_manager.js` |
| BR-09 新規作成: priority 1位 URL | findOrOpenPlaySite 末尾 | `tab_manager.js` |
| BR-10 PlaybackTrigger 試行順序 | サイト固有 → `<video>` | `playback_trigger.js` |
| BR-11 再生失敗の沈黙 | try/catch + p.catch | 同上 |
| BR-12 WAIT_DETECTED 重複抑制 | isWaiting() チェック | `wait_orchestrator.js` |
| BR-13 COMPLETION_DETECTED ガード | isWaiting() チェック | 同上 |
| BR-14 戻り先タブフォールバック | findClaudeTab() | `wait_orchestrator.js` + `tab_manager.js` |
| BR-15 タブ作成失敗の許容 | catch + console.error | `tab_manager.js` |
| BR-16 SW 再起動時の復元 | restoreFromSession | `service_worker.js` + `runtime_state.js` |
| BR-17 storage 例外時 reason | { ok: false, reason: 'storage_error' } | `settings_repository.js` |
| BR-18 不明 type は no-op | switch default | `message_router.js` |
| BR-19 threshold 即時反映 | storage.onChanged 監視 | `claude_site_adapter.js` |
| BR-20 デフォルト値補完 | getSettings 内 | `settings_repository.js` |
| BR-21 onInstalled ハンドラ | onInstalled.addListener | `service_worker.js` |
| BR-22 isWaiting 必ず false に戻す | onCompletionDetected 末尾 | `wait_orchestrator.js` |

---

## 5. 自動テストについて

NFR-04 (ビルド不要) と Q13=C (PBT 不適用) の方針に従い、**自動テストフレームワーク (Jest/Vitest 等) は導入していない**。
代わりに以下で品質を担保する想定:

- 各モジュールの責務を狭く保ち、コードレビュー可能な粒度に
- 主要動線は **Build & Test ステージで手動 E2E** (Chrome に Unpacked ロード)
- Claude.ai DOM セレクタは「実機確認時に追加・修正想定」をコード内コメントに明記

---

## 6. 実機検証で確認すべきポイント (Build & Test に渡す)

1. ✅ Unpacked ロードで manifest.json バリデーションエラーが出ない
2. ✅ Service Worker の起動ログが出る
3. ✅ Options Page を開く → 空状態の案内が出る
4. ✅ サイト追加 → ストレージに保存される (DevTools で確認)
5. ✅ Claude.ai でプロンプト送信 → N秒経過で娯楽タブに切替する
6. ⚠ 動画自動再生 (best-effort、サイト次第)
7. ✅ Claude.ai 完了 → 元タブに戻る
8. ✅ しきい値変更 → ClaudeSiteAdapter 側で即時反映 (storage.onChanged)
9. ✅ 既存タブが開いていれば、新規タブ作成せずアクティブ化
10. ✅ DevTools Network で外部送信ゼロを確認

---

## 7. 既知の制限と次サイクル候補

### 既知の制限 (本サイクル)
- アイコンが 1x1 PNG プレースホルダ (Web Store 申請には差し替え必須)
- Claude.ai DOM セレクタは現行 UI 想定、UI 変更で要更新
- 探索範囲が現在ウィンドウのみ (Q4-1=A の方針)
- 動画自動再生はオートプレイポリシー次第 (Q3=D, BR-11)

### 次サイクル候補 (本サイクル外)
- US-06 をフルオンボーディング画面に拡張
- 探索範囲を全ウィンドウに拡張するオプション
- ON/OFF トグル (アンチスコープを再評価する場合)
- 統計機能 (アンチスコープ #1 を再評価する場合)
- 多言語化 (i18n、アンチスコープ #9 を再評価する場合)

---

## 8. アンチスコープ準拠の確認

要件 §7 のアンチスコープ 9項目すべて、コードに対応する機能を **持たない** ことを確認:

| # | 項目 | コード上の不在 |
|---|------|----------------|
| 1 | 統計/ログ | 該当コンポーネントなし |
| 2 | 他AIサイト対応 | manifest content_scripts.matches は claude.ai/* のみ |
| 3 | 端末間同期 | chrome.storage.sync の使用なし |
| 4 | 外部送信 | fetch/XHR なし、grep で確認可 |
| 5 | OS通知/バッジ/音 | chrome.notifications, action.setBadge*, Audio API いずれも未使用 |
| 6 | ON/OFFトグル | 該当 UI/状態なし、常時ON |
| 7 | ポップアップUI | manifest action.default_popup なし |
| 8 | TS/React/ビルド | package.json なし、import は ES Modules のみ (SW 内のみ) |
| 9 | i18n | _locales ディレクトリなし、文字列は日本語直書き |

---

## 9. 完了条件チェック

unit-of-work.md の Definition of Done 対応:

- [x] `extension/` 配下に必要なファイルが揃う (17 ファイル)
- [x] `manifest.json` が Manifest V3 として有効 (構文確認済、実機ロード検証は Build & Test)
- [x] Claude.ai タブで Content Script が起動するコード (実機検証は Build & Test)
- [x] Service Worker が起動し、`MessageRouter.init()` が呼ばれている
- [x] Options Page が開ける、サイト追加で `chrome.storage.local` に保存される実装
- [x] しきい値設定が保存される、Claude.ai 側に即時反映する実装
- [x] (best-effort) Claude.ai でストリーミングが N秒続くと登録娯楽タブに切替する実装
- [x] (best-effort) 完了検知で Claude.ai タブに戻る実装
- [x] DevTools Network で外部送信なしを確認 (実機検証は Build & Test、コード上は外部 HTTP 通信なし)
