# Component Methods — WaitLess

**プロジェクト**: WaitLess
**フェーズ**: INCEPTION - Application Design
**作成日**: 2026-05-26

このドキュメントは、各コンポーネントの **主要メソッドのシグネチャ** と **高レベルな目的** を定義する。詳細な業務ルール (アルゴリズム、分岐条件、エッジケース) は **Functional Design (per-unit, CONSTRUCTION フェーズ)** で扱う。

すべて素の JavaScript (Manifest V3) として実装される前提。型表記はコメント / JSDoc 風で示す (TypeScript は使わない方針)。

---

## 1. MessageRouter

```js
// extension/sw/message_router.js

/**
 * onMessage リスナーを登録し、メッセージタイプ別にハンドラへルーティングする。
 * 起動時に 1度だけ呼ぶ。
 */
init()  // -> void

/**
 * 内部: メッセージを処理する。タイプ不明なものは安全に無視。
 * @param message  { type: string, payload?: any }
 * @param sender   chrome.runtime.MessageSender
 * @param sendResponse  function (応答が必要なメッセージのみ呼ぶ)
 */
handle(message, sender, sendResponse)  // -> boolean (非同期応答時 true を返す)
```

依存先: `WaitOrchestrator`, `SettingsRepository`, `TabManager`

---

## 2. WaitOrchestrator

```js
// extension/sw/wait_orchestrator.js

/**
 * 「待ち発生」イベントを受領し、優先順位ベースで娯楽タブへ切替を依頼する。
 * @param claudeTabId  発火元の Claude.ai タブの ID
 * @param durationMs   既に経過した待ち時間 (ms、参考情報)
 */
async onWaitDetected(claudeTabId, durationMs)  // -> void

/**
 * 「完了検知」イベントを受領し、Claude.ai タブへ戻る。
 * @param claudeTabId  発火元の Claude.ai タブの ID
 */
async onCompletionDetected(claudeTabId)  // -> void

/**
 * 待ち中状態のリセット (タブが閉じた等の異常系リカバリ用)。
 */
async reset()  // -> void
```

依存先: `TabManager`, `SettingsRepository`, `RuntimeState`

---

## 3. TabManager

```js
// extension/sw/tab_manager.js

/**
 * 登録された娯楽サイトのうち、優先順位上位から順に既存タブの一致を探し、
 * ヒットすればそのタブをアクティブ化、なければ最上位の URL で新規タブを開いてアクティブ化する。
 * @param sites  優先順位ソート済の [{ domain, url, priority }, ...]
 * @returns  { tabId: number, opened: 'existing' | 'new' }
 */
async findOrOpenPlaySite(sites)  // -> Promise<{ tabId, opened }>

/**
 * タブをアクティブ化 (タブの windowId にもフォーカスを与える)。
 * @param tabId
 */
async activateTab(tabId)  // -> Promise<void>

/**
 * URL で新規タブを開く。アクティブ化はオプション。
 * @param url
 * @param active  default true
 */
async openNewTab(url, active = true)  // -> Promise<number>  // 開いたタブの ID

/**
 * 動的に PlaybackTrigger を注入する。失敗しても呼び出し元はクラッシュさせない。
 * @param tabId
 */
async injectPlaybackTrigger(tabId)  // -> Promise<void>

/**
 * Claude.ai タブを 1つ探す。複数あった場合は最も最近アクティブだったもの (best-effort)。
 * @returns  number | null
 */
async findClaudeTab()  // -> Promise<number | null>

/**
 * 指定タブが現存するかを確認。
 * @param tabId
 */
async tabExists(tabId)  // -> Promise<boolean>
```

依存先: Chrome API (`chrome.tabs.*`, `chrome.windows.*`, `chrome.scripting.*`)

---

## 4. SettingsRepository

