# cycle-4 — Application Design Plan

最終更新: 2026-05-27

## 1. 計画

このステージで作成する成果物:

- [x] `aidlc-docs/inception/application-design/components.md` — 各コンポーネントの定義と責務 ✅
- [x] `aidlc-docs/inception/application-design/component-methods.md` — 各コンポーネントのメソッドシグネチャ (詳細ロジックは Functional Design へ) ✅
- [x] `aidlc-docs/inception/application-design/services.md` — サービス定義とオーケストレーションパターン ✅
- [x] `aidlc-docs/inception/application-design/component-dependency.md` — 依存関係マトリクス + データフロー図 ✅
- [x] `aidlc-docs/inception/application-design/application-design.md` — 上記の統合版 ✅

## 2. 設計上の意思決定事項 (質問)

要件確定の過程で大半の方針は決まっていますが、Application Design レベルでまだ未確定の項目について確認させてください。

回答は `[Answer]:` タグの後ろに letter (A, B, C, ...) を記入してください。

---

### Question 1: vscode-extension の TypeScript モジュール構成

vscode-extension のコード分割方針は?

A) **責務ごとに細かく分割** — `extension.ts` (entry) / `hookCommands.ts` / `ipcClient.ts` / `urlSelector.ts` / `browserLauncher.ts` / `windowActivator.ts` / `settingsReader.ts` / `state.ts` 等、各 file 1 責務 (~100 行)
B) **中庸** — `extension.ts` (entry) / `core.ts` (Hook 受信 + URL 選択 + ブラウザ起動 + ウィンドウフォーカスをまとめる) / `ipcClient.ts` (IPC のみ別) / `settings.ts` (設定読み込みのみ別) の 4 ファイル
C) **最小構成** — `extension.ts` 1 ファイルに全て押し込む (シンプル、cycle-1〜3 と同じ思想)
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

### Question 2: IPC プロトコルのバージョニング

WebSocket メッセージプロトコル (FR-52) のバージョン管理方針は?

A) **明示的な version フィールド** — 各メッセージに `version: "1.0"` を含める。将来の互換性のため
B) **暗黙の version (なし)** — 現時点では version フィールドを持たない、cycle-4 の規模では不要
C) **handshake のみで version 確認** — 接続確立時の `HELLO` メッセージで両者の version を交換、不一致なら警告ログだけ出す
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

### Question 3: Hook 起動時のコマンド名前空間

VS Code 拡張機能が公開する Command Palette コマンド (Hook がこれを runCommand で呼ぶ) の命名規則は?

A) **`waitless-ide.onAiBusy` / `waitless-ide.onAiIdle`** (短く、Hook イベント名と対応)
B) **`waitless-ide.onPromptSubmit` / `waitless-ide.onAgentStop`** (Kiro Hook イベント名と完全一致)
C) **`waitless.startWaiting` / `waitless.endWaiting`** (動詞ベース、UX 的に分かりやすい)
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

### Question 4: 既存 Chrome 拡張の `IdeBridgeClient` の Service Worker 起動タイミング

Chrome 拡張の `sw/ide_bridge.js` が WebSocket 接続を試みるタイミングは?

A) **Service Worker 起動と同時** (`service_worker.js` の最初で `init()` 呼び出し) — 常時待機
B) **WaitOrchestrator が WAIT_DETECTED を受信したタイミングで遅延起動** — 必要なときだけ接続
C) **Options Page で IPC ON/OFF トグル (FR-61) を ON にしたタイミングで起動 / OFF で切断** — ユーザー制御
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 5: VS Code 拡張側 IPC サーバーの起動方針

VS Code 拡張機能の WebSocket サーバー (FR-50) の起動タイミングは?

A) **拡張機能 activate 時に即起動、deactivate 時に停止** — 標準的、常時起動
B) **`aiWaitLessMode.enabled = true` の場合のみ起動、`false` で停止** — 設定変更で動的切替
C) **初回 Hook 起動時に lazy 起動、idle 時間 N 分で自動停止** — 省リソース
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 6: URL リストのマージ戦略 (FR-43 の詳細)

VS Code 拡張側の `aiWaitLessMode.urls` (Source B) と Chrome 拡張の sites リスト (Source A) のマージ規則 (FR-43) を詳細化:

A) **A 優先、B はフォールバック** — Source A が IPC で取得できれば A のみ使用 (B は無視)。A が取得不可 (Chrome 拡張未起動 / IPC 失敗) のときは B を使う
B) **A → B の順で連結 (重複除去)** — Source A の sites の URL を先頭に、続けて B を追加。A と B の重複は A 側を優先
C) **B → A の順で連結 (重複除去)** — Source B を先頭に、A を追加 (VS Code 設定が master)
D) **B 優先、A はフォールバック** — Source B が空のときだけ A を使用
X) Other (please describe after [Answer]: tag below)

[Answer]: A, Chromeのsiteリストをマスターとして、aiWaitLessMode.urlsはなくてもいい

---

## 3. 補足

質問への回答が完了したら「done」「完了」等で合図してください。回答後、Application Design 成果物 (5 つの md ファイル) を生成します。

各質問への回答は要件 §3 (FR) と整合しないものを選ぶこともできますが、その場合は要件側を修正することになります (要回答後の整合性チェック)。
