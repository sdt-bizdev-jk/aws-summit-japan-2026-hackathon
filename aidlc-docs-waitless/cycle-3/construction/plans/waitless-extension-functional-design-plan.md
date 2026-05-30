# Functional Design Plan — waitless-extension cycle-3

最終更新: 2026-05-27

cycle-3 で新規追加する **Reader Page** の詳細なビジネスロジック設計プラン。

---

## Plan ステップ

- [x] Step 1: 詳細設計の判断質問 (Q1〜Q6) にユーザー回答 (Q1=A, Q2=A, Q3=A, Q4=A, Q5=A, Q6=B)
- [x] Step 2: 質問回答の分析、矛盾検出、必要なら follow-up (矛盾なし)
- [x] Step 3: `business-logic-model.md` を生成 (中核アルゴリズム疑似コード)
- [x] Step 4: `business-rules.md` を生成 (BR-31〜37 の明文化、cycle-1 BR-01/02 改訂)
- [x] Step 5: `domain-entities.md` を生成 (ReaderStateSnapshot 詳細 + NovelContent)
- [x] Step 6: `frontend-components.md` を生成 (ReaderPage UI 詳細 + Options 修正)
- [ ] Step 7: ユーザー承認待機

---

## 詳細設計の判断質問

### Question 1: 既読範囲の DOM 表現 (色変化のレンダリング戦略)

ユーザーがクリックした位置までを青色化する際、DOM 構造をどう作りますか?

A) **段落 (`<p>`) ごとに 2 つの `<span>` に分割** — 段落内のクリック位置で `<span class="read">[既読部分]</span><span>[未読部分]</span>` の 2 分割。クリック更新時は該当段落のみ再分割。実装シンプル、再描画も該当段落のみ
B) **文字単位で `<span>` に分割** — 全文字を `<span>` で囲み、`.read` クラスを付け外しする。クリックされた位置までに連続して `.read` を付与。柔軟性高いが、DOM ノード数が大きく、メモリ・パフォーマンスに影響
C) **CSS の `linear-gradient` または `mask` で疑似的に色分け** — 段落要素自体の背景にグラデーションをかける、または mask で青/灰色を分ける。DOM 操作なしだが、文字レベルの精度は出ない (段落単位、または近似)
D) **2 種類の text shadow / contrast の重ね描き** — 同じ位置に 2 つの `<p>` を重ねて clip-path で切り分ける。複雑、推奨せず
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 2: クリック位置のオフセット計算手段

DOM クリックイベントから「ページ先頭からの累積文字オフセット」を計算する API は?

A) **`document.caretRangeFromPoint(clientX, clientY)` (Chrome 系) を使用** — クリック座標から Range を取得し、Range.startContainer (Text Node) と Range.startOffset から計算。Chrome 拡張機能なので Chrome 専用 API でも問題なし。最もシンプル
B) **`document.caretPositionFromPoint(clientX, clientY)` (Firefox 系/標準) を使用** — A の標準版。Chrome は将来サポート予定だが現在は caretRangeFromPoint を推奨
C) **`event.target` (ターゲット段落) + 段落内の独自ロジック (文字幅から計算)** — 複雑、推奨せず
D) **クリックされた `<span>` (Q1=B 採用時の文字単位 span) の data-offset 属性を使用** — Q1=B を選んだ場合のみ有効
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 3: 起動時の状態復元シーケンス (青色化とスクロールの順序)

ReaderApp.init() で青色化 (applyReadProgress) とスクロール復元 (`window.scrollTo`) はどの順序で実行しますか?

A) **青色化 → スクロール** (推奨) — 青色化で DOM が更新されレイアウトが変わる可能性があるため、その後にスクロール位置を適用。レイアウトが安定した状態でスクロール
B) **スクロール → 青色化** — まず素直にスクロールし、その後で色を変える。色変化中にレイアウトシフトが視覚的にわかってしまう可能性
C) **同時に並行実行** — Promise.all 等で並行。順序保証なし、推奨せず
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 4: 永続化のタイミングと頻度

`saveState` / `savePartial` の発動タイミングは?

A) **クリック時 = 即時保存 (saveState)、離脱時 = scrollY のみ即時保存 (savePartial)** — 要件文書 §FR-34, §FR-35, §BR-34 通り。最もシンプル
B) **A + 一定間隔 (例: 5秒) で scrollY を debounce 保存** — 拡張機能更新やタブ kill のリスクに対する保険
C) **A + スクロール終了検知 (scrollend イベント) で scrollY 保存** — `scrollend` は新しい仕様、サポートが Chrome 113+
D) **クリック時のみ保存、離脱時の scrollY 保存はしない** — Q7=A の要件に反する
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 5: クリックの双方向動作の正確な仕様

「双方向クリック」(Q6=B、要件 FR-33) の正確な動作は?

A) **クリック位置 = 既読範囲の末尾 (絶対上書き)** — クリック位置 X とすると、新しい readOffset = X。それより前は青、後ろは灰色。双方向に動く (クリックで前にも後ろにも)
B) **クリック位置以下で最大** — クリック位置 X、現在の readOffset Y のうち max(X, Y) を採用。前にクリックしても戻らず、進むだけ
C) **クリック位置にトグル (青ならクリックで戻し / 灰ならクリックで進める)** — 直感に反する可能性あり
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 6: 組み込み小説の選定とフォーマット

cycle-3 でバンドルする組み込み小説は?

A) **青空文庫の「夏目漱石 - 坊っちゃん」(または同程度の中編パブリックドメイン)、テキスト形式 (.txt)** — 約 14万文字、標準的な日本語小説。著作権切れ確実
B) **青空文庫の「芥川龍之介 - 羅生門」(短編)、テキスト形式** — 約 6千文字、短編。動作確認には十分、長編向きではない
C) **複数の短編をバンドル (最初は 1 編をデフォルト表示)** — Q2=A (1 編固定) と矛盾、推奨せず
D) **オリジナルのサンプルテキスト (短いダミー)** — 著作権の心配なし、cycle-3 のフォーカスは技術検証なので最小限のテキストでも OK
X) Other (please describe after [Answer]: tag below — 例: 別の作品の指定など)

[Answer]: B

---

回答完了後、「done」「completed」「終わった」とお知らせください。回答に基づき Functional Design 成果物を生成します。
