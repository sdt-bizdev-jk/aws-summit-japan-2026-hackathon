# Services — WaitLess cycle-3

最終更新: 2026-05-27

サービス層 (オーケストレーション) の定義。cycle-1 で確定したサービスは cycle-3 でも **すべて維持** され、cycle-3 では **新規サービス 1 つ** (Reader Lifecycle Service) を ReaderPage 内に閉じた形で持つ。

---

## 1. cycle-1 から継承するサービス (無変更)

cycle-1 archive `aidlc-docs-waitless-archive/cycle-1/inception/application-design/services.md` を参照。要約のみ:

| サービス | 配置 | 責務 |
|---------|------|------|
| Wait Lifecycle Service | WaitOrchestrator 内 | 待ち発生 → 切替 → 完了 → 戻りの全体フロー調整 |
| Settings Service | SettingsRepository 内 | サイト・しきい値の CRUD |
| Threshold Push Service | SettingsRepository → ClaudeSiteAdapter (storage.onChanged) | しきい値変更の即時反映 |
| Tab Routing Service | TabManager 内 | 2 パスのタブ探索戦略 |
| Playback Best-Effort Service | PlaybackTrigger / PlaybackPause 内 | 動画自動再生 / 一時停止の試行 |

---

## 2. cycle-3 で新規追加するサービス

### 2.1 Reader Lifecycle Service

**配置**: `extension/reader/reader.js` 内の IIFE (`ReaderApp`)

**責務**: 読書ページのライフサイクル管理 — 起動、状態復元、ユーザー操作受付、永続化、離脱時保存

**フロー** (起動時):

```
[ReaderPage ロード]
    │
    ▼
[ReaderApp.init() 呼出]
    │
    ├─→ 組み込み小説テキストをロード (fetch chrome-extension://[ID]/reader/novel.txt)
    │
    ├─→ chrome.storage.local から reader_state をロード (loadState)
    │     - 不在/不正データなら { readOffset: 0, scrollY: 0 }
    │
    ├─→ DOM レンダリング (renderText)
    │     - 改行で段落 <p> に分割
    │     - 各 <p> に累積文字オフセットを data-* で記録
    │
    ├─→ 既読範囲を青色化 (applyReadProgress)
    │     - readOffset 位置で各段落を 2 つの <span> に分割
    │     - 既読側に .read クラスを付与
    │
    ├─→ スクロール位置を復元 (window.scrollTo({ top: scrollY, behavior: 'auto' }))
    │
    └─→ イベントリスナを設定:
          - document.body.click → onTextClick
          - window.pagehide → savePartial
          - document.visibilitychange → savePartial (when 'hidden')
```

**フロー** (クリック時):

```
[ユーザーがテキストをクリック]
    │
    ▼
[onTextClick(event) 呼出]
    │
    ├─→ event.target が <p> 内のテキストノードを含む要素か検証 (BR-36)
    │     - false なら処理終了
    │
    ├─→ caretRangeFromPoint(clientX, clientY) で Range 取得
    │     - Range から段落の累積オフセット + Range.startOffset で総文字オフセット算出
    │
    ├─→ 既読オフセットを更新 (双方向、BR-31)
    │     - 新しいオフセットでそのまま上書き (前にも後ろにも動く)
    │
    ├─→ applyReadProgress(newOffset) で再レンダリング (or 部分更新)
    │
    └─→ saveState({ readOffset: newOffset, scrollY: window.scrollY })
          - chrome.storage.local に即時保存 (BR-34)
```

**フロー** (離脱時):

```
[Claude.ai 完了 → AI タブにフォーカス移動]
    │
    ▼
[document.visibilitychange (state='hidden')]
    │ または
[window.pagehide]
    │
    ▼
[savePartial({ scrollY: window.scrollY })]
    │
    └─→ chrome.storage.local に同期的に保存 (BR-34: 離脱検知)
          - クリック位置は変更しない (前回のクリック位置を維持)
```

**外部依存**:
- `chrome.storage.local` - `reader_state` キーへの読み書き (Q2=A、Service Worker 経由なし)
- `chrome.runtime.getURL('reader/novel.txt')` - 組み込み小説テキストのパス取得

