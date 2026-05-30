# Code Generation Summary — waitless-extension (cycle-2)

最終更新: 2026-05-27

cycle-2 での Code Generation Part 2 (Generation) の成果物まとめ。
cycle-1 サマリ (`aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/code/code-generation-summary.md`) との差分を中心に記述。

---

## 0. cycle-2 の特徴 (再掲)

cycle-2 は **データモデル / コアロジック非変更** で、ユーザー向けメッセージング・オンボーディング・ドキュメント整備を主眼とする小規模アップデート。

- 新コンポーネントなし
- 新ビジネスルールなし
- 新メッセージタイプなし
- 既存ファイルの **in-place modify** のみ (重複ファイル禁止のルールを順守)

---

## 1. 変更したファイル (cycle-2 で in-place modify)

| ファイル | 変更概要 | 関連 FR |
|---------|---------|---------|
| `extension/manifest.json` | `version` を `0.1.0` → `0.2.0` に更新。`description` を「動画やSNS」から「動画・ゲーム・SNS・EC・ストレッチ瞑想」に拡張。`action.default_title` を `WaitLess (クリックで設定を開く)` から `WaitLess — 待ち時間を有効活用 (クリックで設定)` に変更 | FR-25, (description は cycle-2 メッセージング統一のための補助変更) |
| `extension/options/options.html` | `#empty-state` 内に **5 種類の用途例** (動画 / ゲーム / EC / SNS / ストレッチ瞑想) のサンプル ドメイン + URL を追加。`data-testid="empty-state-examples"` 付与 | FR-22 |
| `extension/options/options.css` | 上記マークアップ用のスタイル追加 (`.empty-examples`, `.empty-examples-list`, `.example-emoji`, `.empty-state code` 等) | FR-22 (補助) |
| `extension/README.md` | 「対応する遷移先パターン」セクションを新規追加 (5 種類の表)。冒頭文言を「動画・ゲーム・SNS・EC ショッピング・ストレッチ瞑想など」に更新。動作概要を一般化、アンチスコープに「カテゴリ別振る舞い分岐なし」を明記 | FR-23 |

## 2. 変更しなかったファイル (cycle-2 アンチスコープ、cycle-1 のまま)

| ファイル | 理由 |
|---------|------|
| `extension/service_worker.js` | コアロジック非変更 |
| `extension/sw/message_router.js` | メッセージタイプ非変更 |
| `extension/sw/wait_orchestrator.js` | 待ちサイクルロジック非変更 |
| `extension/sw/tab_manager.js` | 2 パス探索ロジック非変更 |
| `extension/sw/settings_repository.js` | データモデル非変更 (`{domain, url, priority}` 維持) |
| `extension/sw/runtime_state.js` | 実行時状態モデル非変更 |
| `extension/content/claude_site_adapter.js` | DOM 監視ロジック非変更 |
| `extension/content/playback_trigger.js` | 動画再生試行ロジック非変更 (動画なしページでは元から noop) |
| `extension/content/playback_pause.js` | 動画一時停止ロジック非変更 |
| `extension/options/options.js` | UI ロジック非変更 (空状態の表示は HTML/CSS で完結) |
| `extension/assets/icons/*` | 既存プレースホルダ維持 (B-01 cycle-2 アンチスコープ) |

## 3. cycle-1 で確定した仕様の継承確認

cycle-1 で実装・確定した重要仕様は **すべて cycle-2 でも維持** される:

- 2 パスのタブ探索戦略 (URL 完全一致 → ドメイン一致 → 新規タブ作成)
- PlaybackPause (完了時の動画一時停止 → 次サイクルで続きから再生)
- 既存タブヒット時の `activateTab` 明示呼び出し
- Claude.ai の日本語 UI 向け DOM セレクタ
- `Extension context invalidated.` 検知ガード
- 新規タブ注入のロード完了待ち (`chrome.tabs.onUpdated` で `status: 'complete'` を最大 8秒)
- PlaybackTrigger のリトライ (最大 8回 / 0.5秒間隔)
- BR-01〜22 (cycle-1 archive `business-rules.md` 参照)

