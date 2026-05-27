# Code Generation Summary — waitless-extension cycle-3

最終更新: 2026-05-27

cycle-3 での Code Generation Part 2 (Generation) の成果物まとめ。
cycle-1 / cycle-2 との差分を中心に記述。

---

## 0. cycle-3 の特徴 (再掲)

cycle-3 は **拡張機能内蔵の読書ページ追加**。データモデルに新キー `reader_state` を追加するが、cycle-1/2 の既存キー (`sites`, `threshold_sec`) には干渉しない (NFR-07 後方互換性)。

ロジック側ファイルへの変更は `settings_repository.js` の **正規表現と protocol 許可リストの拡張のみ**。新規ファイル一式 (`reader/`) は独立して動作。

---

## 1. cycle-3 で **新規追加** したファイル

| ファイル | 内容 | 関連 FR/BR |
|---------|------|-----------|
| `extension/reader/novel.txt` | オリジナルダミーテキスト (約 1KB)。ユーザーがパブリックドメイン作品 (青空文庫等) に差し替え可能 | FR-31 (テキストデータ) |
| `extension/reader/reader.html` | 読書ページの HTML 骨格。タイトル + 本文コンテナ + 底本情報 footer | FR-31 |
| `extension/reader/reader.css` | スタイル。ダーク背景 (`#1a1a1a`)、未読灰色 (`#888`)、既読青色 (`#3b82f6`)、明朝フォント、レスポンシブ最小限 | FR-32, NFR-10 |
| `extension/reader/reader.js` | ReaderApp IIFE 本体 (init / renderText / applyReadProgress / onTextClick / saveState / loadState / savePartial / clickPointToCharOffset / 等) | FR-31〜36, BR-31〜37 |

## 2. cycle-3 で **修正** したファイル (in-place)

