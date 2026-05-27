# WaitLess — Architecture

このドキュメントは WaitLess (Chrome 拡張機能 / Manifest V3) のアーキテクチャを、メンテナンスを続けるための一次資料として記述する。詳細な設計経緯は `aidlc-docs-waitless-archive/cycle-1/` および `aidlc-docs-waitless-archive/cycle-2/` を参照。

最終更新: 2026-05-27 (cycle-3 完了時点)

---

## 0. cycle 別の変更サマリ

| cycle | 主な変更 | 影響範囲 |
|-------|---------|---------|
| **cycle-1** | MVP 実装一式 (16 ファイル、Service Worker / Content Scripts / Options Page / 2パス探索 / PlaybackPause) | 全コンポーネント新規 |
| **cycle-2** | 動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想) を公式サポート対象に拡大。Options 空状態案内 + manifest `default_title` + README 更新 (version `0.2.0`)。コアロジック・データモデルは非変更 | UI 文言 / README / manifest のみ。`extension/options/{html,css}`, `extension/manifest.json`, `extension/README.md` |
| **cycle-3** | 拡張機能内蔵の Reader Page (`extension/reader/`) を新規追加。クリックで既読範囲を青色化、スクロール+クリック位置を `chrome.storage.local` の `reader_state` キーに永続化、起動時に復元。`DOMAIN_REGEX` と `validateUrl` の protocol 許可を拡張機能 ID / `chrome-extension:` 対応に拡大 (BR-01/02 改訂)。version `0.3.0`。コアロジック (sw/* 5 つのうち 4 つ + content/* + service_worker.js) は非変更 | 新規 `extension/reader/` 4 ファイル + `manifest.json` (`web_accessible_resources` 追加) + `extension/sw/settings_repository.js` (REGEX/protocol 拡張) + `extension/options/{html,js}` (空状態に読書行追加 + `injectReaderExampleUrl` + `validateUrl/Domain` 拡張) + `extension/README.md` |

---

## 1. Overview

WaitLess は、Claude.ai の応答ストリーミングが N秒以上 続いた瞬間に、ユーザーが事前登録した娯楽サイトのタブへ自動切替し、出力完了で即時 Claude.ai タブへ戻る Chrome 拡張機能 (Manifest V3) である。

すべてのデータは端末ローカル (`chrome.storage.local`) に閉じる。外部サーバー / 外部 API への送信は行わない。素の JavaScript / HTML / CSS のみで実装され、ビルド不要。

---

## 2. アーキテクチャ全体像

3層 (Service Worker / Content Script / Options Page) + 1ストア (`chrome.storage`) の構成。

```
+------------------------------------------------------------------+
|                          Chrome Browser                          |
+------------------------------------------------------------------+
|                                                                  |
|  [Options Page]                                                  |
|   options.html / options.js / options.css                        |
|   ├ OptionsApp (UI 制御 / インライン編集 / バリデーション)        |
|   └ OptionsAPI ──────── sendMessage ──────────┐                  |
|                                                v                 |
|  [Service Worker]                                                |
|   service_worker.js + sw/*.js                                    |
|   ┌────────────────────────────────────────────────────┐         |
|   │ MessageRouter (sendMessage 受信ハブ)                │         |
|   │  ├─ WaitOrchestrator (中心)                         │         |
|   │  │   ├─ TabManager  ─── chrome.tabs.* / scripting   │         |
|   │  │   ├─ SettingsRepository ── chrome.storage.local  │         |
|   │  │   └─ RuntimeState ─────── chrome.storage.session │         |
|   └────────────────────────────────────────────────────┘         |
|        ^                                                         |
|        | sendMessage (WAIT_DETECTED / COMPLETION_DETECTED)       |
|        |                                                         |
|  [Content Script: Claude.ai タブ]                                |
|   content/claude_site_adapter.js                                 |
|   └ ClaudeSiteAdapter ── 停止ボタン MutationObserver で監視       |
|                                                                  |
|  [Content Script: 娯楽タブ (動的注入)]                           |
|   content/playback_trigger.js  -- 待ち発生時に動画再生試行         |
|   content/playback_pause.js    -- 完了時に動画一時停止            |
|                                                                  |
|  [chrome.storage.local]                                          |
|   { sites: [{domain, url, priority}, ...], threshold_sec: 5 }    |
|  [chrome.storage.session]                                        |
|   { runtime_state: { isWaiting, claudeTabId, playTabId } }       |
+------------------------------------------------------------------+
```

---

## 3. レイヤー区分

| Layer | 役割 | 含まれるコンポーネント |
|-------|------|----------------------|
| Layer 4: UI / Page | ユーザーインタフェース | OptionsApp |
| Layer 3: Adapter / Boundary | 外界 (DOM / sendMessage) との境界 | ClaudeSiteAdapter, PlaybackTrigger, PlaybackPause, OptionsAPI |
| Layer 2: Orchestration | 体験フローの調整 | MessageRouter, WaitOrchestrator |
| Layer 1: Domain Services | 単一責務のドメインロジック | TabManager, SettingsRepository, RuntimeState |
| Layer 0: Chrome API + DOM | プラットフォーム | (Chrome 拡張機能 API、DOM API) |

各レイヤーは **下位レイヤーのみ** を呼び出し、上位への通知は イベント (sendMessage / storage.onChanged) を介する。**循環依存なし**。

---

## 4. コンポーネント一覧

| コンポーネント | 配置 | ファイル | 責務 |
|---|---|---|---|
| MessageRouter | SW | `sw/message_router.js` | sendMessage の受信ハブ、タイプ別ディスパッチ |
| WaitOrchestrator | SW | `sw/wait_orchestrator.js` | 待ち発生 → 切替 → 完了 → 戻りの全体フロー |
| TabManager | SW | `sw/tab_manager.js` | chrome.tabs.* 集約、優先順位探索 (2パス)、PlaybackTrigger/Pause 注入 |
| SettingsRepository | SW | `sw/settings_repository.js` | chrome.storage.local CRUD + バリデーション |
| RuntimeState | SW | `sw/runtime_state.js` | 実行時状態のメモリ保持 + session 永続化 |
| ClaudeSiteAdapter | Content (Claude.ai) | `content/claude_site_adapter.js` | 停止ボタン DOM 監視、しきい値判定、イベント送信 |
| PlaybackTrigger | Content (娯楽タブ動的) | `content/playback_trigger.js` | 動画再生ボタン試行クリック / `<video>.play()` |
| PlaybackPause | Content (娯楽タブ動的) | `content/playback_pause.js` | 動画一時停止 (戻り前) |
| OptionsApp | Options Page | `options/options.js` (前半) | 設定UI とユーザー操作ハンドリング |
| OptionsAPI | Options Page | `options/options.js` (後半) | sendMessage の Promise ラッパー |
| ReaderPage (cycle-3) | Reader Page | `reader/{html,css,js,txt}` | 拡張機能内蔵の読書ページ。組み込み小説の表示、クリックでの既読範囲青色化、`chrome.storage.local` 直接アクセスによる `reader_state` の永続化と復元 |

---

## 5. 通信パターン

| パターン | 経路 | 用途 |
|---------|------|------|
| sendMessage (一方向) | ClaudeSiteAdapter → MessageRouter → WaitOrchestrator | WAIT_DETECTED / COMPLETION_DETECTED |
| sendMessage (req/res) | OptionsAPI → MessageRouter → SettingsRepository | 設定 CRUD |
| storage.onChanged | SettingsRepository → ClaudeSiteAdapter | しきい値の即時反映 |
| 動的注入 | TabManager → 娯楽タブ → PlaybackTrigger / PlaybackPause 即時実行 | 再生 / 一時停止 |

---

## 6. メッセージタイプ表

すべて `chrome.runtime.sendMessage({ type, payload })` 形式。

| Type | 方向 | Payload | Response |
|------|------|---------|---------|
| `WAIT_DETECTED` | Content → SW | `{ claudeTabId, durationMs }` | なし |
| `COMPLETION_DETECTED` | Content → SW | `{ claudeTabId }` | なし |
| `GET_SETTINGS` | Options → SW | `{}` | `{ sites, thresholdSec }` |
| `ADD_SITE` | Options → SW | `{ domain, url }` | `{ ok, reason? }` |
| `UPDATE_SITE` | Options → SW | `{ originalDomain, domain, url }` | `{ ok, reason? }` |
| `DELETE_SITE` | Options → SW | `{ domain }` | `{ ok, reason? }` |
| `REORDER_SITES` | Options → SW | `{ orderedDomains: string[] }` | `{ ok, reason? }` |
| `SET_THRESHOLD` | Options → SW | `{ thresholdSec }` | `{ ok, reason? }` |

reason コード: `invalid_domain` / `invalid_url` / `duplicate_domain` / `not_found` / `invalid_threshold` / `invalid_payload` / `storage_error`

---

## 7. データモデル

### Site

```js
/**
 * @typedef {Object} Site
 * @property {string} domain    例: "youtube.com" (識別子、重複禁止、www. 除去後の小文字)
 * @property {string} url       自動再生用 URL (フルURL、http(s)://...)
 * @property {number} priority  優先順位 (1 が最上位、連番)
 */
```

バリデーション:
- domain: 正規表現 `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-z]{32}$`、1〜255 文字 (cycle-3 で 32 文字英小数字 = 拡張機能 ID も許可)
- url: `new URL(input)` パース成功 + protocol が `http:` / `https:` / `chrome-extension:` のいずれか、1〜2048 文字 (cycle-3 で `chrome-extension:` を追加)

### Settings

```js
/**
 * @typedef {Object} Settings
 * @property {Site[]} sites
 * @property {number} thresholdSec  N秒判定しきい値 (デフォルト 5、範囲 1〜60 整数)
 */
