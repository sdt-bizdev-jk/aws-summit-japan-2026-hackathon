# Build Instructions — cycle-6 (stats-feature)

## Prerequisites
- **Chrome 拡張**: ビルド不要 (Vanilla JS / Manifest V3、NFR-72)。Chrome で「パッケージ化されていない拡張機能を読み込む」だけ
- **VS Code 拡張**: Node.js + npm、TypeScript (`tsc`)。`vscode-extension/node_modules` 導入済み (cycle-4)
- **System**: macOS (cycle-4 由来の IPC/osascript 連携を使う場合)

## Build Steps

### 1. Chrome 拡張 (ビルド不要)
```bash
# ビルド手順なし。拡張機能を読み込むだけ:
# 1. chrome://extensions/ を開く
# 2. デベロッパーモードを ON
# 3. 「パッケージ化されていない拡張機能を読み込む」で extension/ を選択
# 4. 既にロード済みなら「更新」ボタンを押す (cycle-6 で v0.6.0 に上がる)
```

### 2. VS Code (Kiro) 拡張のビルド
```bash
# vscode-extension/ で TypeScript をコンパイル
npm run compile
```

### 3. ビルド成功の確認
- **Chrome**: `chrome://extensions/` で WaitLess が v0.6.0、エラーなしでロードされること
- **VS Code**: `vscode-extension/out/extension.js` が生成され、`STATS_RECORD` を含むこと
- **構文チェック (任意)**:
```bash
# ESM モジュール
node --input-type=module --check < extension/sw/stats_repository.js
node --input-type=module --check < extension/sw/leisure_classifier.js
# IIFE スクリプト
node --check extension/dashboard/dashboard.js
node --check extension/dashboard/stats_aggregator.js
```

## Build Artifacts
- `extension/` 一式 (v0.6.0、新規 dashboard/ + sw/{stats_repository,leisure_classifier}.js)
- `vscode-extension/out/extension.js` (32KB、STATS_RECORD 対応)

## Troubleshooting

### Chrome 拡張がエラーになる
- **原因**: manifest.json の JSON 構文ミス、web_accessible_resources のパス誤り
- **解決**: `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"` で検証。dashboard/* 4 件のパスを確認

### VS Code 拡張のビルドが失敗
- **原因**: 型エラー (IpcMessageType に STATS_RECORD 未追加など)
- **解決**: `npm run compile` の出力を確認。`STATS_RECORD` が IpcMessageType ユニオンと StatsRecordPayload に定義されているか確認
