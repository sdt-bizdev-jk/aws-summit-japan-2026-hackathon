# cycle-4 — Unit of Work

最終更新: 2026-05-27

cycle-4 を **3 つの unit of work** に分解する。各 unit は Functional Design / Code Generation を独立に進められる粒度で設計されている。

---

## 1. Unit 一覧

| # | Unit 名 | 種別 | 言語 | 配置 | 状態 |
|---|---|---|---|---|---|
| **1** | `vscode-extension` | 新規 | TypeScript | `vscode-extension/` | 未着手 |
| **2** | `chrome-extension-bridge` | 改修 | JavaScript | `extension/` (既存への追加) | 未着手 |
| **3** | `agent-hooks-templates` | 新規 | JSON 静的 | `vscode-extension/templates/hooks/` | 未着手 |

---

## 2. Unit 1: vscode-extension

### 2.1 責務

Kiro IDE 用の VS Code 拡張機能本体。Agent Hooks から呼ばれる Command Palette コマンド (`waitless.startWaiting` / `waitless.endWaiting`) を提供し、URL リスト取得 → 選択 → ブラウザ起動 → Kiro へのフォーカス引き上げまでの一連のフローを担当する。

### 2.2 ディレクトリ構造 (Q1=A 確定 — VS Code 拡張機能の標準レイアウト)

```
vscode-extension/
├── package.json                  # 拡張機能のメタデータ + 依存 (ws ライブラリ)
├── tsconfig.json                 # TypeScript コンパイル設定
├── README.md                     # ユーザー向けインストール手順 + Hook テンプレートの使い方
├── .vscodeignore                 # VSIX パッケージ時に除外するファイル
├── .gitignore                    # node_modules / out / *.vsix を除外
├── src/
│   └── extension.ts              # Q1=C により 1 ファイルに全 9 コンポーネント
├── out/                          # tsc ビルド出力 (.gitignore)
├── templates/
│   └── hooks/                    # Unit 3 の成果物配置先 (本 unit 内に同梱)
│       ├── 01-on-prompt-submit.json
│       └── 02-on-agent-stop.json
└── assets/                       # 拡張機能アイコン等 (cycle-4 では空でも可、cycle-5 以降で追加)
```

### 2.3 コード組織化戦略 (Greenfield)

- **シングルファイル `src/extension.ts`** に全 9 論理コンポーネントを TypeScript の class / function として配置 (Q1=C)
- ファイル内のセクション順序:
  1. Imports
  2. Type definitions (`AiWaitLessSettings` / `IpcMessageType` / `IpcMessage` / `PrioritizedUrl` / `WaitState`)
  3. Constants (`IPC_PORT = 39472`, `IPC_TIMEOUT_MS = 5000`)
  4. SettingsReader (class)
  5. IpcClient (class)
  6. UrlListMerger (class)
  7. UrlSelector (class)
  8. BrowserLauncher (class)
  9. WindowActivator (class)
  10. WaitOrchestratorIde (class)
  11. CommandRegistry (function)
  12. activate / deactivate (export functions)

### 2.4 Implementation の主要メソッド

`component-methods.md` §1 を参照。

### 2.5 関与する FR / NFR

- **FR**: FR-41, FR-42, FR-43 (Source B), FR-46, FR-48, FR-49, FR-50, FR-52, FR-53, FR-54, FR-55, FR-56
- **NFR**: NFR-21, NFR-22, NFR-23, NFR-24, NFR-25, NFR-28, NFR-29

### 2.6 Tech Stack

- **言語**: TypeScript 5.x
- **ビルド**: `tsc` (`npm run build`)
- **ランタイム**: Node.js (VS Code Extension Host 内)
- **依存**:
  - `vscode` (型のみ、`devDependencies`)
  - `ws` (WebSocket サーバー、`dependencies`)
  - `@types/node` (`devDependencies`)
  - `@types/ws` (`devDependencies`)
  - `typescript` (`devDependencies`)

