# サービス定義

## 概要
サービス層はビジネスロジックのオーケストレーションを担当する。
ViewSet（API層）→ Service（ビジネスロジック）→ Model（データ層）の3層構成。

---

## サービス一覧

| サービス | 所属 | 責務 |
|---|---|---|
| TripService | trips | 旅のライフサイクル管理 |
| AnalysisService | analysis | 横断分析と提案生成 |
| NotificationService | notifications | 通知スケジューリングと送信 |
| SocialService | social | 匿名タイムライン提供 |
| AIService | utils（共通パッケージ） | AI呼び出しの集約・プロンプト管理 |

---

## TripService

**所属**: `trips/services.py`
**責務**: 旅の作成から途中下車までのライフサイクルを管理

### オーケストレーションフロー

#### 旅の開始
```
TripViewSet.create_trip()
  → TripService.start_trip()
    → Trip.objects.create()
    → AIService.generate_milestones()
    → Milestone.objects.bulk_create()
    → return Trip + Milestones
```

#### 途中下車
```
TripViewSet.drop_off()
  → TripService.process_drop_off()
    → AIService.generate_sceneries() (ユーザー未指定の場合)
    → Scenery.objects.bulk_create()
    → Trip.status = "dropped_off"
    → Trip.dropped_off_at = now()
    → return Trip (updated)
```

#### フェードアウト検出
```
(バッチ処理)
  → TripService.check_fadeout_candidates()
    → Trip.objects.filter(status="active", last_activity__lt=3日前)
    → NotificationService.send_fadeout_check() (各候補に対して)
```

---

## AnalysisService

**所属**: `analysis/services.py`
**責務**: 複数の旅を横断してパターンを発見し、次の旅先を提案

### オーケストレーションフロー

#### 横断分析
```
AnalysisViewSet.get_analysis()
  → AnalysisService.should_regenerate()
    → (新しい途中下車があれば再生成)
  → AnalysisService.analyze_patterns()
    → Trip.objects.filter(device_id, status="dropped_off")
    → AIService.analyze_trip_patterns()
    → AnalysisResult.objects.update_or_create()
    → return AnalysisResult
```

#### 次の旅先提案
```
AnalysisViewSet.get_suggestions()
  → AnalysisService.generate_suggestions()
    → AnalysisService.analyze_patterns() (必要なら)
    → AIService.suggest_next_trips()
    → Suggestion.objects.bulk_create()
    → return Suggestion[]
```

### 前提条件
- 横断分析は途中下車が3回以上ある場合のみ実行可能
- 提案は横断分析の結果に基づく

---

## NotificationService

**所属**: `notifications/services.py`
**責務**: 通知のスケジューリング、文面生成、送信

### オーケストレーションフロー

#### 通知スケジュール設定
```
NotificationViewSet.update_schedule()
  → NotificationService.schedule_milestone_notification()
    → NotificationSchedule.objects.update_or_create()
    → return NotificationSchedule
```

#### 定期バッチ送信
```
(管理コマンド: send_notifications)
  → NotificationService.process_pending_notifications()
    → NotificationSchedule.objects.filter(notify_time__lte=now, sent=False)
    → (各通知に対して)
      → NotificationService.generate_notification_text()
        → AIService.generate_notification_copy()
      → PWA Push API で送信
      → NotificationLog.objects.create()
    → return sent_count
```

#### フェードアウト確認送信
```
(管理コマンド: check_fadeout)
  → TripService.check_fadeout_candidates()
  → (各候補に対して)
    → NotificationService.send_fadeout_check()
      → NotificationService.generate_notification_text(type="fadeout")
      → PWA Push API で送信
      → NotificationLog.objects.create()
```

### バッチ処理
- `send_notifications`: 毎分実行、送信時刻に達した通知を処理
- `check_fadeout`: 1日1回実行、3日間無活動の旅を検出

---

## SocialService

**所属**: `social/services.py`
**責務**: 匿名タイムラインの提供

### オーケストレーションフロー

#### タイムライン取得
```
TimelineViewSet.list_timeline()
  → SocialService.get_anonymous_timeline()
    → Trip.objects.filter(status="dropped_off")
      .order_by("-dropped_off_at")[:limit]
    → SocialService.anonymize_trip() (各旅に対して)
    → return TimelineItem[]
```

### 匿名化ルール
- デバイスID: 除去
- ユーザー名: なし（元々匿名）
- 表示情報: 旅のタイトル、カテゴリ、期間（日数）、途中下車日のみ

---

## AIService

**所属**: `utils/ai_generator.py`（共通パッケージ — Django アプリではない）
**責務**: Amazon Bedrock（Claude）への全AI呼び出しを集約

### 設計方針
- 全てのAI呼び出しをこのクラスに集約
- プロンプトテンプレートを一元管理
- レスポンスのパース・バリデーションを統一
- エラーハンドリング（タイムアウト、レート制限）を共通化

### プロンプトテンプレート管理

| テンプレート | 用途 | 呼び出し元 |
|---|---|---|
| `MILESTONE_PROMPT` | 道標生成 | TripService |
| `SCENERY_PROMPT` | 景色（得たもの）生成 | TripService |
| `PATTERN_PROMPT` | 横断分析 | AnalysisService |
| `SUGGESTION_PROMPT` | 次の旅先提案 | AnalysisService |
| `NOTIFICATION_PROMPT` | 通知文面生成 | NotificationService |

### 共通処理
- Bedrock クライアント初期化（boto3）
- リクエスト送信（invoke_model）
- レスポンスパース（JSON抽出）
- リトライ処理（指数バックオフ）
- タイムアウト管理（10秒制限）
