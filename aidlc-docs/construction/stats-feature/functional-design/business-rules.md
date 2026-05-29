# cycle-6 Functional Design — Business Rules (stats-feature)

最終更新: 2026-05-29

cycle-6 で新規に確定する business rules。採番は BR-81〜 (cycle-5 は BR-80 まで使用)。

---

## 統計記録ルール

### BR-81 (進行中サイクルの単一性、F1=B)
進行中サイクルは同時に最大 1 件。`chrome.storage.session` の RuntimeState `statsPending` に保持する。新たな WAIT_DETECTED 受信時に既存の `statsPending` があれば、それは「完了せず放棄されたサイクル」とみなし破棄してから新規開始する (重複・リークを防ぐ)。

### BR-82 (確定レコードのみ本配列へ)
`stats_events` 配列には `waitEndAt` が確定した StatsEvent のみを push する。進行中 (未確定) データは入れない。これにより集計時に未確定レコードのフィルタが不要。

### BR-83 (待ちサイクルの記録条件、F6=A)
娯楽切替の有無に関わらず、WAIT_DETECTED から COMPLETION_DETECTED まで到達したサイクルは記録する。切替なしの場合 `leisureStartAt/leisureEndAt/leisureGenreId/leisureDomain` は null。待ち時間 (M-01) と回数 (M-06) には算入、娯楽時間 (M-02) には 0 算入。

### BR-84 (余暇種別の判定タイミング、A5=A)
余暇種別は娯楽切替が成立した瞬間 (`findOrOpenPlaySite` が tabId を返した直後) に、切替先 URL を LeisureClassifier.classify に渡して確定する。以後そのサイクル内では再判定しない。

### BR-85 (娯楽滞在時間の算出、M-02)
娯楽滞在時間 = `leisureEndAt − leisureStartAt`。`leisureStartAt` は切替成立時刻、`leisureEndAt` は COMPLETION_DETECTED 処理で AI タブへ戻す時刻。負値や NaN は 0 にフォールバック (NFR-75)。

### BR-86 (待ち時間の算出、M-01)
待ち時間 = `waitEndAt − waitStartAt`。`waitStartAt` は WAIT_DETECTED の検知時刻 (しきい値経過後)。負値・NaN は 0 フォールバック。

---

## 余暇種別分類ルール (LeisureClassifier)

### BR-87 (段階マッチ、A1=A)
classify(url) は以下の順で判定し、最初にマッチしたジャンルを返す:
1. **URL 完全一致**: GenreDef.urls に url が完全一致
2. **ホスト名一致**: url のホスト名 (サブドメイン込み、小文字) が GenreDef.hosts に一致
3. **ドメイン一致**: url のホスト名の eTLD+1 相当が GenreDef.domains に一致
4. いずれもなし → `other`

複数ジャンルが同一段階でマッチし得る場合は、GenreDef 配列の**先頭から探索**して最初の 1 つを採用 (決定的)。

### BR-88 (内蔵 Reader の分類)
url が `chrome-extension://` スキームかつパスに `/reader/` を含む場合は `reading` に固定分類する (ドメイン判定より優先)。

### BR-89 (分類の堅牢性)
classify は不正 URL (new URL 失敗) に対して `other` を返す。例外を投げない (純粋関数、NFR-75)。

---

## 離脱継続率ルール (M-04)

### BR-90 (再離脱の判定窓、F3=A)
自動復帰 (AI タブアクティブ化) 後 `stayWindowSec`(既定 30 秒) 以内に Claude.ai タブが hidden (visibilitychange) になった場合、原則「再離脱 (継続失敗)」とみなし `reLeftWithinStay=true`。

### BR-91 (正規プロセス離脱の除外、F3 コメント)
ただし、その hidden が「新しい待ちサイクルの開始 (WAIT_DETECTED により自動で娯楽タブへ切替)」に起因する場合は、ユーザーが AI に入力した正規の利用なので**継続失敗に数えない** (`reLeftWithinStay=false`)。
判定方法: hidden 発生時点で当該サイクルの完了後に新しい WAIT_DETECTED が発生していれば、それは正規離脱。Content Script は「完了後に再びストリーミング検知 (STREAMING 遷移) が起きた」ことを正規離脱シグナルとして扱い、その場合は RE_LEFT を送らない。

