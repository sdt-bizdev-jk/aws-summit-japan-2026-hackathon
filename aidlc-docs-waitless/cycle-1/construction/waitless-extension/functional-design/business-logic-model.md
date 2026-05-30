# Business Logic Model — waitless-extension

**プロジェクト**: WaitLess
**ユニット**: U1 (waitless-extension)
**フェーズ**: CONSTRUCTION - Functional Design
**作成日**: 2026-05-26

このドキュメントは、Unit U1 の中核アルゴリズムを **疑似コード** で詳細化する。具体的なファイル/関数名は Application Design (`component-methods.md`) と整合させる。技術非依存ではあるが、Chrome 拡張機能 + 素のJS 前提を反映する。

---

## 1. ClaudeSiteAdapter — ストリーミング状態判定

### 1.0 待ち時間の起点 (確認済)

「待ち時間」は **プロンプト送信直後から計測する** (思考時間、web検索、応答生成のすべての期間を含む)。
Claude.ai の現行UIでは送信ボタンが送信直後に **停止ボタン** に置き換わり、応答生成完了 (思考/検索の終了も含む) で送信ボタンに戻る。
したがって「停止ボタンの表示時間 ≒ プロンプト送信直後からの全待ち時間」となり、停止ボタンの存在をシグナルにする本仕様で要件と一致する。

### 1.1 ステートマシン

```
                    +--------------------+
                    |   IDLE             |
                    | (停止ボタンなし)     |
                    +--------+-----------+
                             |
                             | 停止ボタン出現を MutationObserver が検知
                             v
                    +--------------------+
                    |   STREAMING        |
                    | (停止ボタンあり)     |
                    | + N秒タイマー開始    |
                    +-------+-+----------+
                            | |
       N秒経過 (停止ボタン継続) |   停止ボタン消失 (タイマー残時間)
                            v |
              +--------------+ |
              |  WAITING     | | (タイマー残時間)
              |  (WAIT_      | v
              |  DETECTED    | +-----+----------+
              |  送信済)      |        |
              +-------+------+        v
                      |        +-----+-----------+
                      | 停止ボタン消失 |  IDLE       |
                      |              |  (タイマー  |
                      v              |   キャンセル) |
              +-------+------+        +----------+
              | COMPLETION   |
              | _DETECTED    |
              | 送信         |
              +-------+------+
                      |
                      v
                    [IDLE へ戻る]
```

### 1.2 疑似コード: `init()`

```
function init():
    threshold_sec = await loadThreshold()  // SettingsRepository から取得
    state = 'IDLE'
    waitTimerId = null
    waitDetectedSent = false

    // しきい値の動的更新を購読
    chrome.storage.onChanged.addListener(changes => {
        if (changes.threshold_sec):
            threshold_sec = changes.threshold_sec.newValue

    // DOM 変化を監視
    observer = new MutationObserver(onDomMutation)
    observer.observe(document.body, { childList: true, subtree: true })

    // 初期状態の判定
    onDomMutation()
```

### 1.3 疑似コード: `onDomMutation()`

```
function onDomMutation():
    isStreaming = detectStreamingState()  // 停止ボタンの存在を確認

    if isStreaming and state == 'IDLE':
        // ストリーミング開始
        state = 'STREAMING'
        startWaitTimer()

    elif not isStreaming and state == 'STREAMING':
        // 短い応答 (N秒未満で完了) → タイマー破棄、何も送らない
        cancelWaitTimer()
        state = 'IDLE'

    elif not isStreaming and state == 'WAITING':
        // 完了検知 → COMPLETION_DETECTED
        sendMessage('COMPLETION_DETECTED', { claudeTabId: getCurrentTabId() })
        state = 'IDLE'
        waitDetectedSent = false

    // それ以外 (state==STREAMING かつ isStreaming==true) は何もしない (タイマー継続)
    // それ以外 (state==WAITING かつ isStreaming==true) も何もしない (まだ続いている)
```

### 1.4 疑似コード: `startWaitTimer()` / `cancelWaitTimer()`

```
function startWaitTimer():
    waitTimerId = setTimeout(() => {
        // N秒経過、ストリーミング継続中
        if state == 'STREAMING':
            state = 'WAITING'
            sendMessage('WAIT_DETECTED', {
                claudeTabId: getCurrentTabId(),
                durationMs: threshold_sec * 1000
            })
            waitDetectedSent = true
    }, threshold_sec * 1000)

function cancelWaitTimer():
    if waitTimerId:
        clearTimeout(waitTimerId)
        waitTimerId = null
```

