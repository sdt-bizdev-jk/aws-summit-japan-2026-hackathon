# cycle-6 Code Generation Summary — stats-core

最終更新: 2026-05-29

統計記録の中核 (stats-core ユニット) の生成結果。

---

## 新規ファイル

### `extension/sw/leisure_classifier.js` (≈ 200 行)
- 12 ジャンル定義 (GENRE_DEFS) + "other"
- `classify(url)`: 段階マッチ (URL完全一致 → ホスト名一致 → ドメイン一致 → other、BR-87)
- `extractRegistrableDomain`: co.jp 等の 2 段 TLD を考慮した簡易 eTLD+1 抽出
- chrome-extension の reader を "reading" に固定 (BR-88)、不正 URL は other (BR-89)
- `getGenreDefs()`: ダッシュボードのラベル表示用

### `extension/sw/stats_repository.js` (≈ 200 行)
- `chrome.storage.local.stats_events` のみ操作 (BR-98)
- `appendEvent` / `recordCycle` (ide 用) / `resolveResume` (M-05/M-07) / `markReLeft` (M-04) / `getAllEvents`
- `pruneIfNeeded`: MAX_EVENTS=5000 のリングバッファ (BR-96)
- `toDateKey`: ローカル日付キー (BR-99, A6=A)
- 全操作 best-effort、防御的読み込み (BR-97, NFR-75)

---

## 改修ファイル

### `extension/sw/runtime_state.js`
- `statsPending` フィールド + get/setStatsPending (進行中サイクル 1 件、BR-81, F1=B)
- `statsResumeTargetId` フィールド + get/set (復帰/再離脱の解決対象 id)
- reset() に両フィールドのクリアを追加

### `extension/sw/wait_orchestrator.js`
- import 追加: StatsRepository, LeisureClassifier
- `onWaitDetected`: 冒頭で statsPending 生成 (beginCycle 相当)、切替成功後に `attachLeisureStats` (種別判定、BR-84)
- `onCompletionDetected`: 冒頭 (isWaiting ガード前) で `finalizeStatsCycle` 呼び出し (切替なしも記録、F6=A/BR-83)
- `finalizeStatsCycle`: pending → StatsEvent 確定 + append + resumeTargetId 設定
- 公開関数追加: `onResumeAction` (M-05) / `onResumeTimeout` (M-07) / `onReLeft` (M-04)
- 全追加処理は try/catch で best-effort、既存コアロジックは無変更

### `extension/sw/message_router.js`
- `RESUME_ACTION` ケース追加 (outcome=timeout なら onResumeTimeout、それ以外 onResumeAction)
- `RE_LEFT` ケース追加 (onReLeft)

### `extension/content/claude_site_adapter.js`
- 定数: RESUME_TIMEOUT_MS=120000 (F2=B)、STAY_WINDOW_MS=30000 (F3=A)
- `armResumeWatch`/`disarmResumeWatch`: 完了後の最初の操作 (scroll/mousemove/keydown/click) で RESUME_ACTION、120s 無操作で outcome=timeout (BR-93/94)
- `armReLeftWatch`/`disarmReLeftWatch`: 完了後 30s 内の hidden で RE_LEFT。ただし STREAMING/WAITING 遷移済み (新サイクル) の hidden は除外 (BR-91)
- 完了検知ブロックで両監視を arm、新サイクル STREAMING 遷移時に disarm
- markInvalidated で両監視を後始末

---

## 検証
- `node --check` / `node --input-type=module --check`: 全ファイル構文 OK

## トレーサビリティ
- FR-71,72,73,74,75,76,78
- BR-81〜98 (BR-87〜89 分類、BR-90〜95 復帰/再離脱、BR-96〜98 保存)
- M-01〜07 のデータ源を記録

## NFR-71 後方互換
- tab_manager.js / settings_repository.js / reader/* / playback_*.js は無変更
- 既存関数のシグネチャは変更なし (追記のみ)
