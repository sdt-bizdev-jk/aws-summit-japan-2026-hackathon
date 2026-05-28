# cycle-4 — Requirements Verification Questions

cycle-4 の要件 (VS Code / Kiro 拡張機能による「AI WaitLess Mode」の実装) を確定するため、以下の質問にご回答ください。

すべての質問について、`[Answer]:` タグの後ろに **letter (A, B, C, ...)** を記入してください。選択肢に当てはまらない場合は **Other (X) を選び、その後ろに自由記述** で説明してください。

回答が完了したら「done」「完了」等の合図をお願いします。

---

## A. ターゲット環境とトリガー検知

### Question 1
このcycle-4で対象とする「開発支援ツール」のスコープはどれですか? (どこで動かすことを想定するか)

A) **Kiro IDE のみ** — Kiro の VS Code ベースの拡張機能 API が前提。VS Code / Cursor / Windsurf 等の他フォークでは動作しなくてよい
B) **Kiro + 純正 VS Code** — Kiro と純正 VS Code の両方で動作する。両環境共通の VS Code Extension API のみ使用 (Kiro 固有 API は使わない / 検出しない)
C) **VS Code 系すべて** — Kiro、純正 VS Code、Cursor、Windsurf 等、VS Code Extension API 互換のすべて
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

### Question 2
「AI が作業中 (待ち時間)」をどう検知しますか? Kiro / VS Code には現在 (2026-05-27 時点)「AI チャットの応答ストリーミング」を直接購読する公開 API がない可能性が高いため、トリガー方式を選択する必要があります。

A) **手動コマンド方式 (Phase 1)** — ユーザーが Command Palette / キーボードショートカットで「待ち時間を始める」を発火。AI 出力完了は次回ユーザーがエディタをアクティブにしたタイミング (window.onDidChangeWindowState) または別コマンドで終了
B) **キーボードショートカット方式 (チャット送信に紐付け)** — チャット入力欄でユーザーが「Enter / 送信ショートカット」を押した瞬間にトリガーする (Kiro 側のキー入力をフックできる場合) ※ 実現可能性に依存
C) **エディタアイドル検出方式** — 一定時間 (例: 5秒) ユーザーがキーボード/マウス操作をせず、かつエディタがフォーカスを失っていない場合に「AI 出力待ちと推定」
D) **複合方式 (A の手動コマンド + 補助で C のアイドル検知)** — 手動で確実に始められ、戻りはアイドル検出 + ウィンドウフォーカス変化で判定
X) Other (please describe after [Answer]: tag below)

[Answer]: B, Agent HooksでAI作業開始時に外部ブラウザに移動、AI作業終了時もしくはユーザ入力待ちのHookでKiroに引き戻すようにする

---

### Question 3
「AI の出力完了 / ユーザー入力要求」のタイミングをどう検知し Kiro ウィンドウへ戻りますか?

A) **ユーザーが手動で完了コマンドを叩く** — 戻りタイミングをユーザーがコマンドで明示する (要件 §2「自動で戻る」とは矛盾する可能性あり)
B) **拡張機能内タイマーで N秒後に戻る** — 待ち開始から N秒経過で機械的に Kiro へ戻る (時間経過のみで戻るので AI 完了とは厳密に同期しない)
C) **AI 出力完了の検知は諦め、常駐ウォッチで「Kiro ウィンドウのコンテンツが変化したら戻る」アプローチ** — コンソール出力 / 通知 / アクティブエディタの変化等を Polling で観察
D) **Kiro 側の通知 / ステータスバー変化を OS 側プロセスから観察するハイブリッド** — VS Code Extension Host 内で onDidChangeNotifications 相当の API があればそれを使う、なければ stub
E) **要件 §2 の自動戻りはベストエフォート (実現可能な方式で実装) ** — 上記いずれかで実装し、限界は README に明記
X) Other (please describe after [Answer]: tag below)

[Answer]: Agent Hooksで対応できませんか？

---

### Question 4
ブラウザから Kiro ウィンドウへの「自動フォーカス (前面に出す)」はどう実現しますか? VS Code Extension API には拡張機能側からウィンドウを最前面に出す `bringToFront()` のような公式 API がないため、OS 依存の手段になります。

A) **macOS 限定 — `osascript` 経由で AppleScript を実行** (`tell application "Kiro" to activate`) (cycle-4 開発環境は macOS なので最優先)
B) **マルチプラットフォーム — macOS は AppleScript / Windows は PowerShell / Linux は wmctrl** で OS ごとに分岐
C) **Phase 1 は macOS 限定で実装、他 OS は将来対応** (Backlog 化)
D) **ブラウザ側 (拡張機能含む) からの戻り処理は実装せず、ユーザーが手動で Cmd+Tab する前提** (要件 §3 と矛盾するので非推奨)
X) Other (please describe after [Answer]: tag below)

[Answer]: A, Agent Hooksで osascript実行

---

## B. URL ランダム選択と外部ブラウザ起動

