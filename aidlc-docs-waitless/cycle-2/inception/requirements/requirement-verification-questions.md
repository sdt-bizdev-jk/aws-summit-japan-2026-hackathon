# Requirements Verification Questions — cycle-2

cycle-2 の要件を明確化するため、以下の質問にお答えください。各質問の `[Answer]:` タグの後に、選択した文字 (A / B / C / ...) を記入してください。X) Other を選んだ場合は、その後に説明を書いてください。

---

## 背景

cycle-1 では「娯楽サイト = YouTube / X 等のように、登録した URL を開いて動画なら自動再生する」という単純モデルで実装しました。
cycle-2 ではこれを拡張し、以下の **遷移パターン** を扱いたいというご要望です:

- 動画 (YouTube 等) — cycle-1 で実装済み
- ゲーム
- EC サイトショッピング
- SNS チャット
- ストレッチ / 瞑想指示

これらは「Claude.ai が応答中の隙間時間 (N秒以上) を、待機ストレスのない別のアクティビティに置き換える」という WaitLess の本来の目的を、より幅広いユーザーペルソナに広げる動きです。

---

## Question 1: 遷移パターンの「動作の違い」をどこまで実装するか

各パターンには本質的な動作の違いがあります (例: 動画は自動再生、ストレッチ指示はテキスト/音声の指示表示、ゲームは入力受付など)。cycle-2 ではどのレベルまで実装しますか?

A) **URL を開くだけ** — 全パターンで「登録 URL のタブを開く / アクティブ化する」のみ。タイプ概念は導入せず、cycle-1 と同じ動作 (YouTube は既存の自動再生試行が効く)。最も軽量
B) **タイプ別ラベル + URL のみ** — 登録時に「タイプ (動画/ゲーム/EC/SNS/ストレッチ)」をユーザーが選択。動作は URL を開くだけだが、Options UI でタイプ別にアイコン / 並び替えできる。動作差はなし
C) **タイプ別の最小限の動作差** — 動画タイプは自動再生試行 (cycle-1 と同じ)、ストレッチ/瞑想タイプは「指示テキストを画面に表示」する別経路、ゲーム/EC/SNS は URL を開くだけ。タイプ別に PlaybackTrigger 相当を分岐
D) **タイプ別の本格動作** — 各タイプ専用のロジック (例: 瞑想は組み込みの呼吸ガイド UI、ゲームは ON/OFF 切替えの推奨ライブラリなど)。実装規模が大きい
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2: ストレッチ / 瞑想指示の提供方法

ストレッチや瞑想指示は、外部サイト (例: 瞑想アプリの Web 版、YouTube の瞑想動画) を開く方式と、拡張機能内蔵のミニ画面を出す方式が考えられます。

A) **外部サイトのみ** — ユーザーが瞑想/ストレッチ用の URL (YouTube 瞑想動画、瞑想 Web アプリ等) を登録するだけ。実装は cycle-1 の延長
B) **拡張機能内蔵の指示ページ** — 拡張機能に組み込みの「ストレッチ指示ページ (chrome-extension://...)」を用意し、テキスト/イラスト/タイマーで指示を表示。ユーザーは「ストレッチ」タイプの登録だけで済む
C) **両方サポート** — ユーザーが「外部サイト」または「内蔵ページ」を選べる
D) **Cycle-2 ではストレッチ/瞑想は外部サイトのみ、内蔵ページは Backlog 送り**
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 3: タイプ (カテゴリ) の決め方

「タイプ (動画 / ゲーム / EC / SNS / ストレッチ)」をどう決めますか?

A) **ユーザーが登録時に選択** — Options Page でサイト追加時に、プルダウン or ラジオで「タイプ」を選ぶ
B) **ドメインから自動推定** — `youtube.com` → 動画、`amazon.co.jp` → EC、`twitter.com/x.com` → SNS など、固定マッピングで自動分類。ユーザー操作なし。マッピングにないドメインは「その他」
C) **両方併用** — 自動推定をデフォルト値とし、ユーザーが手動で上書き可能
D) **タイプ概念を導入しない** — Question 1=A を選んだ場合の整合 (この場合 Question 4 以降の一部が不要になる)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4: タイプ別の優先順位の扱い

