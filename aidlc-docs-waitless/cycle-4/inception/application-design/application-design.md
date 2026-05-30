# cycle-4 — Application Design (統合版)

最終更新: 2026-05-27

このドキュメントは cycle-4 の Application Design 成果物 (`components.md` / `component-methods.md` / `services.md` / `component-dependency.md`) を統合し、「**何が、どう関係し、どう動くか**」を 1 ページで俯瞰できる形にまとめたもの。

詳細は各個別ドキュメントを参照。

---

## 1. 全体俯瞰図

```
┌─────────────────────────────────────────────────────────────────┐
│ Kiro IDE (macOS)                                                │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Agent Hooks (Unit 3、新規 JSON)                              │ │
│ │   - 01-on-prompt-submit.json (promptSubmit)                  │ │
│ │   - 02-on-agent-stop.json (agentStop)                        │ │
│ └────────────┬─────────────────────────────────────────────────┘ │
│              │ runCommand                                         │
│              v                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ vscode-extension (Unit 1、新規 TypeScript)                   │ │
│ │ ┌─────────────────┐                                          │ │
│ │ │ CommandRegistry │ ← waitless.startWaiting                  │ │
│ │ │                 │ ← waitless.endWaiting                    │ │
│ │ └────┬────────────┘                                          │ │
│ │      v                                                        │ │
│ │ ┌─────────────────────────┐                                  │ │
│ │ │ WaitOrchestratorIde     │ (中心、状態 idle/waiting)         │ │
│ │ │  startWaiting()         │                                  │ │
│ │ │  endWaiting()           │                                  │ │
│ │ └────┬────────────────────┘                                  │ │
│ │      ├─→ SettingsReader (settings.json)                       │ │
│ │      ├─→ UrlListMerger ─→ Source A (IPC) + B (settings)       │ │
│ │      ├─→ UrlSelector (優先順位順)                              │ │
│ │      ├─→ BrowserLauncher (IPC + フォールバック)                │ │
│ │      ├─→ WindowActivator (osascript)                          │ │
│ │      └─→ IpcClient (WebSocket Server :39472)                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────│─────────────────────────────┘
                                     │ ws://127.0.0.1:39472
                                     │ (双方向 JSON メッセージ)
┌────────────────────────────────────│─────────────────────────────┐
│ Chrome Browser                     v                              │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ extension/sw/ide_bridge.js (Unit 2、新規)                     │ │
│ │ ┌──────────────────┐                                          │ │
│ │ │ IdeBridge        │                                          │ │
│ │ │  init() / shutdown()                                        │ │
│ │ │  _handleMessage()                                           │ │
│ │ └────┬─────────────┘                                          │ │
│ │      ├─→ SettingsRepository (既存、無変更)                    │ │
│ │      ├─→ TabManager (既存、無変更)                             │ │
│ │      │     └→ findOrOpenPlaySite() (既存)                     │ │
│ │      │     └→ injectPlaybackPause() (既存、cycle-4 で利用拡大) │ │
│ │      └─→ PlaybackPause (既存、無変更)                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Options Page (既存、cycle-4 で改修)                            │ │
│ │   IPC ON/OFF トグル追加                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ (既存) WaitOrchestrator / ClaudeSiteAdapter / etc.               │
│   cycle-4 では無変更、Claude.ai シナリオは独立して引き続き動作    │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Unit 構成 (3 unit)

| # | Unit 名 | 種別 | 物理ファイル | 主要コンポーネント |
|---|---|---|---|---|
| **1** | `vscode-extension` | 新規 (TypeScript) | `vscode-extension/src/extension.ts` 1 ファイル | ExtensionLifecycle / CommandRegistry / WaitOrchestratorIde / SettingsReader / IpcClient / UrlSelector / BrowserLauncher / WindowActivator / UrlListMerger |
| **2** | `chrome-extension-bridge` | 改修 (JavaScript、cycle-3 への追加) | `extension/sw/ide_bridge.js` (新規) + `extension/service_worker.js` (1 行追加) + `extension/options/options.{html,js}` (改修) | IdeBridge / OptionsAppIpcToggle |
| **3** | `agent-hooks-templates` | 新規 (JSON 静的) | `vscode-extension/templates/hooks/01-on-prompt-submit.json` / `02-on-agent-stop.json` | OnPromptSubmitHook / OnAgentStopHook |

合計: **新規 12 コンポーネント + 改修 1 コンポーネント** = 13 コンポーネント。

**論理コンポーネント数 vs 物理ファイル数の差**: Q1=C 確定により、Unit 1 は extension.ts 1 ファイルに 9 コンポーネントを TypeScript の class / function として詰め込む形。可読性とのトレードオフは Functional Design で再検討する余地あり。

---

## 3. サービス層 (オーケストレーション)

3 つのサービスで構成 (詳細は `services.md`):

1. **WaitCycleService** (中心) — `WaitOrchestratorIde` を本体に、待ち時間 1 サイクル (開始 → ブラウザ起動 → 戻り) を実装
2. **IdeExtensionService** (ライフサイクル) — VS Code 拡張機能の activate / deactivate を管理
3. **ChromeExtensionBridgeService** (ライフサイクル) — Chrome 拡張側 `IdeBridge` の起動 / 切断を管理

cycle-1〜3 で確立した既存サービス (WaitOrchestrationService / TabManagementService / SettingsManagementService / ReaderPageService) は **無変更** で並行して動く。

---

## 4. 通信パターン

### 4.1 主な経路

| 経路 | 通信方式 | 用途 |
|---|---|---|
| Kiro Hook → VS Code Command Palette | `runCommand` (Kiro 標準) | 待ち開始 / 終了トリガー |
| VS Code Command Palette → IpcClient | 直接メソッド呼び出し | サービス起動 |
| **IpcClient ⇔ IdeBridge** | **WebSocket (JSON、:39472)** | **双方向 IPC、FR-52 の 7 タイプ** |
| IdeBridge → 既存 SettingsRepository / TabManager | 直接モジュール呼び出し (Service Worker 内) | コア機能の利用 |
| Options Page トグル → IdeBridge | `chrome.storage.local.onChanged` 経由 | IPC ON/OFF 制御 |

### 4.2 IPC メッセージプロトコル (FR-52)

| Type | Direction | Payload | 用途 |
|------|-----------|--------|------|
| `GET_SITES` | VS Code → Chrome | `{}` | sites リストを要求 |
| `SITES_RESPONSE` | Chrome → VS Code | `{ sites: { domain, url, priority }[] }` | sites 返却 |
| `FIND_OR_OPEN_TAB` | VS Code → Chrome | `{ url: string }` | タブ起動依頼 |
| `TAB_OPENED` | Chrome → VS Code | `{ tabId: number, pass: 1\|2\|3 }` | 起動結果 |
| `PAUSE_MEDIA` | VS Code → Chrome | `{}` | 動画一時停止 |
| `MEDIA_PAUSED` | Chrome → VS Code | `{ ok: boolean }` | 一時停止結果 |
| `PING` / `PONG` | 両方向 | `{}` | ヘルスチェック (30秒ごと) |

バージョニング: 明示フィールドなし (Q2=B 確定)。

---

## 5. データモデル

### 5.1 設定 (VS Code 側、`settings.json`)

```jsonc
{
  "aiWaitLessMode.urls": [],
  "aiWaitLessMode.enabled": true
}
```

- `urls` のデフォルトは空 (Chrome 拡張未稼働時のフォールバック用)
- Q6=A により、IPC 経由で Chrome 拡張の sites が取れれば `urls` は **使われない**

### 5.2 設定 (Chrome 側、cycle-1〜3 から継承 + cycle-4 追加)

```json
{
  "sites": [
    { "domain": "youtube.com", "url": "https://youtu.be/xxx", "priority": 1 },
    { "domain": "x.com", "url": "https://x.com/home", "priority": 2 }
  ],
  "threshold_sec": 5,
  "reader_state": { "...": "..." },
  "ipc_enabled": true
}
```

cycle-4 で追加されるキー:
- **`ipc_enabled`** (boolean、デフォルト `true`) — Options Page トグルの状態 (FR-61)

`sites` / `threshold_sec` / `reader_state` のスキーマは無変更 (NFR-27 後方互換性)。

### 5.3 IPC 内部データモデル (TypeScript)

```typescript
interface PrioritizedUrl {
  url: string;
  priority: number; // 1 = 最優先
}

