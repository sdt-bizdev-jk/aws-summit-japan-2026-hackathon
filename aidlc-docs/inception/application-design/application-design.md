# アプリケーション設計 — 統合ドキュメント（v2）

## 概要
「たびたび」v2のアプリケーション設計を統合的にまとめる。
v1（Django + Next.js + RDS）からv2（EKS + React Native + Web SPA + DocumentDB）への再設計。
詳細は各個別ドキュメントを参照。

---

## アーキテクチャ概要

```
┌──────────────────────┐  ┌──────────────────────────┐
│  React Native (Expo) │  │   React SPA (Web版)      │
│  iOS / Android       │  │   PC / ブラウザ           │
└──────────┬───────────┘  └────────────┬─────────────┘
           │                           │
           │ HTTP (REST API)           │ HTTP (REST API + SPA配信)
           ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│              ALB Ingress (WAF + Shield)                    │
│  Mobile → Backend Worker  |  Web → App Worker             │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              Django REST Framework (EKS)                   │
│              1つのDRFプロジェクト / 2 Deployments           │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐ ┌───────┐  │
│  │  trips   │ │ analysis │ │ notifications │ │social │  │
│  └────┬─────┘ └────┬─────┘ └──────┬────────┘ └───┬───┘  │
│       │             │              │              │       │
│       └─────────────┴──────────────┴──────────────┘       │
│                         │                                 │
│              ┌──────────┴──────────┐                      │
│              │   utils/AIService   │                      │
│              └──────────┬──────────┘                      │
└──────────────────────────┼────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
┌──────────────────┐ ┌──────────┐ ┌─────────┐
│   DocumentDB     │ │ Bedrock  │ │   FCM   │
│  (MongoDB互換)   │ │ (Claude) │ │ (通知)  │
└──────────────────┘ └──────────┘ └─────────┘
```

---

## 設計決定サマリ

| 決定事項 | 選択 | 理由 |
|---|---|---|
| バックエンド | Django REST Framework | v1の知見活用、チーム経験 |
| データモデル方針 | 参照型（コレクション分離） | v1のRDB設計をそのまま移行可能、柔軟性確保 |
| Worker構成 | 1 DRF プロジェクト / 2 Deployment | コードベース共通、ALBで振り分け |
| App Worker | Web版（エンドユーザー向け）配信 + API | PC/ブラウザ向けサービス |
| Backend Worker | モバイルAPI + バッチ処理 | React Native向け + CronJob |
| Django アプリ分割 | 機能ドメイン別4アプリ | v1踏襲、責務の明確な分離 |
| AI連携パターン | AIService に集約 | v1踏襲、プロンプト一元管理 |
| モバイルナビゲーション | Tab Navigation（下部4タブ）+ Stack | 機能数に適合、設定はStack |
| 通知方式 | FCM（Firebase Cloud Messaging） | React Native ネイティブ対応 |
| Snowflake連携 | バッチ（DocumentDB → S3 → Snowpipe） | PoC段階で十分、シンプル |
| ORM | MongoEngine | DocumentDB（MongoDB互換）対応 |

---

## コンポーネント構成

### バックエンド（Django REST Framework）

| アプリ | 責務 | 主要コレクション |
|---|---|---|
| trips | 旅のライフサイクル管理 | trips, milestones, progress, sceneries |
| analysis | 横断分析・次の旅先提案 | analysis_results, suggestions |
| notifications | 通知スケジューリング・FCM送信 | notification_schedules, notification_logs, device_tokens |
| social | 匿名タイムライン | （tripsコレクションを参照） |

| 共通パッケージ | 責務 | 備考 |
|---|---|---|
| utils | AI連携（AIService）・デバイス認証ミドルウェア・Snowflakeエクスポート | Djangoアプリではない。各アプリからインポートして使う共通モジュール |

### フロントエンド

| プラットフォーム | 技術 | 配信方式 |
|---|---|---|
| モバイル | React Native + Expo (Managed) | App Store / Google Play + OTA |
| Web | React SPA | App Worker が静的ファイル配信 |

---

## サービス層

| サービス | 主要責務 | AI依存 |
|---|---|---|
| TripService | 旅の作成、途中下車処理、フェードアウト検出 | ○ |
| AnalysisService | パターン分析、提案生成 | ○ |
| NotificationService | スケジュール管理、FCM送信 | ○ |
| SocialService | 匿名タイムライン取得 | × |

| 共通モジュール | 主要責務 | 備考 |
|---|---|---|
| AIService | Bedrock呼び出し集約、プロンプト管理 | utils パッケージ内 |
| SnowflakeExportService | DocumentDB → S3 エクスポート | utils パッケージ内 |

---

## 依存関係

```
utils/ (共通パッケージ: AIService, DeviceAuthMiddleware, SnowflakeExport)  ← 最下層
    ↑
trips              ← utils, notifications に依存
    ↑
analysis           ← trips, utils に依存
notifications      ← trips, utils に依存
social             ← trips に依存
```

循環依存なし。依存方向は常に一方向。

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

---

## バッチ処理（Kubernetes CronJob）

| CronJob | 実行頻度 | 処理内容 | 実行Worker |
|---|---|---|---|
| `send-notifications` | 毎分 | 送信時刻に達した通知をFCM送信 | Backend Worker |
| `check-fadeout` | 1日1回 | 3日間無活動の旅を検出し確認通知を送信 | Backend Worker |
| `export-to-snowflake` | 1日1回 | DocumentDB → S3 エクスポート | Backend Worker |

---

## EKS Worker 構成

| Worker | 役割 | ルーティング |
|---|---|---|
| App Worker | Web版SPA配信 + Web向けAPI | Host-based (web.tabitabi.example.com) |
| Backend Worker | モバイルAPI + バッチ + CronJob | Host-based (api.tabitabi.example.com) |

- 同じDRFプロジェクト、同じコードベース
- 環境変数 `WORKER_MODE=app|backend` でモード切替
- HPA（Horizontal Pod Autoscaler）でオートスケール

---

## モバイル ナビゲーション構成

```
TabNavigator (下部4タブ)
├── 旅の記録 (TripList → TripDetail)
├── 旅に出る (TemplateSelect / FreeInput → TripStarted)
├── 横断分析 (AnalysisView → SuggestionDetail)
└── タイムライン (TimelineFeed)

StackNavigator (タブ外)
├── Settings (設定)
├── NotificationSettings (通知設定)
└── TripDropOff (途中下車フロー)
```

---

## v1 → v2 設計変更サマリ

| 項目 | v1 | v2 |
|---|---|---|
| バックエンド | Django (ECS Fargate) | Django REST Framework (EKS) |
| ORM | Django ORM (PostgreSQL) | MongoEngine (DocumentDB) |
| フロントエンド | Next.js 16 (PWA) | React Native (Expo) + React SPA |
| 通知 | PWA Push (Service Worker) | FCM (firebase-admin) |
| バッチ実行 | ECS Scheduled Task | Kubernetes CronJob |
| Worker構成 | 単一サービス | App Worker + Backend Worker (1 DRF) |
| データモデル | RDB テーブル | DocumentDB コレクション（参照型） |
| Snowflake連携 | なし | バッチ（S3 → Snowpipe） |

---

## 詳細ドキュメント

- [コンポーネント定義](./components.md)
- [コンポーネントメソッド](./component-methods.md)
- [サービス定義](./services.md)
- [依存関係](./component-dependency.md)
