# cycle-4 — Components

最終更新: 2026-05-27

cycle-4 で扱う **全コンポーネント** の責務を定義する。物理的なファイル分割は **Q1=C (extension.ts 1 ファイル + 既存 ide_bridge.js 1 ファイル)** に従うため、TypeScript としてはモジュール分割せずに **論理的な責務ブロック (concern)** として整理する。

---

## 1. Unit 1: vscode-extension (TypeScript、新規)

物理ファイル: `vscode-extension/src/extension.ts` 1 ファイル (Q1=C 確定)。

論理コンポーネント (file 内の concern として):

### 1.1 ExtensionLifecycle (cycle-4 新規)

- **責務**: `activate(context)` / `deactivate()` のエントリ。VS Code Extension API のライフサイクルに乗っかる
- **入力**: `vscode.ExtensionContext`
- **出力**: 初期化完了 + 各 concern の起動 + ステータスバー / コマンド登録

### 1.2 CommandRegistry (cycle-4 新規)

- **責務**: 2 つの Command Palette コマンド (`waitless.startWaiting` / `waitless.endWaiting`) を VS Code に登録し、それぞれ WaitOrchestratorIde の対応メソッドを呼び出す
- **依存**: WaitOrchestratorIde
- **コマンド名は確定**: Q3=C により `waitless.startWaiting` / `waitless.endWaiting` (要件の FR-41/46 で示した `waitless-ide.onAiBusy` / `onAiIdle` から変更、本ドキュメントが正)

### 1.3 WaitOrchestratorIde (cycle-4 新規)

- **責務**: cycle-4 のコア。「待ち開始」「待ち終了」のサイクル全体をオーケストレーションする
- **状態**: `idle` / `waiting` の 2 状態
- **依存**: SettingsReader, IpcClient, BrowserLauncher, WindowActivator
- **設計上の注**: cycle-1 の WaitOrchestrator (Chrome 拡張側) と命名を区別するため `Ide` サフィックスを付与

### 1.4 SettingsReader (cycle-4 新規)

- **責務**: `vscode.workspace.getConfiguration('aiWaitLessMode')` から `urls` / `enabled` を読み取り、設定変更を購読する
- **依存**: なし (VS Code Extension API のみ)
- **設計上の注**: Q6=A 確定により、`urls` は **Chrome 拡張未起動時のフォールバック用** という位置づけ。デフォルト `[]` (空)

### 1.5 IpcClient (cycle-4 新規)

- **責務**: ローカル WebSocket サーバー (FR-50、Q5=A 確定で activate 時即起動) を立て、Chrome 拡張からの接続を待ち受ける
- **メッセージプロトコル**: FR-52 の 7 タイプ (`GET_SITES` / `SITES_RESPONSE` / `FIND_OR_OPEN_TAB` / `TAB_OPENED` / `PAUSE_MEDIA` / `MEDIA_PAUSED` / `PING`-`PONG`)
- **バージョニング**: Q2=B 確定により、明示的な version フィールドなし
- **依存**: Node.js `ws` ライブラリ (vscode-extension の package.json で依存追加)
- **設計上の注**: 接続は **Chrome 拡張側がクライアント** で、VS Code 側がサーバー (FR-50/51)

### 1.6 UrlSelector (cycle-4 新規)

- **責務**: URL リストから 1 件を **優先順位順 (priority=1 を最優先)** で選ぶ (Final-2=C 確定)
- **入力**: マージ済の URL リスト (`{ url, priority }[]` 形式に正規化)
- **出力**: 選ばれた 1 件の URL 文字列
- **設計上の注**: cycle-1〜3 の 2 パス探索の Pass 3 (新規タブ探索ロジック) はここでは **しない**。あくまで「どの URL を Chrome 拡張に処理依頼するか」だけ決める。タブ探索は Chrome 拡張側で実行 (FR-44)

### 1.7 BrowserLauncher (cycle-4 新規)

- **責務**: 選ばれた URL を外部ブラウザで開く。Chrome 拡張連動が成功する場合は `FIND_OR_OPEN_TAB` を IPC 経由で送り、失敗する場合は `vscode.env.openExternal(uri)` でフォールバック
- **依存**: IpcClient, vscode.env
- **設計上の注**: フォールバック判定の閾値は IPC 接続タイムアウト (5 秒、R-03 緩和策)

### 1.8 WindowActivator (cycle-4 新規)

- **責務**: macOS で `osascript -e 'tell application "Kiro" to activate'` を実行し、Kiro ウィンドウを最前面に引き出す
- **依存**: Node.js `child_process` (`execFile` を使用、シェルインジェクション対策 NFR-29)
- **設計上の注**: Q1=C より同じ extension.ts に書くが、関数として分離。ハードコード `appName = "Kiro"`、将来は設定化 (R-02)

### 1.9 UrlListMerger (cycle-4 新規)

- **責務**: Source A (Chrome 拡張の sites) と Source B (`aiWaitLessMode.urls`) をマージして 1 つの URL 候補リストを返す
- **入力**: `sitesFromChrome: { domain, url, priority }[] | null` + `urlsFromSettings: string[]`
- **出力**: `{ url, priority }[]` の正規化リスト
- **マージ規則**: Q6=A 確定により **Source A 優先、B はフォールバック**。A が `null` (IPC 失敗) または空配列のときのみ B を `priority=1, 2, 3, ...` の順で使う

---

## 2. Unit 2: chrome-extension-bridge (JavaScript、既存への追加)

物理ファイル: `extension/sw/ide_bridge.js` 1 ファイル新規 (Q1=C と整合した最小ファイル数方針) + `extension/service_worker.js` への 1 行 import 追加 + Options Page への IPC トグル追加。

