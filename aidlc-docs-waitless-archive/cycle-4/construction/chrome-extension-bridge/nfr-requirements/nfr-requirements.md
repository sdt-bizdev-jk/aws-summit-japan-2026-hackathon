# cycle-4 — Unit 2 (chrome-extension-bridge) — NFR Requirements

最終更新: 2026-05-27

Unit 2 の NFR を構造化して列挙する。

---

## 1. 後方互換性 (NFR-27、最重要)

### NFR-27-1: 既存ファイルへの変更最小化
- **要求**: cycle-1〜3 で確立した以下のファイルは **完全無変更**:
  - `extension/sw/message_router.js`
  - `extension/sw/wait_orchestrator.js`
  - `extension/sw/tab_manager.js`
  - `extension/sw/settings_repository.js`
  - `extension/sw/runtime_state.js`
  - `extension/content/*` 3 ファイル
  - `extension/reader/*` 4 ファイル
- **追加 / 改修可**:
  - `extension/sw/ide_bridge.js` (新規追加)
  - `extension/service_worker.js` (2 行追加のみ)
  - `extension/manifest.json` (version バンプのみ、`0.3.0` → `0.4.0`)
  - `extension/options/{html,css,js}` (IPC トグルセクション追加のみ、既存セクションへの影響なし)

### NFR-27-2: 動作の後方互換性
- **要求**: cycle-1〜3 のシナリオ T-01〜T-30 は cycle-4 後も同じ挙動を示す
- **検証**: Build & Test ステージで T-01〜T-30 を再実行して確認

### NFR-27-3: ストレージスキーマの後方互換性
- **要求**: `chrome.storage.local` の既存キー (`sites`, `threshold_sec`, `reader_state`) は無変更
- **追加可**: `ipc_enabled` キー (cycle-4 新規、デフォルト未設定 = `true` 扱い)

---

## 2. パフォーマンス

### NFR-21-P-1: メッセージ処理の応答性
- **要求**: GET_SITES / FIND_OR_OPEN_TAB / PAUSE_MEDIA への応答は受信から **2 秒以内** を目標 (Service Worker spin up 含む)
- **対応**: 既存 SettingsRepository / TabManager の処理は cycle-1〜3 で十分高速、IdeBridge は薄いラッパー

### NFR-21-P-2: PING/PONG オーバーヘッド
- **要求**: 30 秒ごとの PING で過度なリソース消費なし。実測 < 1KB / 30s

---

## 3. 信頼性 / Availability

### NFR-21-R-1: 接続失敗の許容
- **要求**: VS Code 拡張未起動 / port 39472 で listen していない場合でも、Chrome 拡張は機能停止しない
- **対応 BR**: BR-63 (指数バックオフで永続再試行)、BR-68 (既存機能無変更で並走)

### NFR-21-R-2: Service Worker idle unload からの復旧
- **要求**: Manifest V3 の Service Worker idle unload で接続が切れても、次の spin up で自動再接続
- **対応 BR**: BR-61 (init() を service_worker.js 冒頭で呼ぶ)

---

## 4. セキュリティ

### NFR-21-S-1: WebSocket は localhost-only
- **要求**: 接続先 URL `ws://127.0.0.1:39472` ハードコード
- **対応 NFR**: NFR-24

### NFR-21-S-2: メッセージサイズ制限
- **要求**: cycle-4 のスコープでは制限なし。将来的には DoS 対策として 1MB 程度の上限が望ましい (Backlog)
- **理由**: localhost-only かつ単一接続のため攻撃面が小さい

---

## 5. 保守性

### NFR-21-M-1: cycle-1〜3 と同じスタイル
- **要求**: ES Modules、`const DEBUG = true;` のログフラグ、関数 export スタイルを踏襲
- **対応**: cycle-1〜3 archive のコードスタイル参照

### NFR-21-M-2: コメント
- **要求**: モジュール先頭に責務 / 関連 FR/BR を明記。cycle-1〜3 と同じパターン

---

## 6. NFR ID 整合表

| NFR ID | 出典 | 本ドキュメントの対応 |
|---|---|---|
| NFR-21 | 要件 §4 (JavaScript) | NFR-21-M-1 |
| NFR-22 | 要件 §4 (Unpacked ロード) | (Unit 2 全体で踏襲) |
| NFR-23 | 要件 §4 (テストなし) | (テストは未実装) |
| NFR-24 | 要件 §4 (WebSocket localhost) | NFR-21-S-1 |
| NFR-25 | 要件 §4 (macOS 限定) | (Unit 2 では関係なし、Chrome は cross-platform) |
| NFR-26 | 要件 §4 (日本語) | Options Page の文言 |
| **NFR-27** | 要件 §4 (後方互換性) | **NFR-27-1, NFR-27-2, NFR-27-3 (最重要)** |
| NFR-28 | 要件 §4 (フォールバック) | NFR-21-R-1 |
| NFR-29 | 要件 §4 (シェルインジェクション) | (Unit 2 では `child_process` 不使用、関係なし) |

---

## 7. 関連ドキュメント

- Functional Design NFR Inline: `../functional-design/nfr-inline.md`
- Tech Stack Decisions: `tech-stack-decisions.md`
- 要件: `aidlc-docs/inception/requirements/requirements.md` §4
