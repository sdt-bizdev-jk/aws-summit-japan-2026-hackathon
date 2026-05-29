# cycle-6 Functional Design — Business Logic Model (stats-feature)

最終更新: 2026-05-29

統計記録・分類・集計のロジックモデル。指標 M-01〜07 の算出を含む。

---

## 1. 指標一覧 (M-01〜M-07)

| ID | 指標 | 算出 | 母集団 |
|----|------|------|--------|
| M-01 | 待ち時間合計 | Σ(waitEndAt − waitStartAt) | 全サイクル (当日/全期間) |
| M-02 | 今日ダメになった時間 | Σ(leisureEndAt − leisureStartAt) | 当日の切替ありサイクル |
| M-03 | 余暇種別内訳 | ジャンル別 leisure 時間合算 + 比率 | 当日の切替ありサイクル |
| M-04 | 離脱継続率 | (reLeftWithinStay=false) / (自動復帰数) | 当日 chrome 切替ありサイクル |
| M-05 | 集中復帰平均秒数 | avg(resumeActionAt − waitEndAt) | 当日 chrome resumeOutcome='resumed' |
| M-06 | 待ちサイクル回数 | count(records) | 当日全サイクル |
| M-07 | 未復帰回数 | count(resumeOutcome='timeout') | 当日 chrome サイクル |

---

## 2. 記録フロー (chrome source) — ステートマシン

```
状態: IDLE → (WAIT_DETECTED) → WAITING_RECORDED → (切替成立) → LEISURE_ATTACHED
            → (COMPLETION_DETECTED) → FINALIZED → (復帰監視) → RESUME_RESOLVED

[WAIT_DETECTED] (WaitOrchestrator.onWaitDetected 冒頭、重複ガード後)
   pending = { id:`chrome-${now}`, source:'chrome', waitStartAt:now,
               leisureStartAt:null, leisureDomain:null, leisureGenreId:null,
               dateKey: toDateKey(now) }
   RuntimeState.setStatsPending(pending)            // BR-81, F1=B

[切替成立] (findOrOpenPlaySite が tabId 返却後、activateTab 後)
   genre = LeisureClassifier.classify(切替先URL)     // BR-84, A5=A
   pending.leisureStartAt = now
   pending.leisureDomain  = extractDomain(切替先URL)
   pending.leisureGenreId = genre.genreId
   RuntimeState.setStatsPending(pending)

[COMPLETION_DETECTED] (WaitOrchestrator.onCompletionDetected、AIタブ復帰処理と並行)
   p = RuntimeState.getStatsPending()
   if (p):
     event = { ...p, waitEndAt:now,
               leisureEndAt: p.leisureStartAt!=null ? now : null,
               resumeActionAt:null, resumeOutcome: (p.leisureStartAt!=null ? 'pending' : null),
               reLeftWithinStay: (p.leisureStartAt!=null ? false : null) }
     StatsRepository.appendEvent(event)             // BR-82, BR-96 prune
     RuntimeState.setStatsPending(null)
   // 復帰監視は Content Script 側で arm 済み (下記)

[復帰監視] (Claude.ai content script、COMPLETION 検知時に arm)
   最初の操作 (scroll/mousemove/keydown/click) → RESUME_ACTION{at} 送信
       → StatsRepository.resolveResume(id, { resumeActionAt:at, outcome:'resumed' })  // BR-93
   120s 操作なし → RESUME_ACTION は送らず、SW 側 watchdog or content の timeout で
       → StatsRepository.resolveResume(id, { resumeActionAt:null, outcome:'timeout' }) // BR-94 M-07

[再離脱監視] (Claude.ai content script、復帰後 stayWindow 30s)
   30s 内に hidden かつ「新サイクル起因でない」 → RE_LEFT 送信
       → StatsRepository.markReLeft(id, true)        // BR-90
   新サイクル起因 (STREAMING 再検知) の hidden → RE_LEFT 送らない (reLeftWithinStay=false 維持) // BR-91
```

注: `resolveResume` は id で `stats_events` 内の確定済みレコードを後追い更新する。

---

## 3. 記録フロー (ide source)

```
[VS Code agentStop Hook → 完了]
   record = { source:'ide', waitStartAt, waitEndAt,
              leisureStartAt, leisureEndAt, leisureDomain }   // genre は送らない (F4=A)
   IpcClient.send({ type:'STATS_RECORD', payload:record })

[Chrome IdeBridge 受信]
   genre = LeisureClassifier.classify(leisureDomain or url)  // Chrome 側で分類 (F4=A)
   event = { id:`ide-${waitStartAt}`, ...record,
             leisureGenreId: leisure有 ? genre.genreId : null,
             resumeActionAt:null, resumeOutcome:null, reLeftWithinStay:null,
             dateKey: toDateKey(waitStartAt) }
   StatsRepository.appendEvent(event)   // 確定形なので即 append
```

- ide は進行中管理なし (VS Code 側で完結し確定形を送る)。M-05/M-07 対象外 (C4=B)。

---

## 4. 集計フロー (StatsAggregator.aggregate)

```
input: events (StatsEvent[]), now
1. todays = events.filter(e => e.dateKey === toDateKey(now))
2. todayWaitMs   = Σ max(0, e.waitEndAt − e.waitStartAt)
   todayLeisureMs= Σ (e.leisureStartAt!=null ? max(0, e.leisureEndAt − e.leisureStartAt) : 0)
   todayCycleCount = todays.length
3. genreBreakdown: group todays by leisureGenreId (null は除外) → {ms 合算}; ratio = ms/Σms
4. autoReturned = todays.filter(source=chrome && leisureStartAt!=null)
   stayRate = autoReturned.length ? count(reLeftWithinStay===false)/autoReturned.length : null
5. resumed = todays.filter(source=chrome && resumeOutcome==='resumed')
   avgResumeSec = resumed.length ? avg(resumeActionAt − waitEndAt)/1000 : null
   noResumeCount = count(todays where source=chrome && resumeOutcome==='timeout')
6. weeklyTrend: for d in [today-6 .. today]:
      dayEvents = events.filter(dateKey===d)
      { dateKey:d, label:曜日/MMDD, leisureMs, waitMs, cycleCount }
output: DashboardSummary
```

- 純粋関数。LeisureClassifier の結果はレコードに保存済みのため集計時の再分類なし。
- 全て防御的 (NaN/負値は 0、null は除外)。

---

## 5. エラーハンドリング方針

| シナリオ | 扱い |
|---------|------|
| storage 読み込み失敗 | 空配列として扱い、空状態表示 (BR-101) |
| 破損レコード (必須欠落) | 集計時にスキップ (防御フィルタ) |
| 記録書き込み失敗 | warn ログのみ、コア体験継続 (BR-97) |
| classify への不正 URL | 'other' を返す (BR-89) |
| pending と新 WAIT の競合 | 古い pending を破棄 (BR-81) |
| SW 再起動で pending 消失 | session 復元、なければ当該サイクルは記録漏れ (許容) |
