# Cycle-10 Handover (cycle-9 → cycle-10)

このドキュメントは cycle-10 を始める際に最初に読むべき内容をまとめたもの。cycle-1 〜 cycle-9 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-29 (cycle-9 デスクリサーチ ダイジェスト追加完了時点)

---

## 1. cycle-1 〜 cycle-9 で達成したこと

### 1.1 cycle-1 (MVP、2026-05-26 完了)
- WaitLess Chrome 拡張の MVP (16 ファイル、Manifest V3)
- Claude.ai 待ち N秒検知 → 娯楽タブ自動切替 → 完了で AI タブ自動戻り
- 2 パスのタブ探索戦略、動画自動再生 + 完了時一時停止
- Options Page でサイト登録・しきい値設定

### 1.2 cycle-2 (遷移先バリエーション拡大、2026-05-27 完了)
- 動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想) を公式サポート対象に
- v0.2.0

### 1.3 cycle-3 (Reader Page 追加、2026-05-27 完了)
- 拡張機能内蔵の Reader Page (`extension/reader/`) 4 ファイル
- クリックでの既読範囲青色化 + `reader_state` 永続化、v0.3.0

### 1.4 cycle-4 (VS Code (Kiro) 拡張機能 + IPC 連携、2026-05-27〜28 完了)
- VS Code 拡張 (`vscode-extension/` TypeScript ~530 行)
- ローカル WebSocket IPC (`ws://127.0.0.1:39472`)、Kiro Agent Hooks 連携、v0.4.0

### 1.5 cycle-5 (娯楽ポータルページ追加、2026-05-28 完了)
- Chrome 拡張内蔵ポータル (`extension/portal/`) Netflix 風 12 ジャンル × 72 サイト、v0.5.0

### 1.6 cycle-6 (統計ログ + ダッシュボード UI、2026-05-29 完了)
- 統計記録 (`stats_repository.js` / `leisure_classifier.js`) + ダッシュボード (`dashboard/` 4 ファイル)
- 指標 M-01〜M-07、週次トレンド、IDE 統計 IPC 連携、v0.6.0

### 1.7 cycle-7 (待ち時間文脈取り込み — 部分実装、2026-05-29)
> AIDLC プロセスなし

- `context_repository.js` 新規: 遷移先タブから文脈取得 (`captureFromTab`) + AI タブへ反映パネル注入 (`offerReflection`)
- v0.7.0。FR-03/06/08/09 は未実装 (B-34〜B-37)

### 1.8 cycle-8 (エンタメ発見ポップアップ、2026-05-29)
> AIDLC プロセスなし

- `entertainment_ads.js` 新規: ランダム広告風ポップアップ (映画予告 YouTube iframe / 読書)
- `ads_enabled = true` (デフォルト) 時は**既存タブ切替フローを完全スキップ**、v0.8.0

### 1.9 cycle-9 (デスクリサーチ ダイジェスト、2026-05-29)
> AIDLC プロセスなし

cycle-9 のスコープ: **中規模、機能追加 (Bedrock 連携 + ダッシュボード拡張)**

**実装内容**:
- **新規** `extension/sw/bedrock_client.js` (≈ 185 行)
  - Bearer Token / SigV4 両対応の Amazon Bedrock Runtime 軽量クライアント
  - `invoke(prompt, maxTokens)`: `InvokeModel` を直接 fetch
  - `summarizePage(task, ctx)`: タスク文脈を踏まえた 3〜4 点箇条書き要約
- **新規** `extension/sw/research_repository.js` (≈ 77 行)
  - `chrome.storage.local.research_events` に最大 1000 件リングバッファ
  - `appendResearch(event)` / `getAllResearch()`
- **改修** `extension/sw/context_repository.js`
  - 本文抜粋上限 500 → 3000 文字
  - `captureTaskContext(claudeTabId)`: AI タブの会話タイトル + 直近ユーザー発話取得
  - `buildResearchDigest(task, ctx)`: ローカルフォールバック要約
- **改修** `extension/sw/wait_orchestrator.js`: `onCompletionDetected()` にタスク文脈取得 → Bedrock/ローカル要約 → `appendResearch` の記録ブロックを追記
- **改修** `extension/dashboard/{dashboard.html, dashboard.js, dashboard.css}`: 「デスクリサーチ ダイジェスト」セクション追加 (タスク別グルーピング、Bedrock/ローカルバッジ)
- **改修** `extension/options/{options.html, options.js}`: Bedrock 設定 UI + `initBedrockSettings()` 追加
- **改修** `extension/manifest.json`: version `0.8.0` → `0.9.0`

