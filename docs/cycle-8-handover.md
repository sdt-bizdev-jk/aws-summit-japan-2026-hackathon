# Cycle-8 Handover (cycle-7 → cycle-8)

このドキュメントは cycle-8 を始める際に最初に読むべき内容をまとめたもの。cycle-1 〜 cycle-7 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-29 (cycle-7 待ち時間文脈取り込み 部分実装完了時点)

---

## 1. cycle-1 〜 cycle-7 で達成したこと

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
- 新規: `stats_repository.js` / `leisure_classifier.js` / `dashboard/` 4 ファイル
- 指標 M-01〜M-07 (待ち時間・娯楽滞在・離脱継続率・集中復帰秒数等)、週次トレンド
- VS Code 拡張から IPC 経由で統計送信
- 既存 tab_manager / settings_repository / service_worker / reader/* / playback_*.js は完全無変更 (NFR-71)、v0.6.0

### 1.7 cycle-7 (待ち時間ブラウジング文脈の取り込み — 部分実装、2026-05-29)

> **重要**: このサイクルは AIDLC プロセスを踏まずに実装された。

cycle-7 のスコープ: **小規模、機能追加 (文脈取り込み MVP)**

**実装内容**:
- **新規** `extension/sw/context_repository.js` (≈ 240 行)
  - `captureFromTab(tabId)`: 遷移先タブから可視コンテンツを取得 (URL / タイトル / 見出し h1〜h3 最大 8 件 / 本文抜粋 500 文字 / 選択テキスト / リンク最大 10 件)
  - `buildBedrockSummary(ctx)`: ローカルでの箇条書き整形 (選択テキスト優先 → 見出し → リンク → 抜粋。実際の Bedrock API 呼び出しなし)
  - `offerReflection(claudeTabId, ctx, summary)`: Claude.ai タブへ右下固定パネルを注入。「AI入力欄に反映」で入力欄へ追記 (ProseMirror / textarea 両対応、フォールバックはクリップボード)。30 秒で自動消去
- **改修** `extension/sw/wait_orchestrator.js`: `onCompletionDetected` に文脈キャプチャ → パネル提示の呼び出しを追記 (best-effort、3 箇所)
- **改修** `extension/manifest.json`: version `0.6.0` → `0.7.0`

**未実装 (B-34〜B-37)**:
- 複数タブ跨ぎの文脈履歴蓄積 (FR-03)
- 反映形式の選択 UI (FR-06)
- Options Page の ON/OFF トグル (FR-08)
- 次サイクル開始時の文脈クリア (FR-09)

---

## 2. 既知の制限事項 (cycle-7 完了時点)

cycle-1〜6 から継続:
- アイコン PNG プレースホルダ (B-01)
- デバッグログ常時 ON (B-02, B-12, B-27, B-32)
- Claude.ai DOM セレクタの脆さ (B-03)
- 複数ウィンドウ非対応 (B-06)
- cycle-4: macOS 限定、Kiro IDE 限定、ポート 39472 ハードコード
- 統計のリセット / エクスポート / 任意期間フィルタ未実装 (B-28, B-29, B-30)
- VS Code 側の集中復帰秒数未計測 (B-31)
- 余暇種別マッピングの二重管理 (B-33)

cycle-7 で追加された制限:
- **文脈履歴が最後の 1 タブのみ** (B-34、FR-03 未実装)
- **反映形式がハードコード要約固定** (B-35、FR-06 未実装。Bedrock バッジはデモ表示のみ、実際は非 Bedrock)
- **Options Page の ON/OFF トグルなし** (B-36、FR-08 未実装。現状は常に有効)
- **次サイクル間での文脈クリア未実装** (B-37、FR-09 未実装)
- **`context_repository.js` のデバッグログ常時 ON** (B-38、`DEBUG = true`)
- **自動テストなし** (cycle-7 は AIDLC 外での実装のため、単体テストスクリプト未作成)

---

## 3. cycle-7 動作確認結果

| 区分 | 内容 | 結果 |
|------|------|------|
| 自動 | 構文チェック (`node --check`) | 未実施 |
| 手動 E2E | Claude.ai + 遷移先タブでのキャプチャ → パネル表示 → 反映 | 未実施 |
| リグレッション | cycle-1〜6 主要シナリオ | 未実施 |

> cycle-8 開始時に実機確認を最初のタスクにするか検討すること。

---

## 4. 次サイクル (cycle-8) の候補テーマ

### 4.1 cycle-7 の残り実装 (B-34〜B-38)

最優先で cycle-7 の未実装部分を完成させる選択肢:
- **B-34** [Medium] 多タブ文脈履歴の蓄積 (`chrome.storage.session` + 時系列リスト)
- **B-35** [Medium] 反映形式選択 UI (原文抜粋 / リンク一覧 / Bedrock 要約)
- **B-36** [Medium] Options Page の ON/OFF トグル + 設定
- **B-37** [Low] 次サイクル開始時の文脈クリア (FR-09)
- **B-38** [Low] `context_repository.js` の `DEBUG = false` 化

### 4.2 cycle-6 から継続している Backlog
`docs/backlog.md` 参照 (B-01〜B-33)。特に B-01 (アイコン)、B-02 (デバッグログ OFF)、B-33 (余暇種別マッピング単一ソース化) が優先度高め。

### 4.3 cycle-8 開始時の推奨フロー
1. **cycle-7 の実機動作確認**を最初のタスクにするか確認 (特に `captureFromTab` + `offerReflection`)
2. §4.1 / §4.2 から実装テーマを選定
3. 今度は AIDLC フロー (Inception → Construction) を回す

---

## 5. コードの主要エントリポイント

cycle-8 を始めるにあたり、コードを読み始める順序:

```
[Chrome 拡張側]
1. extension/manifest.json (v0.7.0)
2. extension/service_worker.js (cycle-4 で IdeBridge import、以降無変更)
3. extension/sw/message_router.js (cycle-6 で RESUME_ACTION/RE_LEFT 追加)
4. extension/sw/wait_orchestrator.js (cycle-7 で文脈キャプチャ + パネル提示追加)
5. extension/sw/context_repository.js  ★ cycle-7 新規
6. extension/sw/tab_manager.js (cycle-4 で windows.update、以降無変更)
7. extension/sw/settings_repository.js (無変更)
8. extension/sw/runtime_state.js (cycle-6 で statsPending 追加)
9. extension/sw/ide_bridge.js (cycle-6 で STATS_RECORD 受信追加)
10. extension/sw/stats_repository.js    ★ cycle-6 新規
11. extension/sw/leisure_classifier.js  ★ cycle-6 新規
12. extension/content/claude_site_adapter.js (cycle-6 で復帰/再離脱検知追加)
13. extension/content/* (playback_* は無変更)
14. extension/reader/* (cycle-3、無変更)
15. extension/portal/* (cycle-5、cycle-6 でダッシュボード動線追加)
16. extension/dashboard/               ★ cycle-6 新規

[VS Code (Kiro) 拡張側]
17. vscode-extension/src/extension.ts (cycle-6 で STATS_RECORD 送信追加)
```

cycle-7 の文脈取り込みアーキテクチャは `aidlc-docs-waitless-archive/cycle-7/cycle-summary.md` と `docs/cycle-7-requirements-leisure-context.md` を参照。

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

cycle-7 archive で参照できるファイル:
- `aidlc-docs-waitless-archive/cycle-7/cycle-summary.md` — 実装内容・未実装・制限事項

---

## 7. AI-DLC 再開時の前提整理

cycle-8 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1〜7 の archive は参照のみ、編集しない
2. **既存 `extension/` のコードは cycle-7 の状態 (version 0.7.0) を継承**
3. **既存 `vscode-extension/` のコードは cycle-6 の状態を継承**
4. **Workspace Detection ステージで Brownfield 判定**
5. **Inception Phase の入力**:
   - `docs/architecture.md` (cycle-7 完了状態)
   - `docs/backlog.md` (cycle-7 完了状態、B-34〜B-38 含む)
   - `docs/cycle-8-handover.md` (本ドキュメント)
   - `docs/cycle-7-requirements-leisure-context.md` (cycle-7 要件、未実装 FR の把握に)
6. **Requirements Analysis でスコープを決める**:
   - cycle-7 の実機動作確認 (captureFromTab / offerReflection) を最初のタスクにするか確認
   - cycle-7 の残り実装 (B-34〜B-37) を続けるか、別テーマに切り替えるかを決定
7. **採番は次サイクルで BR-103〜 / FR-86〜 / NFR-78〜 を使用**

### cycle-8 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-7 完了状態 (継承、v0.7.0)
│   ├── sw/context_repository.js       # ★ cycle-7 新規
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
│   ├── architecture.md                # cycle-7 完了状態を反映
│   ├── backlog.md                     # cycle-7 末時点 (B-34〜B-38 含む)
│   ├── cycle-7-requirements-leisure-context.md
│   ├── cycle-3〜7-handover.md          # 履歴
│   └── cycle-8-handover.md            # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-8 で新規作成
├── aidlc-docs-tabitabi-archive/
└── aidlc-docs-waitless-archive/
    ├── cycle-1/ 〜 cycle-6/
    └── cycle-7/                       # ★ cycle-7 完了 (AIDLC なし、サマリのみ)
```

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md` (cycle-7 完了状態)
- バックログ: `docs/backlog.md` (cycle-7 末時点、B-34〜B-38 含む)
- cycle-7 要件定義: `docs/cycle-7-requirements-leisure-context.md`
- ユーザー向け (Chrome): `extension/README.md`
- ユーザー向け (VS Code): `vscode-extension/README.md`
- cycle-7 開始時の手引き (履歴): `docs/cycle-7-handover.md`
- cycle-1〜7 archive: `aidlc-docs-waitless-archive/cycle-{1,2,3,4,5,6,7}/`