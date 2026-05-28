# cycle-4 — Unit of Work Dependency

最終更新: 2026-05-27

cycle-4 の 3 unit 間の依存関係と開発順序を定義する。

---

## 1. Unit 依存マトリクス

`X` 印 = 行の unit が列の unit に **依存する** (列が完成しないと行を完了できない、または列のインタフェースが行を制約する) ことを示す。

|  ↓ 依存する \ 依存される → | Unit 1 (vscode-extension) | Unit 2 (chrome-extension-bridge) | Unit 3 (agent-hooks-templates) |
|---|:---:|:---:|:---:|
| **Unit 1 (vscode-extension)** | — | (IPC プロトコルの contract で双方向に依存) | |
| **Unit 2 (chrome-extension-bridge)** | X (IPC プロトコルの定義は Unit 1 が master) | — | |
| **Unit 3 (agent-hooks-templates)** | X (Unit 1 のコマンド名 `waitless.startWaiting` / `endWaiting` を参照) | | — |

### 1.1 既存 unit (cycle-1〜3) との依存

| Unit | 依存先 (cycle-1〜3 既存) | 内容 |
|---|---|---|
| Unit 2 | `extension/sw/wait_orchestrator.js` (cycle-1) | callback として呼ぶだけ、改変なし (FR-60) |
| Unit 2 | `extension/sw/tab_manager.js` (cycle-1) | callback として呼ぶ + `injectPlaybackPause` メソッドを export 化 (要 Functional Design 確定) |
| Unit 2 | `extension/sw/settings_repository.js` (cycle-1〜3) | callback として `getSettings()` を呼ぶ、改変なし |

---

## 2. 開発順序 (Sequential、Critical Path)

```
Step 1: Unit 1 (vscode-extension)
   └→ IPC プロトコル契約 (FR-52 の 7 メッセージタイプ + Payload Schema) を確定
   └→ TypeScript 実装、ビルド、Command Palette からの手動起動でフォールバックパスを動作確認
        ↓ (IPC contract 確定)
Step 2: Unit 2 (chrome-extension-bridge)
   └→ Unit 1 で確定した IPC プロトコルに準拠して `sw/ide_bridge.js` を実装
   └→ 既存 Chrome 拡張に統合、Service Worker 起動時の自動接続を確認
        ↓ (両 unit が動作)
Step 3: Unit 3 (agent-hooks-templates)
   └→ Unit 1 のコマンド名を参照する Hook JSON を作成
   └→ ユーザー環境で `.kiro/hooks/` に配置して E2E 動作確認

統合検証:
   └→ Build and Test ステージで T-31 〜 T-XX のシナリオを手動 E2E
```

**並列開発の可能性**:
- Unit 1 と Unit 2 を **完全並列で開発するのは推奨しない**。理由は Step 1 で IPC プロトコルを確定する必要があるため
- IPC プロトコルが確定 (Unit 1 の Functional Design 完了時点) すれば、Unit 1 と Unit 2 の **Code Generation 部分は並列可能**。ただし AI-DLC ワークフローでは Per-Unit Loop (各 unit の Functional Design → Code Generation を完了させる) を踏襲するため、Sequential で進める

---

## 3. 各 unit の完了条件

### 3.1 Unit 1 完了条件

- [ ] `package.json` / `tsconfig.json` 等のメタファイル作成
- [ ] `src/extension.ts` の実装完了 (9 コンポーネント)
- [ ] `npm run build` (tsc) が成功する
- [ ] `code --extensionDevelopmentPath=$PWD` で開発モード起動できる
- [ ] Command Palette で 2 つのコマンドが実行可能
- [ ] フォールバック動作 (`vscode.env.openExternal`) が確認できる
- [ ] WebSocket サーバーが `ws://127.0.0.1:39472` で listen 開始する

### 3.2 Unit 2 完了条件

