# コンポーネント定義（v2）

## 概要
Django REST Framework バックエンドを機能ドメイン別に4アプリ + 共通ユーティリティパッケージで構成する。
フロントエンドは React Native（モバイル）+ React SPA（Web版）の2系統。
バックエンドは1つのDRFプロジェクトで、EKS上の2つのDeployment（App Worker / Backend Worker）として動作する。

---

## バックエンド コンポーネント

### 1. trips（旅アプリ）
**責務**: 旅のライフサイクル管理（出発〜道中〜途中下車）

| 責務 | 説明 |
|---|---|
| 旅の作成 | テンプレート選択 or 自由入力で旅を開始 |
| 道標管理 | AI生成された道標の保存・取得 |
| 進捗報告 | 任意の進捗記録 |
| 途中下車 | 自発的 or フェードアウト後の途中下車処理 |
| 景色管理 | AI提示された「得たもの」の採用・編集・追加 |

**コレクション**: trips, milestones, progress, sceneries

---

### 2. analysis（分析アプリ）
**責務**: 横断分析とパターン発見、次の旅先提案

| 責務 | 説明 |
|---|---|
| パターン分析 | 複数の旅を横断して方向性を発見 |
| 次の旅先提案 | パターンに基づく提案生成 |
| 分析結果保存 | 分析結果のキャッシュ・保存 |

**コレクション**: analysis_results, suggestions

---

### 3. notifications（通知アプリ）
**責務**: プッシュ通知のスケジューリングと送信（FCM）

| 責務 | 説明 |
|---|---|
| 通知スケジュール管理 | ユーザーごとの通知時刻設定 |
| 道標通知 | 道標に近づいた際の通知生成 |
| フェードアウト確認 | 3日間無活動時の確認通知 |
| FCM送信 | Firebase Cloud Messaging によるプッシュ通知送信 |
| デバイストークン管理 | FCMデバイストークンの登録・更新 |

**コレクション**: notification_schedules, notification_logs, device_tokens

---

### 4. social（ソーシャルアプリ）
**責務**: 匿名タイムラインの提供

| 責務 | 説明 |
|---|---|
| タイムライン取得 | 最新N件の途中下車を匿名化して返す |
| 匿名化処理 | 個人特定情報の除去 |

**コレクション**: （tripsコレクションを参照、独自コレクションなし）

---

### 5. utils（共通パッケージ — Django アプリではない）
**責務**: 横断的な共通機能を提供する Python パッケージ

| 責務 | 説明 |
|---|---|
| AI連携 | Bedrock（Claude）への全AI呼び出しを集約 |
| デバイスID管理 | 匿名認証のデバイスID処理（ミドルウェア） |
| テンプレート管理 | 旅のテンプレートデータ |

**主要クラス**: AIService（ai_generator.py）, DeviceAuthMiddleware
**コレクション**: なし
**INSTALLED_APPS**: 登録しない

**デバイスID方針**:
- モバイル: SecureStore で UUID を生成・保存
- Web: `crypto.randomUUID()` で生成し localStorage に保存
- 全APIリクエストに `X-Device-ID` ヘッダーとして付与
- ミドルウェアで UUID 形式を検証し、不正な場合は 400 を返す
- 各コレクションの `device_id` フィールドで紐付け（インデックス付与）

---

## フロントエンド コンポーネント

### モバイル（React Native + Expo）

#### ナビゲーション構成（Tab + Stack）

```
TabNavigator (下部4タブ)
├── 旅の記録 (TripsTab)
│   └── Stack: TripList → TripDetail
├── 旅に出る (StartTripTab)
│   └── Stack: TemplateSelect / FreeInput → TripStarted
├── 横断分析 (AnalysisTab)
│   └── Stack: AnalysisView → SuggestionDetail
└── タイムライン (TimelineTab)
    └── Stack: TimelineFeed

StackNavigator (タブ外)
├── Settings (設定画面)
├── NotificationSettings (通知設定)
└── TripDropOff (途中下車フロー)
```

#### 主要画面コンポーネント

