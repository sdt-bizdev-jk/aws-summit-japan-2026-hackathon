# Cycle-5 Handover (cycle-4 → cycle-5)

このドキュメントは cycle-5 を始める際に最初に読むべき内容をまとめたもの。cycle-1 / cycle-2 / cycle-3 / cycle-4 の記憶がない状態でも、ここから入って必要な context を組み立てられるようにしている。

最終更新: 2026-05-28 (cycle-4 動作確認完了時点)

---

## 1. cycle-1 / cycle-2 / cycle-3 / cycle-4 で達成したこと

### 1.1 cycle-1 (MVP、2026-05-26 完了)
- WaitLess Chrome 拡張の MVP (16 ファイル、Manifest V3)
- Claude.ai 待ち N秒検知 → 娯楽タブ自動切替 → 完了で AI タブ自動戻り
- 2 パスのタブ探索戦略、動画自動再生 + 完了時一時停止
- Options Page でサイト登録・しきい値設定

### 1.2 cycle-2 (遷移先バリエーション拡大、2026-05-27 完了)
- 動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想) を公式想定対象に
- Options Page 空状態案内 + manifest description / default_title 拡張 (v0.2.0)

### 1.3 cycle-3 (Reader Page 追加、2026-05-27 完了)
- 拡張機能内蔵の Reader Page (`extension/reader/`) 4 ファイル新規追加
- クリックでの既読範囲青色化 (双方向、絶対上書き)
- スクロール位置 + クリック位置を `chrome.storage.local.reader_state` に永続化
- `DOMAIN_REGEX` / `validateUrl` を chrome-extension: 対応に拡張 (BR-01/02 改訂、v0.3.0)

### 1.4 cycle-4 (VS Code (Kiro) 拡張機能 + IPC 連携、2026-05-27 完了)

cycle-4 のスコープ確定パターン: **Pattern γ (大規模)** — Antigravity 風 IDE↔ブラウザ双方向制御を含む構成

**新規 Unit (3 unit)**:
1. **vscode-extension** (TypeScript ~530 行、Kiro IDE 用)
   - `vscode-extension/src/extension.ts` 1 ファイル + 9 論理コンポーネント
   - WebSocket サーバー (`ws://127.0.0.1:39472`、127.0.0.1 のみ bind)
   - 設定: `aiWaitLessMode.urls` / `aiWaitLessMode.enabled`
   - コマンド: `waitless.startWaiting` / `waitless.endWaiting`
   - tsc フル strict コンパイル成功

