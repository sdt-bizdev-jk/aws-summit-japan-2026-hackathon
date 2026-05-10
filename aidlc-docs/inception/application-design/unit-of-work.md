# Unit of Work 定義（v2）

## 概要
Application Design で定義されたコンポーネントを、機能ドメイン別に開発ユニットへ分解する。
各ユニットは CONSTRUCTION フェーズで個別に設計・実装される。

**分割方針**: 機能ドメイン別
**開発順序**: バックエンド → フロントエンド → インフラ
**Web版**: 別ユニットとして後回し（設計は残すが実装優先度は低い）

---

## ユニット一覧

| # | ユニット名 | 種別 | 優先度 | 概要 |
|---|---|---|---|---|
| 1 | trips-backend | バックエンド | 最優先 | 旅のライフサイクル管理 + 共通基盤（AIService, DeviceAuth） |
| 2 | analysis-backend | バックエンド | 高 | 横断分析と次の旅先提案 |
| 3 | notifications-backend | バックエンド | 中 | プッシュ通知スケジューリングとFCM送信 |
| 4 | social-backend | バックエンド | 低 | 匿名タイムライン |
| 5 | mobile-app | フロントエンド | 高 | React Native（Expo）モバイルアプリ |
| 6 | web-app | フロントエンド | 低（後回し） | React SPA Web版 |
| 7 | infrastructure-base | インフラ | 中 | EKS / DocumentDB / ALB / CDK基盤 |
| 8 | infrastructure-security-monitoring | インフラ | 低 | WAF / Shield / Inspector / GuardDuty / CloudTrail / Fluentd / Kinesis / Elasticsearch + Snowflake連携 |

---

## ユニット詳細

### Unit 1: trips-backend（最優先）

**責務**: 旅のライフサイクル管理 + 共通基盤の初期実装

**含まれるコンポーネント**:
- `trips` Django アプリ（全機能）
- `utils` パッケージ（AIService, DeviceAuthMiddleware）
- DRF プロジェクト骨格（settings, urls, wsgi）
- DocumentDB 接続設定（MongoEngine）

**主要成果物**:
- Django プロジェクト初期構成
- trips アプリ（models, views, services, urls）
- utils パッケージ（ai_generator.py, middleware.py）
- API エンドポイント: `/api/trips/` 系全て
- テンプレートデータ（旅のテンプレート）

**対応ストーリー**: 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 3.3, 4.1, 4.2

**完了条件**:
- 旅の開始〜途中下車〜一覧表示の最小ループが動作する
- AIService 経由で Bedrock を呼び出し、道標・景色を生成できる
- DeviceAuthMiddleware でデバイスID認証が機能する
- DocumentDB への CRUD が正常に動作する

---

### Unit 2: analysis-backend（高）

**責務**: 横断分析とパターン発見、次の旅先提案

**含まれるコンポーネント**:
- `analysis` Django アプリ（全機能）

**主要成果物**:
- analysis アプリ（models, views, services, urls）
- API エンドポイント: `/api/analysis/`, `/api/analysis/suggestions/`

**対応ストーリー**: 5.1, 5.2

**前提条件**: Unit 1 完了（trips データ + AIService が必要）

**完了条件**:
- 途中下車3回以上で横断分析が実行できる
- パターンに基づく次の旅先提案が生成される
- AIService を利用した分析・提案が動作する

---

### Unit 3: notifications-backend（中）

**責務**: プッシュ通知のスケジューリングとFCM送信

**含まれるコンポーネント**:
- `notifications` Django アプリ（全機能）

**主要成果物**:
- notifications アプリ（models, views, services, urls）
- API エンドポイント: `/api/notifications/{trip_id}/schedule/`, `/api/notifications/device-token/`
- Kubernetes CronJob 定義: `send-notifications`, `check-fadeout`
- Django 管理コマンド: `send_notifications`, `check_fadeout`

**対応ストーリー**: 3.2（フェードアウト確認）, 6.1, 6.2

**前提条件**: Unit 1 完了（trips データ + AIService が必要）

