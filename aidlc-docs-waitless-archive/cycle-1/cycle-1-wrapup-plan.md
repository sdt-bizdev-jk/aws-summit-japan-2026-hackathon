# Cycle-1 Wrap-up 実行プラン

**ステータス**: 承認待ち

---

## 確定方針サマリ

| 項目 | 決定 |
|------|------|
| `/docs` の構成 | `architecture.md` + `backlog.md` + `cycle-2-handover.md` の3本のみ |
| 記述スタイル | コピー縮約 (`/docs` 単独で完結) |
| handover 配置 | `/docs/cycle-2-handover.md` |
| handover 内容 | 8項目全部入り |
| `backlog.md` の中身 | バックログ項目のみ (軽量) |
| バックログラベル | 優先度 (High/Medium/Low) + タイプ (Bug fix/Feature/Tech debt/Doc) の両方 |
| `architecture.md` 粒度 | しっかりめ (3〜5ページ規模、メッセージタイプ表 + データモデル + ファイル構成まで) |
| アーカイブ手法 | `git mv aidlc-docs aidlc-docs-waitless-archive/cycle-1` |
| `extension/README.md` | 複製/移動しない (現状維持) |

---

## 実行順序

### Step 1: `/docs/architecture.md` を生成 (しっかりめ)

含めるセクション:
1. **Overview** — WaitLess は何で、何をする拡張機能か (1段落)
2. **アーキテクチャ全体像** — Application Design の §2 アーキテクチャ概観 ASCII図 を流用 (3層 + 1ストア)
3. **レイヤー区分** — Layer 0〜4 表
4. **コンポーネント一覧** — 9 コンポーネントの責務とファイルパス対応表
5. **通信パターン** — sendMessage / storage.onChanged / 動的注入の4経路
6. **メッセージタイプ表** — 8タイプ (`WAIT_DETECTED` ほか)
7. **データモデル** — Site / Settings / RuntimeState のスキーマと JSON 例
8. **ファイル/ディレクトリ構成** — `extension/` 配下のツリー
9. **タブ探索戦略 (2パス)** — Pass 1〜3 のロジック (cycle-1 で確定した重要仕様)
10. **拡張機能ライフサイクル** — インストール / Service Worker 再起動 / 状態復元

参照する一次資料 (アーカイブ前にコピー):
- `aidlc-docs/inception/application-design/application-design.md`
- `aidlc-docs/inception/application-design/components.md`
- `aidlc-docs/inception/application-design/component-dependency.md`
- `aidlc-docs/construction/waitless-extension/functional-design/business-logic-model.md` (2パス疑似コード)

### Step 2: `/docs/backlog.md` を生成 (軽量、優先度+タイプラベル)

フォーマット例:
```markdown
# Backlog

## How to read
- Priority: [High] / [Medium] / [Low]
- Type: [Bug fix] / [Feature] / [Tech debt] / [Doc]

## Items

### [High][Bug fix] アイコン PNG プレースホルダの差し替え
- 現状: 1x1 透過 PNG。Chrome Web Store 申請には不適
- 対処: 16/48/128 の本物 PNG を作成し `extension/assets/icons/` に配置

### [High][Tech debt] DEBUG=true のままになっている
...
```

含める候補項目 (cycle-1 中に出たもの):
1. アイコン PNG プレースホルダの差し替え [High][Bug fix]
2. DEBUG=true 常時ON のままになっている (本番化前に false 化) [Medium][Tech debt]
3. Claude.ai DOM セレクタの自動追従 / 監視 [Medium][Tech debt]
4. US-06 の本格的なオンボーディング画面 [Low][Feature]
5. 探索範囲を全ウィンドウに拡張するオプション [Low][Feature]
6. 他AIサービス対応 (ChatGPT, Gemini) [Low][Feature]
7. ON/OFF トグル / 一時停止 [Low][Feature]
8. 統計機能 (待ち時間累計、娯楽時間累計) [Low][Feature]
9. 多言語化 (i18n) [Low][Feature]
10. 自動テスト導入 (任意) [Low][Tech debt]
11. Chrome Web Store 申請手順のドキュメント化 [Medium][Doc]

### Step 3: `/docs/cycle-2-handover.md` を生成 (8項目全部入り)

含めるセクション:
1. **cycle-1 で達成したこと** (実装範囲、動作確認できたシナリオ、新規/修正の決定)
2. **既知の制限事項** (アイコン、Claude.ai DOM の脆さ、オートプレイポリシー、デバッグログ常時 ON)
3. **未実装 (best-effort / 最小限)** (US-03 best-effort、US-06 最小限)
4. **次サイクルの候補テーマ** (`backlog.md` 参照と要約)
5. **cycle-1 中に行った仕様の調整** (Q&A の各種、2パス探索化、PlaybackPause 追加 等)
6. **コードの主要エントリポイント** (どのファイルから読み始めるか、依存順)
7. **archive の参照先** (`aidlc-docs-waitless-archive/cycle-1/` の主要ファイル案内)
8. **AI-DLC 再開時の前提整理** (新サイクル開始時に `aidlc-docs/` を新規作成、過去 archive は参照のみ)

### Step 4: アーカイブ実行

```bash
git mv aidlc-docs aidlc-docs-waitless-archive/cycle-1
```

これにより `aidlc-docs/` 配下の全ファイル (handover-questions.md / handover-clarification.md / cycle-1-wrapup-plan.md / audit.md / inception/ / construction/ / aidlc-state.md など) がまるごと `aidlc-docs-waitless-archive/cycle-1/` に移動する。

注意: archive 後は `aidlc-docs/` ディレクトリは存在しなくなる。次サイクルで `aidlc-docs/` を再作成する想定 (handover.md の §8 で案内)。

### Step 5: 動作確認

- `git status` で `git mv` 結果を確認
- `/docs/` 配下に 3ファイルあること
- `/docs/cycle-2-handover.md` の archive 参照リンクが正しい相対パスであること
- README.md に必要なら `/docs` への入口リンクを追加するかは別途確認

### Step 6: 完了報告

- 生成したドキュメント一覧
- archive の git mv 結果サマリ
- cycle-2 開始時の手順案内

---

## 期待される最終構成

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                       # アプリコード (現状維持)
│   ├── manifest.json
│   ├── service_worker.js
│   ├── sw/, content/, options/, assets/, README.md
├── docs/                            # ★ 新規 (メンテ用)
│   ├── architecture.md
│   ├── backlog.md
│   └── cycle-2-handover.md
├── aidlc-docs-tabitabi-archive/    # 過去サイクル (現状維持)
├── aidlc-docs-waitless-archive/    # ★ 新規
│   └── cycle-1/                    # ← `aidlc-docs/` がここに移動
│       ├── inception/
│       ├── construction/
│       ├── aidlc-state.md
│       ├── audit.md
│       └── ...
├── references/
└── assets/
```

`aidlc-docs/` (現在のもの) は **無くなる**。次サイクル開始時に新規作成する。

---

## 承認

このプランで実行してよろしいですか?

- ✅ **承認**: Step 1 から順に実行
- 🔧 **修正**: 含める項目、章立て、優先度ラベル、archive 手順への指示
- ➕ **追加**: 含めたい要素があれば指示
