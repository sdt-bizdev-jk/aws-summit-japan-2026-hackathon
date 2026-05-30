# Handover Clarification

Q2 の「`docs/backlog.md` を更新せよ」の意図を確認させてください。

## CQ-A: `docs/backlog.md` の中身

`docs/backlog.md` をどんな内容で作りますか?

A) **次サイクル候補 (バックログ) のみ** — cycle-1 中に出た「次サイクルでやるかも」候補を箇条書きで。優先度なし、軽量
B) **バックログ + 既知の制限事項 + 改善アイデア** — 「やるかもしれない」を網羅的に集約。優先度ラベル付き
C) **バックログ + 既知の制限 + handover 内容の一部 (主に Q4 の項目 4=次サイクル候補)** — handover とバックログの一部重複を許容
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: 私の推奨は **B**。バックログを「次にやることリスト」として活きた状態に保ちたいなら、見出しレベルで整理 (Backlog Items / Known Limitations / Improvement Ideas) が一番運用しやすい。

---

## CQ-B: バックログ項目の優先度ラベル

A) **不要** — 順序のみで十分 (上から順に重要)
B) **3段階** — `[High] / [Medium] / [Low]` のタグ
C) **タイプ別** — `[Bug fix] / [Feature] / [Tech debt] / [Doc]` のタグ
D) BとC両方

X) Other (please describe after [Answer]: tag below)

[Answer]: D

参考: 私の推奨は **D**。優先度とタイプの両方が一目で分かると、cycle-2 の Inception 開始時にスコープ選定しやすい。

---

## CQ-C: `docs/architecture.md` の粒度

A) **薄め** (1〜2 ページ程度) — 3層構成 + 9コンポーネント要約 + データフロー 1図
B) **しっかりめ** (3〜5 ページ程度) — 上記 + メッセージタイプ表 + データモデル要約 + ファイル構成

X) Other (please describe after [Answer]: tag below)

[Answer]: B

参考: 私の推奨は **B**。コンポーネント設計を理解するには、メッセージタイプとファイル構成までは欲しい。
