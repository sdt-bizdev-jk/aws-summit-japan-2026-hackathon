# コンポーネント依存関係（v2）

## 概要
コンポーネント間の依存関係と通信パターンを定義する。

---

## 依存関係マトリクス

| 依存元 ↓ / 依存先 → | trips | analysis | notifications | social | utils (共通パッケージ) |
|---|:---:|:---:|:---:|:---:|:---:|
| **trips** | — | | ○ | | ◎ |
| **analysis** | ○ | — | | | ◎ |
| **notifications** | ○ | | — | | ◎ |
| **social** | ○ | | | — | |
| **utils** | | | | | — |

◎ = 強い依存（主要機能に必須）、○ = 参照依存（データ読み取り）

※ utils は Django アプリではなく共通 Python パッケージ。各アプリから `from utils.ai_generator import AIService` のようにインポートして使用する。

---

## 依存関係の詳細

### trips → utils (AIService)
- **種類**: 強い依存
- **理由**: 道標生成、景色生成にAI呼び出しが必須
- **通信**: 同一プロセス内のメソッド呼び出し

### trips → notifications
- **種類**: 参照依存
- **理由**: 旅の開始時にデフォルト通知スケジュールを作成
- **通信**: NotificationService のメソッド呼び出し

### analysis → trips
- **種類**: 参照依存
- **理由**: 横断分析のために途中下車済みの旅データを読み取り
- **通信**: Trip ドキュメントへの直接クエリ（MongoEngine）

### analysis → utils (AIService)
- **種類**: 強い依存
- **理由**: パターン分析と提案生成にAI呼び出しが必須
- **通信**: 同一プロセス内のメソッド呼び出し

### notifications → trips
- **種類**: 参照依存
- **理由**: 通知対象の旅情報を参照、フェードアウト候補の検出
- **通信**: Trip ドキュメントへの直接クエリ（MongoEngine）

### notifications → utils (AIService)
- **種類**: 強い依存
- **理由**: 通知文面のAI生成
- **通信**: 同一プロセス内のメソッド呼び出し

### social → trips
- **種類**: 参照依存
- **理由**: タイムライン表示のために途中下車済みの旅データを読み取り
- **通信**: Trip ドキュメントへの直接クエリ（MongoEngine）

---

## 通信パターン

### 同期通信（API処理）
全コンポーネントは同一 Django プロセス内で動作するため、通信は全て同期メソッド呼び出し。

```
[React Native / React SPA]
    │
    │ HTTP (REST API via ALB Ingress)
    ▼
[Django DRF (EKS - App Worker / Backend Worker)]
    ├── trips/views.py → trips/services.py → utils/ai_generator.py
    ├── analysis/views.py → analysis/services.py → utils/ai_generator.py
    ├── notifications/views.py → notifications/services.py → utils/ai_generator.py
    └── social/views.py → social/services.py
                                    │
                          ┌─────────┼─────────┐
                          ▼                   ▼
               [Amazon Bedrock]     [DocumentDB]
               (Claude - AI生成)    (MongoDB互換)
```

### バッチ処理（Kubernetes CronJob）
- Django 管理コマンドとして実装
- Kubernetes CronJob で定期実行

| CronJob | 実行頻度 | 処理内容 | 実行Worker |
|---|---|---|---|
| `send-notifications` | 毎分 | 送信時刻に達した通知を処理 | Backend Worker |
| `check-fadeout` | 1日1回 | 3日間無活動の旅を検出し確認通知を送信 | Backend Worker |
| `export-to-snowflake` | 1日1回 | DocumentDB → S3 エクスポート | Backend Worker |

---

## 外部サービス依存

| 外部サービス | 依存元 | 通信方式 | 用途 |
|---|---|---|---|
| Amazon Bedrock | utils (AIService) | HTTPS (boto3) | AI生成（道標、景色、分析、通知文面） |
| DocumentDB | 全アプリ | TCP (MongoEngine/pymongo) | データ永続化 |
| FCM | notifications | HTTPS (firebase-admin) | プッシュ通知送信 |
| S3 | utils (SnowflakeExport) | HTTPS (boto3) | Snowflake連携用データエクスポート |
| Snowflake | — (Snowpipe自動) | — | S3からの自動ロード |