**新規データモデル**:
- `chrome.storage.local.research_events` — `ResearchEvent[]`、最大 1000 件
- `chrome.storage.local.bedrock_config` — `{ region, modelId, bedrockApiKey }`

**コードコメント注意**: `context_repository.js` / `dashboard.*` / `options.*` 内の `// cycle-7` コメントは cycle-9 の実装を指す (誤記、B-43)。

---

## 2. 既知の制限事項 (cycle-9 完了時点)

cycle-1〜8 から継続 (代表的なもの):
- アイコン PNG プレースホルダ (B-01)
- デバッグログ常時 ON 多数 (B-02, B-12, B-27, B-32, B-38, B-42, B-47)
- Claude.ai DOM セレクタの脆さ (B-03)
- 複数ウィンドウ非対応 (B-06)
- cycle-7 文脈取り込みの未完実装 (B-34〜B-37)
- cycle-8 ads 完了連動消去なし (B-40)、`player/` 未使用 (B-41)

cycle-9 で追加された制限:
- **コードコメント誤記** (B-43、`// cycle-7` → `// cycle-9`)
- **ダッシュボードのグループ内は最新ダイジェストのみ表示** (B-44)
- **`research_events` リセット/エクスポート UI なし** (B-45)
- **SigV4 認証の設定 UI 未実装** (B-46)
- **`bedrock_client.js` / `research_repository.js` の DEBUG = true** (B-47)
- **自動テストなし** (cycle-7〜9 は AIDLC 外)

---

## 3. cycle-9 動作確認結果

| 区分 | 内容 | 結果 |
|------|------|------|
| 自動 | 構文チェック | 未実施 |
| 手動 | Bedrock 未設定時のローカルフォールバック | 未実施 |
| 手動 E2E | Claude.ai タスク + 待ち時間 → Bedrock 要約 → ダッシュボード表示 | 未実施 |
| リグレッション | cycle-1〜8 主要シナリオ | 未実施 |

> cycle-10 開始時に実機確認を最初のタスクにするか検討すること。

---

## 4. 次サイクル (cycle-10) の候補テーマ

### 4.1 実機動作確認 (強く推奨)
cycle-7〜9 はいずれも実機 E2E 未実施のまま積み上げてきた。cycle-10 の最初のタスクとして確認することを推奨:
1. `ads_enabled = false` にした上で従来タブ切替フローが正常動作するか
2. `captureFromTab` + `offerReflection` の動作 (cycle-7)
3. エンタメ発見ポップアップの表示・CTA・閉じる動作 (cycle-8)
4. Bedrock 設定後のデスクリサーチ ダイジェスト記録・ダッシュボード表示 (cycle-9)

### 4.2 cycle-9 の残り / 改善 (B-43〜B-47)
- **B-43** [Low] コードコメント `// cycle-7` → `// cycle-9` 修正
- **B-46** [Medium] SigV4 認証の設定 UI 追加
- **B-44** [Low] ダッシュボードの各ページ個別ダイジェスト表示
- **B-45** [Low] `research_events` のリセット / エクスポート UI

### 4.3 cycle-7 の残り実装 (B-34〜B-37)
- **B-34** 多タブ文脈履歴蓄積 / **B-35** 反映形式選択 / **B-36** Options ON/OFF / **B-37** サイクル間クリア

### 4.4 cycle-1〜6 から継続している Backlog
`docs/backlog.md` 参照 (B-01〜B-33)。

### 4.5 cycle-10 開始時の推奨フロー
1. **実機動作確認** (§4.1) を最初のタスクにするか確認
2. §4.2〜4.4 から実装テーマを選定
3. **AIDLC フロー (Inception → Construction) の再開を強く推奨** — cycle-7〜9 が 3 サイクル連続で AIDLC なし実装となっており、要件・設計の文書化が不足している

---

## 5. コードの主要エントリポイント

