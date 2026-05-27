# Components — WaitLess

**プロジェクト**: WaitLess
**フェーズ**: INCEPTION - Application Design
**作成日**: 2026-05-26

---

## 1. アーキテクチャ概要

WaitLess は Manifest V3 の Chrome 拡張機能として、以下の 3層 + 1ストア で構成される。

```
+----------------------------------------------------------------+
|  [Options Page]   options.html / options.js                    |
|       |                                                        |
|       | sendMessage (req/res)                                  |
|       v                                                        |
|  [Service Worker]   service_worker.js + sw/*.js                |
|   - MessageRouter / WaitOrchestrator                           |
|   - TabManager / SettingsRepository / RuntimeState             |
|       ^                                                        |
|       | sendMessage (待ち発生 / 完了)                          |
|       |                                                        |
|  [Content Script (Claude.ai)]   claude_site_adapter.js         |
|                                                                |
|  [Content Script (娯楽タブ、動的注入)]   playback_trigger.js   |
|                                                                |
|  [chrome.storage.local]   sites[], threshold_sec               |
|  [chrome.storage.session] (任意) RuntimeState 復元用           |
+----------------------------------------------------------------+
```

---

## 2. コンポーネント詳細

### 2.1 MessageRouter (Service Worker 内)

| 項目 | 内容 |
|------|------|
| 種別 | Service Worker モジュール |
| ファイル | `extension/sw/message_router.js` |
| 目的 | `chrome.runtime.onMessage` の受信窓口として、メッセージタイプ別に WaitOrchestrator / SettingsRepository / TabManager にルーティングする |
| 主な責務 | メッセージタイプ判別、レスポンスの sendResponse 呼び出し、不明メッセージの安全な無視 |
| インタフェース | `init()` で onMessage リスナー登録、各ハンドラを内部関数として保持 |
| 依存 | WaitOrchestrator, SettingsRepository, TabManager |

### 2.2 WaitOrchestrator (Service Worker 内)

| 項目 | 内容 |
|------|------|
| 種別 | Service Worker モジュール (中心) |
| ファイル | `extension/sw/wait_orchestrator.js` |
| 目的 | 「待ち発生 → 娯楽タブ自動切替 → 完了検知 → AIタブ自動戻り」というサイクルの全体を司る |
| 主な責務 | 待ち発生イベント受領 → TabManager 呼出, 完了イベント受領 → TabManager 呼出, RuntimeState の遷移管理 |
| インタフェース | `onWaitDetected(claudeTabId)`, `onCompletionDetected(claudeTabId)` |
| 依存 | TabManager, SettingsRepository, RuntimeState |
| 関連 FR | FR-03 (発火受領), FR-05/06 (切替), FR-07/08 (戻り) |

### 2.3 TabManager (Service Worker 内)

| 項目 | 内容 |
|------|------|
| 種別 | Service Worker モジュール |
| ファイル | `extension/sw/tab_manager.js` |
| 目的 | `chrome.tabs.*` のすべての操作を集約する。優先順位ベースの娯楽タブ探索、アクティブ化、新規作成、PlaybackTrigger 注入 |
| 主な責務 | 既存タブ探索 (URL/ドメイン一致)、アクティブ化、新規タブ作成、Claude.ai タブへの戻り、PlaybackTrigger 動的注入 |
| インタフェース | `findOrOpenPlaySite(sites)`, `activateTab(tabId)`, `openNewTab(url)`, `injectPlaybackTrigger(tabId)`, `findClaudeTab()` |
| 依存 | (Chrome API のみ) |
| 関連 FR | FR-05, FR-06, FR-08 |

### 2.4 SettingsRepository (Service Worker 内)

| 項目 | 内容 |
|------|------|
| 種別 | Service Worker モジュール |
| ファイル | `extension/sw/settings_repository.js` |
| 目的 | `chrome.storage.local` に格納されたユーザー設定 (`sites`, `threshold_sec`) の読み書きを集約 |
| 主な責務 | スキーマ定義、デフォルト値補完、CRUD、優先順位ソート、`storage.onChanged` の発火源 |
| インタフェース | `getSettings()`, `updateSettings(partial)`, `getSites()`, `addSite(site)`, `updateSite(site)`, `deleteSite(domain)`, `reorderSites(orderedDomains)`, `getThreshold()`, `setThreshold(sec)` |
| 依存 | (Chrome API のみ) |
| 関連 FR | FR-04, FR-09, FR-10, FR-11 |

### 2.5 RuntimeState (Service Worker 内)

| 項目 | 内容 |
|------|------|
| 種別 | Service Worker モジュール (実行時状態保持) |
| ファイル | `extension/sw/runtime_state.js` |
| 目的 | 「現在 待ち中か」「直近の Claude.ai タブID」「直近にアクティブ化した娯楽タブID」を保持。Service Worker のメモリで保持し、必要時 `chrome.storage.session` で復元 |
| 主な責務 | 状態の読み書き、再起動時の復元、状態リセット |
| インタフェース | `isWaiting()`, `setWaiting(bool)`, `getClaudeTabId()`, `setClaudeTabId(id)`, `getPlayTabId()`, `setPlayTabId(id)`, `reset()` |
| 依存 | (Chrome API のみ) |
| 関連 FR | (内部状態、FR-03/05/08 の補助) |

