# cycle-4 — Component Methods

最終更新: 2026-05-27

各コンポーネントのメソッドシグネチャを定義する。詳細なビジネスルール / 実装ロジックは Functional Design (CONSTRUCTION phase per-unit) で確定する。

---

## 1. Unit 1: vscode-extension

すべて `vscode-extension/src/extension.ts` の中に定義する (Q1=C)。TypeScript で型は明示。

### 1.1 ExtensionLifecycle

```typescript
/**
 * VS Code が拡張機能をロードした時に呼ばれるエントリポイント。
 * 各 concern を初期化し、context.subscriptions に登録する。
 */
export async function activate(context: vscode.ExtensionContext): Promise<void>;

/**
 * VS Code が拡張機能をアンロードする時に呼ばれる。
 * IpcClient のサーバーを停止する。
 */
export async function deactivate(): Promise<void>;
```

### 1.2 CommandRegistry

```typescript
/**
 * Command Palette に 2 つのコマンドを登録する。
 * - "waitless.startWaiting"  → WaitOrchestratorIde.startWaiting()
 * - "waitless.endWaiting"    → WaitOrchestratorIde.endWaiting()
 */
function registerCommands(
  context: vscode.ExtensionContext,
  orchestrator: WaitOrchestratorIde
): void;
```

### 1.3 WaitOrchestratorIde

```typescript
type WaitState = 'idle' | 'waiting';

class WaitOrchestratorIde {
  private state: WaitState = 'idle';

  constructor(
    private settings: SettingsReader,
    private ipc: IpcClient,
    private launcher: BrowserLauncher,
    private activator: WindowActivator,
    private merger: UrlListMerger,
    private selector: UrlSelector
  );

  /**
   * AI 待ち開始時のフロー。
   * 1. enabled=false なら no-op
   * 2. state を 'waiting' に
   * 3. UrlListMerger で URL リストを取得
   * 4. 空なら何もしない (FR-56)
   * 5. UrlSelector で 1 件選ぶ
   * 6. BrowserLauncher で開く
   */
  async startWaiting(): Promise<void>;

  /**
   * AI 完了 / 入力要求時のフロー。
   * 1. state を 'idle' に
   * 2. IpcClient 経由で PAUSE_MEDIA を送る (現在開いているタブの動画を停止)
   * 3. WindowActivator で Kiro を最前面化
   */
  async endWaiting(): Promise<void>;
}
```

### 1.4 SettingsReader

```typescript
interface AiWaitLessSettings {
  urls: string[];
  enabled: boolean;
}

class SettingsReader {
  /**
   * 現在の settings.json から aiWaitLessMode 設定を読み取る。
   * デフォルト: { urls: [], enabled: true }
   */
  getSettings(): AiWaitLessSettings;

  /**
   * 設定変更時のコールバックを登録する。
   * vscode.workspace.onDidChangeConfiguration を内部で購読。
   */
  onDidChange(callback: (newSettings: AiWaitLessSettings) => void): vscode.Disposable;
}
```

### 1.5 IpcClient (実態は Server)

> **命名注**: 「IpcClient」と命名しているが、実装は WebSocket **サーバー**。Chrome 拡張側がクライアントとして接続してくる (FR-50/51)。
> 名前は「IPC を担当するモジュール」という意味で IpcClient/IpcEndpoint としても OK だが、本ドキュメントでは IpcClient で統一する (cycle-4 のスコープでは混乱しない)。

