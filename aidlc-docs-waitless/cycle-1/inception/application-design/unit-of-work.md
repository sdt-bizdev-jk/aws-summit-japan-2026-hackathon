# Unit of Work — WaitLess

**プロジェクト**: WaitLess (Chrome 拡張機能 / Manifest V3)
**フェーズ**: INCEPTION - Units Generation
**作成日**: 2026-05-26

---

## 1. ユニット定義

### Unit U1: `waitless-extension` (本プロジェクトの唯一のユニット)

| 項目 | 内容 |
|------|------|
| ユニット名 | `waitless-extension` |
| 種別 | Chrome 拡張機能 (Manifest V3 / 単一パッケージ) |
| 配置 | リポジトリ直下 `extension/` |
| 含むコンポーネント | C1 〜 C9 のすべて (MessageRouter, WaitOrchestrator, TabManager, SettingsRepository, RuntimeState, ClaudeSiteAdapter, PlaybackTrigger, OptionsApp, OptionsAPI) |
| 含むストーリー (本サイクル) | US-01, US-02, US-04, US-05 (4ストーリー) |
| 含むストーリー (best-effort) | US-03 (動画自動再生)。実装するが完全動作はオートプレイポリシー依存で許容 |
| 含むストーリー (本サイクル省略) | US-06 (初回オンボーディング) — 設計のみ残し、画面表示は最小限 |
| 主要責務 | 中核体験ループ (待ち発生→娯楽タブ切替→出力完了→AIタブ戻り) と設定UIを 1パッケージで提供 |
| 依存 | なし (本拡張機能のみで完結、外部サービス連携なし) |
| 想定実装時間 | Functional Design 0.5〜1 時間 + Code Generation 1〜2 時間 + Build & Test 0.5〜1 時間 |
| 成果物 | `extension/` 配下のファイル一式 (詳細は §3) |

---

## 2. なぜ 1 ユニットなのか (ユニット分割方針)

回答 (Q1=A) に基づき、本プロジェクトは **1 ユニット構成** を採用する。理由:

1. **規模**: 推定 3〜5.5 時間の作業量で、9 コンポーネントすべてが単一の `manifest.json` の傘下で動作する
2. **密結合の必然性**: Service Worker / Content Script / Options Page は Chrome の sendMessage を介した協調動作が前提で、それぞれを独立ユニットとして切り出す技術的メリットが薄い
3. **管理コスト**: ユニット間の境界を維持するコストが、規模に対して相対的に大きい
4. **ハッカソン文脈**: 動くデモを最小ステップで完成させる目的に対しても、単一ユニットが最も直線的

将来 WaitLess を拡張 (例: 他 AI サービス対応、統計機能追加) する場合は、その時点でユニット分割を再考できる。

---

## 3. コード組織方針 (Greenfield)

回答 (Q5=A) に基づき、Application Design の構成をそのまま採用する。

```
[リポジトリルート]
├── README.md                       # プロジェクト全体README
├── aidlc-docs/                     # AI-DLC ドキュメント (本サイクル成果物)
├── aidlc-docs-tabitabi-archive/   # 過去サイクル退避 (たびたび、本プロジェクトと無関係)
├── references/                     # 参考資料
├── assets/                         # プロジェクト共通アセット
└── extension/                      # ★ Unit U1 (waitless-extension) ★
    ├── manifest.json               # Manifest V3 設定
    ├── service_worker.js           # Service Worker エントリ
    ├── sw/                         # Service Worker モジュール群
    │   ├── message_router.js       # C1: MessageRouter
    │   ├── wait_orchestrator.js    # C2: WaitOrchestrator
    │   ├── tab_manager.js          # C3: TabManager
    │   ├── settings_repository.js  # C4: SettingsRepository
    │   └── runtime_state.js        # C5: RuntimeState
    ├── content/
    │   ├── claude_site_adapter.js  # C6: ClaudeSiteAdapter (Claude.ai に static 注入)
    │   └── playback_trigger.js     # C7: PlaybackTrigger (娯楽タブに動的注入)
    ├── options/
    │   ├── options.html            # C8: OptionsApp の DOM
    │   ├── options.css
    │   └── options.js              # C8: OptionsApp + C9: OptionsAPI
    └── assets/
        └── icons/
            ├── icon16.png
            ├── icon48.png
            └── icon128.png
```

