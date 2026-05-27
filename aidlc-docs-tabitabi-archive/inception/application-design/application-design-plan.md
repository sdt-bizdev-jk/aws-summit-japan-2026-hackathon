# Application Design Plan（v2）

## 目的
v1（Django + Next.js + RDS）の設計をベースに、v2アーキテクチャ（EKS + React Native + DocumentDB）に合わせて再設計する。

## v1からの引き継ぎ
- ドメイン分割（trips, analysis, notifications, social）の考え方
- サービス層のオーケストレーションフロー
- AIService集約パターン
- API エンドポイント設計

## v2で再設計が必要な部分
- バックエンド言語/フレームワーク選択
- DocumentDB向けデータモデル（RDB → ドキュメント指向）
- React Native画面構成（App Router → React Navigation）
- Worker分離の境界（App Worker vs Backend Worker）
- FCMプッシュ通知の実装方式
- Snowflake連携のデータフロー

---

## 設計質問

### Q1: バックエンド言語/フレームワーク
EKS上で動かすバックエンドの言語・フレームワークを選んでください。

- **A**: Python（FastAPI） — v1のDjango経験を活かしつつ、軽量非同期フレームワーク
- **B**: Python（Django REST Framework） — v1そのまま。EKS上でもDjangoは動く
- **C**: Node.js（Express/Fastify） — React Nativeとの言語統一
- **D**: Go — EKS/Kubernetes環境との親和性が高い、軽量コンテナ
- **E**: その他（自由記述）

[Answer]: ドキュメントに指定がなかったのであれば、Bで。

---

### Q2: DocumentDB データモデル方針
DocumentDBはMongoDB互換のドキュメントDBです。v1のRDB設計（Trip, Milestone, Progress, Scenery を別テーブル）をどう移行しますか？

- **A**: 埋め込み型 — Trip ドキュメントに milestones, progress, sceneries を全て埋め込む（1ドキュメント = 1旅の全情報）
- **B**: 参照型 — v1と同様にコレクションを分けて参照で繋ぐ（RDB的な使い方）
- **C**: ハイブリッド — Trip に milestones と sceneries を埋め込み、progress と analysis は別コレクション

[Answer]: B

---

### Q3: Worker分離の境界
requirements.md で「App Worker（PC向け）+ Backend Worker（モバイル向け + バッチ処理）」と定義されていますが、App Worker の役割をもう少し明確にしたいです。

- **A**: App Worker = 管理画面/ダッシュボード用（将来拡張）、Backend Worker = モバイルAPI + バッチ全て
- **B**: App Worker = 同期API（リクエスト-レスポンス）、Backend Worker = 非同期処理（バッチ、AI呼び出し、通知送信）
- **C**: PoC段階では Worker 1つに統合し、将来分離する前提で設計だけ分ける

[Answer]: Aで、管理画面ではなく普通にWeb版(エンドユーザー用)も作ろうと思っています。

---

### Q4: React Native ナビゲーション構成
React Native のナビゲーション構成を選んでください。

- **A**: Tab Navigation（下部タブ） — メイン画面（旅の記録）、旅に出る、横断分析、タイムライン の4タブ
- **B**: Stack + Tab ハイブリッド — 下部タブ3つ（旅の記録、横断分析、タイムライン）+ 旅に出るはFABボタンからモーダル
- **C**: Stack のみ — シンプルな画面遷移、タブなし
- **D**: その他（自由記述）

[Answer]: 機能数的にAでいい気もします。設定とかはStack (=ハンバーガー？)にいれてしまえばいいかなと。

---

### Q5: Snowflake連携タイミング
Snowflakeへのデータ連携方式を選んでください。

- **A**: リアルタイム連携 — DocumentDB Change Streams → Lambda → Snowflake
- **B**: バッチ連携 — 定期的にDocumentDBからエクスポート → S3 → Snowpipe → Snowflake
- **C**: PoC段階ではSnowflake連携は設計のみ、実装は後回し
- **D**: その他（自由記述）

[Answer]: 現状はBで！

---

## チェックリスト
- [x] Q1〜Q5 の回答を記入
- [x] 回答分析完了
- [x] フォローアップ質問（Q3補足確認 → 解決済み）
- [x] 設計アーティファクト生成
- [x] 承認 ✅
