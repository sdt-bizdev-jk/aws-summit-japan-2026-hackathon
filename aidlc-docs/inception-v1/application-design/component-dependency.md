# コンポーネント依存関係

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
- **通信**: Trip モデルへの直接クエリ（Django ORM）

### analysis → utils (AIService)
- **種類**: 強い依存
- **理由**: パターン分析と提案生成にAI呼び出しが必須
- **通信**: 同一プロセス内のメソッド呼び出し

### notifications → trips
- **種類**: 参照依存
- **理由**: 通知対象の旅情報を参照、フェードアウト候補の検出
- **通信**: Trip モデルへの直接クエリ（Django ORM）

### notifications → utils (AIService)
- **種類**: 強い依存
- **理由**: 通知文面のAI生成
- **通信**: 同一プロセス内のメソッド呼び出し

### social → trips
- **種類**: 参照依存
- **理由**: タイムライン表示のために途中下車済みの旅データを読み取り
- **通信**: Trip モデルへの直接クエリ（Django ORM）

---

## 通信パターン

### 同期通信（全て）
全コンポーネントは同一 Django プロセス内で動作するため、通信は全て同期メソッド呼び出し。

```
[Frontend (Next.js)]
    │
    │ HTTP (REST API via ALB)
    ▼
[Django (ECS Fargate)]
    ├── trips/views.py → trips/services.py → utils/ai_generator.py
    ├── analysis/views.py → analysis/services.py → utils/ai_generator.py
    ├── notifications/views.py → notifications/services.py → utils/ai_generator.py
    └── social/views.py → social/services.py
                                    │
                                    │ boto3 (HTTPS)
                                    ▼
                          [Amazon Bedrock (Claude)]
```

### バッチ処理（非同期）
- Django 管理コマンドとして実装
- ECS Scheduled Task（CloudWatch Events）で定期実行

| バッチ | 実行頻度 | 処理内容 |
|---|---|---|
| `send_notifications` | 毎分 | 送信時刻に達した通知を処理 |
| `check_fadeout` | 1日1回 | 3日間無活動の旅を検出し確認通知を送信 |

---

## データフロー図

### 旅の開始フロー
```
User → [Next.js] → POST /api/trips/
                      → [trips] TripService.start_trip()
                          → [utils] AIService.generate_milestones()
                              → [Bedrock] Claude API
                          → [DB] Trip + Milestone 保存
                      → [notifications] NotificationService.schedule_milestone_notification()
                          → [DB] NotificationSchedule 保存
                   ← 201 Created (Trip + Milestones)
```

### 途中下車フロー
```
User → [Next.js] → POST /api/trips/{id}/drop_off/
                      → [trips] TripService.process_drop_off()
                          → [utils] AIService.generate_sceneries()
                              → [Bedrock] Claude API
                          → [DB] Scenery 保存, Trip ステータス更新
                   ← 200 OK (Trip + Sceneries)
```

### 横断分析フロー
```
User → [Next.js] → GET /api/analysis/
                      → [analysis] AnalysisService.analyze_patterns()
                          → [DB] 途中下車済みTrip取得
                          → [utils] AIService.analyze_trip_patterns()
                              → [Bedrock] Claude API
                          → [DB] AnalysisResult 保存
                   ← 200 OK (AnalysisResult + Suggestions)
```

---

## 循環依存の回避

現在の設計に循環依存はない:
- `utils` は他のアプリに依存しない（最下層、共通パッケージ）
- `trips` は `utils` と `notifications` に依存
- `analysis`, `notifications`, `social` は `trips` と `utils` に依存
- 依存方向は常に一方向

```
utils/ (共通パッケージ: AIService, DeviceAuthMiddleware)  ← 最下層、依存なし
    ↑
trips              ← utils に依存
    ↑
analysis           ← trips, utils に依存
notifications      ← trips, utils に依存
social             ← trips に依存
```
