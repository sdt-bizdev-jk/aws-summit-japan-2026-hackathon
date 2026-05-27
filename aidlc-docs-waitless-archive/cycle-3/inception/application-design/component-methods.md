# Component Methods — WaitLess cycle-3

最終更新: 2026-05-27

cycle-3 で新規追加 / 修正されるコンポーネントのメソッドシグネチャを記述。
詳細なビジネスルールと実装疑似コードは Functional Design (`aidlc-docs/construction/waitless-extension/functional-design/`) で扱う。

---

## 1. ReaderPage (新規)

配置: `extension/reader/reader.js` (IIFE 内のオブジェクト `ReaderApp` として定義)

### 1.1 公開メソッド (IIFE 内、外部呼出は init() のみ)

```js
/**
 * ReaderApp.init()
 *
 * 読書ページの起動エントリ。
 * - 組み込み小説テキストをロード
 * - chrome.storage.local から reader_state をロード
 * - DOM をレンダリング (renderText)
 * - 既読範囲を青色化 (applyReadProgress)
 * - 保存されているスクロール位置に scrollTo
 * - イベントリスナを設定 (click, pagehide, visibilitychange)
 *
 * @returns {Promise<void>}
 */
async function init();

/**
 * ReaderApp.renderText(content)
 *
 * 小説テキストを段落 (<p>) に分割して DOM にレンダリングする。
 * 各段落には文字オフセットの累積値を data-* 属性で持つ。
 *
 * @param {string} content - 小説テキスト (改行区切り)
 * @returns {void}
 */
function renderText(content);

/**
 * ReaderApp.applyReadProgress(offset)
 *
 * 文字オフセット位置までを青色に染める。
 * DOM 上では .read クラスを与えた <span> と未読の <span> に分割する。
 *
 * @param {number} offset - 0 〜 totalChars
 * @returns {void}
 */
function applyReadProgress(offset);

/**
 * ReaderApp.onTextClick(event)
 *
 * テキスト内の click イベントハンドラ。
 * - event.target が <p> 内 (テキストノードベース) であることを検証 (BR-36)
 * - クリック座標を Range API で文字オフセットに変換 (textNodeFromPoint + offset)
 * - 文字オフセットを「既読範囲の末尾」として更新 (双方向、BR-31)
 * - applyReadProgress を呼んで色変化を反映
 * - saveState で chrome.storage.local に保存 (BR-34: クリック時に即時保存)
 *
 * @param {MouseEvent} event
 * @returns {void}
 */
function onTextClick(event);

/**
 * ReaderApp.saveState(state)
 *
 * { readOffset, scrollY } を chrome.storage.local の reader_state に永続化。
 * 失敗は黙って許容 (BR-35)。
 *
 * @param {{ readOffset: number, scrollY: number }} state
 * @returns {Promise<void>}
 */
async function saveState(state);

/**
 * ReaderApp.loadState()
 *
 * chrome.storage.local の reader_state を読み込む。
 * 不在 / 不正データの場合は { readOffset: 0, scrollY: 0 } を返す (BR-33).
 *
 * @returns {Promise<{ readOffset: number, scrollY: number }>}
 */
async function loadState();

/**
 * ReaderApp.savePartial(partial)
 *
 * 離脱検知 (pagehide / visibilitychange=hidden) 時に呼ばれる、
 * 現在のスクロール位置を保存する。クリック位置は変更しない。
 *
 * @param {{ scrollY: number }} partial
 * @returns {void} - 同期的に呼べるよう即発火、戻り値の Promise は無視
 */
function savePartial(partial);
```

### 1.2 内部ユーティリティ

```js
/**
 * クリック座標 → 文字オフセット変換
 * Range API + caretRangeFromPoint / caretPositionFromPoint を使用。
 *
 * @param {number} clientX
 * @param {number} clientY
 * @returns {number} - 0 〜 totalChars (失敗時は -1)
 */
function clickPointToCharOffset(clientX, clientY);

/**
 * 段落配列を作る (改行区切り)
 *
 * @param {string} content
 * @returns {string[]}
 */
function splitIntoParagraphs(content);

/**
 * 既読 + 未読の <span> 構造を 1 段落分作る
 *
 * @param {string} text - 段落テキスト
 * @param {number} startOffset - 段落の先頭の累積オフセット
 * @param {number} readUntil - 既読範囲の末尾オフセット
 * @returns {DocumentFragment}
 */
function buildParagraphFragment(text, startOffset, readUntil);
```

