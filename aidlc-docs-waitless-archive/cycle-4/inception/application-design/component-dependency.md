# cycle-4 — Component Dependency

最終更新: 2026-05-27

cycle-4 のコンポーネント間の依存関係とデータフローを定義する。

---

## 1. 依存関係マトリクス

`X` 印 = 行のコンポーネントが列のコンポーネントを **呼び出す / 利用する** ことを示す。空欄 = 依存なし。

### 1.1 Unit 1: vscode-extension 内部

| 呼び出し元 ↓ \ 被呼び出し → | ExtensionLifecycle | CommandRegistry | WaitOrchestratorIde | SettingsReader | IpcClient | UrlSelector | BrowserLauncher | WindowActivator | UrlListMerger |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **ExtensionLifecycle** | — | X | X | X | X | | | | |
| **CommandRegistry** | | — | X | | | | | | |
| **WaitOrchestratorIde** | | | — | X | X | X | X | X | X |
| **SettingsReader** | | | | — | | | | | |
| **IpcClient** | | | | | — | | | | |
| **UrlSelector** | | | | | | — | | | |
| **BrowserLauncher** | | | | | X | | — | | |
| **WindowActivator** | | | | | | | | — | |
| **UrlListMerger** | | | | X | X | | | | — |

### 1.2 Unit 1 → Unit 2 (IPC 経由)

`IpcClient` (Unit 1) ⇔ WebSocket ⇔ `IdeBridge` (Unit 2) の双方向通信のみ。直接呼び出しはない (プロセス分離)。

### 1.3 Unit 2: chrome-extension-bridge 内部 + 既存への依存

| 呼び出し元 ↓ \ 被呼び出し → | IdeBridge | OptionsAppIpcToggle | (既存) WaitOrchestrator | (既存) TabManager | (既存) SettingsRepository |
|---|:---:|:---:|:---:|:---:|:---:|
| **IdeBridge** | — | | (なし) | X | X |
| **OptionsAppIpcToggle** | (経由 chrome.storage) | — | | | (経由 OptionsAPI) |

### 1.4 既存の呼び出し方向 (cycle-1〜3、無変更)

cycle-1〜3 の既存依存は無変更:

```
service_worker.js → MessageRouter → WaitOrchestrator → TabManager / SettingsRepository / RuntimeState
ClaudeSiteAdapter → MessageRouter (sendMessage 経由)
TabManager → 動的注入 PlaybackTrigger / PlaybackPause
ReaderApp → chrome.storage.local 直接アクセス (cycle-3)
```

cycle-4 で追加された依存:

```
service_worker.js → IdeBridge.init()  (1 行 import 追加)
IdeBridge → WaitOrchestrator (callback)
         → TabManager (callback)
         → SettingsRepository (callback)
```

依存方向: **常に下向き** (IdeBridge は既存コアコンポーネントを呼ぶが、既存からは IdeBridge を呼ばない)。**循環依存なし**。

---

## 2. データフロー図 (主要シナリオ)

### 2.1 シナリオ A: 待ち時間開始 (Hook 経由)

