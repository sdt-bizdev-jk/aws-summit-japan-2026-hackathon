/**
 * StatsAggregator (cycle-6)
 *
 * 生の StatsEvent 配列から、当日サマリ + 週次トレンドを算出する純粋関数群。
 * ダッシュボードページ側で動作する (A3=B、SW 経由しない)。
 *
 * 依存ゼロ・通常スクリプト (ESM 不使用)。window.StatsAggregator に公開する。
 * ジャンルのラベル/絵文字は leisure_classifier.js と同じものを内蔵 (表示用)。
 *
 * 関連 BR: BR-99, BR-100, BR-101
 * 指標: M-01〜M-07
 */
(function () {
  'use strict';

  // 表示用ジャンルラベル (leisure_classifier.getGenreDefs と同一内容)
  var GENRE_LABELS = {
    video:   { label: '動画視聴',        emoji: '🎬' },
    music:   { label: '音楽',            emoji: '🎵' },
    ec:      { label: 'EC ショッピング', emoji: '🛒' },
    game:    { label: 'ゲーム',          emoji: '🎮' },
    sns:     { label: 'SNS',             emoji: '💬' },
    news:    { label: 'ニュース',        emoji: '📰' },
    reading: { label: '読書',            emoji: '📖' },
    manga:   { label: '漫画',            emoji: '📚' },
    sports:  { label: 'スポーツ',        emoji: '⚽' },
    cooking: { label: '料理',            emoji: '🍳' },
    travel:  { label: '旅行',            emoji: '✈️' },
    relax:   { label: 'リラックス',      emoji: '🧘' },
    other:   { label: 'その他',          emoji: '🔖' },
  };

  var WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * epoch ms をローカル日付キー "YYYY-MM-DD" に変換 (BR-99, A6=A)。
   */
  function toDateKey(epochMs) {
    var d = (typeof epochMs === 'number' && isFinite(epochMs)) ? new Date(epochMs) : new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * ミリ秒を人間可読文字列に整形。
   *   >= 1h  -> "1時間23分"
   *   >= 1m  -> "23分"
   *   else   -> "45秒"
   */
  function formatDuration(ms) {
    var n = Number(ms);
    if (!isFinite(n) || n <= 0) return '0秒';
    var totalSec = Math.round(n / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (h > 0) return h + '時間' + (m > 0 ? m + '分' : '');
    if (m > 0) return m + '分' + (s > 0 ? s + '秒' : '');
    return s + '秒';
  }

  function safeDiff(end, start) {
    var e = Number(end);
    var s = Number(start);
    if (!isFinite(e) || !isFinite(s)) return 0;
    var d = e - s;
    return d > 0 ? d : 0;
  }

  /**
   * 直近 7 日の日付キー配列 (古い順、today-6 .. today) を返す。
   */
  function buildLast7Days(now) {
    var keys = [];
    var base = new Date(now);
    base.setHours(0, 0, 0, 0);
    for (var i = 6; i >= 0; i--) {
      var d = new Date(base.getTime());
      d.setDate(base.getDate() - i);
      keys.push({
        dateKey: toDateKey(d.getTime()),
        label: WEEKDAY_JA[d.getDay()],
      });
    }
    return keys;
  }

  /**
   * 生レコード配列 + 基準時刻から DashboardSummary を算出する。
   * @param {Array} events
   * @param {number} now
   * @returns {Object} DashboardSummary
   */
  function aggregate(events, now) {
    var list = Array.isArray(events) ? events : [];
    var todayKey = toDateKey(now);

    var todays = list.filter(function (e) {
      return e && e.dateKey === todayKey;
    });

    // M-01 / M-02 / M-06
    var todayWaitMs = 0;
    var todayLeisureMs = 0;
    todays.forEach(function (e) {
      todayWaitMs += safeDiff(e.waitEndAt, e.waitStartAt);
      if (e.leisureStartAt != null && e.leisureEndAt != null) {
        todayLeisureMs += safeDiff(e.leisureEndAt, e.leisureStartAt);
      }
    });
    var todayCycleCount = todays.length;

    // M-03 余暇種別内訳 (当日、切替ありのみ)
    var genreMsMap = {};
    todays.forEach(function (e) {
      if (e.leisureGenreId != null && e.leisureStartAt != null && e.leisureEndAt != null) {
        var ms = safeDiff(e.leisureEndAt, e.leisureStartAt);
        genreMsMap[e.leisureGenreId] = (genreMsMap[e.leisureGenreId] || 0) + ms;
      }
    });
    var totalGenreMs = 0;
    Object.keys(genreMsMap).forEach(function (k) { totalGenreMs += genreMsMap[k]; });
    var genreBreakdown = Object.keys(genreMsMap).map(function (id) {
      var meta = GENRE_LABELS[id] || { label: id, emoji: '🔖' };
      return {
        genreId: id,
        label: meta.label,
        emoji: meta.emoji,
        ms: genreMsMap[id],
        ratio: totalGenreMs > 0 ? genreMsMap[id] / totalGenreMs : 0,
      };
    }).sort(function (a, b) { return b.ms - a.ms; });

    // M-04 離脱継続率 (当日 chrome 切替ありサイクル = 自動復帰したもの)
    var autoReturned = todays.filter(function (e) {
      return e.source === 'chrome' && e.leisureStartAt != null;
    });
    var stayRate = null;
    if (autoReturned.length > 0) {
      var stayed = autoReturned.filter(function (e) {
        return e.reLeftWithinStay === false;
      }).length;
      stayRate = stayed / autoReturned.length;
    }

    // M-05 集中復帰平均秒数 / M-07 未復帰回数 (当日 chrome)
    var resumed = todays.filter(function (e) {
      return e.source === 'chrome' && e.resumeOutcome === 'resumed' && e.resumeActionAt != null;
    });
    var avgResumeSec = null;
    if (resumed.length > 0) {
      var sumSec = 0;
      resumed.forEach(function (e) {
        sumSec += safeDiff(e.resumeActionAt, e.waitEndAt) / 1000;
      });
      avgResumeSec = sumSec / resumed.length;
    }
    var noResumeCount = todays.filter(function (e) {
      return e.source === 'chrome' && e.resumeOutcome === 'timeout';
    }).length;

    // 週次トレンド (直近 7 日)
    var days = buildLast7Days(now);
    var byDate = {};
    list.forEach(function (e) {
      if (!e || !e.dateKey) return;
      if (!byDate[e.dateKey]) byDate[e.dateKey] = { leisureMs: 0, waitMs: 0, cycleCount: 0 };
      byDate[e.dateKey].waitMs += safeDiff(e.waitEndAt, e.waitStartAt);
      if (e.leisureStartAt != null && e.leisureEndAt != null) {
        byDate[e.dateKey].leisureMs += safeDiff(e.leisureEndAt, e.leisureStartAt);
      }
      byDate[e.dateKey].cycleCount += 1;
    });
    var weeklyTrend = days.map(function (d) {
      var agg = byDate[d.dateKey] || { leisureMs: 0, waitMs: 0, cycleCount: 0 };
      return {
        dateKey: d.dateKey,
        label: d.label,
        leisureMs: agg.leisureMs,
        waitMs: agg.waitMs,
        cycleCount: agg.cycleCount,
        isToday: d.dateKey === todayKey,
      };
    });

    return {
      todayLeisureMs: todayLeisureMs,
      todayWaitMs: todayWaitMs,
      todayCycleCount: todayCycleCount,
      genreBreakdown: genreBreakdown,
      stayRate: stayRate,
      avgResumeSec: avgResumeSec,
      noResumeCount: noResumeCount,
      weeklyTrend: weeklyTrend,
    };
  }

  window.StatsAggregator = {
    aggregate: aggregate,
    toDateKey: toDateKey,
    formatDuration: formatDuration,
    GENRE_LABELS: GENRE_LABELS,
  };
})();
