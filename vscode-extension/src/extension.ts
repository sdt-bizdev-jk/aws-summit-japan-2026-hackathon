/**
 * WaitLess IDE — cycle-4 Unit 1: vscode-extension
 *
 * Kiro IDE 用の VS Code 拡張機能。Agent Hooks (promptSubmit / agentStop) から
 * runCommand 経由で呼ばれる 2 つのコマンド (waitless.startWaiting /
 * waitless.endWaiting) を提供し、外部ブラウザでの娯楽サイト起動と
 * osascript による Kiro ウィンドウ最前面化を行う。
 *
 * 物理ファイル: 1 ファイルに 9 論理コンポーネントを格納 (AppDesign Q1=C 確定):
 *   - SettingsReader        (settings.json 読み込み)
 *   - IpcClient             (WebSocket サーバー、Chrome 拡張からの接続を受ける)
 *   - UrlListMerger         (Source A: IPC, Source B: settings の merge)
 *   - UrlSelector           (優先順位順で 1 件選択)
 *   - BrowserLauncher       (IPC 経由 + フォールバック)
 *   - WindowActivator       (osascript による Kiro 最前面化)
 *   - WaitOrchestratorIde   (中心オーケストレーター)
 *   - CommandRegistry       (Command Palette コマンド登録、関数として実装)
 *   - ExtensionLifecycle    (activate / deactivate)
 *
 * 関連 FR: FR-41〜57 (要件 §3.1〜3.4)
 * 関連 BR: BR-41〜58 (functional-design/business-rules.md)
 * 関連 NFR: NFR-21〜29 (functional-design/nfr-inline.md, nfr-requirements/)
 */

// =====================================================================
//   Section 1. Imports / Types / Constants
// =====================================================================

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { WebSocketServer, WebSocket, RawData } from 'ws';

const execFileAsync = promisify(execFile);

// ----- Constants -----

const IPC_HOST = '127.0.0.1';
const IPC_PORT = 39472;
const IPC_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 30_000;

// 起動中の IDE 名 (VS Code: "Visual Studio Code" / Kiro: "Kiro" など) を
// 実行時に取得する。osascript の `tell application "..."` に渡す名前は
// /Applications/<Name>.app のバンドル名と一致する必要がある。
// vscode.env.appName は VS Code / Kiro いずれでも .app 名と整合する値を返す。
function getHostAppName(): string {
  return vscode.env.appName;
}

const SETTINGS_NAMESPACE = 'aiWaitLessMode';
const COMMAND_START = 'waitless.startWaiting';
const COMMAND_END = 'waitless.endWaiting';

// Hook ブリッジ: Kiro Hook の runCommand はシェルコマンドのため、
// VS Code Command を直接呼べない。代わりに /tmp 配下のトリガーファイルを
// 拡張機能側で監視して仲介する。
// 注: macOS の /tmp は /private/tmp へのシンボリックリンクのため、
// os.tmpdir() の戻り値とは異なる。Hook 側と一致させるため /tmp を固定で使う。
const TRIGGER_DIR = '/tmp/waitless-ide-triggers';
const TRIGGER_START = 'start';
const TRIGGER_END = 'end';

const LOG_PREFIX = '[WaitLess-IDE]';

const DEBUG = true;
function dlog(...args: unknown[]): void {
  if (DEBUG) {
    console.log(LOG_PREFIX, ...args);
  }
}
function dwarn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}
function derror(...args: unknown[]): void {
  console.error(LOG_PREFIX, ...args);
}

// ----- Domain Types (functional-design/domain-entities.md 参照) -----

interface AiWaitLessSettings {
  urls: readonly string[];
  enabled: boolean;
}

interface PrioritizedUrl {
  readonly url: string;
  readonly priority: number;
}

interface Site {
  readonly domain: string;
  readonly url: string;
  readonly priority: number;
}

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

interface SitesResponsePayload {
  readonly sites: readonly Site[];
}