```

### chrome.storage.local の保存形式 (snake_case)

```json
{
  "sites": [
    { "domain": "youtube.com", "url": "https://youtu.be/xxx?autoplay=1", "priority": 1 },
    { "domain": "x.com",       "url": "https://x.com/home",              "priority": 2 }
  ],
  "threshold_sec": 5,
  "reader_state": {
    "read_offset": 1234,
    "scroll_y": 5678,
    "novel_id": "default",
    "updated_at": 1717113600000
  }
}
```

`SettingsRepository` がストレージ層 (snake_case) ↔ アプリ層 (camelCase) を境界で変換する。
`reader_state` は cycle-3 で追加された **ReaderPage 専用キー** で、ReaderApp が直接 `chrome.storage.local` を読み書きする (Service Worker を経由しない)。`sites` / `threshold_sec` の既存スキーマには干渉しない (NFR-07 後方互換性)。

### ReaderStateSnapshot (cycle-3)

```js
/**
 * @typedef {Object} ReaderStateSnapshot
 * @property {number} readOffset  既読範囲の末尾文字オフセット (0 始まり、改行も 1 文字)
 * @property {number} scrollY     離脱時のスクロール Y 座標 (px、整数)
 * @property {string} novelId     小説識別キー (cycle-3 では固定値 "default")
 * @property {number} updatedAt   最終更新時刻 (Date.now())
 */
