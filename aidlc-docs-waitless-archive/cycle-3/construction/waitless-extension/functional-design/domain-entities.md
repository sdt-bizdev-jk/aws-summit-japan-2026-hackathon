# Domain Entities — waitless-extension cycle-3 (Reader Page)

最終更新: 2026-05-27

cycle-3 で新規導入されるドメインエンティティの詳細を記述する。
cycle-1 で確定した既存エンティティ (Site / Settings / RuntimeStateSnapshot) は **すべて維持** され、本ドキュメントでは新規追加分のみ扱う。

---

## 1. ReaderStateSnapshot (新規)

`chrome.storage.local` の `reader_state` キーに保存される、Reader Page の状態スナップショット。

### 1.1 アプリ層 (camelCase) の TypeScript 風定義

```js
/**
 * @typedef {Object} ReaderStateSnapshot
 * @property {number}  readOffset  既読範囲の末尾文字オフセット
 *                                 - 0 始まり (ページ先頭)
 *                                 - 上限はテキスト全体の文字数
 *                                 - 改行も 1 文字としてカウント
 * @property {number}  scrollY     現在のスクロール Y 座標 (px)
 *                                 - 0 始まり (ページ先頭)
 *                                 - 整数値で保存 (Math.round)
 * @property {string}  novelId     どの小説の状態かを識別するキー
 *                                 - cycle-3 では常に "default" 固定
 *                                 - 将来 (Q2=B 複数管理) で意味を持つ予約フィールド
 * @property {number}  updatedAt   最終更新時刻 (Date.now() の値、ミリ秒)
 *                                 - デバッグ用、表示にも使えるが UI には出さない (cycle-3)
 */
```

### 1.2 ストレージ層 (snake_case) の保存形式

`chrome.storage.local` 内の構造:

```json
{
  "reader_state": {
    "read_offset": 1234,
    "scroll_y":    5678,
    "novel_id":    "default",
    "updated_at":  1717113600000
  }
}
```

### 1.3 アプリ層 ↔ ストレージ層 の変換 (Reader Page 内で完結)

ReaderApp は変換を内部関数で行う (cycle-1 の SettingsRepository が camelCase ↔ snake_case 変換を行うのと同じパターン、ただし Reader Page では SW を経由しない):

```js
function toSnapshot(state) {
    return {
        read_offset: state.readOffset,
        scroll_y:    state.scrollY,
        novel_id:    state.novelId || 'default',
        updated_at:  state.updatedAt || Date.now()
    };
}

function fromSnapshot(snapshot) {
    return {
        readOffset: snapshot.read_offset || 0,
        scrollY:    snapshot.scroll_y || 0,
        novelId:    snapshot.novel_id || 'default',
        updatedAt:  snapshot.updated_at || 0
    };
}
```

### 1.4 バリデーション

`loadState` 時に以下のチェックを実施 (BR-37 整合):

| フィールド | 期待値 | 不正時の挙動 |
|----------|-------|-------------|
| `read_offset` | 数値 + 有限 + 0 以上 | 0 にフォールバック |
| `scroll_y` | 数値 + 有限 + 0 以上 | 0 にフォールバック |
| `novel_id` | 文字列 | "default" にフォールバック |
| `updated_at` | 数値 (ミリ秒) | 0 にフォールバック (使われない) |

### 1.5 初期値 (永続化データなし時)

```js
const INITIAL_STATE = {
    readOffset: 0,
    scrollY:    0,
    novelId:    'default',
    updatedAt:  0
};
```

---

## 2. NovelContent (組み込みデータ)

cycle-3 でバンドルする組み込み小説テキスト。Q6=B により **芥川龍之介「羅生門」** (青空文庫由来、約 6千文字) を採用。

### 2.1 配置

```
extension/reader/novel.txt
```

### 2.2 形式

UTF-8 エンコーディングのプレーンテキスト。改行は `\n` (LF)。
青空文庫の独自記法 (傍点、ルビ、注釈等) は **削除し、純粋な本文のみ** に整形してバンドルする。

### 2.3 構造

- **段落区切り**: 空行 (`\n\n`) で区切られた本文ブロック
- **テキストのみ**: 著者名、タイトル、底本情報等のメタデータは別途 HTML 内に固定で記載 (本文の文字オフセット計算を簡潔に保つため)

### 2.4 バンドル時の構造図 (例)

