# Cycle-6 Handover (cycle-5 → cycle-6)

このドキュメントは cycle-6 を始める際に最初に読むべき内容をまとめたもの。cycle-1 / cycle-2 / cycle-3 / cycle-4 / cycle-5 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-28 (cycle-5 ポータルページ追加完了時点)

---

## 1. cycle-1 〜 cycle-5 で達成したこと

### 1.1 cycle-1 (MVP、2026-05-26 完了)
- WaitLess Chrome 拡張の MVP (16 ファイル、Manifest V3)
- Claude.ai 待ち N秒検知 → 娯楽タブ自動切替 → 完了で AI タブ自動戻り
- 2 パスのタブ探索戦略、動画自動再生 + 完了時一時停止
- Options Page でサイト登録・しきい値設定

### 1.2 cycle-2 (遷移先バリエーション拡大、2026-05-27 完了)
- 動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想) を公式想定対象に
- Options Page 空状態案内 + manifest description / default_title 拡張 (v0.2.0)

### 1.3 cycle-3 (Reader Page 追加、2026-05-27 完了)
- 拡張機能内蔵の Reader Page (`extension/reader/`) 4 ファイル新規追加
- クリックでの既読範囲青色化 (双方向、絶対上書き)
- スクロール位置 + クリック位置を `chrome.storage.local.reader_state` に永続化
- `DOMAIN_REGEX` / `validateUrl` を chrome-extension: 対応に拡張 (BR-01/02 改訂、v0.3.0)