interface FindOrOpenTabPayload {
  readonly url: string;
}

interface TabOpenedPayload {
  readonly tabId: number;
  readonly pass: 1 | 2 | 3;
}

interface MediaPausedPayload {
  readonly ok: boolean;
}

type WaitState = 'idle' | 'waiting';

interface PendingRequest<T = unknown> {
  readonly requestId: string;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  timeoutHandle: NodeJS.Timeout;
}

class IpcError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_CONNECTED' | 'TIMEOUT' | 'PROTOCOL_ERROR' | 'PORT_IN_USE',
  ) {
    super(message);
    this.name = 'IpcError';
  }
}

// =====================================================================
//   Section 2. SettingsReader / UrlListMerger / UrlSelector
// =====================================================================

/**
 * settings.json の `aiWaitLessMode.*` を読み取り、変更を購読する。
 * BR-42 (同期取得、キャッシュしない) / BR-57 (即時反映)。
 */
class SettingsReader {
  getSettings(): AiWaitLessSettings {
    const cfg = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    return {
      urls: cfg.get<string[]>('urls') ?? [],
      enabled: cfg.get<boolean>('enabled') ?? true,
    };
  }

  /**
   * 設定変更を購読する。返り値の Disposable を context.subscriptions に登録すること。
   */
  onDidChange(callback: (newSettings: AiWaitLessSettings) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SETTINGS_NAMESPACE)) {
        callback(this.getSettings());
      }
    });
  }
}

/**
 * Source A (IPC GET_SITES) と Source B (settings.urls) を merge する。
 * BR-45 (A 優先) / BR-46 (B フォールバック) / BR-55 (URL バリデーション)。
 */
class UrlListMerger {
  constructor(
    private readonly settings: SettingsReader,
    private readonly ipc: IpcClient,
  ) {}

  async merge(): Promise<readonly PrioritizedUrl[]> {
    // Source A: IPC GET_SITES
    if (this.ipc.isConnected()) {
      try {
        const response = await this.ipc.request<Record<string, never>, SitesResponsePayload>(
          'GET_SITES',
          {},
        );
        const sites = response?.sites ?? [];
        if (sites.length > 0) {
          // Source A 採用 (BR-45)
          dlog('UrlListMerger: using Source A (Chrome sites), count=', sites.length);
          return sites
            .filter((s) => UrlListMerger.isValidUrl(s.url))
            .map((s) => ({ url: s.url, priority: s.priority }))
            .sort((a, b) => a.priority - b.priority);
        }
        dlog('UrlListMerger: Source A empty, falling back to B');
      } catch (e) {
        dwarn('UrlListMerger: Source A request failed, falling back to B', e);
      }
    } else {
      dlog('UrlListMerger: IPC not connected, using Source B directly');
    }

    // Source B: settings.urls (BR-46)
    const settings = this.settings.getSettings();
    return settings.urls
      .filter((url): url is string => typeof url === 'string' && UrlListMerger.isValidUrl(url))
      .map((url, index) => ({ url, priority: index + 1 }));
  }

  /**
   * BR-55 拡張: http: / https: / chrome-extension: を受け入れる。
   * chrome-extension: は IPC 経由でのみ開ける (フォールバック路 vscode.env.openExternal
   * では開けない)。フォールバックでの取り扱いは BrowserLauncher.open() 側で防御する。
   */
  private static isValidUrl(input: string): boolean {
    try {
      const u = new URL(input);
      return (
        u.protocol === 'http:' ||
        u.protocol === 'https:' ||
        u.protocol === 'chrome-extension:'
      );
    } catch {
      return false;
    }
  }
}

/**
 * 優先順位順で URL を 1 件選ぶ。BR-48。
 */
