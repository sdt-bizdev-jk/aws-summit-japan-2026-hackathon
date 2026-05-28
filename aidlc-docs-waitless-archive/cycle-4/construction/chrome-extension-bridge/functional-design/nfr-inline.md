# cycle-4 — Unit 2 (chrome-extension-bridge) — NFR Inline

最終更新: 2026-05-27

Unit 2 で関係する NFR の実装上の対応方針。

---

## NFR-21 (言語スタック)

- JavaScript (ES Modules) — cycle-1〜3 と同じスタイル踏襲
- ビルドなし (`tsc` も使わない)
- `extension/sw/ide_bridge.js` 1 ファイル + `service_worker.js` への 2 行追加

---

## NFR-22 (配布形態)

- Chrome 拡張は cycle-1〜3 と同じく **Unpacked ロード** が前提
- cycle-4 では拡張機能の version を `0.3.0` → `0.4.0` にバンプ (`extension/manifest.json`)
- Web Store 公開は本サイクル外

---

## NFR-23 (テスト不要)

- cycle-1〜3 と同じ「無テスト」方針を踏襲
- 動作確認は手動 E2E のみ (Build & Test ステージで手順書整備)

---

## NFR-24 (WebSocket localhost-only)

- **クライアント側 (Chrome 拡張)**: 接続先 URL が `ws://127.0.0.1:39472` ハードコード。これにより Chrome 拡張から外部 (LAN/WAN) への WebSocket 通信は発生しない
- 認証なし (Unit 1 と整合、cycle-4 のスコープ外)

---

## NFR-26 (日本語固定)

- Options Page の IPC ON/OFF トグルセクションは日本語

---

## NFR-27 (後方互換性) — 最重要

- **既存 `extension/sw/*` 5 ファイル中 4 ファイル (`message_router.js`, `wait_orchestrator.js`, `tab_manager.js`, `settings_repository.js`, `runtime_state.js`) は完全無変更**
- `extension/service_worker.js` は **2 行のみ追加** (import + init)
- `extension/content/*` 3 ファイル、`extension/reader/*` 4 ファイルは **完全無変更**
- `extension/options/{html,css,js}` は **追加のみ** (既存セクションへの影響なし)
- `extension/manifest.json` は version バンプのみ
- これにより cycle-1〜3 のシナリオ (T-01〜T-30) は同じ動作

---

## NFR-28 (フォールバック / 機能停止禁止)

- IdeBridge の WebSocket 接続が失敗しても、**Chrome 拡張全体は機能停止しない** (Claude.ai シナリオは引き続き動く)
- 接続失敗ログは `console.warn` のみで、ユーザーに通知しない (silent)

---

## まとめ

| NFR | 実装の鍵 |
|---|---|
| NFR-21 | JavaScript ES Modules、ビルドなし |
| NFR-22 | manifest.json で version 0.4.0、Unpacked ロード |
| NFR-23 | テストなし |
| NFR-24 | `ws://127.0.0.1:39472` 固定 |
| NFR-26 | Options Page トグル日本語 |
| **NFR-27** | **既存 sw/* 4 ファイル + content/* + reader/* + options/_既存_部分は無変更** |
| NFR-28 | 接続失敗時は console.warn のみ、Chrome 拡張全体は continue |

---

## 関連ドキュメント

- ビジネスロジック: `business-logic-model.md`
- ビジネスルール: `business-rules.md`
