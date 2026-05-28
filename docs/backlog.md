# WaitLess — Backlog

cycle-1 / cycle-2 / cycle-3 / cycle-4 / cycle-5 完了時点で抽出された「次にやるかもしれない」項目の一覧。次サイクルの Inception でスコープ選定の出発点として使う。

最終更新: 2026-05-28 (cycle-5 ポータルページ追加完了時点)

---

## 凡例

- **Priority**: `[High]` / `[Medium]` / `[Low]`
- **Type**: `[Bug fix]` / `[Feature]` / `[Tech debt]` / `[Doc]`

---

## Items

### B-01. アイコン PNG プレースホルダの差し替え
`[High] [Bug fix]`

- **状態**: `extension/assets/icons/icon{16,48,128}.png` は 1x1 透過 PNG のプレースホルダ
- **問題**: Chrome Web Store 申請には不適 (本物のアイコンが必須)
- **対処**: 16x16 / 48x48 / 128x128 の本物 PNG を作成し配置。デザインは別途検討 (例: 砂時計 + 矢印の組み合わせ等)

---

### B-02. デバッグログを本番化前に OFF にする
`[High] [Tech debt]`

- **状態**: 以下のファイルで `const DEBUG = true;` のまま
  - `extension/content/claude_site_adapter.js`
  - `extension/sw/wait_orchestrator.js`
  - `extension/sw/tab_manager.js`
  - `extension/sw/message_router.js`
- **問題**: 本番ユーザーのコンソールにログが出続ける
- **対処**: 全ファイルで `DEBUG = false` に切り替える、または環境変数的な仕組み (例: storage.local の `__debug` フラグ) で動的切替

---

### B-03. Claude.ai DOM セレクタの自動追従 / 監視
`[Medium] [Tech debt]`

