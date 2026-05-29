# cycle-6 Application Design — Components

最終更新: 2026-05-29

統計ログ + ダッシュボード UI の機能を実現するコンポーネント定義。
設計判断: A1=A (URL→ホスト→ドメイン段階マッチ)、A2=B (上限リングバッファ)、A3=B (dashboard.js が直接 storage)、A4=A (既存IPCに STATS_RECORD 追加)、A5=A (切替時に種別判定)、A6=A (ローカル日付基準)

---

## 新規コンポーネント

### C1. StatsRepository (`extension/sw/stats_repository.js`)
- **レイヤー**: Layer 1 (Domain Services)
- **目的**: 統計レコード (待ちサイクル) の永続化と取得を一元管理する。`chrome.storage.local` の新規キー `stats_events` を所有する。
- **責務**:
  - 待ちサイクルレコードの生成・追記 (`recordCycle`)
  - 復帰操作時刻 (M-05) / 再離脱フラグ (M-04) による直近レコードの部分更新
  - 上限件数 (`MAX_EVENTS`、A2=B) を超えたら古いレコードから削除 (リングバッファ)
  - レコードの読み取り (ダッシュボードは直接 storage を読むが、記録系はここに集約)
  - 破損データに対する防御的読み込み (NFR-75)
- **インタフェース**: ES Module export 関数群。`chrome.storage.local` のみに依存。
- **所有データ**: `stats_events` (Array<StatsEvent>)、既存 `sites`/`threshold_sec`/`reader_state` には干渉しない (NFR-71)

### C2. LeisureClassifier (`extension/sw/leisure_classifier.js`)
- **レイヤー**: Layer 1 (Domain Services)
- **目的**: 切替先 URL を 12 ジャンル + "other" のいずれかに分類する (M-03, FR-74)。
- **責務**:
  - URL → ジャンル の段階マッチ (A1=A): ①登録 URL 完全一致 → ②ホスト名(サブドメイン込み)一致 → ③ドメイン(eTLD+1相当)一致 → ④"other"
  - 拡張機能内蔵 Reader Page (`chrome-extension://.../reader/...`) を「読書」に分類
  - 逆引きインデックスをポータルジャンル定義 (`portal_genres.js`) から構築
- **インタフェース**: `classify(url) -> { genreId, genreLabel }`。純粋関数 (storage 非依存、テスト容易)
- **データ依存**: ジャンル定義 (genreId/label/絵文字 + 各ジャンルの URL/ホスト/ドメインリスト)

### C3. DashboardPage (`extension/dashboard/dashboard.{html,css,js}`)
- **レイヤー**: Layer 4 (UI / Page)
- **目的**: 統計を可視化する拡張機能内蔵ページ (FR-79〜85)。
- **責務**:
  - サマリカード表示: 今日ダメになった時間 (M-02) / 余暇種別内訳 (M-03) / 離脱継続率 (M-04) / 集中復帰平均秒数 (M-05) / 待ち時間合計 (M-01) / 待ちサイクル回数 (M-06)
  - 余暇種別内訳を構成比バー (純粋 CSS) で可視化
  - 週次トレンド (直近 7 日) を div 高さ棒グラフで可視化
  - 空状態表示 (FR-85)
  - ダーク基調 + 紫アクセントテーマ (FR-83、ポータルと統一)
- **インタフェース**: `chrome-extension://<id>/dashboard/dashboard.html` で開く。`web_accessible_resources` に登録。

### C4. StatsAggregator (`extension/dashboard/stats_aggregator.js`)
- **レイヤー**: Layer 4 寄りの純粋ロジック (ページ側)
- **目的**: 生レコード配列から各指標 (M-01〜06) と日次/週次集計を算出する純粋関数群 (A3=B: ページ側で集計)。
- **責務**:
  - `chrome.storage.local` から `stats_events` を読む (DashboardAPI 経由)
  - 当日フィルタ (A6=A: ローカル日付)、直近 7 日の日別集計
  - 指標計算 (合計/平均/比率)、ジャンル別内訳
- **インタフェース**: 純粋関数 (レコード配列 → 集計結果)。テスト容易。LeisureClassifier の分類結果はレコードに保存済みなので再分類不要。

---

## 改修コンポーネント (最小変更、NFR-71)

### C5. WaitOrchestrator (`extension/sw/wait_orchestrator.js`) — 改修
- **変更内容**: 既存フローの要所で StatsRepository を呼ぶ (追記のみ、既存ロジック無変更)
  - `onWaitDetected`: 待ち開始時刻 + 切替成功時に種別判定 (A5=A) して進行中サイクルを記録開始
  - `onCompletionDetected`: 完了時刻 + 娯楽滞在終了を確定してレコードを finalize
- **不変条件**: 統計記録の失敗はコア体験を止めない (try/catch で握りつぶし、NFR-74)

### C6. ClaudeSiteAdapter (`extension/content/claude_site_adapter.js`) — 改修
- **変更内容**: 自動復帰後の挙動検知を追加
  - 復帰後の最初の操作 (scroll/mousemove/keydown/click のどれか早い、C2=A) を検知して `RESUME_ACTION` を SW へ送信 (M-05)
  - `visibilitychange` で hidden 復帰を監視し、しきい値内の再離脱を `RE_LEFT` で送信 (M-04, C5=A)
- **不変条件**: 既存の待ち検知ロジック (停止ボタン監視) に干渉しない。検知は完了イベント後の限定期間のみ有効化。

### C7. MessageRouter (`extension/sw/message_router.js`) — 改修
- **変更内容**: 新メッセージタイプ `RESUME_ACTION` / `RE_LEFT` を StatsRepository 系ハンドラへルーティング (case 追加のみ)

### C8. IdeBridge (`extension/sw/ide_bridge.js`) — 改修
- **変更内容**: VS Code から受信した `STATS_RECORD` メッセージ (A4=A) を StatsRepository.recordCycle へ橋渡し (source="ide")

### C9. VS Code Extension (`vscode-extension/src/extension.ts`) — 改修
- **変更内容**: IDE 待ちサイクル (promptSubmit→agentStop) の待ち時間・娯楽滞在時間・余暇種別を算出し、IPC で `STATS_RECORD` を Chrome へ送信。集中復帰秒数は送らない (C4=B)

### C10. OptionsApp / PortalPage — 改修
- **変更内容**: ダッシュボードへの動線を追加
  - Portal (`portal/portal.html`/`portal.js`): ヘッダ等にダッシュボードリンク (FR-84)
  - Options 空状態案内: 「📊 統計ダッシュボード (内蔵)」への動線

### C11. manifest.json — 改修
- **変更内容**: `web_accessible_resources` に `dashboard/*` を追加。version `0.5.0` → `0.6.0`。description 追記。

---

## コンポーネント分類 (論理ユニット対応)

| 論理ユニット | コンポーネント |
|------------|--------------|
| **stats-core** | C1 StatsRepository, C2 LeisureClassifier, C5 WaitOrchestrator改, C6 ClaudeSiteAdapter改, C7 MessageRouter改 |
| **dashboard-page** | C3 DashboardPage, C4 StatsAggregator, C10 Options/Portal動線, C11 manifest |
| **ide-stats-bridge** | C8 IdeBridge改, C9 VS Code Extension改 |
