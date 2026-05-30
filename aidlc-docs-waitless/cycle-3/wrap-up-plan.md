# cycle-3 Wrap-up Plan

cycle-3 のラップアップ作業を実行する具体的なプラン。各ステップ完了直後に [x] へ更新する。

---

## 確定した方針 (Q&A の結果)

| Q | 回答 | 適用 |
|---|------|------|
| Q1 | A | Manual E2E は T-22 のみ確認、残りは継続検証として archive 内に明記 |
| Q2 | A | バグ記録は code-generation-summary.md と audit.md のみ (既に記録済)、Backlog 等への波及なし |
| Q3 | A | architecture.md は構造維持で必要箇所のみ更新 (cycle 別変更サマリ + コンポーネント + データモデル + 関連ドキュメント参照) |
| Q4 | (Q2=A と整合させて) **A 相当** | backlog.md は cycle-3 完了セクション追加のみ。Tech debt 追加なし、将来拡張候補追加なし |
| Q5 | B | cycle-4-handover.md は Backlog + AI からの推奨候補を明記 |
| Q6 | A | cycle-3-handover.md は履歴として残す、cycle-4-handover.md を新規作成 |
| Q7 | A | archive ディレクトリ名は `aidlc-docs-waitless-archive/cycle-3/` |
| Q8 | B | Git commit は AI 側では作成しない (ユーザー手動) |

---

## 実行ステップ

### Step 1: 静的検証の再確認 (現状のまま archive する前の確認)

- [ ] `getDiagnostics` で extension 配下の修正済ファイルにエラーがないことを再確認 (バグ修正後の状態)
- [ ] options.js の DOMAIN_REGEX が settings_repository.js と一致することを再確認

### Step 2: `docs/architecture.md` の更新 (Q3=A)

cycle-2 で追加した「§0 cycle 別の変更サマリ」表に cycle-3 行を追加。
コンポーネント一覧表に ReaderPage を追加 (cycle-2 で 9 コンポーネント → cycle-3 で 10 コンポーネント)。
データモデル `chrome.storage.local` の保存形式に `reader_state` キーを追加。
関連ドキュメント参照に cycle-3 archive を追加。

- [ ] §0 cycle 別変更サマリに cycle-3 行追加 (Reader Page 追加、version 0.3.0、影響範囲)
- [ ] §4 コンポーネント一覧表に ReaderPage を追加
- [ ] §7 データモデルの「`chrome.storage.local` の保存形式」に `reader_state` を追加
- [ ] §関連ドキュメント参照に cycle-3 archive を追加
- [ ] 最終更新日時を 2026-05-27 (cycle-3 完了時点) に更新

### Step 3: `docs/backlog.md` の更新 (Q4=A 相当)

「cycle-2 で完了した項目」セクションの形式に倣い、「cycle-3 で完了した項目」セクションを末尾に追加。

- [ ] 「cycle-3 で完了した項目」セクションを追加 (cycle-2 セクションの下に並列で記述)
  - Reader Page (extension/reader/) 新規実装
  - ReaderStateSnapshot 永続化
  - DOMAIN_REGEX 拡張 (拡張機能 ID 対応)、validateUrl protocol 拡張 (chrome-extension: 対応)
  - cycle-3 で対応せず継続: B-01〜B-11
- [ ] 最終更新日時を 2026-05-27 (cycle-3 完了時点) に更新
- [ ] 関連ドキュメント参照に cycle-3 archive と cycle-4-handover.md を追加

### Step 4: `docs/cycle-4-handover.md` の新規作成 (Q5=B、Q6=A)

cycle-3-handover.md と同じ構造で、cycle-3 完了 → cycle-4 開始用の handover を作成。

- [ ] §1 cycle-1 / cycle-2 / cycle-3 で達成したこと
- [ ] §2 既知の制限事項 (cycle-3 完了時点)
- [ ] §3 次サイクル (cycle-4) の候補テーマ
  - 既存 Backlog (B-01〜B-11) のリストアップ
  - **AI からの推奨候補** (Q5=B): Reader Page の自動進捗 (スクロール検知)、複数小説管理、UI カスタマイズ、端末間同期 等
- [ ] §4 cycle-3 で残した検証 (Manual E2E T-21, T-23〜T-30 + cycle-1/2 リグレッション T-01〜T-20) を継続検証として明記 (Q1=A)
- [ ] §5 コードの主要エントリポイント (新規 `extension/reader/` を含む 11 番目の項目)
- [ ] §6 archive 参照先 (cycle-1/2/3)
- [ ] §7 AI-DLC 再開時の前提整理

### Step 5: `aidlc-docs/` を `aidlc-docs-waitless-archive/cycle-3/` へ移動 (Q7=A)

- [ ] `mv aidlc-docs aidlc-docs-waitless-archive/cycle-3` を実行
- [ ] 移動成功を確認 (`ls aidlc-docs-waitless-archive/`)
- [ ] `aidlc-docs/` がワークスペース直下に存在しないことを確認

### Step 6: 最終確認

- [ ] `docs/cycle-3-handover.md` がそのまま残っていることを確認 (Q6=A、ユーザー指示)
- [ ] `docs/cycle-4-handover.md` が新規作成されていることを確認
- [ ] `docs/architecture.md` と `docs/backlog.md` が更新されていることを確認
- [ ] `aidlc-docs-waitless-archive/cycle-3/` が存在することを確認
- [ ] `aidlc-docs/` が存在しないことを確認 (move 完了)

### Step 7: Git commit (Q8=B、SKIP)

- [ ] (SKIP) Git commit はユーザー手動で実施

---

## 完了条件

- [ ] Step 1〜6 のすべてが [x]
- [ ] cycle-1, cycle-2, cycle-3 の archive が並んで存在 (`aidlc-docs-waitless-archive/cycle-{1,2,3}/`)
- [ ] `docs/` 配下に architecture.md, backlog.md, cycle-3-handover.md, cycle-4-handover.md が揃う
- [ ] `aidlc-docs/` (ワークスペース直下) は存在しない (cycle-4 で新規作成される予定)
