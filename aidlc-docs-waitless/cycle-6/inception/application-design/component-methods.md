# cycle-6 Application Design — Component Methods

最終更新: 2026-05-29

各コンポーネントのメソッドシグネチャと高レベルの目的。詳細な business rules は Functional Design (BR-81〜) で定義する。

---

## C1. StatsRepository (`sw/stats_repository.js`)

```js
/**
 * @typedef {Object} StatsEvent  待ちサイクル 1 件
 * @property {string} id              一意 ID (`${source}-${waitStartAt}` 等)
 * @property {'chrome'|'ide'} source  発火経路
 * @property {number} waitStartAt     待ち発生時刻 (epoch ms)
 * @property {number|null} waitEndAt  AI 完了時刻 (epoch ms)
 * @property {number|null} leisureStartAt 娯楽切替時刻 (null=切替なし)
 * @property {number|null} leisureEndAt   娯楽終了(戻り)時刻
 * @property {string|null} leisureGenreId  余暇種別 ID (例 "video","sns","other")
 * @property {string|null} leisureDomain   切替先ドメイン
 * @property {number|null} resumeActionAt  復帰後最初の操作時刻 (chrome のみ)
 * @property {boolean|null} reLeftWithinStay 復帰後しきい値内に再離脱したか (chrome のみ)
 * @property {string} dateKey         ローカル日付キー "YYYY-MM-DD" (A6=A)
 */

// 進行中サイクルを開始 (待ち発生時)。戻り値は進行中レコードの id
async function beginCycle(params: { source, waitStartAt, dateKey }): Promise<string>

// 娯楽切替が成立した時に種別・ドメイン・leisureStartAt を補完 (A5=A)
async function attachLeisure(id, { leisureStartAt, leisureDomain, leisureGenreId }): Promise<void>

// 完了時にサイクルを確定 (waitEndAt, leisureEndAt をセットして永続化)
async function finalizeCycle(id, { waitEndAt, leisureEndAt }): Promise<void>

// 復帰後の最初の操作時刻を記録 (M-05)
async function recordResumeAction(id, resumeActionAt): Promise<void>

// 復帰後の再離脱有無を記録 (M-04)
async function recordReLeft(id, reLeftWithinStay): Promise<void>

// VS Code 由来の完結済みサイクルを 1 件まるごと記録 (source="ide")
async function recordCycle(event: Partial<StatsEvent>): Promise<void>

// 全レコード取得 (防御的読み込み、破損はスキップ)
async function getAllEvents(): Promise<StatsEvent[]>

// 内部: 上限件数 (MAX_EVENTS) 超過分を古い順に削除 (A2=B リングバッファ)
async function pruneIfNeeded(events): Promise<StatsEvent[]>
```

- 不変条件: 書き込みは best-effort、失敗は warn ログのみでコア体験を止めない (NFR-74)
- 進行中サイクルは RuntimeState ではなく storage の最新未確定レコードとして扱う (SW 再起動耐性)。実装詳細は Functional Design で確定。

---

## C2. LeisureClassifier (`sw/leisure_classifier.js`)

```js
/**
 * @typedef {Object} GenreDef
 * @property {string} id         "video","music","ec","game","sns","news","reading",
 *                               "manga","sports","cooking","travel","relax"
 * @property {string} label      日本語表示名
 * @property {string} emoji
 * @property {string[]} urls     完全一致候補 (ポータル登録 URL)
 * @property {string[]} hosts    ホスト名候補 (例 "music.youtube.com")
 * @property {string[]} domains  ドメイン候補 (eTLD+1 相当、例 "youtube.com")
 */

// URL を分類する (A1=A の段階マッチ: url完全一致→host一致→domain一致→other)
function classify(url: string): { genreId: string, genreLabel: string, emoji: string }

// 全ジャンル定義 (ラベル/絵文字) を返す (ダッシュボードの内訳ラベル用)
function getGenreDefs(): GenreDef[]
```

- 純粋関数 (storage 非依存)。chrome-extension の reader URL は "reading" に固定マッピング。
- 多義ドメインは「より具体的なマッチ (url > host > domain)」を優先することで衝突を最小化する (A1=A)。

---

## C4. StatsAggregator (`dashboard/stats_aggregator.js`)

