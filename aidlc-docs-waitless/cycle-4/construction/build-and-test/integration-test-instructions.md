# cycle-4 — Integration Test Instructions (手動 E2E)

最終更新: 2026-05-27

cycle-4 の手動 E2E シナリオ。NFR-23 により自動テストは導入せず、本ドキュメントを実機で順次確認する。

シナリオ番号は cycle-1〜3 (T-01〜T-30) を引き継ぎ、cycle-4 は **T-41 から** 開始する。

---

## 事前準備

### Pre-1: 環境セットアップ

- macOS 環境
- Kiro IDE がインストール済
- Google Chrome (Manifest V3 対応版) がインストール済
- リポジトリ clone 済
- Node.js 20+ + npm 10+

### Pre-2: ビルド完了

[`build-instructions.md`](./build-instructions.md) に従い、以下が完了している:

- [ ] Unit 1: `vscode-extension/` で `npm install` + `npm run compile` 成功
- [ ] Unit 2: `extension/` を Chrome に Unpacked ロード済 (v0.4.0)
- [ ] Unit 3: Hook テンプレートが `.kiro/hooks/` または `~/.kiro/hooks/` に配置済 (Variant A 推奨)

### Pre-3: ポート 39472 が空いているか

```bash
lsof -i :39472
# 何も出なければ OK (空)
# 何か出ていれば、そのプロセスを止めてから検証する
```

### Pre-4: macOS の Apple Events 許可

T-43 で `osascript` 経由で Kiro を最前面にする。初回実行時に許可ダイアログが出るので、事前に以下のコマンドを叩いて許可ダイアログを出しておくとよい:

```bash
osascript -e 'tell application "Kiro" to activate'
# 初回のみ「許可しますか?」のダイアログが出る → 「許可」
```

---

## T-41: Unit 1 単独動作 (フォールバックパス) [Critical]

**目的**: vscode-extension が単独 (Chrome 拡張未連動) で動作することを確認 (NFR-28 フォールバック)。

**事前準備**:
- Chrome 拡張 (Unit 2) を **無効化または OFF** にする (`chrome://extensions/` で WaitLess を OFF、または Options Page の IDE 連携トグルを OFF)
- Kiro 開発ホストで vscode-extension が起動済
- `settings.json` に `aiWaitLessMode.urls: ["https://www.example.com/"]` を設定

**手順**:
1. Kiro の Command Palette を開く (`Cmd+Shift+P`)
2. `WaitLess: AI 待ち開始` を実行
3. 期待結果: macOS のデフォルトブラウザ (Chrome 等) で `https://www.example.com/` が新規タブで開く
4. ブラウザに移った状態で Kiro に戻り、Command Palette から `WaitLess: AI 完了で Kiro に戻る` を実行
5. 期待結果: Kiro ウィンドウが自動的に最前面に来る (osascript 動作)

**検証ポイント**:
- フォールバック (`vscode.env.openExternal`) で URL が開く
- Kiro が前面に来る
- 既存ブラウザタブは閉じない (タブはそのまま)

---

## T-42: Unit 1 + Unit 2 IPC 接続 [Critical]

**目的**: vscode-extension と Chrome 拡張が WebSocket で接続できることを確認 (FR-50, FR-51)。

**事前準備**:
- Chrome 拡張を有効化、Options Page で IDE 連携トグル ON (デフォルト)
- vscode-extension を Kiro で開発モード起動

**手順**:
1. Chrome `chrome://extensions/` で WaitLess の Service Worker DevTools を開く
2. Console に以下のようなログが出ることを確認:
   ```
   [WaitLess][IdeBridge] init: ipc_enabled=true, will connect
   [WaitLess][IdeBridge] connected to ws://127.0.0.1:39472
   ```
3. Kiro の Output パネル (`View → Output → WaitLess`) または DevTools で以下のログを確認:
   ```
   [WaitLess-IDE] IpcClient: listening on ws://127.0.0.1:39472
   [WaitLess-IDE] IpcClient: new connection from Chrome extension
   ```

**検証ポイント**:
- 双方向で接続成立を認識している
- `IdeBridge.isConnected()` の状態 (起動後数秒で true)

---

## T-43: 待ち開始 → ブラウザ起動 → 戻り (Variant A Hook + IPC 接続) [Critical]

**目的**: cycle-4 のハッピーパス全体を Hook 経由で確認 (FR-41〜49)。

**事前準備**:
- T-42 で IPC 接続成立済
- Chrome 拡張に sites を **1 件以上** 登録 (例: `youtube.com` / `https://www.youtube.com/`)
- Hook テンプレート Variant A が `.kiro/hooks/` に配置済 (Pre-2 Unit 3)