### 命名規約
- ファイル名: `snake_case.js` (素のJS、ビルドなしのため、可読性最優先)
- ディレクトリ名: 小文字単数 (`sw/`, `content/`, `options/`, `assets/`)
- アイコン PNG: 16/48/128 の 3 サイズを最低限 (Chrome Web Store 申請対応)

### `manifest.json` の最小構造 (Functional Design で詳細化)

```jsonc
{
  "manifest_version": 3,
  "name": "WaitLess",
  "version": "0.1.0",
  "description": "生成AIの出力待ち時間を、登録した娯楽サイトへの自動切替で快適にする",
  "default_locale": "ja",
  "permissions": ["storage", "tabs", "scripting"],
  "host_permissions": ["https://claude.ai/*"],
  "background": {
    "service_worker": "service_worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["content/claude_site_adapter.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "WaitLess"
  },
  "options_page": "options/options.html",
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  }
}
```

最小権限の原則: `host_permissions` は `https://claude.ai/*` のみ。娯楽タブへの動的注入 (`scripting.executeScript`) は対象 tabId 経由で行うため、`<all_urls>` は不要 (Functional Design で再確認)。

---

## 4. 本サイクルでの実装スコープ (Construction)

| 種類 | 項目 | 状況 |
|------|------|------|
| 実装する | manifest.json の最小バリデーション通過 | Code Generation |
| 実装する | service_worker.js + sw/ 5モジュール | Code Generation |
| 実装する | content/claude_site_adapter.js (FR-01〜03, 07) | Code Generation |
| 実装する | content/playback_trigger.js (FR-06 best-effort) | Code Generation |
| 実装する | options/ 一式 (FR-09, 10, 11) | Code Generation |
| 実装する | assets/icons/ (16/48/128) | Code Generation (placeholder で可) |
| 検証する | Unpacked ロード + 主要動線の手動検証 | Build & Test |
| 範囲外 | 自動テスト (Jest/Vitest 等) の整備 | NFR-04 ビルド不要方針に整合 |
| 範囲外 | i18n リソース | アンチスコープ #9 |
| 範囲外 | 統計機能 / トグル / ポップアップUI / 同期 | アンチスコープ #1, 6, 7, 3 |

---

## 5. 本サイクルでの未実装 (将来) と理由

| 項目 | 理由 |
|------|------|
| US-06 オンボーディング画面の作り込み | 設定UIに最小限の空状態案内 (テキスト1行) を含める形で代用、独立画面は作らない |
| Options Page の高度なUI (D&D 並び替え) | MVP 第1版は矢印ボタンや上下移動ボタン等の素朴なUIで十分 |
| 自動テスト | NFR-04 (ビルド不要) と整合させるため、必要に応じて素のJSの最小スクリプトに留める |

---

## 6. 完了基準 (Definition of Done for Unit U1)

- [ ] `extension/` 配下に必要なファイルが揃う (§3 のツリー)
- [ ] `manifest.json` が Manifest V3 として有効 (Chrome の Unpacked ロードでエラーなし)
- [ ] Claude.ai タブで Content Script が起動し、コンソールエラーが出ない
- [ ] Service Worker が起動し、`MessageRouter.init()` が呼ばれている
- [ ] Options Page が開ける、サイト追加で `chrome.storage.local` に保存される
- [ ] しきい値設定が保存される、Claude.ai 側に即時反映される
- [ ] (best-effort) Claude.ai でストリーミングが N秒続くと登録娯楽タブに切替する
- [ ] (best-effort) 完了検知で Claude.ai タブに戻る
- [ ] DevTools Network で外部送信なしを確認

詳細な検証手順は Build & Test ステージで規定する。