### BR-92 (離脱継続率の母集団)
M-04 = (reLeftWithinStay===false の自動復帰サイクル数) ÷ (自動復帰した chrome サイクル数)。
- 母集団は「娯楽切替あり かつ chrome source」のサイクル (自動復帰が発生したもの)。
- 切替なし (F6) や ide サイクルは母集団から除外。
- 母集団が 0 の場合 stayRate=null (ダッシュボードは「—」表示)。

---

## 集中復帰秒数ルール (M-05) + 未復帰回数 (M-07)

### BR-93 (計測起点・終点、C3=A, C2=A)
集中復帰秒数 = `resumeActionAt − waitEndAt`。
- 起点: COMPLETION_DETECTED の検知時刻 (`waitEndAt`)
- 終点: AI タブ復帰後の最初のユーザー操作 (scroll / mousemove / keydown / click のどれか早い) の時刻 (`resumeActionAt`)

### BR-94 (復帰タイムアウトと未復帰回数、F2=B + コメント → M-07)
復帰監視は最大 `resumeTimeoutSec`(既定 120 秒)。
- 120 秒以内に操作検知 → `resumeOutcome='resumed'`、`resumeActionAt` を記録。M-05 平均の対象。
- 120 秒以内に操作なし → `resumeOutcome='timeout'`、`resumeActionAt=null`。**「戻れなかった/集中復帰できなかった」サイクルとして M-07 (未復帰回数) にカウント**。M-05 平均からは除外。
- 上限キャップ: resumeActionAt − waitEndAt が異常に大きい場合も 120 秒タイムアウトで頭打ちになるため別途キャップ不要。

### BR-95 (集中復帰秒数の母集団)
M-05 = avg(resumeActionAt − waitEndAt) for サイクル where source=chrome AND resumeOutcome='resumed'。
M-07 = count(サイクル where source=chrome AND resumeOutcome='timeout')。
- ide サイクルは M-05/M-07 とも対象外 (C4=B)。
- M-05 の母集団が 0 の場合 avgResumeSec=null (「—」表示)。

---

## 保存・肥大対策ルール

### BR-96 (リングバッファ、A2=B, F5=A)
`stats_events` の件数が `MAX_EVENTS`(既定 5000) を超えたら、古い順 (waitStartAt 昇順) に超過分を削除してから保存する。

### BR-97 (best-effort 記録、NFR-74)
統計記録の各操作 (begin/attach/finalize/record*) は try/catch で囲み、失敗しても例外を上位に伝播させない。コア体験 (切替/戻り) を阻害しない。warn ログのみ。

### BR-98 (後方互換、NFR-71)
StatsRepository は `stats_events` キーのみを読み書きし、既存 `sites`/`threshold_sec`/`reader_state` を変更しない。RuntimeState への `statsPending` 追加は既存フィールドに影響しない。

---

## 集計・表示ルール

### BR-99 (今日の基準、A6=A)
「今日」はレコードの `dateKey` がローカル日付 (端末タイムゾーン) で今日と一致するもの。dateKey は記録時に `toDateKey(waitStartAt)` で確定する。

### BR-100 (週次トレンドの範囲、F7=C)
週次トレンドは「今日を含む直近 7 日」(today − 6 〜 today)。各日について leisureMs / waitMs / cycleCount を集計。データのない日は 0 のバーを表示。表示指標は「ダメになった時間 (M-02)」と「待ち時間 (M-01)」をトグルで切替 (既定: ダメになった時間)。

### BR-101 (空状態、FR-85)
`stats_events` が 0 件、または当日データが 0 件の場合は、サマリ各値を 0 / 「—」で表示しつつ「まだ記録がありません」の空状態メッセージを出す。

### BR-102 (表示の読み取り専用性、Q10=B)
ダッシュボードは `stats_events` を読み取るのみ。書き込み・削除 (リセット) は行わない。
