# WaitLess IDE (cycle-4 — vscode-extension)

Kiro IDE 用の **AI WaitLess Mode** 拡張機能。AI 応答待ち中に外部ブラウザを自動で開き、応答完了で自動的に Kiro ウィンドウを最前面化する。

cycle-4 (2026-05-27) 時点の MVP 実装。**macOS + Kiro IDE 限定**。

---

## 動作の流れ

```
[Kiro でプロンプト送信]
        │
        v   Agent Hook (promptSubmit)
        │   runCommand "code --command waitless.startWaiting"
        v
[VS Code 拡張がコマンドを受信]
   ├─→ Chrome 拡張側 (WaitLess) に IPC で URL リスト要求 (GET_SITES)
   │   ├─ 取得成功 → 優先順位 1 位の URL を Chrome 拡張側で開く (FIND_OR_OPEN_TAB)
   │   └─ IPC 失敗 → settings.json `aiWaitLessMode.urls` をフォールバックして
   │                    vscode.env.openExternal で開く
   v
[ブラウザがフォアグラウンドに表示される]

(AI 完了)
        │
        v   Agent Hook (agentStop)
        │   runCommand "code --command waitless.endWaiting"
        v
[VS Code 拡張がコマンドを受信]
   ├─→ Chrome 拡張に PAUSE_MEDIA notify (動画タブを一時停止)
   └─→ osascript "tell application 'Kiro' to activate" で Kiro 最前面化
   v
[Kiro ウィンドウが前面に来る、ブラウザタブは閉じない]
```

---

## 前提条件

- **macOS** (osascript / Apple Events を使う)
- **Kiro IDE** (Agent Hooks を使うため。純正 VS Code でも拡張機能のインストール自体は可能だが、Hook 連動部分は動作しない)
- **Node.js 20+** (ビルド時のみ)
- (オプション) **WaitLess Chrome 拡張** (cycle-3 完了状態 v0.4.0 以降) — 連動でブラウザタブ操作を有効化したい場合

---

## インストール (cycle-4 はローカル開発のみ)

### 1. ビルド

```bash
cd vscode-extension
npm install
npm run compile
```

`out/extension.js` が生成されれば OK。

### 2. 開発モードで起動

```bash
# Kiro IDE を「拡張機能開発モード」で起動
code --extensionDevelopmentPath=/path/to/vscode-extension
```

または Kiro / VS Code を開いて F5 (Run Extension) でデバッグ起動。

### 3. 設定 (settings.json)

```jsonc
{
  // フォールバック URL リスト (Chrome 拡張連動が動かない時に使う)
  "aiWaitLessMode.urls": [
    "https://www.youtube.com/",
    "https://www.amazon.co.jp/"
  ],

  // 機能の ON/OFF (デフォルト true)
  "aiWaitLessMode.enabled": true
}
```

> Note: WaitLess Chrome 拡張が稼働している場合、`aiWaitLessMode.urls` は **使われない** (Chrome 側の sites リストが優先)。

### 4. Agent Hooks の設定 (Kiro 限定)

cycle-4 では Hook テンプレートを `templates/hooks/` 配下に同梱予定 (cycle-4 unit 3 で作成)。

ユーザーが手動で `.kiro/hooks/` 配下にコピーする想定:

```bash
mkdir -p ~/.kiro/hooks  # またはプロジェクトの .kiro/hooks
cp templates/hooks/01-on-prompt-submit.json ~/.kiro/hooks/
cp templates/hooks/02-on-agent-stop.json ~/.kiro/hooks/
```

詳細はプロジェクト内 `templates/hooks/README.md` を参照 (cycle-4 unit 3 で作成)。

### 5. 動作確認

Hook が動かない場合の救済として、Command Palette からコマンドを直接実行できる:

```
Cmd + Shift + P
> WaitLess: AI 待ち開始
```

ブラウザが開けば OK。

```
> WaitLess: AI 完了で Kiro に戻る
```

Kiro ウィンドウが最前面に来れば OK。

---

## アーキテクチャ概要

`src/extension.ts` 1 ファイルに 9 論理コンポーネントを格納 (cycle-4 Application Design Q1=C 確定):

