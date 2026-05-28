# cycle-4 — Requirements (確定版)

最終更新: 2026-05-27

cycle-4 のスコープは「**WaitLess の体験を Kiro IDE 側に持ち込み、AI 応答待ち時間にブラウザを開いてユーザーの時間を有効活用する**」ための拡張機能群を新規構築すること。

---

## 1. Intent Analysis

| 項目 | 内容 |
|---|---|
| **User Request** | VS Code (Kiro) 拡張機能を作成。AI 待ち時間に外部ブラウザで URL を開き、AI 出力完了 / ユーザー入力要求時に Kiro ウィンドウを自動フォーカス。URL リストは設定可能。 |
| **Request Type** | New Feature (新規 unit、既存 Chrome 拡張は連動レイヤー追加で改修対象) |
| **Scope Estimate** | Cross-system (新規 VS Code 拡張 + 既存 Chrome 拡張への通信モジュール追加 + 双方向通信プロトコル) |
| **Complexity Estimate** | Complex (Agent Hooks / OS 依存処理 / IPC レイヤー / 双方向通信プロトコルが絡む) |
| **Requirements Depth** | Standard (機能要件 + NFR を明確化、複数 unit に分解する必要あり) |

---

## 2. スコープサマリ (確定)

cycle-4 で構築するもの (Pattern γ):

1. **新規** Kiro IDE 用 VS Code 拡張機能 (TypeScript / `vscode-extension/` 配下)
2. **改修** 既存 WaitLess Chrome 拡張 (cycle-3 完了状態) に通信モジュールを追加
3. **新規** ローカル IPC レイヤー (HTTP/WebSocket 経由、VS Code 拡張とブラウザ拡張間の双方向通信)
4. **新規** Agent Hooks 定義 (`.kiro/hooks/*.json` をユーザー環境にインストールするためのテンプレート)

ターゲット OS: macOS (cycle-4 開発環境)。Windows / Linux は将来 cycle で対応 (Backlog)。
ターゲット IDE: **Kiro IDE 限定** (Agent Hooks 必須)。

---

## 3. Functional Requirements (FR)

### 3.1 待ち時間トリガー (ユーザーがプロンプト送信した時)

- **FR-41**: ユーザーが Kiro AI チャットでプロンプトを送信すると、Kiro の Agent Hook (`promptSubmit` イベント) が発火する。Hook は VS Code 拡張機能の特定コマンド (`waitless-ide.onAiBusy` 等) を `runCommand` で実行する。
- **FR-42**: コマンド実行を受け、VS Code 拡張機能は登録済 URL リストから **優先順位順 (priority=1 を最優先)** で 1 件を選び、外部ブラウザで開く。
- **FR-43**: URL リストは以下の 2 つのソースをマージして取得する。Chrome 拡張側のリストを優先するが両方使う:
  - **Source A (Chrome 拡張)**: 既存 WaitLess Chrome 拡張の `chrome.storage.local.sites` (`{domain, url, priority}[]`) を **IPC レイヤー経由で一方向に読み取る**
  - **Source B (VS Code 設定)**: `settings.json` の `aiWaitLessMode.urls: string[]` (フラットな URL 配列、登録順 = priority 順)
  - **マージ規則**: Source A が利用可能なときは A を優先。A が空または通信失敗のときは B を使う
- **FR-44**: 外部ブラウザで開く際は、まず IPC レイヤー経由で Chrome 拡張に問い合わせ、**既に同じ URL のタブが開いていれば** そのタブをアクティブ化する (Pass 1 / cycle-1〜3 の 2 パス探索を踏襲)。なければドメイン一致タブに navigate (Pass 2)、それもなければ新規タブで開く (Pass 3)。
- **FR-45**: 外部ブラウザがフロントに来た後、**Chrome 拡張がタブに動画があれば自動再生を試みる** (cycle-1〜3 の PlaybackTrigger 動作を継承)。

