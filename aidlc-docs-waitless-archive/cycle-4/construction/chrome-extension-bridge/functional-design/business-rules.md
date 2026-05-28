# cycle-4 — Unit 2 (chrome-extension-bridge) — Business Rules

最終更新: 2026-05-27

Unit 2 のビジネスルール。BR 番号は cycle-1〜3 (BR-01〜37) と Unit 1 (BR-41〜58) と衝突しないよう **BR-61 から開始**。

---

## BR-61: IdeBridge は Service Worker 起動時に init() される

- **対象**: `service_worker.js`
- **ルール**: `service_worker.js` の冒頭で `IdeBridge.init()` を呼び、Service Worker 起動と同時に IPC 接続を試みる (Q4=A 確定)
- **対応 FR**: FR-58, FR-59
- **後方互換**: cycle-1〜3 のシナリオは `MessageRouter.init()` 等が同じく冒頭で呼ばれるパターンと同じ

## BR-62: ipc_enabled=false で IdeBridge 全体停止

- **対象**: `IdeBridge.init()` および `chrome.storage.onChanged` リスナー
- **ルール**:
  - `chrome.storage.local.ipc_enabled === false` の場合、`init()` は何もしない (no-op)
  - 既に接続中の場合に false に切り替わったら、即座に `shutdown()` で切断
  - `true` に切り替わったら `init()` で再接続を開始
- **対応 FR**: FR-61
- **デフォルト値**: Q2=A → `ipc_enabled` キーが未設定の場合は `true` 扱い

## BR-63: 指数バックオフによる再接続

- **対象**: `IdeBridge` の再接続ロジック
- **ルール**:
  - 接続失敗時 (`onerror` または `onclose` 直後の再試行)、`reconnectAttempt` をインクリメント
  - 次回再試行までの待機時間は `Math.min(2 ** attempt, 30) * 1000` ms (1, 2, 4, 8, 16, 30, 30, ...)
  - 接続成功時に `reconnectAttempt = 0` にリセット
  - 永続的に再試行を続ける (ipc_enabled=false に切り替わるまで)
- **対応 FR**: FR-51, Q1=A

## BR-64: PING/PONG タイムアウトでの強制再接続

- **対象**: `IdeBridge._pingLoop()`
- **ルール**:
  - 30 秒ごとに PING を送る
  - 60 秒以上 PONG を受信していない場合、接続死亡と判定して `_disconnect()` + `_scheduleReconnect()`
- **対応 FR**: FR-51, R-04 (Service Worker idle unload)

## BR-65: FIND_OR_OPEN_TAB 受信時に PlaybackTrigger も注入

- **対象**: `IdeBridge._handleMessage('FIND_OR_OPEN_TAB')`
- **ルール**: `TabManager.findOrOpenPlaySite()` で結果が得られた直後に、cycle-1 と同じく `TabManager.injectPlaybackTrigger(tabId)` を呼ぶ。動画があれば自動再生
- **対応 FR**: FR-44, FR-45

## BR-66: TAB_OPENED の pass 番号変換

- **対象**: `IdeBridge._handleMessage('FIND_OR_OPEN_TAB')` 内の応答生成
- **ルール**: cycle-1 の `TabManager.findOrOpenPlaySite()` は `opened: 'existing' | 'navigated' | 'new'` を返す。cycle-4 IPC では `pass: 1 | 2 | 3` に変換する:
  - `existing` → `1` (URL 完全一致)
  - `navigated` → `2` (ドメイン一致 + navigate)
  - `new` → `3` (新規タブ)
- **対応 FR**: FR-52

## BR-67: lastPlayTabId の管理

- **対象**: `IdeBridge` の内部状態
- **ルール**:
  - `FIND_OR_OPEN_TAB` 受信で得られた `tabId` を `_state.lastPlayTabId` に記録
  - `PAUSE_MEDIA` 受信時にこれを使って `TabManager.injectPlaybackPause(lastPlayTabId)` を呼ぶ
  - `lastPlayTabId === null` の状態で `PAUSE_MEDIA` を受信したら no-op
- **対応 FR**: FR-47
- **前回 BR**: BR-53 (Application Design でこの責務を Unit 2 に置くことを確定済)

## BR-68: SettingsRepository / TabManager は完全無変更

- **対象**: cycle-1〜3 で確立した既存ファイル群
- **ルール**: `IdeBridge` は既存ファイルの **export 関数** のみを呼ぶ。既存ファイル (`settings_repository.js`, `tab_manager.js`, `wait_orchestrator.js`, `message_router.js`, `runtime_state.js`, `content/*`, `reader/*`) は **完全無変更**
- **対応 FR**: FR-60, NFR-27 (最重要)

## BR-69: WebSocket 切断時のクリーンアップ

- **対象**: `IdeBridge` の `onclose` ハンドラ
- **ルール**:
  - PING ループを停止 (`clearInterval(pingInterval)`)
  - `_state.ws = null` にリセット
  - `_state.lastPongAt = 0` にリセット
  - `_state.lastPlayTabId` は **保持** (再接続後に PAUSE_MEDIA を受け取れるため)
  - `_scheduleReconnect()` で次回再接続をキック (`ipc_enabled=true` の場合のみ)
- **対応 FR**: FR-51

## BR-70: メッセージ送信の防御

- **対象**: `IdeBridge` から WebSocket への送信箇所
- **ルール**: 送信前に `_state.ws !== null && _state.ws.readyState === WebSocket.OPEN` を確認。条件を満たさなければ送信スキップ + ログ出力 (例外を投げない)
- **対応 NFR**: NFR-28 (フォールバック許容)

---

## ルール優先順位

1. **BR-62** (ipc_enabled=false) — 最優先、機能全体を OFF
2. **BR-68** (既存ファイル無変更) — cycle-4 全体の制約条件、絶対遵守
3. **BR-61** (Service Worker 起動時 init)
4. **BR-63, BR-64, BR-69** (接続管理)
5. **BR-65, BR-66, BR-67** (メッセージ処理)
6. **BR-70** (送信防御)

---

## 関連ドキュメント

- ビジネスロジック: `business-logic-model.md`
- NFR inline: `nfr-inline.md`
- 既存 sw/* のコード: `extension/sw/*.js`
- Unit 1 IPC プロトコル: `aidlc-docs/construction/vscode-extension/functional-design/domain-entities.md` §3
