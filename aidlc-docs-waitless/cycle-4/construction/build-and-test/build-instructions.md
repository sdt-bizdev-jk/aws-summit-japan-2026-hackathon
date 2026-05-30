# cycle-4 — Build Instructions

最終更新: 2026-05-27

cycle-4 で生成された各 unit のビルド / セットアップ手順。

---

## 前提条件

- **OS**: macOS
- **Node.js**: 20.x 以上 (Unit 1 ビルド時)
- **npm**: 10.x 以上 (Node.js に同梱)
- **Kiro IDE** または **VS Code 1.90+** (Unit 1 動作確認時)
- **Google Chrome** (Manifest V3 対応版、最新の安定版)
- **WaitLess Chrome 拡張**: cycle-3 (v0.3.0) からのアップグレードまたは新規 Unpacked ロード

---

## Unit 1: vscode-extension のビルド

### 1. 依存ライブラリのインストール

```bash
cd vscode-extension
npm install
```

期待出力:
```
added 6 packages, and audited 7 packages in [time]

1 moderate severity vulnerability
[...]
```

> Note: `audit` 警告は cycle-4 では受容 (NFR-23 / `ws@8.18.0` の依存範囲、Build & Test 段階で Backlog 化)。

### 2. TypeScript コンパイル

```bash
cd vscode-extension
npm run compile
```

期待出力: エラー / 警告なしで完了。`out/extension.js` (約 22KB) と `out/extension.js.map` が生成される。

```bash
ls -la out/
# -rw-r--r--  1 user staff  22876 [date] extension.js
# -rw-r--r--  1 user staff  14376 [date] extension.js.map
```

### 3. 開発モードでの起動

```bash
# Kiro / VS Code を「拡張機能開発モード」で起動
code --extensionDevelopmentPath="$(pwd)"
```

または、Kiro / VS Code 内で `F5` または「Run Extension」コマンドで起動。

成功すると Extension Development Host (新しいウィンドウ) が起動し、Command Palette で `WaitLess: AI 待ち開始` / `WaitLess: AI 完了で Kiro に戻る` が表示される。

### 4. (オプション) VSIX パッケージング

cycle-4 のスコープでは推奨しないが、配布時は:

```bash
npm install -g @vscode/vsce
cd vscode-extension
vsce package
# → waitless-ide-0.1.0.vsix が生成される
code --install-extension waitless-ide-0.1.0.vsix
```

---

## Unit 2: chrome-extension-bridge のセットアップ

cycle-1〜3 と同じく **Unpacked ロード** で動作する。ビルド不要。

### 1. 既存の Unpacked ロードを更新する場合 (cycle-3 → cycle-4)

1. Chrome で `chrome://extensions/` を開く
2. WaitLess の拡張機能カードで **更新ボタン (🔄)** をクリック
3. version が `0.4.0` になっていることを確認

### 2. 新規 Unpacked ロード

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このリポジトリの `extension/` ディレクトリを選択
5. WaitLess (v0.4.0) が読み込まれることを確認

### 3. Service Worker のログ確認

1. `chrome://extensions/` で WaitLess の「Service Worker (バックグラウンド)」リンクをクリック
2. DevTools Console が開く
3. 起動時に以下のログが出ることを確認:
   ```
   [WaitLess][IdeBridge] init: ipc_enabled=true, will connect
   [WaitLess][IdeBridge] connected to ws://127.0.0.1:39472   (Unit 1 起動時のみ)
   ```

---

## Unit 3: agent-hooks-templates のセットアップ

ビルド不要。ユーザーが手動で `.kiro/hooks/` にコピーする。

### 1. ワークスペース毎にコピー (推奨)

```bash
# 例: Variant A をプロジェクトの .kiro/hooks/ にコピー
mkdir -p /path/to/your/project/.kiro/hooks
cp /path/to/this/repo/vscode-extension/templates/hooks/01-on-prompt-submit.variant-a.json \
   /path/to/your/project/.kiro/hooks/01-on-prompt-submit.json
cp /path/to/this/repo/vscode-extension/templates/hooks/02-on-agent-stop.variant-a.json \
   /path/to/your/project/.kiro/hooks/02-on-agent-stop.json
```

### 2. ユーザーグローバル

```bash
mkdir -p ~/.kiro/hooks
cp /path/to/this/repo/vscode-extension/templates/hooks/01-on-prompt-submit.variant-a.json \
   ~/.kiro/hooks/01-on-prompt-submit.json
cp /path/to/this/repo/vscode-extension/templates/hooks/02-on-agent-stop.variant-a.json \
   ~/.kiro/hooks/02-on-agent-stop.json
```

### 3. Variant B (CLI 経由) を選んだ場合

A の代わりに `*.variant-b.json` をコピーする。ファイル名から `.variant-b` を削除してコピー先で `01-on-prompt-submit.json` 等にする。

### 4. Kiro IDE のリロード

Hook の変更を反映するため、Kiro を再起動。

詳細手順とトラブルシューティングは `vscode-extension/templates/hooks/README.md` を参照。

---

## ビルド成功の判定基準

すべての unit について以下を確認:

- ✅ Unit 1: `vscode-extension/out/extension.js` が存在し、`getDiagnostics` でエラーなし
- ✅ Unit 2: Chrome 拡張が Unpacked ロード時にエラーを出さず、Service Worker が起動する
- ✅ Unit 3: 4 つの JSON ファイルが parse 可能 (構文エラーなし)、README が存在

---

## トラブルシューティング

### Unit 1 ビルドで `tsc` が型エラーを出す
- **原因**: `@types/vscode` / `@types/node` / `@types/ws` のバージョン不一致
- **解決**: `package.json` の exact version pin を確認、`node_modules/` を削除して `npm install` をやり直す

### Unit 2 で Service Worker がエラー
- **原因**: `extension/sw/ide_bridge.js` の構文エラー、または `service_worker.js` の import ミス
- **解決**: `chrome://extensions/` の「エラー」リンクで詳細を確認、`extension/sw/ide_bridge.js` の構文を再チェック

### Unit 3 の Hook が認識されない
- **原因**: Hook ファイルの配置先が違う、または Kiro のリロードが必要
- **解決**: `.kiro/hooks/` (ワークスペース) または `~/.kiro/hooks/` (グローバル) を確認、Kiro を完全に再起動

---

## 関連ドキュメント

- 統合 Build & Test サマリ: `build-and-test-summary.md`
- 手動 E2E 手順 (Integration Test): `integration-test-instructions.md`
- Unit ごとの README:
  - Unit 1: `vscode-extension/README.md`
  - Unit 2: `extension/README.md` (cycle-4 セクション)
  - Unit 3: `vscode-extension/templates/hooks/README.md`