### 3.2 AI 出力完了トリガー (Kiro へ戻る時)

- **FR-46**: Kiro の Agent Hook (`agentStop` イベント、AI 応答完了時 / ユーザー入力要求時) が発火する。Hook は VS Code 拡張機能の特定コマンド (`waitless-ide.onAiIdle` 等) を `runCommand` で実行する。
- **FR-47**: コマンド実行を受け、VS Code 拡張機能は IPC レイヤー経由で Chrome 拡張に「動画を一時停止せよ」(PlaybackPause 相当) のメッセージを送る。
- **FR-48**: その後、`osascript` 経由で AppleScript (`tell application "Kiro" to activate`) を実行し、Kiro ウィンドウを最前面に引き出す。**ブラウザタブは閉じない** (cycle-1〜3 と同じ思想)。
- **FR-49**: 戻り完了後、VS Code 拡張機能は内部状態 (現在の待ちサイクル) を Idle にリセットする。

### 3.3 IPC レイヤー (VS Code 拡張 ↔ Chrome 拡張)

- **FR-50**: VS Code 拡張機能起動時に、ローカル WebSocket サーバー (デフォルト `ws://127.0.0.1:39472`、`localhost` のみ bind、外部公開しない) を立てる。
- **FR-51**: WaitLess Chrome 拡張は Service Worker から WebSocket クライアントとしてサーバーに接続する。接続失敗時は指数バックオフで再試行する (最大 30秒間隔)。
- **FR-52**: メッセージプロトコルは JSON (`{ type, payload, requestId? }`)、双方向。以下のタイプを定義:
  - `GET_SITES` (VS Code → Chrome): Chrome 拡張の sites リストを要求
  - `SITES_RESPONSE` (Chrome → VS Code): sites リストを返す
  - `FIND_OR_OPEN_TAB` (VS Code → Chrome): 2 パス探索 + 必要なら新規タブを依頼
  - `TAB_OPENED` (Chrome → VS Code): どのタブで開いたか報告
  - `PAUSE_MEDIA` (VS Code → Chrome): 現在の娯楽タブの動画を一時停止
  - `MEDIA_PAUSED` (Chrome → VS Code): 一時停止完了報告
  - `PING` / `PONG`: ヘルスチェック (30秒ごと)
- **FR-53**: VS Code 拡張機能は IPC 通信失敗を許容する (Chrome 拡張未起動 / WaitLess 未インストールでも、`vscode.env.openExternal` のフォールバックで動作)。

### 3.4 設定とライフサイクル

- **FR-54**: VS Code 拡張機能は `settings.json` で以下の項目を提供する:
  - `aiWaitLessMode.urls: string[]` — URL リスト (デフォルト `[]`、要件 §4 通り)
  - `aiWaitLessMode.enabled: boolean` — 機能全体の ON/OFF (デフォルト `true`)
- **FR-55**: `aiWaitLessMode.enabled = false` の場合、Hook 経由のコマンドが呼ばれても何もしない (silent no-op)。
- **FR-56**: URL リストが Source A / B の両方で空の場合、待ち時間トリガーが発火しても何もしない (silent no-op、要件 Q6=A 通り)。
- **FR-57**: Agent Hook 定義 (`.kiro/hooks/*.json`) のテンプレートは拡張機能のリポジトリに同梱し、README で「ユーザーがコピペで `.kiro/hooks/` 配下に置く」手順を明示する。

### 3.5 Chrome 拡張側の改修 (cycle-3 への追加)

- **FR-58**: 既存 WaitLess Chrome 拡張に **`sw/ide_bridge.js`** モジュールを追加。WebSocket クライアントを管理し、上記 §3.3 のプロトコルを実装する。
- **FR-59**: `sw/ide_bridge.js` は `service_worker.js` から import され、Service Worker 起動時に WebSocket 接続を試みる。接続が確立したら IPC ハンドラを起動。
- **FR-60**: 既存の WaitOrchestrator / TabManager は **完全無変更**。`ide_bridge.js` がコールバックでこれらを呼び出すラッパーとして動く。
- **FR-61**: Chrome 拡張の Options Page には IPC 機能の ON/OFF トグルを追加する (デフォルト ON)。

