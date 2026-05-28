# cycle-4 — Unit 3 (agent-hooks-templates) — Code Generation Summary

最終更新: 2026-05-27

Unit 3 (agent-hooks-templates) の Functional Design / NFR Requirements / Code Generation を統合した結果のサマリ。

---

## 1. ファイル一覧 (新規作成)

| パス | 種別 | 行数 | 内容 |
|---|---|---|---|
| `vscode-extension/templates/hooks/01-on-prompt-submit.variant-a.json` | Hook テンプレート | 11 | Variant A (直接コマンド) — promptSubmit |
| `vscode-extension/templates/hooks/02-on-agent-stop.variant-a.json` | Hook テンプレート | 11 | Variant A — agentStop |
| `vscode-extension/templates/hooks/01-on-prompt-submit.variant-b.json` | Hook テンプレート | 11 | Variant B (CLI 経由) — promptSubmit |
| `vscode-extension/templates/hooks/02-on-agent-stop.variant-b.json` | Hook テンプレート | 11 | Variant B — agentStop |
| `vscode-extension/templates/hooks/README.md` | ユーザー向け README | ~150 | バリアント選択方法、コピー手順、トラブルシューティング |

合計: 5 ファイル新規作成。

---

## 2. 設計判断

### 2.1 Q1=D (2 バリアント併設) を採用

Kiro Hook の `runCommand` が VS Code Command Palette のコマンドをどう扱うかは仕様により異なる可能性があるため、両方のバリアントを用意してユーザーが選択可能にした。

- **Variant A (推奨)**: `runCommand.command` に直接 VS Code コマンド名 (`waitless.startWaiting`) を指定
- **Variant B (代替)**: `runCommand.command` にシェルコマンド (`code --command waitless.startWaiting`) を指定

### 2.2 ファイル名規則

- バリアント区別のため `01-on-prompt-submit.variant-a.json` のようにサフィックス付き
- ユーザーがコピーする際は `01-on-prompt-submit.json` にリネーム (README に明記)

### 2.3 README の充実

cycle-4 で最も不確実性が高い領域 (Hook の `runCommand` 動作) のため、README には以下を含めた:
- バリアント選択フロー
- コピー手順 (ワークスペース / ユーザーグローバル両対応)
- 動作確認ステップ
- 動作しない場合のトラブルシューティング (3 シナリオ × 解決策)
- Hook Schema の概要
- 関連ドキュメントへのリンク

---

## 3. FR / BR / NFR の対応

### 3.1 FR

| FR ID | 対応 |
|---|---|
| FR-41 | `01-on-prompt-submit.*.json` の `when.type: "promptSubmit"` |
| FR-46 | `02-on-agent-stop.*.json` の `when.type: "agentStop"` |
| FR-57 | テンプレート同梱 + README でユーザー手動コピー手順を案内 |

### 3.2 BR

Unit 3 は静的 JSON のみで、ロジックなし。BR の概念は適用外。

### 3.3 NFR

| NFR ID | 対応 |
|---|---|
| NFR-22 | ローカル開発のみ、ユーザー手動コピー (Web Store 等で自動配布しない) |
| NFR-26 | README は日本語、Hook の name / description も日本語 |

---

## 4. 検証

### 4.1 静的検証

- ✅ JSON 構文: 全 4 ファイルで JSON.parse 可能 (`getDiagnostics` で確認)
- ✅ Hook Schema 準拠: cycle-4 hand-over に記載された Schema (`name` / `version` / `when` / `then`) 準拠

### 4.2 実機検証 (Build & Test ステージで実施)

- Variant A が Kiro で発火するか
- Variant B が Kiro で発火するか
- Hook 経由で `waitless.startWaiting` が呼ばれた結果、ブラウザが開くか
- Hook 経由で `waitless.endWaiting` が呼ばれた結果、Kiro が前面に来るか

---

## 5. 関連ドキュメント

- ユーザー向け README: `vscode-extension/templates/hooks/README.md`
- WaitLess IDE 拡張機能 README: `vscode-extension/README.md`
- 要件 (FR-41, FR-46, FR-57): `aidlc-docs/inception/requirements/requirements.md`
- Combined Plan: `aidlc-docs/construction/plans/agent-hooks-templates-combined-plan.md`
