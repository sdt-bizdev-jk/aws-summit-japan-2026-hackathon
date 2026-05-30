# Code Generation Plan — waitless-extension cycle-3

最終更新: 2026-05-27

cycle-3 で Reader Page (拡張機能内蔵の読書ページ) を追加する Code Generation の **単一の真実のソース**。各ステップ完了直後に [x] へ更新する。

---

## Unit Context

| 項目 | 内容 |
|------|------|
| **Unit Name** | `waitless-extension` (cycle-1 から継承する単一ユニット) |
| **Project Type** | Brownfield (cycle-1 + cycle-2 成果物 `extension/` を継承、version 0.2.0 → 0.3.0 に更新予定) |
| **Workspace Root** | `/Users/nt-240003/workspace/aws-summit-japan-2026-hackathon` |
| **Application Code Path** | `extension/` 配下 |
| **Documentation Path** | `aidlc-docs/construction/waitless-extension/code/` |
| **新規データエンティティ** | `ReaderStateSnapshot` (chrome.storage.local の `reader_state` キー、cycle-1/2 既存データに干渉なし) |
| **既存ファイル変更方針** | 既存ファイルを **in-place で modify** (`*_modified.js` のような重複ファイルを作らない) |

## FR / BR トレーサビリティ

| ID | 内容 | 該当ステップ |
|----|------|-------------|
| **FR-31** | 拡張機能内蔵の読書ページ | Step 4 (reader.html), Step 7 (reader.js init) |
| **FR-32** | 最小限の UI (灰色 → 青色) | Step 5 (reader.css) |
| **FR-33** | クリックでの双方向既読範囲指定 | Step 7 (onTextClick, applyReadProgress) |
| **FR-34** | クリック位置の永続化 (即時) | Step 7 (saveState) |
| **FR-35** | スクロール位置の永続化 (離脱直前) | Step 7 (savePartial) |
| **FR-36** | 起動時の状態復元 | Step 7 (init: applyReadProgress → scrollTo) |
| **FR-37** | 既存 Site 登録モデルでの統合 | Step 8 (manifest.json), Step 9 (settings_repository.js), Step 10 (options.html, options.js, options.css) |
| **FR-38** | BR-31〜37 を実装 | Step 7 全体 |
| **NFR-07** | 後方互換性 | Step 9 で既存 sites/threshold_sec キーに干渉しないことを担保 |
| **NFR-08** | 起動時復元 200ms 以内 | Step 7 (requestAnimationFrame、O(段落数) アルゴリズム) |
| **NFR-09** | reader_state サイズ < 1KB | Step 7 (snapshot 設計) |
| **NFR-10** | 色設計 WCAG AA | Step 5 (CSS 配色) |
| **BR-31〜37** | 各 BR | Step 7 |
| **BR-01/02 改訂** | DOMAIN_REGEX / URL protocol 拡張 | Step 9 (settings_repository.js), Step 10 (options.js validateUrl) |

---

## Generation Steps

### Step 1: Pre-flight チェック

- [x] cycle-1/2 archive の場所を確認 (`aidlc-docs-waitless-archive/cycle-{1,2}/`)
- [x] cycle-3 の Application Design / Functional Design 成果物が `aidlc-docs/inception/application-design/` と `aidlc-docs/construction/waitless-extension/functional-design/` に存在することを確認
- [x] `extension/` 配下の現状ファイル一覧を確認 (cycle-2 完了状態)

---

### Step 2: 組み込み小説テキスト `extension/reader/novel.txt` を作成

- [x] (Option 1 採用) 短いオリジナルダミーテキストを `extension/reader/novel.txt` に配置 (約 1KB、15 段落程度)
- [x] UTF-8 エンコーディング、改行は LF (`\n`)
- [x] 出典は `reader.html` 側の `<footer>` に明記する形式 (`novel.txt` 自体には底本情報を入れない)
- [x] 注: 当初 Q6=B (羅生門) を予定していたが、ツール出力サイズの制約のため Option 1 に変更。ユーザーは novel.txt を任意のテキスト (青空文庫の羅生門等) に差し替え可能、README に手順を記載

---

### Step 3: ディレクトリ作成

- [x] `extension/reader/` ディレクトリは Step 2 で `novel.txt` を配置することで自動作成された

---

### Step 4: `extension/reader/reader.html` を作成 (FR-31)

- [x] HTML 骨格を実装
- [x] `<header>` にタイトルと著者
- [x] `<article id="reader-content">` に `data-testid` 付与 (空、初期は読込中表示)
- [x] `<footer>` に底本情報「サンプルテキスト (差し替え可能)」を明記
- [x] `<link rel="stylesheet" href="reader.css">` と `<script src="reader.js">`
- [x] `lang="ja"`、`<meta charset="UTF-8">`、`<meta name="viewport">` を設定

---

### Step 5: `extension/reader/reader.css` を作成 (FR-32, NFR-10)

- [x] CSS を実装、ダーク背景 / 灰色 / 青色の配色
- [x] フォント明朝系、文字サイズ 18px / 16px、行間 1.85
- [x] 段落字下げ 1em、最大幅 720px 中央寄せ
- [x] 色変化 transition 0.15s
- [x] レスポンシブ対応
- [x] cycle-1 の他 CSS と独立

