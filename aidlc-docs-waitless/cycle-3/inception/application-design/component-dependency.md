# Component Dependency — WaitLess cycle-3

最終更新: 2026-05-27

cycle-3 完了後の 10 コンポーネント間の依存関係マトリクス。
cycle-1 から継承する依存方向 (単方向、循環依存なし) を維持しつつ、新規 ReaderPage を追加する。

---

## 1. レイヤー構造 (cycle-3 完了後)

```
+------------------------------------------------------------------+
| Layer 4: UI / Page                                                |
|   ┌─────────────┐         ┌──────────────────────────┐            |
|   │ OptionsApp  │         │ ReaderPage (new cycle-3) │            |
|   │ + OptionsAPI│         │  + Reader Lifecycle Svc  │            |
|   └─────────────┘         └──────────────────────────┘            |
+------------------------------------------------------------------+
| Layer 3: Adapter / Boundary                                       |
|   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ |
|   │ClaudeSiteAdapter │  │ PlaybackTrigger  │  │ PlaybackPause  │ |
|   └──────────────────┘  └──────────────────┘  └────────────────┘ |
+------------------------------------------------------------------+
| Layer 2: Orchestration                                            |
|   ┌──────────────┐         ┌──────────────────┐                   |
|   │MessageRouter │ ←─────→ │ WaitOrchestrator │                   |
|   └──────────────┘         └──────────────────┘                   |
+------------------------------------------------------------------+
| Layer 1: Domain Service                                           |
|   ┌─────────────┐  ┌──────────────────────┐  ┌──────────────┐    |
|   │ TabManager  │  │ SettingsRepository   │  │ RuntimeState │    |
|   └─────────────┘  │ (cycle-3 で REGEX +   │  └──────────────┘    |
|                    │  protocol 拡張)       │                      |
|                    └──────────────────────┘                       |
+------------------------------------------------------------------+
| Layer 0: Chrome API + DOM                                         |
|   chrome.tabs / chrome.storage.local / chrome.storage.session     |
|   chrome.scripting / chrome.runtime / chrome.action               |
|   DOM API (claude.ai / chrome-extension://reader.html)            |
+------------------------------------------------------------------+
```

各レイヤーは **下位レイヤーのみ** を呼び出す。**循環依存なし**。

---

## 2. 依存マトリクス (cycle-3 完了後)

行 → 列の依存方向。○ = 依存あり、空欄 = 依存なし。

| | Msg<br>Router | Wait<br>Orch | Tab<br>Mgr | Settings<br>Repo | Runtime<br>State | Claude<br>Adapter | Playback<br>Trigger | Playback<br>Pause | Options<br>App | Reader<br>Page |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **MessageRouter** | - | ○ | | ○ | | | | | | |
| **WaitOrchestrator** | | - | ○ | ○ | ○ | | | | | |
| **TabManager** | | | - | | | | (注入) | (注入) | | |
| **SettingsRepository** | | | | - | | | | | | |
| **RuntimeState** | | | | | - | | | | | |
| **ClaudeSiteAdapter** | (sendMessage) | | | | | - | | | | |
| **PlaybackTrigger** | | | | | | | - | | | |
| **PlaybackPause** | | | | | | | | - | | |
| **OptionsApp** | (sendMessage) | | | | | | | | - | |
| **ReaderPage** (new) | | | | | | | | | | - |

**ReaderPage の特徴**:
- 他の 9 コンポーネントとの **直接依存なし** (Q2=A により Service Worker 経由なし)
- `chrome.storage.local` を直接読み書き (Layer 0 への直接依存)
- 単独で完結しているため、cycle-3 のリスクは最小化

---

## 3. データフロー (cycle-3 完了後)

### 3.1 Wait Cycle (cycle-1 から継承、無変更)

```
[Claude.ai タブ]
    ClaudeSiteAdapter
       │ (sendMessage WAIT_DETECTED)
       ▼
[Service Worker]
    MessageRouter → WaitOrchestrator
                         │
                         ├─→ SettingsRepository.getSites()
                         ├─→ TabManager.findOrOpenPlaySite(sites)
                         │     (2 パス探索 → activate or navigate or create)
                         │     (PlaybackTrigger 動的注入)
                         └─→ RuntimeState.set(...)
                         
[娯楽タブ (ReaderPage を含む任意のサイト)]
    PlaybackTrigger 注入 → <video> あれば再生試行 / なければ noop
```

### 3.2 Reader State CRUD (cycle-3 新規)

