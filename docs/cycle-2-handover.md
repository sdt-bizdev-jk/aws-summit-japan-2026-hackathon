# Cycle-2 Handover (cycle-1 → cycle-2)

このドキュメントは cycle-2 を始める際に最初に読むべき内容をまとめたもの。cycle-1 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-26 (cycle-1 完了時点)

---

## 1. cycle-1 で達成したこと

### 1.1 実装範囲
WaitLess (Chrome 拡張機能 / Manifest V3) の MVP を実装し、Chrome に Unpacked ロードで動作する状態に到達。

成果物 (`extension/` 配下、計 16 ファイル):
- `manifest.json`
- `service_worker.js` (SW エントリ)
- `sw/` 5 モジュール (MessageRouter / WaitOrchestrator / TabManager / SettingsRepository / RuntimeState)
- `content/` 3 ファイル (claude_site_adapter / playback_trigger / playback_pause)
- `options/` 3 ファイル (HTML / CSS / JS、インライン編集テーブル付き)
- `assets/icons/` 16/48/128 (1x1 透過 PNG プレースホルダ)
- `extension/README.md`

### 1.2 動作確認済シナリオ (実機 Unpacked ロードでの手動 E2E)
- ✅ 拡張機能の Unpacked ロード成功
- ✅ Service Worker 起動、ログ出力
- ✅ Options Page の表示、空状態案内
- ✅ サイト登録 (domain + url) と `chrome.storage.local` 永続化
- ✅ しきい値変更の保存と Claude.ai 側への即時反映 (storage.onChanged 経由)
- ✅ Claude.ai でプロンプト送信 → ストリーミング N秒経過で娯楽タブへ自動切替
- ✅ Claude.ai 完了検知で AI タブへ自動戻り
- ✅ 既存の YouTube タブを開いていてもアクティブ化される
- ✅ 完了時の動画一時停止 + 次サイクルでの続きから再生 (cycle-1 後半で実装)

### 1.3 cycle-1 中に決めた重要な仕様調整
これらは Application/Functional Design の初版から実機検証で見直したもの:

1. **タブ探索を 2パス戦略に再構成** (cycle-1 後半で確定)
   - Pass 1: URL 完全一致を優先順位順 → 続きから再生
   - Pass 2: ドメイン一致を優先順位順 → 登録 URL に navigate
   - Pass 3: 新規タブ作成