### 1.5 疑似コード: `detectStreamingState()`

```
function detectStreamingState() -> 'streaming' | 'idle':
    // セレクタ戦術: 属性優先 → テキストフォールバック (Q2=C)
    // 具体セレクタは Code Generation 時に DevTools で実機確認 (Q2=D)

    // 候補1: 属性ベース (例)
    el = document.querySelector('[aria-label="Stop response"]')
        || document.querySelector('[data-testid="stop-button"]')
        // ... 実機確認で確定する候補リスト

    if el:
        return 'streaming'

    // 候補2: テキストフォールバック
    buttons = document.querySelectorAll('button')
    for b in buttons:
        if b.textContent.trim() in ['Stop', '停止']:
            if isVisible(b):
                return 'streaming'

    return 'idle'
```

### 1.6 タブIDの取得

Content Script は自分のタブIDを直接知らないため、Service Worker に問い合わせるか、待ち発生時に `null` を渡し、Service Worker 側で `sender.tab.id` から取得する方針:

```
sendMessage('WAIT_DETECTED', { claudeTabId: null /* SW で sender.tab.id を使う */, durationMs })
```

Service Worker の MessageRouter で `sender.tab.id` を WaitOrchestrator に渡す。

---

## 2. WaitOrchestrator — 待ち発生サイクル

### 2.1 疑似コード: `onWaitDetected(claudeTabId, durationMs)`

```
async function onWaitDetected(claudeTabId, durationMs):
    // 重複イベント抑制 (Property 1)
    if RuntimeState.isWaiting():
        return  // 既に待ち中、何もしない

    await RuntimeState.setWaiting(true)
    await RuntimeState.setClaudeTabId(claudeTabId)

    sites = await SettingsRepository.getSites()  // priority 昇順
    if sites.length == 0:
        // 登録ゼロ件、何もしない (Options Page 側で空状態案内)
        await RuntimeState.setWaiting(false)
        return

    result = await TabManager.findOrOpenPlaySite(sites)
    // result = { tabId, opened: 'existing' | 'new' }

    if result.opened == 'new':
        await TabManager.injectPlaybackTrigger(result.tabId)
    // 'existing' の場合、再生中ならそのまま、停止中なら PlaybackTrigger を任意で注入してもよい
    // (Q3=D の方針: 主要サイト固有セレクタで試行)
    else:
        await TabManager.injectPlaybackTrigger(result.tabId)  // 再生再開試行

    await RuntimeState.setPlayTabId(result.tabId)
```

---

## 3. WaitOrchestrator — 完了サイクル

### 3.1 疑似コード: `onCompletionDetected(claudeTabId)`

```
async function onCompletionDetected(claudeTabId):
    if not RuntimeState.isWaiting():
        return  // ガード: 待ち中でなければ no-op

    // 娯楽タブの動画を一時停止 (戻る前に)
    playTabId = RuntimeState.getPlayTabId()
    if playTabId is not None:
        await TabManager.injectPlaybackPause(playTabId)

    targetTabId = RuntimeState.getClaudeTabId() || claudeTabId

    if targetTabId and await TabManager.tabExists(targetTabId):
        await TabManager.activateTab(targetTabId)
    else:
        // フォールバック: Claude.ai タブを再探索
        fallbackTabId = await TabManager.findClaudeTab()
        if fallbackTabId:
            await TabManager.activateTab(fallbackTabId)
        // それでも見つからなければ no-op

    await RuntimeState.setWaiting(false)
    await RuntimeState.setPlayTabId(null)
    await RuntimeState.setClaudeTabId(null)
```

---

## 4. TabManager — `findOrOpenPlaySite(sites)` アルゴリズム

### 4.1 ポリシー (Q4 確定)
- 探索範囲: **現在のフォーカスウィンドウのタブのみ** (Q4-1=A)
- 一致判定: **ドメイン一致** (Q4-2=C)
- URL は新規作成時のみ使用

### 4.2 疑似コード