---

## データフロー図

### 旅の開始フロー
```
User → [React Native/Web] → POST /api/trips/
                               → [ALB Ingress] → [Backend/App Worker]
                                 → [trips] TripService.start_trip()
                                     → [utils] AIService.generate_milestones()
                                         → [Bedrock] Claude API
                                     → [DocumentDB] Trip + Milestone 保存
                                 → [notifications] NotificationService.schedule_milestone_notification()
                                     → [DocumentDB] NotificationSchedule 保存
                              ← 201 Created (Trip + Milestones)
```

### 途中下車フロー
```
User → [React Native/Web] → POST /api/trips/{id}/drop_off/
                               → [ALB Ingress] → [Backend/App Worker]
                                 → [trips] TripService.process_drop_off()
                                     → [utils] AIService.generate_sceneries()
                                         → [Bedrock] Claude API
                                     → [DocumentDB] Scenery 保存, Trip ステータス更新
                              ← 200 OK (Trip + Sceneries)
```

### 横断分析フロー
```
User → [React Native/Web] → GET /api/analysis/
                               → [ALB Ingress] → [Backend/App Worker]
                                 → [analysis] AnalysisService.analyze_patterns()
                                     → [DocumentDB] 途中下車済みTrip取得
                                     → [utils] AIService.analyze_trip_patterns()
                                         → [Bedrock] Claude API
                                     → [DocumentDB] AnalysisResult 保存
                              ← 200 OK (AnalysisResult + Suggestions)
```

### Snowflake連携フロー
```
[Kubernetes CronJob] → export-to-snowflake
  → [DocumentDB] 前日分データ取得
  → [S3] JSON Lines アップロード
  → [Snowpipe] 自動検知・ロード
  → [Snowflake] データ利用可能
```

### プッシュ通知フロー
```
[Kubernetes CronJob] → send-notifications
  → [DocumentDB] 送信対象スケジュール取得
  → [utils] AIService.generate_notification_copy()
      → [Bedrock] Claude API
  → [DocumentDB] DeviceToken 取得
  → [FCM] firebase_admin.messaging.send()
  → [React Native] プッシュ通知受信
```

---

## 循環依存の回避

現在の設計に循環依存はない:
- `utils` は他のアプリに依存しない（最下層、共通パッケージ）
- `trips` は `utils` と `notifications` に依存
- `analysis`, `notifications`, `social` は `trips` と `utils` に依存
- 依存方向は常に一方向

```
utils/ (共通パッケージ: AIService, DeviceAuthMiddleware, SnowflakeExport)  ← 最下層
    ↑
trips              ← utils, notifications に依存
    ↑
analysis           ← trips, utils に依存
notifications      ← trips, utils に依存
social             ← trips に依存
```

---

## Worker間の関係

```
┌─────────────────────────────────────────────────────┐
│                  1つの DRF プロジェクト                │
│                                                     │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │   App Worker    │    │    Backend Worker      │  │
│  │  (Deployment)   │    │    (Deployment)        │  │
│  │                 │    │                        │  │
│  │ - Web SPA 配信  │    │ - モバイル API         │  │
│  │ - Web API       │    │ - バッチ処理           │  │
│  │                 │    │ - CronJob 実行         │  │
│  └────────┬────────┘    └───────────┬────────────┘  │
│           │                         │               │
│           └────────────┬────────────┘               │
│                        │                            │
│              同じコードベース                         │
│              同じ DocumentDB                         │
│              同じ Bedrock                            │
└─────────────────────────────────────────────────────┘
```

App Worker と Backend Worker は同じDRFプロジェクトの異なるDeployment。
環境変数 `WORKER_MODE=app|backend` でモード切替（バッチ処理の有効/無効など）。
