# cycle-3 Wrap-up Questions

cycle-3 のラップアップ作業 (archive 化、cycle-4 handover 作成、`/docs/` 更新) を進めるにあたり、判断が要るポイントについて質問させてください。各質問の `[Answer]:` に選択肢の文字を記入してください。

---

## Question 1: cycle-3 完了の扱い (Manual E2E の進捗状態)

cycle-3 の Manual E2E 検証は、ユーザー実機で **T-22 (Site 登録) のみ動作確認済**、それ以外 (T-21, T-23〜T-30, および cycle-1/2 リグレッション T-01〜T-20) は未実施の状態です。これを cycle-3 archive にどう記録しますか?

A) **「実装完了、Manual E2E は T-22 のみ確認、残りは継続検証」と明記して archive** — 実態通りに記録。cycle-4 やそれ以降で残検証を続ける形
B) **「実装完了、Manual E2E はユーザー側で随時実施」と汎用的に明記** — 詳細な進捗は記録せず、ユーザー責任で検証する位置づけ
C) **archive 前にユーザーが残シナリオを実施し、結果を反映してから archive** — 完全な検証結果を archive に残したい場合
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2: cycle-3 で発見・修正したバグの記録範囲

Build and Test 中に発見・修正した **options.js の DOMAIN_REGEX 更新漏れバグ** はどう扱いますか?

A) **`code-generation-summary.md` と `audit.md` に記録 (現状)、それ以外への波及は不要** — 既に記録済みなのでそのまま archive
B) **A + Backlog に「Code Generation チェックリストに二重防御整合の確認項目を追加」を Tech debt として記録** — 同種ミスの再発防止
C) **A + cycle-4-handover.md にも「cycle-3 完了直前のバグ修正事例」として明記** — cycle-4 開始時の注意点として
D) **A + B + C すべて**
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3: `docs/architecture.md` の更新範囲

cycle-3 完了に伴う `docs/architecture.md` の更新はどこまで反映しますか?

A) **§0 cycle 別変更サマリに cycle-3 行を追加 + §4 コンポーネント一覧に ReaderPage 追加 + §7 データモデルに reader_state 追加 + 関連ドキュメント参照に cycle-3 archive を追加** — 構造維持で必要箇所のみ更新 (推奨)
B) **A + ファイル/ディレクトリ構成 §8 に `extension/reader/` を追加** — 全セクション網羅
C) **A + B + 既存 §3 レイヤー図を ReaderPage 追加版に書き直し** — 図を含めた完全更新
D) **架構ドキュメントは大きく変えず、cycle-3 の追加情報は handover にだけ書く** — 最小限
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4: `docs/backlog.md` の更新範囲

cycle-3 完了に伴う `docs/backlog.md` の更新はどこまで反映しますか?

A) **「cycle-3 で完了した項目」セクションを追加 (cycle-2 完了で追加した形式に倣う)** — cycle-2 セクションの下に並列で記述
B) **A + バグ修正で見えた Tech debt (Code Generation チェックリスト改善) を新 Backlog 項目 B-12 として追加** (Question 2=B/D を選んだ場合)
C) **A + 読書ページ機能の将来的な拡張候補 (複数小説、UI カスタマイズ、端末間同期等) を Backlog 項目として追加** — cycle-3 アンチスコープを明示的に Backlog 化
D) **A + B + C 全て**
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 5: cycle-4-handover.md の方向性記述

cycle-4-handover.md の §3 (次サイクルの候補テーマ) には、どこまで具体的な方向性を書きますか?

A) **既存 Backlog (B-01〜B-11 + cycle-3 で追加分) のリストアップのみ** — cycle-3-handover と同じ抑制度
B) **A + 「cycle-3 で見えた次の改善候補」を私 (AI) からの推奨として明記** — Reader Page の自動進捗 (例: スクロール検知)、複数小説管理、UI カスタマイズ等を推奨候補として
C) **A + B + 「cycle-3 で残した検証 (Manual E2E)」を最初の cycle-4 タスクとして強調** — Q1=A と整合
D) **何も書かず、ユーザーが cycle-4 開始時に決める** — 完全に open
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 6: archive ディレクトリ命名と既存 cycle-3-handover.md の扱い

ご指示で「既存の cycle-3-handover.md は削除せずに残したまま」とありましたが、認識の確認:

A) **`docs/cycle-3-handover.md` は cycle-2→cycle-3 移行時に作った「cycle-3 開始時の手引き」として履歴的にそのまま残す。新規 `docs/cycle-4-handover.md` を cycle-3→cycle-4 用に新規作成** — 今後 cycle-4 開始時の手引きとなる
B) **`docs/cycle-3-handover.md` は cycle-3 完了時点の状態を反映した内容に更新し、それを cycle-4 開始時の手引きとしても使う (cycle-4-handover.md は不要)** — 統合する案
C) **`docs/cycle-3-handover.md` は削除しないが内容を最新化、それとは別に `docs/cycle-4-handover.md` を cycle-4 用に新規作成** — 両方を最新化

ユーザーの「既存の cycle-3-handover.md は削除せずに残したままで良い」という言い方からは A が最も整合的と推察しますが、念のため。

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7: archive のディレクトリ名

cycle-3 の `aidlc-docs/` を archive に移動する際のディレクトリ名:

A) **`aidlc-docs-waitless-archive/cycle-3/`** — cycle-1, cycle-2 と同じ命名規則 (推奨)
B) その他

[Answer]: A

---

## Question 8: Git commit を作成するかどうか

cycle-3 のラップアップ完了時に、Git commit を作成しますか? (cycle-1/2 完了時の慣行と整合させる)

A) **作成する** — `Cycle-3 wrap-up: archive aidlc-docs (cycle-3) and add /docs cycle-4 handover` のような commit。cycle-1 完了時 commit (`Cycle-1 wrap-up: archive aidlc-docs and add /docs`) と類似形式
B) **作成しない** — ユーザーが手動で commit する
C) **段階を分けて作成 (例: bugfix commit + wrap-up commit)** — DOMAIN_REGEX 修正と wrap-up を分けたい場合
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

回答が完了したら「done」「completed」「終わった」とお知らせください。回答に基づき具体的な実施プラン (`aidlc-docs/wrap-up-plan.md`) を作成します。
