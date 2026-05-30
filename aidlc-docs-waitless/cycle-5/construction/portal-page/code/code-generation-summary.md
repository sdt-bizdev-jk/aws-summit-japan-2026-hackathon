# cycle-5 Code Generation Summary — portal-page

作成日: 2026-05-28
Unit: `portal-page`

---

## 新規追加ファイル

| ファイル | 行数 (目安) | 概要 |
|---|---|---|
| `extension/portal/portal.html` | 28 | DOM 骨格 (ヘッダ + main + フッタ)、`portal_data.js` と `portal.js` を読み込む |
| `extension/portal/portal.css` | 230 | ダーク基調 (#0a0a0f) + 紫アクセント (#7c3aed)、横スクロール、ホバー拡大、レスポンシブ |
| `extension/portal/portal_data.js` | 175 | `window.PORTAL_DATA` 静的データ。12 ジャンル × 6 カード = **72 カード** |
| `extension/portal/portal.js` | 170 | レンダリングロジック (IIFE)、URL バリデーション、Reader 内蔵 URL の動的解決 |

## 既存ファイルへの変更 (最小)

| ファイル | 変更箇所 | 行数変化 |
|---|---|---|
| `extension/manifest.json` | version 0.4.0→0.5.0、description 末尾追記、`web_accessible_resources.resources` に portal/* 4 件追加 | +4 行 |
| `extension/options/options.html` | 空状態案内 `<li>` を 1 件追加 (Portal 用、ID/URL `<code>` + ワンクリック登録ボタン) | +16 行 |
| `extension/options/options.js` | `init()` から `App.injectPortalExampleUrl()` を呼び出し、関数追加 (`injectReaderExampleUrl` と同パターン + ボタンのクリックハンドラ) | +37 行 |
| `extension/options/options.css` | `.example-add-button` 用スタイル追加 | +22 行 |
| `extension/README.md` | 遷移先パターン表に 1 行追加 + 「内蔵の娯楽ポータルページについて」セクション新規追加 | +48 行 |

## 既存ファイル無変更 (NFR-54 厳守)

`git status` で確認:

```
modified:   extension/README.md
modified:   extension/manifest.json
modified:   extension/options/options.css
modified:   extension/options/options.html
modified:   extension/options/options.js
Untracked:  aidlc-docs/
Untracked:  extension/portal/
```

**完全無変更**:
- `extension/sw/*` (5 ファイル: message_router, wait_orchestrator, tab_manager, settings_repository, runtime_state, ide_bridge)
- `extension/content/*` (3 ファイル: claude_site_adapter, playback_trigger, playback_pause)
- `extension/reader/*` (4 ファイル: reader.html, reader.css, reader.js, novel.txt)
- `extension/service_worker.js`
- `vscode-extension/*` (cycle-4 の全ファイル)
- `extension/assets/icons/*`

NFR-54 (cycle-1〜4 完全無変更) を達成。

## 静的検証結果

| 検証 | 結果 |
|---|---|
| `manifest.json` JSON 構文 | OK、version: 0.5.0、WAR resources 8 件 (reader 4 + portal 4) |
| `portal_data.js` 構文 + 件数 | OK、12 ジャンル × 6 カード = 72 カード |
| `portal_data.js` 全 URL の `new URL()` | OK、`__READER_INTERNAL__` プレースホルダ以外すべて有効 |
| `portal.js` `node --check` | OK |
| `options.js` `node --check` | OK |

## 主要設計判断

| 判断 | 理由 |
|---|---|
| `<script>` 直接読み込み (ES Module 不使用) | cycle-3 Reader Page と同じ方針、依存ゼロで動作 |
| 絵文字 + CSS グラデで装飾 (画像不使用) | バンドル軽量化、外部依存なし、NFR-52 |
| `target="_self"` (同タブ遷移) | ユーザーリクエスト Q3=B、Netflix 風の体験 |
| URL バリデーションを portal.js 内で再実行 | BR-75、二重防御 (data 編集時の typo に強い) |
| Reader 内蔵 URL は `__READER_INTERNAL__` プレースホルダ → `chrome.runtime.getURL()` で動的解決 | データファイル (`portal_data.js`) を環境非依存に保つ |
| カードを `<a>` で実装 (`<div onclick>` 不使用) | キーボード操作可、アクセシビリティ、NFR-57、ブラウザ標準の挙動依存 |

## ファイル本数とサイズ感

- **新規 4 ファイル**: portal/{html, css, js, data.js} ≈ 600 行
- **改修 5 ファイル**: 計 +127 行
- **削除 0 ファイル**
- **コミットすべき変更行数**: 約 730 行

cycle-3 Reader Page (4 新規ファイル + 5 改修ファイル ≈ 800 行) と同等の規模感。
