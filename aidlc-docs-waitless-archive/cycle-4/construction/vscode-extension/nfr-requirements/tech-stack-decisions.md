# cycle-4 — Unit 1 (vscode-extension) — Tech Stack Decisions

最終更新: 2026-05-27

Unit 1 (`vscode-extension`) で使用する技術スタックの確定値とその選定根拠を記述する。

---

## 1. 言語 / ランタイム

| 項目 | 確定値 | 選定根拠 |
|---|---|---|
| **言語** | TypeScript 5.5.x (exact pin) | 要件 NFR-21、Q14=A 確定。VS Code 拡張機能の標準、フル strict で型安全性を最大化 |
| **target** | ES2020 | VS Code Extension Host (Node.js 20+) のサポート範囲、十分新しい機能を使える |
| **module** | Node16 | VS Code Extension API の慣行、CommonJS と ESM の混在を許容 |
| **strict** | true (フル strict) | Functional Design Q1=A 確定、`any` を排除 |
| **ランタイム** | Node.js 20+ (VS Code 同梱版) | VS Code 1.85+ 同梱の Node.js 18/20 を想定 |

---

## 2. ビルド

| 項目 | 確定値 | 選定根拠 |
|---|---|---|
| **ビルドツール** | TypeScript Compiler (`tsc`) | NFR-21-D-2、esbuild / webpack は使わない (シンプル性維持) |
| **package.json scripts** | `compile: "tsc -p ./"`、`watch: "tsc -watch -p ./"` | 標準的な VS Code 拡張機能のスクリプト |
| **outDir** | `out/` | デフォルト、`.gitignore` 対象 |

---

## 3. 依存ライブラリ

### 3.1 dependencies (ランタイム)

| パッケージ | 確定バージョン | 用途 | 選定根拠 |
|---|---|---|---|
| **`ws`** | `8.18.0` (exact pin) | WebSocket サーバー実装 | Q3=A 確定。業界標準、軽量、依存最小、メンテナンス活発 |

### 3.2 devDependencies (開発時のみ)

| パッケージ | 確定バージョン | 用途 |
|---|---|---|
| **`typescript`** | `5.5.4` (exact pin) | TypeScript コンパイラ |
| **`@types/vscode`** | `1.90.0` (exact pin) | VS Code Extension API の型定義 |
| **`@types/node`** | `20.14.0` (exact pin) | Node.js API の型定義 (child_process など) |
| **`@types/ws`** | `8.5.10` (exact pin) | `ws` ライブラリの型定義 |

> 注: バージョンは 2026-05 時点の最新安定版を想定。実際のインストール時に最新版を確認して固定する。

### 3.3 バージョンピン方針 (NFR Plan Q1=C)

- **すべて exact version (range 指定なし)**
- 例: `"typescript": "5.5.4"` (NOT `"^5.5.4"` or `"~5.5.4"`)
- 理由: cycle-4 は ローカル開発のみで、再現性を最大化する

### 3.4 依存ライブラリ追加禁止リスト

cycle-4 のスコープでは以下のライブラリは **追加しない** (シンプル性維持):

- ❌ `socket.io`, `engine.io` (WebSocket には `ws` で十分)
- ❌ `axios`, `node-fetch` (cycle-4 では HTTP を使わない)
- ❌ `express`, `koa`, `fastify` (HTTP サーバー不要)
- ❌ `lodash`, `ramda` (素の JS で十分)
- ❌ esbuild / webpack / parcel / rollup (NFR-21-D-2)
- ❌ `nodemon` (`tsc -watch` で十分)
- ❌ テストフレームワーク全般 (NFR-23 / NFR-21-T-1)

---

## 4. VS Code Extension API

### 4.1 使用する API

