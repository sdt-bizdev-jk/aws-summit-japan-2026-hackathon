# AWSアーキテクチャ構成

## 概要

AWS上に構築されたWebアプリケーション・モバイルアプリの統合基盤。EKS（Kubernetes）をコアに、フロントセキュリティ・監視・SIEMに加え、**生成AI（Bedrock）** と **DWH（Snowflake）** を組み込んだ構成。

---

## 1. ユーザーアクセス層

| ユーザー区分 | アクセス経路 |
|---|---|
| End User（PC） | ALB Ingress → App Worker |
| End User（Mobile） | ALB Ingress → Backend Worker |
| Mobile App配布 | App Store / Google Play |

---

## 2. フロントセキュリティ（Front Security）

| サービス | 役割 |
|---|---|
| WAF | Webアプリケーションファイアウォール |
| Shield | DDoS対策 |

---

## 3. アプリケーション層（EKS上で稼働）

### App Worker
- 複数Pod構成
- HPA（Horizontal Pod Autoscaler）でオートスケール
- Fluentdでログ収集

### Backend Worker
- 複数Pod構成
- HPAでオートスケール
- Fluentdでログ収集
- EKSで管理

> App Worker と Backend Worker は双方向で連携。

---

## 4. ファンクション・データベース層（Function / DB）

| サービス | 用途 |
|---|---|
| Lambda | サーバーレス処理 |
| DocumentDB | ドキュメント型DB |

> Backend Worker と連携して動作。

---

## 5. 生成AI層（Generative AI）🆕

| サービス | 用途 |
|---|---|
| Bedrock | 生成AI基盤モデルの呼び出し |

> Backend Worker から呼び出され、AI機能を提供。

---

## 6. クロスプラットフォーム（Cross Platform）

| サービス | 用途 |
|---|---|
| Expo | React Nativeアプリのビルド／配信 |
| Firebase | Notification、OTA（Over The Air）アップデート配信 |

> End User（Mobile）に対してプッシュ通知やアプリ更新を配信。

---

## 7. 監視（Monitoring）

| サービス | 役割 |
|---|---|
| CloudWatch | メトリクス・ログ監視 |
| Config | 構成管理・コンプライアンスチェック |

---

## 8. セキュリティ（Security）

| サービス | 役割 |
|---|---|
| Inspector | 脆弱性スキャン |
| CloudTrail | APIアクティビティログ |
| GuardDuty | 脅威検知 |

---

## 9. SIEM（ログ集約・分析基盤）

| サービス | 役割 |
|---|---|
| Elasticsearch Service | ログ検索 |
| Kibana | 可視化ダッシュボード |

---

## 10. ログ収集・ルーティング

| サービス | 役割 |
|---|---|
| Kinesis Data Firehose | ログ・ストリーミングデータの集約 |
| Route 53 | DNS |

---

## 11. データウェアハウス（DWH）🆕

| サービス | 役割 |
|---|---|
| Snowflake | クラウドデータウェアハウス（AWS外部連携） |

> AWS基盤からログ・分析データを連携し、BIや横断分析の基盤として利用。

---

## 12. 通知・サポート連携

- 監視・セキュリティイベントは **Slack** に Alert として通知
- **Support Center** には以下の経路で情報集約
  - Slack経由のアラート通知
  - SIEMからのDashboard表示
  - **Snowflake からのデータ連携**（DWHベースの分析）

---

## データフローまとめ

1. **PCユーザー**
   `ALB Ingress → WAF/Shield → App Worker → Backend Worker → Function/DB`

2. **モバイルユーザー**
   `ALB Ingress → Backend Worker → Function/DB`
   加えて Cross Platform（Expo/Firebase）から通知・OTA配信

3. **生成AI連携** 🆕
   `Backend Worker → Bedrock`

4. **ログ・イベント**
   `Fluentd / Kinesis Data Firehose → SIEM（Elasticsearch + Kibana）`

5. **監視・セキュリティ**
   `CloudWatch / Inspector / GuardDuty 等 → Slack（Alert）→ Support Center（Dashboard）`

6. **DWH連携** 🆕
   `AWS → Snowflake（DWH）→ Support Center`

---

## 構成上のポイント

- **EKSベースのマイクロサービス構成**：App Worker と Backend Worker を分離し、HPAでスケーラビリティを確保
- **多層防御**：WAF/Shield（フロント）＋ Inspector/GuardDuty/CloudTrail（バックエンド）
- **観測性の集約**：Fluentd → Kinesis Data Firehose → Elasticsearch + Kibana の流れでログを一元化
- **モバイル対応**：Expo + Firebase によるOTAアップデートとプッシュ通知
- **生成AI機能の統合** 🆕：Bedrock を Backend Worker から呼び出してAI機能を提供
- **データ基盤の拡張** 🆕：Snowflake を AWS外部 DWH として連携し、分析・BI基盤を強化
- **運用連携**：Slack によるアラート通知 + Support Center でのダッシュボード監視

---

## 旧構成からの主な変更点

| 項目 | 変更内容 |
|---|---|
| Mail / DB → Function / DB | SES が削除、Lambda + DocumentDB のみに集約 |
| Generative AI（Bedrock） | 新規追加。Backend Worker から呼び出し |
| Snowflake（DWH） | 新規追加。AWS外部のDWHとして連携 |
