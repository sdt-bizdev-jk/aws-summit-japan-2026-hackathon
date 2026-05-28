# cycle-4 — Unit 1 (vscode-extension) — Code Generation Plan

最終更新: 2026-05-27

## 1. 概要

Unit 1 のコード生成計画。Functional Design / NFR Requirements で確定した内容に基づき、以下の構成で実装する:

- 物理ファイル: `vscode-extension/` 配下に新規作成
- 言語: TypeScript 5.5.4 (フル strict)
- ビルド: `tsc` のみ
- 単一ファイル `src/extension.ts` に全 9 論理コンポーネント (Q1=C 確定)

## 2. 関連 Story / FR / BR

- **暗黙ストーリー**: US-401, US-402, US-403 (`unit-of-work-fr-map.md` §4 参照)
- **主担当 FR**: FR-42, FR-43, FR-46〜50, FR-52〜56
- **BR**: BR-41〜58 (cycle-4 Unit 1 用、`business-rules.md` 参照)

## 3. 依存関係

- **下位ユニット**: なし (Unit 1 は最初に作る)
- **上位ユニット**: Unit 2, 3 が Unit 1 の IPC プロトコル / コマンド名に依存
- **既存コード依存**: なし (新規 unit)

## 4. ファイル一覧 (Greenfield 新規作成)

すべて新規作成:

| パス | 種別 | 内容 |
|---|---|---|
| `vscode-extension/package.json` | metadata | `tech-stack-decisions.md` §6 通り |
| `vscode-extension/tsconfig.json` | config | `tech-stack-decisions.md` §7 通り |
| `vscode-extension/.gitignore` | config | `node_modules/` / `out/` / `*.vsix` |
| `vscode-extension/.vscodeignore` | config | (将来 VSIX 用、`tech-stack-decisions.md` §8) |
| `vscode-extension/README.md` | docs | ユーザー向けインストール / 動作確認 / Hook テンプレート使用手順 |
| `vscode-extension/src/extension.ts` | code | Unit 1 のメイン、約 500-700 行を想定 |

cycle-4 のスコープでは VSIX ビルドはオプションのため、`.vscodeignore` は cycle-4 では作成スコープから除外可だが、将来サイクルでの VSIX 化のために用意しておく。

ドキュメント (`aidlc-docs/construction/vscode-extension/code/code-generation-summary.md`) は最終ステップで作成。

## 5. 実装ステップ

### Step 1: プロジェクト構造のセットアップ
- [x] `vscode-extension/` ディレクトリ作成 (file 作成で自動)
- [x] `vscode-extension/package.json` の作成 (`tech-stack-decisions.md` §6 から転記)
- [x] `vscode-extension/tsconfig.json` の作成 (`tech-stack-decisions.md` §7 から転記)
- [x] `vscode-extension/.gitignore` の作成
- [x] `vscode-extension/.vscodeignore` の作成 (将来 VSIX 用)

### Step 2: extension.ts の実装 (Section 1: 全体構造とエントリ)
- [x] `vscode-extension/src/extension.ts` の作成
- [x] ファイル先頭: imports / type definitions / constants
- [x] `activate(context)` / `deactivate()` の export 関数 (中身は他セクションで埋める)

### Step 3: extension.ts の実装 (Section 2: SettingsReader + UrlListMerger + UrlSelector)
- [x] `SettingsReader` class
- [x] `UrlListMerger` class
- [x] `UrlSelector` class
- [x] BR-42, BR-45, BR-46, BR-48 のロジックを実装

### Step 4: extension.ts の実装 (Section 3: IpcClient)
- [x] `IpcClient` class (WebSocket サーバー、`ws` ライブラリを使用)
- [x] `start()` / `stop()` / `request()` / `notify()` / `isConnected()` メソッド
- [x] BR-54 (ポート競合許容) のロジック
- [x] PendingRequest の Map 管理、タイムアウト処理

### Step 5: extension.ts の実装 (Section 4: BrowserLauncher + WindowActivator)
- [x] `BrowserLauncher` class
  - [x] BR-49 (フォールバック)、BR-55 (URL バリデーション)
- [x] `WindowActivator` class
  - [x] BR-51 (シェルインジェクション対策)、BR-52 (失敗許容)、NFR-21-PF-1 (macOS 判定)

### Step 6: extension.ts の実装 (Section 5: WaitOrchestratorIde + CommandRegistry)
- [x] `WaitOrchestratorIde` class
  - [x] `startWaiting()` のフロー実装 (BR-41, BR-43, BR-47)
  - [x] `endWaiting()` のフロー実装 (BR-44, BR-50)
- [x] `registerCommands()` 関数 (BR-56)

### Step 7: extension.ts の実装 (Section 6: activate/deactivate の中身)
- [x] `activate()` で各 class のインスタンス化、IpcClient.start()、registerCommands、設定購読を組み立てる
- [x] `deactivate()` で IpcClient.stop()、進行中サイクルがあれば endWaiting() で cleanup

### Step 8: README.md の作成
- [x] `vscode-extension/README.md` の作成
- [x] インストール手順 (`code --extensionDevelopmentPath`)
- [x] Agent Hooks テンプレートの使い方 (Unit 3 の成果物にリンク)
- [x] Settings の説明
- [x] 既知の制限事項 (macOS 限定、Kiro 限定、Hook 動作確認の必要性)

### Step 9: Code Generation Summary の作成
- [x] `aidlc-docs/construction/vscode-extension/code/code-generation-summary.md` の作成
- [x] 生成したファイル一覧、各 BR と実装箇所の対応、未確認事項 (Hook 仕様の実機検証等)

### Step 10: ビルド検証
- [x] `vscode-extension/` で `npm install` 実行 (依存ライブラリのインストール) — 6 packages installed
- [x] `npm run compile` で `tsc` がエラーなく通ることを確認 — 1 件の型エラー (`WebSocket.RawData` → `RawData` に修正) 後に成功
- [x] `out/extension.js` が生成されることを確認 — 22KB の extension.js + sourcemap 生成確認済

## 6. アンチスコープ (Code Generation)

- ❌ 自動テストの実装 (NFR-23)
- ❌ VSIX ビルド (cycle-4 ではオプション、Build & Test で別途検討)
- ❌ Marketplace 公開準備
- ❌ ロゴ / アイコンファイルの作成 (assets/ ディレクトリは空のまま、cycle-5 以降で対応)

---

## 7. 推定スコープ

- 新規ファイル: 6 件 + ドキュメント 1 件 = 7 件
- `extension.ts` の行数: 約 500-700 行 (コメント込み)
- 推定作業時間: 1 サイクル内で完了可能

回答 / 承認後、Step 1 から実装を開始します。

承認していただける場合は「承認」「OK」等で合図してください。
