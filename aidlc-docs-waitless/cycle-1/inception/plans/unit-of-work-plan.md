# Unit of Work Plan — WaitLess

**ステージ**: INCEPTION - Units Generation (Part 1: Planning)
**ステータス**: 質問への回答待ち

---

## 1. 目的
WaitLess (Chrome 拡張機能、9 コンポーネント、6 ストーリー) を、開発のための「ユニット (作業単位)」へ分解する。本サイクルでは Construction で **1ユニット** だけを実装する方針 (Q10) のため、ユニット選定もここで決める。

## 2. 入力
- `aidlc-docs/inception/application-design/components.md` (9 コンポーネント)
- `aidlc-docs/inception/application-design/component-dependency.md` (依存関係)
- `aidlc-docs/inception/user-stories/stories.md` (US-01 〜 06)
- `aidlc-docs/inception/plans/execution-plan.md`

## 3. 想定する成果物 (Part 2 で生成)
- `aidlc-docs/inception/application-design/unit-of-work.md` — ユニット定義 (名前、含むストーリー/コンポーネント、責務)
- `aidlc-docs/inception/application-design/unit-of-work-dependency.md` — ユニット間依存マトリクス
- `aidlc-docs/inception/application-design/unit-of-work-story-map.md` — ストーリー → ユニット マッピング

---

## 4. 計画チェックリスト (Part 1: Planning)

- [x] components.md / component-dependency.md / stories.md を再読
- [x] ユニット分割粒度を決定 (Q1=A: 1ユニット)
- [x] ユニット間依存の許容スタイルを決定 (Q1=A 前提で N/A)
- [x] ストーリーのカバレッジ方針を決定 (Q3=B: コアループ + 設定UI)
- [x] 本サイクルで実装する 1ユニットの選定基準を決定 (Q1=A 前提で自動: 唯一のユニット)
- [x] Greenfield コード組織方針を決定 (Q5=A: Application Design そのまま)
- [x] 全 [Answer]: タグへの回答を取得 (Q2/Q4 は Q1=A 前提で空欄のまま正)
- [x] 回答の曖昧性分析、必要なら follow-up → 曖昧性なし
- [x] プラン承認を得る ✅

## 5. 計画チェックリスト (Part 2: Generation, 承認後実施)

- [x] 承認された方針に沿って `unit-of-work.md` を生成
- [x] `unit-of-work-dependency.md` を生成 (依存マトリクス)
- [x] `unit-of-work-story-map.md` を生成 (ストーリーマッピング、全カバレッジ確認)
- [x] `unit-of-work.md` 内に「コード組織方針」セクションを記載 (Greenfield)
- [x] aidlc-state.md 更新
- [ ] 完了メッセージ提示、承認 ← **次**

---

## 6. 質問 (Part 1)

各質問の `[Answer]:` の右に英字を記入してください。X) Other を選ぶ場合は `[Answer]:` の後ろに自由記述を続けてください。

### Q1: ユニット分割の粒度

ハッカソン規模 + 9 コンポーネント + 6 ストーリーをどう分割しますか?

A) **1ユニット (シングル)** — 全部を 1ユニットとして扱う。Construction でこの 1ユニットを完全実装する形。「シンプル最強」、ユニット間依存ゼロ
B) **2ユニット (バックエンド系 / UI系)** — Service Worker 5モジュール + Content Scripts 2 + アイコン を「コア」、Options Page 2 を「設定UI」に分割。本サイクルでは「コア」だけ実装してデモ可能
C) **3ユニット (検知 / 切替 / 設定)** — ClaudeSiteAdapter を「検知」、TabManager + WaitOrchestrator + RuntimeState を「切替」、SettingsRepository + Options を「設定」に分割
D) **ストーリー単位** — US-01〜US-06 を各ユニットとする (6ユニット)。ハッカソン文脈ではオーバースプリット
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: 規模感 (推定 3〜5.5時間) と「1ユニットだけ実装」方針からは A が最もシンプル、B もデモに必要な範囲を切り出せて合理的です。

