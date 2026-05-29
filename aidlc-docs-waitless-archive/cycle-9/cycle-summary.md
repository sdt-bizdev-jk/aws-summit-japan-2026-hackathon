# WaitLess cycle-9 — サイクルサマリ

最終更新: 2026-05-29

> **注**: このサイクルは AIDLC プロセスを踏まずに実装された。
> `aidlc-docs/` は作成されていないため、サマリのみを記録する。
>
> **命名注意**: 一部のコードコメントに `// cycle-7` の表記があるが、
> これは cycle-9 で追加・改修されたコードを指す。

---

## 1. 実装スコープ (デスクリサーチ ダイジェスト)

**機能名**: デスクリサーチ ダイジェスト (Amazon Bedrock 連携)

待ち時間に閲覧した外部ページを、AI タブの「タスク文脈」(Claude.ai の会話タイトル + 直近ユーザー発話) と紐づけて記録。Amazon Bedrock (Claude モデル) でページ内容を要約し、ダッシュボードの新規「デスクリサーチ ダイジェスト」セクションに表示する。Bedrock 未設定時はローカル簡易要約にフォールバック。

### 変更ファイル

| 区分 | ファイル | 内容 |
|------|---------|------|
| 新規 | `extension/sw/bedrock_client.js` | Amazon Bedrock Runtime 軽量クライアント。Bearer Token / SigV4 両対応 |
| 新規 | `extension/sw/research_repository.js` | デスクリサーチレコードの永続化 (`chrome.storage.local.research_events`、上限 1000 件) |
| 改修 | `extension/sw/context_repository.js` | 本文抜粋上限 500 → 3000 文字に拡大。`captureTaskContext()` / `buildResearchDigest()` 追加 |
| 改修 | `extension/sw/wait_orchestrator.js` | `onCompletionDetected()` に research 記録呼び出しを追記 |
| 改修 | `extension/dashboard/dashboard.html` | 「デスクリサーチ ダイジェスト」セクション追加 |
| 改修 | `extension/dashboard/dashboard.js` | `readResearch()` + `renderResearch()` 追加 (タスク別グルーピング) |
| 改修 | `extension/dashboard/dashboard.css` | research セクション / バッジのスタイル追加 |
| 改修 | `extension/options/options.html` | Amazon Bedrock 設定セクション追加 (region / modelId / Bearer Token) |
| 改修 | `extension/options/options.js` | `initBedrockSettings()` 追加 |
| 改修 | `extension/manifest.json` | version `0.8.0` → `0.9.0` |

### 実装済みの機能

| 機能 | 内容 |
|------|------|
| タスク文脈取得 | `captureTaskContext(claudeTabId)`: Claude.ai の会話タイトル + 直近ユーザー発話 (最大 200 文字) を取得 |
| Bedrock 要約 | `BedrockClient.summarizePage(task, ctx)`: タスク文脈を踏まえて 3〜4 点の箇条書き要約を生成 |
| ローカルフォールバック | `buildResearchDigest(task, ctx)`: Bedrock 未設定/失敗時に見出し/タイトルを整形 |
| レコード永続化 | `ResearchRepository.appendResearch()`: `research_events` に最大 1000 件リングバッファ |
| ダッシュボード表示 | タスク別グルーピング、ダイジェスト表示、訪問ページのリンク一覧、Bedrock/ローカルバッジ |
| Bedrock 設定 UI | Options Page: region / modelId / Bearer Token の入力・保存 (`bedrock_config`) |

### Bedrock 認証方式

`bedrock_client.js` は 2 方式をサポートする:

| 方式 | 設定 | ヘッダー |
|------|------|---------|
| **Bearer Token** (優先) | `bedrockApiKey` を設定 | `Authorization: Bearer <token>` |
| **SigV4** | `accessKeyId` + `secretAccessKey` を設定 | 標準 AWS4-HMAC-SHA256 署名 |

Options Page からは Bearer Token のみ設定可能。SigV4 の設定 UI は未実装 (B-46)。

### データモデル (新規)

**`ResearchEvent`** (`chrome.storage.local.research_events`):

```js
{
  id          : "res-1717200000000",
  capturedAt  : 1717200000000,
  dateKey     : "2026-05-29",
  taskTitle   : "旅行計画を立てて",        // Claude.ai 会話タイトル
  taskText    : "箱根で2泊の旅程を...",    // 直近ユーザー発話抜粋
  leisureTitle: "箱根観光協会",
  leisureUrl  : "https://www.hakone.or.jp/",
  leisureDomain: "hakone.or.jp",
  leisureGenreId: "travel",
  digest      : "【Amazon Bedrock 要約】...",
  summarizedBy: "bedrock"                  // "bedrock" | "local"
}
```

**`bedrock_config`** (`chrome.storage.local.bedrock_config`):

```json
{ "region": "us-east-1", "modelId": "us.anthropic.claude-haiku-4-5-20251001-v1:0", "bedrockApiKey": "bedrock-api-key-XXX" }
```

---

## 2. 動作確認状況

自動テスト: なし (AIDLC 外で実装、テストスクリプト未作成)

手動確認:
- `bedrock_client.js` SigV4 署名の正確性: 未確認
- 実機 E2E (Claude.ai でタスク + 待ち時間 → Bedrock 要約 → ダッシュボード表示): 未実施
- Bedrock 未設定時のローカルフォールバック: 未実施

---

## 3. 新規制限事項

| ID | 内容 |
|----|------|
| B-43 | コードコメントの `// cycle-7` 表記誤り (実際は cycle-9 の実装) — Tech debt |
| B-44 | ダッシュボードのタスクグループで最新エントリの digest のみ表示 (各ページのダイジェスト個別表示が未実装) |
| B-45 | `research_events` のリセット / エクスポート UI なし (B-28/B-29 と同類) |
| B-46 | SigV4 認証の設定 UI 未実装 (Options Page は Bearer Token のみ。コードは両対応済み) |
| B-47 | `bedrock_client.js` / `research_repository.js` のデバッグログ常時 ON (`DEBUG = true`) |

---

## 4. 関連ドキュメント

- cycle-10 引き継ぎ: `docs/cycle-10-handover.md`