**手順**:
1. Kiro でプロンプトを送信 (例: 「こんにちは」と入力 → Enter)
2. 数秒以内に Chrome ブラウザが前面に来て、登録 URL のタブが開く / アクティブ化されることを確認
3. プロンプトに対する AI 応答が完了するまで待つ
4. AI 応答完了後、自動的に Kiro ウィンドウが前面に来ることを確認
5. ブラウザ (動画ありの場合) は **閉じておらず、タブもそのまま** であることを確認

**検証ポイント**:
- promptSubmit Hook が `waitless.startWaiting` を発火
- IPC FIND_OR_OPEN_TAB → タブ起動
- agentStop Hook が `waitless.endWaiting` を発火
- IPC PAUSE_MEDIA → 動画一時停止 (動画タブの場合)
- osascript で Kiro 最前面化

---

## T-44: 既存タブのアクティブ化 (Pass 1) [High]

**目的**: 同 URL のタブが既に開いている場合、新規タブを作らずアクティブ化する (cycle-1 BR-07 継承、FR-44)。

**事前準備**: Chrome に `youtube.com` / `https://youtu.be/dQw4w9WgXcQ?autoplay=1` を登録、ブラウザで同 URL のタブを既に開いている

**手順**:
1. Kiro でプロンプト送信 (T-43 と同じ)
2. **既存のタブ** がアクティブ化されることを確認 (新規タブが作られない)
3. Chrome 拡張の Service Worker のログで `pass: 1` (existing) が出ていることを確認

---

## T-45: ドメイン一致タブへの navigate (Pass 2) [High]

**目的**: ドメインが一致するが URL が異なるタブがあれば、登録 URL に navigate する (cycle-1 と整合、FR-44)。

**手順**:
1. Chrome に `youtube.com` / `https://www.youtube.com/feed/subscriptions` を登録
2. ブラウザで `https://www.youtube.com/` (ホーム) のタブだけ開く
3. Kiro でプロンプト送信
4. 既存の YouTube タブが `https://www.youtube.com/feed/subscriptions` に navigate されることを確認
5. ログで `pass: 2` (navigated) が出ていることを確認

---

## T-46: 新規タブ起動 (Pass 3) [High]

**手順**:
1. Chrome 拡張に `example.com` / `https://example.com/` を登録
2. ブラウザで `example.com` 関連のタブを **何も開いていない** 状態にする
3. Kiro でプロンプト送信
4. 新規タブで `https://example.com/` が開くことを確認
5. ログで `pass: 3` (new) が出ていることを確認

---

## T-47: aiWaitLessMode.enabled=false で no-op [High]

**目的**: BR-41 (enabled=false で no-op) を確認。

**手順**:
1. Kiro の `settings.json` に `"aiWaitLessMode.enabled": false` を設定
2. Kiro でプロンプト送信
3. ブラウザが起動しないことを確認
4. Kiro の DevTools / Output で `[WaitLess-IDE] startWaiting: disabled, no-op (BR-41)` のログを確認

---

## T-48: URL 両方空で no-op [Medium]

**目的**: BR-47 (URL リスト空で no-op) を確認。

**手順**:
1. Chrome 拡張の sites を **すべて削除** (Options Page で削除)
2. Kiro の `settings.json` で `"aiWaitLessMode.urls": []` (デフォルト)
3. Kiro でプロンプト送信
4. ブラウザが起動しないこと、ログで `startWaiting: no URLs available, no-op (BR-47)` を確認

---

## T-49: IDE 連携トグル OFF で IPC 切断 [Medium]

**目的**: BR-62 (ipc_enabled=false で IdeBridge 全停止) と Q2=A (デフォルト ON) を確認。

**手順**:
1. T-42 の状態 (IPC 接続中)
2. Chrome 拡張の Options Page で「Kiro IDE 連携を有効にする」トグルを **OFF**
3. Service Worker のログで `[WaitLess][IdeBridge] storage onChanged: ipc_enabled flipped to false → shutting down` を確認
4. Kiro 側のログで接続切断を確認
5. Kiro でプロンプト送信 → フォールバックパス (`vscode.env.openExternal`) で動作することを確認

---

## T-50: 指数バックオフでの再接続 [Medium]

**目的**: BR-63 (指数バックオフ) を確認。

**手順**:
1. Chrome 拡張 のみを起動 (Unit 1 の VS Code 拡張は起動しない)
2. Service Worker のログで以下を確認:
   ```
   [WaitLess][IdeBridge] scheduling reconnect in 1s (attempt=1)
   [WaitLess][IdeBridge] scheduling reconnect in 2s (attempt=2)
   [WaitLess][IdeBridge] scheduling reconnect in 4s (attempt=3)
   ...
   [WaitLess][IdeBridge] scheduling reconnect in 30s (attempt=N)  ← 頭打ち
   ```
