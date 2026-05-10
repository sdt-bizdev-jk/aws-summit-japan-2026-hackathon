# 要件確認 — フォローアップ質問

前回の回答にいくつか迷いや曖昧な点がありましたので、以下の質問で明確にさせてください。

---

## 背景情報（私からの補足）

回答を分析した結果、以下の点を整理します：

**Q1（プラットフォーム）について**: PWA は「Webベースだがモバイルアプリ的な体験」を提供します。プッシュ通知（Q6でA選択）もPWAで対応可能です。ネイティブアプリ（React Native等）と比較すると：
- **PWA**: Web技術のみで開発、ストア申請不要、プッシュ通知対応、オフライン対応可能。ただしiOSでは一部制限あり（通知許可のUXがやや劣る）
- **React Native**: ネイティブに近い体験、ストア配信可能、通知が安定。ただし開発コスト増

**Q2（認証）について**: 「アカウント作成が面倒」という観点は重要です。選択肢として：
- **匿名認証（デバイス紐付け）**: アカウント作成不要でデバイス内にデータ保持。機種変更時にデータ移行不可
- **オプショナル認証**: 最初は匿名で使い始め、後からアカウント連携（Google等）でバックアップ可能にする

**Q4（インフラ）について**: Docker経験があるとのことですが、ハッカソンのPoC規模（〜100人）であれば：
- **ECS Fargate**: Docker慣れしていれば自然。ただしコスト面でLambdaより高い
- **Lambda + API Gateway**: サーバーレスで運用コストほぼゼロ。Dockerイメージも使える（Lambda Container Image）
- **App Runner**: Dockerイメージをそのままデプロイ。ECSより設定が簡単

**Q9（データ永続化）について**: 「他の人の卒業を見せる」機能は面白いですが、PoC段階では：
- まずローカル（またはデバイス紐付けクラウド）で個人データのみ
- ソーシャル機能は将来拡張として位置づけ

---

## Clarification Question 1
プラットフォームについて、上記の補足を踏まえてどちらにしますか？

A) PWA — Web技術のみで開発。プッシュ通知対応。ストア申請不要。ハッカソンPoC向けに最適
B) React Native（Expo） — ネイティブアプリ体験。ストア配信可能。開発コストはやや増
C) PWA で開始し、将来的にネイティブ化を検討
X) Other (please describe after [Answer]: tag below)

[Answer]: 最終的に決勝でデモができればいいわけですよね。ならAでいいのかな？

---

## Clarification Question 2
認証方式について、上記の補足を踏まえてどちらにしますか？

A) 完全匿名（デバイス紐付け） — アカウント作成ゼロ。データはデバイス内のみ。最もシンプル
B) オプショナル認証 — 最初は匿名で使い始め、後からGoogleログイン等でバックアップ可能にする
C) ソーシャルログインのみ（Google/Apple） — ワンタップで完了。データはクラウド保存
X) Other (please describe after [Answer]: tag below)

[Answer]: 現状はAでいい気もします。

---

## Clarification Question 3
バックエンドのインフラについて、上記の補足を踏まえてどちらにしますか？

A) AWS App Runner — Dockerイメージをそのままデプロイ。ECSより設定簡単。Docker経験を活かせる
B) AWS Lambda（Container Image） — Dockerイメージを使えるサーバーレス。コストほぼゼロ。PoC向け最適
C) ECS Fargate — フルコンテナ環境。Docker経験を最大限活かせる。ただしPoC規模にはオーバースペック気味
X) Other (please describe after [Answer]: tag below)

[Answer]: Bかな？ここはあまり詳しくないので分かりませんが。

---

## Clarification Question 4
データ永続化について、PoC段階での方針を決めてください。

A) ローカルストレージのみ — 認証不要。最もシンプル。ソーシャル機能は将来拡張
B) DynamoDB（デバイスID紐付け） — アカウント不要だがクラウド保存。将来のアカウント連携に拡張しやすい
C) DynamoDB（認証連携） — アカウント必須だが複数デバイス同期可能
X) Other (please describe after [Answer]: tag below)

[Answer]: 他の人の卒業が流れてくる、というような機能をもし作るならどれになります？B？デバイスIDで自動的に紐づけられるならユーザーには手間がないのかな。

---

## Clarification Question 5
フロントエンドについて、Q1のプラットフォーム選択と合わせて確認します。PWAを選んだ場合、Next.jsで問題なく構築できます。

A) Next.js（React） — SSR/SSG対応、PWA化も容易、エコシステム充実
B) Vite + React — 軽量SPA、PWA化可能、ビルド高速
C) React Native（Expo） — Q1でBを選んだ場合のみ。モバイルネイティブ
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Clarification Question 6
書類審査の締切が **5月10日（日）23:59** ですが、今日は5月9日です。書類審査に必要なのはInceptionフェーズの成果物（README、設計ドキュメント）です。

A) 書類審査に間に合わせることを最優先 — Inceptionフェーズの成果物を今日中に完成させる
B) 書類審査は気にせず、自分のペースで進める — 予選（5/30）に向けてMVPを作ることを優先
C) 書類審査の成果物を最低限出しつつ、予選に向けて開発も進める
X) Other (please describe after [Answer]: tag below)

[Answer]: 普通にやったらInceptionフェーズは今日終わると思っています。もちろん書類審査は最優先ですが、特別急ぐ必要はないのでは？

---
