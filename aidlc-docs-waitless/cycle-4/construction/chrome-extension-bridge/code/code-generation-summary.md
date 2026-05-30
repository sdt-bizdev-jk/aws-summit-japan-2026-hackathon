# cycle-4 — Unit 2 (chrome-extension-bridge) — Code Generation Summary

最終更新: 2026-05-27

Unit 2 の Code Generation で生成 / 改修されたファイルとその内容のサマリ。

---

## 1. ファイル変更一覧 (git status と整合)

### 1.1 新規追加 (Untracked)

| パス | 行数 | 内容 |
|---|---|---|
| `extension/sw/ide_bridge.js` | ~280 | IdeBridge モジュール本体 (BR-61〜70 の実装) |

### 1.2 改修 (Modified)

| パス | 変更内容 |
|---|---|
| `extension/service_worker.js` | 2 行追加: `import * as IdeBridge from './sw/ide_bridge.js';` + `IdeBridge.init().catch((e) => ...)` |
| `extension/manifest.json` | `version: "0.3.0"` → `"0.4.0"`、`description` を cycle-4 機能を含めて更新 |
| `extension/options/options.html` | 「🔌 IDE 連携 (cycle-4 実験的)」セクションを末尾に追加 (約 20 行) |
| `extension/options/options.css` | 末尾に IPC トグル用スタイル `.ipc-toggle-label` を追加 (約 20 行) |
| `extension/options/options.js` | `App.initIpcToggle()` メソッド追加 + `App.init()` 内で呼び出し |
| `extension/README.md` | 「IDE 連携 (cycle-4 〜、実験的)」セクションを追加 (約 30 行) |

### 1.3 完全無変更 (NFR-27 厳守、git status で確認済)

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
- `extension/assets/icons/icon{16,48,128}.png`

---

## 2. ide_bridge.js の構造

| Section | 内容 |
|---|---|
| 1. Imports / Constants / Logging | `SettingsRepository`, `TabManager` を import、IPC URL / interval / backoff の定数 |
| 2. 内部状態 (`_state`) | ws, isStarted, reconnectAttempt, pingInterval, lastPongAt, lastPlayTabId, enabled 等 |
| 3. Public API | `init()`, `shutdown()`, `isConnected()` の export |
| 4. 接続 / 切断 / 再接続 | `_connect()`, `_disconnect()`, `_scheduleReconnect()` (指数バックオフ、Q1=A) |
| 5. PING/PONG ヘルスチェック | `_startPingLoop()`, `_pingLoop()`, `_stopPingLoop()` (BR-64) |
| 6. メッセージ処理 | `_handleMessage()`, `_extractDomain()`, `_mapOpenedToPass()` (BR-65, BR-66, BR-67) |

---

## 3. BR (Business Rules) の実装箇所

| BR ID | 実装箇所 |
|---|---|
| BR-61 | `service_worker.js` 末尾の `IdeBridge.init()` 呼び出し |
| BR-62 | `init()` 内の `chrome.storage.local.get('ipc_enabled')` チェック + `chrome.storage.onChanged` リスナー |
| BR-63 | `_scheduleReconnect()` の `Math.min(2 ** attempt, MAX_BACKOFF_SEC)` |
| BR-64 | `_pingLoop()` の `lastPongAt > PONG_TIMEOUT_MS` 判定 |
| BR-65 | `FIND_OR_OPEN_TAB` 受信処理内で `TabManager.injectPlaybackTrigger(result.tabId)` を呼ぶ |
| BR-66 | `_mapOpenedToPass()` 関数 |
| BR-67 | `_handleMessage('FIND_OR_OPEN_TAB')` 内で `_state.lastPlayTabId = result.tabId` |
| BR-68 | (制約条件、git status で確認済) |
| BR-69 | `_disconnect()` の `_stopPingLoop()` + `_state.lastPlayTabId` 保持 |
| BR-70 | `_send()` 内の `readyState === WebSocket.OPEN` チェック |

すべての BR-61〜70 が実装に対応している。

---

## 4. 既存ファイルとの統合点

### 4.1 SettingsRepository (既存、無変更)

- `IdeBridge._handleMessage('GET_SITES')` → `SettingsRepository.getSites()` を呼ぶ
- 戻り値の `Site[]` (`{ domain, url, priority }[]`) を IPC `SITES_RESPONSE` の payload にそのまま流す

### 4.2 TabManager (既存、無変更、Q4=D 確認済で `injectPlaybackPause` は export されている)

- `IdeBridge._handleMessage('FIND_OR_OPEN_TAB')` → `TabManager.findOrOpenPlaySite([fakeSites])` を呼ぶ
- `IdeBridge._handleMessage('PAUSE_MEDIA')` → `TabManager.injectPlaybackPause(lastPlayTabId)` を呼ぶ
- `findOrOpenPlaySite` の後に `injectPlaybackTrigger(tabId)` を呼ぶ (cycle-1 と同じ動作、BR-65)

### 4.3 既存 cycle-1〜3 シナリオへの影響

- 既存の Claude.ai シナリオは独立して動作 (T-01〜T-30 への影響なし)
- IdeBridge は WaitOrchestrator / RuntimeState の内部状態に **触らない**
- 並行動作の競合は発生しない (TabManager の関数は副作用がない、または冪等な範囲)

---

## 5. NFR の対応

| NFR ID | 対応 |
|---|---|
| NFR-21 | JavaScript ES Modules で記述 (cycle-1〜3 と同じ) |
| NFR-22 | manifest.json で v0.4.0、ビルドなし |
| NFR-23 | 自動テストなし |
| NFR-24 | 接続先 `ws://127.0.0.1:39472` ハードコード |
| NFR-26 | Options Page セクション、ide_bridge.js のログ等は日本語/英語混在 |
| **NFR-27** | **既存 sw/* 5 ファイル中 4 + content/* + reader/* + options/* 既存部分 = 完全無変更 (git status で実証)** |
| NFR-28 | 接続失敗ログのみで Chrome 拡張全体は機能停止しない |

---

## 6. 静的検証結果 (Step 7)

- ✅ `getDiagnostics`: 全 5 改修ファイル + 新規 ide_bridge.js で No issues
- ✅ `git status --short extension/`: 期待通り Modified 6 + Untracked 1
- ✅ 既存 sw/* 5 ファイルのうち変更が必要だったのは `service_worker.js` のみ (2 行追加)
- ✅ NFR-27 完全遵守

実機検証 (`chrome://extensions` での Unpacked リロード、IPC 接続テスト等) は **Build & Test ステージ** で実施。

---

## 7. 関連ドキュメント

- ビジネスロジック: `../functional-design/business-logic-model.md`
- ビジネスルール: `../functional-design/business-rules.md`
- NFR Inline: `../functional-design/nfr-inline.md`
- NFR Requirements: `../nfr-requirements/nfr-requirements.md`
- Tech Stack: `../nfr-requirements/tech-stack-decisions.md`
- Code Generation Plan: `aidlc-docs/construction/plans/chrome-extension-bridge-code-generation-plan.md`
