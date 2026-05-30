# Application Design Plan — WaitLess cycle-3

最終更新: 2026-05-27

cycle-3 では新コンポーネント **ReaderPage** を導入する。Application Design では各コンポーネントの責務、メソッドシグネチャ、依存関係を確定する。

---

## 重要な事前発見: `extractDomain` と `chrome-extension://` の互換性問題

cycle-3 を実装するうえで、既存の cycle-1 ロジックに **設計上の判断を要する論点** がある。

### 既存実装 (`extension/sw/tab_manager.js` L22-25)

```js
export function extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}
```

`chrome-extension://[拡張機能ID]/reader/reader.html` を渡すと、`new URL(...).hostname` は **拡張機能 ID (例: `dnafkifoolhecmagklhpdjjkfgkfdjjj` 等の 32 文字の英数字)** を返す。

### 既存のドメインバリデーション (`options/options.js` および `sw/settings_repository.js` 内)

```js
const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
```

この正規表現は **TLD (`.` を含む)** を要求するため、拡張機能 ID (`.` を含まない) は **マッチしない** = ユーザーが Options Page から `chrome-extension://[ID]/...` をそのまま登録しようとすると **`invalid_domain` でリジェクトされる**。

これは要件 FR-37 (「ユーザーは Options Page で `chrome-extension://...` を 1 つの娯楽サイトとして登録できる」) と直接抵触する。

### 解決アプローチ (Plan で確定する判断ポイント)

下記 Question 1 でユーザーに判断を仰ぐ。

---

## Application Design Plan ステップ

- [x] Step 1: 重要な事前発見 (上記) を記述
- [x] Step 2: 設計上の判断質問 (Question 1〜3) にユーザー回答 (Q1=A, Q2=A, Q3=A)
- [x] Step 3: 質問回答の分析、矛盾検出、必要なら follow-up (矛盾なし)
- [x] Step 4: `aidlc-docs/inception/application-design/components.md` を生成 (新コンポーネント ReaderPage + 既存 9 コンポーネントの整理)
- [x] Step 5: `aidlc-docs/inception/application-design/component-methods.md` を生成 (ReaderPage のメソッドシグネチャ + 既存変更があれば)
- [x] Step 6: `aidlc-docs/inception/application-design/services.md` を生成 (Reader Page サービス層、初期化シーケンス等)
- [x] Step 7: `aidlc-docs/inception/application-design/component-dependency.md` を生成 (ReaderPage の依存矩阵 + 既存との関係)
- [x] Step 8: `aidlc-docs/inception/application-design/application-design.md` (統合版) を生成
- [ ] Step 9: ユーザー承認待機

---

## 設計上の判断質問

### Question 1: `chrome-extension://` URL の Site 登録方法

要件 FR-37 を満たしつつ、既存の `extractDomain` / `DOMAIN_REGEX` バリデーションとの整合をどう取りますか?

**A) 既存バリデーション仕様を拡張 (推奨)**
- `DOMAIN_REGEX` を拡張して拡張機能 ID 形式 (`^[a-z0-9]{32}$` のような 32 文字英小数字) を受け付ける
- `extractDomain` は既存通り `new URL(...).hostname` を返す (拡張機能 ID がそのまま domain として使われる)
- ユーザーは Options Page で:
  - **Domain**: `dnafkifoolhecmagklhpdjjkfgkfdjjj` (拡張機能 ID、空状態案内に表示される動的な値をコピペ)
  - **URL**: `chrome-extension://dnafkifoolhecmagklhpdjjkfgkfdjjj/reader/reader.html`
- メリット: 2 パス探索ロジック (Pass 1 URL 完全一致、Pass 2 ドメイン一致) がそのまま自然に動く

**B) ユーザーには擬似ドメインを入力させる**
- ユーザーは「ダミーの domain」 (例: `waitless.reader`) を入力させる
- `settings_repository` 側で domain が `waitless.reader` の場合、保存時に URL を `chrome.runtime.getURL('reader/reader.html')` で生成して保存
- メリット: ユーザーが拡張機能 ID を意識する必要がない
- デメリット: 特殊ケースの実装が増える、`extractDomain` の戻り値が拡張機能 ID になるため domain 一致の判定が壊れる (拡張機能 ID と `waitless.reader` は一致しない)

**C) 専用ボタン「読書ページを登録」を Options Page に追加**
- Options Page に「読書ページを登録する」ボタンを 1 つ追加
- クリックで内部的に正しい domain (拡張機能 ID) と URL を自動生成して保存
- メリット: ユーザーは何も入力せず登録できる
- デメリット: cycle-3 アンチスコープ (Q9=A: Options Page 拡張なし) と矛盾、要件変更が必要

**D) Options Page を一切変更せず、ユーザーには「拡張機能 ID と URL 両方をコピペ」を空状態案内で説明**
- A と同じバリデーション拡張は行うが、空状態案内の表示形式を工夫してユーザーが両方をコピペするだけで済むようにする
- 動的に生成される拡張機能 ID は `chrome.runtime.id` で取得可能、空状態案内に表示

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 2: ReaderPage と Service Worker / Storage の通信方式

ReaderPage は `chrome.storage.local` の `reader_state` を **読み書き** する必要があります。どう実装しますか?

A) **ReaderPage が `chrome.storage.local` を直接読み書き** — 拡張機能ページ (extension page) から `chrome.storage.local` API は直接利用可能。Service Worker を経由しない。最もシンプル
B) **MessageRouter 経由で SettingsRepository に CRUD メソッドを追加** — 既存設定 (`sites` / `threshold_sec`) と同じ通信パターン。`reader_state` の CRUD を `READER_STATE_GET` / `READER_STATE_SET` といったメッセージタイプで実装
C) **新しい SW モジュール `ReaderStateRepository` を追加し、MessageRouter 経由で公開** — B の発展形、ファイル分離
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 3: ReaderPage の状態管理アーキテクチャ

ReaderPage 自体の内部構造はどう作りますか?

A) **シングルファイル `reader.js` に IIFE で全機能を実装** — cycle-1 の `claude_site_adapter.js` / `options.js` と同じスタイル。シンプル、ビルド不要
B) **複数ファイルに分割 (例: `reader.js` メイン + `reader_state.js` 永続化)** — モジュール分離、見通し改善
C) **クラスベースに整理 (例: `ReaderApp` / `ReadProgress` / `TextRenderer` クラス)** — オブジェクト指向、テスト容易性向上
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

回答完了後、「done」「completed」「終わった」とお知らせください。回答に基づき Application Design 成果物 (4 ファイル + 統合版) を生成します。
