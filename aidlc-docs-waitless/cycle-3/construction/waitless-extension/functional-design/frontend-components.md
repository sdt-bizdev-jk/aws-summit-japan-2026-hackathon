# Frontend Components — waitless-extension cycle-3 (Reader Page)

最終更新: 2026-05-27

cycle-3 で新規追加する Reader Page の **UI/フロントエンド設計詳細**。

cycle-1 で実装済の Options Page の UI は cycle-3 では **空状態案内に 1 行追加するのみ** (FR-37)。詳細は cycle-1/2 の frontend-components.md を参照、cycle-3 での変更分のみ末尾に記述する。

---

## 1. ReaderPage (新規 UI)

### 1.1 ディレクトリ構造

```
extension/reader/
├── reader.html       # ページの DOM 骨格
├── reader.css        # スタイル (FR-32, NFR-10 整合)
├── reader.js         # ReaderApp (IIFE)
└── novel.txt         # 組み込み小説本文 (Q6=B 羅生門)
```

### 1.2 HTML 構造 (reader.html)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WaitLess - 読書</title>
  <link rel="stylesheet" href="reader.css">
</head>
<body>
  <main class="reader-container">
    <header class="reader-header">
      <h1 class="novel-title">羅生門</h1>
      <p class="novel-author">芥川龍之介</p>
    </header>

    <article id="reader-content" class="reader-content"
             data-testid="reader-content"
             aria-label="本文 (クリックで既読範囲を更新)">
      <!-- ReaderApp.renderText() が動的に <p class="paragraph"> を挿入 -->
    </article>

    <footer class="reader-footer">
      <p class="reader-source">底本: 青空文庫 (パブリックドメイン)</p>
    </footer>
  </main>

  <script src="reader.js"></script>
</body>
</html>
```

`data-testid` を付与することでテスト容易性を確保。
`aria-label` でクリックの意味を説明 (NFR-10 アクセシビリティ補強)。

### 1.3 CSS スタイル (reader.css)

#### 1.3.1 基本レイアウト

```css
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background: #1a1a1a;          /* ダーク背景 */
  color: #888;                  /* 視認性のある灰色テキスト (デフォルト) */
}

body {
  font-family: "Hiragino Mincho Pro", "游明朝", "Yu Mincho", serif;
  font-size: 18px;
  line-height: 1.85;
  -webkit-font-smoothing: antialiased;
}

.reader-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px 128px;     /* 上下に余白を確保 */
}

.reader-header {
  text-align: center;
  margin-bottom: 48px;
  border-bottom: 1px solid #333;
  padding-bottom: 24px;
}

.novel-title {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 600;
  color: #ccc;                  /* タイトルは少し明るく */
}

.novel-author {
  margin: 0;
  font-size: 14px;
  color: #777;
}

.reader-content {
  cursor: pointer;              /* クリックで既読範囲更新を示唆 */
}

.paragraph {
  margin: 0 0 1.5em;
  text-indent: 1em;             /* 段落字下げ */
}

.reader-footer {
  margin-top: 64px;
  padding-top: 24px;
  border-top: 1px solid #333;
  text-align: center;
}

.reader-source {
  margin: 0;
  font-size: 12px;
  color: #555;
}
```

#### 1.3.2 既読範囲の青色化

```css
/* 既読範囲: 視認性のある青色 */
.paragraph .read {
  color: #3b82f6;               /* 青色 (NFR-10 整合、灰色との明確な区別) */
  /* transition で徐々に色が変わる演出も可能だが、cycle-3 では最小限 */
  transition: color 0.15s ease-out;
}
```

#### 1.3.3 配色判定 (NFR-10 アクセシビリティ)

WCAG コントラスト比 (背景 `#1a1a1a` 比):
- 灰色 `#888` (未読): コントラスト比 約 4.7:1 — WCAG AA pass (通常テキスト 4.5:1 以上)
- 青色 `#3b82f6` (既読): コントラスト比 約 5.6:1 — WCAG AA pass

両方とも視認性 OK で、灰色/青色の区別も色相が大きく異なるため一目で分かる。

#### 1.3.4 レスポンシブ性 (最小限)

```css
@media (max-width: 480px) {
  .reader-container {
    padding: 32px 16px 64px;
  }
  body {
    font-size: 16px;
  }
  .novel-title {
    font-size: 22px;
  }
}
```

スマートフォン等の狭い画面でも基本的な読書性を確保。Q8=A により本格カスタマイズはしないが、最低限のレスポンシブは入れる。

### 1.4 ReaderApp ロジック (reader.js)

詳細な疑似コードは `business-logic-model.md` 参照。本ドキュメントでは UI とのインタラクション要点のみ記述。

#### 1.4.1 初期化フロー (DOMContentLoaded)

```js
(async () => {
  'use strict';

  // ReaderApp の本体
  const ReaderApp = { /* ... */ };

  // 起動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ReaderApp.init());
  } else {
    ReaderApp.init();
  }
})();
```

#### 1.4.2 イベントリスナの配置

```js
init() {
  // ... テキストロード、状態復元、レンダリング ...

  // クリックリスナは reader-content 配下に限定 (BR-36)
  const content = document.querySelector('#reader-content');
  content.addEventListener('click', (event) => ReaderApp.onTextClick(event));

  // 離脱検知 (BR-34)
  window.addEventListener('pagehide', () => ReaderApp.savePartial({ scrollY: window.scrollY }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      ReaderApp.savePartial({ scrollY: window.scrollY });
    }
  });
}
```

`document.body.click` ではなく `#reader-content` に限定することで、ヘッダ・フッタのクリックは自然に対象外になる (BR-36)。

#### 1.4.3 状態復元の遅延 (NFR-08 整合)

