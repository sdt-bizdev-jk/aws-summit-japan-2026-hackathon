# Application Design — WaitLess (統合版)

**プロジェクト**: WaitLess (Chrome 拡張機能 / Manifest V3)
**フェーズ**: INCEPTION - Application Design
**作成日**: 2026-05-26
**ステータス**: 承認待ち

このドキュメントは、Application Design の 4 つの個別アーティファクト
(`components.md`, `component-methods.md`, `services.md`, `component-dependency.md`)
を統合した総合設計書である。

---

## Overview

WaitLess は、生成 AI (Claude.ai) の出力ストリーミングが N秒以上 続いた瞬間に、ユーザーが事前登録した娯楽サイトのタブへ自動切替し、出力完了の検知で Claude.ai タブに即時戻る Chrome 拡張機能 (Manifest V3) である。

本設計書では、要件 (`requirements.md`) と ユーザーストーリー (`stories.md`) を、Manifest V3 の制約下で動かすための **コンポーネント分割と責務分担** に変換し、Units Generation / Functional Design / Code Generation の前提を作る。詳細な業務ロジック (DOM セレクタ、アルゴリズム、エッジケース) は Functional Design (per-unit) に送る。

### 設計原則

| # | 原則 | 由来 |
|---|------|------|
| 1 | Manifest V3 準拠 (Service Worker ベース) | NFR-01 |
| 2 | 端末ローカル完結、外部送信なし | NFR-02, アンチスコープ #4 |
| 3 | ビルド不要、素の JS/HTML/CSS、npm 依存ゼロ | NFR-04, アンチスコープ #8 |
| 4 | 単一 AI サービス (Claude.ai) 専用、抽象化は最小限 | Q2=A, アンチスコープ #2 |
| 5 | 設定UIは Options Page に集約、ポップアップは持たない | CQ7=A, アンチスコープ #7 |
| 6 | 完了通知は OS 通知ではなくタブ自動切替で代用 | Q4=X, アンチスコープ #5 |
| 7 | 常時ON、ON/OFFトグル等は持たない | CQ6=D, アンチスコープ #6 |
| 8 | 循環依存なし、レイヤー単方向 | 依存マトリクス参照 |

---

## Architecture

### 構成 (3層 + 1ストア)

```
+------------------------------------------------------------------+
|                          Chrome Browser                          |
+------------------------------------------------------------------+
|                                                                  |
|  [Options Page]                                                  |
|   options.html / options.js / options.css                        |
|   ├ OptionsApp                                                   |
|   └ OptionsAPI ──────── sendMessage ──────────┐                  |
|                                                v                 |
|  [Service Worker]                                                |
|   service_worker.js + sw/*.js                                    |
|   ┌────────────────────────────────────────────────────┐         |
|   │ MessageRouter                                       │         |
|   │  ├─ WaitOrchestrator (中心)                         │         |
|   │  │   ├─ TabManager  ─── chrome.tabs.* / scripting   │         |
|   │  │   ├─ SettingsRepository ── chrome.storage.local  │         |
|   │  │   └─ RuntimeState ─────── chrome.storage.session │         |
|   └────────────────────────────────────────────────────┘         |
|        ^                                                         |
|        | sendMessage (WAIT_DETECTED / COMPLETION_DETECTED)       |
|        |                                                         |
|  [Content Script: Claude.ai タブ]                                |
|   content/claude_site_adapter.js                                 |
|   └ ClaudeSiteAdapter ── MutationObserver で監視                 |
|                                                                  |
|  [Content Script: 娯楽タブ (動的注入)]                           |
|   content/playback_trigger.js                                    |
|   └ PlaybackTrigger ── 再生ボタン試行クリック                    |
|                                                                  |
|  [chrome.storage.local]                                          |
|   { sites: [{domain, url, priority}, ...], threshold_sec: 5 }    |
|  [chrome.storage.session]                                        |
|   RuntimeState 復元用 (任意)                                     |
+------------------------------------------------------------------+
```

### レイヤー区分

| Layer | 役割 | 含まれるコンポーネント |
|-------|------|----------------------|
| Layer 4: UI / Page | ユーザーインタフェース | OptionsApp |
| Layer 3: Adapter / Boundary | 外界 (DOM / sendMessage) との境界 | ClaudeSiteAdapter, PlaybackTrigger, OptionsAPI |
| Layer 2: Orchestration | 体験フローの調整 | MessageRouter, WaitOrchestrator |
| Layer 1: Domain Services | 単一責務のドメインロジック | TabManager, SettingsRepository, RuntimeState |
| Layer 0: Chrome API + DOM | プラットフォーム | (Chrome API) |