```
┌──────────────────┐
│ Kiro IDE         │
│ (User)           │
└────────┬─────────┘
         │ プロンプト送信
         v
┌──────────────────────────┐
│ Kiro Agent Hook System   │
│ (.kiro/hooks/01-on-      │
│  prompt-submit.json)     │
└────────┬─────────────────┘
         │ runCommand "code --command waitless.startWaiting"
         v
┌──────────────────────────┐
│ VS Code Extension Host   │
│ ┌──────────────────────┐ │
│ │ CommandRegistry      │ │
│ └────────┬─────────────┘ │
│          v                │
│ ┌──────────────────────┐ │
│ │ WaitOrchestratorIde  │ │
│ │ .startWaiting()      │ │
│ └────────┬─────────────┘ │
│          │                │
│          ├─→ SettingsReader.getSettings()
│          │     (enabled=true 確認)
│          │
│          ├─→ UrlListMerger.merge()
│          │     ├─→ IpcClient.request("GET_SITES")  ──┐
│          │     │                                      │
│          │     └─→ (フォールバック) settings.urls     │
│          │                                            │
│          ├─→ UrlSelector.select(merged)               │
│          │     return prioritized[0]                  │
│          │                                            │
│          └─→ BrowserLauncher.open(url)                │
│                ├─→ IpcClient.request("FIND_OR_OPEN_TAB")
│                │                                      │
│                └─→ (フォールバック) vscode.env.openExternal
└──────────────────────────────────────────────────────│
                                                       │ WebSocket
┌──────────────────────────────────────────────────────┴──┐
│ Chrome Browser (Service Worker)                          │
│ ┌──────────────────────┐                                 │
│ │ IdeBridge            │                                 │
│ │ ._handleMessage()    │                                 │
│ └────────┬─────────────┘                                 │
│          ├─→ SettingsRepository.getSettings()            │
│          │     return SITES_RESPONSE                     │
│          │                                               │
│          └─→ TabManager.findOrOpenPlaySite()             │
│                ├─→ Pass 1/2/3 探索                        │
│                ├─→ injectPlaybackTrigger() (動画再生試行)  │
│                └─→ return TAB_OPENED                     │
└──────────────────────────────────────────────────────────┘
                       │
                       v
                  ブラウザがフォアグラウンドに来る
```

### 2.2 シナリオ B: 待ち時間終了 (Hook 経由)

```
┌──────────────────┐
│ Kiro IDE         │
│ (AI 完了)        │
└────────┬─────────┘
         │ agentStop イベント
         v
┌──────────────────────────┐
│ Kiro Agent Hook System   │
│ (.kiro/hooks/02-on-      │
│  agent-stop.json)        │
└────────┬─────────────────┘
         │ runCommand "code --command waitless.endWaiting"
         v
┌──────────────────────────┐
│ VS Code Extension Host   │
│ ┌──────────────────────┐ │
│ │ CommandRegistry      │ │
│ └────────┬─────────────┘ │
│          v                │
│ ┌──────────────────────┐ │
│ │ WaitOrchestratorIde  │ │
│ │ .endWaiting()        │ │
│ └────────┬─────────────┘ │
│          │                │
│          ├─→ IpcClient.notify("PAUSE_MEDIA") ─────────┐
│          │                                            │
│          └─→ WindowActivator.activateKiro()           │
│                └─→ child_process.execFile(            │
│                      "osascript", ["-e",              │
│                      'tell application "Kiro"         │
│                       to activate'])                  │
│                                                       │
└───────────────────────────────────────────────────────│
                                                       │ WebSocket
┌──────────────────────────────────────────────────────┴──┐
│ Chrome Browser (Service Worker)                          │
│ ┌──────────────────────┐                                 │
│ │ IdeBridge            │                                 │
│ │ ._handleMessage()    │                                 │
│ └────────┬─────────────┘                                 │
│          │                                               │
│          └─→ TabManager.injectPlaybackPause()            │
│                └─→ 動画タブで video.pause() 実行          │
│                └─→ return MEDIA_PAUSED                   │
└──────────────────────────────────────────────────────────┘
                       │
                       v
        Kiro ウィンドウがフロントに来る (osascript で activate)
        ブラウザは閉じない / タブもそのまま
```

### 2.3 シナリオ C: IPC 接続失敗時のフォールバック

```
WaitOrchestratorIde.startWaiting()
  └→ UrlListMerger.merge()
       └→ IpcClient.request("GET_SITES") ─── タイムアウト 5秒 → throw
            (catch) → return [] (Source A 取得失敗)
       └→ SettingsReader.getSettings().urls (Source B)
            └→ priority=1,2,3,... に正規化して返す
  └→ UrlSelector.select(B)
       └→ Source B が空: return null → 全体 no-op
       └→ Source B に URL あり: 1 件選択
  └→ BrowserLauncher.open(url)
       └→ IpcClient.isConnected() = false
            └→ vscode.env.openExternal(uri) ─── OS デフォルトブラウザで開く
                 (Chrome 拡張連動なし、cycle-1〜3 機能は動作しない)
```