```
[ReaderPage タブ (chrome-extension://[ID]/reader/reader.html)]
    ReaderApp.init()
       │
       ├─→ fetch(chrome.runtime.getURL('reader/novel.txt'))
       │
       ├─→ chrome.storage.local.get('reader_state')   ← Service Worker 不経由
       │
       ▼
    DOM レンダリング + 状態復元

[ユーザーがクリック]
    ReaderApp.onTextClick
       │
       ▼
    chrome.storage.local.set({ reader_state: { ... } })   ← Service Worker 不経由

[ユーザーが読書ページから離脱 (visibilitychange='hidden')]
    ReaderApp.savePartial
       │
       ▼
    chrome.storage.local.set({ reader_state: { ... } })   ← Service Worker 不経由
```

### 3.3 Settings CRUD (cycle-1 から継承、SettingsRepository は cycle-3 で REGEX/protocol 拡張)

```
[Options Page]
    OptionsApp UI 操作
    OptionsAPI.send('ADD_SITE', { domain, url })
       │ (sendMessage)
       ▼
[Service Worker]
    MessageRouter → SettingsRepository.addSite(...)
       │   ↑ cycle-3 で DOMAIN_REGEX 拡張 (拡張機能 ID 対応)
       │   ↑ cycle-3 で URL protocol 許可リスト拡張 (chrome-extension: 対応)
       ▼
    chrome.storage.local.set({ sites: [...] })
       │
       ▼ (storage.onChanged)
    ClaudeSiteAdapter (しきい値の場合のみ反映)
```

---

## 4. 通信パターン (cycle-3 完了後)

| パターン | 用途 | 経路 | cycle-3 変更 |
|---------|------|------|-------------|
| sendMessage (一方向) | WAIT_DETECTED / COMPLETION_DETECTED | ClaudeAdapter → MsgRouter → WaitOrch | 無変更 |
| sendMessage (req/res) | 設定 CRUD | OptionsAPI → MsgRouter → SettingsRepo | 無変更 (REGEX/protocol 拡張は内部、IF 不変) |
| storage.onChanged | しきい値即時反映 | SettingsRepo → ClaudeAdapter | 無変更 |
| 動的注入 | 動画再生 / 一時停止 | TabMgr → 娯楽タブ → PlaybackTrigger / Pause | 無変更 (ReaderPage では noop) |
| **chrome.storage.local 直接アクセス** (新規) | reader_state CRUD | ReaderPage → chrome.storage.local | **新規** (Q2=A) |

---

## 5. 循環依存チェック (cycle-3 完了後)

cycle-1 と同じく循環依存なし。新規 ReaderPage は Layer 4 で他コンポーネントへの依存ゼロ (chrome.storage.local 直接アクセスのみ) のため、依存グラフのリーフノードに追加されただけの構造。

```
依存方向の summary (cycle-3 後):
  Layer 4 → Layer 0 (ReaderPage は他レイヤーを経由せず chrome.* に直接アクセス)
  Layer 4 → Layer 2 → Layer 1 → Layer 0 (OptionsApp → MsgRouter → SettingsRepo → chrome.*)
  Layer 3 → Layer 2 → Layer 1 → Layer 0 (ClaudeAdapter → MsgRouter → WaitOrch → TabMgr → chrome.*)
```

---

## 6. cycle-3 影響範囲のまとめ

cycle-3 で **触れる** ファイル:

```
extension/
├── manifest.json                    [修正] web_accessible_resources 追加
├── sw/
│   └── settings_repository.js       [修正] DOMAIN_REGEX 拡張、URL protocol 許可拡張
├── options/
│   ├── options.html                 [修正] 空状態案内に読書ページ用要素追加
│   └── options.js                   [修正] injectReaderExampleUrl + validateUrl protocol 拡張
├── reader/                          [新規ディレクトリ]
│   ├── reader.html                  [新規]
│   ├── reader.css                   [新規]
│   ├── reader.js                    [新規]
│   └── novel.txt                    [新規] (青空文庫等のパブリックドメイン)
└── README.md                        [修正] 読書ページ機能の紹介追加
```

cycle-3 で **触らない** ファイル:

```
extension/
├── service_worker.js
├── sw/
│   ├── message_router.js
│   ├── wait_orchestrator.js
│   ├── tab_manager.js
│   └── runtime_state.js
├── content/
│   ├── claude_site_adapter.js
│   ├── playback_trigger.js
│   └── playback_pause.js
├── options/
│   └── options.css                  (cycle-2 で更新、cycle-3 では微修正の可能性あり、空状態 UI 追加部分のスタイル)
└── assets/icons/
```

注: `options/options.css` は新規 `<li>` 要素 (読書ページ用) のスタイル整合のため、最小修正の可能性あり。既存の `.empty-examples-list li` スタイルを継承することで原則ゼロ修正で済む見込み。
