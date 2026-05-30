# cycle-4 — Unit of Work Plan

最終更新: 2026-05-27

## 1. 計画

このステージで作成する成果物:

- [x] `aidlc-docs/inception/application-design/unit-of-work.md` — 3 unit の定義と責務、コード組織化戦略 (Greenfield 部分について) ✅
- [x] `aidlc-docs/inception/application-design/unit-of-work-dependency.md` — unit 間の依存マトリクス + 開発順序 ✅
- [x] `aidlc-docs/inception/application-design/unit-of-work-fr-map.md` — FR と unit のマッピング (User Stories をスキップしたため、`unit-of-work-story-map.md` の代替) ✅

## 2. Application Design からの引き継ぎ

cycle-4 の unit 構成は Application Design で既に確定済:

1. **vscode-extension** — TypeScript、新規、`vscode-extension/` 配下
2. **chrome-extension-bridge** — JavaScript、既存 `extension/` への改修 (新規 `sw/ide_bridge.js` + `service_worker.js` 1 行追加 + Options 改修)
3. **agent-hooks-templates** — JSON 静的テンプレート、`vscode-extension/templates/hooks/` 配下

## 3. 決定事項の確認

ほとんどの decomposition 関連の意思決定は要件 / Application Design で確定済 (Q1=C シングルファイル、Q4=A 即起動、Q5=A 即起動、Sequential 開発戦略、Stateless IPC など)。Units Generation 固有で確認が必要な項目は **1 件のみ**:

---

### Question 1: vscode-extension のディレクトリ構造

新規作成する `vscode-extension/` のディレクトリレイアウトはどれが望ましいですか?

A) **VS Code 拡張機能の標準レイアウト**:
```
vscode-extension/
├── package.json
├── tsconfig.json
├── README.md
├── .vscodeignore
├── .gitignore
├── src/
│   └── extension.ts            (Q1=C により 1 ファイル)
├── out/                         (tsc ビルド出力、.gitignore)
├── templates/
│   └── hooks/
│       ├── 01-on-prompt-submit.json
│       └── 02-on-agent-stop.json
└── assets/                      (アイコン等、必要なら)
```

B) **Aモニリポ前提の最小構成**:
```
vscode-extension/
├── package.json
├── tsconfig.json
├── extension.ts                 (src/ なし)
├── templates/hooks/*.json
└── README.md
```
- src/ ディレクトリなしで extension.ts をルートに置く

C) **A から README を分離してリポジトリトップに置く**:
- A と同じだが、README.md は cycle-4 全体の README としてリポジトリ ROOT に配置

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

質問への回答が完了したら「done」「完了」等で合図してください。Units Generation 成果物 (3 つの md ファイル) を生成します。