---

## 4. Non-Functional Requirements (NFR)

- **NFR-21**: 言語スタックは TypeScript (VS Code 拡張)、JavaScript (Chrome 拡張、cycle-3 と同じ無ビルド構成を継承)
- **NFR-22**: 配布形態は **ローカル開発のみ** (cycle-4)。VS Code 拡張は `code --extensionDevelopmentPath` または VSIX を手元でビルドしてインストール。Marketplace 公開は将来 cycle
- **NFR-23**: 自動テストは導入しない (cycle-1〜3 と同じ方針、NFR-04 を継承)。Build & Test 段階で **手動 E2E 手順書** を整備する
- **NFR-24**: WebSocket サーバーは `127.0.0.1` のみ bind し、外部公開しない (Security baseline は opt-out だが、最低限の常識的セキュリティとして明記)
- **NFR-25**: macOS 限定 (osascript / AppleScript の前提)
- **NFR-26**: 言語は日本語固定 (i18n は将来 cycle)
- **NFR-27**: 既存 Chrome 拡張への変更は **後方互換性を保つ** (cycle-1〜3 のシナリオが引き続き動作する)
- **NFR-28**: VS Code 拡張機能起動時に IPC サーバーが起動失敗した場合、機能を完全停止せず、`vscode.env.openExternal` でのフォールバック動作に切り替える
- **NFR-29**: VS Code 拡張機能から外部プロセス (`osascript`) を起動する際、ユーザー入力を直接コマンドに interpolate しない (シェルインジェクション対策、引数は配列で渡す `child_process.execFile` を使う)

---

## 5. Anti-Scope (cycle-4 では対象外)

- **AS-01**: 複数の Kiro / VS Code ウィンドウへの対応 (1 ウィンドウのみ前提)
- **AS-02**: AI チャットへのプログラム的アクセス (Claude API 呼び出し / プロンプト解析)
- **AS-03**: 多言語化 (i18n)
- **AS-04**: 統計機能 (待ち時間累計 / ブラウザ滞在時間累計)
- **AS-05**: Web 版 / モバイル版
- **AS-06**: VS Code / Cursor / Windsurf 等他フォークへの対応 (Kiro 限定、Agent Hooks 必須)
- **AS-07**: Windows / Linux への対応 (macOS 限定、osascript 前提)
- **AS-08**: Marketplace 公開 / Open VSX 公開 (ローカル開発のみ)
- **AS-09**: 自動テスト導入 (手動 E2E のみ)
- **AS-10**: 双方向の設定同期 (cycle-4 は Source A → VS Code の一方向のみ。VS Code → Chrome の同期はしない)
- **AS-11**: 同時に複数の AI セッションを管理する (1 サイクル = 1 待ち時間のシリアル処理)

---

## 6. Extension Configuration (Opt-In 結果)

| Extension | Status | 適用範囲 |
|---|---|---|
| Security Baseline | **OFF** (Q16=B) | PoC 規模のため強制ルールはなし。NFR-24/29 の最低限のセキュリティのみ自主的に守る |
| Property-Based Testing | **OFF** (Q17=C) | 自動テスト自体を導入しない (NFR-23) ため対象外 |

---

## 7. 主要なリスクと前提

### 7.1 技術リスク

