# Services — WaitLess

**プロジェクト**: WaitLess
**フェーズ**: INCEPTION - Application Design
**作成日**: 2026-05-26

このドキュメントは、複数コンポーネントを束ねて 1 つのユーザー体験を成立させる **サービス層 (オーケストレーション)** を記述する。

WaitLess の場合、Service Worker 内の **WaitOrchestrator** がサービス層の中核となる。Options Page 関連のサービスは **OptionsService (= OptionsApp + OptionsAPI + SettingsRepository の協調)** として整理する。

---

## 1. サービス一覧

| サービス名 | 主担当コンポーネント | 目的 |
|-----------|---------------------|------|
| **WaitCycleService** | WaitOrchestrator (中心) | 「待ち発生 → 娯楽タブ切替 → 完了 → AIタブ戻り」の 1 サイクルを実行する |
| **SettingsService** | OptionsApp + OptionsAPI + SettingsRepository | 設定の取得・更新を Options ↔ Service Worker 越しに提供する |
| **MessagingService** | MessageRouter | sendMessage を統一的に受信し、適切なサービス/コンポーネントへ渡す |

これら 3 サービスで全ユーザー体験 (US-01 〜 US-06) をカバーする。

---

## 2. WaitCycleService

### 2.1 責務
WaitLess の中核体験 (要件 §4) を成立させる。具体的には以下のシーケンスを担当する。

- **A. 待ち発生サイクル** (Content Script からの `WAIT_DETECTED` を起点)
- **B. 完了サイクル** (Content Script からの `COMPLETION_DETECTED` を起点)
- **C. 異常系リカバリ** (Claude.ai タブが消えた、娯楽タブが消えた、等)

### 2.2 オーケストレーション (A: 待ち発生サイクル)

```
[Trigger] Content Script(Claude.ai) が N秒経過を検知
       |
       v
[1] sendMessage('WAIT_DETECTED', { claudeTabId, durationMs })
       |
       v
[2] MessageRouter.handle()  --> WaitOrchestrator.onWaitDetected()
       |
       v
[3] WaitOrchestrator
       ├─ RuntimeState.setWaiting(true)
       ├─ RuntimeState.setClaudeTabId(claudeTabId)
       ├─ SettingsRepository.getSites()  → 優先順位ソート済 sites[]
       └─ TabManager.findOrOpenPlaySite(sites)
              ├─ 既存タブヒット   → activateTab(tabId)
              └─ ヒットなし        → openNewTab(sites[0].url, active=true)
                                    + injectPlaybackTrigger(tabId)
       |
       v
[4] WaitOrchestrator
       └─ RuntimeState.setPlayTabId(tabId)
       |
       v
[5] サイクル A 終了。次は完了サイクル (B) を待つ
```

**関連 FR**: FR-03, FR-04, FR-05, FR-06
**関連 US**: US-01, US-02, US-03

### 2.3 オーケストレーション (B: 完了サイクル)

```
[Trigger] Content Script(Claude.ai) が完了を検知
       |
       v
[1] sendMessage('COMPLETION_DETECTED', { claudeTabId })
       |
       v
[2] MessageRouter.handle()  --> WaitOrchestrator.onCompletionDetected()
       |
       v
[3] WaitOrchestrator
       ├─ RuntimeState.isWaiting() === true をチェック (false なら no-op)
       ├─ RuntimeState.getClaudeTabId() を取得
       ├─ TabManager.tabExists(claudeTabId) を確認
       │     ├─ true   → TabManager.activateTab(claudeTabId)
       │     └─ false  → TabManager.findClaudeTab() でフォールバック
       └─ RuntimeState.setWaiting(false)
            RuntimeState.setPlayTabId(null)
       |
       v
[4] サイクル B 終了。アイドル状態に戻る
```

**関連 FR**: FR-07, FR-08
**関連 US**: US-04

### 2.4 オーケストレーション (C: 異常系リカバリ)

| 状況 | 対応 |
|------|------|
| `WAIT_DETECTED` 受領時、登録サイトが 0件 | 何もしない (静かに無視)。Options Page で空状態の案内が表示される設計に委ねる |
| `WAIT_DETECTED` 連続発火 (既に isWaiting=true) | 重複と見なし無視 (RuntimeState で抑制) |
| `COMPLETION_DETECTED` 受領時、isWaiting=false | no-op |
| 戻り先 Claude.ai タブが既に閉じている | findClaudeTab() フォールバック、それでもなければ no-op |
| Service Worker 再起動 | RuntimeState.restoreFromSession() で状態復元 (isWaiting、tabId など) |

**関連 US**: ストーリーには含めず、Functional Design / Code Generation で詳細実装

### 2.5 RuntimeState の状態遷移

```
[Idle]  --(WAIT_DETECTED)-->  [Waiting]
                                |
                                | (COMPLETION_DETECTED)
                                v
                              [Idle]
```

isWaiting=true の間は重複イベントを抑止する。reset() で強制 [Idle] に戻せる。

---

## 3. SettingsService

### 3.1 責務
ユーザーがオプションページから行う設定操作を、画面 → ストレージへ反映する。Options Page から Service Worker 越しに SettingsRepository を呼び出す形になる。

