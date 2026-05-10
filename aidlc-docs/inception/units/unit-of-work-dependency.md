# ユニット間依存関係

## 依存関係図

```
Unit 1: 最小ループ（P1）
    │
    ├──────────────────┐
    ▼                  ▼
Unit 2: 横断分析（P2）  Unit 3: 通知+ソーシャル（P3+P4）
```

Unit 2 と Unit 3 は互いに独立。両方とも Unit 1 に依存する。

---

## 依存関係マトリクス

| ユニット | 依存先 | 依存内容 |
|---|---|---|
| Unit 1: 最小ループ | なし | 基盤ユニット。全インフラ・共通モジュールを含む |
| Unit 2: 横断分析 | Unit 1 | trips アプリのモデル（Trip, Scenery）を参照。AIService を利用 |
| Unit 3: 通知+ソーシャル | Unit 1 | trips アプリのモデル（Trip, Milestone, Progress）を参照。AIService を利用 |

---

## 共有リソース

| リソース | 提供元 | 利用先 |
|---|---|---|
| `utils/AIService` | Unit 1 で作成 | Unit 2, Unit 3 |
| `utils/DeviceAuthMiddleware` | Unit 1 で作成 | Unit 2, Unit 3 |
| `trips` モデル群 | Unit 1 で作成 | Unit 2, Unit 3 |
| RDS PostgreSQL | Unit 1 で構築 | Unit 2, Unit 3 |
| ECS Fargate | Unit 1 で構築 | Unit 2, Unit 3 |
| ALB | Unit 1 で構築 | Unit 2, Unit 3 |
| Amazon Bedrock 接続 | Unit 1 で設定 | Unit 2 |

---

## 統合ポイント

### Unit 1 → Unit 2 統合
- `analysis` アプリが `trips.models.Trip` と `trips.models.Scenery` をインポート
- `AnalysisService` が `AIService` をインポート
- フロントエンドの `/analysis` ページが既存レイアウトを共有

### Unit 1 → Unit 3 統合
- `notifications` アプリが `trips.models.Trip`, `trips.models.Milestone`, `trips.models.Progress` をインポート
- `NotificationService` が `AIService` をインポート
- `social` アプリが `trips.models.Trip`, `trips.models.Scenery` をインポート（読み取り専用）
- フロントエンドの `/timeline` ページが既存レイアウトを共有
- Service Worker を既存 PWA 設定に追加

---

## 並行開発の可能性

| シナリオ | 可否 | 備考 |
|---|---|---|
| Unit 2 と Unit 3 の並行開発 | ○ | 互いに独立。Unit 1 完了後なら同時着手可能 |
| Unit 1 と Unit 2 の並行開発 | × | Unit 2 は Unit 1 のモデルとインフラに依存 |
| Unit 1 と Unit 3 の並行開発 | × | Unit 3 は Unit 1 のモデルとインフラに依存 |

---

## リスクと緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| Unit 1 の trips モデル変更が Unit 2/3 に波及 | 中 | Unit 1 完了・承認後にモデルを凍結。変更が必要な場合はマイグレーションで対応 |
| AIService のインターフェース変更 | 低 | Unit 1 で安定したインターフェースを定義。追加メソッドは後方互換で追加 |
| インフラ構成の変更 | 低 | Unit 1 でインフラを確定。Unit 2/3 は追加リソースのみ（Scheduled Task 等） |
