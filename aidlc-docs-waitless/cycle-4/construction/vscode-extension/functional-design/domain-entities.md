# cycle-4 — Unit 1 (vscode-extension) — Domain Entities

最終更新: 2026-05-27

Unit 1 で扱うドメインエンティティ (TypeScript 型定義) を整理する。Q1=A (フル strict) の前提で、`null` / `undefined` を明示する。

---

## 1. 設定エンティティ

### 1.1 `AiWaitLessSettings`

```typescript
interface AiWaitLessSettings {
  /**
   * Chrome 拡張未稼働時のフォールバック URL リスト。
   * デフォルト [] (空)。
   */
  urls: readonly string[];

  /**
   * AI WaitLess Mode の有効化。デフォルト true。
   */
  enabled: boolean;
}
```

### 1.2 `vscode.workspace.getConfiguration` との対応

```typescript
function readSettings(): AiWaitLessSettings {
  const cfg = vscode.workspace.getConfiguration('aiWaitLessMode');
  return {
    urls: cfg.get<string[]>('urls') ?? [],
    enabled: cfg.get<boolean>('enabled') ?? true,
  };
}
```

---

## 2. URL 関連エンティティ

### 2.1 `PrioritizedUrl`

```typescript
/**
 * 優先順位付き URL。priority=1 が最優先。
 */
interface PrioritizedUrl {
  readonly url: string;
  readonly priority: number; // 1, 2, 3, ...
}
```

### 2.2 `Site` (Chrome 拡張の sites スキーマ、IPC 経由で受け取る)

```typescript
/**
 * Chrome 拡張の chrome.storage.local.sites と同じスキーマ。
 * IPC SITES_RESPONSE で受け取る。
 */
interface Site {
  readonly domain: string;
  readonly url: string;
  readonly priority: number;
}
```

---

## 3. IPC メッセージエンティティ

### 3.1 `IpcMessageType` (FR-52、Q2=B により version フィールドなし)

```typescript
type IpcMessageType =
  | 'GET_SITES'
  | 'SITES_RESPONSE'
  | 'FIND_OR_OPEN_TAB'
  | 'TAB_OPENED'
  | 'PAUSE_MEDIA'
  | 'MEDIA_PAUSED'
  | 'PING'
  | 'PONG';
```

### 3.2 `IpcMessage<T>` (汎用包装)

```typescript
interface IpcMessage<T = unknown> {
  type: IpcMessageType;
  payload?: T;

  /**
   * request/response 紐付け用。
   * notify (応答待たない) の場合は省略 OK。
   */
  requestId?: string;
}
```

### 3.3 メッセージ別 payload

#### `GET_SITES` (request)
```typescript
type GetSitesPayload = Record<string, never>;  // {} (空)
```

#### `SITES_RESPONSE` (response)
```typescript
interface SitesResponsePayload {
  readonly sites: readonly Site[];
}
```

#### `FIND_OR_OPEN_TAB` (request)
```typescript
interface FindOrOpenTabPayload {
  readonly url: string;
}
```

#### `TAB_OPENED` (response)
```typescript
interface TabOpenedPayload {
  readonly tabId: number;
  readonly pass: 1 | 2 | 3;  // 2パス探索 + 新規タブ
}
```

#### `PAUSE_MEDIA` (notify)
```typescript
type PauseMediaPayload = Record<string, never>;  // {}
```

#### `MEDIA_PAUSED` (response、VS Code 側は受信しても無視)
```typescript
interface MediaPausedPayload {
  readonly ok: boolean;
}
```

#### `PING` / `PONG` (両方向)
```typescript
type PingPayload = Record<string, never>;
type PongPayload = Record<string, never>;
```

### 3.4 エラーレスポンス
```typescript
interface IpcErrorPayload {
  readonly ok: false;
  readonly reason: string;
}
```

---

## 4. 状態エンティティ

### 4.1 `WaitState`

```typescript
type WaitState = 'idle' | 'waiting';
```

### 4.2 `WaitOrchestratorIde` の internal state

