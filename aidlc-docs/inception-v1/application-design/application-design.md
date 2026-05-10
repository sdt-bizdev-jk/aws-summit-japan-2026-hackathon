# アプリケーション設計 — 統合ドキュメント

## 概要
「たびたび」のアプリケーション設計を統合的にまとめる。
詳細は各個別ドキュメントを参照。

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                  │
│              App Router + PWA + Service Worker            │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP (REST API)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    ALB (Application Load Balancer)        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Django (ECS Fargate)                         │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐ ┌───────┐ │
│  │  trips   │ │ analysis │ │ notifications │ │social │ │
│  └────┬─────┘ └────┬─────┘ └──────┬────────┘ └───┬───┘ │
│       │             │              │              │      │
│       └─────────────┴──────────────┴──────────────┘      │
│                         │                                │
│              ┌──────────┴──────────┐                     │
│              │   utils/AIService   │                     │
│              └──────────┬──────────┘                     │
└─────────────────────────┼───────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼                       ▼
┌──────────────────┐    ┌──────────────────────┐
│  RDS PostgreSQL  │    │  Amazon Bedrock      │
│  (データ永続化)   │    │  (Claude - AI生成)    │
└──────────────────┘    └──────────────────────┘
```

---

## 設計決定サマリ

| 決定事項 | 選択 | 理由 |
|---|---|---|
| Django アプリ分割 | 機能ドメイン別4アプリ | 責務の明確な分離、独立した開発・テスト |
| AI連携パターン | AIService に集約 | プロンプト一元管理、エラーハンドリング統一 |
| フロントエンド構成 | App Router + レイアウト共有 | Next.js 16 推奨パターン、コード共有が容易 |
| 通知方式 | ユーザーごと時刻設定 + バッチ送信 | 柔軟性と実装シンプルさのバランス |
| ソーシャルデータ取得 | 単純DB読み取り | PoC規模で十分、オーバーエンジニアリング回避 |

---

## コンポーネント構成

### バックエンド（Django）

| アプリ | 責務 | 主要モデル |
|---|---|---|
| trips | 旅のライフサイクル管理 | Trip, Milestone, Progress, Scenery |
| analysis | 横断分析・次の旅先提案 | AnalysisResult, Suggestion |
| notifications | 通知スケジューリング・送信 | NotificationSchedule, NotificationLog |
| social | 匿名タイムライン | （tripsのモデルを参照） |

| 共通パッケージ | 責務 | 備考 |
|---|---|---|
| utils | AI連携（AIService）・デバイス認証ミドルウェア | Djangoアプリではない。モデルなし。各アプリからインポートして使う共通モジュール |

### フロントエンド（Next.js 16）

| ルート | 画面 | 対応機能 |
|---|---|---|
| `/` | ホーム（一覧画面） | FR-04: 途中下車した旅の一覧 |
| `/trips/new` | 旅に出る | FR-01: 旅の開始 |
| `/trips/[id]` | 旅の詳細 | FR-02, FR-03: 道中・途中下車 |
| `/analysis` | 横断分析 | FR-05: パターン発見・提案 |
| `/timeline` | タイムライン | FR-06: ソーシャル機能 |

---

## サービス層

| サービス | 主要責務 | AI依存 |
|---|---|---|
| TripService | 旅の作成、途中下車処理、フェードアウト検出 | ○ |
| AnalysisService | パターン分析、提案生成 | ○ |
| NotificationService | スケジュール管理、バッチ送信 | ○ |
| SocialService | 匿名タイムライン取得 | × |

| 共通モジュール | 主要責務 | 備考 |
|---|---|---|
| AIService | Bedrock呼び出し集約、プロンプト管理 | utils パッケージ内。各サービスからインポート |

---

## 依存関係

```
utils/ (共通パッケージ: AIService, DeviceAuthMiddleware)  ← 最下層、依存なし
    ↑
trips              ← utils, notifications に依存
    ↑
analysis           ← trips, utils に依存
notifications      ← trips, utils に依存
social             ← trips に依存
```

循環依存なし。依存方向は常に一方向。utils は Django アプリではなく共通 Python パッケージ。

---

## API エンドポイント一覧

| メソッド | パス | 機能 |
|---|---|---|
| POST | `/api/trips/` | 旅を開始 |
| GET | `/api/trips/` | 旅の一覧取得 |
| GET | `/api/trips/{id}/` | 旅の詳細取得 |
| POST | `/api/trips/{id}/progress/` | 進捗報告 |
| POST | `/api/trips/{id}/drop_off/` | 途中下車 |
| POST | `/api/trips/{id}/confirm_fadeout/` | フェードアウト確認応答 |
| GET | `/api/analysis/` | 横断分析結果取得 |
| GET | `/api/analysis/suggestions/` | 次の旅先提案取得 |
| PUT | `/api/notifications/{trip_id}/schedule/` | 通知時刻設定 |
| POST | `/api/notifications/subscribe/` | Push Subscription 登録 |
| GET | `/api/timeline/` | 匿名タイムライン取得 |

全エンドポイントは `X-Device-ID` ヘッダー（UUID形式）によるデバイス認証を使用。Device テーブルは持たず、各モデルの `device_id: UUIDField` で直接紐付ける。

---

## バッチ処理

| コマンド | 実行頻度 | 処理内容 |
|---|---|---|
| `python manage.py send_notifications` | 毎分 | 送信時刻に達した通知を処理 |
| `python manage.py check_fadeout` | 1日1回 | 3日間無活動の旅を検出 |

ECS Scheduled Task（CloudWatch Events）で定期実行。

---

## 詳細ドキュメント

- [コンポーネント定義](./components.md)
- [コンポーネントメソッド](./component-methods.md)
- [サービス定義](./services.md)
- [依存関係](./component-dependency.md)
