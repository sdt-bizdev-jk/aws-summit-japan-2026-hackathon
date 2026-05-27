# Build Instructions — WaitLess cycle-2

最終更新: 2026-05-27

cycle-2 では cycle-1 と同じく **ビルド不要 / 素 JS のみ** の Chrome 拡張機能 (Manifest V3) のため、Unpacked ロード手順は cycle-1 と同一です。本ドキュメントは cycle-2 用のローカル参照として概要のみを記載し、詳細は cycle-1 archive を参照します。

---

## 1. 前提

- **OS**: macOS / Linux / Windows いずれも可
- **ブラウザ**: Chrome (Manifest V3 対応版、最新の安定版を推奨)
- **追加ツール**: なし (npm / Node.js 不要、ビルダー不要)

---

## 2. ビルド手順 (実質「コピーするだけ」)

cycle-2 の `extension/` 配下は **そのまま Unpacked ロード可能** です。バンドル / トランスパイル / minify は不要。

```
extension/
├── manifest.json              # Manifest V3 設定 (cycle-2 で更新)
├── service_worker.js          # SW エントリ (cycle-1 のまま)
├── sw/                        # SW モジュール 5つ (cycle-1 のまま)
├── content/                   # Content Scripts 3つ (cycle-1 のまま)
├── options/
│   ├── options.html           # cycle-2 で更新 (空状態案内拡張)
│   ├── options.css            # cycle-2 で更新 (新スタイル追加)
│   └── options.js             # cycle-1 のまま
├── assets/icons/              # cycle-1 プレースホルダ維持
└── README.md                  # cycle-2 で更新
```

ZIP パッケージで配布する場合 (Web Store 申請等):

```bash
cd extension/
zip -r ../waitless-cycle-2-v0.2.0.zip . -x "*.DS_Store"
```

---

## 3. Unpacked ロード手順

1. Chrome を起動
2. `chrome://extensions/` を開く
3. 右上の「**デベロッパーモード**」をオン
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
5. `extension/` ディレクトリを選択
6. 拡張機能リストに「WaitLess」(version 0.2.0) が表示されることを確認

### cycle-1 が既にロードされている場合

cycle-2 のコードは同じディレクトリ `extension/` に in-place で modify したため:

1. `chrome://extensions/` で「WaitLess」の **🔄 リロード** ボタンをクリック
2. version が `0.2.0` に変わったことを確認
3. **既に開いている Claude.ai タブはリロードする** (Manifest V3 の制約で、古い Content Script が残るため。`Extension context invalidated.` のガードあり)

---

## 4. 確認ポイント (ロード直後)

- [ ] `chrome://extensions/` でエラーが出ていない
- [ ] Service Worker のリンクをクリックして DevTools を開き、コンソールにエラーが出ていない
- [ ] 拡張機能のアイコンにマウスホバーすると、ツールチップが `WaitLess — 待ち時間を有効活用 (クリックで設定)` と表示される (FR-25)
- [ ] アイコンをクリックして Options Page を開く
- [ ] 空状態のオプションページに 5 種類の用途例が表示される (FR-22)

---

## 5. 関連ドキュメント

- 詳細手順 (cycle-1 から継続): `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/build-instructions.md`
- Integration Test 手順 (cycle-2): `aidlc-docs/construction/build-and-test/integration-test-instructions.md`
- 拡張機能のユーザー向け README: `extension/README.md`