type IpcMessageType =
  | 'GET_SITES' | 'SITES_RESPONSE'
  | 'FIND_OR_OPEN_TAB' | 'TAB_OPENED'
  | 'PAUSE_MEDIA' | 'MEDIA_PAUSED'
  | 'PING' | 'PONG';

interface IpcMessage<T = unknown> {
  type: IpcMessageType;
  payload?: T;
  requestId?: string;
}

type WaitState = 'idle' | 'waiting';
```

---

## 6. 状態遷移

`WaitOrchestratorIde` の状態:

```
        startWaiting() (Hook 起動)
            │
            v
    ┌─────────────┐                  ┌──────────────────┐
    │   idle      │ ───────────────→ │   waiting        │
    │             │                  │  (URL 開いた)     │
    └─────────────┘                  └──────────────────┘
            ^                                │
            │     endWaiting() (Hook 完了)    │
            └────────────────────────────────┘
```

idempotency:
- `idle` で `endWaiting()` 呼ばれたら: osascript だけ走らせて完了 (媒体停止スキップ)
- `waiting` で `startWaiting()` 呼ばれたら: 上書きせず無視 (no-op + ログ)

---

## 7. 信頼性 / 失敗ハンドリング (NFR への対応)

| 失敗シナリオ | フォールバック動作 | 対応 NFR / R |
|---|---|---|
| Chrome 拡張未起動 / IPC 接続失敗 | `vscode.env.openExternal` で OS デフォルトブラウザ起動 (タブ探索なし) | NFR-28、R-03 |
| Chrome 拡張は起動中だが Service Worker idle unload | 次のメッセージで再 spin up、IdeBridge.init() で再接続 | R-04 |
| osascript が失敗 (アプリ名違い、Apple Events 未許可) | エラーログ出力、サイクル自体は完了扱い | R-02、R-05 |
| ポート 39472 既使用 | IpcClient.start() が失敗、機能は IPC 連携なしの状態で続行 | NFR-28 |
| Kiro Hook が発火しない | Command Palette から手動で `waitless.startWaiting` を実行可能 | R-01 |

---

## 8. 既存コードへの影響まとめ

| ファイル | 変更内容 | 影響度 |
|---|---|---|
| `extension/service_worker.js` | `import IdeBridge from './sw/ide_bridge.js'; IdeBridge.init();` の追加 | 1 行 |
| `extension/sw/ide_bridge.js` | 新規ファイル | 新規 (推定 200-300 行) |
| `extension/manifest.json` | version `0.3.0` → `0.4.0`、必要に応じて WebSocket 用の host_permissions 確認 (現状 `<all_urls>` で十分の見込み) | Configuration-only |
| `extension/options/options.html` | IPC ON/OFF トグルセクションの追加 | 数行 |
| `extension/options/options.css` | トグルスタイルの追加 | 数行 |
| `extension/options/options.js` | `initIpcToggle()` 等の追加 | 数十行 |
| `extension/sw/wait_orchestrator.js` | (検討) `injectPlaybackPause` ロジックを TabManager 側に昇格させる必要あり、Functional Design で確定 | 0〜数行 (要検討) |
| `extension/sw/tab_manager.js` | (上記昇格対応で) 新規メソッド `injectPlaybackPause(tabId)` を export | 0〜数行 (要検討) |
| **既存 sw/* の他のファイル** | **無変更** | — |
| **既存 content/* のファイル** | **無変更** | — |
| **既存 reader/* のファイル** (cycle-3) | **無変更** | — |

---

## 9. 確定した設計上の意思決定 (要件 + Application Design Plan の統合)

| ID | 内容 | 確定根拠 |
|---|---|---|
| **D-01** | ターゲット OS = macOS 限定 | NFR-25 |
| **D-02** | ターゲット IDE = Kiro 限定 | C1=A、Agent Hooks 必須 |
| **D-03** | URL 選択 = 優先順位順 | Final-2=C |
| **D-04** | URL マージ = A 優先、B フォールバック | Q6=A |
| **D-05** | TypeScript モジュール構成 = 1 ファイル (extension.ts) | Q1=C |
| **D-06** | IPC version フィールド = なし | Q2=B |
| **D-07** | コマンド名前空間 = `waitless.startWaiting` / `waitless.endWaiting` | Q3=C (要件 FR-41/46 の名前から変更) |
| **D-08** | IdeBridge 起動 = Service Worker 起動と同時 | Q4=A |
| **D-09** | IpcClient 起動 = activate 時即起動 | Q5=A |
| **D-10** | WebSocket ポート = 39472 | FR-50 (cycle-4 の確定値) |
| **D-11** | osascript 引数 = `tell application "Kiro" to activate`、ハードコード "Kiro" | NFR-29、R-02 |
| **D-12** | テスト方針 = 手動 E2E のみ | NFR-23 |
| **D-13** | 配布形態 = ローカル開発のみ | NFR-22 |
| **D-14** | 言語 = TypeScript (Unit 1) + JavaScript (Unit 2) + JSON (Unit 3) | NFR-21 |

---

## 10. 関連ドキュメント (各個別)

- コンポーネント定義: `aidlc-docs/inception/application-design/components.md`
- メソッド一覧: `aidlc-docs/inception/application-design/component-methods.md`
- サービス層: `aidlc-docs/inception/application-design/services.md`
- 依存関係 + データフロー: `aidlc-docs/inception/application-design/component-dependency.md`
- 要件: `aidlc-docs/inception/requirements/requirements.md`
- 実行計画: `aidlc-docs/inception/plans/execution-plan.md`
- 既存アーキテクチャ: `docs/architecture.md`