class UrlSelector {
  select(urls: readonly PrioritizedUrl[]): PrioritizedUrl | null {
    if (urls.length === 0) {
      return null;
    }
    // 入力は merge() で priority 昇順にソート済の前提だが、念のため再ソート。
    const sorted = [...urls].sort((a, b) => a.priority - b.priority);
    return sorted[0] ?? null;
  }
}

// =====================================================================
//   Section 3. IpcClient (WebSocket サーバー)
// =====================================================================

/**
 * VS Code 拡張側で WebSocket サーバーを立て、Chrome 拡張からの接続を受け付ける。
 * 接続は 1 つのみ想定 (新しい接続が来たら古いものを閉じる)。
 *
 * 関連 FR: FR-50, FR-52, FR-53
 * 関連 BR: BR-54 (ポート競合許容), BR-49/50 (タイムアウト)
 * 関連 NFR: NFR-24 (localhost-only)
 */
class IpcClient {
  private wss: WebSocketServer | null = null;
  private clientSocket: WebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest<unknown>>();
  private isStarted = false;
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * WebSocket サーバーを起動する。
   * NFR-24: 127.0.0.1 のみ bind。
   * BR-54: ポート競合時は機能停止せず、isConnected() = false で続行。
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    return new Promise<void>((resolve) => {
      try {
        this.wss = new WebSocketServer({ host: IPC_HOST, port: IPC_PORT });
      } catch (e) {
        derror('IpcClient.start: WebSocketServer construct failed', e);
        this.wss = null;
        resolve(); // BR-54: 機能停止せず続行
        return;
      }

      this.wss.on('listening', () => {
        dlog(`IpcClient: listening on ws://${IPC_HOST}:${IPC_PORT}`);
        this.isStarted = true;
        resolve();
      });

      this.wss.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          derror(`IpcClient: port ${IPC_PORT} in use, IPC will be unavailable`);
        } else {
          derror('IpcClient: server error', err);
        }
        // BR-54: エラーログだけ出して続行
        this.wss = null;
        if (!this.isStarted) {
          resolve();
        }
      });

      this.wss.on('connection', (ws) => {
        dlog('IpcClient: new connection from Chrome extension');
        // 既存の接続があれば閉じる (1 接続のみ)
        if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
          dlog('IpcClient: closing previous connection');
          try {
            this.clientSocket.close();
          } catch (e) {
            dwarn('IpcClient: previous socket close error', e);
          }
        }
        this.clientSocket = ws;

        ws.on('message', (data) => this.handleIncomingMessage(data));
        ws.on('close', () => {
          dlog('IpcClient: connection closed');
          if (this.clientSocket === ws) {
            this.clientSocket = null;
          }
        });
        ws.on('error', (e) => dwarn('IpcClient: socket error', e));
      });
    });
  }

  /**
   * deactivate 時に呼ばれる。
   */
  async stop(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    // pending 全部 reject
    for (const req of this.pending.values()) {
      clearTimeout(req.timeoutHandle);
      req.reject(new IpcError('IpcClient stopping', 'NOT_CONNECTED'));
    }
    this.pending.clear();

    if (this.clientSocket) {
      try {
        this.clientSocket.close();
      } catch (e) {
        dwarn('IpcClient.stop: client close error', e);
      }
      this.clientSocket = null;
    }
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss?.close(() => resolve());
      });
      this.wss = null;
    }
    this.isStarted = false;
    dlog('IpcClient: stopped');
  }

  isConnected(): boolean {
    return this.clientSocket !== null && this.clientSocket.readyState === WebSocket.OPEN;
  }

  /**
   * request/response。requestId で紐付け。タイムアウト IPC_TIMEOUT_MS。
   * BR-49 (タイムアウト時 reject)。
   */
  async request<TReq, TRes>(type: IpcMessageType, payload: TReq): Promise<TRes> {
    if (!this.isConnected() || !this.clientSocket) {
      throw new IpcError('Not connected', 'NOT_CONNECTED');
    }
    const requestId = crypto.randomUUID();
    const message: IpcMessage<TReq> = { type, payload, requestId };

    return new Promise<TRes>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new IpcError(`Request timeout: ${type}`, 'TIMEOUT'));
      }, IPC_TIMEOUT_MS);

      this.pending.set(requestId, {
        requestId,
        resolve: resolve as (v: unknown) => void,
        reject,
        timeoutHandle,
      });

      try {
        this.clientSocket?.send(JSON.stringify(message));
      } catch (e) {
        clearTimeout(timeoutHandle);
        this.pending.delete(requestId);
        reject(new IpcError(`Send failed: ${(e as Error).message}`, 'PROTOCOL_ERROR'));
      }
    });
  }

  /**
   * 応答待たない通知。BR-50。
   */
  notify<T>(type: IpcMessageType, payload: T): void {
    if (!this.isConnected() || !this.clientSocket) {
      dlog('IpcClient.notify: not connected, dropping', type);
      return;
    }
    const message: IpcMessage<T> = { type, payload };
    try {
      this.clientSocket.send(JSON.stringify(message));
    } catch (e) {
      dwarn('IpcClient.notify: send failed', e);
    }
  }

  /**
   * 受信メッセージを処理する。
   * - 応答 (requestId 一致するもの) → 対応する pending を resolve
   * - PING → PONG 返却
   * - その他 (notify 形式の応答 MEDIA_PAUSED 等) → 無視
   */
  private handleIncomingMessage(data: RawData): void {
    let msg: IpcMessage;
    try {
      const text = typeof data === 'string' ? data : data.toString();
      msg = JSON.parse(text) as IpcMessage;
    } catch (e) {
      dwarn('IpcClient: invalid JSON received', e);
      return;
    }

    if (msg.type === 'PING') {
      this.notify('PONG', {});
      return;
    }

    if (msg.requestId) {
      const pending = this.pending.get(msg.requestId);
      if (pending) {
        clearTimeout(pending.timeoutHandle);
        this.pending.delete(msg.requestId);
        pending.resolve(msg.payload);
        return;
      }
    }

    // 応答待ちでない PONG / MEDIA_PAUSED 等は黙って無視
    dlog('IpcClient: unhandled message (no matching request)', msg.type);
  }
}

