# Application Design (Consolidated) — WaitLess cycle-3

最終更新: 2026-05-27

このドキュメントは cycle-3 の Application Design 成果物を統合した形で記述する。詳細は各サブドキュメントを参照:
- [`components.md`](./components.md) — コンポーネント定義と責務
- [`component-methods.md`](./component-methods.md) — メソッドシグネチャ
- [`services.md`](./services.md) — サービス層定義
- [`component-dependency.md`](./component-dependency.md) — 依存マトリクス

---

## 0. 設計の目的と判断サマリ

cycle-3 では拡張機能内蔵の **Reader Page** を新規追加する。設計上の主要判断 (Application Design Plan の Q&A 結果):

| 判断 | 結論 | 理由 |
|------|------|------|
| **Q1** Site 登録方法 | A: 既存バリデーション拡張 | `DOMAIN_REGEX` を拡張機能 ID 形式 (`^[a-z]{32}$`) に対応、`extractDomain` は既存通り。2 パス探索ロジックがそのまま自然に動く |
| **Q2** Reader と SW の通信 | A: ReaderPage が `chrome.storage.local` を直接 | 拡張機能ページから直接 API 利用可能、SW を経由する必要なし、最小実装 |
| **Q3** Reader 内部構造 | A: シングルファイル `reader.js` IIFE | cycle-1/2 の `claude_site_adapter.js` / `options.js` と同じスタイル、ビルド不要 |

これにより cycle-3 は **既存ロジックへの変更を最小化** しつつ、**新規コンポーネントを 1 つ追加** する形で実装できる。

---

## 1. アーキテクチャ全体像 (cycle-3 完了後)

```
+------------------------------------------------------------------+
|                          Chrome Browser                          |
+------------------------------------------------------------------+
|                                                                  |
|  [Options Page]                                                  |
|   options.html / options.js / options.css                        |
|   ├ OptionsApp (cycle-3 で空状態に reader URL 動的表示追加)        |
|   └ OptionsAPI                                                   |
|         │                                                        |
|         ▼ sendMessage                                            |
|                                                                  |
|  [Service Worker] (cycle-3 では sw/* は無変更、SettingsRepo のみ修正) |
|   ┌────────────────────────────────────────────────────┐         |
|   │ MessageRouter                                       │         |
|   │  ├─ WaitOrchestrator                                │         |
|   │  │   ├─ TabManager                                  │         |
|   │  │   ├─ SettingsRepository (cycle-3: REGEX/protocol拡張) │ |
|   │  │   └─ RuntimeState                                │         |
|   └────────────────────────────────────────────────────┘         |
|                                                                  |
|  [Content Script: Claude.ai タブ]                                |
|   content/claude_site_adapter.js (無変更)                        |
|                                                                  |
|  [Content Script: 娯楽タブ (動的注入)]                           |
|   content/playback_trigger.js / playback_pause.js (無変更)       |
|                                                                  |
|  ★ [Reader Page (new in cycle-3)]                                |
|   reader/reader.html / reader.css / reader.js / novel.txt        |
|   └ ReaderApp                                                    |
|        chrome.storage.local 直接アクセス (reader_state)          |
|        Service Worker 不経由                                      |
|                                                                  |
|  [chrome.storage.local]                                          |
|   { sites, threshold_sec, reader_state (new) }                   |
|  [chrome.storage.session]                                        |
|   { runtime_state }                                              |
+------------------------------------------------------------------+
```

---

## 2. cycle-3 のスコープに含まれるコンポーネント

### 新規 (1 件)
- **ReaderPage** (Layer 4) — 拡張機能内蔵の読書ページ + Reader Lifecycle Service

### 修正 (2 件)
- **SettingsRepository** (Layer 1) — `DOMAIN_REGEX` 拡張、`validateUrl` の protocol 許可リスト拡張
- **OptionsApp + OptionsAPI** (Layer 4) — 空状態案内に動的 URL 注入、`validateUrl` の protocol 拡張 (二重防御)

### 無変更 (7 件)
MessageRouter, WaitOrchestrator, TabManager, RuntimeState, ClaudeSiteAdapter, PlaybackTrigger, PlaybackPause

---

## 3. 主要なメソッド (一覧)

### ReaderApp (新規、IIFE 内)

| メソッド | 説明 |
|---------|------|
| `init()` | 起動エントリ。テキストロード→状態復元→DOM レンダリング→イベント設定 |
| `renderText(content)` | テキストを段落 `<p>` に分割して DOM へ |
| `applyReadProgress(offset)` | 文字オフセット位置までを青色に染める |
| `onTextClick(event)` | テキスト click ハンドラ。座標→オフセット変換+更新+保存 |
| `saveState({readOffset, scrollY})` | 永続化 |
| `loadState()` | `reader_state` 読み込み (不在時は初期値) |
| `savePartial({scrollY})` | 離脱検知時の部分保存 |

### SettingsRepository (修正)

`DOMAIN_REGEX` 定数のみ拡張。`validateUrl` の protocol 許可リストを拡張。シグネチャは無変更。

```js
// cycle-3 で更新
const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-z]{32}$/;
// validateUrl 内: u.protocol が http: | https: | chrome-extension: のいずれか
```

### OptionsApp (修正)

```js
// cycle-3 で追加
function injectReaderExampleUrl() {
  const id = chrome.runtime.id;
  const url = chrome.runtime.getURL('reader/reader.html');
  document.querySelector('[data-testid="reader-domain-example"]').textContent = id;
  document.querySelector('[data-testid="reader-url-example"]').textContent = url;
}
// init() 冒頭で 1 回呼ぶ
```

`options.js` 内の `validateUrl` も SettingsRepository と同様 `chrome-extension:` を許可。

---