2. **`PlaybackPause` を新規追加** — 完了時に娯楽タブの動画を一時停止し、次サイクルの再生を「続きから」にする
3. **既存タブヒット時の `activateTab` 明示呼び出し** — cycle-1 初期実装では新規作成時の `chrome.tabs.create({active:true})` だけ動作していたバグ
4. **Claude.ai DOM セレクタを日本語UI向けに修正** — `aria-label="停止"` 等を最優先、英語UIをフォールバック
5. **`Extension context invalidated.` の検知ガード** — 拡張機能更新時の旧 Content Script から大量エラーが出るのを抑止
6. **manifest.json の `default_locale: "ja"` 削除** — `_locales/` 不在で起動エラーになるため (アンチスコープ #9 i18n 未対応と整合)
7. **新規タブ注入のロード完了待ち** — `chrome.tabs.onUpdated` で `status: 'complete'` を最大 8秒待つ
8. **PlaybackTrigger のリトライ実装** — YouTube 等で再生ボタンが遅延出現するケース対策、最大 8回 / 0.5秒間隔

詳細は `aidlc-docs-waitless-archive/cycle-1/audit.md` の各 timestamp 参照。

---

## 2. 既知の制限事項

- **アイコンが 1x1 PNG プレースホルダ**: Chrome Web Store 申請には差し替え必須 (Backlog B-01)
- **デバッグログ常時 ON**: `DEBUG = true` のまま (4 ファイル)。本番化前に OFF (Backlog B-02)
- **Claude.ai DOM セレクタの脆さ**: Claude.ai UI 変更でストリーミング/完了検知が壊れる可能性 (Backlog B-03)
- **動画オートプレイポリシー**: ブラウザ側の制限で `play()` が拒否されるケースあり (BR-11、要件 §10.3)。失敗は黙って許容
- **複数ウィンドウ非対応**: 探索は現在のフォーカスウィンドウのみ (Backlog B-06)
- **Service Worker のアイドルアンロード**: Chrome の仕様。session ストレージで状態復元するためほぼ問題なし
- **拡張機能更新時の旧 Content Script**: Claude.ai タブをリロードする必要がある (`Extension context invalidated.`、ガードあり)

---

## 3. 未実装 (best-effort / 最小限) のもの

cycle-1 実装計画 (Q3=B + CQ9 後で相談) で意図的に絞った範囲:

| US | 内容 | 状態 |
|----|------|------|
| US-03 | 切替先で動画自動再生 | best-effort (オートプレイポリシー次第、PlaybackTrigger でリトライまで実装) |
| US-06 | インストール後すぐに使い始められる | 最小限 (Options Page の空状態案内テキストのみ) |

---

## 4. 次サイクルの候補テーマ

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

---

## 5. cycle-1 中に行った仕様の調整 (詳細リスト)

`aidlc-docs-waitless-archive/cycle-1/audit.md` の主要 timestamp:

| Timestamp | 調整内容 |
|-----------|---------|
| 2026-05-26T18:35:00Z | manifest.json から `default_locale: "ja"` 削除 |
| 2026-05-26T18:50:00Z | Claude.ai DOM セレクタを日本語UI向けに再構築、デバッグログ追加 |
| 2026-05-26T19:00:00Z | 既存タブヒット時の activateTab 明示呼び出し (バグ修正) |
| 2026-05-26T19:10:00Z | Extension context invalidated 検知ガード |
| 2026-05-26T19:25:00Z | 既存タブの URL 完全一致 / ドメインのみ一致の分岐、injectPlaybackTrigger のロード完了待ち、PlaybackTrigger リトライ |
| 2026-05-26T19:50:00Z | 2パス探索 + PlaybackPause 追加 |

これらは Functional Design (`business-logic-model.md` / `business-rules.md`) にも反映済み (archive 参照)。

---

## 6. コードの主要エントリポイント

cycle-2 を始めるにあたり、コードを読み始める順序の推奨:

```
1. extension/manifest.json
   └ どんな権限・サービスワーカー・コンテンツスクリプトかの全体像

2. extension/service_worker.js
   └ Service Worker のエントリ (sw/* を import)

3. extension/sw/message_router.js
   └ どんなメッセージタイプを受けてどうディスパッチするか

4. extension/sw/wait_orchestrator.js
   └ 中核フロー (待ち発生 → 切替 → 完了 → 戻り) の調整役

5. extension/sw/tab_manager.js
   └ 2パス探索の中身、chrome.tabs.* の呼び出し

6. extension/sw/settings_repository.js
   └ ストレージ CRUD + バリデーション (ロジックテスト容易)

7. extension/sw/runtime_state.js
   └ 実行時状態の保持と session 復元

8. extension/content/claude_site_adapter.js
   └ Claude.ai での DOM 監視、N秒タイマー、ステートマシン

9. extension/content/playback_trigger.js
   extension/content/playback_pause.js
   └ 娯楽タブで再生 / 一時停止を試みる動的注入

10. extension/options/options.html / .css / .js
    └ ユーザー設定UI、OptionsApp + OptionsAPI
```

依存方向は単方向 (上位レイヤー → 下位レイヤー)。詳細は `docs/architecture.md` §3 参照。

---

## 7. archive の参照先

cycle-1 の全アーティファクトは `aidlc-docs-waitless-archive/cycle-1/` に保管。よく使う参照先:

| ファイル | 内容 |
|---------|------|
| `inception/requirements/requirements.md` | 要件定義、FR-01〜11、NFR-01〜06、アンチスコープ |
| `inception/user-stories/stories.md` | US-01〜06 (Given/When/Then 受入条件付き) |
| `inception/user-stories/personas.md` | ペルソナ (タカシ) |
| `inception/application-design/application-design.md` | 統合版 Application Design |
| `inception/application-design/components.md` | 9コンポーネントの責務詳細 |
| `inception/application-design/component-methods.md` | メソッドシグネチャ |
| `inception/application-design/services.md` | サービス層オーケストレーション |
| `inception/application-design/component-dependency.md` | 依存マトリクス、レイヤー区分 |
| `inception/application-design/unit-of-work.md` | ユニット定義 (waitless-extension) |
| `construction/waitless-extension/functional-design/business-logic-model.md` | 中核アルゴリズム疑似コード |
| `construction/waitless-extension/functional-design/business-rules.md` | BR-01〜22 (BR-09b 含む) |
| `construction/waitless-extension/functional-design/domain-entities.md` | データモデル詳細 |
| `construction/waitless-extension/functional-design/frontend-components.md` | Options Page UI 詳細 |
| `construction/waitless-extension/code/code-generation-summary.md` | コード生成サマリ + FR/BR トレーサビリティ |
| `construction/build-and-test/build-instructions.md` | ビルド (Unpacked ロード) 手順 |
| `construction/build-and-test/integration-test-instructions.md` | 13 シナリオの手動 E2E 検証手順 |
| `audit.md` | 全 user input + AI response の監査ログ (時系列) |
| `aidlc-state.md` | cycle-1 のステージ進行状況 |

---

## 8. AI-DLC 再開時の前提整理

cycle-2 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1 の archive (`aidlc-docs-waitless-archive/cycle-1/`) は参照のみ、編集しない
2. **既存 `extension/` のコードはそのまま** — cycle-1 の成果物として継承、cycle-2 では追加・修正していく形
3. **Workspace Detection ステージで Brownfield 判定** — 既存コードがあるため、reverse engineering の必要性を判定 (本ドキュメント `architecture.md` で代替可能と判断できれば skip)
4. **Inception Phase の入力**:
   - `docs/architecture.md` (現状アーキテクチャの理解)
   - `docs/backlog.md` (やるべきこと候補)
   - `docs/cycle-2-handover.md` (本ドキュメント)
5. **Requirements Analysis でスコープを決める** — Backlog からどれを cycle-2 でやるか決める。Q&A の起点として「High 優先度から順にやる?」「複数を組み合わせる?」を確認
6. **archive ドキュメントとの整合** — cycle-1 で確定した仕様 (BR-01〜22 など) は cycle-2 でも引き続き有効。変更する場合は意図的に Functional Design / Business Rules で上書きする

### cycle-2 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-1 成果物 (継承)
├── docs/                              # メンテ用 (cycle-1 末で作成)
│   ├── architecture.md
│   ├── backlog.md                     # cycle-2 でも継続更新
│   └── cycle-2-handover.md
├── aidlc-docs/                        # ★ cycle-2 で新規作成
│   ├── aidlc-state.md
│   ├── audit.md
│   ├── inception/
│   └── construction/
├── aidlc-docs-tabitabi-archive/       # 過去サイクル (たびたびプロジェクト)
├── aidlc-docs-waitless-archive/
│   └── cycle-1/                       # ★ 参照のみ
└── ...
```

cycle-2 完了時には、cycle-2 用の archive (`aidlc-docs-waitless-archive/cycle-2/`) を作る想定。

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- ユーザー向け: `extension/README.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