2. **chrome-extension-bridge** (既存 Chrome 拡張への改修、v0.3.0 → v0.4.0)
   - 新規: `extension/sw/ide_bridge.js` (~280 行) — WebSocket クライアント + IPC ディスパッチ + 指数バックオフ再接続 + PING/PONG ヘルスチェック
   - 改修最小: `extension/service_worker.js` 2 行追加 + Options Page IPC ON/OFF トグル + manifest version + README
   - **既存 sw/* 4 ファイル + content/* + reader/* は完全無変更** (NFR-27、git status で実証)

3. **agent-hooks-templates** (Kiro Hook 用 JSON テンプレート 2 バリアント)
   - Variant A: 直接コマンド (`"command": "waitless.startWaiting"`)
   - Variant B: CLI 経由 (`"command": "code --command waitless.startWaiting"`)
   - 4 JSON + ~150 行 README

**新規 機能**:
- ローカル WebSocket IPC レイヤー (双方向、7 メッセージタイプ: GET_SITES / SITES_RESPONSE / FIND_OR_OPEN_TAB / TAB_OPENED / PAUSE_MEDIA / MEDIA_PAUSED / PING-PONG)
- Kiro Agent Hooks との連動 (promptSubmit / agentStop)
- macOS osascript 経由の Kiro ウィンドウ最前面化
- IPC 失敗時のフォールバック (`vscode.env.openExternal`、Chrome 拡張未連動でも単独動作)

**動作確認 (2026-05-28 完了)**:

cycle-4 完了時点では未実機検証だったが、2026-05-28 に検証完了。検証中に判明した問題と修正:

| 問題 | 原因 | 修正 |
|---|---|---|
| Kiro Hook の `runCommand "waitless.startWaiting"` が `command not found` で失敗 | Kiro の `runCommand` はシェルコマンドとして解釈される (Variant A の前提が誤り) | **Hook ブリッジ方式に切替**: Hook で `touch /tmp/waitless-ide-triggers/start` を実行 → VS Code 拡張が `fs.watch` で検知 → `vscode.commands.executeCommand` で `waitless.startWaiting` を実行 (`vscode-extension/src/extension.ts` に `registerHookBridge()` 追加) |
| トリガーファイルが拡張機能側で検知されない | 拡張機能は `os.tmpdir()` (= `/var/folders/.../T/`) を監視、Hook は `/tmp` に書き込む。macOS の `/tmp` は `/private/tmp` へのシンボリックリンクのため不一致 | `TRIGGER_DIR` を `/tmp/waitless-ide-triggers` 固定に変更 |
| IPC 経由でタブ切替に成功するが Chrome ウィンドウが前面に来ない | `chrome.tabs.update({ active: true })` のみでは Chrome アプリが背面にいる場合に見えない | (1) `extension/sw/tab_manager.js` の Pass 1〜3 全てで `chrome.windows.update({ focused: true })` を追加。(2) `vscode-extension/src/extension.ts` の `BrowserLauncher.activateBrowserApp()` 追加で `osascript -e 'tell application "Google Chrome" to activate'` を実行 |

**最終形**:
- Hook 2 つ (`/Users/.../.kiro/hooks/waitless-ai-wait-{start,end}.kiro.hook`): `touch /tmp/waitless-ide-triggers/{start,end}` を実行する **トリガーファイル方式**
- VS Code 拡張: `fs.watch('/tmp/waitless-ide-triggers')` で検知 → コマンド実行
- Chrome 拡張: IPC 経由でタブ操作 + `chrome.windows.update` でウィンドウフォーカス
- VS Code 拡張: `osascript` で Chrome アプリを前面化 (待ち開始時) / Kiro を前面化 (待ち終了時)
- VS Code 拡張の **デバッグ UI メッセージは削除済**、Hook 旧 `01-/02-*.json` も削除済

**ユーザー設定**: `.vscode/settings.json` に最低限以下が必要:
```json
{
  "aiWaitLessMode.urls": ["https://www.youtube.com", "https://www.amazon.co.jp"]
}
```

---

## 2. 既知の制限事項 (cycle-4 完了時点)

cycle-1〜3 から継続:
- アイコン PNG プレースホルダ (B-01)
- デバッグログ常時 ON (B-02)
- Claude.ai DOM セレクタの脆さ (B-03)
- 動画オートプレイポリシー
- 複数ウィンドウ非対応 (B-06)
- Service Worker のアイドルアンロード
- Reader Page の小説 1 編固定 / UI カスタマイズなし / 端末ローカルのみ
- 拡張機能 ID は環境依存

cycle-4 で追加された制限:
- **macOS 限定** (osascript 前提、NFR-25)
- **Kiro IDE 限定** (Agent Hooks 必須、純正 VS Code では Hook 連動部分が動かない、Command Palette からの手動実行のみ)
- **Kiro アプリ名のハードコード** (`APP_NAME_FOR_OSASCRIPT = 'Kiro'`、別名インストール環境では osascript が失敗する。R-02)
- **ポート 39472 がハードコード** (競合時はフォールバック動作のみ、設定化は cycle-4 のスコープ外)
- **IPC プロトコルに version フィールドなし** (Q2=B、将来後方互換性が必要になったら拡張)
- **VSIX パッケージング / Marketplace 公開なし** (NFR-22 ローカル開発のみ)
- **自動テストなし** (NFR-23、cycle-1〜3 と同じ方針)
- **Chrome 拡張のデバッグログも IdeBridge も常時 ON** (B-12)
- **Hook ブリッジ方式は VS Code 拡張に依存** — `/tmp/waitless-ide-triggers/` を `fs.watch` する VS Code 拡張がないと、Hook が `touch` でファイルを作っても何も起きない。Hook 単独では機能しない (Pattern α 撤退判断は B-20 で再評価)
- **Chrome ブラウザ名のハードコード** (`'Google Chrome'`、Brave / Arc / Edge ユーザーは前面化が動かない)
- **Hook の発火範囲が広い** — Kiro 内部のサブエージェント呼び出しや Spec タスク実行時の prompt も `promptSubmit` を発火させる可能性あり (実機確認では問題は出なかったが、要注意)

---

## 3. cycle-4 動作確認結果 (2026-05-28 完了)

`aidlc-docs-waitless-archive/cycle-4/construction/build-and-test/integration-test-instructions.md` の T-41〜T-56 のうち、E2E の主要シナリオは実機確認済:

| Criticality | テスト | 結果 |
|---|---|---|
| Critical | T-41 (Unit 1 単独 / Command Palette からの手動実行) | ✅ 動作確認 |
| Critical | T-43 (Hook E2E、promptSubmit → ブラウザ遷移、agentStop → Kiro 戻り) | ✅ 動作確認 (上述の修正後) |
| High | T-44 (Pass 1 既存タブヒット時のアクティブ化) | ✅ 動作確認 |

未実施 / 詳細検証保留:
- T-42 (IPC 接続)、T-45/46 (Pass 2/3)、T-47 (enabled=false)、T-48〜T-53 (Medium / Low)、T-54〜T-56 (cycle-1〜3 リグレッション)

cycle-5 で時間が取れれば残りも検証する。ただし主要 E2E は通っているため、cycle-5 で **撤退判断 (B-20)** を選ぶ場合は残りの検証は不要になる。

---

## 4. 次サイクル (cycle-5) の候補テーマ

### 4.1 cycle-4 で生成された Backlog 項目

`docs/backlog.md` の cycle-4 セクション参照:

- **B-12** [Medium] cycle-4 デバッグログを本番化前に OFF
- **B-13** [Medium] Kiro アプリ名の設定化 (R-02 対応)
- **B-14** ✅ 完了 (cycle-4 検証済、2026-05-28)
- **B-15** [Low] Antigravity 風の高度なブラウザ操作
- **B-16** [Low] Windows / Linux 対応
- **B-17** [Low] VSIX パッケージング + Marketplace / Open VSX 公開
- **B-18** [Low] IPC プロトコルにバージョンフィールド追加
- **B-19** [Low] 複数の Kiro / VS Code ウィンドウ対応
- **B-20** [Medium] **設計の再検討: Pattern γ → Pattern α 撤退判断** (詳細は §4.4)

### 4.2 cycle-1〜3 から継続している Backlog (B-01〜B-11)

`docs/backlog.md` 参照。

### 4.3 cycle-5 開始時の推奨フロー

cycle-4 の主要 E2E は検証済のため、cycle-5 では **B-20 (Pattern γ vs Pattern α 判断)** を最初に確定させてから、他の機能拡張に進む流れを推奨:

1. **§4.4 を読んで、Pattern γ 維持 / Pattern α 撤退 / ハイブリッド の方針を確定**
2. 上記方針に応じて B-12〜B-19 / B-01〜B-11 から実装するテーマを選定
3. 通常の AI-DLC フロー (Inception → Construction) を回す

### 4.4 設計上の学び — Pattern γ vs Pattern α (cycle-4 振り返り)

cycle-4 では Inception で Pattern γ (Chrome 拡張 + IDE 拡張連携) を選択し、TypeScript ~530 行 + Chrome 拡張改修 ~280 行を実装した。動作確認後の振り返りで、要件:

> 「AI WaitLess Mode」でユーザからの入力で AI が作業中の待ち時間の間に、設定ファイルの URL リストからランダムに 1 つ選び、外部ブラウザで開く。AI の出力完了でブラウザから IDE に戻る。

を満たすには、**Hook 単独 (Pattern α) でも実現可能** だったことが判明した。

#### Pattern α の最小実装 (約 10 行)

`waitless-ai-wait-start.kiro.hook`:
```json
{
  "enabled": true,
  "name": "WaitLess: AI 待ち開始",
  "version": "1",
  "when": { "type": "promptSubmit" },
  "then": {
    "type": "runCommand",
    "command": "URLS=('https://www.youtube.com' 'https://www.amazon.co.jp'); open \"${URLS[$RANDOM % ${#URLS[@]}]}\""
  }
}
```

`waitless-ai-wait-end.kiro.hook`:
```json
{
  "enabled": true,
  "name": "WaitLess: AI 完了で Kiro に戻る",
  "version": "1",
  "when": { "type": "agentStop" },
  "then": {
    "type": "runCommand",
    "command": "osascript -e 'tell application \"Kiro\" to activate'"
  }
}
```

これで **要件 §1〜§4 すべて満たせる**:
- 設定 URL からランダム選択: `${URLS[$RANDOM % ${#URLS[@]}]}` (bash `$RANDOM` で十分)
- 外部ブラウザで開く: `open` コマンド (macOS)、既存タブがあれば自動再利用 (デフォルト挙動)
- 出力完了で Kiro に戻る: `osascript` (cycle-4 の WindowActivator と同じ)
- 設定ファイルから URL リスト: Hook ファイル直編集 (`.kiro/hooks/*.kiro.hook`)

#### Pattern γ (cycle-4 採用) のメリットと適用条件

| 機能 | Pattern α | Pattern γ |
|---|:---:|:---:|
| 要件達成 | ✅ | ✅ |
| URL ランダム選択 | ✅ (bash) | ✅ (TS) |
| 既存タブ再利用 | ✅ (`open` のデフォルト挙動) | ✅ (Chrome 拡張で完全制御) |
| Kiro 自動戻り | ✅ | ✅ |
| 動画自動再生 / 完了時一時停止 | ❌ | ✅ |
| 設定 UI (`.vscode/settings.json` + Options Page) | ❌ (Hook 直編集) | ✅ |
| 「待ち中」状態管理 (重複抑制) | ❌ | ✅ |
| 実装規模 | ~10 行 (JSON 2 つ) | ~810 行 (TS 530 + JS 280) |

要件が「動画/SNS/EC を眺めるだけで OK」なら **Pattern α で十分**。動画再生制御や状態管理が欲しいなら Pattern γ の価値あり。

#### cycle-5 での判断

3 つの選択肢:

- **(a) 現状維持 (Pattern γ)**: 動作確認済の実装をそのまま使う。動画再生制御を将来欲しくなった時の準備として残す
- **(b) Pattern α へ撤退**: `vscode-extension/` と `extension/sw/ide_bridge.js` を削除、Hook を上記 10 行版に置換。シンプルさを最優先
- **(c) ハイブリッド**: Pattern γ のコード資産は残しつつ、`vscode-extension/templates/hooks/standalone/` に Pattern α 版テンプレートを追加して、ユーザーが選べるようにする

cycle-5 開始時、ユースケースと運用負荷のバランスを再評価して決める。Backlog の B-20 として登録。

---

## 5. コードの主要エントリポイント

cycle-5 を始めるにあたり、コードを読み始める順序:

```
[Chrome 拡張側 - cycle-1〜4]
1. extension/manifest.json (v0.4.0)
2. extension/service_worker.js (cycle-4 で IdeBridge import + init 追加)
3. extension/sw/message_router.js (無変更、cycle-1)
4. extension/sw/wait_orchestrator.js (無変更、cycle-1)
5. extension/sw/tab_manager.js (無変更、cycle-1、injectPlaybackPause が export されている)
6. extension/sw/settings_repository.js (cycle-3 で REGEX/protocol 拡張)
7. extension/sw/runtime_state.js (無変更、cycle-1)
8. extension/sw/ide_bridge.js                          ★ cycle-4 で新規追加
9. extension/content/*                                  (無変更、cycle-1)
10. extension/reader/*                                  (無変更、cycle-3)
11. extension/options/*                                 (cycle-4 で IPC トグル追加)

[VS Code (Kiro) 拡張側 - cycle-4]
12. vscode-extension/package.json
13. vscode-extension/tsconfig.json
14. vscode-extension/src/extension.ts                   ★ Unit 1 メイン (~530 行)
15. vscode-extension/templates/hooks/                   ★ Unit 3 (Hook テンプレート 4 ファイル + README)
16. vscode-extension/README.md
```

cycle-4 のアーキテクチャ全体は `docs/architecture.md` §2 を参照。

---

## 6. archive の参照先

| ディレクトリ | 内容 |
|------------|------|
| `aidlc-docs-waitless-archive/cycle-1/` | cycle-1 (MVP) の全アーティファクト |
| `aidlc-docs-waitless-archive/cycle-2/` | cycle-2 (遷移先バリエーション拡大) の全アーティファクト |
| `aidlc-docs-waitless-archive/cycle-3/` | cycle-3 (Reader Page 追加) の全アーティファクト |
| `aidlc-docs-waitless-archive/cycle-4/` | cycle-4 (Kiro 拡張機能 + IPC 連携) の全アーティファクト |

cycle-4 archive で特に有用なファイル (cycle-5 開始時の参考):

- `aidlc-docs-waitless-archive/cycle-4/inception/requirements/requirements.md` — FR-41〜61, NFR-21〜29, AS-01〜11
- `aidlc-docs-waitless-archive/cycle-4/inception/application-design/application-design.md` — 統合 Application Design + 確定した 14 件の意思決定 D-01〜D-14
- `aidlc-docs-waitless-archive/cycle-4/inception/application-design/component-dependency.md` — 3 シナリオのデータフロー図
- `aidlc-docs-waitless-archive/cycle-4/inception/application-design/unit-of-work-fr-map.md` — FR/NFR と Unit のマッピング
- `aidlc-docs-waitless-archive/cycle-4/construction/vscode-extension/functional-design/business-rules.md` — BR-41〜58
- `aidlc-docs-waitless-archive/cycle-4/construction/chrome-extension-bridge/functional-design/business-rules.md` — BR-61〜70
- `aidlc-docs-waitless-archive/cycle-4/construction/build-and-test/integration-test-instructions.md` — T-41〜T-56 詳細手順
- `aidlc-docs-waitless-archive/cycle-4/construction/build-and-test/build-and-test-summary.md` — cycle-4 全体サマリ
- `aidlc-docs-waitless-archive/cycle-4/audit.md` — cycle-4 全工程の監査ログ

---

## 7. AI-DLC 再開時の前提整理

cycle-5 を始める時の作法:

1. **`aidlc-docs/` を新規作成して始める** — cycle-1〜4 の archive は参照のみ、編集しない
2. **既存 `extension/` のコードは cycle-4 の状態 (version 0.4.0) を継承** — cycle-5 では追加・修正していく形
3. **既存 `vscode-extension/` のコードは cycle-4 の状態 (version 0.1.0) を継承** — cycle-5 では追加・修正していく形
4. **Workspace Detection ステージで Brownfield 判定** — 既存コードがあるため
5. **Inception Phase の入力**:
   - `docs/architecture.md` (現状アーキテクチャ、cycle-4 完了状態)
   - `docs/backlog.md` (やるべきこと候補、cycle-2 / cycle-3 / cycle-4 の完了セクション含む、新規 B-12〜B-19 も含む)
   - `docs/cycle-5-handover.md` (本ドキュメント)
   - `docs/cycle-4-handover.md` (cycle-4 開始時の手引き、履歴として残されている)
6. **Requirements Analysis でスコープを決める**:
   - cycle-4 で残した検証 (B-14) を cycle-5 の最初のタスクにするかどうか確認
   - §4.1 / §4.2 から実装するテーマを選定
7. **archive ドキュメントとの整合**:
   - cycle-1〜4 で確定した BR (BR-01〜37, BR-41〜58, BR-61〜70) は引き続き有効
   - FR-01〜11 / FR-21〜25 / FR-31〜38 / FR-41〜61 も引き続き有効
   - NFR-01〜10 / NFR-21〜29 も引き続き有効
   - 変更する場合は意図的に新しい Functional Design / Business Rules で上書きする

### cycle-5 開始時のディレクトリ構成 (期待値)

```
/aws-summit-japan-2026-hackathon/
├── README.md
├── extension/                         # cycle-4 完了状態 (継承、v0.4.0)
│   ├── sw/ide_bridge.js               # ★ cycle-4 新規
│   └── ... (cycle-3 までと同じ)
├── vscode-extension/                  # ★ cycle-4 新規 (継承、v0.1.0)
│   ├── src/extension.ts
│   ├── templates/hooks/               # Hook テンプレート (Variant A/B、参考用)
│   └── ...
├── .kiro/hooks/                       # ★ cycle-4 で動作確認済の Hook
│   ├── waitless-ai-wait-start.kiro.hook
│   └── waitless-ai-wait-end.kiro.hook
├── .vscode/settings.json              # aiWaitLessMode.urls の設定 (cycle-4 で必要となる)
├── docs/
│   ├── architecture.md                # cycle-4 完了状態を反映
│   ├── backlog.md                     # cycle-4 末時点の Backlog (B-20 含む)
│   ├── cycle-3-handover.md            # 履歴
│   ├── cycle-4-handover.md            # cycle-3→cycle-4 の手引き (履歴)
│   └── cycle-5-handover.md            # 本ドキュメント
├── aidlc-docs/                        # ★ cycle-5 で新規作成 (現状ここはまだ空)
├── aidlc-docs-tabitabi-archive/
└── aidlc-docs-waitless-archive/
    ├── cycle-1/
    ├── cycle-2/
    ├── cycle-3/
    └── cycle-4/                       # ★ cycle-4 完了 (2026-05-28 archive 化済)
```

cycle-5 完了時には、cycle-5 用の archive (`aidlc-docs-waitless-archive/cycle-5/`) を作る想定。

---

## 関連ドキュメント

- アーキテクチャ: `docs/architecture.md` (cycle-4 完了状態)
- バックログ: `docs/backlog.md` (cycle-4 末時点、B-20 含む)
- ユーザー向け (Chrome): `extension/README.md`
- ユーザー向け (VS Code): `vscode-extension/README.md`
- ユーザー向け (Hook): `vscode-extension/templates/hooks/README.md`
- cycle-4 開始時の手引き (履歴): `docs/cycle-4-handover.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
- cycle-3 archive: `aidlc-docs-waitless-archive/cycle-3/`
- cycle-4 archive: `aidlc-docs-waitless-archive/cycle-4/`
