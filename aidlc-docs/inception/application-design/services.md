# cycle-6 Application Design — Services

最終更新: 2026-05-29

cycle-6 はマイクロサービス的なサービス層は持たない (端末ローカル拡張機能)。
ここでは「オーケストレーションの責務」を担う論理サービスを記述する。

---

## S1. 統計記録オーケストレーション (Stats Recording Flow)

**担い手**: WaitOrchestrator (改) + StatsRepository + LeisureClassifier

**フロー (chrome source)**:
```
[待ち発生] WAIT_DETECTED
   -> WaitOrchestrator.onWaitDetected
        -> StatsRepository.beginCycle({source:'chrome', waitStartAt, dateKey})  // 進行中レコード生成
        -> (既存) TabManager.findOrOpenPlaySite
        -> 切替成功時:
             genreId = LeisureClassifier.classify(切替先URL)       // A5=A 切替時に判定
             StatsRepository.attachLeisure(id, {leisureStartAt, leisureDomain, genreId})
        -> RuntimeState.setStatsCycleId(id)

[完了検知] COMPLETION_DETECTED
   -> WaitOrchestrator.onCompletionDetected
        -> (既存) 娯楽タブ一時停止 + AI タブ復帰
        -> StatsRepository.finalizeCycle(id, {waitEndAt, leisureEndAt})

[復帰後] Claude.ai content script
   -> 最初の操作検知 -> RESUME_ACTION -> StatsRepository.recordResumeAction(id, t)   // M-05
   -> stayWindow 内 hidden -> RE_LEFT -> StatsRepository.recordReLeft(id, true)       // M-04
   -> stayWindow 経過し hidden せず -> (暗黙的に reLeftWithinStay=false 確定)
```

**不変条件**: 統計記録は best-effort。失敗してもコア体験 (切替/戻り) は継続 (NFR-74)。

---

## S2. IDE 統計連携オーケストレーション (IDE Stats Bridge Flow)

**担い手**: VS Code Extension (改) + IpcClient/IdeBridge + StatsRepository

**フロー (ide source)**:
```
[Kiro promptSubmit Hook] -> VS Code Extension: 待ち開始記録 (waitStartAt, 外部ブラウザ起動URL=leisure)
[Kiro agentStop Hook]    -> VS Code Extension: 待ち終了 -> StatsRecord 組み立て
   -> IpcClient.send({type:'STATS_RECORD', payload:{source:'ide', waitStartAt, waitEndAt,
                       leisureStartAt, leisureEndAt, leisureDomain}})
   -> [WebSocket ws://127.0.0.1:39472]
   -> Chrome 側 IdeBridge 受信
        -> leisureGenreId = LeisureClassifier.classify(leisureDomain/url)  // Chrome 側で分類
        -> StatsRepository.recordCycle({...payload, leisureGenreId, dateKey})
```

**不変条件**: IPC 切断時は送信スキップ (NFR-77、Chrome 側は chrome 分のみで動作)。集中復帰秒数は ide では記録しない (C4=B)。

---

## S3. ダッシュボード集計オーケストレーション (Dashboard Aggregation Flow)

**担い手**: DashboardPage + StatsAggregator (+ chrome.storage.local 直接読み、A3=B)

**フロー**:
```
[ダッシュボードを開く]
   -> DashboardPage.init
        -> readEvents() = chrome.storage.local.get('stats_events')   // A3=B 直接読み
        -> summary = StatsAggregator.aggregate(events, Date.now())
        -> events 空 -> renderEmptyState (FR-85)
        -> それ以外 -> renderSummaryCards / renderGenreBreakdown / renderWeeklyTrend
```

**不変条件**: 集計は純粋関数 (副作用なし)。表示のみ、書き込みなし (リセット機能なし、Q10=B)。

---

## オーケストレーションの境界

- **記録系 (S1/S2)** は Service Worker 側 (StatsRepository に集約)
- **表示系 (S3)** は Page 側 (storage 直接読み + 純粋集計)
- 両者は `chrome.storage.local.stats_events` を介して疎結合 (書き手=SW、読み手=Page)
