# Requirements Verification Questions — cycle-3

cycle-3 の新機能「拡張機能内蔵の読書ページ」の要件を明確化するため、以下の質問にお答えください。各質問の `[Answer]:` タグの後に、選択した文字 (A / B / C / ...) を記入してください。X) Other を選んだ場合は、その後に説明を書いてください。

---

## 背景

cycle-3 では拡張機能内蔵の読書ページを追加し、AI 待ち時間中に小説テキストを読み進められるようにしたいというご要望です。実装上、以下の判断ポイントが複数あります。

cycle-1 / cycle-2 で確定済の重要事項 (前提):
- データモデル: `{ sites: [{domain, url, priority}], threshold_sec }` (cycle-2 で維持)
- 切替先は domain と url のペアで指定 (タイプ概念なし)
- 拡張機能内蔵ページは未導入
- BR-01〜22, FR-01〜11, FR-21〜25, NFR-01〜07 を継承

---

## Question 1: 小説テキストの提供方法

読書ページに表示する小説テキストはどう用意しますか?

A) **拡張機能に組み込み (固定の 1〜数編)** — `extension/reader/` に静的な `.txt` または `.json` で 1 つ (または数編) の小説をバンドル。著作権切れ作品 (青空文庫から導入など) を想定。ユーザー側でテキストを差し替える機能なし
B) **ユーザーがテキストを貼り付け / アップロード** — Options Page で、ユーザーが任意の小説テキストを貼り付けて登録。`chrome.storage.local` に保存
C) **ユーザーが URL を指定して fetch** — ユーザーが青空文庫等の URL を Options Page に登録、読書ページが起動時に fetch して表示
D) **A + B の併用** — 組み込みテキストもあり、ユーザー追加もできる
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2: 小説テキストの数 (cycle-3 でサポートする数)

cycle-3 でサポートする小説の数は?

A) **1 編固定** — シンプルな MVP。1 つの小説を最初から最後まで読むスタイル
B) **複数管理 (リスト + 切替)** — 複数の小説を登録でき、Options Page で「いま読む小説」を選択できる。各小説ごとに既読位置を保持
C) **複数管理 + 自動切替** — 複数小説を登録し、待ち時間ごとに次の小説 / 章 / 段落へ自動で進める。複雑度高
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3: 読書ページへの遷移トリガー

読書ページが「娯楽サイト」として開かれるのはどんな時ですか?

A) **既存の Site 登録モデルに乗せる** — `chrome-extension://[ID]/reader/reader.html` のような URL を、ユーザーが Options Page で 1 つの「サイト」として登録する。既存の 2パス探索ロジック (URL 完全一致 → ドメイン一致 → 新規) でそのまま動く
B) **専用の登録方式** — Options Page に「読書モード」専用のチェックボックスを追加。読書モード ON の時、待ち時間に必ず読書ページへ遷移する。既存サイトより優先
C) **読書専用モードのトグル** — 拡張機能アイコンクリック等で「読書モード」を切替え可能。OFF 時は通常 (cycle-1/2 の動作)、ON 時は必ず読書ページへ
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4: 既読位置の保存粒度

「前回読み進めたところに戻る」の粒度は?

A) **スクロール位置 (px or %)** — ページのスクロール位置だけを記録。シンプル、再現精度はブラウザ・ウィンドウ高さに依存
B) **クリック位置 (テキスト末尾までのオフセット文字数)** — ユーザーがクリックした位置 (= 既読範囲の末尾) を文字オフセットで記録。再現精度高い
C) **両方** — スクロール位置 + クリック位置。次回開いた時、クリック位置までを青色化 + スクロールはクリック位置付近に
D) **段落 ID 単位** — 段落単位で「ここまで読んだ」を記録。中間粒度
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 5: 既読色の切り替えタイミング

「灰色 → 青色」への色変化はいつ起きますか?

A) **クリック時のみ** — ユーザーがクリックした位置までのテキストが青に変わる。スクロールでは変化しない (要望文言通りの最小実装)
B) **クリック + 自動スクロール検知** — クリックでも変わるし、スクロールで画面上部に到達したテキストも自動で青に変わる
C) **クリックのみ + 既読範囲の維持** — クリックで青に変わり、ページを閉じて再オープンしても青色範囲が維持される (永続化)
D) **A + C** — クリック時のみ色変化、永続化あり (要望と最も整合)
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 6: 既読範囲を「戻す」操作

