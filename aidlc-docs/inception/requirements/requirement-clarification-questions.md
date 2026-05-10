# v2 要件フォローアップ質問

参照ドキュメント（`references/docs/aws_architecture.md`）と回答を分析した結果、以下の確認が必要です。

---

## CQ1: EKS vs サーバーレス

参照ドキュメントはEKS（Kubernetes）ベースのマイクロサービス構成です。
一方、aidlc-state.md の v2 Architecture Revision History には「Lambda + 他変更予定」と記載されています。

「たびたび」のPoC規模（〜100人）を考えると、EKSはオーバースペックの可能性があります。
どちらの方向で進めますか？

A) 参照ドキュメント通りEKSベースで構築する（本格的なマイクロサービス）
B) 参照ドキュメントの構成思想（レイヤー分離、監視等）は参考にしつつ、コンピュートはLambdaベースにする（PoC規模に適正化）
C) ECS Fargate で中間を取る（v1に近いがコンテナ分離を強化）
D) 参照ドキュメントの構成をそのまま採用し、規模は気にしない（学習・アピール目的）
E) Other (please describe after [Answer]: tag below)

[Answer]: Kubernetesの技術はあるので、Aでいいかなと思っています。どうでしょうか？

---

## CQ2: DocumentDB vs DynamoDB

参照ドキュメントではDocumentDBが使われています。
「たびたび」のデータ構造（旅、道標、景色、分析結果）を考えると:

- **DocumentDB**: MongoDB互換、柔軟なスキーマ、クエリが豊富。ただし常時起動でコストがかかる（最小 ~$60/月）
- **DynamoDB**: サーバーレス、従量課金、PoC規模ならほぼ無料。ただしクエリパターンの事前設計が必要

どちらを採用しますか？

A) DocumentDB（参照ドキュメントに合わせる）
B) DynamoDB（PoC規模のコスト最適化を優先）
C) DynamoDB をメインにしつつ、横断分析など複雑なクエリが必要な部分だけ別の手段を検討
D) Other (please describe after [Answer]: tag below)

[Answer]: コスト部分は許容できるので、Aで進めてみましょうか。

---

## CQ3: React Native のビルド・配信

参照ドキュメントではExpo + Firebaseが使われています。React Nativeに変更するとのことですが:

A) Expo（Managed Workflow）を使う — ビルド・配信が楽、ただしネイティブモジュールに制約あり
B) Expo（Bare Workflow / Development Build）を使う — 柔軟性あり、Expoのビルドサービスも利用可能
C) React Native CLI（Expo不使用）— 完全な自由度、ただしビルド環境の構築が必要
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## CQ4: プッシュ通知の実装方式

v1ではPWA Push Notification（Service Worker）でしたが、React Nativeに変更するため通知方式も変わります。
参照ドキュメントではFirebaseが使われています。

A) Firebase Cloud Messaging（FCM）— React Nativeとの相性が良い、iOS/Android両対応
B) Amazon SNS + FCM/APNs — AWS寄せにする場合
C) Expo Notifications — Expoを使う場合はこれが最も簡単
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## CQ5: IaC（Infrastructure as Code）

参照ドキュメントにはIaCツールの記載がありませんでした。
v2のインフラ構築にIaCを使いますか？

A) AWS CDK（TypeScript）
B) AWS CDK（Python）
C) AWS SAM（Serverless Application Model）— Lambda中心なら相性が良い
D) Terraform
E) IaCは使わない（手動構築 or スクリプト）
F) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## CQ6: セキュリティ層の扱い

参照ドキュメントにはWAF/Shield、Inspector、GuardDuty、CloudTrail等のセキュリティ層がありますが、「セキュリティ部分は抜いてしまっても良い」とのことでした。

確認: 以下のうちどこまで含めますか？

A) セキュリティ関連は全て除外（WAF, Shield, Inspector, GuardDuty, CloudTrail 全て不要）
B) WAF だけ入れる（API保護の最低限）
C) CloudTrail だけ入れる（監査ログとして有用）
D) 最低限のセット（WAF + CloudTrail）を入れる
E) Other (please describe after [Answer]: tag below)

[Answer]: やっぱり全部入れます。

---

## CQ7: 監視・ログ基盤

参照ドキュメントではFluentd → Kinesis Data Firehose → Elasticsearch + Kibana の構成ですが、PoC規模では:

A) CloudWatch のみ（最小限、追加コストほぼなし）
B) CloudWatch + 簡易ダッシュボード（CloudWatch Dashboards）
C) 参照ドキュメント通り（Kinesis + Elasticsearch）— 本格的だがコスト大
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## CQ8: SIEM・Slack連携

参照ドキュメントにはSIEM（Elasticsearch + Kibana）とSlackアラート連携がありますが:

A) 不要（PoC段階では過剰）
B) Slackアラートだけ入れる（CloudWatch Alarm → SNS → Slack）
C) 参照ドキュメント通りフル構成
D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## CQ9: 仮置き用語の確定

Q8で「確定させたい」とのことでした。以下の候補から選ぶか、別案を記載してください。

### 一覧画面の名称
A) 旅の地図（v1仮置き）
B) 旅の記録
C) これまでの旅
D) Other (please describe after [Answer]: tag below)

[Answer]: B

### 横断分析 + 次の提案の名称
A) 次の旅先（v1仮置き）
B) 旅のパターン
C) あなたの方角
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## CQ10: App Worker / Backend Worker の分離

参照ドキュメントではApp Worker（フロントエンド向け）とBackend Worker（モバイル向け + バッチ処理）が分離されています。
React Nativeアプリの場合、バックエンドAPIは1つで良いと思いますが:

A) API は1つのサービスにまとめる（PoC規模なら十分）
B) 参照ドキュメントに合わせてWorkerを分離する（API用 + バッチ処理用）
C) API用とバッチ処理用は分離するが、API自体は1つ
D) Other (please describe after [Answer]: tag below)

[Answer]: 一旦ドキュメントに合わせていいでしょうか。B

