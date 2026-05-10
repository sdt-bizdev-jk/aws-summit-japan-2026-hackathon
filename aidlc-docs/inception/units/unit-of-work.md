# ユニット定義

## 概要
「たびたび」を優先度ベースで3つの開発ユニットに分解する。
各ユニットはフロントエンド + バックエンドを含むフルスタック単位で、ユニット内で即統合する。

---

## Unit 1: 最小ループ（P1）

### 目的
旅に出る → 途中下車 → 一覧表示の最小体験ループを完成させる。
これだけで「たびたび」のコアバリューが体験できる状態にする。

### スコープ

| レイヤー | 含まれるもの |
|---|---|
| Django apps | `trips`（全機能） |
| 共通モジュール | `utils`（AIService, DeviceAuthMiddleware） |
| Frontend | `/`（一覧）、`/trips/new`（旅に出る）、`/trips/[id]`（詳細・途中下車） |
| インフラ | ECS Fargate, RDS PostgreSQL, ALB, Amazon Bedrock, Next.js (Amplify or ECS) |
| バッチ | `check_fadeout`（フェードアウト検出） |

### 含まれる機能
- テンプレート / 自由入力で旅に出る
- AI道標生成
- 任意の進捗報告（UIは最小限）
- 自分から途中下車
- フェードアウト検出 + 確認
- 道中で見た景色の提示・編集
- 途中下車した旅の一覧表示
- 旅の詳細表示
- デバイスID認証

### 完了条件
- ユーザーが旅に出て、途中下車し、一覧で振り返れる
- AI道標と景色が生成される
- フェードアウト検出が動作する

---

## Unit 2: 横断分析 + 次の旅先提案（P2）

### 目的
複数の途中下車を横断分析し、パターン発見と次の旅先提案を行う。
「ダメなほど次が良くなる」のコア価値を実現する。

### スコープ

| レイヤー | 含まれるもの |
|---|---|
| Django apps | `analysis`（全機能） |
| Frontend | `/analysis`（横断分析画面） |
| インフラ | 追加なし（Unit 1 のインフラを利用） |
| バッチ | なし |

### 含まれる機能
- 横断分析（パターン発見）
- 次の旅先提案
- 分析結果の表示

### 前提条件
- Unit 1 が完了していること（trips データが存在する）
- AIService が利用可能であること

### 完了条件
- 3回以上途中下車したユーザーに対してパターン分析が表示される
- パターンに基づいた次の旅先提案が生成される

---

## Unit 3: 通知 + ソーシャル（P3 + P4）

### 目的
プッシュ通知とソーシャル機能を追加し、体験を豊かにする。

### スコープ

| レイヤー | 含まれるもの |
|---|---|
| Django apps | `notifications`（全機能）、`social`（全機能） |
| Frontend | `/timeline`（タイムライン画面）、通知許可UI |
| インフラ | Service Worker（PWA Push）、ECS Scheduled Task（通知バッチ） |
| バッチ | `send_notifications`（毎分実行） |

### 含まれる機能
- 道標ベースの通知
- フェードアウト確認通知
- ユーザーごと通知時刻設定
- Push Subscription 登録
- 匿名タイムライン閲覧

### 前提条件
- Unit 1 が完了していること（trips, milestones データが存在する）
- Service Worker が PWA として動作していること

### 完了条件
- 道標に近づいたときにプッシュ通知が届く
- 匿名タイムラインに他ユーザーの途中下車が表示される

---

## コード構成戦略

```
aws-summit-japan-2026-hackathon/   # ワークスペースルート
├── backend/                       # Django プロジェクト
│   ├── config/                    # Django設定 (settings, urls, wsgi)
│   ├── trips/                     # Unit 1
│   ├── analysis/                  # Unit 2
│   ├── notifications/             # Unit 3
│   ├── social/                    # Unit 3
│   ├── utils/                     # 共通モジュール (Unit 1で作成)
│   └── manage.py
├── frontend/                      # Next.js プロジェクト
│   ├── app/                       # App Router
│   │   ├── page.tsx               # Unit 1: 一覧
│   │   ├── trips/
│   │   │   ├── new/page.tsx       # Unit 1: 旅に出る
│   │   │   └── [id]/page.tsx      # Unit 1: 詳細・途中下車
│   │   ├── analysis/page.tsx      # Unit 2: 横断分析
│   │   └── timeline/page.tsx      # Unit 3: タイムライン
│   ├── components/                # 共有コンポーネント
│   ├── lib/                       # API クライアント等
│   └── public/
├── infra/                         # IaC (CDK or Terraform)
├── aidlc-docs/                    # 設計ドキュメント
└── docker-compose.yml             # ローカル開発環境
```

### 開発順序
1. **Unit 1** → 基盤 + コアループ完成
2. **Unit 2** → 横断分析追加（Unit 1 のデータに依存）
3. **Unit 3** → 通知 + ソーシャル追加（Unit 1 のデータに依存）

各ユニットはフロントエンド + バックエンドを同時に開発し、ユニット完了時点で統合テスト可能な状態にする。
