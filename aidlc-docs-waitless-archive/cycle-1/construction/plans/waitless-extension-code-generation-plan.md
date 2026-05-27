# Code Generation Plan — waitless-extension (Unit U1)

**ステージ**: CONSTRUCTION - Unit U1 Code Generation (Part 1: Planning)
**ステータス**: 承認待ち

---

## 1. ユニットコンテキスト

### 1.1 ユニット情報
- **ユニット名**: `waitless-extension` (U1)
- **種別**: Chrome 拡張機能 (Manifest V3、単一パッケージ、素のJS/HTML/CSS、ビルド不要)
- **配置**: リポジトリ直下 `extension/`
- **ワークスペースルート**: `/Users/nt-240003/workspace/aws-summit-japan-2026-hackathon`

### 1.2 実装するストーリー (本サイクル)

| US | タイトル | 扱い |
|----|---------|------|
| US-01 | 待ち時間の発生を察知してくれる | ✅ 完全実装 |
| US-02 | 待ち発生で登録した娯楽サイトに自動切替する | ✅ 完全実装 |
| US-03 | 切替先で動画が自動再生されて、すぐに楽しめる | ⚠ best-effort |
| US-04 | 出力完了で Claude.ai タブに即座に戻る | ✅ 完全実装 |
| US-05 | オプションページで設定する (全部入り) | ✅ 完全実装 |
| US-06 | インストール後すぐに使い始められる | ⚠ 最小限 (空状態案内のみ) |

### 1.3 ユニット間依存
- **依存先**: なし (単一ユニット、外部 HTTP 通信なし)
- **インタフェース**: Chrome ブラウザの拡張機能 API のみ

### 1.4 入力アーティファクト
- Application Design: `aidlc-docs/inception/application-design/*.md`
- Functional Design: `aidlc-docs/construction/waitless-extension/functional-design/*.md`
- Unit of Work: `aidlc-docs/inception/application-design/unit-of-work*.md`

---

## 2. 生成戦略 / 設計方針

### 2.1 ファイル構成 (Application Design に従う)

```
extension/
├── manifest.json
├── service_worker.js
├── sw/
│   ├── message_router.js
│   ├── wait_orchestrator.js
│   ├── tab_manager.js
│   ├── settings_repository.js
│   └── runtime_state.js
├── content/
│   ├── claude_site_adapter.js
│   └── playback_trigger.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
└── assets/
    └── icons/
        ├── icon16.svg   ※ placeholder。実装時 PNG 生成は後続
        ├── icon48.svg
        └── icon128.svg
```

注: アイコンは PNG が望ましいが、コード生成段階では **SVG プレースホルダ** を作成し、必要に応じて変換指針を README に記載する。

### 2.2 モジュール方式
- Service Worker は ES Modules (`"type": "module"`) を使用
- sw 配下の各モジュールは `export` で公開し、`service_worker.js` から import する
- Content Script (claude_site_adapter.js, playback_trigger.js) は IIFE (即時実行関数) で書く (Content Script は ES Modules 非対応)
- Options Page の options.js も IIFE / 単一ファイル方式

### 2.3 自動テスト方針
- 要件 NFR-04 (ビルド不要) と Q13=C (PBT 不適用) に整合し、**自動テストフレームワークは導入しない**
- 各コンポーネントは手動 E2E (Build & Test ステージ) で検証する
- ロジック (例: extractDomain) は Code Generation 時に短い JSDoc + console.assert ベースのスモークコメントを残す程度に留める

### 2.4 ドキュメント方針
- `aidlc-docs/construction/waitless-extension/code/` にコード生成サマリ (markdown) を残す
- README は `extension/README.md` として最低限のインストール手順 (Unpacked) を記載

---

## 3. ステップ別計画

各ステップ完了時に `[x]` でマークする。

### Step 1: Project Structure Setup
- [x] `extension/` ディレクトリ作成 (Greenfield)
- [x] サブディレクトリ作成: `extension/sw/`, `extension/content/`, `extension/options/`, `extension/assets/icons/`
- [x] `.gitkeep` または最小ファイルで存在を確保 (空ディレクトリの commit 用)