ユーザーがクリックして既読範囲を進めた後、戻したくなった時の挙動は?

A) **戻せない (進むのみ)** — クリックで進めたら戻せない。要望に明示なし、最もシンプル
B) **既読範囲より前をクリックすると、その位置まで戻る (双方向)** — クリック位置で常に既読範囲の末尾を上書き
C) **明示的な「リセット」ボタン** — Options Page か読書ページ自体に「最初に戻す」ボタン
D) **B + C 併用**
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 7: AI 完了時の動作

AI 出力が完了して読書ページから AI タブへ戻る際、現在のスクロール位置 / クリック位置の記録はどうしますか?

A) **離脱直前のスクロール位置 + クリック位置を保存** — 次回開いた時にスクロール復元、クリック位置までを青色化
B) **クリック位置のみ保存** — スクロール位置は保存しない (次回はクリック位置付近にスクロールジャンプ)
C) **スクロール位置のみ保存** — クリック位置は保存しない (次回はスクロール位置で開く)
D) **完了時には何も自動保存しない、ユーザーがクリックした位置のみ即座に保存** — クリック=しおり相当
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 8: 読書ページの UI 仕様

読書ページの UI はどの程度作り込みますか?

A) **最小限** — 黒背景 (or 白背景) に灰色テキスト、クリックで青色化、スクロール、以上。フォント・文字サイズ・テーマは固定
B) **基本的な可読性配慮** — 文字サイズ調整 (S/M/L)、ライト/ダーク切替、行間調整、フォント選択 (明朝/ゴシック等)。Options Page に設定追加
C) **フルカスタマイズ** — 上記 + 1ページの幅、上下マージン、目次表示、ページめくり風アニメーションなど
D) **A + 1〜2 個の最小カスタマイズ** (例: 文字サイズのみ可変)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 9: Options Page の UI 拡張

cycle-3 で Options Page にどこまで UI を追加しますか?

A) **何も追加しない** — Q1=A (組み込み小説 1編固定) + Q3=A (読書ページ URL を一般サイトとして登録) なら、ユーザーは普通に `chrome-extension://...` を登録するだけ
B) **読書ページ専用の登録セクション追加** — 「読書モード設定」セクション、組み込み小説の有効化トグル、ユーザーテキスト入力欄など
C) **設定なし、自動で動く** — インストール後、自動で読書ページが「組み込みのデフォルト娯楽」として登録済みになる
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 10: 読書ページと既存機能の相互作用 (PlaybackTrigger)

cycle-1 で実装した PlaybackTrigger (動画自動再生試行) は、読書ページにも注入されますか?

A) **読書ページにも注入されるが、`<video>` 要素がないため何もしない (cycle-1 から既存の挙動)** — 何も変更不要、既存実装のまま
B) **読書ページでは PlaybackTrigger / PlaybackPause を明示的にスキップ** — `chrome-extension://` URL の場合は注入を回避
C) **読書ページ独自のロジック** — 読書ページが PlaybackTrigger 相当の役割 (自動スクロール開始など) を持つ
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 11: 永続化のスコープ

既読位置 / クリック位置 / スクロール位置の永続化は端末間で同期しますか?

A) **端末ローカルのみ** (`chrome.storage.local`) — cycle-1/2 と同じ方針 (NFR-01 プライバシー)、端末間同期なし
B) **`chrome.storage.sync` を使う** — 端末間で既読位置を同期 (Google アカウント経由)。アンチスコープに同期未対応とあるが、読書位置は同期したい場合
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 12: cycle-3 で対応する Backlog 項目

cycle-3 では読書ページ機能 + 何を一緒に対応しますか?

A) **読書ページ機能のみ** (Backlog 他項目は対応しない)
B) **読書ページ + B-01 (アイコン PNG 差し替え)**
C) **読書ページ + B-02 (デバッグログ OFF)**
D) **読書ページ + B-01 + B-02 (リリース準備系)**
E) **読書ページ + B-08 ON/OFF トグル** (Q3=C と整合する場合)
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