---

### Step 6: `extension/reader/reader.js` のスケルトン作成

- [x] (Step 7 と統合実装)

---

### Step 7: `extension/reader/reader.js` の本体実装 (BR-31〜37、FR-31〜36)

- [x] 7.1 init() (テキストロード → 状態復元 → DOM 構築 → 青色化 → scrollTo → イベント)
- [x] 7.2 renderText / splitIntoParagraphs (空行で分割、data-start/data-length 付与、改行 1 文字)
- [x] 7.3 applyReadProgress (3 状態正規化、splitParagraph)
- [x] 7.4 onTextClick (BR-36 検証 + caretRangeFromPoint + 双方向 + saveState)
- [x] 7.5 clickPointToCharOffset (caretRangeFromPoint + TreeWalker)
- [x] 7.6 saveState / loadState / savePartial (snake_case 変換、try/catch BR-35)
- [x] 7.7 readOffset のクランプ (BR-37)

---

### Step 8: `extension/manifest.json` を更新 (FR-31, FR-37)

- [x] `version` を `0.2.0` → `0.3.0`
- [x] `description` 拡張 (「読書 (内蔵)」追加)
- [x] `web_accessible_resources` を追加 (reader/reader.html, reader.css, reader.js, novel.txt を `<all_urls>` で公開)
- [x] cycle-1 の Service Worker / content_scripts 設定は無変更

---

### Step 9: `extension/sw/settings_repository.js` を更新 (BR-01 改訂, BR-02 改訂)

- [x] `DOMAIN_REGEX` を `/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-z]{32}$/` に拡張
- [x] `validateUrl` 内の protocol チェックに `'chrome-extension:'` を追加
- [x] それ以外のロジック完全無変更
- [x] cycle-3 改訂のコメントを追加

---

### Step 10: `extension/options/options.{html,js,css}` を更新 (FR-37)

- [x] 10.1 options.html: 空状態案内に「📖 読書 (内蔵)」`<li>` 追加、`data-testid` 付与
- [x] 10.2 options.js: `injectReaderExampleUrl` 関数追加、`init()` 冒頭で呼び出し、`validateUrl` の protocol 拡張
- [x] 10.3 options.css: cycle-2 で追加した `.empty-examples-list li` スタイルを継承するため修正不要

---

### Step 11: `extension/README.md` を更新 (FR-31 補助、ユーザー向けドキュメント)

- [x] 「対応する遷移先パターン」表に「📖 読書 (内蔵)」行を追加
- [x] 新規セクション「内蔵の読書ページについて」を追加 (登録方法、動作、テキスト差し替え、制約)
- [x] アンチスコープに 3 項目を追記 (複数小説 / UI カスタマイズ / 端末間同期)

---

### Step 12: `aidlc-docs/construction/waitless-extension/code/code-generation-summary.md` を作成

- [x] cycle-3 の変更ファイル一覧 (新規 4 + 修正 5 + 非変更 7+)
- [x] FR / BR / NFR トレーサビリティ表
- [x] cycle-1 / cycle-2 サマリとの差分関係を明記
- [x] 静的検証結果セクション

---

### Step 13: 自己レビュー

- [x] manifest.json: JSON 妥当性 OK (python3)
- [x] settings_repository.js: Node モジュールロード OK
- [x] `getDiagnostics`: manifest.json / reader/* / settings_repository.js / options.{html,js} / README.md にエラー・警告なし
- [x] cycle-1/2 の他のロジック側ファイル (sw/{message_router, wait_orchestrator, tab_manager, runtime_state}, content/*, service_worker.js) に **変更がないこと** を確認 (cycle-3 で修正したのは sw/settings_repository.js のみ)
- [x] 重複ファイル無し

---

### Step 14: Build & Test 用の検証手順ドキュメント作成

- [x] `aidlc-docs/construction/build-and-test/build-instructions.md` を更新 (cycle-3 用、ファイル構成図 / 確認ポイント追加)
- [x] `aidlc-docs/construction/build-and-test/integration-test-instructions.md` を更新 (cycle-3 用、新シナリオ T-21 〜 T-30 を追加)

---

## 完了条件 (Code Generation Part 2 完了の判定)

- [x] Step 2〜12 のすべてが [x]
- [x] Step 13 (自己レビュー) が [x]
- [x] Step 14 (検証手順ドキュメント) が [x]
- [x] 重複ファイル禁止
- [x] cycle-1/2 のロジック側ファイル (sw/* のうち settings_repository.js 以外、content/*, service_worker.js) に変更がないこと
- [x] `aidlc-state.md` の Code Generation 進行状況を更新する

---

## 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- 実行計画: `aidlc-docs/inception/plans/execution-plan.md`
- Application Design: `aidlc-docs/inception/application-design/application-design.md`
- Functional Design 成果物:
  - `aidlc-docs/construction/waitless-extension/functional-design/business-logic-model.md`
  - `aidlc-docs/construction/waitless-extension/functional-design/business-rules.md`
  - `aidlc-docs/construction/waitless-extension/functional-design/domain-entities.md`
  - `aidlc-docs/construction/waitless-extension/functional-design/frontend-components.md`
- 現状アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
