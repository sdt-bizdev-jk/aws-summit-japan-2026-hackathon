# コンポーネント定義

## 概要
Django バックエンドを機能ドメイン別に4アプリ + 共通ユーティリティパッケージで構成する。
utils は Django アプリではなく、各アプリからインポートする共通 Python パッケージ。
Next.js フロントエンドは App Router ベースのレイアウト共有構成。

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

**モデル**: Trip, Milestone, Progress, Scenery

---

### 2. analysis（分析アプリ）
**責務**: 横断分析とパターン発見、次の旅先提案

| 責務 | 説明 |
|---|---|
| パターン分析 | 複数の旅を横断して方向性を発見 |
| 次の旅先提案 | パターンに基づく提案生成 |
| 分析結果保存 | 分析結果のキャッシュ・保存 |

**モデル**: AnalysisResult, Suggestion

---

### 3. notifications（通知アプリ）
**責務**: プッシュ通知のスケジューリングと送信

| 責務 | 説明 |
|---|---|
| 通知スケジュール管理 | ユーザーごとの通知時刻設定 |
| 道標通知 | 道標に近づいた際の通知生成 |
| フェードアウト確認 | 3日間無活動時の確認通知 |
| 通知送信 | PWA Push Notification の送信 |

**モデル**: NotificationSchedule, NotificationLog

---

### 4. social（ソーシャルアプリ）
**責務**: 匿名タイムラインの提供

| 責務 | 説明 |
|---|---|
| タイムライン取得 | 最新N件の途中下車を匿名化して返す |
| 匿名化処理 | 個人特定情報の除去 |

**モデル**: （tripsのTripモデルを参照、独自モデルなし）

---

### 5. utils（共通パッケージ — Django アプリではない）
**責務**: 横断的な共通機能を提供する Python パッケージ

| 責務 | 説明 |
|---|---|
| AI連携 | Bedrock（Claude）への全AI呼び出しを集約 |
| デバイスID管理 | 匿名認証のデバイスID処理（ミドルウェア）。X-Device-ID ヘッダーの UUID を検証し request.device_id にセット |
| テンプレート管理 | 旅のテンプレートデータ |

**主要クラス**: AIService（ai_generator.py）, DeviceAuthMiddleware
**モデル**: なし（Device テーブル不要。各モデルが `device_id: UUIDField(db_index=True)` を直接保持）
**INSTALLED_APPS**: 登録しない

**デバイスID方針**:
- フロントエンドで `crypto.randomUUID()` により生成し localStorage に保存
- 全APIリクエストに `X-Device-ID` ヘッダーとして付与
- ミドルウェアで UUID 形式を検証し、不正な場合は 400 を返す
- 各モデルの `device_id` は Django の `UUIDField` を使用（PostgreSQL ネイティブ UUID 型にマッピング）

---

## フロントエンド コンポーネント

### ルーティング構成（App Router）

```
app/
├── (main)/
│   ├── layout.tsx          # 共通レイアウト（ナビゲーション）
│   ├── page.tsx            # ホーム（一覧画面）
│   ├── trips/
│   │   ├── new/
│   │   │   └── page.tsx    # 旅に出る
│   │   └── [id]/
│   │       └── page.tsx    # 旅の詳細
│   ├── analysis/
│   │   └── page.tsx        # 横断分析 + 次の旅先
│   └── timeline/
│       └── page.tsx        # ソーシャルタイムライン
```

### UI コンポーネント

| コンポーネント | 責務 |
|---|---|
| TripCard | 旅の一覧カード表示 |
| MilestoneList | 道標の一覧表示 |
| SceneryEditor | 景色（得たもの）の表示・編集 |
| TripStartForm | 旅の開始フォーム（テンプレ/自由入力） |
| AnalysisView | 横断分析結果の表示 |
| SuggestionCard | 次の旅先提案カード |
| TimelineItem | タイムラインの各アイテム |
| NotificationSettings | 通知時刻設定 |
