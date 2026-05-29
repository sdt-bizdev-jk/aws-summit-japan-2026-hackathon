# cycle-6 Functional Design — Domain Entities (stats-feature)

最終更新: 2026-05-29

設計判断: F1=B (session に進行中1件)、F2=B (120秒タイムアウト + 未復帰を回数計測)、F3=A (stayWindow 30秒 + 新サイクル起因除外)、F4=A (Chrome側分類)、F5=A (MAX_EVENTS=5000)、F6=A (切替なしも記録)、F7=C (両指標トグル)

---

## E1. StatsEvent (確定済み待ちサイクル)

`chrome.storage.local.stats_events` 配列の要素。**確定済みサイクルのみ** が入る (進行中は別管理、F1=B)。

```js
/**
 * @typedef {Object} StatsEvent
 * @property {string}  id                一意 ID。`${source}-${waitStartAt}`
 * @property {'chrome'|'ide'} source      発火経路
 * @property {number}  waitStartAt        待ち発生時刻 (epoch ms)
 * @property {number}  waitEndAt          AI 完了時刻 (epoch ms)。確定時に必ず入る
 * @property {number|null} leisureStartAt 娯楽切替成立時刻。切替なし(F6)は null
 * @property {number|null} leisureEndAt   娯楽終了(戻り)時刻。切替なしは null
 * @property {string|null} leisureGenreId 余暇種別 ID (E3 の id)。切替なしは null
 * @property {string|null} leisureDomain  切替先ドメイン。切替なしは null
 * @property {number|null} resumeActionAt 復帰後の最初の操作時刻 (chrome のみ)。
 *                                        未復帰(F2 タイムアウト)/ide は null
 * @property {'resumed'|'timeout'|null} resumeOutcome
 *                                        chrome: 'resumed'(操作検知) / 'timeout'(120s 内に操作なし)
 *                                        ide / 切替なし: null
 * @property {boolean|null} reLeftWithinStay
 *                                        復帰後 stayWindowSec 内に「自発的に」再離脱したか (chrome のみ)。
 *                                        新サイクル起因の離脱は false 扱い (F3 コメント)。ide は null
 * @property {string}  dateKey            ローカル日付キー "YYYY-MM-DD" (A6=A)
 */
```

### フィールド充足パターン

| ケース | leisure* | resumeActionAt | resumeOutcome | reLeftWithinStay |
|--------|----------|----------------|---------------|------------------|
| chrome 切替あり・復帰操作あり | 値 | 値 | 'resumed' | true/false |
| chrome 切替あり・未復帰(120s) | 値 | null | 'timeout' | false |
| chrome 切替なし (F6) | null | null | null | null |
| ide (VS Code) | 値/null | null | null | null |

---

## E2. PendingCycle (進行中サイクル、F1=B)

`chrome.storage.session.runtime_state` に統合保持 (既存 RuntimeState 拡張)。SW 再起動を跨いで復元。**1 件のみ**。

```js
/**
 * @typedef {Object} PendingCycle
 * @property {string}  id
 * @property {'chrome'} source        進行中管理は chrome のみ (ide は VS Code 側で完結し確定形で送る)
 * @property {number}  waitStartAt
 * @property {number|null} leisureStartAt
 * @property {string|null} leisureDomain
 * @property {string|null} leisureGenreId
 * @property {string}  dateKey
 */
```

- RuntimeState に `statsPending` フィールドを追加 (既存 isWaiting/claudeTabId/playTabId に並ぶ)。
- 完了時に PendingCycle → StatsEvent へ確定し `stats_events` に push、`statsPending` を null に。
- 確定後の resumeActionAt / reLeftWithinStay は、確定済み StatsEvent を id で後追い更新する (E1 の該当フィールド)。

---

## E3. GenreDef (余暇種別定義)

LeisureClassifier が持つ 12 ジャンル + "other"。ポータル (cycle-5) の 12 ジャンルと 1:1 対応。