// =====================================================================
//   Section 4. BrowserLauncher / WindowActivator
// =====================================================================

/**
 * 外部ブラウザで URL を開く。
 * IPC 経由 (Chrome 拡張側で 2 パス探索) → フォールバック (vscode.env.openExternal)。
 *
 * 関連 BR: BR-49 (フォールバック), BR-55 (URL バリデーション)
 */
class BrowserLauncher {
  constructor(private readonly ipc: IpcClient) {}

  async open(url: string): Promise<void> {
    // IPC が利用可能なら FIND_OR_OPEN_TAB を試行
    if (this.ipc.isConnected()) {
      try {
        const result = await this.ipc.request<FindOrOpenTabPayload, TabOpenedPayload>(
          'FIND_OR_OPEN_TAB',
          { url },
        );
        dlog('BrowserLauncher: opened via IPC', result);
        // IPC 経由でタブをアクティブ化しても、OS レベルで Chrome アプリ自体が
        // 背面にあると見えない。osascript で Chrome を前面に出す。
        await this.activateBrowserApp();
        return;
      } catch (e) {
        dwarn('BrowserLauncher: IPC FIND_OR_OPEN_TAB failed, falling back', e);
      }
    }

    // フォールバック: vscode.env.openExternal (BR-49)
    // chrome-extension: スキームは外部ブラウザで開けないため、IPC 失敗時は黙って諦める
    if (!/^https?:\/\//i.test(url)) {
      dwarn('BrowserLauncher: non-http(s) URL cannot be opened via fallback, skipping', url);
      return;
    }
    try {
      const uri = vscode.Uri.parse(url, true);
      const ok  = await vscode.env.openExternal(uri);
      if (!ok) {
        dwarn('BrowserLauncher: openExternal returned false', url);
      } else {
        dlog('BrowserLauncher: opened via openExternal', url);
      }
    } catch (e) {
      dwarn('BrowserLauncher: openExternal threw', e);
    }
  }

