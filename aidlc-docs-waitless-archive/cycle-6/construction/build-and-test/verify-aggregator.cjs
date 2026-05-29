// cycle-6 自動検証: StatsAggregator.aggregate の指標算出 (M-01〜07, BR-99/100)
// 実行: node aidlc-docs/construction/build-and-test/verify-aggregator.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// stats_aggregator.js は window.StatsAggregator に公開する通常スクリプト。
// window スタブを用意して評価する。
const src = fs.readFileSync(
  path.join(__dirname, '../../../extension/dashboard/stats_aggregator.js'),
  'utf8'
);
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const AGG = sandbox.window.StatsAggregator;

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; } else { fail++; console.error(`FAIL: ${label}`); }
}
function approx(label, a, b, eps) {
  ok(label, Math.abs(a - b) <= (eps || 0.001));
}

// 基準時刻: 2026-05-29 12:00 ローカル
const now = new Date(2026, 4, 29, 12, 0, 0).getTime();
const today = AGG.toDateKey(now);
const yest = AGG.toDateKey(now - 24 * 3600 * 1000);

// テストデータ
const t = (h, m) => new Date(2026, 4, 29, h, m, 0).getTime();
const events = [
  // 今日: chrome, video, 待ち12s, 娯楽9s, resumed 3s後
  { id: 'c1', source: 'chrome', waitStartAt: t(9, 0), waitEndAt: t(9, 0) + 12000,
    leisureStartAt: t(9, 0) + 3000, leisureEndAt: t(9, 0) + 12000,
    leisureGenreId: 'video', leisureDomain: 'youtube.com',
    resumeActionAt: t(9, 0) + 12000 + 3000, resumeOutcome: 'resumed', reLeftWithinStay: false, dateKey: today },
  // 今日: chrome, sns, 待ち20s, 娯楽20s, timeout (未復帰), 再離脱true
  { id: 'c2', source: 'chrome', waitStartAt: t(10, 0), waitEndAt: t(10, 0) + 20000,
    leisureStartAt: t(10, 0), leisureEndAt: t(10, 0) + 20000,
    leisureGenreId: 'sns', leisureDomain: 'x.com',
    resumeActionAt: null, resumeOutcome: 'timeout', reLeftWithinStay: true, dateKey: today },
  // 今日: chrome, 切替なし (F6)
  { id: 'c3', source: 'chrome', waitStartAt: t(11, 0), waitEndAt: t(11, 0) + 8000,
    leisureStartAt: null, leisureEndAt: null, leisureGenreId: null, leisureDomain: null,
    resumeActionAt: null, resumeOutcome: null, reLeftWithinStay: null, dateKey: today },
  // 今日: ide, video, 待ち30s, 娯楽30s (集中復帰は対象外)
  { id: 'i1', source: 'ide', waitStartAt: t(11, 30), waitEndAt: t(11, 30) + 30000,
    leisureStartAt: t(11, 30), leisureEndAt: t(11, 30) + 30000,
    leisureGenreId: 'video', leisureDomain: 'youtube.com',
    resumeActionAt: null, resumeOutcome: null, reLeftWithinStay: null, dateKey: today },
  // 昨日: chrome, music
  { id: 'y1', source: 'chrome', waitStartAt: new Date(2026, 4, 28, 9, 0, 0).getTime(),
    waitEndAt: new Date(2026, 4, 28, 9, 0, 0).getTime() + 10000,
    leisureStartAt: new Date(2026, 4, 28, 9, 0, 0).getTime(),
    leisureEndAt: new Date(2026, 4, 28, 9, 0, 0).getTime() + 10000,
    leisureGenreId: 'music', leisureDomain: 'spotify.com',
    resumeActionAt: null, resumeOutcome: 'resumed', reLeftWithinStay: false, dateKey: yest },
];

const s = AGG.aggregate(events, now);

// M-06 今日のサイクル回数 = 4 (c1,c2,c3,i1)
ok('M-06 todayCycleCount=4', s.todayCycleCount === 4);

// M-01 今日の待ち時間合計 = 12+20+8+30 = 70s
approx('M-01 todayWaitMs=70000', s.todayWaitMs, 70000);

// M-02 今日ダメになった時間 = 9 + 20 + 0(切替なし) + 30 = 59s
approx('M-02 todayLeisureMs=59000', s.todayLeisureMs, 59000);

// M-03 余暇種別内訳: video=9+30=39s, sns=20s。ratio 合計1。降順で video が先頭
ok('M-03 has video & sns', s.genreBreakdown.length === 2);
ok('M-03 video first (largest)', s.genreBreakdown[0].genreId === 'video');
approx('M-03 video ms=39000', s.genreBreakdown[0].ms, 39000);
approx('M-03 sns ms=20000', s.genreBreakdown.find(g => g.genreId === 'sns').ms, 20000);
approx('M-03 ratio sum=1', s.genreBreakdown.reduce((a, g) => a + g.ratio, 0), 1, 0.0001);

// M-04 離脱継続率: chrome 切替ありサイクル = c1(reLeft=false), c2(reLeft=true) の2件
//   stayed = c1 のみ = 1/2 = 0.5  (i1 は ide なので除外、c3 は切替なしで除外)
approx('M-04 stayRate=0.5', s.stayRate, 0.5);

// M-05 集中復帰平均: resumed = c1 のみ = 3s
approx('M-05 avgResumeSec=3', s.avgResumeSec, 3);

// M-07 未復帰回数: timeout = c2 のみ = 1
ok('M-07 noResumeCount=1', s.noResumeCount === 1);

// 週次トレンド: 7日分、今日と昨日にデータ
ok('weekly 7 days', s.weeklyTrend.length === 7);
const todayTrend = s.weeklyTrend[6];
ok('weekly today isToday', todayTrend.isToday === true);
approx('weekly today leisureMs=59000', todayTrend.leisureMs, 59000);
const yestTrend = s.weeklyTrend[5];
approx('weekly yesterday leisureMs=10000', yestTrend.leisureMs, 10000);

// 空配列
const empty = AGG.aggregate([], now);
ok('empty todayCycleCount=0', empty.todayCycleCount === 0);
ok('empty stayRate=null', empty.stayRate === null);
ok('empty avgResumeSec=null', empty.avgResumeSec === null);
ok('empty genreBreakdown=[]', empty.genreBreakdown.length === 0);

// formatDuration
ok('fmt 0', AGG.formatDuration(0) === '0秒');
ok('fmt 45s', AGG.formatDuration(45000) === '45秒');
ok('fmt 90s', AGG.formatDuration(90000) === '1分30秒');
ok('fmt 1h', AGG.formatDuration(3600000) === '1時間');
ok('fmt neg', AGG.formatDuration(-5) === '0秒');

console.log(`\nAggregator: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
