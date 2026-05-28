# cycle-5 Build and Test Summary

作成日: 2026-05-28
Unit: `portal-page`

---

## ビルド要件

cycle-1〜4 と同様、**ビルド不要** (NFR-04 を継承)。`extension/` 配下を Chrome に Unpacked ロードすれば動作する。

```bash
# (オプション) 構文確認
node -e "global.window={}; require('./extension/portal/portal_data.js'); \
  console.log('genres:', global.window.PORTAL_DATA.length)"
node --check extension/portal/portal.js
node --check extension/options/options.js
python3 -m json.tool extension/manifest.json > /dev/null
```

## 単体テスト (Unit Test)

cycle-1〜4 と同方針で自動テストフレームワークは未導入。重要なロジックは手動で確認:

### UT-01: PORTAL_DATA の構造検証
```bash
node -e "global.window={}; require('./extension/portal/portal_data.js'); \
  const d=global.window.PORTAL_DATA; \
  console.assert(Array.isArray(d), 'PORTAL_DATA is not array'); \
  console.assert(d.length>=10 && d.length<=12, 'genre count out of range'); \
  let t=0; for(const g of d){ t+=g.cards.length; } \
  console.assert(t>=60 && t<=80, 'total card count out of range'); \
  console.log('UT-01 PASS: genres='+d.length+', total='+t)"
```
**期待**: PASS

### UT-02: 全 URL の `new URL()` 成功
```bash
node -e "global.window={}; require('./extension/portal/portal_data.js'); \
  const d=global.window.PORTAL_DATA; \
  for(const g of d) for(const c of g.cards) { \
    if (c.url==='__READER_INTERNAL__') continue; \
    try { new URL(c.url); } catch { throw new Error('invalid: '+c.url); } \
  } \
  console.log('UT-02 PASS: all URLs valid')"
```
**期待**: PASS

### UT-03: 各カードに必須プロパティが揃っている
```bash
node -e "global.window={}; require('./extension/portal/portal_data.js'); \
  const d=global.window.PORTAL_DATA; \
  for(const g of d) { \
    if (!g.genre || !g.emoji || !Array.isArray(g.cards)) throw new Error('genre missing fields: '+JSON.stringify(g)); \
    for(const c of g.cards) { \
      if (!c.name || !c.url) throw new Error('card missing fields: '+JSON.stringify(c)); \
    } \
  } \
  console.log('UT-03 PASS')"
```
**期待**: PASS

---

## 統合テスト / E2E テスト (手動)

ブラウザ実機での動作確認手順。Chrome を開いて以下を順に確認する。

### T-51 [Critical] 拡張機能リロード後にポータルページが表示される

**手順**:
1. `chrome://extensions/` を開く
2. WaitLess の「再読み込み」ボタンを押す (バージョン表示が 0.5.0 になることを確認)
3. アドレスバーに `chrome-extension://<拡張機能 ID>/portal/portal.html` を入力 (ID は extensions ページから取得)
4. Enter

**期待**:
- ダーク背景 + 紫グラデのヘッダ「WaitLess Portal」が表示される
- 12 ジャンルの行が表示され、各行に 6 枚のカードがある
- ヘッダのサブタイトル「AI 待ちの時間、好きなものを 1 クリックで。」が見える
- ローディング表示「読み込み中...」は消えている
- DevTools console に `[Portal] render complete: 12 genres / 72 cards` が出力される

### T-52 [Critical] カードをクリックすると同タブで遷移する

**手順**:
1. T-51 のページで、任意のカード (例: 動画視聴 → YouTube) をクリック

**期待**:
- 同じタブで `https://www.youtube.com/` に遷移する
- 新規タブは開かない
- ブラウザの「戻る」ボタンでポータルページに戻れる

### T-53 [Critical] Options Page で空状態案内に Portal が表示される

**手順**:
1. `chrome://extensions/` の WaitLess で「詳細」→「拡張機能のオプション」 (または右クリック→オプション)
2. すでに sites が登録されている場合は全削除して空状態にする

**期待**:
- 「📋 登録した娯楽サイト」セクションの空状態案内に **6 番目の項目**「🎬 娯楽ポータル (内蔵)」が表示される
- ドメイン欄に拡張機能 ID (32 文字英小数字)、URL 欄に `chrome-extension://<ID>/portal/portal.html` が表示される
- 「このポータルを登録する」ボタンが表示される (紫グラデ)

### T-54 [High] ワンクリック登録ボタンで sites に追加される

**手順**:
1. T-53 の状態で「このポータルを登録する」ボタンをクリック