  /**
   * macOS で Chrome アプリを前面化する (IPC 経由で開いた後、Chrome 自体が
   * 背面にいる場合に見える状態にするため)。
   * 失敗しても黙って許容 (BR-52 と同様)。
   *
   * セッション 2 回目以降の startWaiting からも直接呼ばれる
   * (URL は開かず、ユーザーが見ていたタブを尊重する目的)。
   */
  async activateBrowserApp(): Promise<void> {
    if (process.platform !== 'darwin') {
      return;
    }
    const script = 'tell application "Google Chrome" to activate';
    try {
      await execFileAsync('osascript', ['-e', script]);
      dlog('BrowserLauncher: Chrome activated');
    } catch (e) {
      dwarn('BrowserLauncher: osascript Chrome activate failed', e);
    }
  }
}

/**
 * macOS で osascript 経由で Kiro ウィンドウを最前面に引き出す。
 *
 * 関連 BR: BR-51 (シェルインジェクション対策), BR-52 (失敗許容)
 * 関連 NFR: NFR-29 (execFile + 配列引数), NFR-25 (macOS 限定)
 */
class WindowActivator {
  async activateKiro(): Promise<void> {
    if (process.platform !== 'darwin') {
      dwarn('WindowActivator: osascript is only available on macOS, skipping');
      return;
    }

    // BR-51 / NFR-29: 配列引数で execFile を使う (シェルインジェクション対策)
    // appName は実行時の IDE 名 (VS Code: "Visual Studio Code" / Kiro: "Kiro") を使う
    const appName = getHostAppName();
    const script  = `tell application "${appName}" to activate`;
    try {
      await execFileAsync('osascript', ['-e', script]);
      dlog(`WindowActivator: ${appName} activated`);
    } catch (e) {
      // BR-52: 失敗してもサイクルは完了扱い、ユーザーに通知しない (silent)
      dwarn('WindowActivator: osascript failed', e);
    }
  }
}

// =====================================================================
//   Section 5. WaitOrchestratorIde / CommandRegistry
// =====================================================================

/**
 * 中心オーケストレーター。startWaiting / endWaiting の 1 サイクルを実装する。
 *
 * 状態モデル: idle <--> waiting
 *
 * 関連 BR: BR-41, BR-43, BR-44, BR-47, BR-50, BR-58
 */
class WaitOrchestratorIde {
  private state         : WaitState = 'idle';
  private hasOpenedOnce : boolean   = false;  // セッション初回フラグ

  constructor(
    private readonly settings : SettingsReader,
    private readonly ipc      : IpcClient,
    private readonly merger   : UrlListMerger,
    private readonly selector : UrlSelector,
    private readonly launcher : BrowserLauncher,
    private readonly activator: WindowActivator,
  ) {}

  /**
   * AI 待ち開始フロー。
   * 1. enabled=false → no-op (BR-41)
   * 2. state=waiting → 重複抑制 (BR-43)
   * 3. **初回**: URL リスト merge → 選択 → ブラウザ起動 (URL を開く)
   *    **2回目以降**: Chrome アプリを前面化するだけ (ユーザーが見ていたタブを尊重)
   * 4. state を waiting に
   */
  async startWaiting(): Promise<void> {
    const settings = this.settings.getSettings();
    if (!settings.enabled) {
      dlog('startWaiting: disabled, no-op (BR-41)');
      return;
    }

    if (this.state === 'waiting') {
      dwarn('startWaiting: already waiting, no-op (BR-43)');
      return;
    }

    // 2 回目以降: URL を開かずに Chrome を前面化するだけ
    if (this.hasOpenedOnce) {
      dlog('startWaiting: subsequent call, only activating Chrome');
      await this.launcher.activateBrowserApp();
      this.state = 'waiting';
      return;
    }

    let urls: readonly PrioritizedUrl[];
    try {
      urls = await this.merger.merge();
    } catch (e) {
      dwarn('startWaiting: UrlListMerger.merge threw', e);
      return;
    }

    if (urls.length === 0) {
      dlog('startWaiting: no URLs available, no-op (BR-47)');
      return;
    }

    const selected = this.selector.select(urls);
    if (!selected) {
      dlog('startWaiting: UrlSelector returned null, no-op');
      return;
    }

    dlog('startWaiting: opening', selected.url);
    await this.launcher.open(selected.url);

    this.state         = 'waiting';
    this.hasOpenedOnce = true;
  }