---

## 2. SettingsRepository (修正)

### 2.1 修正メソッド: `DOMAIN_REGEX` の拡張 (定数)

```js
// cycle-3 で変更
// 通常ドメイン または 32 文字の拡張機能 ID
const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-z]{32}$/;
```

シグネチャに変更なし、内部の正規表現定数のみを修正。

### 2.2 修正メソッド: `validateUrl` (protocol 許可リスト拡張)

```js
// cycle-3 で変更後の挙動 (シグネチャ自体は同じ)
function validateUrl(input) {
  // ... 既存のチェック ...
  if (u.protocol !== 'http:' && u.protocol !== 'https:'
      && u.protocol !== 'chrome-extension:') {
    return { ok: false, reason: 'invalid_url' };
  }
  // ...
}
```

シグネチャ・戻り値の構造は無変更。protocol 許可リストに `'chrome-extension:'` を追加。

### 2.3 無変更メソッド (再記載なし)

- `getSettings()` / `getSites()` / `getThresholdSec()`
- `addSite({domain, url})` / `updateSite({originalDomain, domain, url})` / `deleteSite(domain)` / `reorderSites(orderedDomains)`
- `setThresholdSec(sec)`
- `updateSettings(partial)`

---

## 3. OptionsApp + OptionsAPI (修正)

### 3.1 修正: `validateUrl` の protocol 許可リスト (二重防御)

`options/options.js` 内の `validateUrl` も SettingsRepository と同じく `chrome-extension:` を許可するよう修正。

### 3.2 新規メソッド: 空状態案内の動的 URL 注入

```js
/**
 * App.injectReaderExampleUrl()
 *
 * 空状態案内内の読書ページサンプル要素 (data-testid="reader-domain-example",
 * data-testid="reader-url-example") に、現在の拡張機能 ID と URL を注入する。
 *
 * - chrome.runtime.id で拡張機能 ID を取得
 * - chrome.runtime.getURL('reader/reader.html') で完全 URL を取得
 *
 * init() の renderSites() より前に 1 回だけ実行する。
 *
 * @returns {void}
 */
function injectReaderExampleUrl();
```

`init()` 内で 1 回呼ぶ:

```js
async init() {
  this.injectReaderExampleUrl();    // ★ cycle-3 で追加
  this.settings = await OptionsAPI.getSettings();
  this.bindEvents();
  this.render();
}
```

### 3.3 OptionsAPI 無変更

メッセージタイプ・関数シグネチャに変更なし。

---

## 4. 既存のメッセージタイプ (無変更)

cycle-1 で確定したメッセージタイプ表は cycle-3 でも **そのまま維持**:

| Type | 方向 | 変更状況 |
|------|------|---------|
| `WAIT_DETECTED` | Content → SW | 無変更 |
| `COMPLETION_DETECTED` | Content → SW | 無変更 |
| `GET_SETTINGS` | Options → SW | 無変更 |
| `ADD_SITE` | Options → SW | 無変更 |
| `UPDATE_SITE` | Options → SW | 無変更 |
| `DELETE_SITE` | Options → SW | 無変更 |
| `REORDER_SITES` | Options → SW | 無変更 |
| `SET_THRESHOLD` | Options → SW | 無変更 |

cycle-3 で **新規メッセージタイプは追加しない** (Q2=A: ReaderPage は SW を経由しない)。

---

## 5. データモデル変更 (新規キーのみ)

### 5.1 `chrome.storage.local` の `reader_state` キー (新規)

```js
/**
 * @typedef {Object} ReaderStateSnapshot
 * @property {number} readOffset  既読範囲の末尾文字オフセット (0 始まり)
 * @property {number} scrollY     離脱時のスクロール Y 座標 (px)
 * @property {string} novelId     どの小説の状態かを識別するキー (cycle-3 では固定値 "default")
 * @property {number} updatedAt   最終更新時刻 (Date.now())
 */
```

保存形式 (snake_case):
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

ReaderApp 側でアプリ層 (camelCase) ↔ ストレージ層 (snake_case) の変換を行う (既存の SettingsRepository と同パターン)。

### 5.2 既存の `sites` / `threshold_sec` キー (無変更)

NFR-07 後方互換性: cycle-1/2 のデータ形式に **干渉しない**。`reader_state` は完全に新規追加のキー。