各レイヤーは **下位レイヤーのみ** を呼び出し、上位への通知は イベント (sendMessage / storage.onChanged) を介する。

### ファイル/ディレクトリ構成

```
extension/
├── manifest.json
├── service_worker.js          # SW エントリ (sw/* を import)
├── sw/
│   ├── message_router.js
│   ├── wait_orchestrator.js
│   ├── tab_manager.js
│   ├── settings_repository.js
│   └── runtime_state.js
├── content/
│   ├── claude_site_adapter.js # static 注入 (matches: claude.ai)
│   └── playback_trigger.js    # 動的注入 (chrome.scripting.executeScript)
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js             # OptionsApp + OptionsAPI
└── assets/
    └── icons/
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

manifest.json の主要設定:
- `permissions`: `storage`, `tabs`, `scripting`
- `host_permissions`: `https://claude.ai/*` + (動的注入のため最小範囲を Functional Design で確定)
- `content_scripts`: `claude_site_adapter.js` を `https://claude.ai/*` に注入
- `background.service_worker`: `service_worker.js`
- `action`: ポップアップなし、`chrome.action.onClicked` でオプションページを開く (任意)
- `options_page`: `options/options.html`

---

## Components and Interfaces

詳細は `components.md` および `component-methods.md` を参照。

### コンポーネント一覧 (要約)

| # | コンポーネント | 配置 | 責務 |
|---|---------------|------|------|
| C1 | MessageRouter | SW | sendMessage の受信ハブとルーティング |
| C2 | WaitOrchestrator | SW | 待ち発生 → 切替 → 完了 → 戻りの全体フロー |
| C3 | TabManager | SW | chrome.tabs.* 集約、優先順位探索、PlaybackTrigger 注入 |
| C4 | SettingsRepository | SW | chrome.storage.local CRUD |
| C5 | RuntimeState | SW | 実行時状態 (待ち中/タブID 等) のメモリ + session 復元 |
| C6 | ClaudeSiteAdapter | Content (Claude.ai) | DOM監視・しきい値判定・イベント送出 |
| C7 | PlaybackTrigger | Content (娯楽タブ動的) | 動画再生ボタン試行クリック |
| C8 | OptionsApp | Options Page | 設定UI とユーザー操作ハンドリング |
| C9 | OptionsAPI | Options Page | sendMessage の Promise ラッパー |

### サービス層 (オーケストレーション)

詳細は `services.md` を参照。

| サービス | 主担当 | 担当ストーリー |
|---------|--------|---------------|
| WaitCycleService | WaitOrchestrator | US-01, US-02, US-03, US-04 |
| SettingsService | OptionsApp + OptionsAPI + SettingsRepository | US-05, US-06 |
| MessagingService | MessageRouter | (横断) |

中核フロー (中央の体験ループ):

```
[Claude.ai DOM 監視]
   --(WAIT_DETECTED)-->
[WaitOrchestrator] -- TabManager.findOrOpenPlaySite --> [娯楽タブへ切替]
   ...ユーザーが楽しむ...
[Claude.ai DOM 監視]
   --(COMPLETION_DETECTED)-->
[WaitOrchestrator] -- TabManager.activateTab(claudeTabId) --> [Claude.ai タブへ戻る]
```

### 主要メソッドシグネチャ (要約)

```js
// WaitOrchestrator
async onWaitDetected(claudeTabId, durationMs)
async onCompletionDetected(claudeTabId)

// TabManager
async findOrOpenPlaySite(sites) -> { tabId, opened }
async activateTab(tabId)
async openNewTab(url, active = true)
async injectPlaybackTrigger(tabId)
async findClaudeTab()

// SettingsRepository
async getSettings(), updateSettings(partial)
async getSites(), addSite(site), updateSite(site), deleteSite(domain), reorderSites(orderedDomains)
async getThresholdSec(), setThresholdSec(sec)

// ClaudeSiteAdapter
init()  // エントリ、内部に MutationObserver/Timer
detectStreamingState() -> 'streaming' | 'idle'

// OptionsApp
async init()
async onSubmitAddSite(event), onClickDeleteSite(domain), onChangeOrder(orderedDomains), onChangeThreshold(sec)
```