**完了条件**:
- 道標ベースの通知がスケジュール・送信できる
- フェードアウト検出バッチが動作する
- FCM 経由でプッシュ通知が送信される
- 通知文面がAI生成される（圧をかけない表現）

---

### Unit 4: social-backend（低）

**責務**: 匿名タイムラインの提供

**含まれるコンポーネント**:
- `social` Django アプリ（全機能）

**主要成果物**:
- social アプリ（models, views, services, urls）
- API エンドポイント: `/api/timeline/`

**対応ストーリー**: 7.1

**前提条件**: Unit 1 完了（trips データが必要）

**完了条件**:
- 匿名化されたタイムラインが取得できる
- 個人特定情報が除去されている
- ページネーションが動作する

---

### Unit 5: mobile-app（高）

**責務**: React Native（Expo）モバイルアプリの実装

**含まれるコンポーネント**:
- React Native（Expo Managed）プロジェクト
- Tab + Stack ナビゲーション
- 全画面コンポーネント
- 共通UIコンポーネント
- API クライアント
- SecureStore（デバイスID管理）
- FCM 受信設定

**主要成果物**:
- Expo プロジェクト初期構成
- ナビゲーション構成（TabNavigator + StackNavigator）
- 画面: TripList, TripDetail, TemplateSelect, FreeInput, TripActive, DropOff, Analysis, Suggestion, Timeline, Settings
- 共通UI: TripCard, MilestoneList, SceneryEditor, SuggestionCard, TimelineItem, TripCounter
- API通信層（axios or fetch + X-Device-ID ヘッダー）

**対応ストーリー**: 全ストーリー（1.1〜7.1）のモバイルUI

**前提条件**: Unit 1〜4 のAPI が利用可能（段階的に統合可能）

**完了条件**:
- 全画面が実装され、ナビゲーションが動作する
- バックエンドAPIと通信できる
- プッシュ通知を受信できる
- デバイスID が SecureStore で管理される

---

### Unit 6: web-app（低 — 後回し）

**責務**: React SPA Web版の実装

**含まれるコンポーネント**:
- React SPA プロジェクト
- React Router によるルーティング
- Web版画面コンポーネント
- API クライアント
- localStorage（デバイスID管理）

**主要成果物**:
- React SPA プロジェクト初期構成
- ルーティング構成（React Router）
- 画面: TripList, TripStart, TripDetail, TripActive, TripDropOff, Analysis, Timeline, Settings
- API通信層（X-Device-ID ヘッダー）

**対応ストーリー**: 全ストーリーのWeb版UI

**前提条件**: Unit 1〜4 のAPI が利用可能、Unit 5 の設計を参考

**完了条件**:
- 全画面が実装され、ルーティングが動作する
- バックエンドAPIと通信できる
- App Worker から静的ファイルが配信される

**備考**: PoC段階ではモバイル優先。Web版は最小限の実装に留める。

---

### Unit 7: infrastructure-base（中）

**責務**: アプリケーション実行基盤のIaC構築

**含まれるコンポーネント**:
- AWS CDK（Python）プロジェクト
- EKS クラスター定義
- DocumentDB クラスター定義
- ALB Ingress 定義
- VPC / サブネット / セキュリティグループ
- ECR リポジトリ
- S3 バケット（Snowflake連携用）

**主要成果物**:
- CDK プロジェクト初期構成
- EKS Stack（クラスター、ノードグループ、HPA設定）
- DocumentDB Stack（クラスター、インスタンス、セキュリティグループ）
- Networking Stack（VPC、サブネット、NAT Gateway）
- ALB Ingress Controller 設定
- ECR リポジトリ（App Worker / Backend Worker）
- Kubernetes マニフェスト（Deployment, Service, CronJob）

**対応ストーリー**: 直接対応なし（全ユニットの実行基盤）

**前提条件**: なし（独立して構築可能だが、アプリ完成後にデプロイ）

**完了条件**:
- `cdk deploy` で全リソースが作成される
- EKS クラスターが稼働する
- DocumentDB に接続できる
- ALB 経由でアプリにアクセスできる

