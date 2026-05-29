# Cycle-7 Handover (cycle-6 → cycle-7)

このドキュメントは cycle-7 を始める際に最初に読むべき内容をまとめたもの。cycle-1 〜 cycle-6 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-29 (cycle-6 統計ログ + ダッシュボード UI 追加完了時点)

---

## 1. cycle-1 〜 cycle-6 で達成したこと

### 1.1 cycle-1 (MVP、2026-05-26 完了)
- WaitLess Chrome 拡張の MVP (16 ファイル、Manifest V3)
- Claude.ai 待ち N秒検知 → 娯楽タブ自動切替 → 完了で AI タブ自動戻り
- 2 パスのタブ探索戦略、動画自動再生 + 完了時一時停止
- Options Page でサイト登録・しきい値設定

### 1.2 cycle-2 (遷移先バリエーション拡大、2026-05-27 完了)
- 動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想) を公式想定対象に
- Options Page 空状態案内 + manifest description / default_title 拡張 (v0.2.0)

### 1.3 cycle-3 (Reader Page 追加、2026-05-27 完了)
- 拡張機能内蔵の Reader Page (`extension/reader/`) 4 ファイル新規追加
- クリックでの既読範囲青色化 + スクロール/クリック位置を `reader_state` に永続化
- `DOMAIN_REGEX` / `validateUrl` を chrome-extension: 対応に拡張 (v0.3.0)