cycle-1 では `priority` (1 が最上位の連番) を使って探索していました。cycle-2 でタイプ概念が入る場合、優先順位はどうしますか?

A) **タイプ横断で 1 つの優先順位** — cycle-1 と同じ、全サイト一括の連番
B) **タイプ別に優先順位** — タイプごとに独立した優先順位。ただし「待ち発生時にどのタイプを開くか」のロジックが新たに必要
C) **タイプ横断 + ユーザーが「気分」を切替えられる** — Options Page か拡張アイコンクリックで「今日はゲーム気分」「今は瞑想気分」などモードを切替える。モードに応じて該当タイプの最優先サイトを開く
D) **タイプ概念を導入しない** (Question 1=A の場合)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 5: 「ゲーム」「EC」「SNS」タイプでの動作

これらのタイプでは、cycle-1 と同様に「タブを開く / アクティブ化する」だけで十分ですか? それとも追加の振る舞いが必要ですか?

A) **タブを開く / アクティブ化のみ** — cycle-1 と同じ。ユーザーが手動で操作開始する想定
B) **完了時の戻りでも追加処理なし** — cycle-1 と同じく、Claude 完了で AI タブに戻るだけ。ゲームを「一時停止」する仕組みは入れない (一般的なゲームには pause API がない)
C) **動画タイプのみ完了時に一時停止 (cycle-1 動作維持)、それ以外は何もしない** — cycle-1 の PlaybackPause は動画タイプ限定で動かす。ゲーム/EC/SNS は単に AI タブに戻るだけ
D) **完了時にユーザーへ通知 (Chrome notification API)** — タイプを問わず、Claude.ai の応答完了をデスクトップ通知で知らせる
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 6: 既存サイト (cycle-1 で登録済み) のマイグレーション

cycle-1 でユーザーが既に登録したサイトは、cycle-2 のタイプ概念導入後どうなりますか?

A) **既存登録は「動画」タイプ扱いとして自動マイグレーション** — cycle-1 の動作を維持
B) **既存登録は「未分類 / その他」タイプ** — ユーザーが Options Page で各サイトのタイプを再設定
C) **ドメインから自動推定 (Question 3=B/C と整合)** — `youtube.com` なら動画、`amazon.co.jp` なら EC、判別不能なら未分類
D) **データ削除して再登録を促す** — ストレージリセット (UX が悪い、非推奨)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7: cycle-2 で対応する Backlog 項目

cycle-2-handover.md / backlog.md の Backlog 項目のうち、今回の機能追加と一緒に対応するものはありますか? (複数選択可、必要に応じて X) Other で組み合わせ指定)

A) **新機能 (遷移パターン拡張) のみ** — Backlog の他項目は対応しない
B) **新機能 + B-01 (アイコン PNG 差し替え)**
C) **新機能 + B-02 (デバッグログ OFF)**
D) **新機能 + B-01 + B-02 (リリース準備系)**
E) **新機能 + B-04 (Chrome Web Store 申請手順ドキュメント化)**
X) Other (please describe after [Answer]: tag below — 例: "A + B-08 ON/OFF トグル" のように指定)

[Answer]: A

---

## Question 8: 対象ペルソナ / ユースケースの拡張

cycle-1 のペルソナは「タカシ (動画好きの待ちストレス回避ユーザー)」でした。cycle-2 で対象ペルソナを拡張しますか?

A) **タカシのまま、興味が動画以外にも広がっただけ** — 既存ペルソナの行動レンジを拡張する位置づけ
B) **新ペルソナを追加** — 例: 「ゲーム好きユーザー」「健康志向ユーザー (ストレッチ/瞑想)」「買い物好きユーザー (EC)」など複数ペルソナを定義
C) **タカシ + 1 つだけ新ペルソナを追加** — 例: 健康志向のユーザーを追加し、瞑想/ストレッチのユースケースを牽引
D) **ペルソナ整備は今回スキップ、要件レベルでのみ対応**
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)
B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)
C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

回答が完了したら「done」「completed」「終わった」などとお知らせください。回答内容を分析して要件文書 `aidlc-docs/inception/requirements/requirements.md` を作成します。