  /**
   * AI 完了 / 入力要求フロー。
   * 1. state=waiting なら PAUSE_MEDIA notify (BR-50)
   * 2. state=idle でも osascript は実行 (BR-44)
   * 3. state を idle に
   */
  async endWaiting(): Promise<void> {
    const wasWaiting = this.state === 'waiting';
    if (!wasWaiting) {
      dlog('endWaiting: not waiting, but will still activate Kiro (BR-44)');
    }

    if (wasWaiting) {
      // BR-50: 応答待たない notify
      this.ipc.notify('PAUSE_MEDIA', {});
    }

    await this.activator.activateKiro();

    this.state = 'idle';
  }
}

/**
 * Command Palette に 2 つのコマンドを登録する。
 * BR-56: いつでも実行可能 (enabled=false でも呼べる、結果として no-op)。
 */
function registerCommands(
  context: vscode.ExtensionContext,
  orchestrator: WaitOrchestratorIde,
): void {
  const startCmd = vscode.commands.registerCommand(COMMAND_START, async () => {
    try {
      await orchestrator.startWaiting();
    } catch (e) {
      derror('startWaiting command threw', e);
    }
  });

  const endCmd = vscode.commands.registerCommand(COMMAND_END, async () => {
    try {
      await orchestrator.endWaiting();
    } catch (e) {
      derror('endWaiting command threw', e);
    }
  });

  context.subscriptions.push(startCmd, endCmd);
}

/**
 * Hook ブリッジ: TRIGGER_DIR を監視し、トリガーファイルが作成されたら
 * 対応するコマンドを実行する。
 *
 * Kiro Hook の runCommand はシェルコマンドのため、VS Code Command を
 * 直接実行できない。Hook 側では `touch /tmp/waitless-ide-triggers/start`
 * 等を実行し、こちらで監視・コマンド呼び出しを仲介する。
 *
 * 戻り値の Disposable を context.subscriptions に登録すること。
 */
function registerHookBridge(context: vscode.ExtensionContext): vscode.Disposable {
  // ディレクトリを作成 (存在しなければ)
  try {
    fs.mkdirSync(TRIGGER_DIR, { recursive: true });
  } catch (e) {
    dwarn('HookBridge: failed to create TRIGGER_DIR', e);
  }

  // 起動時に既存の古いトリガーをクリア (前回の残骸対策)
  for (const name of [TRIGGER_START, TRIGGER_END]) {
    const p = path.join(TRIGGER_DIR, name);
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch (e) {
      dwarn('HookBridge: failed to clear stale trigger', name, e);
    }
  }

  let watcher: fs.FSWatcher | null = null;
  try {
    watcher = fs.watch(TRIGGER_DIR, (eventType, filename) => {
      if (!filename) {
        return;
      }
      
      // change / rename どちらでも触ったタイミングで反応する
      const target = path.join(TRIGGER_DIR, filename);
      if (!fs.existsSync(target)) {
        return; // 削除イベント等
      }

      if (filename === TRIGGER_START) {
        dlog('HookBridge: TRIGGER_START detected');
        
        // 即座に削除してから実行 (連続発火対策)
        try {
          fs.unlinkSync(target);
        } catch (e) {
          dwarn('HookBridge: unlink start failed', e);
        }
        vscode.commands.executeCommand(COMMAND_START).then(
          () => dlog('HookBridge: startWaiting executed'),
          (err) => derror('HookBridge: startWaiting failed', err),
        );
      } else if (filename === TRIGGER_END) {
        dlog('HookBridge: TRIGGER_END detected');
        
        try {
          fs.unlinkSync(target);
        } catch (e) {
          dwarn('HookBridge: unlink end failed', e);
        }
        vscode.commands.executeCommand(COMMAND_END).then(
          () => dlog('HookBridge: endWaiting executed'),
          (err) => derror('HookBridge: endWaiting failed', err),
        );
      }
    });
    dlog('HookBridge: watching', TRIGGER_DIR);
  } catch (e) {
    dwarn('HookBridge: fs.watch failed (Hook bridge disabled)', e);
  }

  return new vscode.Disposable(() => {
    if (watcher) {
      try {
        watcher.close();
      } catch (e) {
        dwarn('HookBridge: watcher.close failed', e);
      }
    }
  });
}