3. 数分後、Kiro 側 vscode-extension を起動
4. Service Worker のログで `connected to ws://127.0.0.1:39472` を確認
5. `reconnectAttempt` がリセットされていることを確認

---

## T-51: ポート 39472 競合時のフォールバック [Medium]

**目的**: BR-54 (ポート競合許容) を確認。

**手順**:
1. ターミナルで `nc -l 39472` (またはその他のサーバー) を起動
2. Kiro で vscode-extension を起動
3. Kiro の Output で以下を確認:
   ```
   [WaitLess-IDE] IpcClient: port 39472 in use, IPC will be unavailable
   ```
4. Kiro でプロンプト送信
5. フォールバックパス (`vscode.env.openExternal`) で動作することを確認

---

## T-52: macOS Apple Events 許可 [Low]

**目的**: BR-52 (osascript 失敗許容) を確認。

**手順**:
1. macOS のシステム環境設定 → プライバシーとセキュリティ → オートメーション で Kiro の System Events 許可を **OFF**
2. T-43 の手順を実行
3. ブラウザは開くが、Kiro が前面に来ない (osascript が拒否される)
4. ログで `[WaitLess-IDE] osascript activate failed` を確認
5. サイクル全体としてはエラーで止まらず、`state = 'idle'` に戻ることを確認

---

## T-53: Variant B (CLI 経由) Hook の動作 [Low]

**目的**: Hook テンプレート Variant B が動作することを確認 (Variant A が動かない環境向けの代替)。

**手順**:
1. `.kiro/hooks/01-on-prompt-submit.json` を Variant B の内容に置き換え (`code --command waitless.startWaiting`)
2. `.kiro/hooks/02-on-agent-stop.json` を Variant B の内容に置き換え
3. Kiro をリロード
4. T-43 の手順を実行
5. CLI 経由で waitless.startWaiting が発火することを確認

> Note: `code` CLI がパスにないと動作しない。`which code` で事前確認。

---

## T-54〜T-60: cycle-1〜3 のリグレッション (NFR-27 後方互換性) [Critical]

**目的**: cycle-1〜3 で動作していたシナリオが cycle-4 後も同じ動作をする。

**前提**: Chrome 拡張 v0.4.0 を Unpacked ロード済 + Claude.ai タブを開いている。

| T 番号 | シナリオ | 確認内容 |
|---|---|---|
| T-54 (= T-01〜T-13) | cycle-1 リグレッション | Claude.ai 待ち時間検知 → 動画タブ起動 → 完了で Claude タブに戻り |
| T-55 (= T-14〜T-20) | cycle-2 リグレッション | 動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ) で同じシナリオ |
| T-56 (= T-21〜T-30) | cycle-3 リグレッション | Reader Page を Site として登録、表示、青色化、状態復元 |

詳細は cycle-1〜3 archive の `integration-test-instructions.md` を参照:
- `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/integration-test-instructions.md`
- `aidlc-docs-waitless-archive/cycle-2/construction/build-and-test/integration-test-instructions.md`
- `aidlc-docs-waitless-archive/cycle-3/construction/build-and-test/integration-test-instructions.md`

---

## 検証マトリクス (重要度別)

| Criticality | テスト | 数 |
|---|---|:---:|
| **Critical** (必ず確認) | T-41, T-42, T-43, T-54-56 (cycle-1〜3 リグレッション) | 6 |
| **High** | T-44, T-45, T-46, T-47 | 4 |
| **Medium** | T-48, T-49, T-50, T-51 | 4 |
| **Low** | T-52, T-53 | 2 |

cycle-4 受け入れ条件: **Critical 6 シナリオ + High 4 シナリオ = 10 シナリオすべて成功**。Medium / Low は確認後 Backlog に挙げる。

---

## トラブルシューティング (T-43 が動かない場合)

実機検証で発生する可能性が高い問題と対処を `vscode-extension/templates/hooks/README.md` の「動作しない場合」セクションに整理済。確認順序:

1. Hook が登録されているか (`.kiro/hooks/*.json` の配置)
2. Variant A → Variant B に切替
3. Command Palette から手動 `WaitLess: AI 待ち開始` で Unit 1 単独動作確認 (T-41)
4. Service Worker のログで IPC 接続確認 (T-42)

---

## 関連ドキュメント

- ビルド手順: `build-instructions.md`
- ユニットテスト相当: `unit-test-instructions.md`
- 統合サマリ: `build-and-test-summary.md`