```typescript
class WaitOrchestratorIde {
  private state: WaitState = 'idle';
  // ...
}
```

cycle-4 では永続化しない (Section 8 of business-logic-model.md)。

---

## 5. IPC レイヤーのリクエスト管理

### 5.1 `PendingRequest`

```typescript
/**
 * IpcClient が応答を待っているリクエストの管理用。
 */
interface PendingRequest<T = unknown> {
  readonly requestId: string;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  timeoutHandle: NodeJS.Timeout;
}
```

### 5.2 `IpcClient` の internal state

```typescript
class IpcClient {
  private wss: WebSocketServer | null = null;
  private clientSocket: WebSocket | null = null;  // 単一接続のみサポート
  private pending = new Map<string, PendingRequest<unknown>>();
  private isStarted = false;
}
```

---

## 6. エラー型

### 6.1 `IpcError`

```typescript
class IpcError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_CONNECTED' | 'TIMEOUT' | 'PROTOCOL_ERROR'
  ) {
    super(message);
    this.name = 'IpcError';
  }
}
```

---

## 7. 定数

```typescript
const IPC_PORT = 39472;
const IPC_HOST = '127.0.0.1';
const IPC_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 30_000;
const APP_NAME_FOR_OSASCRIPT = 'Kiro';

const SETTINGS_NAMESPACE = 'aiWaitLessMode';
const COMMAND_START = 'waitless.startWaiting';
const COMMAND_END = 'waitless.endWaiting';
```

---

## 8. エンティティ間の関係

```
AiWaitLessSettings
  ├─ urls: string[]            ──┐
  └─ enabled: boolean             │
                                  v
                            UrlListMerger
                                  │
                                  v (merge)
                            PrioritizedUrl[]    ←── Site[] (from IPC SITES_RESPONSE)
                                  │
                                  v (select)
                            PrioritizedUrl
                                  │
                                  v (open)
                            Browser launched

IpcMessage<T>
  ├─ type: IpcMessageType
  ├─ payload: T (上記 8 種類のいずれか)
  └─ requestId?: string

WaitState
  └─ 'idle' | 'waiting'   ←── WaitOrchestratorIde が保持
```

---

## 9. データフロー (型ベース)

### 9.1 `startWaiting()` のフロー

```
SettingsReader.getSettings(): AiWaitLessSettings
  │
  v (enabled false なら return)
  │
UrlListMerger.merge(): Promise<PrioritizedUrl[]>
  ├─ IpcClient.request<GetSitesPayload, SitesResponsePayload>(
  │    'GET_SITES', {}
  │  ): Promise<SitesResponsePayload>
  │     ├─ 成功 → SitesResponsePayload.sites を PrioritizedUrl[] にマップ
  │     └─ 失敗 → AiWaitLessSettings.urls を PrioritizedUrl[] にマップ (BR-46)
  │
  v (空リストなら return)
  │
UrlSelector.select(prioritized: readonly PrioritizedUrl[]): PrioritizedUrl | null
  │
  v
BrowserLauncher.open(url: string): Promise<void>
  ├─ IpcClient.isConnected() → request<FindOrOpenTabPayload, TabOpenedPayload>(...)
  └─ vscode.env.openExternal(vscode.Uri.parse(url)) フォールバック
  │
  v
state = 'waiting'
```

### 9.2 `endWaiting()` のフロー

```
state チェック
  │
  v (waiting なら以下、idle なら osascript のみへスキップ)
  │
IpcClient.notify<PauseMediaPayload>('PAUSE_MEDIA', {})
  │
  v
WindowActivator.activateKiro(): Promise<void>
  └─ child_process.execFile('osascript', ['-e', 'tell application "Kiro" to activate'])
  │
  v
state = 'idle'
```

---

## 10. 関連ドキュメント

- ビジネスロジック: `business-logic-model.md`
- ビジネスルール: `business-rules.md`
- NFR inline 対応: `nfr-inline.md`
- Application Design Component Methods: `aidlc-docs/inception/application-design/component-methods.md`