**期待**:
- 空状態が消え、テーブルに `{domain: <ID>, url: chrome-extension://<ID>/portal/portal.html, priority: 1}` が追加される
- アラートやエラーが出ない

### T-55 [High] 登録した状態で AI 待ちを発生させるとポータルが開く

**手順**:
1. T-54 の状態で thresholdSec を 3〜5 秒に設定
2. claude.ai でプロンプト送信 (応答が長くなるもの)
3. 3〜5 秒後

**期待**:
- ポータルタブが開く (Pass 3 経路、新規タブ) または既にポータルタブがあればアクティブ化 (Pass 1)
- Claude.ai 応答完了で Claude.ai タブに戻る

### T-56 [Medium] 横スクロールが動作する

**手順**:
1. T-51 のポータルページで、任意のジャンル行 (例: 動画視聴) のスクロールバーが薄紫色で表示されることを確認
2. マウスで右へドラッグ、または Shift+ホイール

**期待**:
- カードが横方向に滑らかにスクロールする
- スクロールスナップで各カードに吸着する

### T-57 [Medium] カードホバーで拡大表示される

**手順**:
1. T-51 のポータルページで、任意のカードにマウスホバー

**期待**:
- カードが 1.05x に拡大する
- 紫色の影が強調される
- transition は約 200ms で滑らか

### T-58 [Medium] Reader Page カードが正しく Reader へ遷移する

**手順**:
1. T-51 のポータルページで「📖 読書」ジャンルの「📚 Reader Page (内蔵)」カードをクリック

**期待**:
- 同タブで Reader Page (`chrome-extension://<ID>/reader/reader.html`) に遷移する

### T-59 [Low] レスポンシブ確認

**手順**:
1. DevTools の Device Toolbar で 1280 / 1024 / 768px の幅に切り替える

**期待**:
- 1280px: 余白が広く快適なレイアウト
- 1024px: padding 縮小、カード幅 200px
- 768px: ヘッダタイトル縮小、カード幅 170px、絵文字縮小

### T-60 [Low] キーボード操作

**手順**:
1. T-51 のポータルページで Tab キーを連打

**期待**:
- カードが順番にフォーカスされる (フォーカス時にホバーと同じスタイル)
- Enter キーでフォーカス中のカードが遷移する

---

## リグレッションテスト (cycle-1〜4)

cycle-5 の NFR-54 (既存無変更) を git で実証する:

```bash
git diff --stat HEAD -- extension/sw/ extension/content/ extension/reader/ extension/service_worker.js vscode-extension/
```
**期待**: 出力なし (全て無変更)

主要なリグレッション確認:

| 機能 | 確認方法 |
|---|---|
| cycle-1 Claude.ai 待ち検知 → タブ切替 | T-51 の登録後、claude.ai で待ちを発生させる |
| cycle-2 多用途遷移先 | 既存の YouTube / Amazon / ゲーム URL を登録して同様に動作 |
| cycle-3 Reader Page | Reader Page URL を sites に登録、待ちで開く |
| cycle-4 Kiro IDE 連携 | Kiro で promptSubmit Hook → ポータル URL 起動 (要 Kiro 拡張機能起動) |

---

## 受入条件確認 (Requirements §8)

| AC | 内容 | 想定結果 |
|---|---|---|
| AC-01 | ポータルページがアドレスバーから表示される | T-51 で PASS |
| AC-02 | 10〜12 ジャンル + 60〜80 カード表示 | T-51 で PASS (12 × 6 = 72) |
| AC-03 | 横スクロール + ホバー拡大 | T-56, T-57 で PASS |
| AC-04 | 同タブ遷移 | T-52 で PASS |
| AC-05 | Options Page 空状態に Portal が案内 + ワンクリック登録 | T-53, T-54 で PASS |
| AC-06 | ポータル URL の sites 登録で AI 待ち時のタブ探索が動作 | T-55 で PASS |
| AC-07 | 既存 cycle-1〜4 機能が動作 | リグレッションセクションで実証 |
| AC-08 | ダーク基調 + 独自アクセント (紫) | T-51 で目視 PASS |

---

## 既知の制限事項 (cycle-5)

- カード画像なし (絵文字のみ、NFR-52)
- カードのお気に入り / 履歴なし (BR-76)
- ジャンル絞り込み / 検索なし (AS-55)
- モバイル幅 (< 768px) は未保証 (AS-57)
- 多言語化なし (AS-56)
- ユーザー UI からのカード編集は不可、`portal_data.js` 直接編集 (AS-54)
- リンク切れ検知なし (将来 backlog)
