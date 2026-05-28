# cycle-4 — Unit 1 (vscode-extension) — Business Logic Model

最終更新: 2026-05-27

Unit 1 (`vscode-extension`) のビジネスロジックを技術非依存に近い形で記述する。実装上の TypeScript 型は `domain-entities.md` を、ビジネスルールは `business-rules.md` を、NFR の inline 対応は `nfr-inline.md` を参照。

---

## 1. ロジックの全体像

Unit 1 のロジックは **「待ちサイクル」** という 1 つのユースケースを中心に構成される。サイクルは以下の 2 つのコマンドで操作される:

```
[コマンド startWaiting] : AI 待ち時間が始まったことを宣言
[コマンド endWaiting]   : AI 完了 / 入力要求が来たことを宣言
```

これらのコマンドは **Kiro Agent Hook から `runCommand` で発火される** ことを想定 (Q2=C 前提)。同等のコマンドが Command Palette からも手動で叩ける。

---

## 2. 状態モデル

```
                    startWaiting
                       コマンド
            ┌────────────────────┐
            v                    │
    ┌──────────────┐    ┌──────────────────┐
    │   IDLE       │    │   WAITING        │
    │              │    │                  │
    │ サイクル待機 │    │ ブラウザ表示中   │
    │              │    │                  │
    └──────────────┘    └──────────────────┘
            ^                    │
            │                    v
            └────────────────────┘
                    endWaiting
                       コマンド
```

- 初期状態: `IDLE`
- `IDLE` で `startWaiting` 受信 → 待ち開始フローを実行 → `WAITING` に遷移
- `WAITING` で `endWaiting` 受信 → 戻りフローを実行 → `IDLE` に遷移
- **不正遷移の扱い**:
  - `WAITING` で `startWaiting` 受信 → no-op + 警告ログ (BR-43)
  - `IDLE` で `endWaiting` 受信 → osascript だけ実行して完了 (媒体停止スキップ、BR-44)

---

## 3. 待ち開始フロー (`startWaiting()`)

```
1. enabled チェック
   ├─ aiWaitLessMode.enabled = false → no-op で return (BR-41)
   └─ true なら継続

2. 状態チェック
   ├─ state = WAITING → no-op + 警告ログ (BR-43)
   └─ IDLE なら継続

3. URL リスト取得 (UrlListMerger)
   ├─ Source A 試行: IpcClient.request("GET_SITES", {}, timeout=5s)
   │  ├─ 成功 + sites.length > 0 → A を採用 (BR-45)
   │  └─ 失敗 / タイムアウト / 空配列 → Source B にフォールバック (BR-46)
   ├─ Source B: vscode.workspace.getConfiguration('aiWaitLessMode').urls
   │  └─ 配列を { url, priority: 1+index } の形に正規化
   └─ 両方空 → no-op で return (BR-47)

4. URL 選択 (UrlSelector)
   └─ priority=1 を選ぶ (BR-48: 優先順位順、cycle-1〜3 と同じ)

5. ブラウザ起動 (BrowserLauncher)
   ├─ IPC 接続中: IpcClient.request("FIND_OR_OPEN_TAB", { url }, timeout=5s)
   │  ├─ 成功 (TAB_OPENED 受信) → 完了
   │  └─ 失敗 → vscode.env.openExternal フォールバック (BR-49)
   └─ IPC 未接続: 即フォールバック (BR-49)

6. 状態遷移
   └─ state = WAITING に変更
```

---

## 4. 待ち終了フロー (`endWaiting()`)

```
1. 状態チェック
   ├─ state = IDLE → スキップ可能だが、osascript は実行する (BR-44)
   └─ WAITING なら通常フロー

2. 動画一時停止指示 (state = WAITING のときのみ)
   └─ IpcClient.notify("PAUSE_MEDIA", {})  ※ notify、応答待たない (BR-50)

3. Kiro ウィンドウ最前面化 (WindowActivator)
   └─ child_process.execFile(
        "osascript",
        ["-e", 'tell application "Kiro" to activate']
      )  ※ シェルインジェクション対策 (BR-51)
     ├─ 成功 → ログ
     └─ 失敗 → console.warn のみ、サイクル全体としては完了扱い (BR-52)

4. 状態遷移
   └─ state = IDLE に変更
```

---

## 5. URL リストのマージロジック (BR-45, BR-46)

### 5.1 入力

- **Source A** (Chrome 拡張の sites): `{ domain, url, priority }[]` または `null` (IPC 失敗時)
- **Source B** (settings.json): `string[]` (URL の配列、デフォルト `[]`)

### 5.2 マージアルゴリズム

```
function merge(A, B) {
  if (A != null && A.length > 0) {
    // Source A 採用 (BR-45)
    return A.map(({ url, priority }) => ({ url, priority }))
            .sort((x, y) => x.priority - y.priority);
  }
  
  // Source B にフォールバック (BR-46)
  if (B.length === 0) return [];
  
  return B.map((url, index) => ({
    url,
    priority: index + 1  // 設定順を priority に使用
  }));
}
```

### 5.3 結果

`{ url: string, priority: number }[]`、priority 昇順 (1 が最優先)。

---

## 6. IPC メッセージ往復のシーケンス

### 6.1 接続確立 (時系列)

```
[VS Code activate]
  IpcClient.start() → ws://127.0.0.1:39472 で listen 開始

[Chrome 拡張 Service Worker 起動]
  IdeBridge.init() → ws://127.0.0.1:39472 に connect

[接続確立]
  IpcClient: 'connection' イベント → 接続情報を保持
  IdeBridge: 'open' イベント → 接続フラグ true

[ヘルスチェックループ開始]
  両側から 30 秒ごとに PING を送る、PONG で生存確認
```