### 1.4 cycle-4 (VS Code (Kiro) 拡張機能 + IPC 連携、2026-05-27 完了、動作確認 2026-05-28)
- 新規 VS Code 拡張 (`vscode-extension/` TypeScript ~530 行)
- ローカル WebSocket IPC (`ws://127.0.0.1:39472`) で Chrome 拡張と双方向通信
- Kiro Agent Hooks (promptSubmit / agentStop) → トリガーファイル (`/tmp/waitless-ide-triggers/`) → VS Code 拡張 → Chrome 拡張 → ブラウザ起動 + Chrome アプリ最前面化 (osascript)
- AI 出力完了で Kiro ウィンドウ最前面化 (osascript) + 動画タブ一時停止
- 既存 sw/* 4 + content/* + reader/* は完全無変更、v0.4.0

### 1.5 cycle-5 (娯楽ポータルページ追加、2026-05-28 完了)

cycle-5 のスコープ確定パターン: **Pattern δ (中規模、UI-only)** — Chrome 拡張内蔵の新規ページ追加 (cycle-3 Reader Page と同じパターン)

**新規 Unit (1 unit)**:
1. **portal-page** (Chrome 拡張内蔵の娯楽ポータルページ、≈ 600 行)
   - `extension/portal/portal.html` (28 行) — DOM 骨格
   - `extension/portal/portal.css` (230 行) — ダーク基調 (#0a0a0f) + 紫アクセント (#7c3aed)、Netflix 風横スクロール
   - `extension/portal/portal.js` (170 行) — IIFE で `window.PORTAL_DATA` から動的レンダリング、URL バリデーション、Reader URL 動的解決
   - `extension/portal/portal_data.js` (175 行) — 12 ジャンル × 6 カード = **72 サイト** の静的データ

**新規機能**:
- Netflix 風カードグリッド (12 ジャンル: 動画視聴 / 音楽 / EC / ゲーム / SNS / ニュース / 読書 / 漫画 / スポーツ / 料理 / 旅行 / リラックス)
- 横スクロール (`scroll-snap-type: x mandatory`) + ホバー時 1.05x 拡大 + 紫色の影
- `<a href>` ベースのカードで同タブ遷移 (`target="_self"`)、キーボード操作可能 (Tab + Enter)
- 絵文字 + CSS グラデで装飾 (画像不使用)
- Options Page 空状態案内に「🎬 娯楽ポータル (内蔵)」を 1 行追加 + 紫色グラデのワンクリック登録ボタン
- `injectPortalExampleUrl()` 関数で `chrome.runtime.getURL('portal/portal.html')` を実行時に取得

**最終形**:
- ポータル URL: `chrome-extension://<拡張機能 ID>/portal/portal.html`
- Reader Page (cycle-3) と並列で「拡張機能内蔵の遷移先コンテンツ」として位置付け
- ユーザーは Options Page のワンクリックボタンか、ID + URL のコピペで sites に登録可能
- Chrome 拡張の version: 0.4.0 → 0.5.0
- 既存 sw/* + content/* + reader/* + service_worker.js + vscode-extension/* は **完全無変更** (NFR-54、`git status` で実証)

**実機動作確認 (Build and Test の T-51〜T-60)**:
- cycle-5 完了時点では UT-01〜UT-03 (構文 + データ件数 + URL バリデーション) のみ自動 PASS
- T-51〜T-60 の手動 E2E は cycle-6 開始時または別途実施 (cycle-4 と同じパターン)

---

## 2. 既知の制限事項 (cycle-5 完了時点)

cycle-1〜4 から継続:
- アイコン PNG プレースホルダ (B-01)
- デバッグログ常時 ON (B-02、B-12 で cycle-4 分も追加)
- Claude.ai DOM セレクタの脆さ (B-03)
- 動画オートプレイポリシー
- 複数ウィンドウ非対応 (B-06)
- Service Worker のアイドルアンロード
- Reader Page の小説 1 編固定 / UI カスタマイズなし / 端末ローカルのみ
- 拡張機能 ID は環境依存
- cycle-4: macOS 限定、Kiro IDE 限定、Kiro アプリ名ハードコード、ポート 39472 ハードコード、Chrome ブラウザ名ハードコード、Hook ブリッジ方式は VS Code 拡張依存
- B-20 (Pattern γ vs Pattern α 撤退判断) は cycle-5 では結論を出していない (cycle-6 で再評価)

cycle-5 で追加された制限:
- **カード画像なし** (絵文字のみ、B-21 で将来追加検討)
- **お気に入り / 履歴なし** (B-22)
- **ジャンルフィルタ / 検索なし** (B-23、72 カードなら不要だが将来カード数が増えたら必要)
- **ユーザー UI からのカード編集なし** (B-24、`portal_data.js` 直接編集のみ)
- **リンク切れ検知なし** (B-25)
- **モバイル幅 (< 768px) 未保証** (B-26、現状は 768〜1280px のみ)
- **デバッグログ常時 ON** (`portal.js` の `const DEBUG = true;`、B-27)

---

## 3. cycle-5 動作確認結果

`aidlc-docs/construction/build-and-test/build-and-test-summary.md` (cycle-5 完了時点では `aidlc-docs-waitless-archive/cycle-5/construction/build-and-test/`) の UT-01〜UT-03 + T-51〜T-60 のうち、自動可能な分は実施済:

| Criticality | テスト | 結果 |
|---|---|---|
| Automated | UT-01 (PORTAL_DATA 構造、12 ジャンル × 6 カード = 72) | ✅ PASS |
| Automated | UT-02 (全 URL の new URL() 成功) | ✅ PASS |
| Automated | UT-03 (各カードの必須プロパティ充足) | ✅ PASS |
| Automated | NFR-54 (git diff で既存ファイル無変更を実証) | ✅ PASS |

未実施 (実機ブラウザ必要):
- T-51〜T-60 (実機 E2E、Chrome 拡張ロードして確認)
- リグレッション (cycle-1〜4 主要シナリオ)

cycle-6 で時間が取れれば実施する。

---

## 4. 次サイクル (cycle-6) の候補テーマ

### 4.1 cycle-5 で生成された Backlog 項目

`docs/backlog.md` の cycle-5 セクション参照:

- **B-21** [Low] ポータルページのカード画像対応
- **B-22** [Low] ポータルページのお気に入り / 履歴 (`portal_state` キー追加)
- **B-23** [Low] ジャンルフィルタ / 検索機能
- **B-24** [Low] ユーザー UI からのカード追加・編集
- **B-25** [Low] リンク切れ検知
- **B-26** [Low] モバイル幅 (< 768px) 対応
- **B-27** [Low] ポータルページのデバッグログ OFF

### 4.2 cycle-1〜4 から継続している Backlog

`docs/backlog.md` 参照 (B-01〜B-20)。特に B-20 (Pattern γ vs Pattern α 撤退判断) は cycle-5 では結論を出していないため、cycle-6 で再評価可能。

### 4.3 cycle-6 開始時の推奨フロー

1. **cycle-5 の実機動作確認 (T-51〜T-60)** を最初のタスクにするかどうか確認
2. §4.1 / §4.2 から実装するテーマを選定
3. 通常の AI-DLC フロー (Inception → Construction) を回す

cycle-5 はリスクが低い静的ページ追加のため、おそらく実機動作確認は問題なく通る想定。仮にスタイルや遷移に違和感があれば、cycle-6 の最初に修正することになる。

---

## 5. コードの主要エントリポイント

cycle-6 を始めるにあたり、コードを読み始める順序:

```
[Chrome 拡張側]
1. extension/manifest.json (v0.5.0、web_accessible_resources に portal/* 4 件)
2. extension/service_worker.js (cycle-4 で IdeBridge import + init、cycle-5 では無変更)
3. extension/sw/message_router.js (無変更、cycle-1)
4. extension/sw/wait_orchestrator.js (無変更、cycle-1)
5. extension/sw/tab_manager.js (cycle-4 で windows.update 追加、cycle-5 では無変更)
6. extension/sw/settings_repository.js (cycle-3 で REGEX/protocol 拡張、cycle-5 では無変更)
7. extension/sw/runtime_state.js (無変更、cycle-1)
8. extension/sw/ide_bridge.js (cycle-4 新規、cycle-5 では無変更)
9. extension/content/* (無変更、cycle-1)
10. extension/reader/* (無変更、cycle-3)
11. extension/portal/                       ★ cycle-5 で新規追加 (4 ファイル)
12. extension/options/* (cycle-4 で IPC トグル + cycle-5 で injectPortalExampleUrl 追加)

[VS Code (Kiro) 拡張側 - cycle-4]
13. vscode-extension/* (無変更、cycle-5 では一切触らない)
```

cycle-5 のアーキテクチャ全体は `docs/architecture.md` §0、§4、§8 を参照。

---

## 6. archive の参照先

| ディレクトリ | 内容 |
|------------|------|
| `aidlc-docs-waitless-archive/cycle-1/` | cycle-1 (MVP) の全アーティファクト |
| `aidlc-docs-waitless-archive/cycle-2/` | cycle-2 (遷移先バリエーション拡大) |
| `aidlc-docs-waitless-archive/cycle-3/` | cycle-3 (Reader Page 追加) |
| `aidlc-docs-waitless-archive/cycle-4/` | cycle-4 (Kiro 拡張機能 + IPC 連携) |
| `aidlc-docs-waitless-archive/cycle-5/` | cycle-5 (娯楽ポータルページ追加) |

cycle-5 archive で特に有用なファイル (cycle-6 開始時の参考):

- `aidlc-docs-waitless-archive/cycle-5/inception/requirements/requirements.md` — FR-51〜60, NFR-51〜59, AS-51〜57
- `aidlc-docs-waitless-archive/cycle-5/inception/application-design/application-design.md` — Unit 構成、データスキーマ、Options 連携、独自アクセント色定義
- `aidlc-docs-waitless-archive/cycle-5/construction/portal-page/functional-design/business-rules.md` — BR-71〜80
- `aidlc-docs-waitless-archive/cycle-5/construction/portal-page/code/code-generation-summary.md` — 行数 / 改修箇所まとめ
- `aidlc-docs-waitless-archive/cycle-5/construction/build-and-test/build-and-test-summary.md` — UT-01〜UT-03 + T-51〜T-60 詳細手順
- `aidlc-docs-waitless-archive/cycle-5/audit.md` — cycle-5 全工程の監査ログ

---

## 7. AI-DLC 再開時の前提整理

cycle-6 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1〜5 の archive は参照のみ、編集しない
2. **既存 `extension/` のコードは cycle-5 の状態 (version 0.5.0) を継承** — cycle-6 では追加・修正していく形
3. **既存 `vscode-extension/` のコードは cycle-4 の状態 (version 0.1.0) を継承** — cycle-5 では一切触っていない
4. **Workspace Detection ステージで Brownfield 判定** — 既存コードがあるため
5. **Inception Phase の入力**:
   - `docs/architecture.md` (現状アーキテクチャ、cycle-5 完了状態)
   - `docs/backlog.md` (やるべきこと候補、cycle-5 完了セクション + B-21〜B-27 含む)
   - `docs/cycle-6-handover.md` (本ドキュメント)
   - `docs/cycle-5-handover.md` (cycle-5 開始時の手引き、履歴)
6. **Requirements Analysis でスコープを決める**:
   - cycle-5 で残した検証 (T-51〜T-60) を cycle-6 の最初のタスクにするかどうか確認
   - §4.1 / §4.2 から実装するテーマを選定
7. **archive ドキュメントとの整合**:
   - cycle-1〜5 で確定した BR (BR-01〜37, BR-41〜58, BR-61〜70, BR-71〜80) は引き続き有効
   - FR-01〜11 / FR-21〜25 / FR-31〜38 / FR-41〜61 / FR-51〜60 も引き続き有効
   - NFR-01〜10 / NFR-21〜29 / NFR-51〜59 も引き続き有効
   - 変更する場合は意図的に新しい Functional Design / Business Rules で上書きする

### cycle-6 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-5 完了状態 (継承、v0.5.0)
│   ├── portal/                        # ★ cycle-5 新規
│   ├── reader/                        # cycle-3 追加
│   ├── sw/ide_bridge.js               # cycle-4 新規
│   └── ... (cycle-1〜2 のコア)
├── vscode-extension/                  # cycle-4 完了状態 (継承、v0.1.0、cycle-5 では無変更)
├── .kiro/hooks/                       # cycle-4 で動作確認済の Hook
├── .vscode/settings.json              # aiWaitLessMode.urls の設定
├── docs/
│   ├── architecture.md                # cycle-5 完了状態を反映
│   ├── backlog.md                     # cycle-5 末時点の Backlog (B-21〜B-27 含む)
│   ├── cycle-3-handover.md            # 履歴
│   ├── cycle-4-handover.md            # 履歴
│   ├── cycle-5-handover.md            # 履歴
│   └── cycle-6-handover.md            # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-6 で新規作成 (現状ここはまだ空)
├── aidlc-docs-tabitabi-archive/
└── aidlc-docs-waitless-archive/
    ├── cycle-1/
    ├── cycle-2/
    ├── cycle-3/
    ├── cycle-4/
    └── cycle-5/                       # ★ cycle-5 完了 (2026-05-28 archive 化)
```

cycle-6 完了時には、cycle-6 用の archive (`aidlc-docs-waitless-archive/cycle-6/`) を作る想定。

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md` (cycle-5 完了状態)
- バックログ: `docs/backlog.md` (cycle-5 末時点、B-21〜B-27 含む)
- ユーザー向け (Chrome): `extension/README.md`
- ユーザー向け (VS Code): `vscode-extension/README.md`
- ユーザー向け (Hook): `vscode-extension/templates/hooks/README.md`
- cycle-5 開始時の手引き (履歴): `docs/cycle-5-handover.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
- cycle-3 archive: `aidlc-docs-waitless-archive/cycle-3/`
- cycle-4 archive: `aidlc-docs-waitless-archive/cycle-4/`
- cycle-5 archive: `aidlc-docs-waitless-archive/cycle-5/`