### 通信パターン

詳細は `component-dependency.md` を参照。

| パターン | 経路 | 用途 |
|---------|------|------|
| sendMessage (一方向) | ClaudeSiteAdapter → MessageRouter → WaitOrchestrator | WAIT_DETECTED / COMPLETION_DETECTED |
| sendMessage (req/res) | OptionsAPI → MessageRouter → SettingsRepository | 設定 CRUD |
| storage.onChanged | SettingsRepository → ClaudeSiteAdapter | しきい値の即時反映 |
| 動的注入 | TabManager → 娯楽タブ → PlaybackTrigger 即時実行 | 再生試行 |

### 依存マトリクス & 循環性チェック

```
                MR  WO  TM  SR  RS  CSA PT  OA  OAPI
MessageRouter   .   ✓   ✓   ✓   .   .   .   .   .
WaitOrchestrator .  .   ✓   ✓   ✓   .   .   .   .
TabManager      .   .   .   .   .   .   (I) .   .
SettingsRepo    .   .   .   .   .   .   .   .   .
RuntimeState    .   .   .   .   .   .   .   .   .
ClaudeSiteAdpt  (M) .   .   (S) .   .   .   .   .
PlaybackTrigger .   .   .   .   .   .   .   .   .
OptionsApp      .   .   .   .   .   .   .   .   ✓
OptionsAPI      (M) .   .   .   .   .   .   .   .
```

✓ = 直接呼び出し / (M) = sendMessage / (S) = storage.onChanged / (I) = 動的注入

**循環依存なし** (上三角のみ埋まる)。

---

## Data Models

### Site (娯楽サイト登録エントリ)

```js
/**
 * @typedef {Object} Site
 * @property {string} domain    例: "youtube.com" (識別子。重複不可、英数字とドット中心)
 * @property {string} url       自動再生用 URL (フルURL、http(s)://...)
 * @property {number} priority  優先順位 (1 が最上位、連番)
 */
```

### Settings (永続化されるユーザー設定)

```js
/**
 * @typedef {Object} Settings
 * @property {Site[]} sites
 * @property {number} thresholdSec  N秒判定しきい値 (デフォルト 5、範囲 1〜60)
 */
```

### chrome.storage.local の保存形式

```json
{
  "sites": [
    { "domain": "youtube.com", "url": "https://youtu.be/xxx?autoplay=1", "priority": 1 },
    { "domain": "x.com",       "url": "https://x.com/home",              "priority": 2 }
  ],
  "threshold_sec": 5
}
```

### chrome.storage.session の保存形式 (RuntimeState 復元用)

```json
{
  "runtime_state": {
    "isWaiting": false,
    "claudeTabId": null,
    "playTabId": null
  }
}
```

### sendMessage メッセージ形式

| Type | Payload | Response |
|------|---------|---------|
| `WAIT_DETECTED` | `{ claudeTabId, durationMs }` | なし |
| `COMPLETION_DETECTED` | `{ claudeTabId }` | なし |
| `GET_SETTINGS` | `{}` | `{ sites, thresholdSec }` |
| `ADD_SITE` | `{ domain, url }` | `{ ok, reason? }` |
| `UPDATE_SITE` | `{ domain, url }` | `{ ok, reason? }` |
| `DELETE_SITE` | `{ domain }` | `{ ok, reason? }` |
| `REORDER_SITES` | `{ orderedDomains: string[] }` | `{ ok, reason? }` |
| `SET_THRESHOLD` | `{ thresholdSec }` | `{ ok, reason? }` |

---

## Correctness Properties

本設計が満たすべき正しさの性質 (Functional Design / Build & Test で検証):

### Property 1: 待ちサイクルの単一性
**Validates: Requirements 5.3** (FR-03 N秒判定)
`WAIT_DETECTED` 連続発火時、isWaiting=true の間は重複処理されない (RuntimeState で抑制)。

### Property 2: 完了 → 戻りの一致性
**Validates: Requirements 5.7, 5.8** (FR-07 完了検知, FR-08 自動戻り)
`COMPLETION_DETECTED` 受領時、isWaiting=true で `setClaudeTabId` 済みの場合、対応する Claude.ai タブへ戻る。タブが消えていれば findClaudeTab() でフォールバック、それでも見つからなければ no-op。