### 2.1 IdeBridge (cycle-4 新規モジュール)

- **責務**: WebSocket クライアントとして VS Code 側 IpcClient (上記 §1.5) に接続し、両側のメッセージプロトコルを実装する
- **接続タイミング**: Q4=A 確定により、Service Worker 起動と同時 (`init()` を `service_worker.js` 最初で呼び出し)
- **接続失敗時**: 指数バックオフで再試行 (FR-51)、最大 30 秒間隔
- **依存**: WaitOrchestrator (既存)、TabManager (既存)、SettingsRepository (既存)
  - 既存コンポーネントは **完全無変更** (FR-60 を厳守)。IdeBridge がこれらをラッパーとして呼ぶ
- **メッセージハンドラ**:
  - `GET_SITES` 受信 → SettingsRepository.getSettings() を呼んで `SITES_RESPONSE` 返却
  - `FIND_OR_OPEN_TAB` 受信 → TabManager.findOrOpenPlaySite() を呼んで `TAB_OPENED` 返却
  - `PAUSE_MEDIA` 受信 → 既存 PlaybackPause 注入 (TabManager 経由) → `MEDIA_PAUSED` 返却

### 2.2 OptionsAppIpcToggle (cycle-4 改修)

- **責務**: Options Page に IPC ON/OFF トグルを追加 (FR-61)
- **既存 OptionsApp / OptionsAPI への影響**: Minor (HTML に 1 セクション + JS で `chrome.storage.local.ipc_enabled` の get/set 追加)
- **依存**: 既存の OptionsApp, OptionsAPI
- **設計上の注**: トグル OFF 時は `IdeBridge.shutdown()` を呼んで WebSocket 切断、storage.onChanged で IdeBridge が反応

---

## 3. Unit 3: agent-hooks-templates (静的 JSON、新規)

物理ファイル: `vscode-extension/templates/hooks/` 配下に 2 ファイル

### 3.1 OnPromptSubmitHook (cycle-4 新規)

- **責務**: Kiro の `promptSubmit` イベントで `waitless.startWaiting` を `runCommand` で実行する Hook 定義
- **形式**: JSON、Hook Schema に準拠 (`name`, `version`, `when.type`, `then.type`, `then.command`)
- **配布**: テンプレートとして `vscode-extension/templates/hooks/01-on-prompt-submit.json` に置き、README で「ユーザーが `.kiro/hooks/` に手動コピー」を案内

### 3.2 OnAgentStopHook (cycle-4 新規)

- **責務**: Kiro の `agentStop` イベントで `waitless.endWaiting` を `runCommand` で実行する Hook 定義
- **形式**: JSON、Hook Schema に準拠
- **配布**: テンプレート `vscode-extension/templates/hooks/02-on-agent-stop.json`

---

## 4. 既存コンポーネントの位置づけ (cycle-4 では無変更)

cycle-1〜3 で確立した以下のコンポーネントは **完全無変更** で cycle-4 でも引き続き動作する (NFR-27 後方互換性):

| コンポーネント | ファイル | cycle-4 の扱い |
|---|---|---|
| MessageRouter | `extension/sw/message_router.js` | 無変更 |
| WaitOrchestrator | `extension/sw/wait_orchestrator.js` | 無変更 (IdeBridge から間接的に呼ばれる) |
| TabManager | `extension/sw/tab_manager.js` | 無変更 (IdeBridge から間接的に呼ばれる) |
| SettingsRepository | `extension/sw/settings_repository.js` | 無変更 (IdeBridge から間接的に呼ばれる) |
| RuntimeState | `extension/sw/runtime_state.js` | 無変更 |
| ClaudeSiteAdapter | `extension/content/claude_site_adapter.js` | 無変更 (cycle-4 のフロー単体では関与しないが、cycle-1〜3 経由で動く Claude.ai シナリオは継続) |
| PlaybackTrigger | `extension/content/playback_trigger.js` | 無変更 |
| PlaybackPause | `extension/content/playback_pause.js` | 無変更 (IdeBridge の `PAUSE_MEDIA` から呼ばれる) |
| ReaderApp | `extension/reader/reader.js` | 無変更 (cycle-3 で追加、cycle-4 のフローには関与しない) |

---

## 5. cycle-4 全体のコンポーネント一覧 (要約)

| Unit | コンポーネント名 | 種別 | 責務一行 |
|---|---|---|---|
| 1 | ExtensionLifecycle | 新規 | activate/deactivate のエントリ |
| 1 | CommandRegistry | 新規 | Command Palette コマンド登録 |
| 1 | WaitOrchestratorIde | 新規 | 待ちサイクルのオーケストレーション (IDE 側) |
| 1 | SettingsReader | 新規 | settings.json 読み込み + 変更購読 |
| 1 | IpcClient | 新規 | WebSocket サーバー (Chrome 拡張からの接続を受ける側) |
| 1 | UrlSelector | 新規 | 優先順位順で URL を選ぶ |
| 1 | BrowserLauncher | 新規 | 外部ブラウザで URL を開く (IPC + フォールバック) |
| 1 | WindowActivator | 新規 | osascript で Kiro 最前面化 |
| 1 | UrlListMerger | 新規 | Source A と B のマージ |
| 2 | IdeBridge | 新規 | Chrome 拡張側の WebSocket クライアント + メッセージハンドラ |
| 2 | OptionsAppIpcToggle | 改修 | Options Page の IPC ON/OFF トグル |
| 3 | OnPromptSubmitHook | 新規 | Kiro Hook テンプレート (待ち開始) |
| 3 | OnAgentStopHook | 新規 | Kiro Hook テンプレート (待ち終了) |

合計 13 コンポーネント (新規 12、改修 1)。
