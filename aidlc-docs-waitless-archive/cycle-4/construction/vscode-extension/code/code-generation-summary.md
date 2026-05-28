# cycle-4 — Unit 1 (vscode-extension) — Code Generation Summary

最終更新: 2026-05-27

Unit 1 の Code Generation (Part 2) で生成された成果物のサマリ。

---

## 1. 生成したファイル一覧

すべて新規作成 (Greenfield):

| パス | 種別 | 行数 (目安) | 内容 |
|---|---|---|---|
| `vscode-extension/package.json` | metadata | 53 | 拡張機能 manifest、依存ライブラリ (exact pin)、commands / configuration contributes |
| `vscode-extension/tsconfig.json` | config | 21 | TypeScript フル strict、target ES2020、module Node16 |
| `vscode-extension/.gitignore` | config | 5 | `node_modules/` / `out/` / `*.vsix` |
| `vscode-extension/.vscodeignore` | config | 13 | 将来 VSIX ビルド用 |
| `vscode-extension/README.md` | docs | ~150 | ユーザー向けインストール / 動作確認 / トラブルシューティング |
| `vscode-extension/src/extension.ts` | code | ~530 | Unit 1 のメイン、9 論理コンポーネント |

合計: 6 ファイル新規作成。

---

## 2. extension.ts の構造

| Section | Lines (推定) | コンポーネント |
|---|---|---|
| 1. Imports / Types / Constants | ~100 | imports, IPC types, AiWaitLessSettings, PrioritizedUrl, IpcMessage 等 |
| 2. SettingsReader / UrlListMerger / UrlSelector | ~80 | 設定読み込み + マージ + 選択 |
| 3. IpcClient | ~150 | WebSocket サーバー + pending request 管理 |
| 4. BrowserLauncher / WindowActivator | ~50 | ブラウザ起動 + osascript |
| 5. WaitOrchestratorIde / CommandRegistry | ~80 | オーケストレーション + コマンド登録 |
| 6. ExtensionLifecycle | ~70 | activate / deactivate |

---

## 3. BR (Business Rules) の実装箇所

| BR ID | 内容 | 実装箇所 |
|---|---|---|
| BR-41 | enabled=false で no-op | `WaitOrchestratorIde.startWaiting()` 冒頭 |
| BR-42 | settings 同期取得 | `SettingsReader.getSettings()` |
| BR-43 | WAITING で重複 startWaiting 抑制 | `WaitOrchestratorIde.startWaiting()` の state チェック |
| BR-44 | IDLE で endWaiting 許容 | `WaitOrchestratorIde.endWaiting()` の wasWaiting フラグ |
| BR-45 | Source A 優先 | `UrlListMerger.merge()` 前半 |
| BR-46 | Source B フォールバック | `UrlListMerger.merge()` 後半 (catch ブロック含む) |
| BR-47 | 空 URL リストで no-op | `WaitOrchestratorIde.startWaiting()` の `urls.length === 0` チェック |
| BR-48 | 優先順位順選択 | `UrlSelector.select()` |
| BR-49 | ブラウザ起動フォールバック | `BrowserLauncher.open()` |
| BR-50 | PAUSE_MEDIA は notify | `IpcClient.notify()` を呼ぶ箇所 (`endWaiting()` 内) |
| BR-51 | シェルインジェクション対策 | `WindowActivator.activateKiro()` の `execFile` + 配列引数 |
| BR-52 | osascript 失敗許容 | `WindowActivator.activateKiro()` の catch |
| BR-53 | playTabId は IdeBridge 側で管理 | (Unit 2 の責務、Unit 1 では何もしない) |
| BR-54 | IPC ポート競合許容 | `IpcClient.start()` の error ハンドラ |
| BR-55 | URL バリデーション (http/https のみ) | `UrlListMerger.isValidUrl()` |
| BR-56 | Command Palette からも実行可能 | `registerCommands()` で `enabled` 関係なくコマンドを登録 |
| BR-57 | 設定変更の即時反映 | `SettingsReader.onDidChange()` (内部キャッシュなし、`getSettings()` が常に最新を返す) |
| BR-58 | 連続 start/end の許容 | BR-43 + BR-44 の組み合わせで実現 |

すべての BR-41〜58 が実装に対応している (BR-53 のみ Unit 2 で実装)。

---

## 4. NFR の実装箇所

| NFR ID | 実装箇所 |
|---|---|
| NFR-21 | tsconfig.json の `"strict": true` |
| NFR-22 | scripts に `tsc` のみ、VSIX ビルドはオプション |
| NFR-23 | テストフレームワーク未導入 |
| NFR-24 | `IpcClient.start()` で `host: '127.0.0.1'` 指定 |
| NFR-25 | `WindowActivator.activateKiro()` で `process.platform === 'darwin'` 判定 |
| NFR-26 | package.json の displayName / description / commands.title / configuration.description が日本語 |
| NFR-27 | (Unit 1 では関係なし、Unit 2 の責務) |
| NFR-28 | `BrowserLauncher.open()` の IPC 失敗時フォールバック / `IpcClient.start()` の port-in-use 許容 |
| NFR-29 | `WindowActivator.activateKiro()` の `execFile` + 配列引数 |

---

## 5. Cycle-4 で確定した未確認事項 (実機検証で判明する可能性)

| 事項 | 想定リスク | 確認方法 |
|---|---|---|
| Kiro Hook の `runCommand` 構文 | `code --command waitless.startWaiting` で発火するか不明 | Build & Test で実機検証 |
| Kiro のアプリ名 | "Kiro" で `osascript` が成功するか | Build & Test で実機検証 |
| WebSocket port 39472 の可用性 | 他のプロセスが使っていないか | `lsof -i :39472` で事前確認 |
| Apple Events 権限 | 初回実行時にダイアログが出る | ユーザーが「許可」を選ぶ必要あり |

すべて Build & Test ステージの手動 E2E 手順書で扱う。

---

## 6. ビルド結果 (Step 10 の結果)

cycle-4 の検証段階で実施 (Build & Test ステージで実機実行)。

`npm install` → `npm run compile` の成功を確認する。

---

## 7. 関連ドキュメント

- ビジネスロジック: `aidlc-docs/construction/vscode-extension/functional-design/business-logic-model.md`
- ビジネスルール: `aidlc-docs/construction/vscode-extension/functional-design/business-rules.md`
- ドメインエンティティ: `aidlc-docs/construction/vscode-extension/functional-design/domain-entities.md`
- NFR Inline: `aidlc-docs/construction/vscode-extension/functional-design/nfr-inline.md`
- NFR Requirements: `aidlc-docs/construction/vscode-extension/nfr-requirements/nfr-requirements.md`
- Tech Stack: `aidlc-docs/construction/vscode-extension/nfr-requirements/tech-stack-decisions.md`
- Code Generation Plan: `aidlc-docs/construction/plans/vscode-extension-code-generation-plan.md`