### Question 5
URL リストからのランダム選択ロジックはどうしますか?

A) **完全ランダム (毎回独立)** — 同じ URL が連続することも許容
B) **直前の URL を除外したランダム** — 直前と異なる URL を選ぶ (リストが 1 件の場合は除外せず再使用)
C) **シャッフル消化型** — リスト全体をシャッフルして順番に消化、消化しきったら再シャッフル (重複確率の偏りを最小化)
D) **重み付きランダム** — settings.json の各 URL に重みを設定可能 (拡張的)
X) Other (please describe after [Answer]: tag below)

[Answer]: cycle1, 2, 3で作成したリストに準拠します

---

### Question 6
URL リストが「空 / 未設定」の場合の動作は?

A) **何もしない (silent no-op)** — 待ち時間検知してもブラウザを開かない
B) **通知を出して何もしない** — VS Code の通知バー (`window.showInformationMessage`) で「URL を `aiWaitLessMode.urls` に設定してください」を表示
C) **デフォルト URL を 1 つ用意** — 空の場合は組み込みのデフォルト URL (例: `about:blank` / 拡張機能の README ページ等) を使う
D) **拡張機能を実質無効化 (status bar item で OFF 表示)**
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 7
「外部ブラウザで開く」の実装方式はどれですか?

A) **VS Code 公式 API `vscode.env.openExternal(uri)` のみ** — OS のデフォルトブラウザで開く。シンプル / マルチプラットフォーム
B) **`vscode.env.openExternal` を基本とし、settings.json で「特定のブラウザを指定する」オプションを追加可能** (例: `aiWaitLessMode.browser: "chrome" | "default"`、各 OS で `child_process.spawn` でブラウザプロセスを起動)
C) **常に `child_process` で外部ブラウザコマンドを直接 spawn** — OS ごとに分岐
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 8
URL リストの最低構成数 / バリデーションは?

A) **1 件以上を要求 / 各 URL は `https?://` で始まる絶対 URL のみ受付** — 不正な URL は通知でユーザーに知らせ、有効分のみ使用
B) **0 件 OK / 各 URL は形式バリデーションのみ (URL クラスで parse 可能か)** — 0 件は Q6 の挙動
C) **形式バリデーションせずそのまま渡す (ベストエフォート)** — `vscode.env.openExternal` がエラーを出したら通知のみ
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## C. UX とライフサイクル

### Question 9
ユーザーが手動で「待ち時間モードを ON/OFF (機能全体の有効化/無効化)」できる仕組みは必要ですか?

A) **必要 — settings.json `aiWaitLessMode.enabled: boolean` (デフォルト true) で制御**
B) **必要 — Status Bar Item でクリック切替可能 (settings.json も連動)**
C) **不要 — 拡張機能をインストールしている時点で常時有効、無効化したい場合は VS Code の拡張機能管理画面で disable**
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 10
ブラウザを開いている間、エディタ側に何か視覚フィードバックは必要ですか?

A) **必要 — Status Bar Item に「⏳ AI 待ち時間中…」のような表示 + 完了時に消える**
B) **必要 — 通知 (`window.showInformationMessage`) で開いた URL を表示**
C) **不要 — Silent (Status Bar 等の表示なし)**
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

### Question 11
要件 §2 の「自動で戻る」は、ブラウザを **閉じない (タブもそのまま)**、という条件があります。Kiro ウィンドウを前面に出した結果、ユーザーが Kiro 側の操作 (例: 新しいプロンプト送信) を始めたときの挙動は?

A) **戻った時点で「待ちサイクル」は完了。次のサイクルはユーザーが Q2 のトリガーを再実行 (例: 手動コマンド再実行)**
B) **連続サイクル (待ち→戻り→待ち→戻り) を自動で繰り返す** — Q2/Q3 のトリガーが満たされる限り永続的にサイクルが回る
C) **戻った時点でブラウザタブを「再生中だったメディアの一時停止」だけする** — 既存 WaitLess の Chrome 拡張的な発想 (ただし VS Code 拡張から外部ブラウザのタブには干渉できないので実装不可、選択肢としては不採用想定)
X) Other (please describe after [Answer]: tag below)

[Answer]: GoogleのAntigravityはChromeブラウザ拡張を入れると、IDE側からブラウザ操作が可能になるそうです。それを真似してIDEからブラウザ制御できるようにして

---

## D. 設定ファイル

### Question 12
`settings.json` でユーザーが設定できる項目はどこまで広げますか? (Q5/Q9/Q10/Q3 等で「設定可能」を選んだ場合に整合する)

A) **最小構成 — `aiWaitLessMode.urls: string[]` のみ** (要件 §4 通りそのまま)
B) **標準構成 — `urls`, `enabled`, `idleThresholdSec` (Q2 で C/D を選んだ場合のしきい値), `notify` (Q10)**
C) **拡張構成 — 上記 + `browser` (Q7), `randomMode` (Q5), `autoReturnSec` (Q3 の B を選んだ場合の戻りタイマー)**
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## E. 配布とテスト