| リスク | 内容 | 緩和策 |
|---|---|---|
| **R-01** | Kiro の Agent Hooks イベント (`promptSubmit` / `agentStop`) が想定通り発火しない可能性 | Hook テンプレートを README で詳細に記述、ユーザーが手動でコマンド実行できる Command Palette エントリも併設 |
| **R-02** | `osascript` の AppleScript で Kiro ウィンドウのアプリ名がインストール環境で異なる可能性 (例: "Kiro" vs "Kiro.app") | `aiWaitLessMode.appName` (cycle-4 では非公開、ハードコード = "Kiro") を将来 settings に出す。フォールバックとして `frontmost process` の検出も実装 |
| **R-03** | WebSocket 接続が確立する前に Hook が発火する可能性 | VS Code 拡張側で接続確立まで Hook イベントをキューイング、確立後にフラッシュ。最大待機 5 秒、超過は `vscode.env.openExternal` フォールバック |
| **R-04** | Chrome 拡張の Service Worker のアイドルアンロードで WebSocket が切断される可能性 | アンロード時は再接続を再試行する仕組みで対応 (FR-51 の指数バックオフ) |
| **R-05** | macOS の System Integrity Protection / 通知センター権限などで `osascript` が拒否される可能性 | 初回実行時に Apple Events 許可ダイアログが出る前提で README に記載 |

### 7.2 外部依存

- Kiro IDE (バージョン: 任意のリリース版)
- Google Chrome / Chromium 系ブラウザ (WaitLess Chrome 拡張を Unpacked ロード)
- macOS (osascript)
- Node.js (VS Code 拡張機能の TypeScript ビルド時のみ)

---

## 8. Initial User Request からの差分 / 撤回項目

要件確定の過程でユーザーと合意のうえ撤回・修正された項目:

- **撤回 D-01**: Initial Request の「URL リストから**ランダムに**1 つ選び」 → **「優先順位順 (cycle-1〜3 の 2 パス探索モデルと同じ)」** に変更 (Final-2=C)
- **追加 A-01**: Initial Request にはなかった「**既存 Chrome 拡張の sites リストを一方向で読み取る**」を追加 (Final-3=A)
- **追加 A-02**: Initial Request にはなかった「**Antigravity 風の IDE → ブラウザ制御 (動画一時停止 / タブ移動)**」を追加 (Final-1=B)
- **追加 A-03**: Initial Request にはなかった「**ローカル WebSocket IPC サーバー**」を追加 (Antigravity 風実装の必須前提)
- **追加 A-04**: Initial Request の「VS Code (Kiro) 拡張機能」を **Kiro 限定** に絞り込み (Q1=B → C1=A、Agent Hooks 必須のため)

---

## 9. 用語集

- **Kiro**: VS Code ベースの AI-IDE。本要件のターゲット環境
- **Agent Hooks**: Kiro 固有の機能。`.kiro/hooks/*.json` で IDE イベント (`promptSubmit` / `agentStop` 等) と Action (`runCommand` / `askAgent`) をマッピング
- **WaitLess Chrome 拡張**: cycle-1〜3 で構築した既存の Chrome 拡張機能 (`extension/`)
- **VS Code 拡張機能 (`vscode-extension/`)**: cycle-4 で新規作成。Kiro 環境用
- **IPC レイヤー**: VS Code 拡張 ↔ Chrome 拡張の通信を担うローカル WebSocket サーバー
- **2 パス探索**: cycle-1 で確定したタブ探索戦略 (URL 完全一致 → ドメイン一致 → 新規タブ)
- **Antigravity 風**: Google Antigravity を参考に、IDE 側からブラウザを制御する方式

---

## 10. 関連ドキュメント

- 詳細な質問・回答記録: `aidlc-docs/inception/requirements/requirement-verification-questions.md`
- Round 1 Clarification: `aidlc-docs/inception/requirements/requirement-clarification-questions.md`
- Round 2 Clarification: `aidlc-docs/inception/requirements/requirement-clarification-questions-2.md`
- 既存 Chrome 拡張アーキテクチャ: `docs/architecture.md`
- cycle-4 ハンドオーバー: `docs/cycle-4-handover.md`
- 監査ログ: `aidlc-docs/audit.md`