## 4. データモデル変更 (新規キーのみ追加)

### 4.1 `chrome.storage.local` の `reader_state` (新規)

```js
/**
 * @typedef {Object} ReaderStateSnapshot
 * @property {number} readOffset  既読範囲の末尾文字オフセット (0 始まり)
 * @property {number} scrollY     離脱時のスクロール Y 座標 (px)
 * @property {string} novelId     どの小説の状態かを識別 (cycle-3 では固定値 "default")
 * @property {number} updatedAt   最終更新時刻 (Date.now())
 */
```

```json
{
  "reader_state": {
    "read_offset": 1234,
    "scroll_y": 5678,
    "novel_id": "default",
    "updated_at": 1717113600000
  }
}
```

### 4.2 既存キー (無変更)

`sites`, `threshold_sec` は無変更 (NFR-07)。

---

## 5. 通信パターン (cycle-3 完了後)

| パターン | 経路 | cycle-3 変更 |
|---------|------|-------------|
| sendMessage (一方向) | ClaudeAdapter → MsgRouter → WaitOrch | 無変更 |
| sendMessage (req/res) | OptionsAPI → MsgRouter → SettingsRepo | 無変更 (内部変更のみ) |
| storage.onChanged | SettingsRepo → ClaudeAdapter | 無変更 |
| 動的注入 | TabMgr → 娯楽タブ → PlaybackTrigger / Pause | 無変更 |
| **chrome.storage.local 直接** (新規) | ReaderPage → chrome.storage.local | **新規** (Q2=A) |

---

## 6. 起動シーケンス (cycle-3 完了後)

### 6.1 ReaderPage の単独起動 (タブを開いた瞬間)

```
1. chrome-extension://[ID]/reader/reader.html がロード
2. reader.css がロード、reader.js がロード
3. DOMContentLoaded → ReaderApp.init()
4. fetch('reader/novel.txt') で組み込み小説ロード
5. chrome.storage.local.get('reader_state') で永続化状態ロード
6. renderText で DOM 構築
7. applyReadProgress で青色化適用
8. window.scrollTo({ top: scrollY }) で位置復元
9. body click / pagehide / visibilitychange イベントリスナ設定
10. 表示完了
```

### 6.2 Wait Cycle 内での ReaderPage アクティブ化

```
1. Claude.ai でストリーミング N秒継続
2. WAIT_DETECTED → WaitOrchestrator → TabManager.findOrOpenPlaySite
3. 2 パス探索:
   - Pass 1 (URL 完全一致): Reader Page タブがあればアクティブ化のみ
     → ReaderPage は visible に戻り、状態は維持
   - Pass 3 (新規): 新規タブ作成 → ReaderApp.init() 実行
4. ユーザーが読書を進める
5. ユーザーがテキストをクリック → onTextClick → saveState
6. Claude.ai 完了 → COMPLETION_DETECTED → WaitOrchestrator → Claude タブをアクティブ化
7. Reader Page が visibilitychange='hidden' → savePartial で離脱前の scrollY を保存
```

---

## 7. 既知のリスクと緩和策

### 7.1 拡張機能 ID の変更による URL 不整合

- **リスク**: Unpacked ロードで拡張機能を一度削除して再ロードすると、ID が変わる可能性
- **緩和**: 空状態案内に動的 URL を表示するため、ユーザーは新しい ID で再登録すれば済む。Web Store 申請後は ID 固定なので問題なし

### 7.2 クリック位置の再現精度

- **リスク**: DOM 構造が変わるとオフセット位置の意味が崩れる可能性
- **緩和**: 組み込み小説 1 編固定 (Q1=A, Q2=A) のため、テキスト内容は固定。文字オフセットの安定性が保証される

### 7.3 既存 SettingsRepository の REGEX/protocol 拡張による副作用

- **リスク**: バリデーション緩和により予期せぬ URL/domain が登録される可能性
- **緩和**:
  - 拡張機能 ID 形式 `^[a-z]{32}$` は通常ドメインと識別可能 (`.` の有無)
  - `chrome-extension:` プロトコルの許可は既存の `http: | https:` と排他的でない (拡大)
  - cycle-1/2 で動作していた既存サイト登録への影響なし
  - リスクは極小

### 7.4 大きなテキストでのレンダリングパフォーマンス

- **リスク**: 数十万文字レベルの小説で初期レンダリングや色変化の再描画が遅くなる
- **緩和**:
  - cycle-3 では 1 編固定、現実的に数万文字 (例: 短編〜中編) を想定
  - 色変化は「全段落を 2 つの span に分割」で O(N) ではなく O(段落数) で済むよう実装

---

## 8. 設計検証 (Quality Gates)

- [x] 新コンポーネント ReaderPage のレイヤー位置が明確 (Layer 4 UI / Page)
- [x] 既存 9 コンポーネントとの依存関係が単方向 (循環依存なし)
- [x] cycle-1 で確定した Wait Lifecycle がそのまま動作可能 (ReaderPage は単に「サイト」として扱われる)
- [x] FR-37 (chrome-extension:// URL 登録) が実装可能 (DOMAIN_REGEX 拡張 + protocol 拡張)
- [x] NFR-07 (後方互換性) が満たせる (既存データ形式は無変更、reader_state は新規キー)
- [x] アンチスコープ (Q9=A: Options Page 拡張なし) と整合 (専用 UI ではなく既存空状態案内に追加するだけ)

---

## 9. 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- 実行計画: `aidlc-docs/inception/plans/execution-plan.md`
- Application Design Plan: `aidlc-docs/inception/plans/application-design-plan.md`
- 詳細: 上記の 4 サブドキュメント
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/inception/application-design/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/inception/requirements/requirements.md` (cycle-2 は Application Design SKIP のため archive にこのフォルダなし)
