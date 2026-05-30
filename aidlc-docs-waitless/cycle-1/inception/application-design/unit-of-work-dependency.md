# Unit of Work Dependency — WaitLess

**プロジェクト**: WaitLess
**フェーズ**: INCEPTION - Units Generation
**作成日**: 2026-05-26

---

## 1. ユニット間依存マトリクス

| Caller \ Callee | U1 (waitless-extension) |
|-----------------|:-----------------------:|
| U1 (waitless-extension) | — |

WaitLess は **単一ユニット構成** (Q1=A) のため、ユニット間依存は存在しない。マトリクスは自明にゼロ。

---

## 2. 外部依存

| 依存先 | 種類 | 用途 |
|--------|------|------|
| Chrome ブラウザ (Manifest V3 対応版) | プラットフォーム | 拡張機能のホスト環境 |
| Chrome 拡張 API (`chrome.tabs.*`, `chrome.runtime.*`, `chrome.storage.*`, `chrome.scripting.*`, `chrome.action`) | プラットフォーム API | コア機能 |
| Claude.ai (`https://claude.ai/*`) | 外部サービス (DOM のみ) | Content Script 注入対象。HTTP/API 呼び出しは行わない |
| 娯楽サイト (ユーザー登録) | 外部サービス (DOM のみ) | タブ切替先、PlaybackTrigger 動的注入対象 |

外部 HTTP API への呼び出しはなし (NFR-02 ローカル完結)。

---

## 3. ユニット内のコンポーネント間依存

ユニット内については `aidlc-docs/inception/application-design/component-dependency.md` を参照。

要点:
- 9 コンポーネントが 5 レイヤー (UI / Adapter / Orchestration / Domain / Platform) に配置
- 上位レイヤー → 下位レイヤー の単方向のみ
- 上位への通知は `chrome.runtime.sendMessage` または `chrome.storage.onChanged` 経由
- **循環依存なし**

---

## 4. 並列開発の余地

単一ユニットのため、開発は逐次的に行う。ただしコンポーネントレベルでは以下の並列化が可能 (1人作業でも複数ファイルを行き来できる意味で):

| 同時に進められる | 理由 |
|------------------|------|
| `manifest.json` の骨格作成 + アイコン placeholder | 互いに独立 |
| `sw/runtime_state.js` + `sw/settings_repository.js` | 互いに依存しない (どちらも Chrome API のみ参照) |
| `content/claude_site_adapter.js` の DOM 監視部分 + `options/options.js` の UI 部分 | 別ファイル、別ページ |

依存関係上 **先に必要** なもの:
- `manifest.json` (拡張機能のロードに必須)
- `sw/message_router.js` (sendMessage 受信窓口、他コンポーネントから参照されるエントリ)
- `service_worker.js` (sw/* を統合する SW エントリ)

---

## 5. クリティカルパス

```
manifest.json          (拡張機能ロードの前提)
  ↓
service_worker.js      (SW エントリ)
  ↓
sw/message_router.js   (各種メッセージ受信)
  ↓
sw/wait_orchestrator.js + sw/tab_manager.js + sw/settings_repository.js
  ↓
content/claude_site_adapter.js  (Content Script、別並列で options も同時進行可)
options/options.html + options.js
  ↓
content/playback_trigger.js     (動的注入なので最後でOK)
  ↓
assets/icons/                   (placeholder でスタートし、最後に差し替え可)
```

実装順序の推奨は Functional Design + Code Generation Plan で詳細化する。

---

## 6. リスクと依存に関する留意点

| 項目 | 内容 | 緩和策 |
|------|------|--------|
| Claude.ai DOM の変更 | 外部サイトの UI 変化で ClaudeSiteAdapter のセレクタが壊れる可能性 | ClaudeSiteAdapter にロジックを閉じ込める / 壊れたら修正運用 / Functional Design でセレクタを最小限に |
| Chrome API の挙動差 | Chrome バージョンによる Manifest V3 API の違い | ターゲットバージョンを Chrome 最新安定版に揃える、特殊機能は使わない |
| Service Worker のアイドルアンロード | Manifest V3 特有、メモリ状態が消える | RuntimeState を session ストレージで復元、サービス層で冪等性を確保 |
| ブラウザのオートプレイポリシー | 動画自動再生が効かない場合がある | best-effort、失敗を黙って許容 (要件 §10.3) |
| 単一ユニットゆえの単一障害点 | 1 ユニットに集約 = 不具合の影響範囲も全機能 | コンポーネント設計でレイヤー分離・循環なしを保ち、影響を局所化 |

---

## 7. 結論

- ユニット間依存: **なし** (単一ユニット)
- 外部送信: **なし** (NFR-02)
- 単一ユニット内のコンポーネント依存: 単方向、循環なし、レイヤー分離済 (Application Design 参照)
- 開発順序: `manifest.json` → SW エントリ → Domain Services → Content / Options → 動的注入 → アイコン (詳細は Code Generation Plan で確定)