### 3.2 オーケストレーション (例: サイト追加)

```
[Trigger] OptionsApp の addSite フォーム送信
       |
       v
[1] OptionsApp.validateSiteInput()
       |
       | (OK)
       v
[2] OptionsAPI.addSite({ domain, url })
       |
       v
[3] sendMessage('ADD_SITE', { domain, url })
       |
       v
[4] MessageRouter.handle()  --> SettingsRepository.addSite()
       ├─ 既存 domain 重複チェック
       ├─ priority を末尾に付与
       └─ chrome.storage.local.set
       |
       v
[5] sendResponse({ ok: true })
       |
       v
[6] OptionsApp.render(更新後 settings)
```

**関連 FR**: FR-04, FR-09, FR-10
**関連 US**: US-05

### 3.3 オーケストレーション (例: 並び替え)

```
[Trigger] OptionsApp の並び替え操作 (D&D or 矢印ボタン)
       |
       v
[1] OptionsAPI.reorderSites(orderedDomains)
       |
       v
[2] sendMessage('REORDER_SITES', { orderedDomains })
       |
       v
[3] SettingsRepository.reorderSites()
       └─ orderedDomains の順で priority を 1, 2, 3 ... と再採番、保存
       |
       v
[4] sendResponse({ ok: true })
       |
       v
[5] OptionsApp 再レンダリング
```

**関連 FR**: FR-04
**関連 US**: US-05

### 3.4 オーケストレーション (例: しきい値変更)

```
[Trigger] OptionsApp のしきい値入力欄保存
       |
       v
[1] OptionsApp.validateThresholdInput(sec)  (1〜60 範囲チェック)
       |
       | (OK)
       v
[2] OptionsAPI.setThresholdSec(sec)
       |
       v
[3] SettingsRepository.setThresholdSec(sec)
       └─ chrome.storage.local.set({ threshold_sec: sec })
       |
       v
[4] (副次効果) chrome.storage.onChanged が発火
       └─ ClaudeSiteAdapter のリスナーが新しい値を受領、即時反映
```

**関連 FR**: FR-11
**関連 US**: US-05

### 3.5 オンボーディング (US-06) のオーケストレーション

```
[Trigger] OptionsApp init()
       |
       v
[1] OptionsAPI.getSettings()  --> sites: [], thresholdSec: 5 (デフォルト)
       |
       v
[2] OptionsApp.render({ sites: [], thresholdSec: 5 })
       └─ sites.length === 0 を検出
            └─ オンボーディング案内 (「最低 1件 を登録すると WaitLess が動作します」) 表示
       |
       v
[3] ユーザーが最初の site を追加 → 通常の SettingsService フロー (3.2) へ
```

**関連 FR**: FR-09, FR-10
**関連 US**: US-06

---

## 4. MessagingService

### 4.1 責務
sendMessage の受信を 1箇所に集約し、メッセージタイプごとに適切なサービス / リポジトリへルーティングする。

### 4.2 ルーティング表

| Message Type | 経由 | 終端の処理 |
|-------------|------|-----------|
| `WAIT_DETECTED` | MessageRouter | WaitOrchestrator.onWaitDetected |
| `COMPLETION_DETECTED` | MessageRouter | WaitOrchestrator.onCompletionDetected |
| `GET_SETTINGS` | MessageRouter | SettingsRepository.getSettings |
| `ADD_SITE` | MessageRouter | SettingsRepository.addSite |
| `UPDATE_SITE` | MessageRouter | SettingsRepository.updateSite |
| `DELETE_SITE` | MessageRouter | SettingsRepository.deleteSite |
| `REORDER_SITES` | MessageRouter | SettingsRepository.reorderSites |
| `SET_THRESHOLD` | MessageRouter | SettingsRepository.setThresholdSec |

不明なタイプは黙って無視する (前方互換性のため)。

### 4.3 設計上のメモ
- 非同期応答が必要なメッセージ (`GET_SETTINGS` 等) では `chrome.runtime.onMessage` の `return true` を忘れずに行う
- ペイロードのバリデーションは MessageRouter で軽くチェック (タイプ存在のみ)、本格的なバリデーションは終端側 (SettingsRepository 等) で行う

---

## 5. サービス間の関係

```
[ Content Script (Claude.ai) ]
   - ClaudeSiteAdapter
        |
        | sendMessage (WAIT_DETECTED / COMPLETION_DETECTED)
        v
[ MessagingService (Service Worker) ]
   - MessageRouter
        |
        +--> [ WaitCycleService ]   --> TabManager / RuntimeState / SettingsRepository
        |
        +--> [ SettingsService ]    --> SettingsRepository
        |       (Options Page 側エンドポイント)

[ Options Page ]
   - OptionsApp <-- OptionsAPI -- (sendMessage) --> MessageRouter
```

すべての横断的な制御メッセージは MessageRouter を通る。設定変更の伝播は `chrome.storage.onChanged` を介して Content Script に届く (sendMessage に頼らない疎結合)。

---

## 6. サービス層のスコープ外

以下はサービスとしては定義しない (アンチスコープに準拠):

- 統計集計サービス
- ON/OFFトグル管理サービス
- 端末間同期サービス
- 多言語化リソースサービス