### Property 3: 設定の永続性
**Validates: Requirements 5.4, 5.10** (FR-04 サイト登録, FR-10 永続化)
OptionsApp で更新した sites/threshold_sec が `chrome.storage.local` に保存され、ブラウザ再起動後も保持される。

### Property 4: しきい値の即時反映
**Validates: Requirements 5.11** (FR-11 しきい値設定)
OptionsApp で threshold_sec を変更すると、ClaudeSiteAdapter は storage.onChanged で即時に新値を採用する。

### Property 5: 優先順位の決定性
**Validates: Requirements 5.5** (FR-05 優先順位選択)
sites リストが優先順位昇順でソートされ、findOrOpenPlaySite は決定的に上位から既存タブを探す。

### Property 6: 外部送信の不在
**Validates: Requirements 6.2** (NFR-02 ローカル完結)
拡張機能のすべてのデータは `chrome.storage.*` のみに格納され、外部 HTTP リクエストを送らない。

### Property 7: 循環依存なし
**Validates: Requirements 6.1, 6.4** (NFR-01 Manifest V3 準拠, NFR-04 ビルド不要)
コンポーネント依存グラフに循環なし (上三角のみ)。Manifest V3 / 素のJS構成での保守性を維持。

---

## Error Handling

### 異常系シナリオと対応

| 状況 | 対応 |
|------|------|
| `WAIT_DETECTED` 受領時、登録サイトが 0件 | 何もしない (静かに無視)。OptionsApp 側で空状態のオンボーディング案内を表示 |
| `WAIT_DETECTED` 連続発火 (既に isWaiting=true) | 重複と見なし無視 (RuntimeState で抑制) |
| `COMPLETION_DETECTED` 受領時、isWaiting=false | no-op (ガード) |
| 戻り先 Claude.ai タブが既に閉じている | TabManager.findClaudeTab() でフォールバック、それでもなければ no-op |
| Service Worker 再起動 | RuntimeState.restoreFromSession() で状態復元 |
| 動画再生失敗 (オートプレイポリシー等) | PlaybackTrigger は best-effort、失敗を黙って許容。ユーザー体験を止めない |
| 不明なメッセージタイプを受信 | MessageRouter で黙って無視 (前方互換性) |
| 設定の保存失敗 (chrome.storage 例外) | OptionsAPI が `{ ok: false, reason }` を返し、OptionsApp がエラーメッセージ表示 |

### 例外ポリシー

- 非同期メソッドは内部で try/catch、戻り値の `{ ok, reason }` で失敗を表現
- ユーザー体験を止める例外 (Service Worker のクラッシュ等) を避けるため、各サービス境界で握り潰す
- ログは `console.warn` / `console.error` に出すが、外部送信しない (NFR-02)

---

## Testing Strategy

### テスト方針

ハッカソン規模 / MVP / Manifest V3 制約から、以下の方針:

1. **手動 E2E テスト中心**: Chrome に Unpacked ロードして主要動線を手動確認 (Build & Test ステージで詳細手順を整備)
2. **PBT は不適用** (Q13=C)、自動テストは限定的 (素のJSとビルド不要のため、テストランナー導入のコストが Q9=A の方針と合わない)
3. **ロジック単位の小さな検証スクリプト** (任意): 必要であれば、SettingsRepository 等のロジックを `node --test` 風の最小スクリプトで切り出し検証 (Build & Test で扱う)

### 主要動線の手動検証チェックリスト (Build & Test の準備)

- [ ] Unpacked ロード → manifest.json バリデーションが通る
- [ ] Options Page を開く → 空状態のオンボーディング案内が出る
- [ ] サイトを 1件 登録 → ストレージに保存される
- [ ] Claude.ai でプロンプト送信 → N秒経過で娯楽タブへ切替する
- [ ] 短い応答 → 切替が起きない
- [ ] 出力完了 → Claude.ai タブへ戻る
- [ ] しきい値を変更 → 即時反映される
- [ ] 既存タブが開いていれば、新規タブを開かずアクティブ化する
- [ ] 既存タブがなければ、登録 URL で新規タブを開く
- [ ] DevTools の Network タブで外部送信が発生していないことを確認

### 既知の不確実性 (Functional Design 送り)