### 2.6 ClaudeSiteAdapter (Content Script: Claude.ai)

| 項目 | 内容 |
|------|------|
| 種別 | Content Script |
| ファイル | `extension/content/claude_site_adapter.js` |
| 目的 | Claude.ai の DOM を MutationObserver で監視し、ストリーミング応答の開始/継続/完了を判定する。N秒以上 継続したら「待ち発生」イベントを Service Worker に送信。完了を検知したら「完了」イベントを送信 |
| 主な責務 | DOM シグナル特定 (停止ボタン、ストリーミングインジケータ等)、しきい値タイマー管理、イベント送信 |
| インタフェース | (グローバルにエントリ関数 `init()` のみ。内部に状態を持つ) |
| 依存 | `chrome.runtime.sendMessage`, `chrome.storage.onChanged` (しきい値の動的更新を受領) |
| 関連 FR | FR-01, FR-02, FR-03, FR-07 |

### 2.7 PlaybackTrigger (Content Script: 娯楽タブ、動的注入)

| 項目 | 内容 |
|------|------|
| 種別 | Content Script (動的注入、Service Worker から `chrome.scripting.executeScript` で注入) |
| ファイル | `extension/content/playback_trigger.js` |
| 目的 | URL パラメータ (`?autoplay=1` 等) で自動再生が効かないサイトに対し、ページ内の再生ボタンを試行クリックする |
| 主な責務 | サイト別の再生ボタン特定 (best-effort)、クリック試行、失敗時は静かに無視 |
| インタフェース | 注入された即時実行関数 |
| 依存 | (DOM のみ) |
| 関連 FR | FR-06 (動画再生試行) |

### 2.8 OptionsApp (Options Page)

| 項目 | 内容 |
|------|------|
| 種別 | Options Page (HTML + JS) |
| ファイル | `extension/options/options.html`, `extension/options/options.js`, `extension/options/options.css` |
| 目的 | ユーザーが娯楽サイトの登録/編集/削除/並び替えと、しきい値設定を行うUI。初回利用時のオンボーディング表示も担う |
| 主な責務 | UI レンダリング、ユーザー操作のハンドリング、空状態 (登録 0件) のオンボーディング案内表示、入力バリデーション |
| インタフェース | 画面ローカル (DOM イベントハンドラ) |
| 依存 | OptionsAPI |
| 関連 FR | FR-04, FR-09, FR-11 |
| 関連 US | US-05, US-06 |

### 2.9 OptionsAPI (Options Page)

| 項目 | 内容 |
|------|------|
| 種別 | Options Page 内のラッパーモジュール |
| ファイル | `extension/options/options.js` の中の名前空間 (または別ファイルに分離してもよい) |
| 目的 | Service Worker (SettingsRepository) との sendMessage 通信を OptionsApp から隠蔽する |
| 主な責務 | sendMessage プロミス化、レスポンス受信、エラーハンドリング |
| インタフェース | `getSettings()`, `addSite(site)`, `updateSite(site)`, `deleteSite(domain)`, `reorderSites(orderedDomains)`, `setThreshold(sec)` |
| 依存 | `chrome.runtime.sendMessage` |
| 関連 FR | FR-09, FR-10, FR-11 |

---

## 3. コンポーネント横断の関心事

### 3.1 メッセージタイプ (sendMessage)
| Type | 方向 | ペイロード | 応答 |
|------|------|-----------|------|
| `WAIT_DETECTED` | Content → SW | `{ claudeTabId, durationMs }` | なし |
| `COMPLETION_DETECTED` | Content → SW | `{ claudeTabId }` | なし |
| `GET_SETTINGS` | Options → SW | なし | `{ sites, thresholdSec }` |
| `ADD_SITE` / `UPDATE_SITE` / `DELETE_SITE` / `REORDER_SITES` | Options → SW | サイト情報 | `{ ok: true }` または `{ ok: false, reason }` |
| `SET_THRESHOLD` | Options → SW | `{ thresholdSec }` | `{ ok: true }` |

### 3.2 storage.onChanged の用途
| キー | リスナー | 用途 |
|------|---------|------|
| `threshold_sec` | ClaudeSiteAdapter | Options で変更されたしきい値を即時反映 |
| `sites` | (任意) WaitOrchestrator | 次回切替判定で常に最新を読むためロード時参照でも可 |

---

## 4. アンチスコープに対応する明示的な不在

要件 §7 のアンチスコープに対応し、本設計には以下のコンポーネントを **意図的に持たない**:

- 統計記録/集計コンポーネント (アンチスコープ #1)
- ON/OFFトグル管理コンポーネント (アンチスコープ #6)
- ポップアップUI (`browser_action` のポップアップ、アンチスコープ #7)
- i18n リソース管理 (アンチスコープ #9)
- 端末間同期コンポーネント (アンチスコープ #3)

ツールバーアイコンは Manifest V3 の `action` を最小限に宣言する (オプションページを開く程度の挙動、ポップアップは持たない)。
