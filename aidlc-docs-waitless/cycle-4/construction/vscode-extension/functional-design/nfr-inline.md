# cycle-4 — Unit 1 (vscode-extension) — NFR Inline

最終更新: 2026-05-27

NFR Design ステージはスキップしているため、Unit 1 に関係する NFR の **実装上の対応方針** をここで明示する。

---

## NFR-21: 言語スタック (TypeScript)

### 対応方針
- TypeScript 5.x を採用
- `tsconfig.json` の `"strict": true` (Q1=A 確定、フル strict)
- `target: "ES2020"`, `module: "Node16"` (VS Code 拡張機能の標準)
- `outDir: "./out"`, `rootDir: "./src"`
- ビルドは `tsc` のみ (esbuild / webpack は使わない、cycle-4 のシンプルさを維持)

### tsconfig.json (確定値)
```jsonc
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out"]
}
```

---

## NFR-22: 配布形態 (ローカル開発のみ)

### 対応方針
- VSIX ファイル化はオプション (cycle-4 のスコープでは必須ではない)
- 動作確認は `code --extensionDevelopmentPath=/path/to/vscode-extension` でデバッグ起動
- `npm run vscode:prepublish` を `npm run compile` に設定し、将来の VSIX ビルドに備える
- README に「開発モードでの起動手順」を明記

### npm scripts (確定値)
```jsonc
{
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  }
}
```

---

## NFR-23: 自動テスト不要

### 対応方針
- `@vscode/test-electron` 等の E2E フレームワークは導入しない
- ユニットテストフレームワーク (Mocha / Vitest) も導入しない
- 動作確認は **手動 E2E のみ** (Build & Test ステージで手順書を整備)

### 例外
- 純粋関数 (例: `UrlSelector.select`, `UrlListMerger.merge` のロジック部分) は **十分にシンプルに保ち**、目視レビューで検証可能な粒度に留める

---

## NFR-24: WebSocket は localhost-only

### 対応方針
- `WebSocketServer` の `host` オプションを **`'127.0.0.1'`** に明示する (`'0.0.0.0'` は使わない)
- ポートは `39472` (cycle-4 の確定値、`waitless` を decimal 化した数字、衝突する可能性は極低)
- 認証は **なし** (localhost-only で外部から到達不可、cycle-4 の想定攻撃モデルでは不要)

### 実装
```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({
  host: '127.0.0.1',  // ← localhost-only
  port: 39472,
});
```

### 攻撃モデル (cycle-4 の前提)
- 同一マシン上の他のプロセスからの接続は **許容** (cycle-4 の Chrome 拡張がそうであるため)
- リモート (LAN / WAN) からの接続は **不可** (`127.0.0.1` bind により OS レベルでブロック)
- 同一マシン上の悪意あるプロセスが偽装メッセージを送る可能性は **OUT OF SCOPE** (cycle-4 では考慮しない、Backlog で改善余地)

---

## NFR-25: macOS 限定

### 対応方針
- `WindowActivator` 内で `process.platform === 'darwin'` を確認、それ以外なら no-op + `console.warn`
- README に「macOS 限定」を明記
- `package.json` の `engines.vscode` は通常通り (OS 制約を package.json 側で表現する VS Code 標準機能はない)

### 実装
```typescript
async activateKiro(): Promise<void> {
  if (process.platform !== 'darwin') {
    console.warn('[WaitLess-IDE] osascript is only available on macOS');
    return;
  }
  // ... execFile 実行 ...
}
```

---

## NFR-26: 日本語固定

### 対応方針
- `package.json` の `displayName`, `description`, `contributes.commands.title`, `contributes.configuration.properties.*.description` をすべて日本語で記述
- i18n は導入しない (`package.nls.json` 等はない)
- ログメッセージは英語と日本語の混在を許容 (cycle-1〜3 と同じスタイル)

---

## NFR-27: 後方互換性 (Chrome 拡張への影響)

### Unit 1 単独では関与しない
NFR-27 は Unit 2 の責務 (Chrome 拡張への影響を出さない)。Unit 1 は新規拡張機能なので、cycle-1〜3 の機能を破壊する経路がない。

ただし **Q4=D 確定** により、Unit 2 で `tab_manager.js` を **完全無変更** で使えることが Unit 1 設計時に確認済 (実コード読了)。

---

## NFR-28: フォールバックパス

### 対応方針
- IPC が利用不可な状況 (Chrome 拡張未稼働 / ポート競合 / WebSocket エラー) でも、拡張機能は動作する
- フォールバック動作:
  - URL 取得: `aiWaitLessMode.urls` (Source B) を使う
  - ブラウザ起動: `vscode.env.openExternal(vscode.Uri.parse(url))` (OS デフォルトブラウザ)
  - Kiro 戻り: `osascript` のみ (動画一時停止はスキップ)
- ユーザーは IPC が動かなくても **基本的なブラウザ起動と Kiro 戻り** は体験できる
- IPC 失敗を **通知でユーザーに知らせない** (silent、UX 邪魔しない)

---

## NFR-29: シェルインジェクション対策

### 対応方針
- `child_process.exec` / `spawn(..., {shell:true})` は **使わない**
- `child_process.execFile` を使い、**コマンド名 + 引数配列** で渡す
- AppleScript の文字列リテラル内のダブルクォートはバックスラッシュエスケープ (`"Kiro"`)、ただし **静的な定数** なのでインジェクションリスクなし
- 将来 アプリ名を設定化する場合 (R-02) は、入力値のバリデーション (英数字 + 一部記号のみ許可) を追加すること (cycle-4 では設定化しないため対象外)

### 実装パターン (確定)
```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async activateKiro(): Promise<void> {
  if (process.platform !== 'darwin') return;
  try {
    await execFileAsync('osascript', [
      '-e',
      'tell application "Kiro" to activate'
    ]);
  } catch (e) {
    console.warn('[WaitLess-IDE] osascript activate failed', e);
  }
}
```

---

## まとめ: NFR 対応マトリクス

| NFR ID | 対応箇所 | 実装の鍵 |
|---|---|---|
| NFR-21 | tsconfig.json | strict: true |
| NFR-22 | package.json scripts | tsc のみ、開発モード起動 |
| NFR-23 | (適用なし) | テストフレームワーク導入しない |
| NFR-24 | IpcClient.start() | host: '127.0.0.1' |
| NFR-25 | WindowActivator | process.platform 判定 |
| NFR-26 | package.json | 日本語固定 |
| NFR-27 | (Unit 1 では影響なし) | Q4=D で確認済 |
| NFR-28 | UrlListMerger / BrowserLauncher | フォールバック実装 |
| NFR-29 | WindowActivator | execFile + 配列引数 |

---

## 関連ドキュメント

- ビジネスロジック: `business-logic-model.md`
- ビジネスルール: `business-rules.md`
- ドメインエンティティ: `domain-entities.md`
- 要件 NFR: `aidlc-docs/inception/requirements/requirements.md` §4