### 2.7 設定ファイル (package.json contributes)

```jsonc
{
  "contributes": {
    "commands": [
      { "command": "waitless.startWaiting", "title": "WaitLess: AI 待ち開始" },
      { "command": "waitless.endWaiting",   "title": "WaitLess: AI 完了で Kiro に戻る" }
    ],
    "configuration": {
      "title": "AI WaitLess Mode",
      "properties": {
        "aiWaitLessMode.urls": {
          "type": "array",
          "items": { "type": "string", "format": "uri" },
          "default": [],
          "description": "Chrome 拡張未起動時のフォールバック URL リスト"
        },
        "aiWaitLessMode.enabled": {
          "type": "boolean",
          "default": true,
          "description": "AI WaitLess Mode の有効化"
        }
      }
    }
  }
}
```

---

## 3. Unit 2: chrome-extension-bridge

### 3.1 責務

既存 WaitLess Chrome 拡張に **IDE 連携モジュール** を追加する。VS Code 拡張側の WebSocket サーバーに接続し、IPC メッセージを既存の WaitOrchestrator / TabManager / SettingsRepository への呼び出しに翻訳する。

### 3.2 影響ファイル

```
extension/                                    # 既存 cycle-3 完了状態 v0.3.0
├── manifest.json                              # version 0.3.0 → 0.4.0
├── service_worker.js                          # 1 行追加 (import IdeBridge + init() 呼び出し)
├── sw/
│   ├── message_router.js                     # 無変更
│   ├── wait_orchestrator.js                  # 無変更 (※ injectPlaybackPause を tab_manager に昇格させる場合に微改修)
│   ├── tab_manager.js                        # 微改修 (injectPlaybackPause を export メソッド化、要 Functional Design で確定)
│   ├── settings_repository.js                # 無変更
│   ├── runtime_state.js                      # 無変更
│   └── ide_bridge.js                         # ★ 新規追加 (約 200-300 行)
├── content/                                   # 全ファイル無変更
├── options/
│   ├── options.html                          # 改修 (IPC ON/OFF トグルセクション追加)
│   ├── options.css                           # 改修 (トグルスタイル追加)
│   └── options.js                            # 改修 (initIpcToggle メソッド追加)
├── reader/                                    # 全ファイル無変更 (cycle-3 と同じ)
├── assets/                                    # 無変更
└── README.md                                  # 改修 (cycle-4 機能の説明追記)
```

### 3.3 コード組織化戦略 (Brownfield)