| Section | コンポーネント | 責務 |
|---------|--------------|------|
| 1 | (constants / types) | 定数 + TypeScript 型定義 |
| 2 | SettingsReader | settings.json 読み込み + 変更購読 |
| 2 | UrlListMerger | Source A (IPC GET_SITES) + Source B (settings.urls) を merge |
| 2 | UrlSelector | 優先順位順で URL を 1 件選ぶ |
| 3 | IpcClient | WebSocket サーバー (`ws://127.0.0.1:39472`)、Chrome 拡張からの接続を受ける |
| 4 | BrowserLauncher | IPC 経由でブラウザを開く + フォールバック |
| 4 | WindowActivator | osascript で Kiro 最前面化 |
| 5 | WaitOrchestratorIde | 中心オーケストレーター (state: idle/waiting) |
| 5 | CommandRegistry | Command Palette コマンド登録 |
| 6 | ExtensionLifecycle | activate / deactivate |

---

## IPC プロトコル (Chrome 拡張連動用、FR-52)

`ws://127.0.0.1:39472` で立ち上がる WebSocket サーバーに、WaitLess Chrome 拡張がクライアントとして接続する。

| Type | Direction | Payload | 用途 |
|------|-----------|---------|------|
| `GET_SITES` | VS Code → Chrome | `{}` | sites リストを要求 |
| `SITES_RESPONSE` | Chrome → VS Code | `{ sites: { domain, url, priority }[] }` | sites 返却 |
| `FIND_OR_OPEN_TAB` | VS Code → Chrome | `{ url: string }` | 2 パス探索 + タブ起動 |
| `TAB_OPENED` | Chrome → VS Code | `{ tabId: number, pass: 1\|2\|3 }` | 起動結果 |
| `PAUSE_MEDIA` | VS Code → Chrome | `{}` | 動画一時停止 |
| `MEDIA_PAUSED` | Chrome → VS Code | `{ ok: boolean }` | 一時停止結果 (応答待たない) |
| `PING` / `PONG` | 両方向 | `{}` | ヘルスチェック (30秒ごと) |

---

## 既知の制限事項 (cycle-4)

- **macOS 限定** — `osascript` 前提。Windows / Linux は将来 cycle (Backlog)
- **Kiro IDE 限定** — Agent Hooks 必須。純正 VS Code で動かす場合は Command Palette から手動実行
- **`Kiro` という app 名がハードコード** — Kiro のインストール状況によっては別名の場合あり (R-02)
- **Apple Events 許可ダイアログが初回に出る** — 「許可」を選んでください
- **複数の Kiro / VS Code ウィンドウ** — 1 ウィンドウ前提、複数ウィンドウは未対応
- **デバッグログ常時 ON** — `const DEBUG = true;` のまま (Backlog)
- **自動テストなし** — 手動 E2E のみ (NFR-23)
- **配布形態はローカル開発のみ** — VSIX / Marketplace 公開は将来 cycle (NFR-22)
- **port 39472 が既使用** — 別のプロセスが使っていると IPC が動かず、フォールバック動作のみになる

---

## トラブルシューティング

### Hook が発火しない

Command Palette から手動で `WaitLess: AI 待ち開始` を実行して動作確認。動けば Hook の設定問題。

### ブラウザが開かない

1. 設定の `aiWaitLessMode.enabled` が true になっているか
2. `aiWaitLessMode.urls` に有効な URL (`https://...`) が入っているか (Chrome 拡張未連動の場合)
3. Output パネルで `[WaitLess-IDE]` のログを確認

### Kiro が前面に来ない

1. macOS のシステム環境設定 → プライバシーとセキュリティ → オートメーション → 「Kiro が System Events を制御」を許可
2. Kiro のアプリ名が `Kiro` でない場合: `extension.ts` の `APP_NAME_FOR_OSASCRIPT` 定数を変更 (cycle-4 では設定化していない)

### IPC 接続がうまくいかない

1. WaitLess Chrome 拡張が cycle-4 (v0.4.0+) の IDE Bridge を含むバージョンか
2. `chrome://extensions` で WaitLess の Service Worker のログ確認
3. ポート 39472 が他のプロセスで使われていないか: `lsof -i :39472`

---

## 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- アプリケーション設計: `aidlc-docs/inception/application-design/application-design.md`
- 機能設計: `aidlc-docs/construction/vscode-extension/functional-design/`
- NFR / Tech Stack: `aidlc-docs/construction/vscode-extension/nfr-requirements/`
- 既存 Chrome 拡張アーキテクチャ: `docs/architecture.md`
