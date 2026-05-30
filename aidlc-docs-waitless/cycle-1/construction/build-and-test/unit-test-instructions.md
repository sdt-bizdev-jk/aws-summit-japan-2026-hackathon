# Unit Test Instructions — WaitLess

**プロジェクト**: WaitLess (Chrome 拡張機能 / Manifest V3)
**フェーズ**: CONSTRUCTION - Build and Test
**作成日**: 2026-05-26

---

## 1. 自動ユニットテストの方針

WaitLess は以下の方針により、**自動ユニットテストフレームワークを導入していない**:

| 方針 | 由来 |
|------|------|
| ビルド不要 (素のJS、依存ゼロ) | NFR-04 |
| Property-Based Testing 不適用 | Q13=C |
| ハッカソン MVP 規模 | Q8=B |
| 主要動線は手動 E2E で検証 | Functional Design §Testing Strategy |

そのため、本ドキュメントは「自動ユニットテストの実行方法」ではなく、**コードレベルの品質確保アプローチ** と **必要時の最小スモーク検証スクリプト** を案内する。

---

## 2. コードレベルの品質確保

### 2.1 単一責務の徹底
各モジュールは Application Design / Functional Design に従い、責務を単一化:

| モジュール | 責務 |
|-----------|------|
| settings_repository.js | ストレージ CRUD + バリデーション のみ |
| runtime_state.js | 実行時状態の保持 のみ |
| tab_manager.js | chrome.tabs.* のみ |
| wait_orchestrator.js | 体験フロー オーケストレーション のみ |
| message_router.js | sendMessage ディスパッチ のみ |
| claude_site_adapter.js | Claude.ai DOM 監視 のみ |
| playback_trigger.js | 再生試行 のみ |
| options.js | UI と OptionsAPI のみ |

### 2.2 不変条件の明示
各モジュールのコメントに、業務ルール (BR-01〜22) との対応を明記。Functional Design の `business-rules.md` を参照しながらレビュー可能。

### 2.3 サイドエフェクトの境界
- 外部 HTTP 通信: 一切なし (NFR-02)
- chrome.storage への書き込み: settings_repository.js / runtime_state.js のみ
- chrome.tabs への操作: tab_manager.js のみ
- DOM 変更: claude_site_adapter.js / playback_trigger.js のみ

これにより、各モジュールは独立してレビュー/トラブルシュート可能。

---

## 3. 最小スモーク検証 (任意、Node.js での試行)

設定 CRUD のロジック (`settings_repository.js`) は Chrome API への依存を mock すれば Node.js でも単体検証できる。必要であれば以下の **最小スモークスクリプト** を任意の場所に作って実行する (本リポジトリには標準では含めない方針)。

### 3.1 例: validateDomain / validateUrl の検証

```bash
# プロジェクトルートで実行
cat <<'EOF' > /tmp/waitless-smoke.mjs
// settings_repository.js の純粋関数だけを抜き出して検証する想定
const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function normalizeDomain(input) {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase().replace(/^www\./, '');
}
function validateDomain(input) {
  const n = normalizeDomain(input);
  if (n.length === 0 || n.length > 255 || !DOMAIN_REGEX.test(n)) return { ok: false };
  return { ok: true, value: n };
}
function validateUrl(input) {
  try {
    const u = new URL((input || '').trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false };
    return { ok: true };
  } catch { return { ok: false }; }
}

const cases = [
  { fn: validateDomain, in: 'youtube.com', expect: true },
  { fn: validateDomain, in: 'WWW.YouTube.com', expect: true },
  { fn: validateDomain, in: '', expect: false },
  { fn: validateDomain, in: 'no-tld', expect: false },
  { fn: validateUrl, in: 'https://youtu.be/x', expect: true },
  { fn: validateUrl, in: 'youtube.com', expect: false },
  { fn: validateUrl, in: 'ftp://x.com', expect: false },
];
let pass = 0, fail = 0;
for (const c of cases) {
  const got = c.fn(c.in).ok;
  if (got === c.expect) pass++;
  else { fail++; console.log('FAIL:', c.fn.name, JSON.stringify(c.in), 'expected', c.expect, 'got', got); }
}
console.log(`Passed: ${pass}, Failed: ${fail}`);
EOF
node /tmp/waitless-smoke.mjs
rm /tmp/waitless-smoke.mjs
```

期待される出力: `Passed: 7, Failed: 0`

> 注: このスクリプトは検証の参考。プロジェクトに含めると NFR-04 (ビルド不要) と整合しないため、必要時のみ作成する。

---

## 4. レビュー観点 (人手の単体検証)

各モジュールをレビューする際の確認ポイント:

### settings_repository.js
- [ ] BR-01 (domain 正規表現) が validateDomain で実装されているか
- [ ] BR-02 (URL パース + http/https) が validateUrl で実装されているか
- [ ] BR-03 (重複禁止) が addSite/updateSite で実装されているか
- [ ] BR-04 (1〜60 整数) が validateThreshold で実装されているか
- [ ] BR-05 (priority 連番化) が addSite/deleteSite/reorderSites/sanitizeSites で実装されているか
- [ ] BR-20 (デフォルト値補完) が getSettings で実装されているか

### tab_manager.js
- [ ] BR-07 (ドメイン一致) が extractDomain + 比較で実装されているか
- [ ] BR-08 (現在ウィンドウのみ) が getLastFocused で実装されているか
- [ ] BR-09 (新規作成: priority 1位) が findOrOpenPlaySite 末尾で実装されているか
- [ ] BR-15 (作成失敗の許容) が try/catch で実装されているか

### wait_orchestrator.js
- [ ] BR-12 (重複抑制) が isWaiting() で実装されているか
- [ ] BR-13 (完了ガード) が isWaiting() で実装されているか
- [ ] BR-14 (戻り先フォールバック) が tabExists + findClaudeTab で実装されているか
- [ ] BR-22 (isWaiting を必ず false に戻す) が onCompletionDetected 末尾で実装されているか

### message_router.js
- [ ] 8 タイプのメッセージがすべてディスパッチされているか
- [ ] 非同期応答 (`return true`) が必要なところで返されているか
- [ ] BR-18 (不明タイプは no-op) が default で実装されているか

### claude_site_adapter.js
- [ ] ステートマシン (IDLE / STREAMING / WAITING) が正しく遷移するか
- [ ] N秒タイマーがしきい値変更で次サイクルに反映されるか (BR-19)
- [ ] 短い応答 (N秒未満) で WAIT_DETECTED が送信されないか
- [ ] 完了検知時に COMPLETION_DETECTED が送信されるか

### options.js
- [ ] 空状態案内 (US-06) が sites.length === 0 で表示されるか
- [ ] インライン編集の表示モード/編集モード切替が機能するか
- [ ] バリデーションエラーが UI に表示されるか
- [ ] 削除確認ダイアログが表示されるか

---

## 5. 単体テスト結果の記録

本サイクルでは自動テストを実行しないため、テスト結果記録は **コードレビューチェックリスト** で代替する。完了後 `build-and-test-summary.md` に下記を記載する:

| カテゴリ | 結果 |
|---------|------|
| 自動ユニットテスト | N/A (NFR-04, Q13=C 整合) |
| コードレビュー (BR 対応確認) | 自己レビュー: ✅ 全 BR 実装確認 (`code-generation-summary.md` §4) |
| diagnostics (静的解析) | ✅ getDiagnostics で No diagnostics found |
| manifest.json 構文 | ✅ node でパース成功 |