| 画面 | 責務 | 対応機能 |
|---|---|---|
| TripListScreen | 途中下車した旅の一覧 | FR-04 |
| TripDetailScreen | 旅の詳細（景色、道標、期間） | FR-04 |
| TemplateSelectScreen | テンプレートから旅に出る | FR-01 |
| FreeInputScreen | 自由入力で旅に出る | FR-01 |
| TripActiveScreen | 道中画面（進捗報告） | FR-02 |
| DropOffScreen | 途中下車フロー（景色確認・編集） | FR-03 |
| AnalysisScreen | 横断分析結果表示 | FR-05 |
| SuggestionScreen | 次の旅先提案 | FR-05 |
| TimelineScreen | 匿名タイムライン | FR-06 |
| SettingsScreen | 設定（通知時刻等） | — |

#### 共通UIコンポーネント

| コンポーネント | 責務 |
|---|---|
| TripCard | 旅の一覧カード表示 |
| MilestoneList | 道標の一覧表示 |
| SceneryEditor | 景色（得たもの）の表示・編集 |
| SuggestionCard | 次の旅先提案カード |
| TimelineItem | タイムラインの各アイテム |
| TripCounter | 旅の数（始めた回数）表示 |

---

### Web版（React SPA）

#### ルーティング構成（React Router）

```
/                    → TripList（一覧画面）
/trips/new           → TripStart（旅に出る）
/trips/:id           → TripDetail（旅の詳細）
/trips/:id/active    → TripActive（道中）
/trips/:id/drop-off  → TripDropOff（途中下車）
/analysis            → Analysis（横断分析）
/timeline            → Timeline（タイムライン）
/settings            → Settings（設定）
```

#### 設計方針
- React Native と同じAPI（DRF）を呼び出す
- UIコンポーネントは別実装（Web用）だが、画面構成・フローは同一
- App Worker（EKS）が SPA の静的ファイルを配信
- PoC段階ではモバイル優先、Web版は最小限の実装

---

## EKS Worker 構成

### App Worker
**役割**: Web版（PC/ブラウザ向け）のサービング

| 責務 | 説明 |
|---|---|
| SPA配信 | React SPA の静的ファイルを配信（WhiteNoise or nginx sidecar） |
| API提供 | Web版からのAPIリクエストを処理（DRF） |

**Deployment設定**: HPA（CPU/メモリベース）

### Backend Worker
**役割**: モバイル向けAPI + バッチ処理

| 責務 | 説明 |
|---|---|
| モバイルAPI | React Native からのAPIリクエストを処理（DRF） |
| バッチ処理 | 道標通知送信、フェードアウト検知 |
| AI呼び出し | Bedrock への非同期処理 |
| Snowflake連携 | 定期バッチでのデータエクスポート |

**Deployment設定**: HPA（CPU/メモリベース）

### ALB Ingress ルーティング

| パス | 振り分け先 | 備考 |
|---|---|---|
| `/` (Web) | App Worker | Host ヘッダーまたはパスで判定 |
| `/api/*` (Web) | App Worker | Web版からのAPI |
| `/api/*` (Mobile) | Backend Worker | モバイルからのAPI |
| `/static/*` | App Worker | SPA静的ファイル |

※ 実質的にはHost-based routing（Web用ドメイン → App Worker、API用ドメイン → Backend Worker）が現実的。

---

## データストア

### DocumentDB（MongoDB互換）— 参照型

| コレクション | 所属アプリ | 主要フィールド |
|---|---|---|
| trips | trips | _id, device_id, title, category, status, started_at, dropped_off_at |
| milestones | trips | _id, trip_id, order, description, reached |
| progress | trips | _id, trip_id, content, reported_at |
| sceneries | trips | _id, trip_id, content, source (ai/user/edited) |
| analysis_results | analysis | _id, device_id, pattern_text, generated_at |
| suggestions | analysis | _id, device_id, analysis_id, title, reason |
| notification_schedules | notifications | _id, device_id, trip_id, notify_time, enabled |
| notification_logs | notifications | _id, device_id, type, sent_at, content |
| device_tokens | notifications | _id, device_id, fcm_token, platform, updated_at |

### インデックス設計

| コレクション | インデックス | 用途 |
|---|---|---|
| trips | `{device_id: 1, status: 1}` | ユーザーの旅一覧取得 |
| trips | `{status: 1, last_activity: 1}` | フェードアウト候補検出 |
| milestones | `{trip_id: 1, order: 1}` | 旅の道標取得 |
| sceneries | `{trip_id: 1}` | 旅の景色取得 |
| analysis_results | `{device_id: 1}` | ユーザーの分析結果取得 |
| notification_schedules | `{notify_time: 1, enabled: 1}` | バッチ送信対象取得 |
| device_tokens | `{device_id: 1}` | FCMトークン取得 |