// =====================================================================
//   Section 6. ExtensionLifecycle (activate / deactivate)
// =====================================================================

let g_ipcClient: IpcClient | null = null;
let g_orchestrator: WaitOrchestratorIde | null = null;

/**
 * VS Code が拡張機能をロードした時に呼ばれる。
 * activationEvents = onStartupFinished で発火 (Q5=A)。
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  dlog('activate: starting');

  const settingsReader = new SettingsReader();
  const ipcClient = new IpcClient();
  g_ipcClient = ipcClient;

  // IpcClient.start() は失敗しても throw しない (BR-54)
  await ipcClient.start();

  const merger = new UrlListMerger(settingsReader, ipcClient);
  const selector = new UrlSelector();
  const launcher = new BrowserLauncher(ipcClient);
  const activator = new WindowActivator();

  const orchestrator = new WaitOrchestratorIde(
    settingsReader,
    ipcClient,
    merger,
    selector,
    launcher,
    activator,
  );
  g_orchestrator = orchestrator;

  // Command 登録
  registerCommands(context, orchestrator);

  // Hook ブリッジ (Kiro Hook → シェルコマンド → トリガーファイル → VS Code Command)
  const hookBridgeDisposable = registerHookBridge(context);
  context.subscriptions.push(hookBridgeDisposable);

  // 設定変更購読 (BR-57: 即時反映、ここでは特別な処理は不要、次回コマンドで getSettings() が新しい値を返す)
  const settingsDisposable = settingsReader.onDidChange((newSettings) => {
    dlog('settings changed', { enabled: newSettings.enabled, urlCount: newSettings.urls.length });
  });
  context.subscriptions.push(settingsDisposable);

  // deactivate 時に IpcClient を確実に停止
  context.subscriptions.push({
    dispose: async () => {
      try {
        await ipcClient.stop();
      } catch (e) {
        dwarn('IpcClient.stop on dispose failed', e);
      }
    },
  });

  dlog(`activate: ready (IPC connected=${ipcClient.isConnected()})`);
}

/**
 * VS Code が拡張機能をアンロードする時に呼ばれる。
 */
export async function deactivate(): Promise<void> {
  dlog('deactivate: starting');

  // 進行中サイクルがあれば cleanup (BR-44 と同じ要領で osascript だけ実行)
  if (g_orchestrator) {
    try {
      await g_orchestrator.endWaiting();
    } catch (e) {
      dwarn('endWaiting on deactivate failed', e);
    }
  }

  if (g_ipcClient) {
    try {
      await g_ipcClient.stop();
    } catch (e) {
      dwarn('IpcClient.stop on deactivate failed', e);
    }
  }

  g_orchestrator = null;
  g_ipcClient = null;

  dlog('deactivate: done');
}