```typescript
/**
 * WebSocket メッセージタイプ (FR-52)。
 * version フィールドなし (Q2=B 確定)。
 */
type IpcMessageType =
  | 'GET_SITES'
  | 'SITES_RESPONSE'
  | 'FIND_OR_OPEN_TAB'
  | 'TAB_OPENED'
  | 'PAUSE_MEDIA'
  | 'MEDIA_PAUSED'
  | 'PING'
  | 'PONG';

interface IpcMessage<T = unknown> {
  type: IpcMessageType;
  payload?: T;
  requestId?: string;
}

interface SitesPayload {
  sites: Array<{ domain: string; url: string; priority: number }>;
}

interface FindOrOpenTabPayload {
  url: string;
}

interface TabOpenedPayload {
  tabId: number;
  pass: 1 | 2 | 3; // 2 パス探索 + 新規タブ
}

class IpcClient {
  /**
   * 127.0.0.1:39472 で WebSocket サーバーを起動。
   * Q5=A 確定により activate 時に呼ばれる。
   */
  async start(): Promise<void>;

  /**
   * サーバー停止。deactivate 時に呼ぶ。
   */
  async stop(): Promise<void>;

  /**
   * 接続中の Chrome 拡張に request を送り、response を待つ。
   * タイムアウトは 5 秒 (R-03 緩和策)。
   */
  async request<TReq, TRes>(
    type: IpcMessageType,
    payload: TReq,
    timeoutMs?: number
  ): Promise<TRes>;

  /**
   * 接続中の Chrome 拡張に通知を送る (response を待たない)。
   */
  notify<T>(type: IpcMessageType, payload: T): void;

  /**
   * 現在 Chrome 拡張が接続中か。
   */
  isConnected(): boolean;
}
```

### 1.6 UrlSelector

```typescript
interface PrioritizedUrl {
  url: string;
  priority: number; // 1 が最優先
}

class UrlSelector {
  /**
   * 優先順位順 (priority=1 を最優先) で 1 件を選ぶ。
   * リストが空のときは null を返す。
   */
  select(urls: PrioritizedUrl[]): PrioritizedUrl | null;
}
```

### 1.7 BrowserLauncher

```typescript
class BrowserLauncher {
  constructor(private ipc: IpcClient);

  /**
   * 外部ブラウザで URL を開く。
   * 1. IPC が接続中なら FIND_OR_OPEN_TAB を送って 2 パス探索を依頼
   * 2. IPC 接続失敗 / タイムアウトなら vscode.env.openExternal でフォールバック
   */
  async open(url: string): Promise<void>;
}
```

### 1.8 WindowActivator

```typescript
class WindowActivator {
  /**
   * macOS の osascript で Kiro ウィンドウを最前面に引き上げる。
   * シェルインジェクション対策で execFile を使用 (NFR-29)。
   * 引数は配列で渡し、appName はハードコード "Kiro"。
   */
  async activateKiro(): Promise<void>;
}
```

### 1.9 UrlListMerger

```typescript
class UrlListMerger {
  constructor(private settings: SettingsReader, private ipc: IpcClient);

  /**
   * Source A (Chrome 拡張の sites) と Source B (settings.json の urls) をマージする。
   * Q6=A 確定: A 優先、B はフォールバック。
   * - A 取得成功 (空でない) → A のみ使用 (priority 順を保持)
   * - A 取得失敗 / null / 空 → B を priority=1,2,3,... に正規化して使用
   * - 両方空 → [] を返す
   */
  async merge(): Promise<PrioritizedUrl[]>;
}
```

---

## 2. Unit 2: chrome-extension-bridge

すべて `extension/sw/ide_bridge.js` に定義する (JavaScript)。

### 2.1 IdeBridge

```javascript
/**
 * @typedef {Object} IpcMessage
 * @property {string} type
 * @property {*} [payload]
 * @property {string} [requestId]
 */

const IdeBridge = {
  /**
   * Service Worker 起動時に呼ばれる。
   * Q4=A 確定: 即接続を試みる。
   * Options Page の IPC トグル (chrome.storage.local.ipc_enabled) が false なら no-op。
   * 接続失敗時は指数バックオフで再試行 (最大 30秒間隔、FR-51)。
   */
  async init() { /* ... */ },

  /**
   * IPC を停止する。Options Page でトグルが OFF になった時に呼ばれる。
   */
  async shutdown() { /* ... */ },

  /**
   * 受信メッセージのディスパッチ。
   * - GET_SITES → SettingsRepository.getSettings() → SITES_RESPONSE 返却
   * - FIND_OR_OPEN_TAB → TabManager.findOrOpenPlaySite() → TAB_OPENED 返却
   * - PAUSE_MEDIA → TabManager.injectPlaybackPause() → MEDIA_PAUSED 返却
   * - PING → PONG 返却
   */
  async _handleMessage(msg) { /* ... */ },

  /**
   * 現在接続中か。
   */
  isConnected() { /* ... */ },
};
```

