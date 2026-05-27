# Cycle-4 Handover (cycle-3 → cycle-4)

このドキュメントは cycle-4 を始める際に最初に読むべき内容をまとめたもの。cycle-1 / cycle-2 / cycle-3 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-27 (cycle-3 完了時点)

---

## 1. cycle-1 / cycle-2 / cycle-3 で達成したこと

### 1.1 cycle-1 (MVP、2026-05-26 完了)

WaitLess (Chrome 拡張機能 / Manifest V3) の MVP を実装。Chrome に Unpacked ロードで動作する状態に到達。

成果物 (`extension/` 配下、計 16 ファイル):
- `manifest.json`, `service_worker.js`
- `sw/` 5 モジュール (MessageRouter / WaitOrchestrator / TabManager / SettingsRepository / RuntimeState)
- `content/` 3 ファイル (claude_site_adapter / playback_trigger / playback_pause)
- `options/` 3 ファイル (HTML / CSS / JS、インライン編集テーブル付き)
- `assets/icons/` 16/48/128 (1x1 透過 PNG プレースホルダ)
- `extension/README.md`

主要機能:
- Claude.ai 待ち N秒検知 → 娯楽タブ自動切替 → 完了で AI タブ自動戻り
- 2 パスのタブ探索戦略 (URL 完全一致 → ドメイン一致 → 新規タブ)
- 動画自動再生試行 + 完了時一時停止 + 続きから再生
- Options Page でサイト登録・しきい値設定 (`chrome.storage.local`)

### 1.2 cycle-2 (遷移先バリエーション拡大、2026-05-27 完了)

cycle-1 の成果物に対して、**動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想)** を公式に想定対象として整備。

変更ファイル (in-place modify):
- `extension/manifest.json` — `version 0.2.0`、`description` 拡張、`action.default_title` 汎用化
- `extension/options/options.html` — 空状態に 5 種の用途例
- `extension/options/options.css` — 空状態案内のスタイル追加
- `extension/README.md` — 「対応する遷移先パターン」セクション新規追加

データモデル / コアロジックは非変更 (Q1=B、タイプ概念は導入しない方針)。

### 1.3 cycle-3 (Reader Page 追加、2026-05-27 完了)

cycle-2 の成果物に対して、**拡張機能内蔵の Reader Page** を追加し、AI 待ち時間中に小説テキストを読み進められる体験を提供。

新規ファイル (`extension/reader/` 配下、計 4 ファイル):
- `reader.html` — タイトル + 本文コンテナ + 底本 footer
- `reader.css` — ダーク背景 (`#1a1a1a`)、未読灰色 (`#888`)、既読青色 (`#3b82f6`)、明朝系フォント、レスポンシブ最小限
- `reader.js` — ReaderApp IIFE 本体 (init / renderText / applyReadProgress / onTextClick / saveState / loadState / savePartial / clickPointToCharOffset)
- `novel.txt` — オリジナルダミーテキスト (約 1KB、15 段落)、ユーザー差し替え可能

主要機能:
- クリックでの既読範囲青色化 (双方向、絶対上書き)
- スクロール位置 + クリック位置を `chrome.storage.local` の `reader_state` キーに永続化 (クリック時即時 / 離脱時即時)
- 起動時に状態復元 (青色化 → `requestAnimationFrame` 後にスクロール)
- 既存 Site 登録モデルでの統合 (`chrome-extension://[ID]/reader/reader.html` を 1 サイトとして登録、空状態案内に動的 ID/URL を注入)

修正ファイル (in-place modify):
- `extension/manifest.json` — `version 0.3.0`、`description` 拡張、`web_accessible_resources` 追加
- `extension/sw/settings_repository.js` — `DOMAIN_REGEX` を拡張機能 ID 対応 (`^[a-z]{32}$` を OR で追加)、`validateUrl` の protocol 許可リストに `chrome-extension:` 追加 (BR-01/02 改訂)
- `extension/options/options.html` — 空状態に「📖 読書 (内蔵)」`<li>` 追加 (`data-testid` 付き)
- `extension/options/options.js` — `injectReaderExampleUrl()` 関数追加 (`init()` 冒頭で呼出)、`validateUrl` の protocol 拡張、`DOMAIN_REGEX` 拡張 (二重防御の整合)
- `extension/README.md` — 「対応する遷移先パターン」表に「📖 読書 (内蔵)」追加、新規セクション「内蔵の読書ページについて」、アンチスコープ追記