```

バリデーション: `readOffset` / `scrollY` は数値かつ有限、不正値は 0 にフォールバック (BR-37)。クリック時に saveState で即時保存 (BR-34)、離脱時 (`pagehide` / `visibilitychange='hidden'`) に savePartial で scrollY のみ更新。

### RuntimeState

```js
/**
 * @typedef {Object} RuntimeStateSnapshot
 * @property {boolean} isWaiting              現在 待ちサイクル中か
 * @property {number|null} claudeTabId        待ち発生時の Claude.ai タブID
 * @property {number|null} playTabId          切替先の娯楽タブID
 */
```

`chrome.storage.session` に `{ "runtime_state": ... }` の形で永続化 (Service Worker 再起動跨ぎ用)。

---

## 8. ファイル/ディレクトリ構成

```
extension/
├── manifest.json              # Manifest V3 設定
├── service_worker.js          # SW エントリ (sw/* を import)
├── sw/
│   ├── message_router.js      # MessageRouter
│   ├── wait_orchestrator.js   # WaitOrchestrator
│   ├── tab_manager.js         # TabManager (現在ウィンドウ + 2パス探索)
│   ├── settings_repository.js # SettingsRepository (CRUD + バリデーション)
│   └── runtime_state.js       # RuntimeState (session 永続化)
├── content/
│   ├── claude_site_adapter.js # 静的注入 (claude.ai/*)
│   ├── playback_trigger.js    # 動的注入 (娯楽タブ、再生試行 + リトライ)
│   └── playback_pause.js      # 動的注入 (娯楽タブ、戻る前に一時停止)
├── options/
│   ├── options.html           # OptionsApp の DOM
│   ├── options.css            # スタイル
│   └── options.js             # OptionsApp + OptionsAPI
├── assets/
│   └── icons/
│       ├── icon16.png         # ※ 現状 1x1 透過プレースホルダ、本番化前に差し替え必要
│       ├── icon48.png
│       └── icon128.png
└── README.md                  # ユーザー向け (インストール方法、既知制限)
```

manifest.json の主要設定:
- `manifest_version: 3`
- `permissions: ["storage", "tabs", "scripting"]`
- `host_permissions: ["https://claude.ai/*", "<all_urls>"]` (`<all_urls>` は PlaybackTrigger 動的注入のため)
- `background.service_worker: "service_worker.js"`, `type: "module"`
- `content_scripts: [{ matches: ["https://claude.ai/*"], js: ["content/claude_site_adapter.js"], run_at: "document_idle" }]`
- `action: { default_title: "WaitLess (クリックで設定を開く)" }` (ポップアップなし)
- `options_page: "options/options.html"`

---

## 9. タブ探索戦略 (2パス)

`TabManager.findOrOpenPlaySite(sites)` は以下の優先度で動く。これは cycle-1 の実装で確定した重要仕様:

```
[Pass 1] URL 完全一致を優先順位順に探す
   ├ ヒット → 既存タブをアクティブ化のみ (遷移なし)
   │           PlaybackTrigger で続きから再生
   └ なし → Pass 2