---

### Unit 8: infrastructure-security-monitoring（低）

**責務**: セキュリティ層と監視基盤の構築 + Snowflake連携

**含まれるコンポーネント**:
- セキュリティ: WAF, Shield, Inspector, GuardDuty, CloudTrail
- 監視: Fluentd → Kinesis → Elasticsearch + Kibana
- DWH連携: SnowflakeExportService + Snowpipe設定
- アラート: Slack連携

**主要成果物**:
- Security Stack（WAF rules, Shield, Inspector, GuardDuty, CloudTrail）
- Monitoring Stack（Kinesis Data Firehose, Elasticsearch domain, Kibana）
- Fluentd DaemonSet（Kubernetes）
- Snowflake連携: `utils/snowflake_export.py` + S3 → Snowpipe 設定
- CronJob: `export-to-snowflake`
- Slack Webhook 連携（CloudWatch Alarms → SNS → Lambda → Slack）

**対応ストーリー**: 直接対応なし（運用基盤）

**前提条件**: Unit 7 完了（EKS / VPC が必要）

**完了条件**:
- WAF ルールが ALB に適用されている
- GuardDuty / Inspector が有効化されている
- ログが Fluentd → Kinesis → Elasticsearch に流れる
- Snowflake にデータがエクスポートされる
- Slack にアラートが通知される

---

## コード構成戦略

```
tabitabi/                           # ワークスペースルート
├── backend/                        # Django DRF プロジェクト
│   ├── manage.py
│   ├── config/                     # Django settings, urls, wsgi
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── trips/                      # Unit 1
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── services.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── management/commands/
│   ├── analysis/                   # Unit 2
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── services.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── notifications/              # Unit 3
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── services.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── management/commands/
│   ├── social/                     # Unit 4
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── services.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── utils/                      # 共通パッケージ（Unit 1 で初期実装）
│   │   ├── __init__.py
│   │   ├── ai_generator.py        # AIService
│   │   ├── middleware.py           # DeviceAuthMiddleware
│   │   ├── snowflake_export.py    # Unit 8 で実装
│   │   └── templates.py           # 旅のテンプレートデータ
│   ├── Dockerfile
│   └── requirements.txt
├── mobile/                         # Unit 5: React Native (Expo)
│   ├── app.json
│   ├── App.tsx
│   ├── src/
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── api/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
├── web/                            # Unit 6: React SPA（後回し）
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   └── utils/
│   ├── index.html
│   └── package.json
├── infra/                          # Unit 7 & 8: AWS CDK
│   ├── app.py
│   ├── stacks/
│   │   ├── networking.py           # VPC, Subnets
│   │   ├── eks.py                  # EKS Cluster
│   │   ├── documentdb.py           # DocumentDB
│   │   ├── security.py             # Unit 8: WAF, Shield, etc.
│   │   └── monitoring.py           # Unit 8: Kinesis, ES
│   ├── k8s/
│   │   ├── app-worker.yaml
│   │   ├── backend-worker.yaml
│   │   ├── cronjobs.yaml
│   │   └── fluentd-daemonset.yaml  # Unit 8
│   ├── cdk.json
│   └── requirements.txt
└── aidlc-docs/                     # ドキュメント（変更なし）
```

---

## 開発順序

```
Phase 1 (バックエンド):
  Unit 1 (trips-backend) ──→ Unit 2 (analysis-backend)
                          ──→ Unit 3 (notifications-backend)
                          ──→ Unit 4 (social-backend)

Phase 2 (フロントエンド):
  Unit 5 (mobile-app) ──→ Unit 6 (web-app) [後回し]

Phase 3 (インフラ):
  Unit 7 (infrastructure-base) ──→ Unit 8 (infrastructure-security-monitoring)
```

**備考**:
- Unit 2, 3, 4 は Unit 1 完了後に並行開発可能
- Unit 5 は Unit 1 完了後から段階的に統合開始可能
- Unit 7, 8 はアプリ開発と並行して進めることも可能（ただし開発順序としてはバックエンド優先）
