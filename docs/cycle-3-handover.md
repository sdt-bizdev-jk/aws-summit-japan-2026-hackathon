# Cycle-3 Handover (cycle-2 → cycle-3)

このドキュメントは cycle-3 を始める際に最初に読むべき内容をまとめたもの。cycle-1 / cycle-2 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-27 (cycle-2 完了時点)

---

## 1. cycle-1 / cycle-2 で達成したこと

### 1.1 cycle-1 (MVP、2026-05-26 完了)

WaitLess (Chrome 拡張機能 / Manifest V3) の MVP を実装。Chrome に Unpacked ロードで動作する状態に到達。

成果物 (`extension/` 配下、計 16 ファイル):
- `manifest.json`, `service_worker.js`
- `sw/` 5 モジュール (MessageRouter / WaitOrchestrator / TabManager / SettingsRepository / RuntimeState)
- `content/` 3 ファイル (claude_site_adapter / playback_trigger / playback_pause)
- `options/` 3 ファイル (HTML / CSS / JS、インライン編集テーブル付き)
- `assets/icons/` 16/48/128 (1x1 透過 PNG プレースホルダ)
- `extension/README.md`

主要機能 (cycle-1 で確定):
- Claude.ai 待ち N秒検知 → 娯楽タブ自動切替 → 完了で AI タブ自動戻り
- 2 パスのタブ探索戦略 (URL 完全一致 → ドメイン一致 → 新規タブ)
- 動画自動再生試行 + 完了時一時停止 + 続きから再生
- Options Page でサイト登録・しきい値設定 (`chrome.storage.local`)

### 1.2 cycle-2 (遷移先バリエーション拡大、2026-05-27 完了)

cycle-1 の成果物に対して、**動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想)** を公式に想定対象として整備。

変更ファイル (in-place modify、4 ファイル):
- `extension/manifest.json` — `version 0.2.0`、`description` 拡張、`action.default_title` 汎用化
- `extension/options/options.html` — 空状態に 5 種の用途例 (ドメイン + サンプル URL)
- `extension/options/options.css` — 空状態案内のスタイル追加
- `extension/README.md` — 「対応する遷移先パターン」セクション新規追加

