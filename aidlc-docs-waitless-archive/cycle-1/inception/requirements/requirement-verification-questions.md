# Requirements Verification Questions — Chrome 拡張機能 (AI待ち時間サポート)

回答は各質問の `[Answer]:` の右に英字 (A, B, ...) で記入してください。X) Other を選ぶ場合は `[Answer]:` の後ろに自由記述を続けてください。

## 入力リクエスト要約 (AI解釈)
- **コンセプト**: 生成AI (Claude.ai 等) で時間のかかる出力を待っている間、ユーザーが趣味娯楽 (動画視聴・SNS等) に時間を使うことを快適にサポートする Chrome 拡張機能
- **中核体験**: 「AIに依頼 → 別タブで娯楽 → 出力完成に気づいて戻る」というタブ切替フローを支援する
- **対象**: デスクトップ Chrome ブラウザ

不明点の確認のため、以下の質問にお答えください。

---

## Question 1: 主要なユースケース
ユーザーが拡張機能を使う場面の主軸はどれですか?

A) AI出力の完了を検知して通知する (出力が終わったら知らせる)
B) 待ち時間中の娯楽タブへの切替を補助する (お気に入り娯楽サイトへワンクリック移動など)
C) 待ち時間と娯楽時間を可視化・記録する (どれだけ娯楽できたかをログ)
D) 上記すべてを組み合わせた統合体験
X) Other (please describe after [Answer]: tag below)

[Answer]: X, AI出力待ちになったら、娯楽タブへ自動で切替

---

## Question 2: 対応する生成AIサービスの範囲
どの AI サービスをサポート対象としますか?

A) Claude.ai のみ (まずは1サイト集中)
B) Claude.ai + ChatGPT の2サービス
C) Claude.ai + ChatGPT + Gemini など主要LLMチャットUI複数
D) サイトに依存せず汎用的に検出 (タブのタイトル変化など共通シグナル)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3: AI出力完了の検知方法
完了をどう検知する想定ですか?

A) 各サイトのDOM変化を監視 (ストリーミング停止、ボタン状態変化など)
B) タブのタイトル変化を監視 (例: タイトルに完了マークが出るサイト向け)
C) ユーザーが手動で「待ち開始」ボタンを押し、一定時間後に確認する
D) AとBの併用 (サイト別に最適なシグナルを使い分け)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4: 通知方法
完了をユーザーにどう知らせますか?

A) Chrome の標準デスクトップ通知 (バックグラウンドでもOS通知)
B) 拡張機能のバッジ (アイコン上の数字/色変化)
C) 効果音/音声
D) AとB両方 (通知 + バッジ)
E) すべて (通知 + バッジ + 音)
X) Other (please describe after [Answer]: tag below)

[Answer]: X, 娯楽タブから自動で元のAI作業タブへの切り替えを以て、完了通知とします

---

## Question 5: 娯楽タブの管理
待ち時間中の娯楽タブはどう扱いますか?

A) ユーザーが事前に「お気に入り娯楽サイト」を登録、ポップアップから選択して開く
B) よく訪れる娯楽サイトを履歴から自動提案
C) 既に開いている娯楽タブへ素早く切り替えるショートカット
D) AとCの組み合わせ (登録 + 既存タブ切替)
E) この機能はスコープ外 (検知・通知に集中)
X) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 6: 「娯楽サイト」の判定方法
何を娯楽サイトと見なしますか?

A) ユーザーが自分でドメインリストを登録 (例: youtube.com, x.com)
B) プリセットのカテゴリ (動画/SNS/ニュース等) から選択
C) AとB併用 (プリセット + カスタム追加)
D) この概念は持たず、単にタブ切替を補助
X) Other (please describe after [Answer]: tag below)

[Answer]: A, ホーム画面への遷移だけではなく、自動で動画が流れるようにしたい

---

## Question 7: データ保存
ユーザー設定や記録はどこに保存しますか?

A) Chrome の `chrome.storage.local` のみ (端末ローカル、外部送信なし)
B) `chrome.storage.sync` (Chromeアカウントで端末間同期)
C) 外部サーバー/クラウド (アカウント機能あり)
D) 不要 (毎回設定し直し)
X) Other (please describe after [Answer]: tag below)

[Answer]: A, 今回は1つのPC端末内で完結させます

---

## Question 8: ハッカソン/プロジェクトのゴール
今回の開発で目指す完成度はどのレベルですか?

A) PoC: 動作することを示すミニマム実装。Chrome に Unpacked で読み込めて主要動線が動く
B) MVP: 主要機能が一通り使える状態。Chrome Web Store 申請を見据えた品質
C) プロダクションリリース: 多言語/エラー処理/プライバシーポリシー等含めて公開可能
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 9: 開発技術スタック
Chrome 拡張機能の実装スタックの希望は?

A) Manifest V3 + 素のJavaScript/HTML/CSS (依存最小、ビルド不要)
B) Manifest V3 + TypeScript + Vite/webpack ビルド
C) Manifest V3 + React (UI 部分はコンポーネント化)
D) Manifest V3 + TypeScript + React + ビルド一式 (本格構成)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 10: 開発期限・スコープ感
今回のサイクルでどの範囲まで進めますか?

A) Inception フェーズのみ (要件 → 設計 → ユニット分割) を完了
B) Inception 完了後、Construction で 1 ユニット分のコード生成まで
C) Inception + Construction 全ユニットのコード生成 + Build & Test まで一気通貫
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 11: 拡張機能名 (仮称)
プロジェクトの仮称はどうしますか? 後から変更可能です。

A) コードネームは付けず、Requirements Analysis 中に決める
B) 仮称 `wait-and-play` (待って遊ぶ)
C) 仮称 `ai-break` (AIブレイク)
D) 仮称 `pomo-wait` (ポモ待ち)
X) Other (please describe after [Answer]: tag below)

[Answer]: `WaitLess`で

---

## Question 12: Security Extensions の有効化
セキュリティ拡張ルール (機密情報・認証・脆弱性等のブロッキング制約) を本プロジェクトで適用しますか?

A) Yes — 全SECURITYルールをブロッキング制約として適用 (本番品質アプリ向け)
B) No — SECURITYルールは適用しない (PoC/プロトタイプ/実験向け)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 13: Property-Based Testing Extension の有効化
プロパティベーステスト (PBT) ルールをブロッキング制約として適用しますか?

A) Yes — 全PBTルールを適用 (ビジネスロジック/データ変換/シリアライズ/状態を持つコンポーネントを含むプロジェクト向け)
B) Partial — 純粋関数とシリアライズのラウンドトリップに限定して適用
C) No — PBTルールは適用しない (単純な CRUD/UI のみ/薄い統合層向け)
X) Other (please describe after [Answer]: tag below)

[Answer]: C