| API | 用途 | 関連コンポーネント |
|---|---|---|
| `vscode.workspace.getConfiguration('aiWaitLessMode')` | settings.json 読み込み | `SettingsReader` |
| `vscode.workspace.onDidChangeConfiguration` | 設定変更購読 | `SettingsReader` |
| `vscode.commands.registerCommand` | Command Palette コマンド登録 | `CommandRegistry` |
| `vscode.env.openExternal` | フォールバックブラウザ起動 | `BrowserLauncher` |
| `vscode.Uri.parse` | URL から Uri へ変換 | `BrowserLauncher` |
| `vscode.ExtensionContext.subscriptions` | dispose 対象の登録 | `ExtensionLifecycle` |

### 4.2 使用しない API

- ❌ `vscode.window.showInformationMessage` 等の通知 (NFR-21-U-1 silent)
- ❌ `vscode.StatusBarItem` (Q10=C 確定、Status Bar 表示なし)
- ❌ `vscode.Webview` (UI なし)
- ❌ `vscode.languages.*` (言語機能なし)

---

## 5. Node.js 標準モジュール

| モジュール | 用途 |
|---|---|
| `child_process` | `execFile` で osascript 実行 (`WindowActivator`) |
| `util` | `promisify(execFile)` |
| `crypto` | `randomUUID` で `requestId` 生成 |

---

## 6. package.json 確定構造

```jsonc
{
  "name": "waitless-ide",
  "displayName": "WaitLess IDE — AI 待ち時間の有効活用",
  "description": "Kiro IDE で AI 応答待ち中に外部ブラウザを開き、完了で自動的に Kiro に戻す",
  "version": "0.1.0",
  "publisher": "waitless",
  "engines": {
    "vscode": "^1.90.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "waitless.startWaiting",
        "title": "WaitLess: AI 待ち開始"
      },
      {
        "command": "waitless.endWaiting",
        "title": "WaitLess: AI 完了で Kiro に戻る"
      }
    ],
    "configuration": {
      "title": "AI WaitLess Mode",
      "properties": {
        "aiWaitLessMode.urls": {
          "type": "array",
          "items": {
            "type": "string",
            "format": "uri"
          },
          "default": [],
          "description": "Chrome 拡張未稼働時のフォールバック URL リスト (http:// または https:// のみ)"
        },
        "aiWaitLessMode.enabled": {
          "type": "boolean",
          "default": true,
          "description": "AI WaitLess Mode を有効化する"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "dependencies": {
    "ws": "8.18.0"
  },
  "devDependencies": {
    "@types/node": "20.14.0",
    "@types/vscode": "1.90.0",
    "@types/ws": "8.5.10",
    "typescript": "5.5.4"
  }
}
```

---

## 7. tsconfig.json 確定構造

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
  "exclude": ["node_modules", "out", "templates"]
}
```

---

## 8. .gitignore / .vscodeignore

### .gitignore
```
node_modules/
out/
*.vsix
.vscode-test/
```

### .vscodeignore (将来 VSIX ビルド時用)
```
.vscode/**
.vscode-test/**
src/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/.eslintrc.json
**/*.map
**/*.ts
node_modules/**
!node_modules/ws/**
```

---

## 9. 選定根拠サマリ

cycle-4 Unit 1 の Tech Stack は **「最小の依存で、フル型安全な拡張機能」** を実現する選択。

- **TypeScript フル strict** → 型不整合をビルド時に検出、cycle-4 の不確実性 (Hook 仕様 / IPC タイミング) を実装段階で潰す
- **`ws` 一本** → WebSocket は素朴に実装でき、複雑な機能 (rooms / namespaces) 不要
- **tsc のみ** → cycle-1〜3 と同じ「無バンドル」思想を可能な限り踏襲 (型のためだけに TS を入れる)
- **exact version pin** → 再現性最大化、cycle-4 完了後も将来サイクルで同じ環境を作れる

---

## 10. 関連ドキュメント

- NFR Requirements: `nfr-requirements.md`
- Functional Design NFR Inline: `aidlc-docs/construction/vscode-extension/functional-design/nfr-inline.md`
- Application Design Tech Stack: `aidlc-docs/inception/application-design/unit-of-work.md` §2.6
