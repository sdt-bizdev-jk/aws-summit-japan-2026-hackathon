# Handover & Archive — 確認質問

cycle-1 の最後にメンテナンス用ドキュメント `docs/` の作成と、`aidlc-docs/` のアーカイブ、cycle-2 への handover を行う前に、いくつか確認させてください。

各 `[Answer]:` の右に英字 (A, B, ...) を記入してください。X) Other を選ぶ場合は `[Answer]:` の後ろに自由記述を続けてください。

---

## Q1: `/docs` に何を残すか (ドキュメント選定)

メンテナンスを続ける上で参照頻度が高いものを `/docs` に残したいです。AI-DLC の成果物 (要件、設計、計画、ステータス、監査ログ) は cycle-1 の文脈に強く紐づくのでアーカイブ寄り、ユーザー向けや開発者向けの実用文書は `/docs` に独立、という整理を提案します。

A) **薄く実用的な構成** (推奨): 以下の 4 種類のみ残す
   - `docs/README.md` (`/docs` の索引)
   - `docs/architecture.md` (アーキテクチャ概観 — Application Design の要点を抜粋)
   - `docs/component-reference.md` (9 コンポーネントとファイル対応表 — Functional Design の要点を抜粋)
   - `docs/dev-guide.md` (開発手順 = Unpacked ロード、再ロード、よくあるエラー、デバッグログ — build-instructions.md ベース)

B) **網羅的な構成**: A に加えて以下も残す
   - `docs/requirements.md` (要件サマリ — `requirements.md` を縮約)
   - `docs/business-rules.md` (BR-01〜22 の一覧)
   - `docs/data-model.md` (Site/Settings/RuntimeState/Message のスキーマ — domain-entities.md を縮約)
   - `docs/troubleshooting.md` (整合 + Claude.ai DOM 変更時の対処)

C) **最小構成**: `docs/README.md` と `docs/dev-guide.md` のみ (`extension/README.md` をユーザー向け、`docs/dev-guide.md` を開発者向けに分担)

X) Other (please describe after [Answer]: tag below)

[Answer]: `docs/architecture.md`, `docs/backlog.md`の2つでいい

参考: 私の推奨は **B**。今回の経験で BR (業務ルール) と data-model がメンテで参照しやすく、トラブルシュートも実機検証で価値があったため。ただし「軽く保ちたい」なら A、「`README.md` で十分」なら C も合理的です。

---

## Q2: ドキュメントの記述スタイル

A) **コピー縮約**: aidlc-docs から要点を抜粋して `/docs/*.md` を新規作成 (一次資料として完結)
B) **リンク参照**: `/docs/*.md` には概要のみ書き、詳細は `aidlc-docs-waitless-archive/cycle-1/` への参照リンクで誘導
C) **両者ハイブリッド**: 主要内容はコピー (オフラインでも読める)、補足は archive にリンク

X) Other (please describe after [Answer]: tag below)

[Answer]: A, /docs/backlog.mdを更新せよ

参考: 私の推奨は **A**。`/docs` を見れば理解できる完結性が大事で、archive は「過去サイクルの記録」として保管。

---

## Q3: cycle-2 handover の中身 (`docs/cycle-2-handover.md` ではなく `aidlc-docs/`配下じゃない方を確認)

ご指示は `docs/cycle-2-handover.md` での作成ですが念のため確認:

A) `docs/cycle-2-handover.md` (ご指示通り) — 新サイクル開始時にここを参照
B) `aidlc-docs-waitless-archive/cycle-1/cycle-2-handover.md` (archive 内に置く)
C) 両方 (`docs/` と archive の両方に同内容)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: 私の推奨は **A** (ご指示通り)。`/docs` は新サイクルでも参照するため。

---

## Q4: handover に何を含めるか

cycle-2 を始める人 (= ご自身) が立ち上がりやすいよう、以下を含めるプランです。不要なものや追加要望があれば教えてください:

含める予定:
- 1. **cycle-1 で達成したこと** (実装範囲、動作確認できたシナリオ、新規 / 修正の決定)
- 2. **既知の制限事項** (アイコン PNG プレースホルダ、Claude.ai DOM の脆さ、オートプレイポリシー、デバッグログ常時 ON など)
- 3. **未実装 (best-effort / 最小限) のもの** (US-03 best-effort、US-06 最小限)
- 4. **次サイクルの候補テーマ** (cycle-1 中に出た「次サイクル候補」一覧)
- 5. **cycle-1 中に行った仕様の調整** (Q&A の各種修正、2パス探索化、PlaybackPause 追加など)
- 6. **コードの主要エントリポイント** (どこから読み始めるか)
- 7. **archive の参照先** (詳細は `aidlc-docs-waitless-archive/cycle-1/` を見てね、という案内)
- 8. **AI-DLC 再開時の前提整理** (前サイクルとの関係、 `aidlc-docs/` を新規作成して始める旨)

A) 全部入りで OK (上記 8項目すべて)
B) 1, 2, 3, 4, 6 のみ (シンプル化、ストーリー寄り)
C) 全部入り + 「個人的に気になっている改善案」セクション (将来の意思を明文化)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: 私の推奨は **A** または **C**。次サイクル開始時に context が立ち上がる情報源として全部あった方が安全。

---

## Q5: アーカイブの方法

ご指示は `aidlc-docs-waitless-archive/cycle-1/` に格納とのことですが、`git mv` で履歴を保つ点を確認:

A) `git mv aidlc-docs aidlc-docs-waitless-archive/cycle-1` で履歴保持 (前回の「たびたび」アーカイブと同じ手法)
B) コピー + 削除 (履歴は失う)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: 私の推奨は **A** (前回の archive との一貫性、Git 履歴保持のため)。

---

## Q6: 既存の `aidlc-docs-tabitabi-archive/` との並び

過去のサイクルで `aidlc-docs-tabitabi-archive/` という命名がありました。今回 `aidlc-docs-waitless-archive/cycle-1/` という命名でよいか確認:

A) ご指示通り `aidlc-docs-waitless-archive/cycle-1/` (cycle-N サブディレクトリで分ける) — 同プロジェクトで複数サイクルを想定
B) `aidlc-docs-waitless-archive/` 直下に格納 (`tabitabi-archive` と同じ階層形)
C) 統一して `aidlc-docs-archive/waitless/cycle-1/` (大文字なし、プロジェクト名サブディレクトリ)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: 私の推奨は **A** (ご指示通り)。「同プロジェクト内で複数サイクル」想定が cycle-N サブで明確。

---

## Q7: extension/README.md の扱い

`extension/README.md` (ユーザー向けインストール手順) は `extension/` の一部として残し、`/docs/` には複製しない方針でよいか:

A) `extension/README.md` はそのまま `extension/` 配下に維持、`/docs/` には別途開発者向けの `dev-guide.md` を置く (役割分担)
B) `extension/README.md` を `/docs/install.md` に移動し、`extension/README.md` は短いリンクのみに

X) Other (please describe after [Answer]: tag below)

[Answer]: X, 作らないでいい

参考: 私の推奨は **A**。Chrome Web Store 申請時にも `extension/README.md` が拡張機能パッケージ内にあると便利。

---

## まとめ

回答後、AI 側で曖昧性を分析し、必要なら follow-up を出します。曖昧性なしと判定でき次第、**実行プラン** を提示し承認を得てから:

1. `/docs/` 配下のドキュメント生成
2. `/docs/cycle-2-handover.md` 生成
3. `git mv` で `aidlc-docs/` を `aidlc-docs-waitless-archive/cycle-1/` に退避

の順で実行します。
