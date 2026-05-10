# Unit of Work Plan（v2）

## 目的
Application Design で定義されたコンポーネント構成を、開発可能なユニット（Unit of Work）に分解する。
各ユニットは CONSTRUCTION フェーズで個別に設計・実装される。

## 前提（Application Design より）
- バックエンド: Django REST Framework（1 DRFプロジェクト / 2 Deployment）
- Django アプリ: trips, analysis, notifications, social + utils（共通パッケージ）
- フロントエンド: React Native（Expo）+ React SPA
- インフラ: EKS + DocumentDB + Bedrock + FCM + Snowflake
- IaC: AWS CDK（Python）
- 監視: Fluentd → Kinesis → Elasticsearch + Kibana
- セキュリティ: WAF + Shield + Inspector + GuardDuty + CloudTrail

---

## 設計質問

### Q1: ユニット分割の粒度
開発ユニットの分割方針を選んでください。

- **A**: レイヤー別（バックエンド全体 / フロントエンド全体 / インフラ全体）— 3ユニット
- **B**: 機能ドメイン別（trips / analysis / notifications / social + フロントエンド + インフラ）— 6ユニット
- **C**: デプロイ単位別（Backend Worker + API / App Worker + Web SPA / Mobile App / Infrastructure + Security + Monitoring）— 4ユニット
- **D**: ハイブリッド（コアバックエンド + フロントエンド + インフラ/監視/セキュリティ）— 3ユニット、ただしバックエンドは全Djangoアプリを1ユニットにまとめる
- **E**: その他（自由記述）

[Answer]: Bの機能ごとにしつつ、Web版は後回しにしようと考えています。

---

### Q2: フロントエンドの分割
React Native（モバイル）と React SPA（Web版）の開発ユニットをどう扱いますか？

- **A**: 1ユニットにまとめる（モバイル + Web を同時に開発）
- **B**: 別ユニット（モバイル優先で先に実装、Web版は後から）
- **C**: PoC段階ではモバイルのみ実装し、Web版は設計だけ残して実装しない

[Answer]: 上に同じく、Bの別ユニットで。

---

### Q3: インフラ・セキュリティ・監視の扱い
CDK、セキュリティ（WAF/Shield/Inspector/GuardDuty/CloudTrail）、監視（Fluentd/Kinesis/Elasticsearch）をどう分割しますか？

- **A**: 全て1ユニット（Infrastructure）にまとめる
- **B**: 基盤インフラ（EKS/DocumentDB/ALB）とセキュリティ/監視を分ける — 2ユニット
- **C**: インフラはバックエンドユニットに含め、独立ユニットにしない（CDKコードをバックエンドと一緒に開発）

[Answer]: B

---

### Q4: 開発順序の優先度
ユニットの実装順序について、どの方針を取りますか？

- **A**: バックエンド → フロントエンド → インフラ（API完成後にUI、最後にデプロイ基盤）
- **B**: インフラ → バックエンド → フロントエンド（環境構築を先に、その上にアプリ）
- **C**: コア機能（旅の開始〜途中下車）を縦断的に先に完成させ、残りを後から追加
- **D**: その他（自由記述）

[Answer]: A

---

---

## 回答分析

### 解釈結果
- **分割方針**: 機能ドメイン別（バックエンド4アプリ個別）+ フロントエンド2系統 + インフラ2系統 = 最大8ユニット
- **Web版**: 別ユニットとして後回し（設計は残すが実装優先度は低い）
- **インフラ**: 基盤（EKS/DocumentDB/ALB）とセキュリティ/監視を分離
- **開発順序**: バックエンド → フロントエンド → インフラ

### フォローアップ質問

#### Q5: utils（共通パッケージ）の扱い
utils パッケージ（AIService, DeviceAuthMiddleware, SnowflakeExport）は全バックエンドアプリが依存します。どう扱いますか？

- **A**: 独立ユニットとして最初に実装する（Unit 0 的な位置づけ）
- **B**: trips ユニットに含める（最初に実装するユニットなので、そこで一緒に作る）
- **C**: 各バックエンドユニットが必要な部分だけ都度実装する（分散）

[Answer]: B+Cハイブリッド。AIService + DeviceAuthMiddleware は trips ユニットで実装。SnowflakeExportService はインフラユニットで後から実装。

---

## 生成チェックリスト
- [x] Q1〜Q4 の回答を記入
- [x] 回答分析完了（Q5フォローアップ解決済み）
- [x] ユニット定義生成（unit-of-work.md）
- [x] 依存関係生成（unit-of-work-dependency.md）
- [x] ストーリーマッピング生成（unit-of-work-story-map.md）
- [x] 承認
