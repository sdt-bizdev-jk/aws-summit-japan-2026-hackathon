# cycle-6 Functional Design — Frontend Components (Dashboard)

最終更新: 2026-05-29

ダッシュボードページ (`extension/dashboard/`) の UI コンポーネント構造。
テーマ: ダーク基調 #0a0a0f + 紫アクセント #7c3aed (ポータルと統一、FR-83)。依存ゼロ・純粋 HTML/CSS (NFR-72)。

---

## 1. コンポーネント階層 (DOM 構造)

```
body.dashboard
├── header.dash-header
│    ├── h1 "📊 WaitLess ダッシュボード"
│    └── nav.dash-nav (ポータルへ戻るリンク等)
├── main.dash-main
│    ├── section.summary-grid                 ← サマリカード群 (M-01,02,04,05,06,07)
│    │    ├── div.stat-card (今日ダメになった時間 M-02、ヒーロー大)
│    │    ├── div.stat-card (待ち時間合計 M-01)
│    │    ├── div.stat-card (待ちサイクル回数 M-06)
│    │    ├── div.stat-card (離脱継続率 M-04)
│    │    ├── div.stat-card (集中復帰平均秒数 M-05)
│    │    └── div.stat-card (未復帰回数 M-07)
│    ├── section.genre-breakdown              ← 余暇種別内訳 (M-03)
│    │    ├── h2 "今日の余暇種別の内訳"
│    │    └── ul.genre-list
│    │         └── li.genre-row * N
│    │              ├── span.genre-emoji + span.genre-label
│    │              ├── div.genre-bar > div.genre-bar-fill (width:ratio%)
│    │              └── span.genre-value (時間 + %)
│    ├── section.weekly-trend                 ← 週次トレンド (M-01/M-02 トグル, F7=C)
│    │    ├── h2 "週次トレンド (直近7日)" + div.trend-toggle (ダメ時間/待ち時間)
│    │    └── div.trend-chart
│    │         └── div.trend-bar * 7
│    │              ├── div.trend-bar-fill (height:%)
│    │              └── span.trend-bar-label (曜日)
│    └── div.empty-state (hidden、データ0件時に表示, BR-101)
└── footer.dash-footer (注記: 端末ローカル保存・外部送信なし)
```

---

## 2. コンポーネント仕様

### SummaryCard (div.stat-card)
- **Props 相当**: { icon, label, value, sub? }
- 「今日ダメになった時間」はヒーローカード (大きめ、紫グラデ枠)
- value は formatDuration の結果 (例 "1h 23m")、率は "%"、秒は "Ns"
- データなし指標は "—" 表示

### GenreRow (li.genre-row)
- **Props 相当**: { emoji, label, ms, ratio }
- 構成比バー: `div.genre-bar-fill { width: ratio*100% }`、ジャンル色は紫系の濃淡 or ジャンル固定色
- 右端に "32m (45%)" 形式

### TrendBar (div.trend-bar)
- **Props 相当**: { label(曜日), value(ms), maxValue }
- 高さ: `value / maxValue * 100%` (最大値の日を 100% に正規化)
- ホバーで tooltip (title 属性) に正確な値
- 当日のバーはアクセント色で強調

### TrendToggle (div.trend-toggle)
- 2 ボタン: 「ダメになった時間」/「待ち時間」(F7=C)
- 選択で renderWeeklyTrend を該当指標で再描画。既定は「ダメになった時間」(BR-100)

### EmptyState (div.empty-state)
- アイコン + 「まだ記録がありません。AI の待ち時間が発生すると、ここに統計が表示されます。」
- データ 0 件時のみ表示、サマリ/グラフは隠す

---

## 3. ユーザーインタラクション

| 操作 | 結果 |
|------|------|
| ダッシュボードを開く | init() → storage 読み → aggregate → 描画 |
| トレンドのトグル切替 | weeklyTrend を別指標で再描画 (再集計不要、保持データで切替) |
| ポータルへ戻るリンク | portal.html へ遷移 |
| (リセット等の書き込み操作) | なし (BR-102) |

---

## 4. データ取得 (DashboardAPI、A3=B)

```js
async function readEvents() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get('stats_events', (res) => {
        const arr = res && Array.isArray(res.stats_events) ? res.stats_events : [];
        resolve(arr);
      });
    } catch (_e) { resolve([]); }
  });
}
```

- SW 経由しない (Reader Page と同じ直接アクセスパターン)。
- 取得後は StatsAggregator.aggregate に渡す。

---

## 5. スタイル方針 (dashboard.css)

- CSS 変数でポータルのデザイントークンを再利用: `--bg:#0a0a0f; --accent:#7c3aed; --card:#16161f; --text:#e5e5ef; --muted:#9aa;`
- グリッド: `.summary-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap }`
- バー/グラフは div + width/height % のみ (canvas/svg/画像なし)
- レスポンシブ: 1280/1024/768px で破綻しない (ポータルと同方針)
- アニメーション: バーの width/height に transition (控えめ)

---

## 6. 動線 (FR-84)

- **Portal → Dashboard**: `portal/portal.html` のヘッダに「📊 統計を見る」リンク (`dashboard/dashboard.html` を `chrome.runtime.getURL` で解決、portal.js で動的注入)
- **Options → Dashboard**: 空状態案内に「📊 統計ダッシュボード (内蔵)」の動線を追加 (options.js の inject 系と同じパターン)
- **action アイコン**: 既存通り Options を開く (変更しない、Q8=A)