---

## 3. 通信パターン詳細

### 3.1 IPC メッセージプロトコル (FR-52、FR-43 統合版)

すべて JSON、双方向、`requestId` で request/response 紐付け:

| Type | Direction | Payload Schema | 用途 |
|------|-----------|---------------|------|
| `GET_SITES` | VS Code → Chrome | `{}` | sites リストを要求 |
| `SITES_RESPONSE` | Chrome → VS Code | `{ sites: { domain, url, priority }[] }` | sites リストを返す |
| `FIND_OR_OPEN_TAB` | VS Code → Chrome | `{ url: string }` | 2 パス探索 + タブ起動を依頼 |
| `TAB_OPENED` | Chrome → VS Code | `{ tabId: number, pass: 1\|2\|3 }` | どのパスで起動したか報告 |
| `PAUSE_MEDIA` | VS Code → Chrome | `{}` | 現在の娯楽タブの動画を一時停止 |
| `MEDIA_PAUSED` | Chrome → VS Code | `{ ok: boolean }` | 一時停止結果 |
| `PING` | 両方向 | `{}` | ヘルスチェック (30秒ごと) |
| `PONG` | 両方向 | `{}` | PING に対する応答 |

エラーレスポンス: `{ ok: false, reason: string }` 形式 (cycle-1〜3 の sendMessage と同じ規約)。

### 3.2 接続タイミング

```
時刻 t0: VS Code Extension activate
         IpcClient.start() → ws://127.0.0.1:39472 listen 開始

時刻 t1: Chrome Browser 起動 / Service Worker spin up
         IdeBridge.init() → ws://127.0.0.1:39472 connect

時刻 t2: 接続確立 → PING/PONG ヘルスチェック開始

時刻 t3: 通常のメッセージ往復 (シナリオ A/B)

時刻 t4: Service Worker idle unload (Manifest V3)
         WebSocket 切断
         → IpcClient 側は `isConnected = false` に

時刻 t5: 次のメッセージ受信で Service Worker spin up
         IdeBridge.init() 再実行 → 再接続

時刻 t6: VS Code Extension deactivate
         IpcClient.stop() → サーバー停止
         IdeBridge 側はまた指数バックオフで再接続を試みるが失敗し続ける
```

---

## 4. cycle-1〜3 既存依存への delta

cycle-4 で **追加される依存のみ** (既存は無変更):

```
service_worker.js
  └→ import IdeBridge from './sw/ide_bridge.js'   (1 行追加)

IdeBridge.init()
  └→ chrome.storage.local.get('ipc_enabled')      (新規読み取り)
  └→ new WebSocket('ws://127.0.0.1:39472')        (新規)

IdeBridge._handleMessage()
  └→ SettingsRepository.getSettings()             (既存呼び出し)
  └→ TabManager.findOrOpenPlaySite()              (既存呼び出し)
  └→ TabManager.injectPlaybackPause()             (既存呼び出し、cycle-1 の wait_orchestrator.js 内ロジックを抜き出して呼ぶ形)

OptionsApp (既存) への delta
  └→ initIpcToggle()                              (新規メソッド)
  └→ chrome.storage.local.set({ ipc_enabled })    (新規書き込み)
```

`extension/sw/wait_orchestrator.js` の `injectPlaybackPause` ロジックは現在 WaitOrchestrator 内のクロージャに閉じているため、cycle-4 で IdeBridge から呼ぶには TabManager 側にメソッドを 1 つ昇格させる必要がある (Functional Design で詳細化)。

---

## 5. 結論: 設計上の健全性

- **循環依存**: なし
- **既存への影響**: 最小限 (`service_worker.js` の 1 行 import + Options Page の トグル追加 + TabManager に 1 メソッド昇格の可能性)
- **拡張性**: IPC プロトコルに新メッセージタイプを追加する際は、両側に handler を 1 つずつ足すだけ
- **テスト可能性**: IpcClient と IdeBridge は WebSocket を介して分離されているため、片側を mock した単体検証が可能 (ただし cycle-4 では手動 E2E のみ)