```
async function findOrOpenPlaySite(sites) -> { tabId, opened }:
    // 1. 現在のフォーカスウィンドウを取得
    currentWindow = await chrome.windows.getLastFocused({ populate: true })

    // 2. Pass 1: URL 完全一致を最優先 (続きから再生意図)
    for site in sites:
        for tab in currentWindow.tabs:
            if tab.url == site.url:
                return { tabId: tab.id, opened: 'existing' }

    // 3. Pass 2: ドメイン一致 → 登録 URL に navigate
    for site in sites:
        for tab in currentWindow.tabs:
            if tab.url and extractDomain(tab.url) == site.domain:
                await chrome.tabs.update(tab.id, { url: site.url, active: true })
                return { tabId: tab.id, opened: 'navigated' }

    // 4. Pass 3: ヒットなし → 優先順位 1位 のサイトで新規タブを開く
    topSite = sites[0]
    newTab = await chrome.tabs.create({
        url: topSite.url,
        active: true,
        windowId: currentWindow.id
    })

    return { tabId: newTab.id, opened: 'new' }


function extractDomain(url) -> string:
    try:
        return new URL(url).hostname.replace(/^www\./, '')  // www は除去して比較
    except:
        return ''
```

### 4.3 `activateTab(tabId)` 疑似コード

```
async function activateTab(tabId):
    tab = await chrome.tabs.get(tabId)
    await chrome.tabs.update(tabId, { active: true })
    await chrome.windows.update(tab.windowId, { focused: true })
```

### 4.4 `findClaudeTab()` 疑似コード

```
async function findClaudeTab() -> tabId | null:
    tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' })
    if tabs.length == 0:
        return null
    // 複数あった場合、最後にアクティブだったタブを優先 (best-effort)
    sorted = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
    return sorted[0].id
```

### 4.5 `injectPlaybackTrigger(tabId)` 疑似コード

```
async function injectPlaybackTrigger(tabId):
    try:
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/playback_trigger.js']
        })
    catch e:
        console.warn('[WaitLess] PlaybackTrigger injection failed', e)
        // 黙って許容
```

---

## 5. PlaybackTrigger — 再生試行アルゴリズム (Q3=D)

### 5.1 疑似コード (即時実行関数)

```
(function tryPlay() {
    const SITE_SELECTORS = [
        // YouTube
        '.ytp-large-play-button',
        '.ytp-play-button',
        // Vimeo
        'button.vp-controls-play',
        // ニコニコ動画
        '.MainVideoPlayer button[aria-label="再生"]',
        // 汎用 (動画埋め込みサイト全般)
        // 最後の手段は <video> 要素
    ]

    // 1. サイト固有セレクタを順に試す
    for (const sel of SITE_SELECTORS) {
        const btn = document.querySelector(sel)
        if (btn && isVisible(btn)) {
            try {
                btn.click()
                return  // クリック試行で終了
            } catch (e) { /* 黙って続行 */ }
        }
    }

    // 2. 汎用 <video> 要素を play() 試行
    const videos = document.querySelectorAll('video')
    for (const v of videos) {
        try {
            v.play()  // Promise を返す。失敗しても catch で握る
                .catch(() => {})
            return
        } catch (e) {}
    }

    // 3. ここまで来たら何もしない (静かに諦める)
})()
```

### 5.2 設計上の注意
- ブラウザのオートプレイポリシーでは、ユーザー操作なしの `play()` が拒否されるケースがある
- `.click()` も同様に Synthetic Event 扱いで拒否されうる
- これらの失敗は ユーザー体験を止めない (要件 §10.3 既知リスク)、コンソールに warn を出すのみ

---

## 6. しきい値の動的反映フロー

### 6.1 シーケンス

```
[OptionsApp]
  |
  | onChangeThreshold(sec)
  v
[OptionsAPI.setThresholdSec(sec)]
  |
  | sendMessage('SET_THRESHOLD', { thresholdSec: sec })
  v
[MessageRouter] -> [SettingsRepository.setThresholdSec(sec)]
  |
  | バリデーション (1〜60 整数、Q6=A)
  | OK: chrome.storage.local.set({ threshold_sec: sec })
  | NG: { ok: false, reason } を返す
  v
[storage.onChanged 発火]
  |
  v
[ClaudeSiteAdapter のリスナー]
  |
  | threshold_sec = changes.threshold_sec.newValue
  v
次のストリーミング検知から新値を使用
```

