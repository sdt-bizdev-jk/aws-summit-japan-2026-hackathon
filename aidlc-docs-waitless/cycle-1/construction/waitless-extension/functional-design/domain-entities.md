# Domain Entities — waitless-extension

**プロジェクト**: WaitLess
**ユニット**: U1 (waitless-extension)
**フェーズ**: CONSTRUCTION - Functional Design
**作成日**: 2026-05-26

このドキュメントは、Unit U1 のデータモデル (エンティティ) を詳細スキーマで定義する。素のJS 前提のため TypeScript の型ではなく JSDoc 風 + JSON 例で記述する。

---

## 1. Site (娯楽サイト登録エントリ)

### 1.1 スキーマ

```js
/**
 * @typedef {Object} Site
 * @property {string} domain    例: "youtube.com" (識別子、重複禁止)
 * @property {string} url       自動再生用 URL (フルURL、http(s)://...)
 * @property {number} priority  優先順位 (1 が最上位、連番)
 */
```

### 1.2 フィールド詳細

| フィールド | 型 | 必須 | 制約 | 例 |
|-----------|---|------|------|-----|
| domain | string | yes | 正規表現 `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`、1〜255 文字、小文字正規化、`www.` 除去 (BR-01) | `"youtube.com"` |
| url | string | yes | `new URL(input)` パース成功 + protocol が http/https、1〜2048 文字 (BR-02) | `"https://youtu.be/dQw4w9WgXcQ?autoplay=1"` |
| priority | number | yes | 1 始まりの整数連番 (BR-05) | `1` |

### 1.3 JSON 例

```json
{
  "domain": "youtube.com",
  "url": "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab",
  "priority": 1
}
```

### 1.4 不変条件

- `sites[]` 配列内で `domain` は一意 (BR-03)
- `priority` は 1 から始まる連番 (BR-05) — `1, 2, 3, ...` のように欠番なし

---

## 2. Settings (永続化されるユーザー設定)

### 2.1 スキーマ

```js
/**
 * @typedef {Object} Settings
 * @property {Site[]} sites
 * @property {number} thresholdSec  N秒判定しきい値 (デフォルト 5、範囲 1〜60)
 */
```

### 2.2 フィールド詳細

| フィールド | 型 | 必須 | デフォルト | 制約 |
|-----------|---|------|-----------|------|
| sites | Site[] | yes | `[]` | 重複なし、priority 連番 |
| thresholdSec | number | yes | 5 | 整数、1〜60 (BR-04) |

### 2.3 JSON 例 (アプリ層、camelCase)

```json
{
  "sites": [
    { "domain": "youtube.com", "url": "https://youtu.be/xxx?autoplay=1", "priority": 1 },
    { "domain": "x.com",       "url": "https://x.com/home",              "priority": 2 }
  ],
  "thresholdSec": 5
}
```

### 2.4 ストレージ層との対応 (snake_case ↔ camelCase)

`chrome.storage.local` ではキー命名を **snake_case** で統一する (Chrome のサンプルや既存拡張に倣う)。アプリ層 (JS コード) では camelCase で扱う。

```
[Storage layer (snake_case)]                    [App layer (camelCase)]
{                                                {
  "sites": [                          <--->          sites: [
    { "domain", "url", "priority" }                    { domain, url, priority }
  ],                                                 ],
  "threshold_sec": 5                                 thresholdSec: 5
}                                                }
```

SettingsRepository が境界で変換を行う。

---

## 3. RuntimeState (実行時状態)

### 3.1 スキーマ

```js
/**
 * @typedef {Object} RuntimeStateSnapshot
 * @property {boolean} isWaiting     現在 待ちサイクル中か
 * @property {number|null} claudeTabId   待ち発生時の Claude.ai タブID
 * @property {number|null} playTabId      切替先の娯楽タブID
 */
```

### 3.2 フィールド詳細

