# Performance Test Instructions — cycle-6 (stats-feature)

cycle-6 は端末ローカルの軽量機能のため、本格的な負荷試験は不要。以下の軽量確認のみ。

## Performance Considerations

### PT-61: 統計記録の体験非阻害 (NFR-74)
- **確認**: 待ち→切替→戻りのコア体験が、統計記録追加によって遅延・破綻しないこと
- **方法**: IT-61 を実施し、切替/戻りの体感速度が cycle-5 と変わらないことを目視確認
- **期待**: 記録は非同期 best-effort、体験に影響なし

### PT-62: レコード肥大時の集計速度 (NFR-75, BR-96)
- **確認**: stats_events が上限 (MAX_EVENTS=5000) 付近でもダッシュボード表示が実用的な速度
- **方法 (任意)**: DevTools コンソールで擬似的に大量レコードを投入し、ダッシュボードを開く
```js
// 例: 5000 件の擬似レコードを投入して表示速度を確認
const now = Date.now();
const evs = Array.from({length:5000}, (_,i) => ({
  id:`c${i}`, source:'chrome', waitStartAt:now-i*1000, waitEndAt:now-i*1000+5000,
  leisureStartAt:now-i*1000, leisureEndAt:now-i*1000+5000,
  leisureGenreId:'video', leisureDomain:'youtube.com',
  resumeActionAt:now-i*1000+6000, resumeOutcome:'resumed', reLeftWithinStay:false,
  dateKey: new Date(now-i*1000).toISOString().slice(0,10)
}));
chrome.storage.local.set({stats_events: evs});
```
- **期待**: 集計 (aggregate は O(n) の単純走査) + 描画が 1 秒以内程度。リングバッファで 5000 件上限が保たれる
- **注**: JSON で数百 KB 程度、chrome.storage.local の上限 (約 10MB) に対し十分小さい

## Status
- 本格的な性能試験は対象外 (アンチスコープ)。上記は健全性確認のみ。
