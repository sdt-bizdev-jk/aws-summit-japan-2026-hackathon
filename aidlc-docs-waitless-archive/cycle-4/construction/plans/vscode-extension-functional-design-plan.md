# cycle-4 — Unit 1 (vscode-extension) — Functional Design Plan

最終更新: 2026-05-27

## 1. このステージで作成する成果物

- [x] `aidlc-docs/construction/vscode-extension/functional-design/business-logic-model.md` — 待ちサイクルのビジネスロジックモデル + 状態遷移 ✅
- [x] `aidlc-docs/construction/vscode-extension/functional-design/business-rules.md` — BR (Business Rules) 一覧 (cycle-1〜3 の BR 番号と衝突しないよう BR-41 から開始) ✅
- [x] `aidlc-docs/construction/vscode-extension/functional-design/domain-entities.md` — IPC メッセージ等のドメインエンティティ ✅
- [x] `aidlc-docs/construction/vscode-extension/functional-design/nfr-inline.md` — NFR の inline 対応 (NFR Design ステージをスキップしているため) ✅

## 2. 確認事項

Application Design でほとんど確定済 (D-01〜D-14)。Functional Design 固有で確認が必要な項目は **5 件**:

---

### Question 1: TypeScript の `strict` モードと型品質基準

`tsconfig.json` の strict 設定はどうしますか?

A) **`"strict": true` (フル strict)** — `strictNullChecks`, `noImplicitAny`, etc. をすべて ON。型品質を最大化、コード量増加 (any 禁止)
B) **緩い strict** — `"strict": true` だが `"strictNullChecks": false` などを部分 OFF。書きやすさ優先
C) **strict OFF** — `"strict": false`、JS 移植くらい緩く書く
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 2: `runCommand` の正確な構文と動作確認方法

Hook テンプレートの `runCommand` から VS Code Command Palette のコマンドを呼ぶ方法は、Kiro の Hook 仕様に依存します。可能な実装パターン:

A) **`code --command waitless.startWaiting`** — VS Code CLI 経由で発火 (動作するか要確認、新規プロセスを spawn する分の遅延あり)
B) **AppleScript 経由 `osascript -e "tell application \"Kiro\" to ..."`** — 不確実、Kiro 側に AppleScript インタフェースが必要
C) **Kiro Hook の `runCommand` が直接 VS Code Command を実行できる** — 公式に対応していれば最も正攻法
D) **`code --command` は直接的には Command Palette を呼ばないので、別経路** — 例えば WebSocket 経由で Hook 自身が startWaiting メッセージを送る (この場合、Hook テンプレートに小さなスクリプトが必要)
E) **Functional Design では仮で A を採用、実機検証で動かなければ Build & Test で代替案にフォールバック** — pragmatic
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

### Question 3: WebSocket サーバーのライブラリ選択

Node.js で WebSocket サーバーを立てるためのライブラリは:

A) **`ws` (npm)** — 業界標準、軽量、依存最小 (最も実績ある選択)
B) **`socket.io`** — 機能豊富だが重め、再接続ハンドリング自動
C) **Node.js 標準の `http` + 手書き WebSocket フレーミング** — 依存ゼロだが実装コスト大
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 4: `tab_manager.js` の `injectPlaybackPause` 昇格 (Unit 2 への影響)

cycle-1 の `wait_orchestrator.js` 内で定義されているクロージャ的な PlaybackPause 注入ロジックを、Unit 2 の `IdeBridge` から呼ぶには、以下のいずれかが必要です:

A) **`tab_manager.js` に `injectPlaybackPause(tabId)` メソッドを export 化** — 既存の cycle-1〜3 シナリオは `wait_orchestrator` 内のクロージャで呼ぶので影響なし、IdeBridge は新メソッドを呼ぶ
B) **`IdeBridge` 側で同じロジックを再実装 (重複)** — DRY 違反だが既存ファイルは完全無変更 (FR-60 厳守)
C) **`wait_orchestrator.js` の関数を export して直接呼ぶ** — 既存 wait_orchestrator が改変扱いになる
X) Other (please describe after [Answer]: tag below)

[Answer]: よくわからないので、それぞれの選択肢のメリットデメリットを教えて

---

### Question 5: VS Code 拡張機能のアクティベーションイベント

`package.json` の `activationEvents` で、いつ拡張機能をロードするかを定義します:

A) **`onStartupFinished`** — VS Code 起動完了後にロード (常時ロード)。Q5=A の「activate 時即起動」と整合
B) **`onCommand:waitless.startWaiting`** — コマンド初回実行時にロード (lazy)。最初の Hook 発火が遅れる可能性
C) **`*`** (ワイルドカード、非推奨) — VS Code 起動と同時にロード (最速だがリソース無駄)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

回答が完了したら「done」「完了」等で合図してください。