- **新規 `sw/ide_bridge.js`** を CommonJS ES Module として作成 (cycle-1〜3 と同じスタイル)
- export は単一の `IdeBridge` オブジェクト ({ init, shutdown, _handleMessage, isConnected })
- 既存の sw/* モジュールへの依存は **read-only** (callback として呼び出すだけ、内部状態は触らない)
- `service_worker.js` 末尾に 1 行追加: `import IdeBridge from './sw/ide_bridge.js'; IdeBridge.init();`

### 3.4 関与する FR / NFR

- **FR**: FR-43 (Source A), FR-44, FR-45, FR-47, FR-50, FR-51, FR-52, FR-58, FR-59, FR-60, FR-61
- **NFR**: NFR-21 (JS), NFR-23, NFR-24 (localhost-only)、**NFR-27 (後方互換性)** が最重要

### 3.5 Tech Stack

- **言語**: JavaScript (ES Modules、cycle-1〜3 と同じ)
- **ビルド**: なし (cycle-1〜3 と同じ無ビルド構成)
- **ランタイム**: Chrome Service Worker (Manifest V3)
- **依存**: なし (Browser 標準の WebSocket API を使用)

---

## 4. Unit 3: agent-hooks-templates

### 4.1 責務

Kiro Agent Hooks のテンプレート JSON を提供する。ユーザーが手動で `.kiro/hooks/` 配下にコピーすることで、cycle-4 の体験が動作する。

### 4.2 配置

`vscode-extension/templates/hooks/` 配下 (Unit 1 の物理ディレクトリツリー内に同梱):

```
vscode-extension/templates/hooks/
├── 01-on-prompt-submit.json     # promptSubmit イベント → waitless.startWaiting
└── 02-on-agent-stop.json        # agentStop イベント → waitless.endWaiting
```

### 4.3 コード組織化戦略

- 静的 JSON のみ。ロジックなし
- README で「ユーザーが `cp templates/hooks/*.json ~/path/to/.kiro/hooks/` 等のコピー手順」を案内
- 将来的には Code Generation で書き換えやすいように、`runCommand` の文字列はテンプレート可能性を残す (cycle-5 以降で settings.json から自動展開可能)

### 4.4 関与する FR / NFR

- **FR**: FR-41 (Hook イベント定義), FR-46, FR-57
- **NFR**: NFR-22 (ローカル開発のみ)

### 4.5 Tech Stack

- **言語**: JSON (静的)
- **ビルド**: なし
- **依存**: Kiro Hook Schema (cycle-4 開始時点の Kiro version に準拠)

---

## 5. 全 unit 共通の品質基準

### 5.1 後方互換性 (NFR-27)

- cycle-1〜3 で動作していたシナリオ (T-01 〜 T-30) が cycle-4 後も同じ動作をする
- `chrome.storage.local` のスキーマは無変更 (cycle-4 で `ipc_enabled` のみ追加、既存キーには触らない)
- IPC 機能が OFF または失敗時、Chrome 拡張は cycle-3 と同じ動作

### 5.2 ロールバック容易性

- 各 unit を独立にロールバック可能
- Unit 2 のロールバック: `service_worker.js` から `import IdeBridge` 行を削除 + `sw/ide_bridge.js` を削除
- Unit 1 のロールバック: `code --uninstall-extension waitless.waitless-ide` または開発モード停止
- Unit 3 のロールバック: `~/.kiro/hooks/*.json` を削除するだけ

### 5.3 デバッグログ

- cycle-1〜3 と同じく、各モジュールで `const DEBUG = true;` の形でログ制御 (Backlog B-02 のまま)
- cycle-4 の新規モジュールも同じパターンを踏襲

---

## 6. cycle-1〜3 既存 unit との関係

| サイクル | Unit | cycle-4 での扱い |
|---|---|---|
| cycle-1 | `waitless-extension` (Chrome 拡張全体) | cycle-4 で `chrome-extension-bridge` として 部分改修 |
| cycle-2 | (新規 unit なし、cycle-1 unit の delta のみ) | 影響なし |
| cycle-3 | `waitless-extension` (引き続き、Reader Page 追加) | cycle-4 で同じ unit に `sw/ide_bridge.js` を追加 |

cycle-4 では **既存 unit `waitless-extension` を「chrome-extension-bridge」として再ターゲティング** している (実体は同じ Chrome 拡張機能だが、cycle-4 のスコープでは IDE Bridge 機能の追加が中心)。

---

## 7. Greenfield 部分のコード組織化戦略 (まとめ)

cycle-4 では **Unit 1 と Unit 3** が Greenfield (新規):

```
リポジトリ ROOT (既存)
├── extension/                      # cycle-1〜3 で構築済 (Brownfield)
├── vscode-extension/               # ★ cycle-4 で新規追加 (Greenfield)
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   ├── .vscodeignore
│   ├── .gitignore
│   ├── src/
│   │   └── extension.ts
│   ├── out/                         # ビルド出力 (.gitignore)
│   └── templates/
│       └── hooks/                   # Unit 3
│           ├── 01-on-prompt-submit.json
│           └── 02-on-agent-stop.json
├── docs/                            # 既存、cycle-4 で更新
├── aidlc-docs/                      # cycle-4 で新規 (本ドキュメント群)
└── aidlc-docs-waitless-archive/    # 既存 archive
```

リポジトリ ROOT は cycle-1〜3 と同じ (ROOT に複数の unit が並ぶモニリポ構成)。
