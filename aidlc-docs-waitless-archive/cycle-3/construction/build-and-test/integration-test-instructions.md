# Integration Test Instructions — WaitLess cycle-3

最終更新: 2026-05-27

cycle-3 で実施する手動 E2E テスト (Integration Test) のシナリオ集。

cycle-1 で確定した 13 シナリオ (T-01〜T-13) と cycle-2 で追加した 7 シナリオ (T-14〜T-20) は **すべてリグレッション対象** として継続実施し、cycle-3 で追加するのは **T-21〜T-28 の 8 シナリオ**。

---

## 0. テスト環境

- **OS**: macOS / Linux / Windows
- **ブラウザ**: Chrome (Manifest V3 対応版、最新安定版を推奨)
- **拡張機能のロード状態**: cycle-3 のコード (version 0.3.0) を Unpacked ロード済み
- **Claude.ai のアカウント**: 必要 (本拡張は認証は扱わない)

### Storage クリア手順

```javascript
// Service Worker DevTools のコンソールで実行
await chrome.storage.local.clear();
await chrome.storage.session.clear();
```

---

## 1. cycle-1 / cycle-2 リグレッションシナリオ (T-01〜T-20、必須)

cycle-3 ではコアロジック (sw/message_router, wait_orchestrator, tab_manager, runtime_state, content/*, service_worker) を変更していないため、cycle-1/2 シナリオは **すべてそのままパスする** ことが期待される。詳細は archive 参照:

- T-01〜T-13: cycle-1 archive `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/integration-test-instructions.md`
- T-14〜T-20: cycle-2 archive `aidlc-docs-waitless-archive/cycle-2/construction/build-and-test/integration-test-instructions.md`

cycle-3 リリース前に **最低 1 回実施** すること。

---

## 2. cycle-3 で追加するシナリオ (T-21〜T-28)

### T-21: Reader Page の単独表示

**目的**: 拡張機能内蔵の読書ページが正しく表示される (FR-31, FR-32)

**準備**:
1. Storage をクリア
2. cycle-3 拡張機能をリロード

**手順**:
1. Options Page を開き、空状態案内の「📖 読書 (内蔵)」項目に表示されている URL をコピー
2. 別のタブのアドレスバーに貼り付けて開く

**検証**:
- [ ] タイトル「待つことについて」(または差し替え後のタイトル) が表示される
- [ ] 本文がダーク背景 (`#1a1a1a`) に灰色テキスト (`#888`) で表示される
- [ ] 段落が `<p>` 要素で表示され、段落字下げ (1em) されている
- [ ] フッタに「サンプルテキスト」または底本情報が表示される
- [ ] DevTools コンソールに critical/error レベルのログがない
- [ ] レスポンシブ確認: 480px 以下のサイズで文字が 16px に縮小される

---

### T-22: Reader Page を Site として登録 (FR-37)

**目的**: 既存の Site 登録モデルで読書ページを登録できる (BR-01/02 改訂)

**準備**: Storage クリア済 (T-21 後)

**手順**:
1. Options Page で空状態案内に表示されている **拡張機能 ID** を「ドメイン」欄にコピペ
2. 表示されている URL を「URL」欄にコピペ
3. 「追加」ボタンをクリック

**検証**:
- [ ] バリデーションエラーが出ない
- [ ] 「追加しました」というメッセージが表示される
- [ ] 登録済みリストに 1 件表示される (priority=1、ドメイン=拡張機能 ID、URL=reader.html)
- [ ] `chrome.storage.local` に保存されている (Service Worker DevTools で `chrome.storage.local.get('sites')` 確認)

---

### T-23: クリックでの青色化 (一方向、新規) (FR-33)

**目的**: 灰色テキストをクリックすると、ページ先頭からクリック位置までが青色化する

**準備**: T-21 で Reader Page を開いた状態、または T-22 後に Claude.ai で待ちを発生させて Reader Page を開く

**手順**:
1. ページの 3 段落目あたりの中央のテキストをクリック

**検証**:
- [ ] クリックされた位置までが **青色** (`#3b82f6`) に変化する
- [ ] それ以降の段落は **灰色のまま**
- [ ] DevTools コンソールに `chrome.storage.local.get('reader_state')` で `read_offset` がクリック位置の文字オフセット相当で保存されている
- [ ] `scroll_y` も保存されている (現在のスクロール位置)

---

### T-24: 双方向クリック (戻し動作) (BR-31, FR-33)

**目的**: 既読範囲よりも前をクリックすると、その位置まで戻る

**準備**: T-23 で 3 段落目までを青色化した状態

**手順**:
1. 1 段落目の中央のテキストをクリック

**検証**:
- [ ] 1 段落目のクリック位置までが青色、それ以降 (元々青だった部分も含む) は **灰色に戻る** (絶対上書き、双方向)
- [ ] Storage の `read_offset` が新しい (より小さい) 値に更新されている

---

### T-25: AI 完了時のスクロール位置保存 (FR-35, BR-34)

**目的**: AI 完了で Reader Page から離脱する瞬間に、現在のスクロール位置が保存される

**準備**: T-22 で Reader Page を Site 登録、Storage の `reader_state` を初期化

**手順**:
1. Claude.ai で重い質問を送信 → 待ち発生 → Reader Page タブが開く
2. Reader Page でスクロールを途中まで進める (例: 50% 程度)
3. テキストはクリックしない (click 位置が変わらないことを検証するため)
4. Claude.ai の応答完了まで待つ → AI タブに自動復帰

**検証**:
- [ ] AI タブに復帰する
- [ ] DevTools コンソールで `chrome.storage.local.get('reader_state')` を実行
- [ ] `scroll_y` が 0 ではなく、離脱前のスクロール位置 (例: 数百〜数千 px) が保存されている
- [ ] `read_offset` は変わっていない (Step 3 で click していないため)

---

### T-26: 起動時の状態復元 (FR-36, BR-33)

**目的**: 次のサイクルで Reader Page が新規タブで開いたとき、保存されている状態を復元する

**準備**: T-23 でクリック位置を 3 段落目あたりに設定し、T-25 で離脱時のスクロール位置を保存した状態

**手順**:
1. (前提) 前述の `reader_state` が `chrome.storage.local` に保存されている状態
2. Reader Page タブを **手動で閉じる**
3. Claude.ai で再度重い質問を送信 → 待ち発生 → 新規 Reader Page タブが開く

**検証**:
- [ ] Reader Page が開いた瞬間、3 段落目までが **青色** で表示されている (青色化の復元)
- [ ] スクロール位置が前回の離脱時点と同じ (or 近い) 位置に復元されている
- [ ] レイアウトのチラつき (青色化前にスクロール → 青色化でレイアウト変化 → 再スクロール) が起こらない (BR-33: 順序が正しい)

---

### T-27: 既存 Reader タブのアクティブ化 (URL 完全一致、Pass 1)

**目的**: 既に Reader Page タブが開いている状態で待ち発生 → そのタブをアクティブ化のみ (新規ナビゲーションなし、状態維持)

**準備**: T-26 後、Reader Page タブが開いたまま

**手順**:
1. AI タブにフォーカスを戻し、Claude.ai で次の質問を送信
2. 待ち発生 → 既存 Reader Page タブがアクティブ化される

**検証**:
- [ ] **新規タブが作成されない** (既存タブのアクティブ化のみ、Pass 1)
- [ ] Reader Page の状態 (青色範囲、スクロール位置) が維持されている
- [ ] DevTools コンソールに `pageshow` などのログ (確認用に追加していれば) が出る、新規 init() は走らない

---

### T-28: 後方互換性 — cycle-2 までの既存データ (NFR-07)

**目的**: cycle-2 までに登録済みのデータ (sites, threshold_sec) が cycle-3 ロード後もマイグレーションなしで動作

**準備**:
1. (オプション) 以下を Service Worker DevTools のコンソールで実行して cycle-2 形式のデータを直接書き込む:

```javascript
await chrome.storage.local.clear();
await chrome.storage.local.set({
  sites: [
    { domain: "youtube.com", url: "https://www.youtube.com/feed/subscriptions", priority: 1 },
    { domain: "x.com", url: "https://x.com/home", priority: 2 }
  ],
  threshold_sec: 5
});
```

2. cycle-3 拡張機能をリロード

**検証**:
- [ ] Options Page を開く → 上記 2 件のサイトが priority 順に表示される
- [ ] しきい値が 5 秒で表示される
- [ ] 空状態案内は表示されない (sites が存在するため)
- [ ] Claude.ai で重い質問を送信 → 切替・復帰が cycle-2 と同じく正常に動作
- [ ] Service Worker のコンソールに REGEX/protocol 拡張に関するエラーなし

---

## 3. cycle-3 の UI / 視認性検証 (T-29〜T-30)

### T-29: 配色の WCAG コントラスト確認 (NFR-10)

**目的**: 灰色 / 青色テキストが背景に対して十分なコントラストを持つ

**手順**: ブラウザ DevTools の Lighthouse / axe DevTools 等で Reader Page のコントラスト確認

**検証**:
- [ ] 灰色テキスト (`#888` on `#1a1a1a`): コントラスト比 約 4.7:1 (WCAG AA pass)
- [ ] 青色テキスト (`#3b82f6` on `#1a1a1a`): コントラスト比 約 5.6:1 (WCAG AA pass)

### T-30: novel.txt の差し替え動作確認

**目的**: ユーザーが `novel.txt` を任意のテキストに差し替えても正常に動作する

**手順**:
1. `extension/reader/novel.txt` を任意の UTF-8 テキスト (青空文庫の「羅生門」全文等) に上書き保存
2. 拡張機能をリロード
3. Reader Page を開く

**検証**:
- [ ] 新しいテキストが表示される
- [ ] 既存の `reader_state` の `read_offset` が新テキストの長さを超えていてもクランプされて正常動作 (BR-37)
- [ ] クリック / 永続化 / 復元が新テキストでも問題なく動作

---

## 4. テスト結果記録

```markdown
| シナリオ | 実施日 | 結果 | 備考 |
|---------|-------|------|-----|
| T-01〜T-13 | YYYY-MM-DD | ✅ Pass / ❌ Fail | (cycle-1 リグレッション) |
| T-14〜T-20 | YYYY-MM-DD | ✅ Pass / ❌ Fail | (cycle-2 リグレッション) |
| T-21 (Reader 単独表示) | | | |
| T-22 (Site 登録) | | | |
| T-23 (青色化、一方向) | | | |
| T-24 (双方向クリック) | | | |
| T-25 (離脱時 scrollY 保存) | | | |
| T-26 (起動時状態復元) | | | |
| T-27 (既存タブアクティブ化) | | | |
| T-28 (後方互換) | | | |
| T-29 (配色コントラスト) | | | |
| T-30 (novel.txt 差し替え) | | | |
```

---

## 5. 関連ドキュメント

- ビルド手順: `aidlc-docs/construction/build-and-test/build-instructions.md`
- 要件: `aidlc-docs/inception/requirements/requirements.md`
- cycle-1 シナリオ: `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/integration-test-instructions.md`
- cycle-2 シナリオ: `aidlc-docs-waitless-archive/cycle-2/construction/build-and-test/integration-test-instructions.md`
