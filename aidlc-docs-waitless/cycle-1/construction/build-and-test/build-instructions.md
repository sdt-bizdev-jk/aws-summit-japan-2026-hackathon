# Build Instructions — WaitLess

**プロジェクト**: WaitLess (Chrome 拡張機能 / Manifest V3)
**フェーズ**: CONSTRUCTION - Build and Test
**作成日**: 2026-05-26

---

## 1. ビルド方針

WaitLess は NFR-04 (ビルド不要) と Q9=A (素の JavaScript / HTML / CSS、依存最小) の方針に基づき、**コンパイル/トランスパイル/バンドル不要** で動作する。

「ビルド」は以下の意味になる:

1. **開発時**: Chrome へ Unpacked ロード (= ファイルをコピーや変換せず直接読み込む)
2. **配布時**: `extension/` ディレクトリを ZIP 圧縮 (Chrome Web Store 申請 / 共有用)

---

## 2. Prerequisites

| 項目 | 必要バージョン |
|------|---------------|
| OS | macOS / Windows / Linux いずれも可 |
| ブラウザ | Chrome (Manifest V3 対応の最新安定版を推奨。少なくとも Chrome 110+) |
| その他 | npm 等の依存ツールは **不要** (本拡張は素のJSで動作) |

> **注**: ZIP 化のために `zip` コマンド (macOS / Linux 標準) または同等のアーカイバが必要。

---

## 3. ビルド手順

### 3.1 開発時: Unpacked ロード

1. このリポジトリをローカルに clone
   ```bash
   git clone <repo-url>
   cd aws-summit-japan-2026-hackathon
   ```
2. Chrome で `chrome://extensions/` を開く
3. 右上のトグル「**デベロッパーモード**」を **ON** にする
4. 「**パッケージ化されていない拡張機能を読み込む**」ボタンをクリック
5. ファイル選択ダイアログで `extension/` ディレクトリを選択して開く
6. 拡張機能リストに「WaitLess」が表示されることを確認

#### 期待される結果
- 拡張機能がエラーなしで読み込まれる
- 「サービスワーカー (アクティブ)」リンクが表示される
- ツールバー (またはパズル型アイコンのメニュー) に WaitLess アイコンが現れる

#### 確認: Service Worker の起動ログ
1. `chrome://extensions/` の WaitLess エントリで「**サービス ワーカー**」リンクをクリック
2. DevTools が開き、Console タブにログが流れることを確認:
   - `[WaitLess] installed` (初回のみ) または特に何も出ない (起動成功時はログ最小)
   - エラー (赤色) が出ていないこと

### 3.2 配布時: ZIP ビルド

```bash
cd <project-root>
zip -r waitless-extension-v0.1.0.zip extension \
  -x "extension/.DS_Store" \
  -x "*/.DS_Store" \
  -x "extension/.gitkeep"
```

成果物: `waitless-extension-v0.1.0.zip` (リポジトリルートに生成)

#### Chrome Web Store 申請時の注意
- **アイコン**: 現在 `extension/assets/icons/icon{16,48,128}.png` は 1x1 透過プレースホルダ。申請前に **本物の PNG** に差し替えること
- **プライバシーポリシー**: 外部送信なしの旨を明記したポリシーを別途用意
- **`<all_urls>` 権限の説明**: 動画自動再生のための任意ドメイン動的注入が目的、と申請文に記載

---

## 4. ビルド成果物

ビルド (Unpacked ロード) は以下のディレクトリ構成をそのまま使う:

```
extension/
├── manifest.json
├── service_worker.js
├── sw/{message_router,wait_orchestrator,tab_manager,settings_repository,runtime_state}.js
├── content/{claude_site_adapter,playback_trigger}.js
├── options/{options.html,options.css,options.js}
├── assets/icons/{icon16,icon48,icon128}.png
└── README.md  (Web Store 申請時は除外可)
```

トランスパイル後のファイルや bundle 結果は **存在しない** (=ファイルがそのままランタイム成果物)。

---

## 5. 警告とよくある問題

### 5.1 manifest_version warning
古い拡張機能と混在していると "Manifest version 2 is deprecated" が出ることがある。本拡張は MV3 のため無関係。

### 5.2 host_permissions: `<all_urls>` の警告
拡張機能管理画面で「すべてのウェブサイトのデータを読み取り、変更できます」と表示される。これは PlaybackTrigger を任意の娯楽タブに動的注入するために必要 (Q7=B)。

### 5.3 Service Worker の自動アンロード
Manifest V3 の Service Worker は使われていないと自動でアンロードされる仕様。これは正常動作。次のメッセージ受信で再起動し、`RuntimeState.restoreFromSession()` で状態を復元する。

---

## 6. トラブルシューティング

### Q. 拡張機能を読み込もうとして「manifest.json が見つかりません」
**原因**: 親ディレクトリ (`aws-summit-japan-2026-hackathon/`) を選択している
**対処**: `extension/` ディレクトリを直接選択する

### Q. 拡張機能を読み込もうとして「マニフェストファイルがない、読み取れない」エラー
**原因**: manifest.json の構文エラー、または UTF-8 BOM
**対処**: `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json'))"` で構文確認

### Q. アイコンが「読み込めません」と表示
**原因**: アイコン PNG が壊れているか、サイズが不適切
**対処**: 1x1 PNG はプレースホルダ。本番では 16x16 / 48x48 / 128x128 の正しい PNG を `extension/assets/icons/` に置く

### Q. Service Worker が起動しない
**原因**: `service_worker.js` の構文エラー、または import 失敗
**対処**: 拡張機能管理画面の WaitLess エントリで「エラー」リンクを確認、`chrome://extensions/?errors=<extension-id>` で詳細を見る

---

## 7. 開発サイクル (再ロード)

コード変更後の反映:

1. `chrome://extensions/` を開く
2. WaitLess エントリの「**🔄 更新**」ボタンをクリック
3. (Content Script を変更した場合) **Claude.ai タブを再読み込み**

> Service Worker は更新ボタンで自動再起動される。Options Page を開いている場合は、ページをリロードして変更を反映。

### よくある現象: `Extension context invalidated`

拡張機能を更新すると、既に開いている Claude.ai タブの **古い Content Script が残ったまま** になり、新しい Service Worker と通信できずエラーが出ます。これは Chrome の仕様で、Claude.ai タブを **`Cmd+R` / `F5` でリロード** すれば解消されます。
WaitLess は検知したら以降の通信を抑止するガードを実装しているため、エラーログは 1回 出るだけで止まります。
