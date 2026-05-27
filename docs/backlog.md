# WaitLess — Backlog

cycle-1 完了時点で抽出された「次にやるかもしれない」項目の一覧。次サイクルの Inception でスコープ選定の出発点として使う。

最終更新: 2026-05-26 (cycle-1 完了時点)

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

## Backlog 運用ルール

- 新しい項目は末尾に追加し、ID (B-NN) を採番
- 項目を着手したら **担当 cycle 番号** を行末に追記 (例: `→ cycle-2 で着手`)
- 完了した項目は削除せず、`✅ 完了 (cycle-N)` と書いて残す (履歴を保つ)
- 優先度を上げ下げした場合はコメントで理由を明記

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md`
- 次サイクルへの引き継ぎ: `docs/cycle-2-handover.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