```js
/**
 * @typedef {Object} GenreDef
 * @property {string} id        正準 ID (英小文字)
 * @property {string} label     日本語表示名
 * @property {string} emoji
 * @property {string[]} urls    完全一致候補 (任意)
 * @property {string[]} hosts   ホスト名候補 (サブドメイン込み)
 * @property {string[]} domains ドメイン候補 (eTLD+1 相当)
 */
```

### ジャンル ID 一覧 (固定)

| id | label | emoji | 代表 domains/hosts (例) |
|----|-------|-------|------------------------|
| `video` | 動画視聴 | 🎬 | youtube.com, netflix.com, hulu.jp, disneyplus.com, abema.tv, amazon.co.jp(Prime path) |
| `music` | 音楽 | 🎵 | open.spotify.com, music.youtube.com, music.apple.com, music.amazon.co.jp, soundcloud.com, awa.fm |
| `ec` | EC ショッピング | 🛒 | amazon.co.jp, rakuten.co.jp, shopping.yahoo.co.jp, zozo.jp, mercari.com, yodobashi.com |
| `game` | ゲーム | 🎮 | steampowered.com, epicgames.com, nintendo.com, playstation.com, itch.io, games.yahoo.co.jp |
| `sns` | SNS | 💬 | x.com, instagram.com, facebook.com, tiktok.com, reddit.com, threads.net |
| `news` | ニュース | 📰 | news.yahoo.co.jp, nhk.or.jp, itmedia.co.jp, bloomberg.co.jp, gizmodo.jp, gigazine.net |
| `reading` | 読書 | 📖 | (内蔵 reader = chrome-extension), amazon.co.jp(Kindle path), aozora.gr.jp, note.com, zenn.dev, kakuyomu.jp |
| `manga` | 漫画 | 📚 | shonenjumpplus.com, piccoma.com, manga.line.me, cmoa.jp, pocket.shonenmagazine.com, mechacomic.jp |
| `sports` | スポーツ | ⚽ | dazn.com, sports.yahoo.co.jp, nba.rakuten.co.jp, jleague.jp, sumo.or.jp, number.bunshun.jp |
| `cooking` | 料理 | 🍳 | cookpad.com, delishkitchen.tv, kurashiru.com, oceans-nadia.com, recipe.rakuten.co.jp, erecipe.woman.excite.co.jp |
| `travel` | 旅行 | ✈️ | jalan.net, travel.rakuten.co.jp, booking.com, airbnb.jp, tripadvisor.jp, expedia.co.jp |
| `relax` | リラックス | 🧘 | headspace.com, calm.com, (youtube 検索系はホスト一致で video に流れる点に注意) |
| `other` | その他 | 🔖 | (上記いずれにもマッチしない) |

> 多義ドメイン (amazon.co.jp / rakuten.co.jp / yahoo 系 / youtube.com) は段階マッチ (A1=A) で、より具体的な url/host が一致した方を優先。区別不能なドメイン一致のみの場合は GenreDef 配列の**先頭から最初にマッチしたジャンル**を採用 (決定的順序のため配列順を固定)。

---

## E4. DashboardSummary (集計結果、表示用)

StatsAggregator.aggregate の出力。domain-entities としては「導出値」。

```js
/**
 * @typedef {Object} DashboardSummary
 * @property {number} todayLeisureMs     今日ダメになった時間 (M-02)
 * @property {number} todayWaitMs        今日の待ち時間合計 (M-01)
 * @property {number} todayCycleCount    今日の待ちサイクル回数 (M-06)
 * @property {Array<GenreSlice>} genreBreakdown 余暇種別内訳 (M-03、今日分)
 * @property {number|null} stayRate      離脱継続率 (M-04) 0..1
 * @property {number|null} avgResumeSec  集中復帰平均秒数 (M-05)
 * @property {number} noResumeCount      未復帰回数 (M-07、resumeOutcome='timeout' の件数、今日分)
 * @property {Array<TrendDay>} weeklyTrend 直近7日
 */
// GenreSlice: { genreId, label, emoji, ms, ratio }
// TrendDay:   { dateKey, label, leisureMs, waitMs, cycleCount }
```
