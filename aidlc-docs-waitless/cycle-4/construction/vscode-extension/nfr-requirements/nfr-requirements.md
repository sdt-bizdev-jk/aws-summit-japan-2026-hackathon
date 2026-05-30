# cycle-4 — Unit 1 (vscode-extension) — NFR Requirements

最終更新: 2026-05-27

Unit 1 の Non-Functional Requirements (NFR) を要件 §4 / Functional Design `nfr-inline.md` を統合し、構造化して列挙する。

---

## 1. パフォーマンス (Performance)

### NFR-21-P-1: コマンド応答時間
- **要求**: `waitless.startWaiting` / `waitless.endWaiting` のコマンド受信から、外部ブラウザ起動 (or osascript) のキックオフまで、**3 秒以内**
- **理由**: ユーザー体験として「Hook が動いた」と感じる遅延の上限
- **測定**: Build & Test の手動 E2E で目視確認
- **対応コンポーネント**: `WaitOrchestratorIde`、`IpcClient`

### NFR-21-P-2: IPC タイムアウト
- **要求**: IPC リクエスト (`GET_SITES` / `FIND_OR_OPEN_TAB`) のタイムアウトは 5 秒
- **理由**: Service Worker の spin up 待ち + WebSocket round trip + Chrome 拡張側の処理時間を許容しつつ、ユーザーを長く待たせない
- **対応**: `IPC_TIMEOUT_MS = 5000` (定数として `domain-entities.md` §7 に記載)

### NFR-21-P-3: PING/PONG ヘルスチェック頻度
- **要求**: 30 秒ごと (`PING_INTERVAL_MS = 30_000`)
- **理由**: Service Worker の idle unload を防ぎつつ、過度なトラフィックを避ける

---

## 2. 信頼性 / Availability

### NFR-21-R-1: フォールバック動作の保証
- **要求**: IPC が利用不可な状況でも、拡張機能は **基本機能を提供しなければならない**
  - URL 取得: `aiWaitLessMode.urls` (Source B)
  - ブラウザ起動: `vscode.env.openExternal`
  - Kiro 戻り: `osascript` のみ (動画一時停止はスキップ)
- **対応 NFR**: NFR-28
- **対応コンポーネント**: `BrowserLauncher`, `UrlListMerger`

### NFR-21-R-2: WebSocket 切断後の自動復旧
- **要求**: VS Code 側 WebSocket サーバーは Chrome 拡張からの再接続を **自動で受け入れる** (再起動不要)
- **対応**: `IpcClient.start()` 後は常に listen を続け、Chrome 拡張側 (Service Worker) が再接続したら自動的に新しい WebSocket セッションが開始される
- **対応 NFR**: NFR-28

### NFR-21-R-3: ポート競合時の機能停止禁止
- **要求**: ポート 39472 が既使用 (例: 別ウィンドウの VS Code が既に listen 中) でも、拡張機能は機能停止せず、フォールバックパスで動作
- **対応 BR**: BR-54

---

## 3. セキュリティ (Security)

### NFR-21-S-1: WebSocket は localhost-only
- **要求**: WebSocket サーバーは `127.0.0.1` のみ bind し、外部からアクセス不可
- **対応 NFR**: NFR-24
- **実装**: `new WebSocketServer({ host: '127.0.0.1', port: 39472 })`

### NFR-21-S-2: シェルインジェクション対策
- **要求**: `child_process.exec` / `spawn(..., {shell:true})` は使用禁止。`execFile` + 配列引数のみ使用
- **対応 NFR**: NFR-29
- **対応 BR**: BR-51

### NFR-21-S-3: 設定値のバリデーション
- **要求**: `aiWaitLessMode.urls` の各要素は **`http:` / `https:`** スキーマのみ受け入れ。それ以外はスキップ + 警告ログ
- **対応 BR**: BR-55

### NFR-21-S-4: cycle-4 の脅威モデルから除外
- **同一マシン上の悪意ある別プロセスからの WebSocket 接続乗っ取り** は cycle-4 では考慮しない (Backlog で改善余地)
- 認証 / トークン機構は導入しない (cycle-4 はローカル開発のみ、NFR-22)

---

## 4. 保守性 (Maintainability)

### NFR-21-M-1: TypeScript フル strict
- **要求**: `tsconfig.json` で `"strict": true` を厳守。`any` は原則使わない
- **対応 NFR**: NFR-21
- **対応 Q1**: Application Design Plan Q1=C → Functional Design Plan Q1=A (フル strict)

### NFR-21-M-2: シングルファイル `extension.ts` のセクション分割
- **要求**: 1 ファイル内で論理コンポーネントごとに **明示的なセクションコメント** で分割
- **対応**: `business-logic-model.md` §3 で順序を定義

