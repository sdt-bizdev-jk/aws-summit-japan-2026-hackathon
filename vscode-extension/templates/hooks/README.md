# WaitLess IDE — Agent Hooks テンプレート (cycle-4 Unit 3)

このディレクトリには、Kiro IDE の **Agent Hooks** で WaitLess IDE 拡張機能を自動起動するためのテンプレート JSON が含まれています。

ユーザーが手動で `.kiro/hooks/` 配下にコピーすることで、cycle-4 の AI WaitLess Mode が体験できます。

## 前提

- **Kiro IDE** がインストールされていること (Agent Hooks は Kiro 固有機能)
- **WaitLess IDE 拡張機能** (`vscode-extension/`) が起動していること (Command Palette で `WaitLess: AI 待ち開始` が確認できる状態)
- macOS 環境

## ファイル一覧

cycle-4 では Hook の `runCommand` 構文の仕様差を吸収するため、**2 バリアント** を用意しています:

### Variant A — 直接コマンド呼び出し (推奨、まずこちらを試してください)

| ファイル | イベント | runCommand |
|---|---|---|
| `01-on-prompt-submit.variant-a.json` | `promptSubmit` (プロンプト送信時) | `waitless.startWaiting` |
| `02-on-agent-stop.variant-a.json` | `agentStop` (AI 応答完了時) | `waitless.endWaiting` |

Kiro Hook の `runCommand` が VS Code Command Palette のコマンドを直接実行できる場合の構文です。

### Variant B — CLI 経由 (Variant A が動かなかった場合の代替)

| ファイル | イベント | runCommand |
|---|---|---|
| `01-on-prompt-submit.variant-b.json` | `promptSubmit` | `code --command waitless.startWaiting` |
| `02-on-agent-stop.variant-b.json` | `agentStop` | `code --command waitless.endWaiting` |

`runCommand` がシェルコマンドとして解釈される場合の構文です。VS Code CLI (`code` コマンド) が `PATH` にある必要があります。

> Note: `code --command` は VS Code CLI のドキュメント化された機能ではない可能性があります。動作しない場合は次の「動作しない場合」セクションを参照してください。

## インストール手順

### Step 1: バリアントを選ぶ

まず Variant A を試すことをおすすめします。

### Step 2: Hook ファイルを `.kiro/hooks/` にコピー

ワークスペースの `.kiro/hooks/` ディレクトリにコピー、または ホームディレクトリの `~/.kiro/hooks/` にグローバルでコピーします。

```bash
# 例: Variant A をワークスペースの .kiro/hooks/ にコピー
mkdir -p .kiro/hooks
cp /path/to/vscode-extension/templates/hooks/01-on-prompt-submit.variant-a.json .kiro/hooks/01-on-prompt-submit.json
cp /path/to/vscode-extension/templates/hooks/02-on-agent-stop.variant-a.json .kiro/hooks/02-on-agent-stop.json
```

> Note: コピー時に `.variant-a` / `.variant-b` のサフィックスを **削除** してください (Kiro Hook 自身のファイル名規則を踏襲)。

### Step 3: Kiro IDE をリロード

Hook の変更を反映するため、Kiro を一度閉じて再起動するか、コマンドパレットから「Kiro: Reload Hooks」相当のコマンドを実行します。

### Step 4: 動作確認

1. Kiro でプロンプトを送信
2. 数秒以内に外部ブラウザで娯楽サイトのタブが開けば、`promptSubmit` Hook + Variant が動作している
3. AI 応答完了後に Kiro ウィンドウが自動的に最前面に来れば、`agentStop` Hook + Variant が動作している

## 動作しない場合

### 症状: Hook 自体は登録されているが、コマンドが実行されない

1. **Kiro の設定で Hook が有効化されているか確認**
   - エクスプローラの「Agent Hooks」セクションで Hook が ON になっているか
   - Kiro の出力パネルで Hook 関連のエラーがないか確認

2. **Variant A → Variant B に切り替え**
   - `.kiro/hooks/01-on-prompt-submit.json` を `01-on-prompt-submit.variant-b.json` の内容に書き換え (同様に `02-on-agent-stop.json` も)
   - Kiro をリロード

3. **VS Code CLI が PATH にあるか確認** (Variant B 用)
   ```bash
   which code
   code --version
   ```
   ない場合は VS Code (Kiro) の Command Palette で `Shell Command: Install 'code' command in PATH` を実行

### 症状: Hook が発火しない

cycle-4 の MVP では Hook が発火しない場合の救済策として、**Command Palette からコマンドを直接実行** できます:

```
Cmd + Shift + P
> WaitLess: AI 待ち開始
> WaitLess: AI 完了で Kiro に戻る
```

これらのコマンドは Hook の有無にかかわらず、`enabled` 設定に応じて動作します。

### 症状: ブラウザは開くが Kiro ウィンドウが最前面に来ない

`extension.ts` のハードコード `APP_NAME_FOR_OSASCRIPT = 'Kiro'` がインストール済の Kiro と一致していない可能性があります。次のコマンドで実機のアプリ名を確認:

```bash
osascript -e 'tell application "System Events" to name of every process'
```

リストに 'Kiro' がない場合は別名 (例: `Kiro.app`) で起動している可能性があります。`vscode-extension/src/extension.ts` の定数を編集して再ビルド (`npm run compile`)、または Kiro 自体のアプリ名を `Kiro` にリネームしてください (cycle-4 では設定化されていません、Backlog 候補)。

### 症状: macOS で Apple Events 許可ダイアログが出ない / 拒否したら戻れない

macOS の **システム環境設定** → **プライバシーとセキュリティ** → **オートメーション** で:
- Kiro IDE が「System Events」を制御することを許可
- または、コマンドラインから一度 `osascript -e 'tell application "Kiro" to activate'` を実行して許可ダイアログを出す

許可後、再度 cycle-4 の動作を試行してください。

## Hook 仕様の参考

Kiro の Agent Hooks Schema (cycle-4 開始時点):

```json
{
  "name": "string (必須)",
  "version": "string (必須)",
  "description": "string (任意)",
  "when": {
    "type": "promptSubmit | agentStop | preToolUse | postToolUse | fileEdited | ..."
  },
  "then": {
    "type": "askAgent | runCommand",
    "command": "..."
  }
}
```

最新の仕様は Kiro 公式ドキュメントを参照してください。

## 関連ドキュメント

- WaitLess IDE 拡張機能 README: `vscode-extension/README.md`
- WaitLess Chrome 拡張 README: `extension/README.md`
- 要件 (FR-41, FR-46, FR-57): `aidlc-docs/inception/requirements/requirements.md`