### 6.2 設計ポイント
- 既に startWaitTimer 中に値が変わっても、現サイクルは古い値で完了させ、次サイクルから新値を反映 (シンプルさ優先)
- バリデーション失敗は OptionsApp 側でエラー表示し、保存させない (Q6-2=A)

---

## 7. RuntimeState の状態遷移と永続化

### 7.1 状態遷移

```
[Idle]
  isWaiting=false, claudeTabId=null, playTabId=null
        |
        | onWaitDetected
        v
[Waiting]
  isWaiting=true, claudeTabId=<id>, playTabId=<id>
        |
        | onCompletionDetected (タブ存在 OR フォールバック成功)
        v
[Idle]

# 異常系: タブ消失等で reset() が呼ばれると即 [Idle]
```

### 7.2 Service Worker 再起動時の復元

Manifest V3 の Service Worker はアイドル時にアンロードされる。次のメッセージで再起動する際、メモリ状態は失われている。これに耐えるため:

```
on Service Worker 起動:
    runtime_state = { isWaiting: false, claudeTabId: null, playTabId: null }
    saved = await chrome.storage.session.get('runtime_state')
    if saved.runtime_state:
        runtime_state = saved.runtime_state

# 状態書き込み時は同時に session ストレージにも反映:
async function setWaiting(bool):
    runtime_state.isWaiting = bool
    await chrome.storage.session.set({ runtime_state })
```

session ストレージはブラウザセッション終了で消える、永続ローカル設定 (sites/threshold_sec) とは分離されている。

---

## 8. メッセージ受信 → 処理のディスパッチ (MessageRouter)

### 8.1 疑似コード

```
function init():
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        return handle(message, sender, sendResponse)
    })

function handle(message, sender, sendResponse) -> bool:
    switch (message.type):
        case 'WAIT_DETECTED':
            tabId = sender.tab?.id || message.payload.claudeTabId
            WaitOrchestrator.onWaitDetected(tabId, message.payload.durationMs)
            return false  // 応答不要
        case 'COMPLETION_DETECTED':
            tabId = sender.tab?.id || message.payload.claudeTabId
            WaitOrchestrator.onCompletionDetected(tabId)
            return false
        case 'GET_SETTINGS':
            SettingsRepository.getSettings().then(s => sendResponse(s))
            return true  // 非同期応答
        case 'ADD_SITE':
            SettingsRepository.addSite(message.payload).then(r => sendResponse(r))
            return true
        case 'UPDATE_SITE':
            SettingsRepository.updateSite(message.payload).then(r => sendResponse(r))
            return true
        case 'DELETE_SITE':
            SettingsRepository.deleteSite(message.payload.domain).then(r => sendResponse(r))
            return true
        case 'REORDER_SITES':
            SettingsRepository.reorderSites(message.payload.orderedDomains).then(r => sendResponse(r))
            return true
        case 'SET_THRESHOLD':
            SettingsRepository.setThresholdSec(message.payload.thresholdSec).then(r => sendResponse(r))
            return true
        default:
            return false  // 不明タイプは黙って無視
```

### 8.2 設計ポイント
- 非同期応答が必要なメッセージは `return true` を忘れない (Manifest V3 / Chrome の sendMessage 仕様)
- ペイロード未着 / 型違い はガードで握り、ログ出力 + sendResponse で `{ ok: false, reason: 'invalid_payload' }`

---

## 9. 拡張機能アイコンクリック挙動 (Q8=A)

```
chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage()
})
```

ポップアップなし、クリックでオプションページが開く。これは `manifest.json` で `action.default_popup` を **指定しない** 必要がある。

---

## 10. 全体の整合とトレーサビリティ

| 章 | カバーする FR | カバーする US |
|----|--------------|--------------|
| §1 ClaudeSiteAdapter | FR-01, FR-02, FR-03, FR-07 | US-01 |
| §2 待ち発生サイクル | FR-03, FR-05, FR-06 | US-01, US-02, US-03 |
| §3 完了サイクル | FR-07, FR-08 | US-04 |
| §4 TabManager | FR-05, FR-06, FR-08 | US-02, US-04 |
| §5 PlaybackTrigger | FR-06 | US-03 |
| §6 しきい値反映 | FR-11 | US-05 |
| §7 RuntimeState | (横断、Property 1, 2 を支える) | (横断) |
| §8 MessageRouter | (全 FR の経路) | (全 US の経路) |
| §9 アイコン | FR-09 (オプション開示) | US-05 |