主要ロジック側ファイル (`sw/{message_router, wait_orchestrator, tab_manager, runtime_state}.js`、`content/*.js`、`service_worker.js`) は **完全無変更**。

#### cycle-3 中に発見・修正した不具合

Build and Test 段階で 1 件のバグを発見・修正:
- **症状**: Options Page 側の `validateDomain` が拡張機能 ID 形式 (32 文字英小数字) をリジェクト
- **原因**: cycle-3 で `extension/sw/settings_repository.js` の `DOMAIN_REGEX` を拡張したが、二重防御の `extension/options/options.js` 側の `DOMAIN_REGEX` を更新し忘れていた
- **修正**: options.js の `DOMAIN_REGEX` を SettingsRepository と一致するよう更新

詳細は cycle-3 archive の `audit.md` 参照。

---

## 2. 既知の制限事項 (cycle-3 完了時点)

cycle-1 から継続している既知の制限:

- **アイコンが 1x1 PNG プレースホルダ**: Chrome Web Store 申請には差し替え必須 (Backlog B-01)
- **デバッグログ常時 ON**: `DEBUG = true` のまま (Backlog B-02)
- **Claude.ai DOM セレクタの脆さ**: Claude.ai UI 変更で壊れる可能性 (Backlog B-03)
- **動画オートプレイポリシー**: ブラウザ側の制限で `play()` が拒否されるケースあり、失敗は黙って許容
- **複数ウィンドウ非対応**: 現在のフォーカスウィンドウのみ (Backlog B-06)
- **Service Worker のアイドルアンロード**: Chrome の仕様。session ストレージで状態復元
- **拡張機能更新時の旧 Content Script**: Claude.ai タブをリロードする必要あり (ガード実装済)

cycle-3 で追加された制限:

- **Reader Page の小説は 1 編固定** (cycle-3 アンチスコープ、複数管理は未対応)
- **Reader Page の UI カスタマイズなし** (フォント / 文字サイズ / テーマ固定、cycle-3 アンチスコープ)
- **Reader Page の既読位置は端末ローカルのみ** (`chrome.storage.local`、端末間同期なし)
- **拡張機能 ID は環境依存** — Unpacked ロードで拡張機能を一度削除して再ロードすると ID が変わるため、登録済の Reader Page Site をユーザーが再登録する必要あり (Web Store 申請後は ID 固定で問題なし)
- **`reader_state` の novel_id 切替対応未実装** — 将来の複数小説管理用の予約フィールドだが、現在は固定値 "default" で固定

---

## 3. cycle-3 で残した検証 (Manual E2E、cycle-4 で継続)

cycle-3 完了時点で **ユーザー実機で確認済** のシナリオ:

- ✅ T-22: Reader Page を Site として登録 (バグ修正後に動作確認)

cycle-3 完了時点で **未実施・継続検証が必要** なシナリオ:

| シナリオ | 内容 | 備考 |
|---------|------|------|
| T-21 | Reader Page の単独表示 | URL を直接開いて表示確認 |
| T-23 | クリックでの青色化 (一方向) | 期待通り動くかの基本確認 |
| T-24 | 双方向クリック (戻し動作) | BR-31 の挙動確認 |
| T-25 | AI 完了時のスクロール位置保存 | FR-35, BR-34 |
| T-26 | 起動時の状態復元 | FR-36, BR-33 (青色化 → スクロール順) |
| T-27 | 既存 Reader タブのアクティブ化 (Pass 1) | cycle-1 BR-07 継承 |
| T-28 | 後方互換性 (cycle-2 までのデータ) | NFR-07 |
| T-29 | 配色 WCAG コントラスト | NFR-10、静的には確認済 |
| T-30 | novel.txt の差し替え動作 | ユーザー側で青空文庫等に差し替えて検証 |
| T-01〜T-13 | cycle-1 リグレッション | 必要に応じて |
| T-14〜T-20 | cycle-2 リグレッション | 必要に応じて |

詳細手順は `aidlc-docs-waitless-archive/cycle-3/construction/build-and-test/integration-test-instructions.md` 参照。
cycle-4 開始時の最初のタスクとして、これらの検証を進めることをお勧めします。

---

## 4. 次サイクル (cycle-4) の候補テーマ

### 4.1 既存 Backlog (B-01〜B-11)

詳細は `docs/backlog.md` 参照。優先度の高いものから:

- **High**:
  - B-01 アイコン PNG 差し替え (Web Store 申請のため)
  - B-02 デバッグログ OFF 化
