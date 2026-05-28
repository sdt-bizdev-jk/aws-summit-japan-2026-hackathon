# cycle-4 — Services

最終更新: 2026-05-27

cycle-4 の **サービス層** (オーケストレーション、ライフサイクル、外界との境界) を定義する。

---

## 1. サービスの考え方

cycle-1〜3 と同様、cycle-4 でも「サービス」は **コンポーネントを組み合わせて 1 つのユースケースを完遂させる調整役** として位置づける。クラウド的な「マイクロサービス」の意味ではない。

cycle-4 の主要サービスは 1 つ:

- **WaitCycleService** — 待ち時間の 1 サイクル (開始 → ブラウザ起動 → 戻り) を完遂する

これに加えて、ライフサイクル系の補助サービスが 2 つ:

- **IdeExtensionService** — VS Code 拡張機能の起動・終了とリソース管理
- **ChromeExtensionBridgeService** — Chrome 拡張側 IdeBridge のライフサイクル管理

---

## 2. WaitCycleService (中心サービス)

### 2.1 責務

cycle-4 の核となるユースケース「AI 待ち時間の体験 1 サイクル」を実装する:

1. **開始フェーズ** (`startWaiting()`)
   - 設定読み込み (enabled チェック)
   - URL リストのマージ (Source A + B)
   - 優先順位順で 1 件選択
   - 外部ブラウザで開く (IPC 経由 or フォールバック)

2. **完了フェーズ** (`endWaiting()`)
   - 動画一時停止 (IPC 経由)
   - Kiro ウィンドウを最前面化

### 2.2 主なオーケストレーションパターン

```
startWaiting():
  SettingsReader.getSettings()
    └→ enabled=false なら return (no-op、FR-55)
  UrlListMerger.merge()
    ├→ IpcClient.request("GET_SITES") (Source A)
    └→ SettingsReader.getSettings().urls (Source B、フォールバック)
  UrlSelector.select(merged)
    └→ null なら return (空リスト時 no-op、FR-56)
  BrowserLauncher.open(url)
    ├→ IPC 接続中: ipc.request("FIND_OR_OPEN_TAB")
    └→ IPC 未接続/失敗: vscode.env.openExternal(uri)
  state = 'waiting'
```

```
endWaiting():
  IpcClient.notify("PAUSE_MEDIA") (notify、応答待たない)
  WindowActivator.activateKiro()
    └→ child_process.execFile("osascript", ["-e", "tell application \"Kiro\" to activate"])
  state = 'idle'
```

### 2.3 関与コンポーネント

`WaitOrchestratorIde` を本体として、以下のコンポーネントを協調させる:

- SettingsReader
- IpcClient
- UrlListMerger
- UrlSelector
- BrowserLauncher
- WindowActivator

### 2.4 状態管理

サービスは内部的に `WaitState` (`'idle'` / `'waiting'`) を保持。連続コマンド実行 (Q11 関連、Hook が誤発火した場合等) を idempotent に扱うため:

- `startWaiting()` を `state='waiting'` で呼ばれた場合、現在の URL を上書きせず無視 (no-op、ログ出力のみ)
- `endWaiting()` を `state='idle'` で呼ばれた場合、osascript だけ走らせて完了 (媒体一時停止はスキップ)

---

## 3. IdeExtensionService (ライフサイクルサービス)

### 3.1 責務

VS Code 拡張機能の起動 / 終了時に必要なリソースの確保 / 解放を行う:

- **activate 時**:
  - SettingsReader 初期化
  - IpcClient.start() (Q5=A により activate 時即起動)
  - WaitOrchestratorIde インスタンス生成
  - CommandRegistry.registerCommands()
  - context.subscriptions に dispose 対象を登録 (設定購読、コマンド disposable、IPC server)

- **deactivate 時**:
  - IpcClient.stop()
  - 進行中の WaitCycle があれば endWaiting() を呼んで cleanup

### 3.2 関与コンポーネント

- ExtensionLifecycle (実装の入口)
- 上記 §2.3 のすべて
- CommandRegistry

### 3.3 エラーハンドリング

- IpcClient.start() がポート 39472 既使用で失敗した場合: ログ出力のみ、機能としては「IPC 接続不可」状態で続行 (フォールバックで `vscode.env.openExternal` のみ動作)
- 拡張機能アクティベーション中の例外は `output channel` (`WaitLess (cycle-4)`) に出力

---

## 4. ChromeExtensionBridgeService (ライフサイクルサービス)

### 4.1 責務

Chrome 拡張側の IdeBridge の起動 / 切断を管理する:

- **Service Worker 起動時** (Q4=A): `IdeBridge.init()` を `service_worker.js` 最初で呼ぶ
- **Options Page トグル変更時** (FR-61): `chrome.storage.local.ipc_enabled` を購読、true/false 切替で `init()` / `shutdown()`
- **再接続戦略**: WebSocket 切断検知時、指数バックオフで再接続を試みる (FR-51)