[Pass 2] ドメイン一致を優先順位順に探す
   ├ ヒット → 登録 URL に chrome.tabs.update で navigate
   │           PlaybackTrigger で再生試行
   └ なし → Pass 3

[Pass 3] sites[0] (最高優先) の url で新規タブを開く + アクティブ化
           PlaybackTrigger で再生試行
```

ユーザーシナリオでの対応:

| シナリオ | 該当 Pass | 結果 |
|---------|----------|------|
| YouTube タブを 1つも開いていない | Pass 3 | 登録動画 URL で新規タブ |
| YouTube ホームを開いている | Pass 2 | 登録動画 URL に navigate |
| 登録動画 URL のタブを開いている (一時停止中) | Pass 1 | そのタブをアクティブ化、続きから再生 |

完了サイクル (`onCompletionDetected`):
1. 娯楽タブに PlaybackPause を注入 (動画を一時停止)
2. Claude.ai タブをアクティブ化
3. RuntimeState を Idle に戻す

---

## 10. 拡張機能ライフサイクル

### インストール時
1. `manifest.json` の `background.service_worker` で Service Worker が起動
2. `MessageRouter.init()` で `chrome.runtime.onMessage` リスナー登録
3. `RuntimeState.restoreFromSession()` で session 復元 (初回は何もない)
4. `chrome.action.onClicked` リスナー (アイコンクリックで Options Page 起動)
5. `chrome.runtime.onInstalled` ログ出力

### Claude.ai タブを開いた時
1. `manifest.json` の `content_scripts.matches` で `claude_site_adapter.js` が静的注入
2. ClaudeSiteAdapter の IIFE が起動
3. `loadAndWatchThreshold` でしきい値を取得 + storage.onChanged を購読
4. MutationObserver を `document.body` に張る (attributes / childList / subtree)
5. 初回 `onDomMutation()` で IDLE 判定

### 待ち発生サイクル
1. Claude.ai のプロンプト送信で停止ボタンが出現
2. ClaudeSiteAdapter が STREAMING 遷移、N秒タイマー開始
3. N秒経過しても継続 → WAITING、`WAIT_DETECTED` 送信
4. WaitOrchestrator が受信、TabManager.findOrOpenPlaySite で 2パス探索
5. injectPlaybackTrigger でタブ完了待ち→注入

### 完了サイクル
1. Claude.ai の停止ボタンが消失
2. ClaudeSiteAdapter が WAITING → IDLE 遷移、`COMPLETION_DETECTED` 送信
3. WaitOrchestrator が受信、injectPlaybackPause で娯楽タブ一時停止
4. Claude.ai タブをアクティブ化 (フォールバックで findClaudeTab)
5. RuntimeState を Idle にリセット

### Service Worker のアイドルアンロード/再起動
- Manifest V3 の Service Worker は使われていない時に自動でアンロード
- 次のメッセージ受信で再起動 → MessageRouter.init() 再実行 → RuntimeState.restoreFromSession() で状態復元

### 拡張機能更新時
- `chrome://extensions/` の更新ボタンで SW は再起動
- 既に開いている Claude.ai タブの Content Script は **古いコードのまま** 残る (Chrome 仕様)
- このため `Extension context invalidated.` が一時的に出る → タブをリロードすれば解消 (Content Script でガード実装済)

