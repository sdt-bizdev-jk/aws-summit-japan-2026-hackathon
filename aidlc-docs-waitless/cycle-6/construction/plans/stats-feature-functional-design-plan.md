# cycle-6 Functional Design Plan — stats-feature (統合)

3 論理ユニット (stats-core / dashboard-page / ide-stats-bridge) を 1 つの Functional Design としてまとめて設計する。
以下の質問に `[Answer]:` タグで回答してください。記入後「done」と教えていただければ設計成果物を生成します。

---

## 設計ステップ (チェックリスト)
- [ ] business-logic-model.md (統計記録/集計のロジックモデル)
- [ ] domain-entities.md (StatsEvent, GenreDef のエンティティ定義)
- [ ] business-rules.md (BR-81〜 の規則)
- [ ] frontend-components.md (ダッシュボード UI のコンポーネント階層)

---

## 設計判断のための質問

### Question F1: 進行中サイクル (未確定レコード) の持ち方
待ち発生から完了までの「進行中サイクル」のデータをどこに持ちますか? (SW はアイドルでアンロードされ得る)

A) **storage の `stats_events` 配列に最初から未確定レコードとして追記** し、完了時に同じ id を更新する (SW 再起動に強い。ただし未完了レコードがゴミとして残るリスク → 集計時に waitEndAt=null は除外)
B) **RuntimeState (storage.session) に進行中サイクル 1 件だけ保持** し、完了時に `stats_events` へ確定追記する (確定レコードのみが本配列に入る。session は SW 再起動を跨いで復元可能)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question F2: 復帰操作検知のタイムアウト (M-05)
AI 完了後、ユーザーがいつまでも操作しない場合、集中復帰秒数 (M-05) はどう扱いますか?

A) **タイムアウトなし** — 次に操作した時刻をそのまま記録 (長時間放置だと大きな値になるが実態。ただし上限キャップ 600 秒などは設ける)
B) **タイムアウト N 秒 (例 120 秒)** — それまでに操作がなければ M-05 は「記録なし (null)」とし、平均から除外
X) Other (please describe after [Answer]: tag below)

[Answer]: B, 記録なし=集中復帰できなかった・戻れなかったなので、回数としては計測したい

### Question F3: 離脱継続率の判定窓 `stayWindowSec` (M-04)
自動復帰後、何秒以内に娯楽タブへ再離脱したら「再離脱 (継続失敗)」とみなしますか?

A) 30 秒
B) 60 秒
C) 10 秒
X) Other (please describe after [Answer]: tag below)

[Answer]: A, AIに入力して娯楽タブに正規のプロセスで離脱した場合は除く

### Question F4: VS Code (Kiro) 側の余暇種別の判定
VS Code 側の待ちサイクルの余暇種別 (ジャンル) はどう決めますか?

A) **VS Code は遷移先 URL/ドメインのみ送り、Chrome 側 LeisureClassifier で分類** (分類ロジックを 1 箇所に集約、おすすめ)
B) VS Code 側でもジャンル判定して genreId を送る (TS 側にマッピング複製)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question F5: レコード上限 `MAX_EVENTS` (A2=B のリングバッファ閾値)
保持する待ちサイクルレコードの上限件数は?

A) 5000 件 (1 日 50 サイクルでも 100 日分。JSON で数百 KB)
B) 2000 件
C) 10000 件
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question F6: 「娯楽切替なし」サイクルの記録 (登録 0 件などで切替が起きなかった場合)
待ちは発生したが娯楽タブに切り替わらなかったサイクルを統計に含めますか?

A) **含める** — leisureStartAt=null のレコードとして記録 (待ち時間 M-01 と回数 M-06 には算入、娯楽時間 M-02 には 0 算入)
B) 含めない — 切替が起きたサイクルのみ記録
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question F7: 週次トレンドの表示指標
週次トレンド (直近 7 日棒グラフ) で主に何を表示しますか?

A) 日別の「ダメになった時間 (娯楽滞在時間)」を主軸にする (M-02 の推移)
B) 日別の「待ち時間合計」(M-01 の推移)
C) 両方を切替表示できるトグルを置く
X) Other (please describe after [Answer]: tag below)

[Answer]: C
