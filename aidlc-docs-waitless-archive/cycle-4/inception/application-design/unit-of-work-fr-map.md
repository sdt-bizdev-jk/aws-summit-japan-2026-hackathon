# cycle-4 — FR ↔ Unit Mapping

最終更新: 2026-05-27

User Stories ステージをスキップ (`docs/cycle-4-handover.md` から既存ペルソナを継承) したため、本サイクルでは **FR (機能要件) と Unit のマッピング** を `unit-of-work-story-map.md` の代替として作成する。

要件: `aidlc-docs/inception/requirements/requirements.md` §3 の FR-41〜61 と NFR-21〜29 を対象。

---

## 1. FR ↔ Unit 対応表

| FR ID | 内容 (要約) | 主担当 Unit | 補助 Unit |
|---|---|:---:|:---:|
| FR-41 | プロンプト送信時に Hook が VS Code コマンドを実行 | **3** (Hook 定義) | 1 (コマンド受け口) |
| FR-42 | 優先順位順で URL を選び外部ブラウザで開く | **1** (UrlSelector + BrowserLauncher) | 2 (FIND_OR_OPEN_TAB 受信) |
| FR-43 | URL リストの 2 ソースマージ (A: Chrome, B: settings) | **1** (UrlListMerger) | 2 (GET_SITES 提供) |
| FR-44 | 2 パス探索 (URL 完全一致 → ドメイン → 新規) | **2** (TabManager 既存ロジック流用) | 1 (FIND_OR_OPEN_TAB 送信) |
| FR-45 | 動画自動再生 (PlaybackTrigger) | **2** (既存 PlaybackTrigger 流用) | — |
| FR-46 | AI 完了時に Hook が VS Code コマンドを実行 | **3** (Hook 定義) | 1 (コマンド受け口) |
| FR-47 | 動画一時停止指示 (PAUSE_MEDIA) | **1** (IpcClient.notify) | 2 (PAUSE_MEDIA 受信 + PlaybackPause 流用) |
| FR-48 | osascript で Kiro 最前面化 | **1** (WindowActivator) | — |
| FR-49 | 戻り完了後に内部状態を Idle にリセット | **1** (WaitOrchestratorIde) | — |
| FR-50 | ローカル WebSocket サーバー (ws://127.0.0.1:39472) | **1** (IpcClient) | — |
| FR-51 | Chrome 拡張側 WebSocket クライアント + 指数バックオフ再接続 | **2** (IdeBridge) | — |
| FR-52 | IPC メッセージプロトコル (7 タイプ) | **1 と 2 の共有 contract** | — |
| FR-53 | IPC 通信失敗を許容 (フォールバック) | **1** (BrowserLauncher) | — |
| FR-54 | settings.json で urls / enabled を提供 | **1** (SettingsReader + package.json contributes) | — |
| FR-55 | enabled=false で no-op | **1** (WaitOrchestratorIde) | — |
| FR-56 | URL リスト両方空で no-op | **1** (WaitOrchestratorIde) | — |
| FR-57 | Hook テンプレートを同梱、README で手順 | **3** (Hook ファイル) | 1 (README 記述) |
| FR-58 | Chrome 拡張に sw/ide_bridge.js を追加 | **2** | — |
| FR-59 | service_worker.js から ide_bridge.js を import | **2** | — |
| FR-60 | 既存 WaitOrchestrator / TabManager 無変更 | **2** (制約) | — |
| FR-61 | Options Page に IPC ON/OFF トグル | **2** (OptionsAppIpcToggle) | — |

---

## 2. NFR ↔ Unit 対応表

| NFR ID | 内容 (要約) | 主担当 Unit | 補助 Unit |
|---|---|:---:|:---:|
| NFR-21 | TypeScript (Unit 1) + JS (Unit 2) | 全 unit | — |
| NFR-22 | ローカル開発のみ配布 | 全 unit | — |
| NFR-23 | 自動テストなし、手動 E2E のみ | 全 unit (Build & Test) | — |
| NFR-24 | WebSocket は 127.0.0.1 のみ | **1** (IpcClient bind) | 2 (接続先確認) |
| NFR-25 | macOS 限定 | **1** (osascript) | — |
| NFR-26 | 日本語固定 | 全 unit | — |
| NFR-27 | Chrome 拡張の後方互換性 | **2** (Critical) | — |
| NFR-28 | IPC 起動失敗時の機能停止禁止 | **1** (フォールバック) | — |
| NFR-29 | シェルインジェクション対策 (execFile) | **1** (WindowActivator) | — |

---

## 3. Unit 別 FR/NFR サマリ

### 3.1 Unit 1: vscode-extension

**主担当**: FR-42, FR-43, FR-47, FR-48, FR-49, FR-50, FR-52, FR-53, FR-54, FR-55, FR-56  
**補助**: FR-41, FR-46, FR-57  
**主担当 NFR**: NFR-24, NFR-25, NFR-28, NFR-29

### 3.2 Unit 2: chrome-extension-bridge

**主担当**: FR-44, FR-45, FR-51, FR-58, FR-59, FR-60, FR-61  
**補助**: FR-42, FR-43, FR-47  
**主担当 NFR**: NFR-27 (最重要)

### 3.3 Unit 3: agent-hooks-templates

**主担当**: FR-41, FR-46, FR-57  
**補助**: なし  
**主担当 NFR**: なし (静的 JSON のため)

---

## 4. ユーザーストーリー (継承) との対応

cycle-1 で確定したペルソナ + ユーザーストーリーは継承 (`aidlc-docs-waitless-archive/cycle-1/inception/user-stories/personas.md`)。cycle-4 で新規追加されるストーリーはないが、暗黙的なストーリーとして以下が想定される:

> **暗黙ストーリー US-401**: AI ユーザーが Kiro でプロンプトを送信したら、自動で外部ブラウザの娯楽サイトが開いてほしい。AI が完了したら自動で Kiro が前面に来てほしい。  
> **対応 FR**: FR-41, FR-42, FR-46, FR-48  
> **担当 Unit**: 主担当 1, 補助 2/3

> **暗黙ストーリー US-402**: 既存の WaitLess Chrome 拡張で設定した sites リストを、Kiro でも使い回したい (二重管理したくない)。  
> **対応 FR**: FR-43 (Source A 優先)  
> **担当 Unit**: 主担当 1, 補助 2

> **暗黙ストーリー US-403**: 設定共有しない Chrome 拡張未稼働の環境でも、settings.json で URL リストを管理して動作してほしい。  
> **対応 FR**: FR-54, FR-53, NFR-28  
> **担当 Unit**: 1

これらのストーリーは Build and Test ステージで E2E シナリオに展開される。

---

## 5. カバレッジチェック

- ✅ FR-41 〜 FR-61 (21 件) すべて担当 unit が割り当てられている
- ✅ NFR-21 〜 NFR-29 (9 件) すべて担当 unit が割り当てられている
- ✅ Anti-Scope (AS-01〜11) は対象外として認識済み

---

## 6. 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- Unit 定義: `unit-of-work.md`
- Unit 依存: `unit-of-work-dependency.md`
- 既存ペルソナ: `aidlc-docs-waitless-archive/cycle-1/inception/user-stories/personas.md`
