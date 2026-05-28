# cycle-4 — Unit 1 (vscode-extension) — Business Rules

最終更新: 2026-05-27

Unit 1 のビジネスルールを列挙する。BR 番号は cycle-1〜3 (BR-01〜37) と衝突しないよう **BR-41 から開始**。

---

## BR-41: enabled=false 時の no-op
- **対象**: `startWaiting()` / `endWaiting()` の入口
- **ルール**: `aiWaitLessMode.enabled === false` の場合、いずれのコマンドも no-op で即 return する (副作用なし、ログのみ)
- **対応 FR**: FR-55

## BR-42: settings の同期取得
- **対象**: `SettingsReader.getSettings()`
- **ルール**: 設定値は呼び出し時に `vscode.workspace.getConfiguration('aiWaitLessMode')` から都度取得する。キャッシュしない (設定変更が即時反映されるように)
- **対応 FR**: FR-54

## BR-43: WAITING 状態での重複 startWaiting 抑制
- **対象**: `WaitOrchestratorIde.startWaiting()`
- **ルール**: 状態が `WAITING` の時に `startWaiting` を受信した場合、no-op + `console.warn`。新しいブラウザを開かない (cycle-1 の BR-12 と同じ思想)
- **対応 FR**: FR-49

## BR-44: IDLE 状態での endWaiting の許容
- **対象**: `WaitOrchestratorIde.endWaiting()`
- **ルール**: 状態が `IDLE` の時に `endWaiting` を受信した場合:
  1. PAUSE_MEDIA 通知はスキップ (動画タブの状態が分からないため)
  2. osascript による Kiro 最前面化は **実行する** (Hook 経路で「とにかく Kiro に戻りたい」要求と解釈)
  3. ログのみ出力
- **対応 FR**: FR-48

## BR-45: URL リストのマージ — Source A 優先
- **対象**: `UrlListMerger.merge()`
- **ルール**: IPC で `GET_SITES` を送り、応答 (sites 配列) が空でなければ Source A のみ使用。Source B (`aiWaitLessMode.urls`) は使わない
- **対応 FR**: FR-43, Q6=A

## BR-46: URL リストのマージ — Source B フォールバック
- **対象**: `UrlListMerger.merge()`
- **ルール**: 以下のいずれかで Source B を使う:
  - IPC 接続未確立
  - IPC `GET_SITES` がタイムアウト (5秒)
  - 応答の sites が空配列
- **詳細**: Source B (`urls: string[]`) を `{ url: urls[i], priority: i+1 }[]` に正規化して返す
- **対応 FR**: FR-43, NFR-28

## BR-47: 空 URL リスト時の no-op
- **対象**: `WaitOrchestratorIde.startWaiting()`
- **ルール**: マージ後の URL リストが空 (`[]`) の場合、ブラウザを開かず no-op で return。ログのみ
- **対応 FR**: FR-56

## BR-48: 優先順位順での URL 選択
- **対象**: `UrlSelector.select()`
- **ルール**: 入力リストを `priority` 昇順でソートし、先頭 (`priority=1` が最優先) を返す。複数の同 priority があった場合は配列順で先頭を採用
- **対応 FR**: FR-42, Final-2=C
- **設計上の注**: cycle-1〜3 の 2 パス探索のうち「どの URL を選ぶか」の責務を Unit 1 に持つ。タブ探索 (URL 完全一致 vs ドメイン vs 新規) は Unit 2 が担当

## BR-49: ブラウザ起動のフォールバック
- **対象**: `BrowserLauncher.open(url)`
- **ルール**: IPC が利用可能なら `FIND_OR_OPEN_TAB` を送る。以下のいずれかで `vscode.env.openExternal(uri)` フォールバック:
  - `IpcClient.isConnected() === false`
  - `IpcClient.request("FIND_OR_OPEN_TAB", ...)` がタイムアウト (5秒)
  - request 中に WebSocket が切断される
- **対応 FR**: FR-53, NFR-28

## BR-50: PAUSE_MEDIA は notify (応答待たない)
- **対象**: `WaitOrchestratorIde.endWaiting()`
- **ルール**: `PAUSE_MEDIA` メッセージは応答 (`MEDIA_PAUSED`) を待たない。送信できなくてもエラーにしない (NFR-28、UX 優先)
- **対応 FR**: FR-47

## BR-51: シェルインジェクション対策
- **対象**: `WindowActivator.activateKiro()`
- **ルール**: `child_process.execFile("osascript", ["-e", "tell application \"Kiro\" to activate"])` 形式で **配列引数** を使う。シェル経由 (`exec` / `spawn(..., {shell:true})`) は禁止。アプリ名 "Kiro" はハードコード (cycle-4 では設定化しない、R-02 緩和は将来 cycle)
- **対応 NFR**: NFR-29