以下の詳細は本フェーズでは決定せず、Functional Design (per-unit, CONSTRUCTION フェーズ) に送る:

1. **ClaudeSiteAdapter の DOM シグナル特定** — 現行 Claude.ai UI のストリーミング状態を表す要素 (停止ボタンなど) の具体的な CSS セレクタとフォールバック順序
2. **PlaybackTrigger のサイト別セレクタ** — YouTube / Vimeo 等の再生ボタン CSS セレクタの best-effort リスト
3. **TabManager 探索ポリシーの詳細** — URL 完全一致 vs ドメイン一致のフォールバック、複数ウィンドウ間の探索範囲 (現在ウィンドウのみ vs 全ウィンドウ)
4. **SettingsRepository のスキーマバリデーション詳細** — URL/ドメイン形式チェック、長さ制限、優先順位 reorder のエッジケース
5. **しきい値の上限/下限** — 1〜60秒で固定するか、ユーザーが範囲外を入力したらどう扱うか
6. **manifest.json の最小権限** — `host_permissions` の最小化 (動的注入を `tabs.update` だけで賄えるか等)
7. **動画自動再生フォールバック** — オートプレイポリシーで失敗した時の挙動 (本要件 §10.3 既知リスク: 静かに無視で許容)
8. **拡張機能アイコンクリック挙動** — オプションページを開く / 何もしない の選択

---

## ストーリー / FR トレーサビリティ (補足)

### ストーリー → 主担当コンポーネント

| US | ストーリー | 主担当 |
|----|-----------|--------|
| US-01 | 待ち発生察知 | ClaudeSiteAdapter, MessageRouter, WaitOrchestrator |
| US-02 | 娯楽タブ自動切替 | WaitOrchestrator, TabManager, SettingsRepository |
| US-03 | 動画自動再生 | TabManager, PlaybackTrigger |
| US-04 | Claude.ai タブへ即時戻り | ClaudeSiteAdapter, WaitOrchestrator, TabManager |
| US-05 | 設定UI (オプションページ全部入り) | OptionsApp, OptionsAPI, SettingsRepository, MessageRouter |
| US-06 | 初回オンボーディング | OptionsApp, SettingsRepository |

### FR → 主担当コンポーネント

| FR | 概要 | 主担当 |
|----|------|--------|
| FR-01 | Claude.ai タブ自動検出 | content_scripts matches + ClaudeSiteAdapter |
| FR-02 | 応答ストリーミング DOM 監視 | ClaudeSiteAdapter |
| FR-03 | N秒判定 | ClaudeSiteAdapter (しきい値は SettingsRepository → storage.onChanged) |
| FR-04 | 娯楽サイト登録 | SettingsRepository + OptionsApp |
| FR-05 | 既存タブ探索 + 優先順位 | TabManager |
| FR-06 | 娯楽タブ自動切替 + 動画再生 | TabManager + PlaybackTrigger |
| FR-07 | 応答完了 DOM 検知 | ClaudeSiteAdapter |
| FR-08 | Claude.ai タブ自動戻り | TabManager + WaitOrchestrator |
| FR-09 | オプションページUI | OptionsApp + OptionsAPI |
| FR-10 | chrome.storage.local 永続化 | SettingsRepository |
| FR-11 | しきい値設定 | OptionsApp + SettingsRepository |

すべての FR/US がいずれかのコンポーネントでカバーされている。

---

## アンチスコープに対応する不在

要件 §7 のアンチスコープに準拠し、本設計には以下を **意図的に持たない**:

- 統計集計コンポーネント / サービス
- ON/OFFトグル管理コンポーネント
- ポップアップUI コンポーネント
- 端末間同期コンポーネント
- 多言語化リソースコンポーネント
- ビルド成果物 (素の JS/HTML/CSS のみ)

---

## 設計レビューチェックリスト

- [x] Manifest V3 構成 (Service Worker / Content Script / Options Page) を網羅
- [x] FR-01 〜 11 が全てコンポーネントにマッピング済み
- [x] US-01 〜 06 が全て担当コンポーネントにマッピング済み
- [x] 循環依存なし
- [x] 各コンポーネントの責務が単一で明確
- [x] レイヤー単方向 (上→下)、上位への通知はイベント経由
- [x] 拡張ルール (Security/PBT) 不適用前提
- [x] アンチスコープと整合
- [x] 既知の不確実性は Functional Design 送りとして列挙