```js
async init() {
  // ... renderText, applyReadProgress ...

  // requestAnimationFrame でレイアウト確定を 1 フレーム待つ
  requestAnimationFrame(() => {
    window.scrollTo({ top: state.scrollY, behavior: 'auto' });
  });
}
```

`behavior: 'auto'` で **即時スクロール** (アニメーションなし) — 起動が速く感じられる。

---

## 2. OptionsApp (cycle-3 での修正)

### 2.1 空状態案内に「読書 (内蔵)」例を追加

cycle-2 で追加した空状態案内 (5 種の用途例) に **1 行追加** する。

#### マークアップ (options.html、cycle-2 の `.empty-examples-list` に末尾追加)

```html
<li>
  <span class="example-emoji" aria-hidden="true">📖</span>
  <strong>読書 (内蔵)</strong>
  <span class="example-detail">
    例 (拡張機能 ID は環境ごとに変わるため、実行時に表示します):<br>
    ドメイン: <code data-testid="reader-domain-example">読込中...</code><br>
    URL: <code data-testid="reader-url-example">読込中...</code>
  </span>
</li>
```

#### options.js に注入関数を追加

```js
// cycle-3 で追加
function injectReaderExampleUrl() {
  const id = chrome.runtime.id;
  const url = chrome.runtime.getURL('reader/reader.html');
  const domainEl = document.querySelector('[data-testid="reader-domain-example"]');
  const urlEl = document.querySelector('[data-testid="reader-url-example"]');
  if (domainEl) domainEl.textContent = id;
  if (urlEl) urlEl.textContent = url;
}

// init() の冒頭で 1 回呼ぶ
async init() {
  injectReaderExampleUrl();    // ★ 追加
  this.settings = await OptionsAPI.getSettings();
  this.bindEvents();
  this.render();
}
```

### 2.2 validateUrl の protocol 拡張 (二重防御)

```js
// cycle-3 で更新
function validateUrl(input) {
  // ... 既存のチェック ...
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:'
        && u.protocol !== 'https:'
        && u.protocol !== 'chrome-extension:') {  // ★ 追加
      return { ok: false, reason: 'URL は http://, https://, または chrome-extension:// で始めてください' };
    }
    return { ok: true, value: s };
  } catch (_e) { /* ... */ }
}
```

エラーメッセージも `chrome-extension://` を許可していることを伝える。

---

## 3. UI / UX の設計判断サマリ

| 観点 | 決定 | 整合する Q&A |
|------|------|------------|
| 背景色 | ダーク (`#1a1a1a`) | NFR-10、可読性 |
| 未読色 | 灰色 (`#888`) | 要件「視認性のある灰色」 |
| 既読色 | 青色 (`#3b82f6`) | 要件「青色」、コントラスト確保 |
| フォント | 明朝系 (Hiragino Mincho 等) | Q8=A 最小限、読書らしさ |
| 文字サイズ | 18px (デスクトップ) / 16px (狭小) | Q8=A、レスポンシブ最小限 |
| 行間 | 1.85 | 読書性、Q8=A |
| 段落字下げ | 1em (`text-indent`) | 日本語小説の慣習 |
| 最大幅 | 720px (中央寄せ) | 読書性 (1 行 30〜40 文字程度に制御) |
| 色変化アニメ | 0.15s transition | 直感的、目障りでない |
| カスタマイズ UI | なし | Q8=A (最小限) |
| アクセシビリティ | aria-label + WCAG AA 相当 | NFR-10 |

---

## 4. UI ステートと振る舞い

### 4.1 状態一覧

| 状態 | UI 表現 | トリガー |
|------|--------|---------|
| **初期ロード中** | テキストエリアが空 (フリッカー回避のため `visibility: hidden` でも可) | `init()` 開始〜`renderText()` 完了 |
| **未読 (readOffset = 0)** | 全文が灰色 | 初回ロード or リセット相当 |
| **一部既読** | クリック位置までが青色、それ以降が灰色 | クリック後 |
| **全文既読** | 全文が青色 | テキスト末尾近くをクリック |
| **空 (テキスト読込失敗)** | エラーメッセージ「テキストを読み込めませんでした」 | fetch 失敗 (BR-35 整合) |

### 4.2 UI の遷移

```
[初期ロード中]
   ↓ renderText 完了
[未読 or 一部既読 or 全文既読]
   ↓ クリック
[一部既読 or 全文既読]   ← クリック位置による
   ↓ 双方向クリック (前にクリック)
[一部既読 (より前)]
   ↓ 双方向クリック (後ろにクリック)
[一部既読 (より後ろ) or 全文既読]
```

### 4.3 アクセシビリティ補強 (NFR-10)

- `<article>` で本文ブロックを明示
- `aria-label="本文 (クリックで既読範囲を更新)"` でスクリーンリーダーに操作を案内
- キーボード操作はサポートしない (cycle-3 アンチスコープ、Q8=A 最小限)
- 色の差だけでなく `<span class="read">` の構造的差異もあるため、CSS 無効環境でも識別可能

---

## 5. 関連ドキュメント

- Business Logic Model: `aidlc-docs/construction/waitless-extension/functional-design/business-logic-model.md`
- Business Rules: `aidlc-docs/construction/waitless-extension/functional-design/business-rules.md`
- Domain Entities: `aidlc-docs/construction/waitless-extension/functional-design/domain-entities.md`
- Application Design: `aidlc-docs/inception/application-design/application-design.md`
- cycle-2 Options Page UI: `aidlc-docs-waitless-archive/cycle-2/construction/waitless-extension/code/code-generation-summary.md` (cycle-2 では Options Page の空状態に 5 種類の用途例を追加した)