### NFR-21-M-3: 依存ライブラリのバージョンピン
- **要求**: `package.json` の `dependencies` / `devDependencies` は **exact version (固定)** で指定
- **対応 Q1 (NFR Plan)**: C → 確定
- **理由**: cycle-4 はローカル開発のみで再現性を最大化したい
- **影響**: `npm install` 時に常に同じバージョンが入る

### NFR-21-M-4: ログ出力
- **要求**: cycle-1〜3 と同じく `const DEBUG = true;` のフラグでログ制御
- **将来**: Backlog B-02 と同じく、本番化前に DEBUG=false にする

---

## 5. ユーザビリティ / UX

### NFR-21-U-1: silent / non-intrusive
- **要求**: cycle-4 の動作は基本 silent。ユーザーの作業を邪魔しない
  - IPC 失敗の通知なし (BR-54)
  - osascript 失敗の通知なし (BR-52)
  - Status Bar 表示なし (Q10=C 確定)
- **対応 Q10**: 確定値 C (Silent)

### NFR-21-U-2: Command Palette からの手動アクセス
- **要求**: Hook が動かない場合の救済として、`waitless.startWaiting` / `waitless.endWaiting` を Command Palette から **常に**実行可能
- **対応 BR**: BR-56

### NFR-21-U-3: 設定変更の即時反映
- **要求**: `settings.json` の変更は **VS Code 再起動なしで反映**
- **対応 BR**: BR-42, BR-57
- **実装**: `vscode.workspace.onDidChangeConfiguration` を購読

### NFR-21-U-4: 日本語固定
- **要求**: コマンドタイトル / 設定説明 / メッセージは日本語
- **対応 NFR**: NFR-26

---

## 6. プラットフォーム依存

### NFR-21-PF-1: macOS 限定
- **要求**: `WindowActivator` (osascript) は macOS のみで動作
- **対応 NFR**: NFR-25
- **実装**: `process.platform === 'darwin'` 判定、それ以外は no-op + 警告

### NFR-21-PF-2: Kiro IDE 限定 (Agent Hooks 必須)
- **要求**: 動作対象は Kiro IDE のみ
- **対応**: 純正 VS Code でも拡張機能としてインストール可能だが、Agent Hooks がないため 自動トリガーは動かない (Command Palette で手動起動のみ)
- **対応 C1**: Confirmation 1=A (Kiro 限定)

---

## 7. 配布 / デプロイ

### NFR-21-D-1: ローカル開発のみ
- **要求**: VSIX / Marketplace 公開は cycle-4 のスコープ外
- **対応 NFR**: NFR-22
- **動作確認**: `code --extensionDevelopmentPath=/path/to/vscode-extension` で開発モード起動

### NFR-21-D-2: tsc のみのビルド
- **要求**: esbuild / webpack 等のバンドラは使わない
- **理由**: cycle-4 のシンプル性維持、依存最小化
- **対応**: `npm run compile` = `tsc -p ./`

---

## 8. テスト

### NFR-21-T-1: 自動テスト不要
- **要求**: ユニットテスト / E2E 自動テストは導入しない
- **対応 NFR**: NFR-23
- **代替**: Build & Test ステージで手動 E2E 手順書を整備

---

## 9. NFR ID 整合表

| NFR ID | 出典 | 本ドキュメントの対応 |
|---|---|---|
| NFR-21 | 要件 §4 (TypeScript + JS) | NFR-21-M-1 |
| NFR-22 | 要件 §4 (ローカル開発のみ) | NFR-21-D-1 |
| NFR-23 | 要件 §4 (テストなし) | NFR-21-T-1 |
| NFR-24 | 要件 §4 (WebSocket localhost) | NFR-21-S-1 |
| NFR-25 | 要件 §4 (macOS 限定) | NFR-21-PF-1 |
| NFR-26 | 要件 §4 (日本語) | NFR-21-U-4 |
| NFR-27 | 要件 §4 (後方互換性) | (Unit 2 の責務、本 unit では関係なし) |
| NFR-28 | 要件 §4 (フォールバック) | NFR-21-R-1, NFR-21-R-3 |
| NFR-29 | 要件 §4 (シェルインジェクション) | NFR-21-S-2 |

---

## 10. 関連ドキュメント

- Functional Design NFR Inline: `aidlc-docs/construction/vscode-extension/functional-design/nfr-inline.md`
- Tech Stack Decisions: `tech-stack-decisions.md`
- 要件: `aidlc-docs/inception/requirements/requirements.md` §4
