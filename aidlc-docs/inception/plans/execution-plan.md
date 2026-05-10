# 実行計画（v2）

## Inception フェーズ

| ステージ | 判定 | 状態 |
|---|---|---|
| Requirements Analysis | EXECUTE | ✅ 完了 |
| User Stories | EXECUTE (v1引き継ぎ) | ✅ 完了 |
| Workflow Planning | EXECUTE | ✅ 完了 |
| Application Design | EXECUTE | ⬜ 未着手 |
| Units Generation | EXECUTE | ⬜ 未着手 |

## Construction フェーズ

| ステージ | 判定 | 理由 |
|---|---|---|
| Functional Design | EXECUTE | DocumentDB向けドメインモデル、ビジネスロジック設計が必要 |
| NFR Requirements | SKIP | requirements.md に NFR 詳細定義済み（セキュリティ、監視、パフォーマンス） |
| NFR Design | SKIP | NFR Requirements スキップのため |
| Infrastructure Design | EXECUTE | EKS/CDK/セキュリティ/監視/DWH連携の設計が必要（v1から大幅増） |
| Code Generation | EXECUTE | 各ユニットのコード生成 |
| Build and Test | EXECUTE | ビルド・テスト手順 |

## v1 → v2 変更点（ワークフロー観点）

| 項目 | v1 | v2 |
|---|---|---|
| Infrastructure Design | SKIP（ECS Fargate単純構成） | EXECUTE（EKS + フルセキュリティ + 監視基盤 + DWH） |
| その他ステージ | 変更なし | 変更なし |

## 深度レベル

| ステージ | 深度 | 理由 |
|---|---|---|
| Application Design | Standard | EKSマイクロサービス + React Native + DocumentDB の設計 |
| Units Generation | Standard | Worker分離 + モバイル + インフラ + 監視で複数ユニット |
| Functional Design | Standard | ドメインモデル（DocumentDB向け）+ ビジネスロジック |
| Infrastructure Design | Comprehensive | EKS/CDK/WAF/Shield/Inspector/GuardDuty/CloudTrail/Fluentd/Kinesis/Elasticsearch/Snowflake |
| Code Generation | Standard | 各ユニットのコード生成 |
| Build and Test | Standard | ビルド・テスト手順 |

## 技術スタック（確定）

| レイヤー | 技術 |
|---|---|
| モバイルアプリ | React Native + Expo（Managed Workflow） |
| バックエンド | EKS（App Worker + Backend Worker） |
| データベース | Amazon DocumentDB |
| AI | Amazon Bedrock（Claude） |
| DWH | Snowflake |
| プッシュ通知 | Firebase Cloud Messaging（FCM） |
| セキュリティ | WAF + Shield + Inspector + GuardDuty + CloudTrail |
| 監視 | Fluentd → Kinesis Data Firehose → Elasticsearch + Kibana |
| アラート | CloudWatch Alarm → SNS → Slack |
| IaC | AWS CDK（Python） |
