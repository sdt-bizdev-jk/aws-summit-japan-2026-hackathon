# Cycle-9 Handover (cycle-8 → cycle-9)

このドキュメントは cycle-9 を始める際に最初に読むべき内容をまとめたもの。cycle-1 〜 cycle-8 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-29 (cycle-8 エンタメ発見ポップアップ追加完了時点)

---

## 1. cycle-1 〜 cycle-8 で達成したこと

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
- v0.5.0

### 1.6 cycle-6 (統計ログ + ダッシュボード UI、2026-05-29 完了)
- 新規: `stats_repository.js` / `leisure_classifier.js` / `dashboard/` 4 ファイル
- 指標 M-01〜M-07、週次トレンド、VS Code 拡張から IPC 経由で統計送信
- 既存コアファイルは完全無変更 (NFR-71)、v0.6.0

### 1.7 cycle-7 (待ち時間ブラウジング文脈の取り込み — 部分実装、2026-05-29)

> **重要**: このサイクルは AIDLC プロセスを踏まずに実装された。

- 新規 `extension/sw/context_repository.js`
  - `captureFromTab()`: 遷移先タブから URL / タイトル / 見出し / 本文抜粋 / 選択テキスト / リンク取得
  - `buildBedrockSummary()`: ローカルテンプレート整形によるデモ要約 (実際の Bedrock 呼び出しなし)
  - `offerReflection()`: AI タブへ右下固定パネル注入、入力欄への追記
- 改修 `wait_orchestrator.js`: 生成完了時に文脈キャプチャ → パネル提示の呼び出しを追記
- v0.7.0

### 1.8 cycle-8 (エンタメ発見ポップアップ、2026-05-29 完了)

> **重要**: このサイクルは AIDLC プロセスを踏まずに実装された。

cycle-8 のスコープ: **中規模、機能追加 (広告風ポップアップ)**

**実装内容**:
- **新規** `extension/sw/entertainment_ads.js` (≈ 220 行)
  - `ADS[]`: ハードコードのレコメンド 4 件 (映画予告 YouTube 3 本 + 読書 1 件)
  - `pickAd()`: ランダムに 1 件選択 (セレンディピティ)
  - `showAdPopup(tabId)`: タブへポップアップ注入 (best-effort、`waitForTabComplete` → `executeScript`)
  - `injectAdPopup(ad)` (executeScript func): フェード+スケールインで画面中央にモーダル表示。映画は 16:9 iframe (YouTube autoplay+mute)、読書はグラデ+絵文字サムネ。動画 60 秒 / 読書 12 秒で自動消去