- **Medium**:
  - B-03 Claude.ai DOM セレクタの自動追従 / 失敗検知
  - B-04 Chrome Web Store 申請手順のドキュメント化
- **Low**:
  - B-05 オンボーディング画面の本格化
  - B-06 探索範囲の全ウィンドウ拡張
  - B-07 他AIサービス対応 (要 ClaudeSiteAdapter の抽象化)
  - B-08 ON/OFF トグル
  - B-09 統計機能
  - B-10 多言語化
  - B-11 自動テスト

### 4.2 AI からの推奨候補 (cycle-3 で見えた次の改善ポイント)

以下は cycle-3 のアンチスコープに置いた項目で、ユーザー価値の伸び代がある領域:

- **Reader Page の自動進捗 (スクロール検知での既読色変化)** — 現在はクリック必須。`IntersectionObserver` 等で「画面上部を通過したテキスト」を自動的に既読色化すれば、ユーザーがクリックを意識せずに読み進められる。要件 Q5=D の「クリック時のみ」を緩和する必要あり
- **Reader Page の複数小説管理** — `novel_id` フィールドは予約済。Options Page から複数の小説を登録 / 切替えできるようにすれば、ユーザーが好みの作品を読める。chrome.storage.local の `reader_state` を `reader_states` のような Map 型に拡張する必要あり
- **Reader Page の UI カスタマイズ** — 文字サイズ調整 (S/M/L)、ライト / ダーク切替、フォント切替 (明朝 / ゴシック) は読書体験に大きく影響。cycle-3 では固定 (Q8=A) だが、ユーザーペルソナに応じて分岐を入れる価値あり
- **ストレッチ・瞑想用の内蔵ページ** — cycle-2 で Q2=B 撤回として外し、cycle-3 でも対応せず。Reader Page と同じ構造で、テキスト指示 + タイマー UI を提供できる。cycle-3 の reader/ ディレクトリ構成を踏襲しやすい
- **拡張機能アイコンのバッジ表示** — 待ち発生中 / 待ち時間累計などをバッジで可視化 (B-09 統計機能と関連)
- **Reader Page のキーボード操作対応** — 現在はクリックのみ。`Page Down` / `↓` 等で「次の段落まで既読色化」のショートカット追加で操作性向上

### 4.3 cycle-4 開始時の推奨フロー

1. cycle-3 archive の `aidlc-docs-waitless-archive/cycle-3/construction/build-and-test/integration-test-instructions.md` を見ながら **未実施シナリオを実機検証** (上記 §3)
2. 検証で問題が見つかれば、その修正を cycle-4 のスコープに含める
3. 検証で問題なければ、上記 §4.1 / §4.2 から次の機能を選定して cycle-4 を開始

---

## 5. コードの主要エントリポイント

cycle-4 を始めるにあたり、コードを読み始める順序の推奨:

```
1. extension/manifest.json
   └ 全体の権限・SW・コンテンツスクリプト・web_accessible_resources の構成 (cycle-3 で version 0.3.0)

2. extension/service_worker.js
   └ Service Worker のエントリ (sw/* を import)

3. extension/sw/message_router.js
   └ どんなメッセージタイプを受けてどうディスパッチするか

4. extension/sw/wait_orchestrator.js
   └ 中核フロー (待ち発生 → 切替 → 完了 → 戻り) の調整役

5. extension/sw/tab_manager.js
   └ 2 パス探索ロジック、chrome.tabs.* の呼び出し

6. extension/sw/settings_repository.js
   └ ストレージ CRUD + バリデーション (cycle-3 で REGEX/protocol 拡張)

7. extension/sw/runtime_state.js
   └ 実行時状態の保持と session 復元

8. extension/content/claude_site_adapter.js
   └ Claude.ai での DOM 監視、N秒タイマー、ステートマシン

9. extension/content/playback_trigger.js / playback_pause.js
   └ 娯楽タブで再生 / 一時停止を試みる動的注入

10. extension/options/{options.html, options.css, options.js}
    └ ユーザー設定 UI、cycle-2 で空状態案内拡張、cycle-3 で読書ページ用 動的 URL 表示追加

11. extension/reader/                              ★ cycle-3 で新規追加
    ├── reader.html (タイトル + 本文コンテナ + footer)
    ├── reader.css  (ダーク背景 + 灰色/青色配色)
    ├── reader.js   (ReaderApp IIFE 本体)
    └── novel.txt   (組み込み小説、ユーザー差し替え可能)

12. extension/README.md
    └ ユーザー向け、cycle-3 で読書ページ説明追加
```