### 6.2 GET_SITES 往復 (`startWaiting` 中)

```
VS Code 側                                Chrome 側
─────────────                              ─────────────
UrlListMerger.merge()
  └→ IpcClient.request("GET_SITES")
     └→ ws.send({ type: "GET_SITES",
                  requestId: "uuid-a" })  ───→ IdeBridge._handleMessage()
                                                └→ SettingsRepository.getSites()
                                                └→ ws.send({ type: "SITES_RESPONSE",
                                                             requestId: "uuid-a",
                                                             payload: { sites: [...] }})
        ←─── (5秒以内に受信)             ←─── ws.send
     └→ Promise resolve with sites

タイムアウト時 (5秒経過):
     └→ Promise reject → catch で Source B にフォールバック (BR-46)
```

### 6.3 FIND_OR_OPEN_TAB 往復

```
VS Code 側                                Chrome 側
─────────────                              ─────────────
BrowserLauncher.open(url)
  └→ ipc.isConnected() === true
     └→ IpcClient.request("FIND_OR_OPEN_TAB",
                          { url })       ───→ IdeBridge._handleMessage()
                                                └→ TabManager.findOrOpenPlaySite([{url, priority:1}])
                                                └→ TabManager.injectPlaybackTrigger(tabId)
                                                └→ ws.send({ type: "TAB_OPENED",
                                                             payload: { tabId, pass } })
        ←─── (5秒以内に受信)             ←─── ws.send

タイムアウト時:
     └→ vscode.env.openExternal(uri) フォールバック (BR-49)
```

### 6.4 PAUSE_MEDIA 通知 (`endWaiting` 中)

```
VS Code 側                                Chrome 側
─────────────                              ─────────────
WaitOrchestratorIde.endWaiting()
  └→ IpcClient.notify("PAUSE_MEDIA")     ───→ IdeBridge._handleMessage()
     (応答待たない、BR-50)                       └→ TabManager.injectPlaybackPause(playTabId)
                                                  ※ playTabId は IdeBridge が保持 (BR-53)
                                                └→ (オプション) ws.send({ type: "MEDIA_PAUSED" })
                                                  ※ VS Code 側は受信しても無視 (notify なので)
```

---

## 7. エラーハンドリングモデル

| エラーシナリオ | 検知 | 対応 | 関連 BR |
|---|---|---|---|
| IPC ポート 39472 既使用 | `IpcClient.start()` が EADDRINUSE で失敗 | エラーログ + `isConnected = false` 状態で続行。フォールバック動作のみ (BR-54) | BR-54 |
| IPC タイムアウト (5秒) | `IpcClient.request()` の Promise が timeout | catch で Source B フォールバック (`merge`) または `vscode.env.openExternal` (`open`) | BR-46, BR-49 |
| osascript 失敗 (アプリ名違い、Apple Events 未許可) | `child_process.execFile` の exit code != 0 | console.warn、サイクルは完了扱い | BR-52 |
| 設定の `urls` に不正な URL | `vscode.env.openExternal` が throw、または事前 URL.parse 失敗 | 不正な URL はスキップ、有効分のみ使用 | BR-55 |
| 設定の `urls` がすべて不正 | merge 後に空配列 | `startWaiting` を no-op で return | BR-47 |
| WebSocket 切断 (Service Worker idle unload) | `ws` の close イベント | VS Code 側は次のリクエストで isConnected=false 検知 → フォールバック | NFR-28 |
| Hook が発火しない | (検知不可) | Command Palette から手動で `waitless.startWaiting` 等を実行可能 (UX 救済) | BR-56 |

---

## 8. 状態の永続化方針

cycle-4 Unit 1 では **状態を永続化しない**。理由:

- `WaitState` は短いサイクル (秒〜分) しか保たれない
- VS Code 拡張の reload で状態をリセットしても問題ない (むしろ確実な reset 機会)
- cycle-1〜3 の `chrome.storage.session` 相当の機構は VS Code 拡張側にも存在するが、cycle-4 のシンプルさを優先

**結果**: 状態は `WaitOrchestratorIde` インスタンスのメモリ内のみ。activate/deactivate でリセット。

---

## 9. cycle-1〜3 のロジックとの関係

| cycle | ロジック領域 | cycle-4 Unit 1 との関係 |
|---|---|---|
| cycle-1 | WAIT_DETECTED / COMPLETION_DETECTED フロー (Chrome 拡張内) | **完全独立** (Unit 1 は `chrome.runtime.sendMessage` を使わない、IPC 経由のみ) |
| cycle-1 | 2 パス探索 (TabManager) | Unit 1 は **直接実行しない**、IPC 経由で IdeBridge にリクエストを送るだけ |
| cycle-2 | (新規ロジックなし) | — |
| cycle-3 | Reader Page のクリック既読化 / 永続化 | **完全独立** (Unit 1 は Reader Page を意識しない) |

cycle-4 で初めて、**Chrome 拡張の機能を別プロセス (IDE 拡張) から駆動する**という構図が生まれる。

---

## 10. 関連ドキュメント

- ビジネスルール: `business-rules.md`
- ドメインエンティティ: `domain-entities.md`
- NFR inline 対応: `nfr-inline.md`
- Application Design: `aidlc-docs/inception/application-design/application-design.md`