### Question 13
拡張機能の配布形態は?

A) **VSIX ファイルとしてビルドして配布** (`.vsix` ファイルを README で配布、`code --install-extension` でインストール)
B) **Visual Studio Code Marketplace に公開** (要 publisher 登録、cycle-4 のスコープに含める)
C) **Open VSX Registry に公開** (Kiro / Cursor などの非公式マーケットプレイスでも利用可能、cycle-4 のスコープに含める)
D) **A のみ (VSIX 配布)、Marketplace 公開は将来 cycle**
E) **ローカル開発のみ (`code --extensionDevelopmentPath` でデバッグ起動できる状態にする)、配布形態は cycle-4 では決めない**
X) Other (please describe after [Answer]: tag below)

[Answer]: E

---

### Question 14
言語スタックは?

A) **TypeScript** (VS Code 拡張機能の標準、型安全、ESM, `tsc` でビルド) — 推奨
B) **JavaScript (素のまま、ビルド不要)** — 既存 Chrome 拡張と同じスタイルだが、VS Code 拡張機能としては型がない分やや弱い
C) **TypeScript + esbuild バンドル** — 単一ファイルにバンドルして配布、起動高速
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 15
自動テストの方針は?

A) **ユニットテスト + E2E (公式 `@vscode/test-electron` で VS Code を起動して E2E)** — 最も網羅的
B) **ユニットテストのみ** (Mocha / Vitest 等で純粋関数や設定パースをテスト)
C) **手動 E2E のみ** (Build & Test 段階で手順書を整備、自動テストは導入しない、cycle-1〜3 の WaitLess Chrome 拡張と同じ方針)
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## F. 拡張ルール (Extensions)

### Question 16: Security Extensions
このプロジェクトで Security Extension のルールを強制適用しますか?

A) Yes — 全 SECURITY ルールを **blocking constraint** として強制 (production-grade のアプリ向け推奨)
B) No — SECURITY ルールはスキップ (PoC, prototype, 実験的プロジェクト向け)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

### Question 17: Property-Based Testing Extension
このプロジェクトで Property-Based Testing (PBT) のルールを強制適用しますか?

A) Yes — 全 PBT ルールを blocking constraint として強制 (ビジネスロジック / データ変換 / シリアライゼーション / ステートフルなコンポーネントを含むプロジェクト向け推奨)
B) Partial — pure function とシリアライゼーション round-trip にのみ PBT ルールを強制 (アルゴリズム的複雑性が限定的なプロジェクト向け)
C) No — PBT ルールはスキップ (シンプルな CRUD / UI のみ / 薄い統合層 / 顕著なビジネスロジックなしのプロジェクト向け)
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## G. アンチスコープ

### Question 18
cycle-4 では **対象外** とすべきもの (将来 cycle 候補) を確認してください。複数選択可、letter をカンマ区切りで複数記入してください。

A) **既存の WaitLess Chrome 拡張との連動** (相互通信 / 設定共有 / メッセージング) — 別物として扱う、cycle-4 では一切連携しない
B) **複数の VS Code/Kiro ウィンドウへの対応** — 1 ウィンドウのみ前提、複数ウィンドウのアクティブ判定は対象外
C) **AI チャットへのプログラム的アクセス** (Claude API への直接呼び出し / プロンプト解析等) — 拡張機能はあくまで UX のみで、AI 機能には触れない
D) **多言語化 (i18n)** — 日本語固定でよい (既存 WaitLess も同様)
E) **詳細な統計機能** (待ち時間累計 / ブラウザ滞在時間累計 等) — Backlog 化、cycle-4 では実装しない
F) **動画再生 / 一時停止のような外部ブラウザタブのコンテンツ操作** — VS Code 拡張からは技術的に不可能なので明示的に除外
G) **Web 版 / モバイル版** — VS Code 系のデスクトップ拡張機能のみ
X) Other (please describe after [Answer]: tag below)

[Answer]: B, C, D, E, G

---

## H. 全体の方向性確認

### Question 19
cycle-4 全体として、どのスタンスで開発しますか?

A) **MVP 最優先** — 動くものを最短で作り、不確実性 (Q2/Q3 のトリガー検知) は手動コマンド方式 (Q2=A, Q3=B) で割り切る。アイドル検知や自動戻りの精度向上は将来 cycle
B) **標準的な拡張機能としての完成度** — Q2 は複合方式 (D)、設定項目は標準構成 (Q12=B)、テストはユニット + 手動 E2E (Q15=B + Build&Test 手順書)、配布は VSIX (Q13=A)
C) **本格的な配布前提** — TypeScript + esbuild、自動 E2E、Marketplace 公開、SECURITY 強制 (Q14=C, Q15=A, Q13=B, Q16=A)
X) Other (please describe after [Answer]: tag below)

[Answer]: X, 最小構成で良い

---

回答が完了したら「done」「完了」等で合図してください。回答内容に矛盾や曖昧さがあれば、追加の clarification ファイルを作成します。