```js
// extension/sw/settings_repository.js

/**
 * 設定全体を取得 (なければデフォルトを返す)。
 * @returns  { sites: Site[], thresholdSec: number }
 *           Site = { domain: string, url: string, priority: number }
 */
async getSettings()  // -> Promise<{ sites, thresholdSec }>

/**
 * 部分更新 (内部で full merge してから保存)。
 * @param partial  { sites?, thresholdSec? }
 */
async updateSettings(partial)  // -> Promise<void>

/**
 * サイト一覧を優先順位昇順で取得。
 */
async getSites()  // -> Promise<Site[]>

/**
 * サイト追加。同一 domain が既にあればエラー。
 * @param site  { domain, url }  (priority は内部で末尾に付与)
 */
async addSite(site)  // -> Promise<{ ok, reason? }>

/**
 * サイト更新 (domain で識別)。
 * @param site  { domain, url }
 */
async updateSite(site)  // -> Promise<{ ok, reason? }>

/**
 * サイト削除。
 * @param domain
 */
async deleteSite(domain)  // -> Promise<{ ok, reason? }>

/**
 * 並び順を更新する。orderedDomains の順で priority を 1, 2, 3 ... と再採番する。
 * @param orderedDomains  ['youtube.com', 'x.com', ...]
 */
async reorderSites(orderedDomains)  // -> Promise<{ ok, reason? }>

/**
 * しきい値 (秒) を取得 (デフォルト 5)。
 */
async getThresholdSec()  // -> Promise<number>

/**
 * しきい値 (秒) を設定 (1〜60 の範囲、範囲外は拒否)。
 * @param sec
 */
async setThresholdSec(sec)  // -> Promise<{ ok, reason? }>
```

依存先: `chrome.storage.local`

---

## 5. RuntimeState

```js
// extension/sw/runtime_state.js
// Service Worker のメモリで保持。Service Worker 再起動時に session ストレージから復元する。

/**
 * 待ち中フラグ。
 */
isWaiting()  // -> boolean
async setWaiting(bool)  // -> Promise<void>

/**
 * Claude.ai タブの ID (待ち発生時に記録)。
 */
getClaudeTabId()  // -> number | null
async setClaudeTabId(tabId)  // -> Promise<void>

/**
 * 直近にアクティブ化した娯楽タブの ID。
 */
getPlayTabId()  // -> number | null
async setPlayTabId(tabId)  // -> Promise<void>

/**
 * Service Worker 起動時に session ストレージから復元する。
 */
async restoreFromSession()  // -> Promise<void>

/**
 * 全状態をクリアする (異常系リカバリ用)。
 */
async reset()  // -> Promise<void>
```

依存先: `chrome.storage.session`

---

## 6. ClaudeSiteAdapter

```js
// extension/content/claude_site_adapter.js
// Claude.ai タブにマッチングして注入される Content Script。

/**
 * エントリ。MutationObserver の起動、しきい値の取得、storage.onChanged 監視 を行う。
 * 1度だけ呼ぶ。
 */
init()  // -> void

/**
 * 内部: ストリーミング状態の判定 (DOM シグナル)。
 * @returns  'streaming' | 'idle'
 *
 * 詳細な判定ロジック (どの要素を見るか) は Functional Design で定義する。
 */
detectStreamingState()  // -> 'streaming' | 'idle'

/**
 * 内部: ストリーミング開始時にタイマーを開始する。N秒経過で WAIT_DETECTED を送信。
 */
startWaitTimer()  // -> void

/**
 * 内部: ストリーミング終了を検知したら、タイマーキャンセル または COMPLETION_DETECTED 送信。
 */
handleStreamingEnd()  // -> void

/**
 * 内部: 設定の threshold_sec を SettingsRepository から取得 (sendMessage 経由) し、保持する。
 * storage.onChanged で変更時に更新する。
 */
async loadAndWatchThreshold()  // -> Promise<void>
```

依存先: `chrome.runtime.sendMessage`, `chrome.storage.onChanged`, DOM API (MutationObserver, etc.)

---

## 7. PlaybackTrigger

```js
// extension/content/playback_trigger.js
// 娯楽タブに動的注入される Content Script。即時実行関数として書く。

/**
 * (即時実行) ページ内の動画再生ボタンを試行クリックする。
 * - サイト別の best-effort セレクタ群を順に試す。
 * - クリック失敗 / セレクタ不在 は黙って終了。
 *
 * 詳細なセレクタリスト と 試行順序は Functional Design で定義する。
 */
(function tryPlay() { /* ... */ })()
```

