# cycle-4 — Unit 2 (chrome-extension-bridge) — Code Generation Plan

最終更新: 2026-05-27

## 1. 概要

Unit 2 のコード生成計画。既存 cycle-3 v0.3.0 の Chrome 拡張に最小限のコードを追加して、cycle-4 IDE 連携機能を実現する。

## 2. 関連 Story / FR / BR

- **暗黙ストーリー**: US-401, US-402 (Chrome sites を VS Code 拡張に提供)
- **主担当 FR**: FR-44, FR-45, FR-47, FR-51, FR-58〜61
- **BR**: BR-61〜70

## 3. 影響ファイル

### 3.1 新規作成 (1 件)

| パス | 内容 |
|---|---|
| `extension/sw/ide_bridge.js` | IdeBridge モジュール (~250 行) |

### 3.2 改修 (5 件)

| パス | 変更 |
|---|---|
| `extension/service_worker.js` | 2 行追加 (`import` + `init()` 呼び出し) |
| `extension/manifest.json` | `version: "0.3.0"` → `"0.4.0"`、`description` 更新 |
| `extension/options/options.html` | IPC トグルセクション追加 |
| `extension/options/options.css` | トグルスタイル追加 |
| `extension/options/options.js` | `initIpcToggle()` 関数追加 + `init()` で呼び出し |
| `extension/README.md` | cycle-4 機能説明追記 |

### 3.3 ドキュメント (1 件)

| パス | 内容 |
|---|---|
| `aidlc-docs/construction/chrome-extension-bridge/code/code-generation-summary.md` | 生成サマリ |

## 4. 実装ステップ

### Step 1: ide_bridge.js の新規作成
- [x] `extension/sw/ide_bridge.js` を新規作成 (state, init, shutdown, _connect, _handleMessage, ping loop, reconnect 戦略)
- [x] BR-61〜70 すべての実装

### Step 2: service_worker.js への 2 行追加
- [x] `import * as IdeBridge from './sw/ide_bridge.js';` 追加
- [x] `IdeBridge.init().catch((e) => ...)` 追加

### Step 3: manifest.json 更新
- [x] `version` を `0.3.0` → `0.4.0` に変更
- [x] `description` に cycle-4 機能を追記

### Step 4: Options Page 改修
- [x] `options.html` に IPC トグルセクションを追加 (既存の最後に追加)
- [x] `options.css` にトグル / セクションのスタイルを追加
- [x] `options.js` に `initIpcToggle()` 関数を追加 + `init()` 内で呼び出し

### Step 5: README.md 更新
- [x] `extension/README.md` に cycle-4 (IDE 連携) のセクションを追記

### Step 6: Code Generation Summary 作成
- [x] `aidlc-docs/construction/chrome-extension-bridge/code/code-generation-summary.md` の作成

### Step 7: 動作検証 (静的)
- [x] 既存 cycle-3 ファイルの完全無変更を確認 (NFR-27 厳守) — git status で実証済
- [x] `chrome://extensions` で Unpacked リロード時にエラーが出ないかは Build & Test ステージで実機検証
