# cycle-4 — Unit 2 (chrome-extension-bridge) — Functional Design Plan

最終更新: 2026-05-27

## 1. このステージで作成する成果物

- [x] `aidlc-docs/construction/chrome-extension-bridge/functional-design/business-logic-model.md` ✅
- [x] `aidlc-docs/construction/chrome-extension-bridge/functional-design/business-rules.md` ✅
- [x] `aidlc-docs/construction/chrome-extension-bridge/functional-design/nfr-inline.md` ✅

## 2. Application Design / Unit 1 からの引き継ぎ

- IPC プロトコル: Unit 1 で確定済 (FR-52、`vscode-extension/src/extension.ts` 内の型)
- 既存 `tab_manager.js` の `injectPlaybackPause(tabId)` は **export 済** (Q4=D 確定で実コード読了)
- 既存 `settings_repository.js` の `getSettings() / getSites()` は export 済
- 既存 `service_worker.js` への変更は **2 行追加のみ** (`import` + `init()` 呼び出し)

## 3. 確認事項

確認が必要な項目は **2 件**:

---

### Question 1: 再接続の指数バックオフ詳細

WebSocket 接続が失敗した時の再接続戦略は:

A) **指数バックオフ** (1s → 2s → 4s → 8s → 16s → 30s で頭打ち、30秒間隔で永続再試行) — FR-51 の「最大 30 秒間隔」と整合、推奨
B) **固定間隔** (毎回 5 秒で再試行) — シンプル
C) **再試行なし** (失敗したら諦める、Service Worker 再起動を待つ) — 最小実装
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 2: IPC ON/OFF トグル (FR-61) のデフォルト値

Options Page の IPC ON/OFF トグル (`chrome.storage.local.ipc_enabled`) のデフォルト値:

A) **`true` (ON)** — cycle-3 → cycle-4 移行で自動的に IPC 連動有効になる、UX 良好
B) **`false` (OFF)** — ユーザーが明示的に ON にする必要、安全策
C) **`undefined` (未設定)** — 初回起動時は通知で「IPC を有効にしますか?」を尋ねる (cycle-4 では複雑、推奨せず)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

回答が完了したら「done」「完了」等で合図してください。