**同期ポイント**:
- ReaderPage と Service Worker / Wait Lifecycle Service とは **直接的な通信なし**
- ReaderPage が「サイト」として登録されて WaitOrchestrator から `chrome.tabs.update` でアクティブ化されるとき、ReaderPage 側は何も意識せず通常の page lifecycle (`pageshow`, `visibilitychange='visible'`) を受け取るのみ
- 既存の 2 パス探索ロジック (Tab Routing Service) がそのまま `chrome-extension://[ID]/reader/reader.html` を扱える (既存タブヒット時はアクティブ化のみ → ReaderPage の状態は維持される)

---

## 3. 既存サービスとの相互作用

### 3.1 Tab Routing Service との統合

ユーザーが Options Page で `chrome-extension://[ID]/reader/reader.html` を 1 サイトとして登録した場合:

- **Pass 1 (URL 完全一致)**: 既に Reader Page タブが開いていれば、それをアクティブ化のみ。新規ナビゲーションなし → ReaderApp の状態 (DOM、変数) は維持される、既読位置のメモリ上値もそのまま
- **Pass 2 (ドメイン一致)**: 同じ拡張機能 ID で違う path のタブが開いていれば (例: `options/options.html`)、登録 URL に navigate
  - ただし Options Page と Reader Page は通常別タブで運用されるため、Pass 2 が ReaderPage 関連でヒットするケースは稀
- **Pass 3 (新規タブ)**: 新規にタブを開く → ReaderApp.init() が走り、`chrome.storage.local` から状態を復元

### 3.2 Playback Best-Effort Service との相互作用

- TabManager は ReaderPage タブにも `playback_trigger.js` を動的注入する (既存実装、cycle-1 から変わらず)
- ReaderPage には `<video>` 要素がないため PlaybackTrigger は黙って終了 (cycle-1 から既存挙動、Q10=A)
- 同様に PlaybackPause も `<video>` 不在で何もしない

### 3.3 Threshold Push Service との独立性

- ReaderPage は Threshold (しきい値) を使用しない (Claude.ai 側のロジックなので)
- `storage.onChanged` のリスナーは ClaudeSiteAdapter のみ、ReaderPage 側では購読しない

---

## 4. 起動シーケンス全体図

```
時系列:
                                                                        
  [Chrome 起動]                                                          
    │                                                                   
    ▼                                                                   
  [ユーザーが Claude.ai を開く]                                          
    │                                                                   
    ▼                                                                   
  [ClaudeSiteAdapter 注入 → MutationObserver 開始]                       
    │                                                                   
    ▼                                                                   
  [プロンプト送信 → ストリーミング開始 → N秒経過]                        
    │                                                                   
    ▼                                                                   
  [WAIT_DETECTED → WaitOrchestrator → TabManager.findOrOpenPlaySite]   
    │                                                                   
    ▼                                                                   
  [2 パス探索] -- Pass 1 ヒット → Reader Page タブをアクティブ化のみ      
                                  ReaderApp は休眠状態から visible に  
                                  pageshow / visibilitychange='visible' 
                                  既読位置はメモリに保持されたまま       
                                                                        
                -- Pass 3 → 新規タブ作成                                
                          → ReaderApp.init() 実行                       
                          → loadState で永続化された状態を復元          
                          → 青色化 + scrollTo                          
    │                                                                   
    ▼                                                                   
  [ユーザーがテキストをクリック]                                          
    │                                                                   
    ▼                                                                   
  [onTextClick → 既読範囲更新 + saveState (即時保存)]                    
    │                                                                   
    ▼                                                                   
  [Claude.ai 完了 → COMPLETION_DETECTED]                                
    │                                                                   
    ▼                                                                   
  [WaitOrchestrator → Claude タブにフォーカス移動]                       
    │                                                                   
    ▼                                                                   
  [Reader Page が visibilitychange='hidden' を受信]                      
    │                                                                   
    ▼                                                                   
  [savePartial({ scrollY }) → 離脱直前の scrollY を保存]                 
                                                                        
  以後、次サイクルで Reader Page がアクティブ化されたとき                 
  visibilitychange='visible' を受信するが、ReaderApp は何もしない        
  (既存の状態を維持。次のクリックで saveState されるまでそのまま)        
```

---

## 5. cycle-3 で **追加されないサービス** (アンチスコープ)

| 検討したが追加しないサービス | 理由 |
|---------------------------|------|
| Reader State Sync Service (端末間同期) | Q11=A により `chrome.storage.local` のみ |
| Multi-Novel Service (複数小説管理) | Q2=A により 1 編固定 |
| Reader Customization Service (UI カスタマイズ) | Q8=A により最小限 UI |
| Reader Auto-Scroll Service (自動スクロール) | Q5=D により完全に手動 |
