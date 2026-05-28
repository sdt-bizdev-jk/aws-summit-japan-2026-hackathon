# cycle-4 — Unit 3 (agent-hooks-templates) — Combined Plan

最終更新: 2026-05-27

Unit 3 は静的 JSON のみで成果物が小さいため、Functional Design / NFR Requirements / Code Generation を **1 つのプラン** に統合する。

## 1. このステージで作成する成果物

### 1.1 アプリケーション成果物 (Greenfield)

- [x] `vscode-extension/templates/hooks/01-on-prompt-submit.json` — promptSubmit イベント用 Hook ✅ (variant-a + variant-b)
- [x] `vscode-extension/templates/hooks/02-on-agent-stop.json` — agentStop イベント用 Hook ✅ (variant-a + variant-b)
- [x] `vscode-extension/templates/hooks/README.md` — ユーザー向け Hook テンプレートのコピー手順 ✅

### 1.2 ドキュメント

- [x] `aidlc-docs/construction/agent-hooks-templates/code/code-generation-summary.md` — Unit 3 統合サマリ ✅

## 2. 関連 Story / FR / BR

- **暗黙ストーリー**: US-401, US-403 (Hook で AI 待ち / 完了を捕捉)
- **主担当 FR**: FR-41, FR-46, FR-57
- **BR**: なし (静的 JSON のため)
- **NFR**: NFR-22 (ローカル開発のみ、ユーザー手動コピー)

## 3. Hook Schema (Kiro)

`/Users/nt-240003/workspace/aws-summit-japan-2026-hackathon/.kiro/steering/aws-aidlc-rules/core-workflow.md` の例に基づく:

```json
{
  "name": "string (required)",
  "version": "string (required)",
  "description": "string (optional)",
  "when": {
    "type": "promptSubmit | agentStop | preToolUse | postToolUse | ...",
    "patterns": ["..."],   // file 系 trigger のみ
    "toolTypes": ["..."]   // pre/postToolUse のみ
  },
  "then": {
    "type": "askAgent | runCommand",
    "prompt": "...",   // askAgent 用
    "command": "..."   // runCommand 用
  }
}
```

## 4. 確認事項

確認が必要な項目は **1 件**:

---

### Question 1: Hook の `runCommand` から VS Code Command Palette のコマンドを呼ぶ構文

Unit 1 の Functional Design Q2=C で「Kiro Hook の `runCommand` が直接 VS Code Command を実行できる」を前提としましたが、実機の挙動によります。テンプレートをどう用意しますか?

A) **Variant A 単体**: `runCommand` の `command` フィールドに直接 VS Code コマンド名を書く想定 (`"command": "waitless.startWaiting"`) — Kiro Hook 仕様で許容されている場合
B) **Variant B 単体 (CLI 経由)**: `runCommand` でシェルコマンドを実行し、VS Code CLI 経由でコマンド呼び出し (`"command": "code --command waitless.startWaiting"`) — 標準的な OS シェル経由、ただし VS Code CLI が `--command` をサポートしている前提
C) **Variant C 単体 (osascript)**: macOS で AppleScript を使い、VS Code に keystroke を送る (極めて複雑、推奨せず)
D) **2 バリアント併設**: A と B の両方をテンプレート化し、ユーザーが環境に合わせて選択できるようにする (1 ファイルずつではなく、複数 .json で対応)
E) **A 単体 + README で代替案を文章で説明**: テンプレート JSON は A で 2 ファイルだけ作成、Hook が動かなかった場合の対処 (CLI 経由の試行 / Command Palette 手動実行) を README で詳細に説明
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

回答後、選んだ方針で Hook テンプレートとドキュメントを生成します。

## 5. 推定スコープ

- 新規 JSON: 2-4 ファイル (Q1 の選択次第)
- README: 1 ファイル (~200 行)
- ドキュメント: 1 ファイル (Code Generation Summary)

合計 4-7 ファイル。
