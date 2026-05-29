# Unit Test Execution — cycle-6 (stats-feature)

cycle-6 は自動テストフレームワーク未導入 (NFR-04 踏襲) のため、純粋関数の検証は Node のアドホックスクリプトで行う。

## Automated Unit Verifications (自動実行可能)

### UT-61: LeisureClassifier の分類正しさ (BR-87/88/89)
```bash
node aidlc-docs/construction/build-and-test/verify-classifier.mjs
```
- **期待**: `Classifier: 23 passed, 0 failed`
- **検証内容**: ホスト名一致 (youtube→video, music.youtube→music)、ドメイン一致 (amazon.co.jp→ec)、reader 内蔵→reading、未知/不正 URL→other、getGenreDefs が 13 件 (other 含む)

### UT-62: StatsAggregator の指標算出 (M-01〜07, BR-99/100)
```bash
node aidlc-docs/construction/build-and-test/verify-aggregator.cjs
```
- **期待**: `Aggregator: 24 passed, 0 failed`
- **検証内容**:
  - M-01 待ち時間合計、M-02 ダメになった時間 (切替なし F6 含む)
  - M-03 余暇種別内訳 (video/sns、降順、ratio 合計 1)
  - M-04 離脱継続率 (chrome 切替ありのみ母集団、ide/切替なし除外 = 0.5)
  - M-05 集中復帰平均 (resumed のみ = 3s)、M-07 未復帰回数 (timeout = 1)
  - 週次トレンド (7 日、今日/昨日)、空配列、formatDuration

### UT-63: 全 JS 構文チェック
```bash
# ESM
for f in extension/sw/leisure_classifier.js extension/sw/stats_repository.js \
         extension/sw/wait_orchestrator.js extension/sw/message_router.js \
         extension/sw/runtime_state.js extension/sw/ide_bridge.js; do
  node --input-type=module --check < "$f"
done
# IIFE
for f in extension/content/claude_site_adapter.js extension/dashboard/stats_aggregator.js \
         extension/dashboard/dashboard.js extension/portal/portal.js extension/options/options.js; do
  node --check "$f"
done
```
- **期待**: 全ファイルエラーなし

### UT-64: VS Code 拡張のビルド (tsc strict)
```bash
cd vscode-extension && npm run compile
```
- **期待**: 型エラー 0、`out/extension.js` 生成

## Review Test Results
- **Expected**: UT-61 (23 pass) + UT-62 (24 pass) + UT-63 (全 OK) + UT-64 (ビルド成功)
- すべて PASS であること