依存先: DOM API のみ

---

## 8. OptionsApp

```js
// extension/options/options.js (OptionsApp 部分)

/**
 * DOMContentLoaded で起動。設定をロードして UI をレンダリングし、各種イベントハンドラを登録する。
 */
async init()  // -> Promise<void>

/**
 * 内部: 設定ロード後に画面を描画する。空状態 (sites.length === 0) ならオンボーディング案内を表示。
 * @param settings  { sites, thresholdSec }
 */
render(settings)  // -> void

/**
 * 内部: フォーム送信ハンドラ。バリデーション後に OptionsAPI 経由で保存。
 */
async onSubmitAddSite(event)  // -> Promise<void>
async onClickDeleteSite(domain)  // -> Promise<void>
async onSubmitEditSite(event)  // -> Promise<void>
async onChangeOrder(orderedDomains)  // -> Promise<void>
async onChangeThreshold(sec)  // -> Promise<void>

/**
 * 内部: バリデーション。
 * @returns  { ok, reason? }
 */
validateSiteInput({ domain, url })  // -> { ok, reason? }
validateThresholdInput(sec)  // -> { ok, reason? }
```

依存先: OptionsAPI, DOM

---

## 9. OptionsAPI

```js
// extension/options/options.js (OptionsAPI 部分。または別ファイルに分割可)

/**
 * sendMessage の Promise ラッパー。
 * @param type  メッセージタイプ
 * @param payload  ペイロード
 */
async send(type, payload)  // -> Promise<any>

// 公開 API
async getSettings()  // -> Promise<{ sites, thresholdSec }>
async addSite(site)  // -> Promise<{ ok, reason? }>
async updateSite(site)  // -> Promise<{ ok, reason? }>
async deleteSite(domain)  // -> Promise<{ ok, reason? }>
async reorderSites(orderedDomains)  // -> Promise<{ ok, reason? }>
async setThresholdSec(sec)  // -> Promise<{ ok, reason? }>
```

依存先: `chrome.runtime.sendMessage`

---

## 10. データ型定義 (共通)

```js
/**
 * Site
 * @typedef {Object} Site
 * @property {string} domain    例: "youtube.com" (識別子。重複不可)
 * @property {string} url       自動再生用 URL (フルURL)
 * @property {number} priority  優先順位 (1 が最上位、連番)
 */

/**
 * Settings
 * @typedef {Object} Settings
 * @property {Site[]} sites
 * @property {number} thresholdSec  N秒判定しきい値 (デフォルト 5、範囲 1〜60)
 */
```

---

## 11. メソッド命名規約と非同期方針

- 非同期メソッドはすべて `async` を付け Promise を返す (`callback` スタイルは使わない)
- Chrome API のうち callback 形式しかないものは内部で Promise にラップ
- 例外は `try/catch` で握り、必要に応じてログ + 戻り値の `{ ok: false, reason }` で表現する
- グローバル変数は使わず、各モジュール内部に閉じ込める
- メソッド名は動詞ベース、データの読み出しは `get*`、書き込みは `set*` / `update*` / `add*` / `delete*` で統一

---

## 12. 詳細業務ロジックの送り先

以下は本ドキュメントでは定義せず、Functional Design (per-unit, CONSTRUCTION フェーズ) で扱う:

- ClaudeSiteAdapter の DOM シグナル特定 (具体的な CSS セレクタ、判定アルゴリズム)
- PlaybackTrigger のサイト別再生ボタンセレクタ群
- TabManager の優先順位探索アルゴリズムの詳細 (URL 一致 vs ドメイン一致のフォールバック順序、複数ウィンドウ間の探索ポリシー)
- SettingsRepository のスキーマバリデーション詳細 (URL 形式、ドメイン形式、長さ制限)
- WaitOrchestrator のタブ消失等の異常系リカバリ詳細
- しきい値の上限/下限のエッジケース挙動
