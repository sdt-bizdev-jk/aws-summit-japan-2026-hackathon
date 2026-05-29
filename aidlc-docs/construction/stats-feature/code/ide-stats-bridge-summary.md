# cycle-6 Code Generation Summary — ide-stats-bridge

最終更新: 2026-05-29

VS Code (Kiro) 側の IDE 待ちサイクル統計連携 (ide-stats-bridge ユニット) の生成結果。

---

## 改修ファイル

### `extension/sw/ide_bridge.js` (Chrome 側)
- import 追加: StatsRepository, LeisureClassifier
- `_handleMessage` に `STATS_RECORD` ケース追加 (S2, A4=A):
  - VS Code から受けた待ちサイクルを `StatsRepository.recordCycle` へ記録
  - 余暇種別は Chrome 側 `LeisureClassifier.classify(leisureUrl or leisureDomain)` で分類 (F4=A、分類ロジック集約)
  - 応答不要 (notify)、best-effort (try/catch)

### `vscode-extension/src/extension.ts` (VS Code 側)
- `IpcMessageType` に `STATS_RECORD` を追加
- `StatsRecordPayload` 型を追加 (id/source/waitStartAt/waitEndAt/leisureStartAt/leisureEndAt/leisureUrl/leisureDomain)
- `extractDomainFromUrl` ヘルパー追加
- `WaitOrchestratorIde`:
  - 統計用フィールド (statsWaitStartAt/statsLeisureStartAt/statsLeisureUrl) を追加
  - `startWaiting`: 待ち開始時刻を記録。初回は選択 URL を娯楽対象として記録。2回目以降は娯楽開始時刻のみ更新 (前回 URL 引き継ぎ)
  - `endWaiting`: wasWaiting なら `STATS_RECORD` を IPC notify で送信 (集中復帰秒数は送らない C4=B)。送信後フィールドをリセット
  - best-effort (try/catch)

---

## 検証
- `node --input-type=module --check`: ide_bridge.js OK
- `npm run compile` (tsc strict): VS Code 拡張ビルド成功、out/extension.js 32KB に STATS_RECORD 含有 (grep 3 件)

## トレーサビリティ
- FR-77 (IDE 待ちサイクルを統計対象に、集中復帰秒数は除く)
- A4 (既存 IPC に STATS_RECORD 追加)、F4 (Chrome 側分類)、S2 (IDE 統計連携フロー)

## NFR-77 IDE 連携堅牢性
- IPC 切断時は notify が drop されるだけ (Chrome 側は chrome 分で動作継続)
- 送信失敗してもサイクル完了は阻害しない