## BR-52: osascript 失敗の許容
- **対象**: `WindowActivator.activateKiro()`
- **ルール**: `child_process.execFile` が non-zero exit / Apple Events 未許可 / アプリ未起動 等で失敗した場合、`console.warn` でログのみ。サイクル全体としては「完了」扱い (`state = IDLE` に遷移する)。失敗時は ユーザーに通知しない (UX 邪魔しない)
- **対応 R**: R-02, R-05

## BR-53: playTabId は IdeBridge 側で管理
- **対象**: PAUSE_MEDIA の処理 (Unit 2 側のロジック)
- **ルール**: VS Code 側からは「現在開いている娯楽タブ」を知らない。IdeBridge は **直近の TAB_OPENED で受け取った tabId** を保持し、PAUSE_MEDIA 受信時にその tabId を `injectPlaybackPause` に渡す
- **対応 FR**: FR-44, FR-47
- **設計上の注**: Unit 2 の `business-rules.md` で再掲する

## BR-54: IPC ポート競合の許容
- **対象**: `IpcClient.start()`
- **ルール**: ポート 39472 が既使用 (`EADDRINUSE`) で listen 失敗した場合:
  1. `console.error` でログ出力
  2. `isConnected()` は常に `false` を返す
  3. 拡張機能は機能停止せず、フォールバックパス (`vscode.env.openExternal` のみ) で動作
  4. 失敗時に通知 (`window.showErrorMessage`) は **出さない** (cycle-4 では silent、Backlog で改善)
- **対応 NFR**: NFR-28

## BR-55: 不正な URL のスキップ
- **対象**: `BrowserLauncher.open(url)`
- **ルール**: URL 文字列が `new URL(url)` で parse 失敗、または `protocol` が `http:` / `https:` のいずれでもない場合、その URL はスキップして次の URL を試す。すべて不正なら BR-47 の空リスト扱いに合流
- **対応 FR**: Q8=B (フォーマット parse 可能性のみチェック)
- **設計上の注**: 当初要件 Q8=B は「parse 可能性のみ」だったが、`vscode.env.openExternal` も `child_process` も `file:` / `chrome-extension:` 等のスキームでは意図しない動作の可能性があるため、実装上は `http:` / `https:` 限定にする
- **設計上の例外**: Source A (Chrome 拡張の sites) には `chrome-extension:` URL (cycle-3 の Reader Page) が含まれる可能性あり。これは VS Code 側からは開けないので、IPC 経由で開く場合は問題なし、フォールバックパスではスキップする

## BR-56: 手動コマンドのアクセシビリティ
- **対象**: `CommandRegistry.registerCommands()`
- **ルール**: Hook が動かない場合の救済として、`waitless.startWaiting` / `waitless.endWaiting` を Command Palette から **常に**実行可能とする。`enabled` 設定の影響を受けず、コマンド自体はいつでも呼べる (BR-41 の no-op で結果的に「何もしない」のが期待動作)
- **対応 R**: R-01

## BR-57: 設定変更時の即時反映
- **対象**: `SettingsReader.onDidChange()`
- **ルール**: `vscode.workspace.onDidChangeConfiguration` を購読し、`aiWaitLessMode.*` の変更時にコールバックを発火。`enabled` の変更は即座にロジックに反映される (BR-41 が次回コマンドで適用)
- **対応 FR**: FR-54

## BR-58: Hook タイミングと state の許容範囲
- **対象**: 連続 startWaiting / endWaiting (BR-43, BR-44 と関連)
- **ルール**: 同じイベント (start, end) が連続発火した場合の許容を以下のように整理:

| 直前 | 今回 | 動作 |
|---|---|---|
| start (state=IDLE→WAITING) | start (state=WAITING) | BR-43: no-op |
| start (state=IDLE→WAITING) | end (state=WAITING→IDLE) | 通常完了 |
| end (state=WAITING→IDLE) | start (state=IDLE→WAITING) | 通常開始 |
| end (state=WAITING→IDLE) | end (state=IDLE) | BR-44: osascript のみ実行 |

- **対応 FR**: FR-49, BR-43, BR-44

---

## ルールの優先順位

複数のルールが衝突する場合の優先順位 (上から優先):

1. **BR-41** (enabled=false) — すべてに優先する no-op
2. **BR-43, BR-44** (状態整合性) — 重複呼び出しを抑制
3. **BR-45, BR-46** (Source A 優先 / B フォールバック)
4. **BR-47** (空リスト no-op)
5. **BR-48** (優先順位順選択)
6. **BR-49, BR-50, BR-52** (フォールバック / 失敗許容)
7. **BR-51, BR-55** (セキュリティ / 入力検証)

---

## 関連ドキュメント

- ビジネスロジック: `business-logic-model.md`
- ドメインエンティティ: `domain-entities.md`
- NFR inline 対応: `nfr-inline.md`