### 2.2 OptionsAppIpcToggle

既存 `extension/options/options.js` (OptionsApp) に追加する **メソッド**:

```javascript
class OptionsApp {
  // ... 既存メソッド ...

  /**
   * IPC ON/OFF トグルの初期化と change イベントハンドラ。
   * chrome.storage.local.ipc_enabled の get/set を担当。
   * トグル変更時に IdeBridge.init() / shutdown() が storage.onChanged 経由で呼ばれる。
   */
  initIpcToggle() { /* ... */ }

  /**
   * トグル change ハンドラ。
   */
  async _onIpcToggleChange(checked) { /* ... */ }
}
```

`extension/options/options.html` への追加 DOM:

```html
<!-- 「IPC 連携 (cycle-4)」セクションを既存セクションの末尾に追加 -->
<section class="ipc-toggle-section">
  <h2>IDE 連携 (実験的)</h2>
  <label>
    <input type="checkbox" id="ipc-toggle" />
    Kiro IDE 連携を有効にする (ws://127.0.0.1:39472)
  </label>
</section>
```

---

## 3. Unit 3: agent-hooks-templates

JSON 静的ファイル。「メソッド」の概念はないが、Hook Schema に準拠した構造を定義する。

### 3.1 OnPromptSubmitHook (`vscode-extension/templates/hooks/01-on-prompt-submit.json`)

```json
{
  "name": "WaitLess: AI 待ち開始",
  "version": "1.0.0",
  "description": "プロンプト送信時に外部ブラウザを開く (cycle-4)",
  "when": {
    "type": "promptSubmit"
  },
  "then": {
    "type": "runCommand",
    "command": "code --command waitless.startWaiting"
  }
}
```

> 注意: Hook の `runCommand` から VS Code Command を呼ぶ正確な構文は Kiro の Hook 仕様に依存。Functional Design 段階で実機検証して確定する。代替案として AppleScript / `osascript` 経由で `code --command` を呼ぶ方式もあり。

### 3.2 OnAgentStopHook (`vscode-extension/templates/hooks/02-on-agent-stop.json`)

```json
{
  "name": "WaitLess: AI 完了で Kiro に戻る",
  "version": "1.0.0",
  "description": "AI 応答完了時に Kiro ウィンドウを最前面化する (cycle-4)",
  "when": {
    "type": "agentStop"
  },
  "then": {
    "type": "runCommand",
    "command": "code --command waitless.endWaiting"
  }
}
```

---

## 4. メソッドのシグネチャと FR の対応表

| Method | 対応 FR |
|---|---|
| `WaitOrchestratorIde.startWaiting()` | FR-41, FR-42, FR-44, FR-55 |
| `WaitOrchestratorIde.endWaiting()` | FR-46, FR-47, FR-48, FR-49 |
| `SettingsReader.getSettings()` | FR-54 |
| `SettingsReader.onDidChange()` | FR-54 |
| `IpcClient.start()` | FR-50 |
| `IpcClient.request()` | FR-52, FR-53, R-03 緩和策 |
| `UrlSelector.select()` | FR-42 (優先順位順、Final-2=C) |
| `BrowserLauncher.open()` | FR-42, FR-44, FR-53 |
| `WindowActivator.activateKiro()` | FR-48, NFR-29 |
| `UrlListMerger.merge()` | FR-43, Q6=A |
| `IdeBridge.init()` | FR-51, FR-58, FR-59 |
| `IdeBridge._handleMessage()` | FR-52 |
| `OptionsAppIpcToggle.initIpcToggle()` | FR-61 |
