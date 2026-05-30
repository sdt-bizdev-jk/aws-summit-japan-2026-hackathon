# Build Instructions — WaitLess cycle-3

最終更新: 2026-05-27

cycle-3 では cycle-1/2 と同じく **ビルド不要 / 素 JS のみ** の Chrome 拡張機能 (Manifest V3) のため、Unpacked ロード手順は cycle-1/2 と同一です。本ドキュメントは cycle-3 用のローカル参照として概要のみを記載します。

---

## 1. 前提

- **OS**: macOS / Linux / Windows いずれも可
- **ブラウザ**: Chrome (Manifest V3 対応版、最新の安定版を推奨)
- **追加ツール**: なし

---

## 2. ビルド手順 (cycle-3 でも実質「コピーするだけ」)

cycle-3 の `extension/` 配下 (version 0.3.0) はそのまま Unpacked ロード可能。

```
extension/
├── manifest.json              # Manifest V3 設定 (cycle-3 で更新: version 0.3.0、web_accessible_resources)
├── service_worker.js          # SW エントリ (cycle-1 のまま)
├── sw/                        # SW モジュール
│   ├── message_router.js      # cycle-1 のまま
│   ├── wait_orchestrator.js   # cycle-1 のまま
│   ├── tab_manager.js         # cycle-1 のまま
│   ├── settings_repository.js # cycle-3 で修正 (DOMAIN_REGEX/protocol 拡張)
│   └── runtime_state.js       # cycle-1 のまま
├── content/                   # Content Scripts (cycle-1 のまま)
├── options/
│   ├── options.html           # cycle-3 で修正 (空状態に読書ページ追加)
│   ├── options.css            # cycle-2 のまま
│   └── options.js             # cycle-3 で修正 (injectReaderExampleUrl + validateUrl 拡張)
├── reader/                    # ★ cycle-3 で新規作成
│   ├── reader.html
│   ├── reader.css
│   ├── reader.js
│   └── novel.txt
├── assets/icons/              # cycle-1 プレースホルダ維持
└── README.md                  # cycle-3 で更新 (読書ページ説明追加)
```

ZIP 配布する場合:

```bash
cd extension/
zip -r ../waitless-cycle-3-v0.3.0.zip . -x "*.DS_Store"
```

---

## 3. Unpacked ロード手順

### 初回ロード

1. Chrome を起動
2. `chrome://extensions/` を開く
3. 右上の「**デベロッパーモード**」をオン
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
5. `extension/` ディレクトリを選択
6. 拡張機能リストに「WaitLess」(version `0.3.0`) が表示されることを確認

### 既存ロード済の場合のリロード (cycle-2 → cycle-3)

1. `chrome://extensions/` で「WaitLess」の **🔄 リロード** ボタンをクリック
2. version が `0.3.0` に変わったことを確認
3. **既に開いている Claude.ai タブはリロード** (古い Content Script を切り替えるため)

---

## 4. ロード直後の確認ポイント

- [ ] `chrome://extensions/` でエラーが出ていない (特に web_accessible_resources の警告がないこと)
- [ ] Service Worker のリンクをクリックして DevTools を開き、コンソールにエラーが出ていない
- [ ] 拡張機能のアイコンにマウスホバーすると、ツールチップが `WaitLess — 待ち時間を有効活用 (クリックで設定)` と表示される
- [ ] アイコンをクリックして Options Page を開く
- [ ] 空状態のオプションページに **「📖 読書 (内蔵)」のサンプル** が表示され、拡張機能 ID と URL が動的に表示されている
- [ ] 「📖 読書 (内蔵)」の URL を直接ブラウザのアドレスバーに貼り付けて開くと、読書ページが表示される

---

## 5. 関連ドキュメント

- 詳細手順 (cycle-1 から継続): `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/build-instructions.md`
- Integration Test 手順 (cycle-3): `aidlc-docs/construction/build-and-test/integration-test-instructions.md`
- 拡張機能のユーザー向け README: `extension/README.md`
