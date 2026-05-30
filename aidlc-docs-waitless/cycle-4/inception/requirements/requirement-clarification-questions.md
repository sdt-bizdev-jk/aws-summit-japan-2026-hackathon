# cycle-4 — Requirements Clarification Questions

回答内容に整合性の確認が必要な箇所が 4 件ありますので、以下の clarification にご回答ください。`[Answer]:` タグの後ろに letter (A, B, C, ...) を記入してください。

---

## Clarification 1: ターゲット環境と Agent Hooks の整合性

**検出された問題**:
- Q1 で **B (Kiro + 純正 VS Code 両対応)** を選択
- 一方 Q2 / Q3 / Q4 で **Agent Hooks** を主軸とする方針を選択

**理由**: **Agent Hooks は Kiro IDE 固有の機能** (`.kiro/hooks/*.json`、`promptSubmit` / `agentStop` / `preToolUse` / `postToolUse` 等のイベント) で、純正 VS Code / Cursor / Windsurf 等には存在しません。

つまり、Agent Hooks ベースの実装は **Kiro でのみ動作** することになります。

### Clarification Question 1
ターゲット環境のスコープを再確認させてください。

A) **Kiro 限定に変更する** — Q1 を A に変更。Agent Hooks を主軸に実装し、VS Code Extension API は補助 (URL リスト管理 / `vscode.env.openExternal` 呼び出し) のみ使う。純正 VS Code は対象外
B) **Kiro 主、VS Code は subset** — Kiro では Agent Hooks 連携で完全動作。純正 VS Code でも拡張機能としてインストール可能だが、Hook 連携部分は動かないので「Command Palette から手動実行」のサブセット機能のみ提供
C) **Kiro + VS Code 両対応 (Q1=B 維持)、Agent Hooks は使わず別方式に変更** — Q2/Q3/Q4 を再選択。代わりに手動コマンド方式 (Q2=A) + ベストエフォート戻り (Q3=E) で実装
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Clarification 2: Q5 のランダム選択ロジック

**検出された問題**:
- Q5 で「cycle1, 2, 3 で作成したリストに準拠します」と回答

**理由**: cycle-1 〜 cycle-3 (既存 WaitLess Chrome 拡張) は **「優先順位順」** でサイトを選択する 2 パス探索モデルで、**ランダム選択ロジックは存在しません**。データ構造も `{ domain, url, priority }` の objects 配列で、要件 §4 の `aiWaitLessMode.urls: string[]` のフラットな配列とは異なります。

意図を確認させてください。

### Clarification Question 2
URL リストからランダム選択するロジックは具体的にどうしますか?

A) **完全ランダム (毎回独立)** — 元の Q5=A。最もシンプルで MVP 向き
B) **直前の URL を除外したランダム** — 元の Q5=B
C) **シャッフル消化型** — 元の Q5=C
D) **「ランダム選択ロジック自体は深く考えなくていい、最もシンプルな完全ランダムで OK」** という意味だった (= A 相当)
X) Other (please describe after [Answer]: tag below)

[Answer]: cycle-1 〜 cycle-3 (既存 WaitLess Chrome 拡張) は **「優先順位順」** でサイトを選択する 2 パス探索モデルでOK. ブラウザの設定にIDEも従うようにする

---

## Clarification 3: Q11 の Antigravity 風 IDE→ブラウザ制御 vs Q19 最小構成

**検出された問題**:
- Q11 で「**Antigravity のように Chrome 拡張を入れて IDE 側からブラウザ操作を真似してほしい**」と回答
- 一方 Q19 で「**最小構成で良い**」と回答

**理由**: Antigravity 風の IDE → ブラウザ制御 (タブ閉じない / 戻り時にタブを操作する等) を実現するには、**cycle-4 のスコープに以下が追加で必要** になります:
- 新しい **Chrome 拡張機能** (cycle-1〜3 の WaitLess Chrome 拡張とは別物) — IDE からの制御コマンドを受信し、ブラウザタブを操作
- **VS Code 拡張機能 ↔ Chrome 拡張機能の通信レイヤー** — Chrome Native Messaging または ローカル HTTP/WebSocket サーバー (例: Node.js Express)
- 双方向プロトコル定義、認証、エラーハンドリング、複数タブの状態管理

これは **MVP の範囲を大きく超える** 規模で、cycle-4 を 1 サイクルで完了させるのは難しい可能性があります。

### Clarification Question 3
Q11 と Q19 の整合をどう取りますか?

A) **cycle-4 は最小構成優先 (Q19 を尊重)** — Antigravity 風のブラウザ制御は cycle-5 以降の Backlog 化。cycle-4 では「Agent Hooks で外部ブラウザを開く / osascript で Kiro に戻る (タブは開いたまま)」までで完了とする
B) **cycle-4 で Antigravity 風 (Q11) も含める** — VS Code (Kiro) 拡張機能 + 補助 Chrome 拡張機能 + 通信レイヤーまでを 1 サイクルで実装。cycle-4 のスコープが大きく拡大
C) **cycle-4 では URL リスト管理 + Agent Hooks 連携の MVP を完成、cycle-5 で Antigravity 風を別 cycle として整理** — A とほぼ同じだが、Backlog に明示的に追加
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Clarification 4: Q18 のアンチスコープ

**検出された問題**:
- Q18 で **A (既存 Chrome 拡張との連動)** と **F (動画再生 / 一時停止のようなブラウザタブのコンテンツ操作)** を対象外として **選んでいない**
- つまり、これらは cycle-4 のスコープ内?

**理由**:
- A を対象外にしないということは、既存 WaitLess Chrome 拡張 (cycle-3 完了状態) との連動を cycle-4 で実装する? → 連動方法は何?
- F を対象外にしないということは、ブラウザタブのコンテンツ操作 (再生 / 一時停止 / タブ閉じる等) を cycle-4 で実装する? → これは Clarification 3 の Antigravity 風と関連?

### Clarification Question 4
Q18 の A, F の取り扱いを再確認させてください。

A) **A も F も実は対象外で、選び忘れただけ** — cycle-4 では既存 Chrome 拡張との連動なし、ブラウザタブのコンテンツ操作なし
B) **A は対象外、F のみ対象内** — Antigravity 風のブラウザタブ操作 (タブ閉じない / 媒体一時停止) を cycle-4 で実装。Clarification 3 を B または C に
C) **F は対象外、A のみ対象内** — 既存 Chrome 拡張と連動 (例: WaitLess Chrome 拡張の URL リストを VS Code 側からも参照する等)
D) **A も F も対象内** — 既存 Chrome 拡張連動 + ブラウザタブ操作の両方を実装。Clarification 3 を B または C に
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## まとめ

これら 4 つの clarification の組み合わせで、cycle-4 のスコープが以下のいずれかに収束します:

- **Pattern α (最小構成)**: Clarification 1=A, 2=A/D, 3=A/C, 4=A
  - Kiro 限定、Agent Hooks ベース、シンプルなランダム、ブラウザ制御なし
  - 規模: 小 (1 サイクルで楽に完了)
  
- **Pattern β (中規模)**: Clarification 1=B, 2=任意, 3=A/C, 4=A
  - Kiro 主 + VS Code subset 対応、ランダム単純、ブラウザ制御なし
  - 規模: 中 (1 サイクルで完了可能)

- **Pattern γ (大規模)**: Clarification 1=任意, 2=任意, 3=B, 4=B/D
  - Antigravity 風 Chrome 拡張連動レイヤーまで実装
  - 規模: 大 (1 サイクルで完了するか要再評価、複数 unit に分解必要)

回答が完了したら「done」「完了」等で合図してください。