```js
/**
 * @typedef {Object} DashboardSummary
 * @property {number} todayLeisureMs   今日ダメになった時間 (M-02)
 * @property {number} todayWaitMs      今日の待ち時間合計 (M-01)
 * @property {number} todayCycleCount  今日の待ちサイクル回数 (M-06)
 * @property {Array<{genreId,label,emoji,ms,ratio}>} genreBreakdown 余暇種別内訳 (M-03)
 * @property {number|null} stayRate    離脱継続率 (M-04) 0..1、対象なしは null
 * @property {number|null} avgResumeSec 集中復帰平均秒数 (M-05)、対象なしは null
 * @property {Array<{dateKey,label,leisureMs,waitMs,cycleCount}>} weeklyTrend 直近7日
 */

// 生レコード配列 + 基準時刻から、当日サマリ + 週次トレンドを算出
function aggregate(events: StatsEvent[], now: number): DashboardSummary

// ローカル日付キー "YYYY-MM-DD" を返す (A6=A)
function toDateKey(epochMs: number): string

// ミリ秒を "Xh Ym" / "Ym Zs" 等の人間可読文字列に整形
function formatDuration(ms: number): string
```

- 純粋関数。M-04 は (reLeftWithinStay===false の自動復帰サイクル数) / (自動復帰サイクル総数)。M-05 は resumeActionAt が記録された chrome サイクルの avg(resumeActionAt − waitEndAt)。

---

## C3. DashboardPage (`dashboard/dashboard.js`)

```js
// 初期化: storage から events を読み、aggregate して描画
async function init(): Promise<void>

// サマリカード群を描画
function renderSummaryCards(summary): void

// 余暇種別の構成比バーを描画 (純粋 CSS)
function renderGenreBreakdown(genreBreakdown): void

// 週次トレンド棒グラフを描画 (div 高さ表現)
function renderWeeklyTrend(weeklyTrend): void

// 空状態を描画 (FR-85)
function renderEmptyState(): void
```

- DashboardAPI: A3=B により、`chrome.storage.local.get('stats_events')` を直接呼ぶ薄いラッパー (`readEvents()`)。SW 経由しない。

---

## C5. WaitOrchestrator 改修メソッド (追記内容)

```js
// onWaitDetected 内: 切替成功後に
//   const id = await StatsRepository.beginCycle({source:'chrome', waitStartAt, dateKey});
//   切替成功時: await StatsRepository.attachLeisure(id, {leisureStartAt, leisureDomain, leisureGenreId});
//   (進行中 id は RuntimeState に保持: setStatsCycleId)

// onCompletionDetected 内:
//   await StatsRepository.finalizeCycle(id, {waitEndAt, leisureEndAt});
```

- RuntimeState に進行中サイクル id を 1 つ保持するフィールド (`statsCycleId`) を追加 (最小拡張)。

---

## C6. ClaudeSiteAdapter 改修メソッド (追記内容)

```js
// 完了検知後、復帰監視モードを一定時間 ON にする
function armResumeWatch(): void   // scroll/mousemove/keydown/click を一度だけ捕捉 → RESUME_ACTION 送信
function armReLeftWatch(): void   // visibilitychange(hidden) を stayWindowSec 内で監視 → RE_LEFT 送信
```

- COMPLETION 検知 (既存ロジック) のタイミングでこれらを arm する。発火後はリスナー解除 (一度きり)。

---

## C8. IdeBridge 改修 (追記内容)

```js
// 受信ディスパッチに STATS_RECORD ケースを追加
//   case 'STATS_RECORD': await StatsRepository.recordCycle({...payload, source:'ide'});
```

---

## C9. VS Code Extension 改修 (追記内容)

```ts
// WaitOrchestratorIde に統計算出を追加し、IpcClient 経由で送信
function buildStatsRecord(): StatsRecordPayload  // waitStart/End, leisureStart/End, genre, domain
function sendStats(record): void                 // ipcClient.send({type:'STATS_RECORD', payload:record})
```

- 余暇種別は VS Code 側で開いた URL から判定 (Chrome の LeisureClassifier と同等のマッピングを TS 側にも持つ、または domain だけ送って Chrome 側で分類)。Functional Design で確定。