これらは cycle-2 で **コードを変更していない** ため、自動的に維持される。

---

## 4. 後方互換性 (NFR-07) の整合

cycle-1 で `chrome.storage.local` に保存されている既存データ:

```json
{
  "sites": [
    { "domain": "youtube.com", "url": "https://youtu.be/xxx", "priority": 1 }
  ],
  "threshold_sec": 5
}
```

cycle-2 ではデータモデルを変えないため:

- ✅ 起動時に `SettingsRepository.getSettings()` でそのまま読み込める
- ✅ 既存の `priority`、`threshold_sec` バリデーションも変更なし
- ✅ マイグレーション処理不要
- ✅ Options Page でも問題なく表示・編集可能

検証は Build & Test ステージ (Integration Test シナリオ T-13) で行う。

---

## 5. FR トレーサビリティ (cycle-2 で実装した FR)

| FR ID | 要件 | 実装ステップ | 受入条件の充足 |
|-------|------|-------------|---------------|
| **FR-21** | 多様な遷移先のサポート | 既存実装で対応 (コード変更なし) | Build & Test の T-14, T-15, T-16 で検証 |
| **FR-22** | Options Page 空状態案内の拡張 | Step 3 (HTML), Step 4 (CSS) | 5 種以上の用途例 + サンプル URL、`<code>` でコピペ可能形式、`data-testid` 付与 ✅ |
| **FR-23** | README の更新 | Step 6 | 「対応する遷移先パターン」セクション追加 (5 種の表)、冒頭文言更新 ✅ |
| **FR-24** | 動画以外サイトでの誤動作なし | コード変更なし、Build & Test で検証 | T-14, T-15, T-16 で検証 |
| **FR-25** | `default_title` 文言の汎用化 | Step 2 | `default_title` から「YouTube」表現を排除、汎用文言化 ✅ |
| **NFR-07** | 後方互換性 | コード変更なし、Build & Test で検証 | T-13 で検証 |

---

## 6. 既知の Quality Gates (Build & Test ステージで確認)

- [ ] Unpacked ロードがエラーなく成功
- [ ] Service Worker がエラーなく起動
- [ ] Options Page を初回起動 (空状態) すると 5 種類の用途例が表示される
- [ ] 拡張機能アイコンのツールチップに新 `default_title` が表示される
- [ ] cycle-1 動作シナリオ (Claude.ai 待ち発生 → 切替 → 完了 → 復帰) がリグレッションなく動作
- [ ] cycle-1 で登録済データ (もし保持されていれば) がそのまま読める (NFR-07)
- [ ] EC / SNS / ゲーム / 瞑想 URL でも切替時にコンソールエラーなし (FR-24)

これらは `aidlc-docs/construction/build-and-test/integration-test-instructions.md` に詳細手順を記載。

---

## 7. cycle-2 のコード規模

| 種別 | ファイル数 | 増減行数 (目安) |
|------|----------|----------------|
| HTML | 1 (modify) | +約 50 行 |
| CSS | 1 (modify, append) | +約 60 行 |
| JSON (manifest) | 1 (modify) | 数行 |
| Markdown (README) | 1 (rewrite) | +約 20 行 (実質的な追加分) |
| JS (動作変更) | 0 | 0 |

cycle-1 (約 3,000 行 / 16 ファイル) との比較で **コード規模としては数 % 程度** の小規模アップデート。

---

## 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- 実行計画: `aidlc-docs/inception/plans/execution-plan.md`
- コード生成プラン: `aidlc-docs/construction/plans/waitless-extension-code-generation-plan.md`
- 現状アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- cycle-1 archive サマリ: `aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/code/code-generation-summary.md`
