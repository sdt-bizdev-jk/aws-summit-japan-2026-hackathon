# cycle-6 Application Design — Component Dependency

最終更新: 2026-05-29

---

## 依存マトリクス (→ は「呼び出す/依存する」)

| From \ To | StatsRepo | LeisureClassifier | RuntimeState | chrome.storage | TabManager(既) |
|-----------|-----------|-------------------|--------------|----------------|----------------|
| WaitOrchestrator(改) | → | → | → | (間接) | → (既存) |
| MessageRouter(改) | → (resume/reLeft) | | | | |
| IdeBridge(改) | → (recordCycle) | → (分類) | | | |
| StatsRepository | | | (任意) | → | |
| LeisureClassifier | | | | (純粋関数、依存なし) | |
| DashboardPage | | | | → (直接読み) | |
| StatsAggregator | | | | | (純粋関数) |

- **循環依存なし**。LeisureClassifier / StatsAggregator は純粋関数で末端。
- DashboardPage は StatsRepository を介さず `chrome.storage.local` を直接読む (A3=B)。書き手 (SW) と読み手 (Page) は storage キーで疎結合。

---

## 通信パターン

| パターン | 経路 | 用途 |
|---------|------|------|
| 関数呼び出し (SW 内) | WaitOrchestrator → StatsRepository / LeisureClassifier | サイクル記録・種別分類 |
| sendMessage (Content→SW) | ClaudeSiteAdapter → MessageRouter → StatsRepository | RESUME_ACTION / RE_LEFT |
| WebSocket IPC (cycle-4 既存) | VS Code Ext → IdeBridge → StatsRepository | STATS_RECORD (A4=A) |
| storage 直接読み | DashboardPage → chrome.storage.local | 統計データ取得 (A3=B) |
| `<a href>` 遷移 | Portal/Options → dashboard.html | ダッシュボードへの動線 (FR-84) |

---

## 新規メッセージタイプ

| Type | 方向 | Payload | Response |
|------|------|---------|----------|
| `RESUME_ACTION` | Content(Claude) → SW | `{ claudeTabId, at }` | なし |
| `RE_LEFT` | Content(Claude) → SW | `{ claudeTabId }` | なし |
| `STATS_RECORD` | VS Code → Chrome (IPC) | `{ source:'ide', waitStartAt, waitEndAt, leisureStartAt, leisureEndAt, leisureDomain }` | なし |

既存メッセージタイプ (WAIT_DETECTED, COMPLETION_DETECTED, GET_SETTINGS, ADD_SITE 等) は無変更。

---

## データフロー図 (テキスト)

```
            +----------------------- Chrome 拡張 (Service Worker) -----------------------+
            |                                                                            |
 Claude.ai  |  WAIT_DETECTED      +------------------+    classify(url)  +--------------+ |
 content -->|------------------>  | WaitOrchestrator | ----------------> |LeisureClassi.| |
            |  COMPLETION_DET.    |     (改修)        |                   +--------------+ |
            |  RESUME_ACTION ---> | MessageRouter(改) |                                   |
            |  RE_LEFT      --->  +--------+---------+                                    |
            |                              | recordCycle/begin/finalize/attach           |
            |                              v                                             |
            |                     +------------------+   set/get    +-----------------+  |
            |                     | StatsRepository  | -----------> | chrome.storage  |  |
 VS Code -->| STATS_RECORD (IPC)  |     (新規)        |              | .local          |  |
   Ext      |------> IdeBridge(改) ----> recordCycle  |              | key: stats_events| |
            |                     +------------------+              +--------+--------+  |
            +-------------------------------------------------------------- | -----------+
                                                                            | 直接読み (A3=B)
            +----------------- Chrome 拡張 (Dashboard Page) ---------------- v -----------+
            |   DashboardPage.init --> readEvents() --> StatsAggregator.aggregate()       |
            |                       --> renderSummaryCards / GenreBreakdown / WeeklyTrend  |
            +----------------------------------------------------------------------------+
```

---

## レイヤー整合 (既存アーキテクチャ §3 との一貫性)

| Layer | 既存 | cycle-6 追加 |
|-------|------|-------------|
| Layer 4: UI/Page | OptionsApp | **DashboardPage, StatsAggregator** |
| Layer 3: Adapter/Boundary | ClaudeSiteAdapter, OptionsAPI | ClaudeSiteAdapter(改: 復帰検知), DashboardAPI(薄) |
| Layer 2: Orchestration | MessageRouter, WaitOrchestrator | 両者を最小改修 |
| Layer 1: Domain | TabManager, SettingsRepository, RuntimeState, IdeBridge | **StatsRepository, LeisureClassifier**, RuntimeState(改: statsCycleId), IdeBridge(改) |
| Layer 0 | Chrome API + DOM | (同) |

- 各レイヤーは下位のみ呼ぶ原則を維持。循環依存なし。