---

### Q2: ユニット間依存の許容スタイル

複数ユニットに分かれた場合、ユニット間でどんな依存を許容しますか? (Q1=A の場合は無視可)

A) ユニット間依存なし (各ユニットが完全独立、独立にビルド/動作可能)
B) 上位 → 下位の一方向のみ許容 (例: UI ユニット → コア ユニット を呼び出すのは OK)
C) コンポーネント設計に従う (Application Design の依存マトリクスをそのままユニットレベルにも適用)
X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

### Q3: ストーリーのカバレッジ方針

US-01 〜 06 のうち、どれを「本サイクル (1ユニット実装)」で動かしますか?

A) **コアループのみ (US-01 + US-02 + US-04)** — 「待ち発生 → 娯楽タブ切替 → AIタブ戻り」の最小デモ。US-03 (動画自動再生) は best-effort 程度、US-05/06 (設定UI) はストレージ直接編集で代用
B) **コアループ + 設定UI (US-01 + US-02 + US-04 + US-05)** — 設定UIまで含めてユーザーが触れるMVPを目指す。US-03 は best-effort、US-06 は省略
C) **全ストーリー (US-01 〜 06)** — フルMVPを 1ユニットに含めて完全実装
X) Other (please describe after [Answer]: tag below)

[Answer]: B

参考: 1ユニットの推定実装時間 (1〜2時間 + 設計 0.5〜1) を考慮すると A か B がリアル。C は時間がやや厳しいが Q1=A の場合は実質 C と同じ。

---

### Q4: 1ユニットの選定基準

Construction で実装する 1 ユニットをどう選びますか? (Q1=A の場合は「その 1ユニット」が自動的に対象)

A) **ストーリーカバー優先** — Q3 の答えに合わせて、必要なストーリーを最も含むユニットを選ぶ
B) **依存ルート優先** — 依存関係グラフでもっとも下位 (依存先がない) のユニットから着手
C) **デモインパクト優先** — 動かして見て感動が大きいユニットを選ぶ
D) ユニット分割が出揃った時点で改めて判断
X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

### Q5: Greenfield のコード組織方針

要件 §6 の構成 (`extension/` 配下) を改めて確認します。Construction でどの単位でディレクトリを作成しますか?

A) Application Design のファイル構成をそのまま採用 (`extension/manifest.json`, `extension/sw/`, `extension/content/`, `extension/options/`, `extension/assets/`)
B) ユニット境界に合わせてディレクトリも分ける (例: 2ユニットなら `extension/core/` と `extension/options-ui/` のような分け方)
C) 1 ユニットだけ実装する場合、最小限のファイル群だけまず作る (manifest.json + service_worker.js + content/claude_site_adapter.js + options のスタブ等)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: Chrome 拡張は 1 つの manifest.json から動かす単一パッケージなので、A の物理構成は固定にし、論理的なユニット境界は別途明示する形が無難です。

---

## 7. AI からの推奨案 (参考)

- **Q1: A (1ユニット)** — ハッカソン規模、9 コンポーネントが密に連携する単一拡張機能、ユニット分割の管理コストが規模に見合わない
- **Q2: A (該当なし、Q1=A 前提)** — 単一ユニットなので依存問題は内部のコンポーネント設計に閉じる
- **Q3: A (コアループのみ)** または **B (+設定UI)** — 動かして体験できる範囲を確保。設計判断: 設定UIなしでもストレージ直接編集 (chrome://extensions のストレージ閲覧) で開発検証は可能
- **Q4: D (出揃ってから判断)** または Q1=A なら自動的に「唯一のユニット」 — Q1=A なら自動決定なので Q4 は実質スキップ
- **Q5: A (Application Design のファイル構成そのまま)** — 物理構成は固定、論理ユニット境界は文書に明示

---

## 8. 承認

質問への全回答後、AI 側で曖昧性を分析し、必要なら follow-up を出します。曖昧性なしと判定でき次第、ユニット定義の生成プランを提示し承認を得てから生成します。