cycle-2 の重要な設計判断:
- **タイプ (カテゴリ) フィールドは導入しなかった** (Clarification Q1=B、cycle-2 archive 参照)
- データモデル `{domain, url, priority}` は cycle-1 のまま維持 (NFR-07 後方互換性)
- ロジック側ファイル (sw/*, content/*, service_worker.js, options.js) は **完全無変更**
- 拡張機能内蔵のページ (ストレッチ/瞑想等) も **作らなかった**
- 実装規模はごく小規模 (ドキュメント・文言・空状態案内のみ)

cycle-2 の Manual E2E (T-01〜T-20) はユーザー実機実行が必要 (環境依存)。

---

## 2. 現状の既知の制限 (cycle-2 完了時点)

cycle-1 から継続している既知の制限:

- **アイコンが 1x1 PNG プレースホルダ**: Chrome Web Store 申請には差し替え必須 (Backlog B-01)
- **デバッグログ常時 ON**: `DEBUG = true` のまま (Backlog B-02)
- **Claude.ai DOM セレクタの脆さ**: Claude.ai UI 変更で壊れる可能性 (Backlog B-03)
- **動画オートプレイポリシー**: ブラウザ側の制限で `play()` が拒否されるケースあり、失敗は黙って許容
- **複数ウィンドウ非対応**: 現在のフォーカスウィンドウのみ (Backlog B-06)
- **Service Worker のアイドルアンロード**: Chrome の仕様。session ストレージで状態復元
- **拡張機能更新時の旧 Content Script**: Claude.ai タブをリロードする必要あり (ガード実装済)
- **拡張機能内蔵のページなし**: cycle-2 では作らない方針だった (cycle-3 で要件次第で追加可能)

---

## 3. 次サイクル (cycle-3) の候補テーマ

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
- **新規 (cycle-3 で要望されたもの)**:
  - **拡張機能内蔵の「読書ページ」** (簡易な小説リーディング機能、スクロール位置永続化、テキストクリックで既読色変化など)

---

## 4. cycle-3 の主たる新要件 (ユーザー要望、2026-05-27 受領)

ユーザーから以下の要望を受領済み (cycle-3 の Inception で具体化する):

> 簡易な読書ページを追加せよ
> - AI 出力待ち時間に、小説がテキストで書かれたページへ遷移
> - AI 出力がいつ終わるかわからない制限時間の中で、スクロールしてテキストを読み進める
> - AI 出力完了時に AI サイトへ戻る
> - 再び AI 出力待ち発生時に、前回読み進めたところに遷移して再び読み進められる
> - どこまで読んだかをわかりやすくするために、小説の文字色を視認性のある灰色から青色にする
> - 小説のテキストをマウスカーソルでクリックすることでそこまでのテキストを青色に変化させられる

これは cycle-2 のスコープを明確に超える機能で、cycle-3 の inception で正式に要件化する。

### 想定される実装範囲 (Inception で確定)
- 拡張機能内蔵の HTML ページ (`extension/reader/` 等の新ディレクトリ)
- 小説テキストデータ (組み込み or ユーザー登録、要件次第)
- 既読位置 / スクロール位置の `chrome.storage.local` 永続化 (新フィールド)
- 既読色変化のインタラクション (UI ロジック)
- 既存の Site 登録モデルに収まる形式で、拡張機能内蔵 URL (`chrome-extension://...`) を 1 サイトとして扱う想定

### 設計上の判断ポイント (Inception で確認が必要)
- 小説テキストの提供形態 (組み込み / ユーザー登録 / 外部 URL fetch)
- 複数小説の管理可否 (1 つの小説で MVP / 複数管理は後回し)
- 既読位置の同期粒度 (文字単位 / 段落単位 / スクロール率)
- 既存サイト探索ロジック (2 パス) との相互作用
- バリエーション (フォント、文字サイズ、テーマ等の可変性) は cycle-3 でどこまで含めるか

---

## 5. コードの主要エントリポイント (cycle-3 を始めるための読書順序)

```
1. extension/manifest.json
   └ どんな権限・サービスワーカー・コンテンツスクリプトかの全体像 (cycle-2 で version 0.2.0)

2. extension/service_worker.js
   └ Service Worker のエントリ (sw/* を import)

3. extension/sw/message_router.js
   └ どんなメッセージタイプを受けてどうディスパッチするか

4. extension/sw/wait_orchestrator.js
   └ 中核フロー (待ち発生 → 切替 → 完了 → 戻り) の調整役

5. extension/sw/tab_manager.js
   └ 2パス探索の中身、chrome.tabs.* の呼び出し

6. extension/sw/settings_repository.js
   └ ストレージ CRUD + バリデーション

7. extension/sw/runtime_state.js
   └ 実行時状態の保持と session 復元

8. extension/content/claude_site_adapter.js
   └ Claude.ai での DOM 監視、N秒タイマー、ステートマシン

9. extension/content/playback_trigger.js / playback_pause.js
   └ 娯楽タブで再生 / 一時停止を試みる動的注入

10. extension/options/{options.html, options.css, options.js}
    └ ユーザー設定UI、cycle-2 で空状態案内拡張

11. extension/README.md
    └ ユーザー向け、cycle-2 で対応サイト一覧追加
```

依存方向は単方向 (上位レイヤー → 下位レイヤー)。詳細は `docs/architecture.md` §3 参照。

cycle-3 で新規追加する想定: `extension/reader/` (新ディレクトリ、HTML/CSS/JS の読書ページ一式)

---

## 6. archive の参照先

| ファイル | 内容 |
|---------|------|
| `aidlc-docs-waitless-archive/cycle-1/` | cycle-1 の全アーティファクト (MVP 実装、要件、設計、テスト手順) |
| `aidlc-docs-waitless-archive/cycle-2/` | cycle-2 の全アーティファクト (遷移先バリエーション拡大、Q&A、最終サマリ) |
| `aidlc-docs-waitless-archive/cycle-1/inception/requirements/requirements.md` | cycle-1 要件 (FR-01〜11, NFR-01〜06) |
| `aidlc-docs-waitless-archive/cycle-2/inception/requirements/requirements.md` | cycle-2 要件 (FR-21〜25, NFR-07) |
| `aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/functional-design/business-rules.md` | BR-01〜22 (cycle-2 でも継承) |
| `aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/code/code-generation-summary.md` | cycle-1 コード生成サマリ |
| `aidlc-docs-waitless-archive/cycle-2/construction/waitless-extension/code/code-generation-summary.md` | cycle-2 コード生成サマリ (差分中心) |
| `aidlc-docs-waitless-archive/cycle-2/construction/build-and-test/build-and-test-summary.md` | cycle-2 Build & Test サマリ (T-01〜T-20) |
| `aidlc-docs-waitless-archive/cycle-1/audit.md` | cycle-1 監査ログ |
| `aidlc-docs-waitless-archive/cycle-2/audit.md` | cycle-2 監査ログ |
| `aidlc-docs-waitless-archive/cycle-1/aidlc-state.md` | cycle-1 ステージ進行状況 |
| `aidlc-docs-waitless-archive/cycle-2/aidlc-state.md` | cycle-2 ステージ進行状況 |

---

## 7. AI-DLC 再開時の前提整理

cycle-3 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1 / cycle-2 の archive は参照のみ、編集しない
2. **既存 `extension/` のコードは cycle-2 の状態 (version 0.2.0) を継承** — cycle-3 では追加・修正していく形
3. **Workspace Detection ステージで Brownfield 判定** — 既存コードがあるため
4. **Inception Phase の入力**:
   - `docs/architecture.md` (現状アーキテクチャ、cycle-2 完了状態)
   - `docs/backlog.md` (やるべきこと候補)
   - `docs/cycle-3-handover.md` (本ドキュメント)
   - **ユーザー新規要望** (本ドキュメント §4): 読書ページの追加
5. **Requirements Analysis でスコープを決める**:
   - 読書ページの実装範囲を確定 (組み込み小説 / ユーザー登録 / 外部 URL)
   - 既読色変化のインタラクション仕様
   - データモデル拡張の必要性 (既読位置・スクロール位置を含む)
6. **archive ドキュメントとの整合**:
   - cycle-1 で確定した BR-01〜22, FR-01〜11 は引き続き有効
   - cycle-2 で確定した FR-21〜25, NFR-07 も引き続き有効
   - 変更する場合は意図的に新しい Functional Design / Business Rules で上書きする

### cycle-3 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-2 までの成果物 (継承、version 0.2.0)
├── docs/                              # メンテ用 (cycle-2 末で更新済)
│   ├── architecture.md                # cycle-2 完了状態を反映
│   ├── backlog.md                     # cycle-2 末時点の Backlog
│   └── cycle-3-handover.md            # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-3 で新規作成
│   ├── aidlc-state.md
│   ├── audit.md
│   ├── inception/
│   └── construction/
├── aidlc-docs-tabitabi-archive/       # 過去サイクル (たびたびプロジェクト)
└── aidlc-docs-waitless-archive/
    ├── cycle-1/                       # ★ 参照のみ
    └── cycle-2/                       # ★ 参照のみ
```

cycle-3 完了時には、cycle-3 用の archive (`aidlc-docs-waitless-archive/cycle-3/`) を作る想定。

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- ユーザー向け: `extension/README.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
