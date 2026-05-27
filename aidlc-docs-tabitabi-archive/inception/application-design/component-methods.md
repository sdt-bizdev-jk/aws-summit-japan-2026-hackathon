# コンポーネントメソッド定義（v2）

## 概要
各コンポーネントの主要メソッドシグネチャと入出力を定義する。
詳細なビジネスルールは CONSTRUCTION フェーズの Functional Design で定義する。

v1からの変更点:
- ORM: Django ORM → MongoEngine（DocumentDB対応）
- 通知: PWA Push → FCM（Firebase Cloud Messaging）
- 認証: 変更なし（X-Device-ID ヘッダー）

---

## trips アプリ

### TripViewSet（API Views）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `create_trip(request)` | `{title: str, category?: str, template_id?: str}` | `Trip + Milestone[]` | 旅を開始し、AI道標を生成 |
| `list_trips(request)` | `device_id (header)` | `Trip[]` | デバイスの全旅一覧を取得 |
| `retrieve_trip(request, trip_id)` | `trip_id: str` | `Trip + Milestone[] + Scenery[]` | 旅の詳細を取得 |
| `report_progress(request, trip_id)` | `{content: str}` | `Progress` | 任意の進捗を報告 |
| `drop_off(request, trip_id)` | `{sceneries?: str[]}` | `Trip (updated)` | 途中下車を実行 |
| `confirm_fadeout(request, trip_id)` | `{action: "drop_off" \| "continue"}` | `Trip (updated)` | フェードアウト確認に応答 |

### TripService（ビジネスロジック）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `start_trip(device_id, title, category, template_id)` | 上記 | `Trip` | 旅の作成とAI道標生成を調整 |
| `process_drop_off(trip, sceneries)` | `Trip, str[]` | `Trip` | 途中下車処理（景色保存、ステータス更新） |
| `check_fadeout_candidates()` | なし | `Trip[]` | 3日間無活動の旅を検出 |
| `get_trip_count(device_id)` | `device_id: str` | `int` | 旅の数（始めた回数）を取得 |

---

## analysis アプリ

### AnalysisViewSet（API Views）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `get_analysis(request)` | `device_id (header)` | `AnalysisResult` | 横断分析結果を取得 |
| `get_suggestions(request)` | `device_id (header)` | `Suggestion[]` | 次の旅先提案を取得 |

### AnalysisService（ビジネスロジック）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `analyze_patterns(device_id)` | `device_id: str` | `AnalysisResult` | 複数の旅を横断してパターンを発見 |
| `generate_suggestions(device_id, analysis)` | `device_id, AnalysisResult` | `Suggestion[]` | パターンに基づく次の旅先提案 |
| `should_regenerate(device_id)` | `device_id: str` | `bool` | 新しい途中下車があり再分析が必要か判定 |

---

## notifications アプリ

### NotificationViewSet（API Views）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `update_schedule(request, trip_id)` | `{notify_time: time, enabled: bool}` | `NotificationSchedule` | 通知時刻を設定 |
| `register_device_token(request)` | `{fcm_token: str, platform: str}` | `200 OK` | FCMデバイストークンを登録 |

### NotificationService（ビジネスロジック）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `schedule_milestone_notification(trip, milestone)` | `Trip, Milestone` | `NotificationSchedule` | 道標通知をスケジュール |
| `send_fadeout_check(trip)` | `Trip` | `NotificationLog` | フェードアウト確認通知を送信 |
| `process_pending_notifications()` | なし | `int (sent count)` | 送信時刻に達した通知を一括送信 |
| `generate_notification_text(trip, type)` | `Trip, str` | `str` | 圧をかけない通知文面を生成 |
| `send_fcm_notification(device_id, title, body)` | `str, str, str` | `bool` | FCM経由でプッシュ通知を送信 |

---

## social アプリ

### TimelineViewSet（API Views）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `list_timeline(request)` | `{limit?: int, offset?: int}` | `TimelineItem[]` | 匿名タイムラインを取得 |

### SocialService（ビジネスロジック）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `get_anonymous_timeline(limit, offset)` | `int, int` | `TimelineItem[]` | 最新N件の途中下車を匿名化して返す |
| `anonymize_trip(trip)` | `Trip` | `TimelineItem` | 旅情報から個人特定情報を除去 |

---

## utils（共通パッケージ）

### AIService（ai_generator.py）

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `generate_milestones(title, category)` | `str, str` | `str[] (2〜4個)` | 旅の道標をAI生成 |
| `generate_sceneries(trip, progress_logs)` | `Trip, Progress[]` | `str[] (1〜3個)` | 途中下車時の「得たもの」候補を生成 |
| `analyze_trip_patterns(trips)` | `Trip[]` | `str` | 複数の旅から方向性パターンを分析 |
| `suggest_next_trips(trips, pattern)` | `Trip[], str` | `Suggestion[]` | パターンに基づく次の旅先を提案 |
| `generate_notification_copy(trip, type)` | `Trip, str` | `str` | 圧をかけない通知文面を生成 |

### DeviceAuthMiddleware

| メソッド | 入力 | 出力 | 目的 |
|---|---|---|---|
| `process_request(request)` | `HttpRequest` | `HttpRequest (device_id付与)` | X-Device-ID ヘッダーから UUID を抽出・検証し request.device_id にセット |

---

## API エンドポイント一覧

| メソッド | パス | 機能 | 対応FR |
|---|---|---|---|
| POST | `/api/trips/` | 旅を開始 | FR-01 |
| GET | `/api/trips/` | 旅の一覧取得 | FR-04 |
| GET | `/api/trips/{id}/` | 旅の詳細取得 | FR-04 |
| POST | `/api/trips/{id}/progress/` | 進捗報告 | FR-02 |
| POST | `/api/trips/{id}/drop_off/` | 途中下車 | FR-03 |
| POST | `/api/trips/{id}/confirm_fadeout/` | フェードアウト確認応答 | FR-03 |
| GET | `/api/analysis/` | 横断分析結果取得 | FR-05 |
| GET | `/api/analysis/suggestions/` | 次の旅先提案取得 | FR-05 |
| PUT | `/api/notifications/{trip_id}/schedule/` | 通知時刻設定 | FR-07 |
| POST | `/api/notifications/device-token/` | FCMデバイストークン登録 | FR-07 |
| GET | `/api/timeline/` | 匿名タイムライン取得 | FR-06 |

全エンドポイントは `X-Device-ID` ヘッダー（UUID形式）によるデバイス認証を使用。