| フィールド | 型 | 必須 | 初期値 | 補足 |
|-----------|---|------|--------|------|
| isWaiting | boolean | yes | false | true の間は WAIT_DETECTED 重複を抑制 (BR-12) |
| claudeTabId | number \| null | yes | null | 待ち発生時の `sender.tab.id`、戻り先 |
| playTabId | number \| null | yes | null | 直近にアクティブ化した娯楽タブID |

### 3.3 ストレージ表現 (chrome.storage.session)

```json
{
  "runtime_state": {
    "isWaiting": false,
    "claudeTabId": null,
    "playTabId": null
  }
}
```

session ストレージはブラウザセッション終了で自動消滅する (Manifest V3 の仕様)。

### 3.4 不変条件

- `isWaiting=false` のとき、`claudeTabId` と `playTabId` は `null` であるべき (一貫性、BR-22)
- `isWaiting=true` のとき、`claudeTabId` は非 null であるべき (待ち発生サイクルで設定済)

---

## 4. Message (sendMessage の各タイプ)

### 4.1 共通エンベロープ

```js
/**
 * @typedef {Object} Message
 * @property {string} type       メッセージタイプ (大文字スネークケース)
 * @property {Object} payload    タイプ別のペイロード (省略可)
 */
```

### 4.2 タイプ別スキーマ

#### 4.2.1 `WAIT_DETECTED`
Content Script (Claude.ai) → Service Worker
```js
/**
 * @typedef {Object} WaitDetectedPayload
 * @property {number|null} claudeTabId  null の場合 SW で sender.tab.id を使う
 * @property {number} durationMs        既経過の待ち時間 (ms、参考)
 */
```
応答: なし (`return false`)

#### 4.2.2 `COMPLETION_DETECTED`
Content Script (Claude.ai) → Service Worker
```js
/**
 * @typedef {Object} CompletionDetectedPayload
 * @property {number|null} claudeTabId
 */
```
応答: なし

#### 4.2.3 `GET_SETTINGS`
Options Page → Service Worker
- ペイロード: なし (空オブジェクト)
- 応答: `Settings` (camelCase)

#### 4.2.4 `ADD_SITE`
Options Page → Service Worker
```js
/**
 * @typedef {Object} AddSitePayload
 * @property {string} domain
 * @property {string} url
 */
```
応答: `{ ok: true }` または `{ ok: false, reason: string }`

#### 4.2.5 `UPDATE_SITE`
```js
/**
 * @typedef {Object} UpdateSitePayload
 * @property {string} domain   識別子 (新 domain への変更も許容、ただし重複チェック)
 * @property {string} url
 * @property {string} [originalDomain]  domain 自体を変更する場合の旧 domain
 */
```
応答: `{ ok, reason? }`

#### 4.2.6 `DELETE_SITE`
```js
/**
 * @typedef {Object} DeleteSitePayload
 * @property {string} domain
 */
```
応答: `{ ok, reason? }`

#### 4.2.7 `REORDER_SITES`
```js
/**
 * @typedef {Object} ReorderSitesPayload
 * @property {string[]} orderedDomains   先頭が最高優先
 */
```
応答: `{ ok, reason? }`

#### 4.2.8 `SET_THRESHOLD`
```js
/**
 * @typedef {Object} SetThresholdPayload
 * @property {number} thresholdSec
 */
```
応答: `{ ok, reason? }`

### 4.3 reason コード一覧 (`{ ok: false, reason: ... }`)

| reason | 意味 | 発生箇所 |
|--------|------|---------|
| `invalid_domain` | domain がバリデーション失敗 (BR-01) | SettingsRepository.addSite/updateSite |
| `invalid_url` | url がバリデーション失敗 (BR-02) | SettingsRepository.addSite/updateSite |
| `duplicate_domain` | domain 重複 (BR-03) | SettingsRepository.addSite/updateSite |
| `not_found` | 指定 domain が見つからない | SettingsRepository.updateSite/deleteSite |
| `invalid_threshold` | しきい値の範囲/型エラー (BR-04) | SettingsRepository.setThresholdSec |
| `invalid_payload` | message.payload の型不一致 | MessageRouter |
| `storage_error` | chrome.storage 例外 (BR-17) | SettingsRepository |

---

## 5. ストレージのキー一覧

