# cycle-4 — Unit Test Instructions

最終更新: 2026-05-27

## NFR-23 による方針

cycle-4 では cycle-1〜3 と同じく、**自動ユニットテストフレームワークは導入しない**。

理由:
- 拡張機能のテストは VS Code Extension Host / Chrome Service Worker など、それぞれ専用のテストランナーが必要で、cycle-4 のスコープに対してオーバースペック
- cycle-1〜3 と同じスタイルを維持し、シンプルさを優先

---

## 代替手段: 純粋関数の手動チェック

実装した純粋関数 (副作用なし) の挙動は手動でチェック可能。例:

### Unit 1: `UrlSelector.select()` (`vscode-extension/src/extension.ts`)

`Node.js` の REPL で以下を確認:

```bash
cd vscode-extension
node -e "
  // UrlSelector の概要だけ手動再現
  const list = [
    { url: 'https://a.com', priority: 3 },
    { url: 'https://b.com', priority: 1 },
    { url: 'https://c.com', priority: 2 }
  ];
  const sorted = [...list].sort((a, b) => a.priority - b.priority);
  console.log('selected:', sorted[0]); // { url: 'https://b.com', priority: 1 }
"
```

### Unit 1: `UrlListMerger.merge()` の Source B 正規化

```bash
node -e "
  const urls = ['https://x.com', 'invalid', 'https://y.com'];
  const isValidUrl = (s) => { try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
  const result = urls.filter(isValidUrl).map((url, i) => ({ url, priority: i + 1 }));
  console.log(result);
  // [ { url: 'https://x.com', priority: 1 }, { url: 'https://y.com', priority: 2 } ]
"
```

### Unit 2: `_extractDomain()` / `_mapOpenedToPass()` (`extension/sw/ide_bridge.js`)

```bash
node -e "
  const extract = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\\./, ''); } catch { return ''; } };
  console.log(extract('https://www.youtube.com/watch?v=xxx')); // youtube.com
  console.log(extract('https://x.com/home'));                  // x.com
  console.log(extract('not-a-url'));                            // ''

  const mapPass = (opened) => ({ existing: 1, navigated: 2, new: 3 }[opened] ?? 3);
  console.log(mapPass('existing'));  // 1
  console.log(mapPass('navigated')); // 2
  console.log(mapPass('new'));       // 3
  console.log(mapPass('unknown'));   // 3
"
```

---

## 静的検証

cycle-4 のコード生成段階で以下を実施済 (Code Generation Summary を参照):

- ✅ Unit 1: `npm run compile` (`tsc -p ./`) でフル strict TypeScript コンパイル成功
- ✅ Unit 1: `getDiagnostics` で No issues
- ✅ Unit 2: `getDiagnostics` で No issues (改修 5 ファイル + 新規 ide_bridge.js)
- ✅ Unit 3: `getDiagnostics` で No issues (4 JSON ファイル)
- ✅ NFR-27 (後方互換性) を `git status` で実証 (cycle-1〜3 の sw/* 4 + content/* + reader/* 完全無変更)

---

## ユニットテスト相当のチェックリスト (手動)

| 項目 | 検証方法 | 期待結果 |
|---|---|---|
| TypeScript フル strict 通過 | `npm run compile` | エラーなし |
| `vscode-extension/src/extension.ts` の `any` 不使用 | `grep -n "any" src/extension.ts` | (キーワードコメント以外で) ヒットなし |
| Chrome 拡張 manifest が v0.4.0 | `cat extension/manifest.json` | `"version": "0.4.0"` |
| Chrome 拡張 既存ファイル無変更 | `git diff extension/sw/{message_router,wait_orchestrator,tab_manager,settings_repository,runtime_state}.js` | 出力なし |
| Hook テンプレート 4 ファイル parse 可能 | `cat *.json | python3 -m json.tool` | エラーなし |

---

## 関連ドキュメント

- ビルド手順: `build-instructions.md`
- 統合 (E2E) テスト手順: `integration-test-instructions.md`
- Build & Test サマリ: `build-and-test-summary.md`