依存方向は単方向 (上位レイヤー → 下位レイヤー)、循環依存なし。詳細は `docs/architecture.md` §3 参照。

---

## 6. archive の参照先

| ディレクトリ | 内容 |
|------------|------|
| `aidlc-docs-waitless-archive/cycle-1/` | cycle-1 (MVP) の全アーティファクト |
| `aidlc-docs-waitless-archive/cycle-2/` | cycle-2 (遷移先バリエーション拡大) の全アーティファクト |
| `aidlc-docs-waitless-archive/cycle-3/` | cycle-3 (Reader Page 追加) の全アーティファクト |

cycle-3 archive で特に有用なファイル (cycle-4 開始時の参考):

- `aidlc-docs-waitless-archive/cycle-3/inception/requirements/requirements.md` — FR-31〜38, NFR-08〜10
- `aidlc-docs-waitless-archive/cycle-3/inception/application-design/application-design.md` — 統合版 Application Design
- `aidlc-docs-waitless-archive/cycle-3/construction/waitless-extension/functional-design/business-rules.md` — BR-31〜37 (新規) + BR-01/02 改訂
- `aidlc-docs-waitless-archive/cycle-3/construction/waitless-extension/code/code-generation-summary.md` — cycle-3 コード変更サマリ
- `aidlc-docs-waitless-archive/cycle-3/construction/build-and-test/integration-test-instructions.md` — T-21〜T-30 詳細手順
- `aidlc-docs-waitless-archive/cycle-3/audit.md` — cycle-3 監査ログ (バグ修正の経緯含む)

---

## 7. AI-DLC 再開時の前提整理

cycle-4 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1 / cycle-2 / cycle-3 の archive は参照のみ、編集しない
2. **既存 `extension/` のコードは cycle-3 の状態 (version 0.3.0) を継承** — cycle-4 では追加・修正していく形
3. **Workspace Detection ステージで Brownfield 判定** — 既存コードがあるため
4. **Inception Phase の入力**:
   - `docs/architecture.md` (現状アーキテクチャ、cycle-3 完了状態)
   - `docs/backlog.md` (やるべきこと候補、cycle-2 と cycle-3 の完了セクション含む)
   - `docs/cycle-4-handover.md` (本ドキュメント)
   - `docs/cycle-3-handover.md` (cycle-3 開始時の手引き、履歴として残されている)
5. **Requirements Analysis でスコープを決める**:
   - cycle-3 で残した検証を cycle-4 の最初のタスクにするかどうか確認
   - §4.1 既存 Backlog または §4.2 AI 推奨候補の中から実装するテーマを選定
6. **archive ドキュメントとの整合**:
   - cycle-1〜3 で確定した BR (BR-01〜37、BR-01/02 改訂含む) は引き続き有効
   - FR-01〜11 / FR-21〜25 / FR-31〜38 も引き続き有効
   - NFR-01〜10 も引き続き有効
   - 変更する場合は意図的に新しい Functional Design / Business Rules で上書きする

### cycle-4 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-3 までの成果物 (継承、version 0.3.0)
│   └── reader/                        # cycle-3 で新規追加
├── docs/                              # メンテ用 (cycle-3 末で更新済)
│   ├── architecture.md                # cycle-3 完了状態を反映
│   ├── backlog.md                     # cycle-3 末時点の Backlog
│   ├── cycle-3-handover.md            # cycle-2→cycle-3 の手引き (履歴、削除しない)
│   └── cycle-4-handover.md            # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-4 で新規作成
│   ├── aidlc-state.md
│   ├── audit.md
│   ├── inception/
│   └── construction/
├── aidlc-docs-tabitabi-archive/       # 過去サイクル (たびたびプロジェクト)
└── aidlc-docs-waitless-archive/
    ├── cycle-1/                       # ★ 参照のみ
    ├── cycle-2/                       # ★ 参照のみ
    └── cycle-3/                       # ★ 参照のみ
```

cycle-4 完了時には、cycle-4 用の archive (`aidlc-docs-waitless-archive/cycle-4/`) を作る想定。

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- ユーザー向け: `extension/README.md`
- cycle-3 開始時の手引き (履歴): `docs/cycle-3-handover.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
- cycle-3 archive: `aidlc-docs-waitless-archive/cycle-3/`
