# cycle-6 Application Design (統合)

最終更新: 2026-05-29

本ドキュメントは cycle-6 (統計ログ + ダッシュボード UI) のアプリケーション設計を統合したもの。
詳細は `components.md` / `component-methods.md` / `services.md` / `component-dependency.md` を参照。

---

## 0. 設計判断サマリ

| ID | 判断 | 内容 |
|----|------|------|
| A1 | 余暇種別逆引き | URL完全一致 → ホスト名一致 → ドメイン一致 → "other" の段階マッチ |
| A2 | 統計肥大対策 | 個別レコード保持 + 上限 `MAX_EVENTS` (既定 5000) でリングバッファ |
| A3 | ダッシュボード取得 | dashboard.js が `chrome.storage.local` を直接読み、ページ側で集計 |
| A4 | VS Code 連携 | 既存 IPC に `STATS_RECORD` を追加、Chrome 側 IdeBridge で受信記録 |
| A5 | 種別判定タイミング | 娯楽切替成立時に切替先 URL から判定して記録 |
| A6 | 「今日」基準 | 端末ローカルタイムゾーンの日付 (YYYY-MM-DD) |

---

## 1. コンポーネント全体像

```
新規:
  - sw/stats_repository.js   (C1) 統計レコード CRUD + リングバッファ
  - sw/leisure_classifier.js (C2) URL → 12 ジャンル分類 (純粋関数)
  - dashboard/dashboard.html (C3) ダッシュボード DOM
  - dashboard/dashboard.css  (C3) ダーク+紫テーマ
  - dashboard/dashboard.js   (C3) 描画
  - dashboard/stats_aggregator.js (C4) 集計 (純粋関数)
  - sw/portal_genres.js or leisure_classifier 内データ (C2 のジャンル定義)

改修 (最小、NFR-71):
  - sw/wait_orchestrator.js  (C5) 記録呼び出し追加
  - content/claude_site_adapter.js (C6) 復帰検知追加
  - sw/message_router.js     (C7) RESUME_ACTION/RE_LEFT ルーティング
  - sw/runtime_state.js      statsCycleId フィールド追加
  - sw/ide_bridge.js         (C8) STATS_RECORD 受信
  - vscode-extension/src/extension.ts (C9) 統計算出+IPC送信
  - options/* + portal/*     (C10) ダッシュボード動線
  - manifest.json            (C11) web_accessible_resources + version 0.6.0
```

## 2. データスキーマ (新規キー、後方互換)

`chrome.storage.local`:
```json
{
  "sites": [ ... ],            // 既存、無変更
  "threshold_sec": 5,          // 既存、無変更
  "reader_state": { ... },     // 既存 (cycle-3)、無変更
  "stats_events": [            // ★ cycle-6 新規
    {
      "id": "chrome-1717200000000",
      "source": "chrome",
      "waitStartAt": 1717200000000,
      "waitEndAt": 1717200012000,
      "leisureStartAt": 1717200003000,
      "leisureEndAt": 1717200012000,
      "leisureGenreId": "video",
      "leisureDomain": "youtube.com",
      "resumeActionAt": 1717200015000,
      "reLeftWithinStay": false,
      "dateKey": "2026-05-29"
    }
  ]
}
```

指標と算出 (Functional Design で BR 化):
- M-01 待ち時間合計 = Σ(waitEndAt − waitStartAt)
- M-02 今日ダメになった時間 = Σ(leisureEndAt − leisureStartAt) [当日]
- M-03 余暇種別内訳 = ジャンル別 leisure 時間合算
- M-04 離脱継続率 = (reLeftWithinStay===false の自動復帰数) / (自動復帰数)
- M-05 集中復帰平均秒 = avg(resumeActionAt − waitEndAt) [chrome のみ]
- M-06 待ちサイクル回数 = レコード件数

## 3. 主要フロー (services.md より要約)

1. **記録 (chrome)**: WAIT_DETECTED → beginCycle → 切替成功で attachLeisure(種別判定) → COMPLETION → finalizeCycle → 復帰検知で recordResumeAction/recordReLeft
2. **記録 (ide)**: VS Code agentStop → STATS_RECORD (IPC) → IdeBridge → recordCycle
3. **表示**: dashboard.init → storage 直接読み → aggregate → 描画

## 4. 論理ユニット (Construction の進行順)

| 順 | ユニット | 含む | 依存 |
|----|---------|------|------|
| 1 | **stats-core** | C1,C2,C5,C6,C7,RuntimeState改 | なし (基盤) |
| 2 | **dashboard-page** | C3,C4,C10,C11 | stats-core のスキーマ |
| 3 | **ide-stats-bridge** | C8,C9 | stats-core (recordCycle) |

> Functional Design は 3 ユニットを 1 つの設計ドキュメントにまとめて扱う (規模が小さく相互依存が密なため)。Code Generation はユニット順に実施。

## 5. 非機能・制約の反映

- **NFR-71 後方互換**: 既存コアファイルは「追記のみ」。tab_manager.js / settings_repository.js / reader/* / playback_*.js は無変更目標
- **NFR-72 依存ゼロ**: グラフは純粋 HTML/CSS、外部ライブラリ・画像なし
- **NFR-73 プライバシー**: stats_events は端末ローカルのみ、外部送信なし
- **NFR-74 best-effort**: 記録失敗はコア体験を止めない
- **NFR-75 堅牢性**: 防御的読み込み + リングバッファ
- **NFR-77 IDE 連携堅牢性**: IPC 切断時も Chrome 分で動作

## 6. アンチスコープ (Application Design 視点)

- リセット/エクスポート機能なし (Q10=B)
- VS Code 側集中復帰秒数なし (C4=B)
- 任意期間フィルタなし (今日 + 直近 7 日のみ)
