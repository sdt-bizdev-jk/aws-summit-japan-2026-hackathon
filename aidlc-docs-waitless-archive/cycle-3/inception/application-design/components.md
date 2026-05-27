## Components — WaitLess cycle-3

最終更新: 2026-05-27

cycle-3 では新コンポーネント **ReaderPage** を導入する。既存 9 コンポーネント (cycle-1 で確定、cycle-2 で非変更) はそのまま継承し、cycle-3 では **2 コンポーネントに最小修正** が入る。

---

## 1. cycle-3 新規コンポーネント

### 1.1 ReaderPage (新規、Layer 4: UI / Page)

**配置**: `extension/reader/{reader.html, reader.css, reader.js, novel.txt}`

**責務**:
- 拡張機能内蔵の読書ページ (`chrome-extension://[ID]/reader/reader.html`) として動作
- 組み込み小説テキスト (`novel.txt`) のレンダリング
- 既読範囲を視認性のある灰色 → 青色で表示
- ユーザーのテキストクリックを検知し、クリック位置までを既読範囲として更新 (双方向)
- スクロール位置とクリック位置を `chrome.storage.local` の `reader_state` キーに永続化
- ページロード時に保存されている状態を復元 (青色化 + スクロール)

**インタフェース** (内部 IIFE 関数):
- `ReaderApp.init()` - 起動エントリ。組み込み小説をロードし、保存状態を復元、イベントリスナを設定
- `ReaderApp.renderText(content)` - テキストをページにレンダリング (段落単位の `<p>` を生成)
- `ReaderApp.applyReadProgress(offset)` - 文字オフセット位置までを青色に染める
- `ReaderApp.onTextClick(event)` - クリックハンドラ。クリック座標 → 文字オフセットに変換、青色化を更新、保存
- `ReaderApp.saveState({readOffset, scrollY})` - `chrome.storage.local` への永続化
- `ReaderApp.loadState()` - `chrome.storage.local` からの状態読み込み
- `ReaderApp.savePartial(scrollY)` - 離脱時のスクロール位置を保存 (即時保存版)

**ディスプレイ仕様** (FR-32, NFR-10):
- 背景: ダーク色 (例: `#1a1a1a`) または白 (デフォルト確定後にコード生成で決定)
- 未読テキスト色: 視認性のある灰色 (例: `#666` if dark / `#888` if light)
- 既読テキスト色: 青色 (例: `#3b82f6`)
- フォントサイズ・行間・フォントは固定 (cycle-3 アンチスコープ: UI カスタマイズなし)

---

## 2. cycle-3 で最小修正されるコンポーネント

### 2.1 SettingsRepository (Layer 1、既存) — `DOMAIN_REGEX` 拡張

**変更**: 拡張機能 ID 形式の domain を受け付けるよう `DOMAIN_REGEX` を拡張

**理由**: FR-37 (ユーザーが `chrome-extension://[ID]/...` を Site 登録できる) のため、`hostname` として抽出される拡張機能 ID (32 文字英小数字、TLD なし) をバリデーション通過させる必要がある。

**変更後の正規表現** (案):
```js
// 通常ドメイン (TLD あり) または拡張機能 ID (32 文字英小数字)
const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-z]{32}$/;
```

**他のフィールド・ロジックは無変更**:
- `validateUrl`: URL バリデーション。`chrome-extension://` を許可するため protocol チェックを `http:|https:|chrome-extension:` に拡張する必要がある
- `validateThreshold`: 完全に無変更
- CRUD ロジック (addSite / updateSite / deleteSite / reorderSites): 完全に無変更

**追加変更**:
- `validateUrl` の protocol 許可リストに `chrome-extension:` を追加 (現状は `http: | https:` のみ)

これは options/options.js 内の同名関数も同様に更新する (二重防御の整合維持)。

### 2.2 OptionsApp (Layer 4、既存) — 空状態案内の動的 URL 表示

**変更**: 空状態案内に「読書ページの動的 URL」をコピペ可能形式で表示する 1 つのリストアイテムを追加 (`chrome.runtime.id` と `chrome.runtime.getURL` を実行時に使用)

**理由**: FR-37 — ユーザーが Options Page で正しい拡張機能 ID と URL を簡単に登録できるようにする

**追加するマークアップ案** (空状態案内内、cycle-2 で追加した 5 種類のリストの末尾に追加):
```html
<li>
  <span class="example-emoji">📖</span>
  <strong>読書 (内蔵)</strong>
  <span class="example-detail">
    例 (拡張機能 ID は環境ごとに変わるため、実行時に表示します):
    <code data-testid="reader-domain-example"></code> /
    <code data-testid="reader-url-example"></code>
  </span>
</li>
```

`options.js` で `chrome.runtime.id` と `chrome.runtime.getURL('reader/reader.html')` を `<code>` の textContent に流し込む実装を追加。

### 2.3 OptionsApp の `validateUrl` (二重防御) — protocol 拡張

`options/options.js` 内の `validateUrl` 関数を更新し、`chrome-extension:` プロトコルを許可。

---

## 3. 変更しないコンポーネント (cycle-3 アンチスコープ)

| コンポーネント | 配置 | 理由 |
|---------------|------|------|
| MessageRouter | `sw/message_router.js` | Reader Page は SW を経由せず、`chrome.storage.local` を直接アクセス (Q2=A) |
| WaitOrchestrator | `sw/wait_orchestrator.js` | 待ちサイクルロジック非変更、Reader Page は単に「サイト」として扱われる |
| TabManager | `sw/tab_manager.js` | 2 パス探索ロジック非変更、`extractDomain` も既存仕様で `chrome-extension://` URL は拡張機能 ID を返す形で動く |
| RuntimeState | `sw/runtime_state.js` | 実行時状態モデル非変更 |
| ClaudeSiteAdapter | `content/claude_site_adapter.js` | DOM 監視ロジック非変更 |
| PlaybackTrigger | `content/playback_trigger.js` | `<video>` がない Reader Page では既存挙動で noop (Q10=A) |
| PlaybackPause | `content/playback_pause.js` | 同上 |

---

## 4. cycle-3 完了後のコンポーネント一覧 (10 コンポーネント)

| # | コンポーネント | レイヤー | 変更状況 (cycle-3) |
|---|---------------|---------|-------------------|
| 1 | MessageRouter | Layer 2 (Orchestration) | 無変更 |
| 2 | WaitOrchestrator | Layer 2 (Orchestration) | 無変更 |
| 3 | TabManager | Layer 1 (Domain Service) | 無変更 |
| 4 | SettingsRepository | Layer 1 (Domain Service) | **修正** (DOMAIN_REGEX 拡張、URL protocol 拡張) |
| 5 | RuntimeState | Layer 1 (Domain Service) | 無変更 |
| 6 | ClaudeSiteAdapter | Layer 3 (Adapter / Boundary) | 無変更 |
| 7 | PlaybackTrigger | Layer 3 (Adapter / Boundary) | 無変更 |
| 8 | PlaybackPause | Layer 3 (Adapter / Boundary) | 無変更 |
| 9 | OptionsApp + OptionsAPI | Layer 4 (UI / Page) | **修正** (空状態案内に動的 URL 追加、validateUrl protocol 拡張) |
| 10 | **ReaderPage** | Layer 4 (UI / Page) | **新規** |

新規 1 + 修正 2 + 無変更 7 = 計 10 コンポーネント。