```
[Chrome 拡張側]
1. extension/manifest.json (v0.9.0)
2. extension/service_worker.js (cycle-4 で IdeBridge import、以降無変更)
3. extension/sw/message_router.js (cycle-6 で RESUME_ACTION/RE_LEFT 追加)
4. extension/sw/wait_orchestrator.js (cycle-7: 文脈取得 / cycle-8: ads / cycle-9: research 記録)
5. extension/sw/entertainment_ads.js  ★ cycle-8 新規
6. extension/sw/context_repository.js ★ cycle-7 新規、cycle-9 で拡張
7. extension/sw/bedrock_client.js      ★ cycle-9 新規
8. extension/sw/research_repository.js ★ cycle-9 新規
9. extension/sw/tab_manager.js (cycle-8 で waitForTabComplete を export)
10. extension/sw/settings_repository.js (無変更)
11. extension/sw/runtime_state.js (cycle-6 で statsPending 追加)
12. extension/sw/ide_bridge.js (cycle-6 で STATS_RECORD 受信追加)
13. extension/sw/stats_repository.js    ★ cycle-6 新規
14. extension/sw/leisure_classifier.js  ★ cycle-6 新規
15. extension/content/claude_site_adapter.js (cycle-6 で復帰/再離脱検知追加)
16. extension/content/* (playback_* は無変更)
17. extension/dashboard/               ★ cycle-6 新規、cycle-9 でリサーチセクション追加
18. extension/portal/                  cycle-5 追加
19. extension/reader/                  cycle-3 追加
20. extension/player/                  ★ cycle-8 新規 (現状未使用)

[VS Code (Kiro) 拡張側]
21. vscode-extension/src/extension.ts (cycle-6 で STATS_RECORD 送信追加)
```

---

## 6. archive の参照先

| ディレクトリ | 内容 |
|------------|------|
| `aidlc-docs-waitless-archive/cycle-1〜6/` | AIDLC フル実行 (要件/設計/テスト文書あり) |
| `aidlc-docs-waitless-archive/cycle-7/` | AIDLC なし (サマリのみ) |
| `aidlc-docs-waitless-archive/cycle-8/` | AIDLC なし (サマリのみ) |
| `aidlc-docs-waitless-archive/cycle-9/` | AIDLC なし (サマリのみ) |

---

## 7. AI-DLC 再開時の前提整理

1. **`aidlc-docs/` を新規作成して始める**
2. **既存 `extension/` は cycle-9 の状態 (version 0.9.0) を継承**
3. **既存 `vscode-extension/` は cycle-6 の状態を継承**
4. **Workspace Detection ステージで Brownfield 判定**
5. **Inception Phase の入力**:
   - `docs/architecture.md` (cycle-9 完了状態)
   - `docs/backlog.md` (cycle-9 完了状態、B-43〜B-47 含む)
   - `docs/cycle-10-handover.md` (本ドキュメント)
6. **採番は次サイクルで BR-103〜 / FR-86〜 / NFR-78〜 を使用**

### cycle-10 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── extension/                         # v0.9.0
│   ├── sw/bedrock_client.js           # ★ cycle-9 新規
│   ├── sw/research_repository.js      # ★ cycle-9 新規
│   ├── sw/entertainment_ads.js        # cycle-8 新規
│   ├── player/                        # cycle-8 新規 (未使用)
│   ├── sw/context_repository.js       # cycle-7 新規、cycle-9 で拡張
│   ├── sw/stats_repository.js         # cycle-6 新規
│   ├── sw/leisure_classifier.js       # cycle-6 新規
│   ├── dashboard/                     # cycle-6 新規、cycle-9 で拡張
│   ├── portal/                        # cycle-5 追加
│   ├── reader/                        # cycle-3 追加
│   └── ...
├── vscode-extension/                  # cycle-6 状態を継承
├── docs/
│   ├── architecture.md                # cycle-9 完了状態
│   ├── backlog.md                     # B-47 まで含む
│   ├── cycle-7-requirements-leisure-context.md
│   ├── cycle-3〜9-handover.md
│   └── cycle-10-handover.md           # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-10 で新規作成
└── aidlc-docs-waitless-archive/
    ├── cycle-1〜6/                     # AIDLC フル
    ├── cycle-7〜9/                     # AIDLC なし、サマリのみ
```

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md` (cycle-9 完了状態)
- バックログ: `docs/backlog.md` (B-47 まで)
- cycle-7 要件定義: `docs/cycle-7-requirements-leisure-context.md`
- ユーザー向け (Chrome): `extension/README.md`
- ユーザー向け (VS Code): `vscode-extension/README.md`
- cycle-9 開始時の手引き (履歴): `docs/cycle-9-handover.md`
- cycle-1〜9 archive: `aidlc-docs-waitless-archive/cycle-{1..9}/`