### 4.2 関与コンポーネント

- IdeBridge (本体)
- 既存の WaitOrchestrator / TabManager / SettingsRepository / PlaybackPause (callback で呼ばれる、無変更)

### 4.3 既存サービスとの関係

cycle-1〜3 で確立した既存サービス層 (cycle-1 archive の services.md 参照) は **無変更**:

- WaitOrchestrationService (待ち→切替→完了→戻り、Claude.ai シナリオ)
- TabManagementService (2 パス探索 + 動的注入)
- SettingsManagementService (CRUD + バリデーション)

cycle-4 では **ChromeExtensionBridgeService** が **横から** 既存サービスにアクセスする (例: TabManager.findOrOpenPlaySite を IdeBridge が呼ぶ) が、既存サービス側のコードは触らない。

---

## 5. サービス間の通信パターン

| 経路 | 通信方式 | 用途 |
|---|---|---|
| Kiro Hook → CommandRegistry | `runCommand` (Hook → Command Palette) | 待ち開始 / 終了トリガー |
| CommandRegistry → WaitOrchestratorIde | 直接メソッド呼び出し | サービス起動 |
| WaitOrchestratorIde → IpcClient | 直接メソッド呼び出し | IPC 送信 |
| IpcClient → IdeBridge | WebSocket (JSON メッセージ) | 双方向 IPC (FR-52) |
| IdeBridge → 既存 WaitOrchestrator/TabManager | 直接モジュール呼び出し (Service Worker 内) | コア機能を呼び出す |
| OptionsAppIpcToggle → IdeBridge | `chrome.storage.local.onChanged` 経由 | トグル変更を反映 |

---

## 6. サービスの起動順序

```
時刻 t0: Kiro IDE 起動 + VS Code 拡張 activate
   ├→ IdeExtensionService.activate()
   │     ├→ SettingsReader 初期化
   │     ├→ IpcClient.start() (port 39472、bind 127.0.0.1)
   │     └→ CommandRegistry.registerCommands()

時刻 t1: ユーザーが Chrome を起動 + WaitLess 拡張がロード
   └→ ChromeExtensionBridgeService 起動 (service_worker.js)
        └→ IdeBridge.init()
             └→ WebSocket connect to ws://127.0.0.1:39472 (成功)
                  └→ 双方向通信開始

時刻 t2: ユーザーが Kiro でプロンプト送信
   └→ Hook (promptSubmit) 発火
        └→ "code --command waitless.startWaiting" 実行
             └→ CommandRegistry callback → WaitOrchestratorIde.startWaiting()
                  ├→ UrlListMerger.merge() → IpcClient.request("GET_SITES") → IdeBridge → SettingsRepository → SITES_RESPONSE
                  ├→ UrlSelector.select() → 1 件選択
                  └→ BrowserLauncher.open() → IpcClient.request("FIND_OR_OPEN_TAB") → IdeBridge → TabManager → TAB_OPENED

時刻 t3: AI 応答完了
   └→ Hook (agentStop) 発火
        └→ "code --command waitless.endWaiting" 実行
             └→ CommandRegistry callback → WaitOrchestratorIde.endWaiting()
                  ├→ IpcClient.notify("PAUSE_MEDIA") → IdeBridge → TabManager.injectPlaybackPause()
                  └→ WindowActivator.activateKiro() → osascript

時刻 t4 以降: 次のサイクルへ (state は idle に戻っているので t2 と同じフローを繰り返せる)
```

---

## 7. cycle-1〜3 のサービスとの関係

| サイクル | サービス名 | cycle-4 での扱い |
|---|---|---|
| cycle-1 | WaitOrchestrationService (Claude.ai 監視 → 切替 → 完了 → 戻り) | **無変更**。Claude.ai シナリオは引き続き独立して動作 |
| cycle-1 | TabManagementService | **無変更**。IdeBridge から間接的に呼ばれる |
| cycle-1 | SettingsManagementService | **無変更**。IdeBridge から間接的に呼ばれる |
| cycle-2 | (新規サービスなし) | — |
| cycle-3 | ReaderPageService (Reader Page、組込小説の永続化) | **無変更**。cycle-4 の体験には関与しない |
| cycle-4 | **WaitCycleService** | 新規。Kiro Hook 起点の体験を実装 |
| cycle-4 | **IdeExtensionService** | 新規。VS Code 拡張のライフサイクル |
| cycle-4 | **ChromeExtensionBridgeService** | 新規。Chrome 拡張側の IPC ブリッジライフサイクル |

cycle-4 のサービスは **既存 cycle-1〜3 のサービスを置き換えない**、横に追加する形。