`novel.txt` (本文のみ):
```
　ある日の暮方の事である。一人の下人げにんが、羅生門らしょうもんの下で雨やみを待っていた。

　広い門の下には、この男のほかに誰もいない。ただ、所々丹塗にぬりの剥はげた、大きな円柱まるばしらに、蟋蟀こおろぎが一匹とまっている。羅生門が、朱雀大路すざくおおじにある以上は、この男のほかにも、雨やみをする市女笠いちめがさや揉烏帽子もみえぼしが、もう二三人はありそうなものである。それが、この男のほかには誰もいない。
...
```

`reader.html` (タイトル等は HTML 側に固定):
```html
<header>
  <h1>羅生門</h1>
  <p class="author">芥川龍之介</p>
</header>
<main id="reader-content">
  <!-- ReaderApp.renderText() が <p> 段落を動的に挿入 -->
</main>
<footer>
  <p class="source">底本: 青空文庫</p>
</footer>
```

`<header>` と `<footer>` のテキストは **文字オフセット計算の対象外** (BR-36 でクリック対象は `.paragraph` クラスの `<p>` 内に限定)。

### 2.5 著作権の確認

芥川龍之介 (1892〜1927) は 1968 年に著作権切れ (没後 50 年、当時の法律)。現行法 (改正後 70 年) でも 1997 年に切れ済 (誤: 没後 70 年だと 1997 年。実際の起算日は条文によるが、いずれにせよ現時点で完全にパブリックドメイン)。
青空文庫の収録テキストは **「青空文庫収録 ファイル制作・公開ライセンス」** 下で再配布可能 (出典明記が推奨)。

cycle-3 では **底本情報を HTML 側に固定で表示** することで、出典明記の慣行を尊重する。

---

## 3. cycle-1 から継承する既存エンティティ (再記載なし)

下記は **cycle-3 で変更なし**。詳細は cycle-1 archive を参照:

- **Site**: `{ domain, url, priority }` — `aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/functional-design/domain-entities.md`
- **Settings**: `{ sites: Site[], thresholdSec: number }` — 同上
- **RuntimeStateSnapshot**: `{ isWaiting, claudeTabId, playTabId }` — 同上

cycle-3 での参照例:
- ユーザーが Options Page で読書ページを `Site` として登録 (例: `{ domain: '<拡張機能ID>', url: 'chrome-extension://<ID>/reader/reader.html', priority: 1 }`)
- 既存の 2 パス探索ロジックがこの `Site` をそのまま扱える (Application Design 参照)

---

## 4. データ間の関係 (cycle-3 完了後)

```
[chrome.storage.local]
   ├─ sites: Site[]                ← cycle-1 から、cycle-3 で 1 件 (Reader URL) を追加可能
   ├─ threshold_sec: number        ← cycle-1 から
   └─ reader_state: ReaderStateSnapshot   ← cycle-3 で新規追加

[chrome.storage.session]
   └─ runtime_state: RuntimeStateSnapshot   ← cycle-1 から

[Bundle (extension/reader/novel.txt)]
   └─ NovelContent (text/plain)    ← cycle-3 で新規追加 (組み込み)
```

`reader_state` は **`sites` / `threshold_sec` と独立** しており、互いに干渉しない。
NFR-07 (後方互換性) により、cycle-1/2 で登録済のデータは cycle-3 でもそのまま機能する。

---

## 5. 制約事項

| 項目 | 制約値 | 理由 |
|------|-------|------|
| `readOffset` | 0 〜 totalChars (改行含む) | BR-37 |
| `scrollY` | 0 以上の整数 | window.scrollY の自然な値域 |
| `novelId` | 任意の文字列 | cycle-3 では常に "default"、将来予約 |
| `updatedAt` | エポックミリ秒 | デバッグ用 |
| `novel.txt` のサイズ | 数十 KB (推奨)、数百 KB (上限の目安) | NFR-08 起動時パフォーマンス、Web Store 申請のサイズ予算 (100 MB) には余裕 |
| `reader_state` の保存サイズ | < 1 KB (実測 ~150 bytes 想定) | NFR-09 |

---

## 6. 関連ドキュメント

- Business Logic Model: `aidlc-docs/construction/waitless-extension/functional-design/business-logic-model.md`
- Business Rules: `aidlc-docs/construction/waitless-extension/functional-design/business-rules.md`
- フロントエンド: `aidlc-docs/construction/waitless-extension/functional-design/frontend-components.md`
- cycle-1 既存エンティティ: `aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/functional-design/domain-entities.md`