- **新規** `extension/player/{player.html, player.js}`: 内蔵プレイヤーページ (現状未使用)
- **改修** `extension/sw/wait_orchestrator.js`: `ads_enabled` チェックを追加。ON 時は既存タブ切替をスキップ
- **改修** `extension/sw/tab_manager.js`: `waitForTabComplete` を `export` に変更
- **改修** `extension/options/{options.html, options.js}`: ON/OFF トグルの追加
- **改修** `extension/manifest.json`: player/* を web_accessible_resources に追加、version `0.7.0` → `0.8.0`

**重要な設計変更**:
`ads_enabled = true`（デフォルト）の場合、`onWaitDetected()` は `RuntimeState.setWaiting(false)` → `showAdPopup(claudeTabId)` → `return` を実行し、**従来のタブ切替フローを完全にスキップする**。

```
ads_enabled = true (デフォルト)  → タブ切替なし、AI タブにポップアップのみ表示
ads_enabled = false              → 従来のタブ切替フロー (cycle-1〜7 の挙動)
```

---

## 2. 既知の制限事項 (cycle-8 完了時点)

cycle-1〜7 から継続:
- アイコン PNG プレースホルダ (B-01)
- デバッグログ常時 ON (B-02, B-12, B-27, B-32, B-38)
- Claude.ai DOM セレクタの脆さ (B-03)
- 複数ウィンドウ非対応 (B-06)
- cycle-4: macOS 限定、Kiro IDE 限定、ポート 39472 ハードコード
- 統計のリセット / エクスポート / 任意期間フィルタ未実装 (B-28, B-29, B-30)
- VS Code 側の集中復帰秒数未計測 (B-31)
- 余暇種別マッピングの二重管理 (B-33)
- 文脈取り込みの多タブ履歴 / 形式選択 / Options 設定 / サイクル間クリア未実装 (B-34〜B-37)

cycle-8 で追加された制限:
- **レコメンドがハードコード 4 件のみ** (B-39)
- **AI 生成完了後もポップアップが残る** (B-40、自動消去 60 秒まで。completion 連動での自動消去未実装)
- **`player/player.html|js` が未使用** (B-41)
- **`entertainment_ads.js` のデバッグログ常時 ON** (B-42、`DEBUG = true`)
- **自動テストなし** (cycle-8 も AIDLC 外)

---

## 3. cycle-8 動作確認結果

| 区分 | 内容 | 結果 |
|------|------|------|
| 自動 | 構文チェック | 未実施 |
| 手動 E2E | Claude.ai で待ち時間発生 → ポップアップ表示 → 動画再生 / CTA / 閉じる | 未実施 |
| リグレッション | cycle-1〜7 主要シナリオ | 未実施 |

> cycle-9 開始時に実機確認を最初のタスクにするか検討すること。

---

## 4. 次サイクル (cycle-9) の候補テーマ

### 4.1 cycle-8 の残り / 改善 (B-39〜B-42)
- **B-40** [Medium] AI 完了連動でポップアップを自動消去
- **B-39** [Medium] レコメンドの動的化 (件数増・ジャンル多様化)
- **B-41** [Low] player.html|js の活用または削除
- **B-42** [Low] `entertainment_ads.js` の DEBUG = false 化

### 4.2 cycle-7 の残り実装 (B-34〜B-38)
cycle-7 で未実装だった文脈取り込み機能の完成も引き続き候補。

### 4.3 cycle-6〜1 から継続している Backlog
`docs/backlog.md` 参照 (B-01〜B-33)。

### 4.4 cycle-9 開始時の推奨フロー
1. **cycle-7/8 の実機動作確認**を最初のタスクにするか確認
2. §4.1〜4.3 から実装テーマを選定
3. 今度は AIDLC フロー (Inception → Construction) を回すことを検討

---

## 5. コードの主要エントリポイント

cycle-9 を始めるにあたり、コードを読み始める順序:

```
[Chrome 拡張側]
1. extension/manifest.json (v0.8.0)
2. extension/service_worker.js (cycle-4 で IdeBridge import、以降無変更)
3. extension/sw/message_router.js (cycle-6 で RESUME_ACTION/RE_LEFT 追加)
4. extension/sw/wait_orchestrator.js (cycle-7: 文脈キャプチャ / cycle-8: ads チェック 追加)
5. extension/sw/entertainment_ads.js  ★ cycle-8 新規
6. extension/sw/context_repository.js ★ cycle-7 新規
7. extension/sw/tab_manager.js (cycle-8 で waitForTabComplete を export 化)
8. extension/sw/settings_repository.js (無変更)
9. extension/sw/runtime_state.js (cycle-6 で statsPending 追加)
10. extension/sw/ide_bridge.js (cycle-6 で STATS_RECORD 受信追加)
11. extension/sw/stats_repository.js    ★ cycle-6 新規
12. extension/sw/leisure_classifier.js  ★ cycle-6 新規
13. extension/content/claude_site_adapter.js (cycle-6 で復帰/再離脱検知追加)
14. extension/content/* (playback_* は無変更)
15. extension/reader/* (cycle-3、無変更)
16. extension/portal/* (cycle-5、cycle-6 でダッシュボード動線追加)
17. extension/dashboard/               ★ cycle-6 新規
18. extension/player/                  ★ cycle-8 新規 (現状未使用)

[VS Code (Kiro) 拡張側]
19. vscode-extension/src/extension.ts (cycle-6 で STATS_RECORD 送信追加)
```

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
| `aidlc-docs-waitless-archive/cycle-7/` | cycle-7 (文脈取り込み — AIDLC なし、サマリのみ) |
| `aidlc-docs-waitless-archive/cycle-8/` | cycle-8 (エンタメ発見ポップアップ — AIDLC なし、サマリのみ) |

---

## 7. AI-DLC 再開時の前提整理

cycle-9 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1〜8 の archive は参照のみ、編集しない
2. **既存 `extension/` のコードは cycle-8 の状態 (version 0.8.0) を継承**
3. **既存 `vscode-extension/` のコードは cycle-6 の状態を継承**
4. **Workspace Detection ステージで Brownfield 判定**
5. **Inception Phase の入力**:
   - `docs/architecture.md` (cycle-8 完了状態)
   - `docs/backlog.md` (cycle-8 完了状態、B-39〜B-42 含む)
   - `docs/cycle-9-handover.md` (本ドキュメント)
6. **Requirements Analysis でスコープを決める**:
   - cycle-7/8 の実機動作確認を最初のタスクにするか確認
   - §4.1〜4.3 からテーマを選定
7. **採番は次サイクルで BR-103〜 / FR-86〜 / NFR-78〜 を使用**

### cycle-9 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-8 完了状態 (継承、v0.8.0)
│   ├── sw/entertainment_ads.js        # ★ cycle-8 新規
│   ├── player/                        # ★ cycle-8 新規 (未使用)
│   ├── sw/context_repository.js       # cycle-7 新規
│   ├── sw/stats_repository.js         # cycle-6 新規
│   ├── sw/leisure_classifier.js       # cycle-6 新規
│   ├── sw/ide_bridge.js               # cycle-4 新規
│   ├── dashboard/                     # cycle-6 新規
│   ├── portal/                        # cycle-5 追加
│   ├── reader/                        # cycle-3 追加
│   └── ... (cycle-1〜2 のコア)
├── vscode-extension/                  # cycle-6 完了状態を継承
├── .kiro/hooks/                       # cycle-4 で動作確認済の Hook
├── docs/
│   ├── architecture.md                # cycle-8 完了状態を反映
│   ├── backlog.md                     # cycle-8 末時点 (B-39〜B-42 含む)
│   ├── cycle-7-requirements-leisure-context.md
│   ├── cycle-3〜8-handover.md          # 履歴
│   └── cycle-9-handover.md            # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-9 で新規作成
├── aidlc-docs-tabitabi-archive/
└── aidlc-docs-waitless-archive/
    ├── cycle-1/ 〜 cycle-6/
    ├── cycle-7/                       # AIDLC なし、サマリのみ
    └── cycle-8/                       # AIDLC なし、サマリのみ
```

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md` (cycle-8 完了状態)
- バックログ: `docs/backlog.md` (cycle-8 末時点、B-39〜B-42 含む)
- cycle-7 要件定義: `docs/cycle-7-requirements-leisure-context.md`
- ユーザー向け (Chrome): `extension/README.md`
- ユーザー向け (VS Code): `vscode-extension/README.md`
- cycle-8 開始時の手引き (履歴): `docs/cycle-8-handover.md`
- cycle-1〜8 archive: `aidlc-docs-waitless-archive/cycle-{1,2,3,4,5,6,7,8}/`
