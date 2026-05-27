# 要件確認質問

以下の質問に回答してください。各質問の `[Answer]:` タグの後に選択肢の文字を記入してください。
選択肢に合うものがない場合は、最後の選択肢（Other）を選び、`[Answer]:` タグの後に説明を記入してください。

---

## Question 1
このプロジェクトのターゲットプラットフォームは何ですか？

A) Webアプリケーション（ブラウザベース）
B) モバイルアプリ（iOS/Android）
C) Webアプリ + モバイルアプリ（両方）
D) PWA（Progressive Web App）— Webベースだがモバイルアプリ的な体験
X) Other (please describe after [Answer]: tag below)

[Answer]: BかD、Dでも実現可能なんでしょうか。

---

## Question 2
ユーザー認証はどの方式を想定していますか？

A) メールアドレス + パスワード
B) ソーシャルログイン（Google, Apple等）
C) メール + ソーシャルログインの両方
D) 認証なし（匿名利用のみ）
X) Other (please describe after [Answer]: tag below)

[Answer]: わざわざアカウントを作るのが面倒ですよね。Dができればいいですが、何らかの認証・連携は必要な気もします。

---

## Question 3
AI機能（マイルストーン生成、「得たもの」提示、横断分析）に使用するAIサービスはどれを想定していますか？

A) Amazon Bedrock（Claude, Titan等）
B) OpenAI API（GPT-4等）
C) 自前のモデル / セルフホスト
D) まだ決めていない（推奨を提案してほしい）
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4
バックエンドのインフラ/デプロイ先はどこを想定していますか？

A) AWS（Lambda, API Gateway, DynamoDB等のサーバーレス構成）
B) AWS（ECS/EKS等のコンテナ構成）
C) その他のクラウド（GCP, Azure等）
D) まだ決めていない（推奨を提案してほしい）
X) Other (please describe after [Answer]: tag below)

[Answer]: Dockerに慣れているので、この場合はBになりますか？

---

## Question 5
フロントエンドの技術スタックはどれを想定していますか？

A) React（Next.js）
B) React（Vite / SPA）
C) Vue.js（Nuxt.js）
D) まだ決めていない（推奨を提案してほしい）
X) Other (please describe after [Answer]: tag below)

[Answer]: Aだと楽ですが、モバイルだと他のになるんでしょうか。

---

## Question 6
通知機能（マイルストーンベースの軽い通知）の配信方法はどれを想定していますか？

A) プッシュ通知（ブラウザ / モバイル）
B) メール通知
C) アプリ内通知のみ（次回アクセス時に表示）
D) プッシュ通知 + アプリ内通知の組み合わせ
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7
想定ユーザー規模はどの程度ですか？（初期リリース時）

A) 小規模（〜100人）— ハッカソンデモ / PoC
B) 中規模（100〜1,000人）— 限定公開ベータ
C) 大規模（1,000人以上）— 一般公開
D) まだ決めていない
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 8
「フェードアウト後にそっと確認」の判定ロジックについて、どの程度の期間無活動で「卒業候補」とみなしますか？

A) 3日間無活動
B) 7日間無活動
C) 14日間無活動
D) ユーザーが自分で期間を設定できる
X) Other (please describe after [Answer]: tag below)

[Answer]: ここは重要ですね。長すぎてもあれなので、Aがいい気もします。

---

## Question 9
データの永続化（ユーザーの卒業履歴、得たもの等）はどこに保存しますか？

A) クラウドデータベース（DynamoDB, RDS等）— アカウント連携で複数デバイス同期
B) ローカルストレージのみ（ブラウザ / デバイス内）— アカウント不要
C) クラウド + ローカルキャッシュのハイブリッド
D) まだ決めていない（推奨を提案してほしい）
X) Other (please describe after [Answer]: tag below)

[Answer]: アカウントなしならBになりますが、もし「他の人の卒業を見せる」みたいな機能も入れるならAかCになるんでしょうか。要相談。

---

## Question 10
ハッカソンの制約について教えてください。提出期限や技術的な制約はありますか？

A) 期限あり（具体的な日時を[Answer]:の後に記入してください）
B) 特に期限なし — 自分のペースで開発
C) AWS サービスの使用が必須条件
D) AとCの両方（期限あり + AWS必須）
X) Other (please describe after [Answer]: tag below)

[Answer]: Aで、 # aws-summit-2026-hackathon.md に記載はしてありますが、意識せずとも間に合うのではと思っています。

---

## Question 11
多言語対応は必要ですか？

A) 日本語のみ
B) 日本語 + 英語
C) 多言語対応（3言語以上）
D) まだ決めていない
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 12: セキュリティ拡張
このプロジェクトにセキュリティ拡張ルールを適用しますか？

A) はい — すべてのセキュリティルールをブロッキング制約として適用する（本番グレードのアプリケーション向け推奨）
B) いいえ — セキュリティルールをスキップする（PoC、プロトタイプ、実験的プロジェクト向け）
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 13: プロパティベーステスト拡張
このプロジェクトにプロパティベーステスト（PBT）ルールを適用しますか？

A) はい — すべてのPBTルールをブロッキング制約として適用する（ビジネスロジック、データ変換、シリアライゼーション、ステートフルコンポーネントを持つプロジェクト向け推奨）
B) 部分的 — 純粋関数とシリアライゼーションのラウンドトリップにのみPBTルールを適用する
C) いいえ — PBTルールをスキップする（シンプルなCRUDアプリ、UIのみのプロジェクト、薄い統合レイヤー向け）
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---