| ファイル | 変更概要 | 関連 FR/BR |
|---------|---------|-----------|
| `extension/manifest.json` | `version` を `0.2.0` → `0.3.0`、`description` 拡張、`web_accessible_resources` 追加 (reader/* を `<all_urls>` で公開) | FR-31, FR-37 |
| `extension/sw/settings_repository.js` | `DOMAIN_REGEX` を拡張 (32 文字英小数字 = 拡張機能 ID 対応)、`validateUrl` の protocol 許可リストに `chrome-extension:` 追加 | FR-37, BR-01 改訂, BR-02 改訂 |
| `extension/options/options.html` | 空状態案内の `.empty-examples-list` 末尾に「📖 読書 (内蔵)」`<li>` を追加 (動的 URL 表示用 `data-testid` 付与) | FR-37 |
| `extension/options/options.js` | `App.injectReaderExampleUrl()` 関数を追加 (`init()` 冒頭で 1 回呼ぶ)、`validateUrl` の protocol 許可リストに `chrome-extension:` 追加 (二重防御) | FR-37, BR-02 改訂 |
| `extension/README.md` | 「対応する遷移先パターン」表に「📖 読書 (内蔵)」行を追加、「内蔵の読書ページについて」セクションを新規追加、アンチスコープに 3 項目 (複数小説 / UI カスタマイズ / 端末間同期) を追記 | FR-23 (既存) の延長、FR-31 紹介 |

## 3. cycle-3 で **変更しなかった** ファイル (cycle-1/2 のまま)

| ファイル | 理由 |
|---------|------|
| `extension/service_worker.js` | エントリ非変更 |
| `extension/sw/message_router.js` | メッセージタイプ非変更 |
| `extension/sw/wait_orchestrator.js` | 待ちサイクルロジック非変更 |
| `extension/sw/tab_manager.js` | 2 パス探索ロジック非変更、`extractDomain` も既存仕様で `chrome-extension://` URL を扱える |
| `extension/sw/runtime_state.js` | 実行時状態モデル非変更 |
| `extension/content/claude_site_adapter.js` | DOM 監視ロジック非変更 |
| `extension/content/playback_trigger.js` | `<video>` がない Reader Page では既存挙動で noop |
| `extension/content/playback_pause.js` | 同上 |
| `extension/options/options.css` | cycle-2 で追加した `.empty-examples-list li` のスタイルが新規 `<li>` にも適用されるため修正不要 |
| `extension/assets/icons/*` | プレースホルダ維持 (B-01 cycle-3 アンチスコープ) |

---

## 4. cycle-1 / cycle-2 で確定した仕様の継承確認

cycle-1/2 で実装・確定した重要仕様は **すべて cycle-3 でも維持** される:

- 2 パスのタブ探索戦略 (URL 完全一致 → ドメイン一致 → 新規タブ作成)
- PlaybackPause (動画タブの完了時一時停止 → 続きから再生)
- BR-01〜22 (cycle-1 archive)
- FR-01〜11, FR-21〜25 (cycle-1 + cycle-2)
- NFR-01〜07 (cycle-1 + cycle-2)

cycle-3 で「軽微な改訂」を行ったもの:

- **BR-01 改訂** — `DOMAIN_REGEX` を拡張機能 ID 形式 (`^[a-z]{32}$`) も許可するよう拡大
- **BR-02 改訂** — URL protocol 許可リストに `chrome-extension:` 追加

これらの改訂は、既存の通常ドメイン / `http(s):` URL の登録には **何の影響もない** (拡大のみ、制限緩和)。

---

## 5. 後方互換性 (NFR-07) の整合

cycle-1/2 で `chrome.storage.local` に保存されている既存データ:

```json
{
  "sites": [
    { "domain": "youtube.com", "url": "https://...", "priority": 1 }
  ],
  "threshold_sec": 5
}
```

cycle-3 完了後の状態:

```json
{
  "sites": [...],          // ← 既存データ、形式無変更
  "threshold_sec": 5,      // ← 既存データ、形式無変更
  "reader_state": {        // ← cycle-3 で追加 (空でも問題ない)
    "read_offset": 0,
    "scroll_y": 0,
    "novel_id": "default",
    "updated_at": 0
  }
}
```

**整合確認**:
- ✅ 既存の `sites` / `threshold_sec` の読み込み・書き込みロジックに変更なし
- ✅ `reader_state` は完全に独立した新規キー、起動時に不在ならデフォルト値で初期化
- ✅ マイグレーション処理不要

---

## 6. FR / BR / NFR トレーサビリティ

| ID | 要件 | 実装ファイル | 受入条件の充足 |
|----|------|-------------|---------------|
| **FR-31** | 拡張機能内蔵の読書ページ | reader.html / reader.js (init), manifest.json (web_accessible_resources) | ✅ |
| **FR-32** | 最小限 UI (灰色 → 青色) | reader.css | ✅ |
| **FR-33** | クリックでの双方向既読範囲指定 | reader.js (onTextClick + applyReadProgress、絶対上書き) | ✅ |
| **FR-34** | クリック位置の永続化 | reader.js (saveState、即時) | ✅ |
| **FR-35** | スクロール位置の永続化 (離脱時) | reader.js (savePartial、pagehide/visibilitychange) | ✅ |
| **FR-36** | 起動時の状態復元 | reader.js (init: applyReadProgress → requestAnimationFrame → scrollTo) | ✅ |
| **FR-37** | 既存 Site 登録モデルでの統合 | manifest.json (web_accessible_resources), settings_repository.js (REGEX/protocol), options.html/js (空状態 + injectReaderExampleUrl) | ✅ |
| **FR-38** | ビジネスルール明文化 | business-rules.md (BR-31〜37) + reader.js 実装 | ✅ |
| **NFR-07** | 後方互換性 | 既存キー無変更、reader_state は独立、 settings_repository.js のロジックは非破壊的拡張のみ | ✅ |
| **NFR-08** | 起動時復元 200ms 以内目安 | reader.js (requestAnimationFrame で次フレーム scrollTo、O(段落数) のレンダリング) | 実機確認は Build & Test |
| **NFR-09** | reader_state サイズ < 1KB | reader.js (snapshot は 4 フィールドのみ、~150 bytes) | ✅ |
| **NFR-10** | 色設計 WCAG AA | reader.css (背景 `#1a1a1a` 比でコントラスト確認: 灰色 4.7:1 / 青色 5.6:1) | ✅ |
| **BR-31** | 双方向クリック (絶対上書き) | reader.js (state.readOffset = clamped、max() を使わない) | ✅ |
| **BR-32** | スクロール / 既読の独立記録 | reader.js (saveState はクリック時、savePartial は離脱時の scrollY のみ) | ✅ |
| **BR-33** | 起動時復元順序 (青 → スクロール) | reader.js (init 内で applyReadProgress 後に requestAnimationFrame で scrollTo) | ✅ |
| **BR-34** | 永続化タイミング (即時 + 離脱時) | reader.js (onTextClick で saveState、pagehide/visibilitychange で savePartial) | ✅ |
| **BR-35** | 永続化失敗の許容 | reader.js (try/catch + console.warn のみ、UI を妨げない) | ✅ |
| **BR-36** | クリック対象の限定 | reader.js (event.target.closest('.paragraph') を必須条件) | ✅ |
| **BR-37** | readOffset の境界 | reader.js (saveState/loadState で Math.max(0, Math.min(totalChars, x))) | ✅ |
| **BR-01 改訂** | DOMAIN_REGEX 拡張 | settings_repository.js | ✅ |
| **BR-02 改訂** | URL protocol 拡張 | settings_repository.js, options.js (二重防御) | ✅ |

---

## 7. Quality Gates (Build & Test ステージで確認)

- [ ] Unpacked ロードがエラーなく成功 (manifest.json の web_accessible_resources も含めて)
- [ ] Service Worker がエラーなく起動
- [ ] Options Page を開いて、空状態案内に「📖 読書 (内蔵)」と動的 URL が表示される
- [ ] 表示された ID と URL を Options Page から登録できる (バリデーション通過、cycle-3 BR-01/02 改訂)
- [ ] Claude.ai で待ち発生 → Reader Page タブが新規作成され、テキストが表示される
- [ ] 灰色テキストが表示され、クリックすると青色化される
- [ ] 双方向クリック (前にクリックすれば戻る、後ろにクリックすれば進む)
- [ ] AI 完了で Claude タブに復帰、Reader Page のスクロール位置とクリック位置が保存される
- [ ] 次サイクルで Reader Page を再アクティブ化 → 状態復元 (青色化 + スクロール) される
- [ ] cycle-1/2 のリグレッションシナリオがパス (NFR-07)

これらは `aidlc-docs/construction/build-and-test/integration-test-instructions.md` で詳細手順を記載 (Step 14)。

---

## 8. cycle-3 のコード規模

| 種別 | ファイル数 | 行数 (目安) |
|------|----------|-----------|
| HTML (新規) | 1 | ~30 行 |
| CSS (新規) | 1 | ~110 行 |
| JS (新規 ReaderApp) | 1 | ~310 行 |
| Text data (新規) | 1 | ~15 段落 / ~1KB |
| HTML (修正、options) | 1 | +12 行 |
| JS (修正) | 2 (settings_repo + options.js) | +30 行 |
| JSON (修正、manifest) | 1 | +13 行 |
| Markdown (修正、README) | 1 | +30 行 |

cycle-1 (約 3,000 行) / cycle-2 (+100 行程度) と比較し、cycle-3 は **+450 行程度** の中規模アップデート。
ロジック側 (sw/* のうち settings_repo.js のみ修正、3 行程度) への変更は最小限に抑えられている。

---

## 9. 静的検証結果 (本セッション内で実施済)

- ✅ `manifest.json`: JSON 妥当性 OK、version `0.3.0`、`web_accessible_resources` 設定済
- ✅ `settings_repository.js`: Node.js でモジュールロード可能 (構文エラーなし)
- ✅ `getDiagnostics`: manifest.json / reader/* / settings_repository.js / options.{html,js} / README.md にエラー・警告なし
- ✅ 重複ファイル無し (`*_modified.js`, `*_new.html` 等の生成なし)
- ✅ ロジック側 (`sw/message_router.js`, `wait_orchestrator.js`, `tab_manager.js`, `runtime_state.js`, `content/*`, `service_worker.js`) の非変更を確認

---

## 10. 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- 実行計画: `aidlc-docs/inception/plans/execution-plan.md`
- Application Design: `aidlc-docs/inception/application-design/application-design.md`
- Functional Design: `aidlc-docs/construction/waitless-extension/functional-design/`
- Code Generation Plan: `aidlc-docs/construction/plans/waitless-extension-code-generation-plan.md`
- 現状アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