### Step 2: manifest.json 生成
- [x] `extension/manifest.json` を作成
- [x] Manifest V3 準拠
- [x] permissions: `storage`, `tabs`, `scripting`
- [x] host_permissions: `https://claude.ai/*`, `<all_urls>` (Q7=B)
- [x] background.service_worker, type: "module"
- [x] content_scripts (claude_site_adapter.js を claude.ai/* に注入)
- [x] action (ポップアップなし、default_title "WaitLess")
- [x] options_page: options/options.html
- [x] icons (16/48/128)

**関連 FR**: NFR-01, NFR-04
**関連 US**: (基盤)

### Step 3: SW モジュール: settings_repository.js
- [x] `extension/sw/settings_repository.js`
- [x] getSettings, updateSettings, getSites, addSite, updateSite, deleteSite, reorderSites, getThresholdSec, setThresholdSec
- [x] BR-01〜04, BR-20 のバリデーション実装
- [x] storage layer (snake_case) ↔ app layer (camelCase) の変換

**関連 FR**: FR-04, FR-10, FR-11
**関連 US**: US-05

### Step 4: SW モジュール: runtime_state.js
- [x] `extension/sw/runtime_state.js`
- [x] isWaiting, claudeTabId, playTabId のメモリ + session 永続化
- [x] restoreFromSession, reset, set/get メソッド

**関連 FR**: 内部状態 (FR-03/05/08 を支える)
**関連 US**: (横断)

### Step 5: SW モジュール: tab_manager.js
- [x] `extension/sw/tab_manager.js`
- [x] findOrOpenPlaySite (現在ウィンドウのみ + ドメイン一致 / Q4-1=A, Q4-2=C)
- [x] activateTab, openNewTab, injectPlaybackTrigger, findClaudeTab, tabExists
- [x] extractDomain (`new URL(...).hostname.replace(/^www\./, '')`)

**関連 FR**: FR-05, FR-06, FR-08
**関連 US**: US-02, US-04

### Step 6: SW モジュール: wait_orchestrator.js
- [x] `extension/sw/wait_orchestrator.js`
- [x] onWaitDetected, onCompletionDetected, reset
- [x] BR-12 (重複抑制), BR-13 (ガード), BR-14 (戻り先フォールバック)
- [x] TabManager / SettingsRepository / RuntimeState を内部で利用

**関連 FR**: FR-03, FR-05, FR-06, FR-07, FR-08
**関連 US**: US-01, US-02, US-04

### Step 7: SW モジュール: message_router.js
- [x] `extension/sw/message_router.js`
- [x] onMessage リスナーの init
- [x] WAIT_DETECTED, COMPLETION_DETECTED, GET_SETTINGS, ADD_SITE, UPDATE_SITE, DELETE_SITE, REORDER_SITES, SET_THRESHOLD のディスパッチ
- [x] 非同期応答時に return true、不明 type は no-op (BR-18)

**関連 FR**: 全 FR の経路
**関連 US**: 全 US の経路

### Step 8: service_worker.js (SW エントリ)
- [x] `extension/service_worker.js`
- [x] sw/ モジュールを import
- [x] MessageRouter.init() を呼ぶ
- [x] RuntimeState.restoreFromSession() を起動時に呼ぶ
- [x] chrome.action.onClicked → openOptionsPage (Q8=A)
- [x] chrome.runtime.onInstalled (BR-21)

**関連 FR**: NFR-01
**関連 US**: (基盤)

### Step 9: Content Script: claude_site_adapter.js
- [x] `extension/content/claude_site_adapter.js`
- [x] IIFE 形式
- [x] ステートマシン (IDLE / STREAMING / WAITING)
- [x] MutationObserver で DOM 変化監視
- [x] detectStreamingState (停止ボタン検知、属性優先 + テキストフォールバック)
- [x] startWaitTimer / cancelWaitTimer
- [x] storage.onChanged で threshold_sec を即時反映 (BR-19)

**関連 FR**: FR-01, FR-02, FR-03, FR-07
**関連 US**: US-01

### Step 10: Content Script: playback_trigger.js
- [x] `extension/content/playback_trigger.js`
- [x] IIFE 即時実行
- [x] BR-10 のセレクタ順序試行 (YouTube .ytp-large-play-button → ytp-play-button → Vimeo → ニコニコ → 汎用 `<video>.play()`)
- [x] 失敗を黙って許容 (BR-11)

**関連 FR**: FR-06
**関連 US**: US-03 (best-effort)

### Step 11: Options Page: options.html
- [x] `extension/options/options.html`
- [x] DOCTYPE html, lang="ja", meta charset
- [x] Header / ThresholdSection / SitesSection / AddSiteForm の DOM 骨格
- [x] options.css と options.js の読み込み
- [x] data-testid 属性で主要要素にラベル付け

**関連 FR**: FR-09
**関連 US**: US-05, US-06

### Step 12: Options Page: options.css
- [x] `extension/options/options.css`
- [x] システムフォント、max-width 720px 中央寄せ
- [x] テーブル / フォーム / エラーメッセージ / 編集モードのスタイル
- [x] アクセシビリティ最低限 (フォーカスインジケータ、コントラスト)

### Step 13: Options Page: options.js
- [x] `extension/options/options.js`
- [x] OptionsAPI: sendMessage の Promise ラッパー
- [x] OptionsApp.init: getSettings → render → イベントハンドラ登録
- [x] ThresholdSection の挙動 (number input, blur/click バリデーション)
- [x] SitesSection の挙動 (空状態、テーブル、インライン編集、削除、並び替え)
- [x] AddSiteForm の挙動 (バリデーション → addSite)

**関連 FR**: FR-09, FR-10, FR-11
**関連 US**: US-05, US-06

### Step 14: アイコン placeholder + assets
- [x] `extension/assets/icons/icon16.svg` (placeholder, 16x16)
- [x] `extension/assets/icons/icon48.svg` (placeholder, 48x48)
- [x] `extension/assets/icons/icon128.svg` (placeholder, 128x128)
- [x] PNG 化指針 を README に記載 (本MVPではSVGをmanifestで参照しない、PNG必須のため後続置換が必要)

注: Chrome は icons の PNG を期待する。SVG をプレースホルダとして残し、実際の `manifest.json` の icons では `icon16.png` 等を参照する形にして、placeholder PNG を最小限 (1x1 透過) で作るのは Step 14 の中で対応する。

### Step 15: extension/README.md
- [x] インストール方法 (Unpacked ロード手順)
- [x] 動作要件 (Chrome 最新版、Claude.ai 利用)
- [x] 主要設定項目の説明
- [x] 既知の制限事項 (オートプレイポリシー等)
- [x] アンチスコープ (持たない機能) の明記

### Step 16: ドキュメントサマリ生成
- [x] `aidlc-docs/construction/waitless-extension/code/code-generation-summary.md`
- [x] 生成したファイル一覧、行数、各ファイルの責務
- [x] FR/US トレーサビリティ最終マッピング
- [x] 動作確認手順 (Build & Test ステージへの導入)

---

## 4. 期待される成果物 (要約)

| 種類 | 数 | 備考 |
|------|---|------|
| 設定ファイル | 1 | manifest.json |
| Service Worker (エントリ) | 1 | service_worker.js |
| SW モジュール | 5 | sw/*.js |
| Content Script | 2 | content/*.js |
| Options Page | 3 | options.html, options.css, options.js |
| アイコン | 3 | assets/icons/*.svg or *.png (placeholder) |
| README | 1 | extension/README.md |
| ドキュメントサマリ | 1 | aidlc-docs/.../code-generation-summary.md |
| **合計** | **17** | |

---

## 5. ストーリー カバレッジ確認

| US | カバーする Step |
|----|----------------|
| US-01 | Step 9 (claude_site_adapter), Step 6 (wait_orchestrator), Step 7 (message_router) |
| US-02 | Step 6 (wait_orchestrator), Step 5 (tab_manager), Step 3 (settings_repository) |
| US-03 | Step 10 (playback_trigger), Step 5 (tab_manager.injectPlaybackTrigger) — best-effort |
| US-04 | Step 9 (claude_site_adapter 完了検知), Step 6 (wait_orchestrator), Step 5 (tab_manager) |
| US-05 | Step 11/12/13 (options/), Step 3 (settings_repository), Step 7 (message_router) |
| US-06 | Step 11/13 (options 空状態案内), Step 8 (onInstalled) — 最小限 |

→ 全 6 US が対応する Step を持つ。

---

## 6. リスク と 軽減策

| リスク | 軽減策 |
|--------|--------|
| Claude.ai DOM シグナルの不確定性 | Step 9 で属性優先 + テキストフォールバック、複数候補セレクタを実装。コメントで「ここを実機で確認」と明記 |
| 動画自動再生のオートプレイポリシー失敗 | Step 10 で失敗を try-catch で握る、ログのみ。BR-11 と整合 |
| Service Worker の再起動 | Step 4 で session ストレージ復元、Step 8 で起動時に呼ぶ |
| icon PNG が無いと manifest 検証失敗 | Step 14 で 1x1 透過 PNG を仮で作る、もしくは SVG を PNG に変換するスクリプトを README に記載 |

---

## 7. 想定実装時間

| Step | 推定時間 |
|------|---------|
| Step 1〜2 (構造 + manifest) | 0.2 時間 |
| Step 3〜8 (SW モジュール + エントリ) | 1.5 時間 |
| Step 9〜10 (Content Scripts) | 0.7 時間 |
| Step 11〜13 (Options Page) | 1.0 時間 |
| Step 14 (アイコン) | 0.2 時間 |
| Step 15 (README) | 0.2 時間 |
| Step 16 (サマリ) | 0.2 時間 |
| **合計** | **約 4 時間** |

実行プラン (`execution-plan.md` §5) の見積 (1〜2 時間) より長めですが、全コンポーネントを 1 ユニットで実装するためです。許容範囲内と判断します。

---

## 8. 承認

このプランで Code Generation (Part 2) を進めてよろしいですか?

- ✅ **承認**: Step 1 から順に実行
- 🔧 **修正**: ステップ構成、ファイル構成、生成範囲への指示
- ➕ **追加**: 含めたい項目があれば指示
