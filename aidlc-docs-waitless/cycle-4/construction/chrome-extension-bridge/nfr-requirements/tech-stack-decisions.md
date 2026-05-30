# cycle-4 — Unit 2 (chrome-extension-bridge) — Tech Stack Decisions

最終更新: 2026-05-27

Unit 2 の技術スタック確定値。

---

## 1. 言語 / ランタイム

| 項目 | 確定値 | 選定根拠 |
|---|---|---|
| **言語** | JavaScript (ES Modules) | cycle-1〜3 と同じ、無ビルド構成踏襲 (NFR-22) |
| **ランタイム** | Chrome Service Worker (Manifest V3) | 既存 Chrome 拡張の前提、cycle-1〜3 と同じ |
| **Manifest 版** | V3 | 既存 cycle-3 と同じ |
| **JS 文法** | ES2020+ (Chrome 117+ サポート) | `const` / `await` / optional chaining / nullish coalescing 等使用可 |

---

## 2. ビルド

- **ビルドなし** (cycle-1〜3 と同じ)
- 開発時は `chrome://extensions` で Unpacked ロード

---

## 3. 依存ライブラリ

- **依存ゼロ** (cycle-1〜3 と同じ、Browser 標準 API のみ使用)
- WebSocket は **Browser 標準の WebSocket API** を使用 (Node.js の `ws` ライブラリは使わない)

---

## 4. 使用する Chrome / Browser API

| API | 用途 |
|---|---|
| `chrome.storage.local` | `ipc_enabled` キーの read/write、既存 sites の参照 |
| `chrome.storage.onChanged` | トグル変更の購読 |
| `chrome.tabs.*` | (既存 TabManager 経由でのみ) |
| `chrome.scripting.executeScript` | (既存 TabManager 経由でのみ) |
| `WebSocket` (Browser 標準) | IDE 拡張への接続 |
| `setTimeout` / `setInterval` / `clearTimeout` / `clearInterval` | 再接続 / PING ループ |

---

## 5. 影響ファイル詳細

### 5.1 新規追加

| ファイル | 行数推定 | 内容 |
|---|---|---|
| `extension/sw/ide_bridge.js` | ~250 | IdeBridge モジュール、IPC 接続 + メッセージディスパッチ + 再接続 |

### 5.2 改修

| ファイル | 変更 |
|---|---|
| `extension/service_worker.js` | 2 行追加 (`import` + `init()` 呼び出し) |
| `extension/manifest.json` | `version: "0.3.0"` → `"0.4.0"`、`description` の更新 |
| `extension/options/options.html` | IPC トグルセクションを追加 (既存セクションに影響なし) |
| `extension/options/options.css` | トグルスタイル追加 (既存スタイルに影響なし) |
| `extension/options/options.js` | `initIpcToggle()` 関数追加 + `init()` 内で呼び出し |
| `extension/README.md` | cycle-4 の機能説明を追記 |

### 5.3 完全無変更 (NFR-27 厳守)

- `extension/sw/message_router.js`
- `extension/sw/wait_orchestrator.js`
- `extension/sw/tab_manager.js`
- `extension/sw/settings_repository.js`
- `extension/sw/runtime_state.js`
- `extension/content/claude_site_adapter.js`
- `extension/content/playback_trigger.js`
- `extension/content/playback_pause.js`
- `extension/reader/reader.html`
- `extension/reader/reader.css`
- `extension/reader/reader.js`
- `extension/reader/novel.txt`

---

## 6. manifest.json への追加 host_permissions の検討

cycle-3 v0.3.0 の `manifest.json` の `host_permissions` は既に `<all_urls>` を含んでいるため、WebSocket クライアント (`ws://127.0.0.1:39472` への接続) のために **追加の host_permissions は不要**。

ただし、CSP (Content Security Policy) で WebSocket 接続が制限される可能性は事前に確認する。Manifest V3 の Service Worker からの WebSocket 接続は通常 CSP の影響を受けない (Browser 標準 API 経由のため)。

---

## 7. 関連ドキュメント

- NFR Requirements: `nfr-requirements.md`
- Functional Design: `../functional-design/business-logic-model.md`