- [ ] `extension/sw/ide_bridge.js` の実装完了
- [ ] `extension/service_worker.js` への 1 行 import 追加
- [ ] `extension/manifest.json` を v0.4.0 に更新
- [ ] `extension/options/options.{html,css,js}` の IPC トグル追加
- [ ] Chrome 拡張を unpacked load し直し
- [ ] cycle-1〜3 の T-01〜T-30 シナリオが後方互換で動作する
- [ ] IDE 拡張を併走させて IPC 接続が確立する
- [ ] IPC メッセージ往復 (`GET_SITES` / `FIND_OR_OPEN_TAB` / `PAUSE_MEDIA`) が動作する

### 3.3 Unit 3 完了条件

- [ ] `vscode-extension/templates/hooks/01-on-prompt-submit.json` の作成
- [ ] `vscode-extension/templates/hooks/02-on-agent-stop.json` の作成
- [ ] README に「ユーザーが `.kiro/hooks/` に配置する手順」を記載
- [ ] `runCommand` 文字列が Kiro 環境で実機検証され、コマンドが発火する

---

## 4. リスクと緩和策 (unit 別)

| Unit | リスク | 緩和策 |
|---|---|---|
| Unit 1 | `ws` ライブラリの VS Code Extension Host での挙動 (依存の bundle 必要性) | tsc のみでビルド、依存は `node_modules` に置く。VSIX 化は cycle-4 では推奨せず、開発モードで起動 (NFR-22) |
| Unit 1 | osascript のアプリ名が "Kiro" と一致しない可能性 | ハードコード "Kiro"、失敗時はエラーログ。Backlog でアプリ名設定化 (R-02) |
| Unit 2 | Service Worker のアイドルアンロードによる WebSocket 切断 | アンロード時に再接続できるよう指数バックオフ実装 (FR-51、R-04) |
| Unit 2 | 既存 cycle-1〜3 シナリオへの後方互換性破壊 | sw/*.js の他の 4 ファイルを完全無変更に保つ。`tab_manager.js` の `injectPlaybackPause` 昇格は外部から見える挙動を変えない (Functional Design で慎重に検討) |
| Unit 3 | Kiro Hook の `runCommand` 構文が想定と異なる可能性 | Functional Design で実機検証、確定したものを Code Generation で展開 |
| Unit 3 | Hook が発火しない / 想定と違うイベントで発火する | Command Palette からの手動実行を併設 (R-01)、テンプレートに「動作確認手順」を README に明記 |

---

## 5. ロールバック戦略 (依存順序)

問題発生時のロールバック順序 (上から下へ):

1. **Unit 3 のロールバック** (最も影響小): `~/.kiro/hooks/*.json` を削除
2. **Unit 1 のロールバック**: VS Code 拡張機能を uninstall または開発モード停止
3. **Unit 2 のロールバック** (最も影響大): `extension/sw/ide_bridge.js` 削除 + `service_worker.js` から import 行を削除 + Options Page の改修を revert

Unit 1 と Unit 2 は独立しているので、両方を残してもどちらか単独でも動作する (フォールバックパスがあるため)。

---

## 6. 既存ドキュメントとの整合

| 既存ドキュメント | cycle-4 での更新 |
|---|---|
| `docs/architecture.md` | Build & Test の最終ステップで cycle-4 のセクションを追加 (cycle-1〜3 と同じパターン) |
| `docs/backlog.md` | Build & Test の最終ステップで cycle-4 で完了した項目 / 新規 backlog 項目を整理 |
| `extension/README.md` | Unit 2 改修時に cycle-4 機能の説明を追記 |
| `aidlc-docs-waitless-archive/cycle-{1,2,3}/` | 参照のみ、変更しない |

---

## 7. 関連ドキュメント

- Unit 定義: `unit-of-work.md`
- FR-Unit マッピング: `unit-of-work-fr-map.md`
- Application Design 統合: `application-design.md`
- 実行計画: `aidlc-docs/inception/plans/execution-plan.md`