---

## 関連ドキュメント

- ユーザー向けインストール手順: `extension/README.md`
- バックログ (次にやること): `docs/backlog.md`
- 次サイクルへの引き継ぎ: `docs/cycle-4-handover.md`
- cycle-3 開始時の手引き (履歴): `docs/cycle-3-handover.md`
- 詳細な設計経緯 (cycle archives):
  - cycle-1 (MVP):
    - 要件: `aidlc-docs-waitless-archive/cycle-1/inception/requirements/requirements.md`
    - Application Design: `aidlc-docs-waitless-archive/cycle-1/inception/application-design/application-design.md`
    - Functional Design: `aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/functional-design/`
    - Build & Test 手順: `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/`
  - cycle-2 (遷移先バリエーション拡大):
    - 要件: `aidlc-docs-waitless-archive/cycle-2/inception/requirements/requirements.md`
    - 実行計画: `aidlc-docs-waitless-archive/cycle-2/inception/plans/execution-plan.md`
    - コード変更サマリ: `aidlc-docs-waitless-archive/cycle-2/construction/waitless-extension/code/code-generation-summary.md`
    - Build & Test サマリ: `aidlc-docs-waitless-archive/cycle-2/construction/build-and-test/build-and-test-summary.md`
  - cycle-3 (Reader Page 追加):
    - 要件: `aidlc-docs-waitless-archive/cycle-3/inception/requirements/requirements.md`
    - 実行計画: `aidlc-docs-waitless-archive/cycle-3/inception/plans/execution-plan.md`
    - Application Design: `aidlc-docs-waitless-archive/cycle-3/inception/application-design/application-design.md`
    - Functional Design: `aidlc-docs-waitless-archive/cycle-3/construction/waitless-extension/functional-design/`
    - コード変更サマリ: `aidlc-docs-waitless-archive/cycle-3/construction/waitless-extension/code/code-generation-summary.md`
    - Build & Test サマリ: `aidlc-docs-waitless-archive/cycle-3/construction/build-and-test/build-and-test-summary.md`