- **状態**: `claude_site_adapter.js` の `STOP_BUTTON_SELECTORS` は cycle-1 時点の Claude.ai UI を前提
- **問題**: Claude.ai の UI 変更でセレクタが壊れると拡張機能が機能しなくなる (要件 §10.3 既知リスク)
- **対処案**:
  - 複数の冗長なセレクタとテキストフォールバック (実装済) を維持・拡充
  - 失敗を検知したらユーザーに通知する仕組み (未実装、アンチスコープ #5 と整合の判断要)

---

### B-04. Chrome Web Store 申請手順のドキュメント化
`[Medium] [Doc]`

- **状態**: README に「申請を見据えた品質」とあるが、具体手順は未整備
- **対処**: ストアリスティング (説明文、スクリーンショット、プライバシーポリシー)、`<all_urls>` 権限の説明、ZIP ビルド手順、レビュー対応のチェックリストを `docs/release-process.md` 等に整備

---

### B-05. US-06 の本格的なオンボーディング画面
`[Low] [Feature]`

- **状態**: 現状は Options Page で `sites.length === 0` の場合に空状態案内テキストのみ
- **対処案**: 初回起動時のチュートリアル風 UI、登録例のテンプレート提示 (YouTube お気に入り URL の入力ガイド等)

---

### B-06. 探索範囲を全ウィンドウに拡張するオプション
`[Low] [Feature]`

- **状態**: 現状は現在のフォーカスウィンドウのみ探索 (Q4-1=A、`getLastFocused`)
- **問題**: 別ウィンドウに開いている娯楽タブはヒットしない
- **対処案**: Options Page に「全ウィンドウから探す」トグル追加、`chrome.tabs.query({})` で全タブ取得

---

### B-07. 他AIサービス対応 (ChatGPT, Gemini ほか)
`[Low] [Feature]`

- **状態**: cycle-1 では Claude.ai のみ対応 (Q2=A、アンチスコープ #2)
- **対処案**: サイトアダプタを抽象化 (現状の ClaudeSiteAdapter を `content/adapters/claude.js` のような形に分離)、サイト別の DOM シグナルセレクタを各アダプタに閉じ込める

---

### B-08. ON/OFF トグル / 一時停止機能
`[Low] [Feature]`

- **状態**: 現状は常時 ON (CQ6=D、アンチスコープ #6)
- **対処案**: ツールバーアイコンのバッジで ON/OFF 表示、Options Page にトグル追加

---

### B-09. 統計機能 (待ち時間累計、娯楽時間累計)
`[Low] [Feature]`

- **状態**: 現状は記録しない (アンチスコープ #1)
- **対処案**: chrome.storage.local に統計用キーを追加し、サイクルごとに累計加算。Options Page で表示

---

### B-10. 多言語化 (i18n)
`[Low] [Feature]`

- **状態**: 現状は日本語固定 (NFR-06、アンチスコープ #9)
- **対処案**: `_locales/ja/messages.json`, `_locales/en/messages.json` を整備、`manifest.json` に `default_locale: "en"` を追加 (cycle-1 で削除した経緯あり、`_locales` 整備とセット)

---

### B-11. 自動テストの導入 (任意)
`[Low] [Tech debt]`

- **状態**: 現状は自動テストフレームワーク未導入 (NFR-04、Q13=C)
- **対処案**:
  - 純粋関数 (`extractDomain`, `validateDomain`, `validateUrl`, `validateThreshold`) は `node --test` で軽く回す
  - Service Worker 内モジュールは ES Modules のまま Node 上で import してロジックテスト
  - E2E は Playwright で Chrome 拡張をロードしてシナリオ実行 (重め)
- **判断**: NFR-04 (ビルド不要) と整合する範囲で導入を検討

---

## cycle-4 で完了した項目

cycle-4 (2026-05-27 完了) では以下を実装:

### 新規 Unit
- **Unit 1: vscode-extension** (新規 TypeScript 拡張機能、Kiro 用)
  - `vscode-extension/src/extension.ts` (~530 行、9 論理コンポーネント)
  - `vscode-extension/package.json` / `tsconfig.json` / `.gitignore` / `.vscodeignore`
  - 設定: `aiWaitLessMode.urls` / `aiWaitLessMode.enabled`
  - コマンド: `waitless.startWaiting` / `waitless.endWaiting`
  - `tsc` フル strict ビルド成功、`out/extension.js` 22KB
- **Unit 2: chrome-extension-bridge** (既存 Chrome 拡張への改修、v0.4.0)
  - 新規: `extension/sw/ide_bridge.js` (~280 行) — WebSocket クライアント + IPC ディスパッチ
  - 改修: `extension/service_worker.js` (2 行追加)、`extension/manifest.json` (v0.3.0 → v0.4.0)、Options Page (IPC ON/OFF トグル追加)
- **Unit 3: agent-hooks-templates** (Hook テンプレート 2 バリアント)
  - `vscode-extension/templates/hooks/{01-on-prompt-submit,02-on-agent-stop}.{variant-a,variant-b}.json` (4 ファイル)
  - `vscode-extension/templates/hooks/README.md` (~150 行)

### 新規機能
- ローカル WebSocket IPC レイヤー (`ws://127.0.0.1:39472`) — 双方向、7 メッセージタイプ
- 指数バックオフ再接続 (1→2→4→8→16→30s 頭打ち) + PING/PONG ヘルスチェック
- Kiro Agent Hooks との連動 (promptSubmit / agentStop)
- macOS osascript 経由の Kiro ウィンドウ最前面化
- フォールバックパス: IPC 失敗時は `vscode.env.openExternal` で OS デフォルトブラウザ起動

### NFR-27 (後方互換性) の実証
- 既存 cycle-1〜3 のシナリオ (T-01〜T-30) に影響を出さないため、`extension/sw/{message_router,wait_orchestrator,tab_manager,settings_repository,runtime_state}.js` および `extension/content/*` 3 ファイル + `extension/reader/*` 4 ファイルは **完全無変更** (`git status` で実証済)
- `extension/service_worker.js` への変更は **2 行追加のみ** (`import IdeBridge` + `IdeBridge.init()`)

cycle-4 では以下の Backlog 項目は **対応せず継続**:
- B-01〜B-11 すべて (cycle-4 のスコープから外した)

cycle-4 で **新規追加** された Backlog 項目:
- **B-12** [Medium] [Tech debt] cycle-4 デバッグログを本番化前に OFF にする (`extension/sw/ide_bridge.js` および `vscode-extension/src/extension.ts` の `DEBUG = true` を切替)
- **B-13** [Medium] [Feature] Kiro アプリ名のハードコード (`APP_NAME_FOR_OSASCRIPT = 'Kiro'`) を `aiWaitLessMode.appName` で設定化 (R-02、Kiro 別名インストール対応)
- **B-14** ✅ 完了 (cycle-4 検証済、2026-05-28) [Medium] [Tech debt] cycle-4 手動 E2E (T-41〜T-56) の実機検証 — Hook ブリッジ方式 + Chrome 前面化修正で動作確認済 (`docs/cycle-5-handover.md` §3 参照)
- **B-15** [Low] [Feature] Antigravity 風の高度なブラウザ操作 (cycle-4 では sites 共有 + 動画一時停止のみ実装、もっと細かいタブ制御は将来 cycle)
- **B-16** [Low] [Feature] Windows / Linux 対応 (cycle-4 は macOS osascript 限定)
- **B-17** [Low] [Feature] VS Code Extension の VSIX パッケージング + Marketplace / Open VSX 公開 (cycle-4 はローカル開発のみ)
- **B-18** [Low] [Tech debt] cycle-4 IPC プロトコルにバージョンフィールドを追加 (Q2=B でなしを選択、将来後方互換性が必要になった時に追加)
- **B-19** [Low] [Feature] 複数の Kiro / VS Code ウィンドウ対応 (cycle-4 は 1 ウィンドウ前提、AS-01)
- **B-20** [Medium] [Tech debt] **設計の再検討: Pattern γ → Pattern α 撤退判断** — cycle-4 動作確認後、要件 (URL ランダム選択 + 外部ブラウザ起動 + Kiro 戻り) は **Hook 単独 (Pattern α) でも実現可能** だったことが判明 (`open` コマンド + `osascript` で完結、約 10 行の JSON 2 つで足りる)。cycle-4 で実装した VS Code 拡張 (~530 行) + Chrome 拡張 IPC レイヤー (~280 行) は、動画自動再生/一時停止と既存タブ完全制御が必要な場合のみ価値がある。cycle-5 開始時、ユースケースを再評価して以下を判断する: (a) 現状維持 (Pattern γ)、(b) Pattern α へ撤退 (vscode-extension/ + extension/sw/ide_bridge.js を削除し、Hook を `open` + `osascript` 2 行に置換)、(c) ハイブリッド (Pattern γ を残しつつ Pattern α 版テンプレートも提供)。詳細は `docs/cycle-5-handover.md` §4.4 参照

---

## cycle-5 で完了した項目

cycle-5 (2026-05-28 完了) では以下を実装:

### 新規 Unit
- **Unit 1: portal-page** (新規、Chrome 拡張内蔵の娯楽ポータルページ)
  - `extension/portal/portal.html` (28 行) — DOM 骨格
  - `extension/portal/portal.css` (230 行) — ダーク基調 (#0a0a0f) + 紫アクセント (#7c3aed) の Netflix 風レイアウト
  - `extension/portal/portal.js` (170 行) — PORTAL_DATA からカード/ジャンル行を動的レンダリング、URL バリデーション、Reader URL の動的解決
  - `extension/portal/portal_data.js` (175 行) — `window.PORTAL_DATA` 静的データ (12 ジャンル × 6 カード = 72 サイト)

### 新規機能
- Netflix 風カードグリッド (12 ジャンル × 6 カード = 72 サイト)
  - 動画視聴 / 音楽 / EC / ゲーム / SNS / ニュース / 読書 / 漫画 / スポーツ / 料理 / 旅行 / リラックス
- 横スクロール (`scroll-snap-type: x mandatory`) + ホバー拡大 + キーボード操作可
- Options Page 空状態案内に「🎬 娯楽ポータル (内蔵)」を追加 + ワンクリック登録ボタン (`injectPortalExampleUrl`)
- カードクリックは `<a href>` のデフォルト挙動 = 同タブ遷移

### NFR-54 (cycle-1〜4 後方互換性) の実証
- `extension/sw/*` 6 ファイル + `extension/content/*` 3 ファイル + `extension/reader/*` 4 ファイル + `extension/service_worker.js` + `vscode-extension/*` 一式は **完全無変更** (`git status` で実証)
- 既存 `extension/manifest.json` への変更は最小: `web_accessible_resources.resources` に portal/* 4 件追加 + version `0.4.0` → `0.5.0` + description 追記
- 既存 `extension/options/*` への変更は空状態案内 1 項目 + 関数 1 つ + CSS 1 ブロック追加のみ

cycle-5 では以下の Backlog 項目は **対応せず継続**:
- B-01〜B-13、B-15〜B-19、B-20 すべて (cycle-5 のスコープから外した)

cycle-5 で **新規追加** された Backlog 項目:
- **B-21** [Low] [Feature] ポータルページのカード画像対応 (現状は絵文字のみ、サムネイル画像を `extension/portal/assets/` 配下に置きたくなったら検討)
- **B-22** [Low] [Feature] ポータルページのお気に入り / 履歴機能 (`chrome.storage.local` の `portal_state` キーを追加、`reader_state` と同じパターン)
- **B-23** [Low] [Feature] ポータルページのジャンルフィルタ / 検索機能 (カード数が 100 を超えたら必要になる)
- **B-24** [Low] [Feature] ユーザー UI からのカード追加・編集 (現状は `portal_data.js` 直接編集)
- **B-25** [Low] [Tech debt] ポータルページのリンク切れ検知 (カードクリック時の遷移失敗を捕捉、または定期チェック)
- **B-26** [Low] [Feature] モバイル幅 (< 768px) 対応 (現状は 768〜1280px のみ保証)
- **B-27** [Low] [Tech debt] ポータルページのデバッグログ OFF (`extension/portal/portal.js` の `const DEBUG = true;`、B-02 / B-12 と同類)

---

## Backlog 運用ルール

- 新しい項目は末尾に追加し、ID (B-NN) を採番
- 項目を着手したら **担当 cycle 番号** を行末に追記 (例: `→ cycle-2 で着手`)
- 完了した項目は削除せず、`✅ 完了 (cycle-N)` と書いて残す (履歴を保つ)
- 優先度を上げ下げした場合はコメントで理由を明記

---

## cycle-2 で完了した項目

cycle-2 (2026-05-27 完了) では以下を実装:

- 遷移先バリエーション拡大 (動画 / ゲーム / EC / SNS / ストレッチ瞑想を公式サポート対象に)
  - Options Page 空状態に 5 種の用途例 + サンプル URL
  - `manifest.json` の `default_title` 汎用化、`description` 拡張、version `0.2.0`
  - `extension/README.md` に「対応する遷移先パターン」セクション追加
- データモデル / コアロジックは非変更 (タイプ概念は導入しない方針)
- Backlog 項目としては **新規追加 (cycle-3 候補)** 扱いではなく、要望ベースの単発機能として実装

cycle-2 では以下の Backlog 項目は **対応せず継続**:
- B-01〜B-11 すべて (cycle-2 のスコープから外した)

---

## cycle-3 で完了した項目

cycle-3 (2026-05-27 完了) では以下を実装:

- 拡張機能内蔵の **Reader Page** (`extension/reader/`) を新規追加
  - `reader.html` / `reader.css` / `reader.js` / `novel.txt` (オリジナルダミー、ユーザー差し替え可能)
  - クリックでの既読範囲青色化 (双方向、絶対上書き)
  - `chrome.storage.local` の `reader_state` キーに、スクロール位置 + クリック位置を永続化
  - 起動時に状態復元 (青色化 → スクロール、`requestAnimationFrame` で次フレーム後)
- 既存 Site 登録モデルでの統合
  - `manifest.json` に `web_accessible_resources` 追加 (`reader/*` を `<all_urls>` で公開)、version `0.3.0`
  - `extension/sw/settings_repository.js` の `DOMAIN_REGEX` を拡張機能 ID 対応に拡張、`validateUrl` の protocol 許可リストに `chrome-extension:` 追加 (BR-01/02 改訂)
  - `extension/options/options.{html,js}` の空状態案内に「📖 読書 (内蔵)」を追加 + 動的 URL 注入 (`injectReaderExampleUrl`) + `validateUrl/Domain` の二重防御整合
- 主要ロジック側ファイル (sw/{message_router, wait_orchestrator, tab_manager, runtime_state}, content/*, service_worker.js) は **完全無変更**

cycle-3 では以下の Backlog 項目は **対応せず継続**:
- B-01〜B-11 すべて (cycle-3 のスコープから外した)

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md`
- 次サイクルへの引き継ぎ: `docs/cycle-6-handover.md`
- cycle-3 開始時の手引き (履歴): `docs/cycle-3-handover.md`
- cycle-4 開始時の手引き (履歴): `docs/cycle-4-handover.md`
- cycle-5 開始時の手引き (履歴): `docs/cycle-5-handover.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
- cycle-3 archive: `aidlc-docs-waitless-archive/cycle-3/`
- cycle-4 archive: `aidlc-docs-waitless-archive/cycle-4/`
- cycle-5 archive: `aidlc-docs-waitless-archive/cycle-5/`