### 5.1 chrome.storage.local (永続)

| キー | 型 | 用途 |
|------|---|------|
| `sites` | `Site[]` | 娯楽サイト登録一覧 |
| `threshold_sec` | `number` | しきい値 (秒、整数 1〜60) |

完全な保存例:
```json
{
  "sites": [
    { "domain": "youtube.com", "url": "https://youtu.be/xxx?autoplay=1", "priority": 1 }
  ],
  "threshold_sec": 5
}
```

### 5.2 chrome.storage.session (実行時、SW 再起動跨ぎ)

| キー | 型 | 用途 |
|------|---|------|
| `runtime_state` | `RuntimeStateSnapshot` | 実行時状態の永続化 (Service Worker 再起動跨ぎ) |

完全な保存例:
```json
{
  "runtime_state": {
    "isWaiting": false,
    "claudeTabId": null,
    "playTabId": null
  }
}
```

---

## 6. エンティティ間の関係

```
+------------------+
|   Settings       |
| - sites: Site[]  |  1 --- N  +----------+
| - thresholdSec   |           |   Site    |
+------------------+           | - domain  |
                                | - url     |
                                | - priority|
                                +----------+

+------------------+
|  RuntimeState    |    (永続化された Settings とは独立)
| - isWaiting      |    Service Worker 再起動跨ぎは session ストレージで実現
| - claudeTabId    |
| - playTabId      |
+------------------+

+------------------+
|   Message        |    sendMessage の通信単位、永続化されない
| - type           |    payload はタイプごとに異なる shape
| - payload        |
+------------------+
```

---

## 7. バリデーションの責任分担

| エンティティ | 一次バリデーション | 二次バリデーション (二重防御) |
|------------|------------------|---------------------------|
| Site (新規追加/編集) | OptionsApp (UI 即時) | SettingsRepository (保存前) |
| Settings.thresholdSec | OptionsApp (UI 即時) | SettingsRepository (保存前) |
| RuntimeState | (UI 経路なし、コードで保証) | (なし、内部状態) |
| Message | (送信側で構築) | MessageRouter (受信時、type 確認) |

---

## 8. JSON 例 (代表シナリオ)

### 8.1 初回インストール直後

```
chrome.storage.local: {} (空)
chrome.storage.session: {} (空)

→ getSettings() の戻り値:
{ "sites": [], "thresholdSec": 5 }   (BR-20 で補完)
```

### 8.2 サイト 1 件追加直後

```
addSite({ domain: "YouTube.com", url: "https://www.youtube.com/?autoplay=1" })
↓ 内部で domain 正規化 ("YouTube.com" → "youtube.com")
↓ priority = (max(0)) + 1 = 1

chrome.storage.local:
{
  "sites": [
    { "domain": "youtube.com", "url": "https://www.youtube.com/?autoplay=1", "priority": 1 }
  ],
  "threshold_sec": 5
}
```

### 8.3 待ち発生サイクル中

```
chrome.storage.session:
{
  "runtime_state": {
    "isWaiting": true,
    "claudeTabId": 123,
    "playTabId": 456
  }
}
```

### 8.4 並び替え操作後

```
reorderSites(["x.com", "youtube.com", "nicovideo.jp"])
↓ priority を 1, 2, 3 と再採番

chrome.storage.local.sites:
[
  { "domain": "x.com",       "url": "...", "priority": 1 },
  { "domain": "youtube.com", "url": "...", "priority": 2 },
  { "domain": "nicovideo.jp", "url": "...", "priority": 3 }
]
```

---

## 9. アンチスコープに関するエンティティ不在の確認

要件 §7 のアンチスコープに対応し、以下のエンティティは **持たない**:

- 統計データ (累計待ち時間、累計娯楽時間など) の永続化エンティティ
- ON/OFFトグル等のフラグ
- 拡張機能の有効/無効状態 (常時ON)
- ユーザーアカウント / 認証情報
- 端末間同期メタデータ (`storage.sync` 不使用)
- i18n リソース (日本語固定)

これらに対応する chrome.storage キーも確保しない。
