# cycle-6 Requirements Verification Questions

cycle-6 のテーマは「**待ち時間等の統計ログ + ダッシュボード UI (週次トレンド含む)**」です。
正確な要件を固めるため、以下の質問にお答えください。各質問の `[Answer]:` タグの後に選択肢の英字 (A/B/C...) を記入してください。当てはまる選択肢がない場合は最後の「Other」を選び、説明を記入してください。

---

## 質問グループ 1: 統計データの収集範囲

## Question 1
統計ログとして「待ち時間」をどう記録しますか? (現状コードでは `wait_orchestrator.js` に待ち発生・完了イベントがあり、`_durationMs` は未使用です)

A) 1 回の待ちサイクルごとに「待ち発生〜完了までの秒数」を記録する (=AI が応答していた時間)
B) A に加えて「娯楽タブに滞在していた秒数」(切替〜戻りまで) も別途記録する
C) B に加えて、待ちが発生したが娯楽タブに切り替わらなかったケース (登録 0 件など) も記録する
X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 2
「今日ダメになった時間」とは何を指しますか? (ダッシュボードの主要指標の 1 つ)

A) 娯楽タブに滞在していた合計時間 (本来 AI を待つだけで済んだのに娯楽に使ってしまった時間)
B) AI の待ち時間の合計 (待たされた時間そのもの)
C) 娯楽タブ滞在時間のうち、AI 出力完了後も戻らずに娯楽を続けた「超過時間」
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
「余暇種別の内訳 (SNS/ニュース/ストレッチなど)」の分類は、何を基準に判定しますか?

A) ポータルページ (cycle-5) の 12 ジャンル (動画視聴/音楽/EC/ゲーム/SNS/ニュース/読書/漫画/スポーツ/料理/旅行/リラックス) を流用し、遷移先ドメインから逆引きする
B) 登録サイト (Site) 自体にユーザーが「種別」を手動で付与し、それを集計する
C) ドメインのハードコードマッピング (例: x.com→SNS、youtube.com→動画) で自動分類し、未知ドメインは「その他」
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
「戻れた率」の定義は?

A) (AI 完了後に Claude.ai タブへ自動で戻れたサイクル数) ÷ (全待ちサイクル数)
B) ユーザーが娯楽タブから一定時間内に AI タブへ戻った割合 (手動・自動問わず)
C) A の自動戻りに加え、戻った後に実際に AI 画面がフォーカスされたことまで確認した割合
X) Other (please describe after [Answer]: tag below)

[Answer]: A, 強制的に自動切替なので、基本100%になりそうで計測する意味がないかも

## Question 5
「集中復帰までの平均秒数」とは?

A) AI 出力完了 (COMPLETION_DETECTED) から、AI タブが再アクティブ化されるまでの秒数の平均
B) AI 出力完了から、ユーザーが実際に AI 画面で次のアクション (入力など) を始めるまでの秒数の平均
C) 娯楽タブに切り替わってから AI タブに戻るまでの総時間の平均
X) Other (please describe after [Answer]: tag below)

[Answer]: A, 自動でAIタブが再アクティブするだけなら、計測する意味がなさそう。スクロールなどの動作を検知するまでのタイミングの方がいいかも

---

## 質問グループ 2: データ保存と対象

## Question 6
統計データの保存先・保持期間は?

A) `chrome.storage.local` に保存、無期限保持 (端末ローカルのみ、既存方針踏襲)
B) `chrome.storage.local` に保存、直近 N 日分のみ保持 (古いデータは自動削除でストレージ肥大を防ぐ)
C) `chrome.storage.local` に日別集計のみ保存 (個々のイベントは保持せず、日ごとのサマリだけ残す)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
統計の収集対象は?

A) Chrome 拡張側の Claude.ai 待ちサイクルのみ (cycle-1〜3 のコアフロー)
B) Chrome 拡張側 + VS Code (Kiro) 拡張側の IDE 待ちサイクルの両方 (cycle-4 の IPC 経由イベントも含む)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## 質問グループ 3: ダッシュボード UI

## Question 8
ダッシュボード UI はどこに配置しますか?

A) 拡張機能内蔵の新規ページ (`extension/dashboard/`) を追加し、Reader/Portal と同じく chrome-extension URL で開く
B) 既存の Options Page (`options/options.html`) 内にタブ/セクションとして統計を追加する
C) 新規ページを作りつつ、Options Page と action アイコンの両方からアクセスできるようにする
X) Other (please describe after [Answer]: tag below)

[Answer]: A, ポータルからの動線も設置

## Question 9
週次トレンドの可視化方法は? (画像/外部ライブラリ不使用の既存方針 = 依存ゼロ を踏まえて)

A) 純粋な HTML/CSS で描く棒グラフ (div の高さで表現、依存ゼロ。cycle-5 のポータルと同じく依存を持ち込まない)
B) インライン SVG で折れ線/棒グラフを自前描画 (依存ゼロ、より滑らかな表現)
C) Chart.js などの外部ライブラリをバンドル (リッチだが依存が増える)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 10
ダッシュボードに「リセット (統計クリア)」機能は必要ですか?

A) 必要 — 全統計を消すボタンを置く (確認ダイアログ付き)
B) 不要 — 今回は表示のみ (将来 Backlog)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 11
ダッシュボードの表示言語・テーマは?

A) 日本語固定 + ポータル (cycle-5) と同じダーク基調 (#0a0a0f) + 紫アクセント (#7c3aed) で統一
B) 日本語固定 + Options Page と同じ既存テーマに合わせる
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## 質問グループ 4: スコープと既存互換

## Question 12
cycle-5 で残した実機 E2E 検証 (T-51〜T-60) を cycle-6 の最初に実施しますか?

A) 実施しない — cycle-6 の統計機能実装に集中する (検証は別途手動で行う)
B) 実施する — まず cycle-5 のポータルを実機確認してから統計機能に入る
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 13
統計記録のために既存コアロジック (`wait_orchestrator.js` など) への変更をどこまで許容しますか?

A) 最小限の追記のみ許容 (イベント発火点に統計記録の 1 行を足す程度、既存ロジックは無変更)。新規モジュール `sw/stats_repository.js` に集約
B) 必要なら既存関数のシグネチャ変更も許容する
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## 質問グループ 5: Extension オプトイン

## Question: Security Extensions
Should security extension rules be enforced for this project?
(このプロジェクトでセキュリティ拡張ルールを強制しますか?)

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?
(プロパティベーステスト (PBT) ルールを強制しますか?)

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)
B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)
C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)
X) Other (please describe after [Answer]: tag below)

[Answer]: C
