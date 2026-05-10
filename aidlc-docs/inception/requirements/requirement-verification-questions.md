# v2 要件確認質問

v1（Django + ECS Fargate + RDS PostgreSQL）からのアーキテクチャ変更と要件追記修正を確認します。
v1の成果物は `aidlc-docs/inception-v1/` に退避済みです。

---

## Question 1
アーキテクチャ変更の主な動機は何ですか？

A) コスト削減（ECS Fargate + RDS は PoC には高い）
B) 開発スピード向上（サーバーレスの方がデプロイが楽）
C) ハッカソン審査でのAWSサービス活用アピール
D) 運用負荷の軽減（マネージドサービスに寄せたい）
E) 複数の理由がある（[Answer]: の後に説明してください）
F) Other (please describe after [Answer]: tag below)

[Answer]: E、チームにAWSサービスの活用経験が豊富なメンバーがおり、なら手間をかけてもAWSサービスにしっかり寄せようかという話になりました。

---

## Question 2
バックエンドのアーキテクチャとして、どの方向を考えていますか？

A) AWS Lambda + API Gateway（Python、関数単位）
B) AWS Lambda + API Gateway（Python、フレームワーク統合 — e.g. Mangum + Django/FastAPI）
C) AWS Lambda + Function URL（フレームワーク統合）
D) AWS App Runner（コンテナだが ECS より軽量運用）
E) Other (please describe after [Answer]: tag below)

[Answer]: 参考にしたい構成があるので、 references/docs/aws-architecture.md を見てください。
セキュリティ部分は抜いてしまっても良いかなと考えています。
本サービスと大きく食い違うような部分がない限り、この構成に合わせようと思っています。

---

## Question 3
データベースについて、どの方向を考えていますか？

A) DynamoDB（サーバーレスに合わせてフルマネージド NoSQL）
B) Aurora Serverless v2（PostgreSQL互換、使った分だけ課金）
C) DynamoDB + 一部 RDS（ハイブリッド）
D) v1のまま RDS PostgreSQL を維持
E) Other (please describe after [Answer]: tag below)

[Answer]: Q2に同じく、こちらもmdファイルを参照してください。

---

## Question 4
フロントエンドのホスティングについて変更はありますか？

A) AWS Amplify Hosting（Next.js SSR対応、v1想定のまま）
B) CloudFront + S3（静的エクスポート、SSR不要にする）
C) Lambda@Edge / CloudFront Functions で SSR
D) フロントエンドは変更なし（Next.js + Amplify のまま）
E) Other (please describe after [Answer]: tag below)

[Answer]: PWAでなく、ネイティブアプリに変更しようと考えています。React Native予定です。

---

## Question 5
v1の機能要件（FR-01〜FR-07）について、追加・変更・削除したいものはありますか？

A) 機能要件は変更なし（アーキテクチャのみ変更）
B) 一部機能を削除してスコープを絞りたい（[Answer]: の後に対象を記載）
C) 新しい機能を追加したい（[Answer]: の後に内容を記載）
D) 既存機能の優先度を変更したい（[Answer]: の後に内容を記載）
E) 複数の変更がある（[Answer]: の後に詳細を記載）
F) Other (please describe after [Answer]: tag below)

[Answer]: 機能要件については現状維持、ただドキュメントの書き方が最初から旅の比喩を使っていて伝わりづらいかなという懸念があります。
用語の対応関係などはいいと思っているので、旅の話をする前に元の三日坊主などの、比喩を使わない説明パートがあった方がいいと思いました。
大枠としてはこんな感じですね。

---

## Question 6
非機能要件について変更したい点はありますか？

A) 変更なし
B) 認証方式を変更したい（匿名デバイスID → 別方式）
C) パフォーマンス要件を変更したい
D) ユーザー規模の想定を変更したい
E) 複数の変更がある（[Answer]: の後に詳細を記載）
F) Other (please describe after [Answer]: tag below)

[Answer]: こちらも変更なしですが、上述のmdファイルと食い違った場合は質問してください。

---

## Question 7
IaC（Infrastructure as Code）について、どのツールを使いたいですか？

A) AWS CDK（TypeScript）
B) AWS CDK（Python）
C) AWS SAM（Serverless Application Model）
D) Terraform
E) IaCは使わない（マネジメントコンソール or CLI で手動構築）
F) Other (please describe after [Answer]: tag below)

[Answer]: まずmdファイルを見て、記載がなければ改めて質問してください。

---

## Question 8
v1で「仮置き」としていた用語（一覧画面 = "旅の地図"、横断分析 = "次の旅先"）について、確定させたいですか？

A) はい、この機会に確定させたい
B) いいえ、仮置きのまま進める
C) 別の案がある（[Answer]: の後に記載）
D) Other (please describe after [Answer]: tag below)

[Answer]: Aで、一旦確定させましょうか。

---

## Question 9
その他、v2で変更・追加したい要件や設計方針があれば自由に記載してください。

A) 特になし（上記の質問で網羅されている）
B) あり（[Answer]: の後に記載）

[Answer]: これまでのQで大体かけたかなと思います。A

