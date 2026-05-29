/**
 * WaitLess Dashboard Page (cycle-6)
 *
 * 役割:
 *   - chrome.storage.local の stats_events を直接読み (A3=B)
 *   - StatsAggregator.aggregate で当日サマリ + 週次トレンドを算出
 *   - サマリカード / 余暇種別内訳 / 週次トレンドを描画
 *   - 週次トレンドは「ダメになった時間 / 待ち時間」をトグル切替 (F7=C)
 *
 * 依存ゼロ・通常スクリプト (ESM 不使用)。chrome.runtime.getURL 利用可。
 *
 * 関連 FR: FR-79, FR-80, FR-81, FR-82, FR-83, FR-85
 * 関連 BR: BR-99, BR-100, BR-101, BR-102
 */
(function () {
  'use strict';

  var DEBUG = true;
  function log() { if (DEBUG) console.log.apply(console, ['[Dashboard]'].concat([].slice.call(arguments))); }
  function warn() { console.warn.apply(console, ['[Dashboard]'].concat([].slice.call(arguments))); }

  var STORAGE_KEY = 'stats_events';
  var RESEARCH_KEY = 'research_events';
  var AGG = window.StatsAggregator;

  // 現在のトレンド表示指標 ('leisure' | 'wait')
  var currentMetric = 'leisure';
  var lastSummary = null;

  // --------------------------------------------------------------------------
  // データ取得 (A3=B: 直接 storage 読み)
  // --------------------------------------------------------------------------
  function readEvents() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(STORAGE_KEY, function (res) {
          var arr = (res && Array.isArray(res[STORAGE_KEY])) ? res[STORAGE_KEY] : [];
          resolve(arr);
        });
      } catch (e) {
        warn('readEvents failed', e);
        resolve([]);
      }
    });
  }

  function readResearch() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(RESEARCH_KEY, function (res) {
          var arr = (res && Array.isArray(res[RESEARCH_KEY])) ? res[RESEARCH_KEY] : [];
          resolve(arr);
        });
      } catch (e) {
        warn('readResearch failed', e);
        resolve([]);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 描画: デスクリサーチ ダイジェスト (cycle-7)
  // タスク(プロジェクト)ごとにグルーピングして、閲覧ページを一覧表示する。
  // --------------------------------------------------------------------------
  function renderResearch(events) {
    var listEl = document.getElementById('research-list');
    var emptyEl = document.getElementById('research-empty');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!events || events.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    // taskTitle でグループ化 (新しい順)
    var groups = {};
    var order = [];
    events.slice().sort(function (a, b) { return (b.capturedAt || 0) - (a.capturedAt || 0); })
      .forEach(function (e) {
        var key = e.taskTitle || 'Claude セッション';
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(e);
      });

    order.forEach(function (key) {
      var items = groups[key];
      var card = document.createElement('div');
      card.className = 'research-card';
      card.setAttribute('data-testid', 'research-card');

      var head = document.createElement('div');
      head.className = 'research-card-task';
      head.textContent = '📁 ' + key;
      // 要約元バッジ (最新エントリの summarizedBy)
      var by = items[0] && items[0].summarizedBy;
      var badge = document.createElement('span');
      badge.className = 'research-badge ' + (by === 'bedrock' ? 'is-bedrock' : 'is-local');
      badge.textContent = by === 'bedrock' ? 'Amazon Bedrock' : 'ローカル要約';
      head.appendChild(badge);
      card.appendChild(head);

      // ダイジェスト (最新エントリの digest を採用)
      if (items[0] && items[0].digest) {
        var digest = document.createElement('div');
        digest.className = 'research-card-digest';
        digest.textContent = items[0].digest;
        card.appendChild(digest);
      }

      var ul = document.createElement('ul');
      ul.className = 'research-items';
      items.forEach(function (e) {
        var li = document.createElement('li');
        li.className = 'research-item';
        var t = e.leisureTitle || e.leisureDomain || '(無題)';
        var dom = e.leisureDomain ? ' — ' + e.leisureDomain : '';
        if (e.leisureUrl) {
          var a = document.createElement('a');
          a.href = e.leisureUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = t;
          li.appendChild(a);
          li.appendChild(document.createTextNode(dom));
        } else {
          li.textContent = t + dom;
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
      listEl.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // 描画: サマリカード (M-01,02,04,05,06,07)
  // --------------------------------------------------------------------------
  function renderSummaryCards(summary) {
    var grid = document.getElementById('summary-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var fmt = AGG.formatDuration;
    var pct = function (r) { return r == null ? '—' : Math.round(r * 100) + '%'; };
    var sec = function (s) { return s == null ? '—' : (Math.round(s * 10) / 10) + '秒'; };

    var cards = [
      { hero: true, icon: '⏳', label: '今日ダメになった時間', value: fmt(summary.todayLeisureMs),
        sub: '娯楽タブに滞在した合計時間' },
      { icon: '🕒', label: 'AI 待ち時間 (合計)', value: fmt(summary.todayWaitMs),
        sub: '今日 AI を待った合計' },
      { icon: '🔁', label: '待ちサイクル回数', value: String(summary.todayCycleCount) + '回',
        sub: '今日の待ち発生回数' },
      { icon: '🎯', label: '離脱継続率', value: pct(summary.stayRate),
        sub: '復帰後30秒以内に再離脱しなかった割合' },
      { icon: '⚡', label: '集中復帰までの平均', value: sec(summary.avgResumeSec),
        sub: 'AI 完了から最初の操作まで' },
      { icon: '🚪', label: '戻れなかった回数', value: String(summary.noResumeCount) + '回',
        sub: '120秒以内に操作がなかった回数' },
    ];

    cards.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'stat-card' + (c.hero ? ' hero' : '');
      card.setAttribute('data-testid', 'stat-card');

      var icon = document.createElement('div');
      icon.className = 'stat-icon';
      icon.textContent = c.icon;

      var label = document.createElement('div');
      label.className = 'stat-label';
      label.textContent = c.label;

      var value = document.createElement('div');
      value.className = 'stat-value';
      value.textContent = c.value;

      var sub = document.createElement('div');
      sub.className = 'stat-sub';
      sub.textContent = c.sub;

      card.appendChild(icon);
      card.appendChild(label);
      card.appendChild(value);
      card.appendChild(sub);
      grid.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // 描画: 余暇種別の内訳 (M-03)
  // --------------------------------------------------------------------------
  function renderGenreBreakdown(breakdown) {
    var listEl = document.getElementById('genre-list');
    var emptyEl = document.getElementById('genre-empty');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!breakdown || breakdown.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var fmt = AGG.formatDuration;
    breakdown.forEach(function (g) {
      var li = document.createElement('li');
      li.className = 'genre-row';
      li.setAttribute('data-testid', 'genre-row');

      var name = document.createElement('div');
      name.className = 'genre-name';
      var emoji = document.createElement('span');
      emoji.className = 'genre-emoji';
      emoji.textContent = g.emoji;
      var labelText = document.createElement('span');
      labelText.textContent = g.label;
      name.appendChild(emoji);
      name.appendChild(labelText);

      var bar = document.createElement('div');
      bar.className = 'genre-bar';
      var fill = document.createElement('div');
      fill.className = 'genre-bar-fill';
      fill.style.width = Math.max(2, Math.round(g.ratio * 100)) + '%';
      bar.appendChild(fill);

      var value = document.createElement('div');
      value.className = 'genre-value';
      value.textContent = fmt(g.ms) + ' (' + Math.round(g.ratio * 100) + '%)';

      li.appendChild(name);
      li.appendChild(bar);
      li.appendChild(value);
      listEl.appendChild(li);
    });
  }

  // --------------------------------------------------------------------------
  // 描画: 週次トレンド (M-01/M-02 トグル, F7=C)
  // --------------------------------------------------------------------------
  function renderWeeklyTrend(weeklyTrend, metric) {
    var chart = document.getElementById('trend-chart');
    if (!chart) return;
    chart.innerHTML = '';

    var fmt = AGG.formatDuration;
    var valueKey = metric === 'wait' ? 'waitMs' : 'leisureMs';

    var maxValue = 0;
    weeklyTrend.forEach(function (d) {
      if (d[valueKey] > maxValue) maxValue = d[valueKey];
    });

    weeklyTrend.forEach(function (d) {
      var bar = document.createElement('div');
      bar.className = 'trend-bar' + (d.isToday ? ' is-today' : '');
      bar.setAttribute('data-testid', 'trend-bar');

      var valueText = document.createElement('div');
      valueText.className = 'trend-bar-value';
      valueText.textContent = d[valueKey] > 0 ? fmt(d[valueKey]) : '';

      var track = document.createElement('div');
      track.className = 'trend-bar-track';
      var fill = document.createElement('div');
      fill.className = 'trend-bar-fill';
      var heightPct = maxValue > 0 ? (d[valueKey] / maxValue * 100) : 0;
      fill.style.height = heightPct + '%';
      fill.title = d.label + ': ' + fmt(d[valueKey]) + ' / ' + d.cycleCount + '回';
      track.appendChild(fill);

      var label = document.createElement('div');
      label.className = 'trend-bar-label';
      label.textContent = d.label;

      bar.appendChild(valueText);
      bar.appendChild(track);
      bar.appendChild(label);
      chart.appendChild(bar);
    });
  }

  // --------------------------------------------------------------------------
  // 空状態 (BR-101)
  // --------------------------------------------------------------------------
  function showEmptyState() {
    var empty = document.getElementById('empty-state');
    var content = document.getElementById('dash-content');
    if (empty) empty.hidden = false;
    if (content) content.hidden = true;
  }
  function showContent() {
    var empty = document.getElementById('empty-state');
    var content = document.getElementById('dash-content');
    if (empty) empty.hidden = true;
    if (content) content.hidden = false;
  }

  // --------------------------------------------------------------------------
  // トグル操作
  // --------------------------------------------------------------------------
  function setupTrendToggle() {
    var btnLeisure = document.getElementById('toggle-leisure');
    var btnWait = document.getElementById('toggle-wait');
    if (!btnLeisure || !btnWait) return;

    function select(metric) {
      currentMetric = metric;
      btnLeisure.classList.toggle('is-active', metric === 'leisure');
      btnWait.classList.toggle('is-active', metric === 'wait');
      if (lastSummary) renderWeeklyTrend(lastSummary.weeklyTrend, metric);
    }

    btnLeisure.addEventListener('click', function () { select('leisure'); });
    btnWait.addEventListener('click', function () { select('wait'); });
  }

  // --------------------------------------------------------------------------
  // ポータルへの動線
  // --------------------------------------------------------------------------
  function setupNavLinks() {
    var portalLink = document.getElementById('nav-portal');
    if (portalLink) {
      try {
        if (chrome && chrome.runtime && chrome.runtime.getURL) {
          portalLink.href = chrome.runtime.getURL('portal/portal.html');
        }
      } catch (e) {
        warn('getURL failed for portal', e);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 初期化
  // --------------------------------------------------------------------------
  function init() {
    if (!AGG) {
      warn('StatsAggregator が読み込まれていません');
      return;
    }
    setupNavLinks();
    setupTrendToggle();

    readEvents().then(function (events) {
      var hasAny = Array.isArray(events) && events.length > 0;
      var summary = AGG.aggregate(events, Date.now());
      lastSummary = summary;

      // 当日データも週次データも全くない場合のみ空状態 (BR-101)
      var hasToday = summary.todayCycleCount > 0;
      var hasWeek = summary.weeklyTrend.some(function (d) { return d.cycleCount > 0; });

      if (!hasAny || (!hasToday && !hasWeek)) {
        showEmptyState();
        log('empty state');
        return;
      }

      showContent();
      renderSummaryCards(summary);
      renderGenreBreakdown(summary.genreBreakdown);
      renderWeeklyTrend(summary.weeklyTrend, currentMetric);
      readResearch().then(function (research) {
        renderResearch(research);
      });
      log('rendered', { cycles: summary.todayCycleCount });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