### 1.4 cycle-4 (VS Code (Kiro) 拡張機能 + IPC 連携、2026-05-27 完了、動作確認 2026-05-28)
- 新規 VS Code 拡張 (`vscode-extension/` TypeScript ~530 行)
- ローカル WebSocket IPC (`ws://127.0.0.1:39472`) で Chrome 拡張と双方向通信
- Kiro Agent Hooks (promptSubmit / agentStop) → トリガーファイル → VS Code 拡張 → Chrome 拡張 → ブラウザ起動 + Chrome 最前面化 (osascript)
- 既存 sw/* 4 + content/* + reader/* は完全無変更、v0.4.0

### 1.5 cycle-5 (娯楽ポータルページ追加、2026-05-28 完了)
- Chrome 拡張内蔵の娯楽ポータルページ (`extension/portal/` 4 ファイル ≈ 600 行)
- Netflix 風 12 ジャンル × 6 カード = 72 サイト、ダーク基調 + 紫アクセント
- 既存 sw/* + content/* + reader/* + service_worker.js + vscode-extension/* は完全無変更、v0.5.0

### 1.6 cycle-6 (統計ログ + ダッシュボード UI、2026-05-29 完了)

cycle-6 のスコープ確定パターン: **中規模、機能追加 (記録 + UI + IDE 連携)**

**新規 Unit (論理 3 ユニット)**:
1. **stats-core** (統計記録の中核)
   - `extension/sw/stats_repository.js` (≈ 200 行) — `chrome.storage.local.stats_events` の CRUD、上限 5000 件リングバッファ、best-effort、防御的読み込み
   - `extension/sw/leisure_classifier.js` (≈ 200 行) — 切替先 URL を 12 ジャンル + "other" に段階マッチ分類、純粋関数
2. **dashboard-page** (ダッシュボード UI)
   - `extension/dashboard/{dashboard.html (≈ 55 行), dashboard.css (≈ 280 行), dashboard.js (≈ 240 行), stats_aggregator.js (≈ 200 行)}` — ダーク+紫テーマ、純粋 HTML/CSS グラフ、storage 直接読み + 純粋関数集計
3. **ide-stats-bridge** (VS Code 連携)
   - `ide_bridge.js` + `vscode-extension/src/extension.ts` 改修 — IDE 待ちサイクル統計を IPC で Chrome に送信

**新規機能 / 指標 (M-01〜M-07)**:
- 今日ダメになった時間 (M-02 娯楽滞在合計) / 余暇種別内訳 (M-03 12 ジャンル) / 離脱継続率 (M-04) / 集中復帰平均秒数 (M-05) / 未復帰回数 (M-07) / 待ち時間合計 (M-01) / 待ちサイクル回数 (M-06)
- 週次トレンド (直近 7 日、ダメ時間/待ち時間トグル)
- Chrome + VS Code (Kiro) 待ちサイクルを合算 (IDE は集中復帰秒数を除く)

**重要な指標の再定義 (ユーザー意向)**:
- 「戻れた率」は自動切替で常に 100% になり無意味 → **離脱継続率 (M-04)** に再定義 (自動復帰後 30 秒以内に自発的に再離脱しなかった割合)
- 「集中復帰秒数」は完了→自動アクティブ化だと一瞬 → **AI 完了から復帰後の最初のユーザー操作 (scroll/mousemove/keydown/click) まで** に再定義 (M-05)
- 120 秒以内に操作がなければ「戻れなかった」として **未復帰回数 (M-07)** にカウント (M-05 平均からは除外)
- 自動復帰後の hidden でも、新しいプロンプト送信 (新サイクル開始) 起因なら「継続失敗」に数えない (BR-91 正規プロセス離脱の除外)

**最終形**:
- ダッシュボード URL: `chrome-extension://<拡張機能 ID>/dashboard/dashboard.html`
- ポータル (cycle-5) のヘッダ「📊 統計を見る」+ Options Page のバナーからアクセス可能
- Chrome 拡張の version: 0.5.0 → 0.6.0
- 既存 `extension/sw/{tab_manager, settings_repository}.js` + `service_worker.js` + `reader/*` + `playback_*.js` は **完全無変更** (NFR-71、`git status` で実証)

**動作確認 (Build and Test)**:
- 自動: UT-61 (分類 23/23) + UT-62 (集計 24/24) + UT-63 (構文全 OK) + UT-64 (tsc 成功) — 合計 47 アサーション全 PASS
- 手動 E2E (IT-61〜68) は cycle-7 開始時または別途実施 (cycle-4/5 と同じパターン)
- 自動検証スクリプト: `aidlc-docs-waitless-archive/cycle-6/construction/build-and-test/verify-{classifier.mjs, aggregator.cjs}`

---

## 2. 既知の制限事項 (cycle-6 完了時点)

cycle-1〜5 から継続:
- アイコン PNG プレースホルダ (B-01)
- デバッグログ常時 ON (B-02, B-12, B-27、cycle-6 分も B-32 で追加)
- Claude.ai DOM セレクタの脆さ (B-03)
- 複数ウィンドウ非対応 (B-06)
- cycle-4: macOS 限定、Kiro IDE 限定、ポート 39472 ハードコード
- B-20 (Pattern γ vs Pattern α 撤退判断) は未結論 (cycle-7 で再評価可能)

cycle-6 で追加された制限:
- **統計のリセット / クリア UI なし** (B-28、現状は DevTools で `chrome.storage.local.remove('stats_events')`)
- **エクスポート機能なし** (B-29)
- **任意期間フィルタなし** (B-30、今日 + 直近 7 日のみ)
- **VS Code 側の集中復帰秒数は未計測** (B-31、C4=B)
- **統計デバッグログ常時 ON** (B-32、`stats_repository.js` 等の `DEBUG = true`)
- **余暇種別マッピングの二重管理** (B-33、`leisure_classifier.js` の GENRE_DEFS と `stats_aggregator.js` の GENRE_LABELS と `portal_data.js` が別々。単一ソース化未対応)
- **集中復帰検知の精度**: Claude.ai タブ上の操作検知ベースのため、ユーザーが別タブで作業を続けた場合などは実態とずれる可能性
- **進行中サイクルの SW 再起動耐性**: statsPending は storage.session に持つが、SW 再起動 + session 消失のタイミングでは当該サイクルが記録漏れする (許容)

---

## 3. cycle-6 動作確認結果

`aidlc-docs-waitless-archive/cycle-6/construction/build-and-test/build-and-test-summary.md` 参照:

| Criticality | テスト | 結果 |
|---|---|---|
| Automated | UT-61 (LeisureClassifier 分類) | ✅ 23/23 PASS |
| Automated | UT-62 (StatsAggregator 指標算出 M-01〜07) | ✅ 24/24 PASS |
| Automated | UT-63 (全 JS 構文チェック) | ✅ PASS |
| Automated | UT-64 (VS Code 拡張 tsc ビルド) | ✅ PASS |
| Automated | NFR-71 (git status でコアファイル無変更) | ✅ PASS |

未実施 (実機必要):
- IT-61〜68 (実機 E2E、Chrome 拡張ロード + Claude.ai / Kiro で確認)
- リグレッション (cycle-1〜5 主要シナリオ)

---

## 4. 次サイクル (cycle-7) の候補テーマ

### 4.1 cycle-6 で生成された Backlog 項目
`docs/backlog.md` の cycle-6 セクション参照:
- **B-28** [Low] 統計のリセット / クリア UI
- **B-29** [Low] 統計の CSV / JSON エクスポート
- **B-30** [Low] ダッシュボードの任意期間フィルタ
- **B-31** [Low] VS Code 側の集中復帰秒数計測
- **B-32** [Low] 統計デバッグログ OFF
- **B-33** [Low] 余暇種別マッピングの二重管理解消

### 4.2 cycle-1〜5 から継続している Backlog
`docs/backlog.md` 参照 (B-01〜B-27、B-09 は cycle-6 で完了)。特に B-01 (アイコン)、B-02 (デバッグログ OFF)、B-20 (Pattern 撤退判断) は優先度高め。

### 4.3 cycle-7 開始時の推奨フロー
1. **cycle-6 の実機動作確認 (IT-61〜68)** を最初のタスクにするか確認
2. §4.1 / §4.2 から実装テーマを選定
3. 通常の AI-DLC フロー (Inception → Construction) を回す

---

## 5. コードの主要エントリポイント

cycle-7 を始めるにあたり、コードを読み始める順序:

```
[Chrome 拡張側]
1. extension/manifest.json (v0.6.0、web_accessible_resources に portal/* 4 + dashboard/* 4)
2. extension/service_worker.js (cycle-4 で IdeBridge import、cycle-5/6 では無変更)
3. extension/sw/message_router.js (cycle-6 で RESUME_ACTION/RE_LEFT 追加)
4. extension/sw/wait_orchestrator.js (cycle-6 で統計記録呼び出し + 復帰/再離脱ハンドラ追加)
5. extension/sw/tab_manager.js (cycle-4 で windows.update、cycle-6 では無変更)
6. extension/sw/settings_repository.js (無変更)
7. extension/sw/runtime_state.js (cycle-6 で statsPending/statsResumeTargetId 追加)
8. extension/sw/ide_bridge.js (cycle-4 新規、cycle-6 で STATS_RECORD 受信追加)
9. extension/sw/stats_repository.js      ★ cycle-6 新規 (統計 CRUD)
10. extension/sw/leisure_classifier.js   ★ cycle-6 新規 (URL → ジャンル分類)
11. extension/content/claude_site_adapter.js (cycle-6 で復帰/再離脱検知追加)
12. extension/content/* (playback_* は無変更)
13. extension/reader/* (cycle-3、無変更)
14. extension/portal/* (cycle-5、cycle-6 でダッシュボード動線追加)
15. extension/dashboard/                 ★ cycle-6 新規 (4 ファイル)
16. extension/options/* (cycle-6 でダッシュボード動線追加)

[VS Code (Kiro) 拡張側]
17. vscode-extension/src/extension.ts (cycle-4 ベース、cycle-6 で STATS_RECORD 送信追加)
```

cycle-6 のアーキテクチャ全体は `docs/architecture.md` §0、§4、§6、§7、§8 を参照。

---

## 6. archive の参照先

| ディレクトリ | 内容 |
|------------|------|
| `aidlc-docs-waitless-archive/cycle-1/` | cycle-1 (MVP) |
| `aidlc-docs-waitless-archive/cycle-2/` | cycle-2 (遷移先バリエーション拡大) |
| `aidlc-docs-waitless-archive/cycle-3/` | cycle-3 (Reader Page 追加) |
| `aidlc-docs-waitless-archive/cycle-4/` | cycle-4 (Kiro 拡張機能 + IPC 連携) |
| `aidlc-docs-waitless-archive/cycle-5/` | cycle-5 (娯楽ポータルページ追加) |
| `aidlc-docs-waitless-archive/cycle-6/` | cycle-6 (統計ログ + ダッシュボード UI) |

cycle-6 archive で特に有用なファイル (cycle-7 開始時の参考):
- `aidlc-docs-waitless-archive/cycle-6/inception/requirements/requirements.md` — FR-71〜85, NFR-71〜77, M-01〜06 (+ M-07 は Functional Design で追加)
- `aidlc-docs-waitless-archive/cycle-6/inception/application-design/application-design.md` — コンポーネント構成、データスキーマ、論理ユニット
- `aidlc-docs-waitless-archive/cycle-6/construction/stats-feature/functional-design/business-rules.md` — BR-81〜102
- `aidlc-docs-waitless-archive/cycle-6/construction/stats-feature/functional-design/business-logic-model.md` — M-01〜07 算出、記録/集計フロー
- `aidlc-docs-waitless-archive/cycle-6/construction/stats-feature/code/*.md` — 行数 / 改修箇所まとめ (3 サマリ)
- `aidlc-docs-waitless-archive/cycle-6/construction/build-and-test/build-and-test-summary.md` — UT/IT 詳細
- `aidlc-docs-waitless-archive/cycle-6/audit.md` — cycle-6 全工程の監査ログ

---

## 7. AI-DLC 再開時の前提整理

cycle-7 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1〜6 の archive は参照のみ、編集しない
2. **既存 `extension/` のコードは cycle-6 の状態 (version 0.6.0) を継承**
3. **既存 `vscode-extension/` のコードは cycle-6 の状態 (cycle-4 ベース + STATS_RECORD 送信) を継承**
4. **Workspace Detection ステージで Brownfield 判定**
5. **Inception Phase の入力**:
   - `docs/architecture.md` (cycle-6 完了状態)
   - `docs/backlog.md` (cycle-6 完了セクション + B-28〜B-33 含む)
   - `docs/cycle-7-handover.md` (本ドキュメント)
6. **Requirements Analysis でスコープを決める**:
   - cycle-6 で残した検証 (IT-61〜68) を cycle-7 の最初のタスクにするか確認
   - §4.1 / §4.2 からテーマを選定
7. **archive ドキュメントとの整合**:
   - 確定済み BR (BR-01〜37, BR-41〜58, BR-61〜70, BR-71〜80, BR-81〜102) は引き続き有効
   - FR-01〜11 / FR-21〜25 / FR-31〜38 / FR-41〜61 / FR-51〜60 / FR-71〜85 も有効
   - NFR-01〜10 / NFR-21〜29 / NFR-51〜59 / NFR-71〜77 も有効
   - 採番は次サイクルで BR-103〜 / FR-86〜 / NFR-78〜 を使用

### cycle-7 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-6 完了状態 (継承、v0.6.0)
│   ├── dashboard/                     # ★ cycle-6 新規
│   ├── portal/                        # cycle-5 追加
│   ├── reader/                        # cycle-3 追加
│   ├── sw/stats_repository.js         # ★ cycle-6 新規
│   ├── sw/leisure_classifier.js       # ★ cycle-6 新規
│   ├── sw/ide_bridge.js               # cycle-4 新規
│   └── ... (cycle-1〜2 のコア)
├── vscode-extension/                  # cycle-6 完了状態 (cycle-4 ベース + STATS_RECORD)
├── .kiro/hooks/                       # cycle-4 で動作確認済の Hook
├── docs/
│   ├── architecture.md                # cycle-6 完了状態を反映
│   ├── backlog.md                     # cycle-6 末時点 (B-28〜B-33 含む)
│   ├── cycle-3〜6-handover.md          # 履歴
│   └── cycle-7-handover.md            # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-7 で新規作成 (現状は cycle-6 分が残存、archive 化対象)
├── aidlc-docs-tabitabi-archive/
└── aidlc-docs-waitless-archive/
    ├── cycle-1/ 〜 cycle-5/
    └── cycle-6/                       # ★ cycle-6 完了 (2026-05-29 archive 化)
```

cycle-7 完了時には、cycle-7 用の archive (`aidlc-docs-waitless-archive/cycle-7/`) を作る想定。

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md` (cycle-6 完了状態)
- バックログ: `docs/backlog.md` (cycle-6 末時点、B-28〜B-33 含む)
- ユーザー向け (Chrome): `extension/README.md`
- ユーザー向け (VS Code): `vscode-extension/README.md`
- cycle-6 開始時の手引き (履歴): `docs/cycle-6-handover.md`
- cycle-1〜6 archive: `aidlc-docs-waitless-archive/cycle-{1,2,3,4,5,6}/`
