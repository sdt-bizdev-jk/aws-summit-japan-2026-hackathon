# Integration Test Instructions — WaitLess cycle-2

最終更新: 2026-05-27

cycle-2 で実施する手動 E2E テスト (Integration Test) のシナリオ集。

cycle-1 で確定した 13 シナリオ (T-01〜T-13) は **すべてリグレッション対象** として継続実施し、cycle-2 で追加するのは **T-14〜T-17 の 4 シナリオ**。

cycle-1 シナリオの詳細は `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/integration-test-instructions.md` を参照してください。

---

## 0. テスト環境

- **OS**: macOS / Linux / Windows いずれも
- **ブラウザ**: Chrome (Manifest V3 対応版、最新安定版を推奨)
- **拡張機能のロード状態**: cycle-2 のコード (version 0.2.0) を Unpacked ロード済み
- **Claude.ai のアカウント**: 必要 (本拡張機能は認証は扱わない)
- **検証用の登録サイトデータ**: テスト前にクリーン状態 (`chrome.storage.local` をクリア) または cycle-1 で登録済データ (T-13 のみ)

### Storage クリア手順

```javascript
// Service Worker DevTools のコンソールで実行
await chrome.storage.local.clear();
await chrome.storage.session.clear();
```

---

## 1. cycle-1 リグレッションシナリオ (T-01〜T-13、必須)

cycle-2 ではコード側ロジックを変更していないため、cycle-1 の全シナリオが **そのままパスする** ことが期待される。詳細は cycle-1 archive を参照:

- T-01: Unpacked ロード成功
- T-02: Options Page の空状態表示
- T-03: サイト登録 → Storage 永続化
- T-04: しきい値変更 → 即時反映
- T-05: Claude.ai プロンプト送信 → N秒経過で娯楽タブ自動切替
- T-06: Claude.ai 完了 → AI タブ自動復帰
- T-07: 既存タブ (URL 完全一致) のヒット → 続きから再生
- T-08: 既存タブ (ドメイン一致) のヒット → 登録 URL に navigate
- T-09: 新規タブ作成 (該当タブなし)
- T-10: 完了時の動画一時停止 → 次サイクルで続きから再生
- T-11: SW 再起動への耐性 (session ストレージで状態復元)
- T-12: 拡張機能更新時の旧 Content Script ガード
- T-13: バリデーション (重複ドメイン、不正 URL 等)

これらは cycle-2 リリース前に **最低 1 回実施** すること。

---

## 2. cycle-2 で追加するシナリオ (T-14〜T-17)

### T-14: ゲームサイトでの切替動作 (FR-21, FR-24)

**目的**: 動画以外のサイト (Web ゲーム) でも切替が正常に動作し、PlaybackTrigger が誤動作しない。

**準備**:
1. Storage をクリア
2. Options Page を開き、以下を登録:
   - ドメイン: `games.greggman.com`
   - URL: `https://games.greggman.com/game/htmlbird/`
3. しきい値を 3 秒に設定

**手順**:
1. Claude.ai を開く (まだ Web ゲームタブは開いていない状態)
2. 重い質問 (例: 「素粒子物理学の標準模型を 5000 字で解説して」) を送信
3. ストリーミング開始から 3 秒以上 経過するのを待つ
4. **検証**: 自動でゲームタブが新規作成され、`https://games.greggman.com/game/htmlbird/` が開く
5. ゲームタブの DevTools コンソールを確認
6. **検証**: `[WaitLess]` のエラーログがない (`<video>` がないため PlaybackTrigger は黙って終了する想定)
7. Claude.ai の応答完了まで待つ
8. **検証**: 自動で Claude.ai タブに戻る
9. Service Worker DevTools のコンソールを確認
10. **検証**: critical / error レベルのログがない

**Pass 条件**: 切替成功、ゲームタブのコンソールにエラーなし、SW のコンソールに critical/error なし。

---

### T-15: EC サイト (Amazon) での切替動作 (FR-21, FR-24)

**目的**: EC サイトでも切替が正常に動作する。

**準備**:
1. Storage をクリア
2. Options Page で以下を登録:
   - ドメイン: `amazon.co.jp`
   - URL: `https://www.amazon.co.jp/gp/your-account/order-history` (またはホームページ)
3. しきい値を 3 秒に設定

**手順**: T-14 と同様に Claude.ai で重い質問を送信し切替・復帰を確認。

**Pass 条件**:
- 切替成功 (Amazon タブが開く)
- 復帰成功 (Claude タブに戻る)
- Amazon タブ側で広告動画が再生される可能性はあり (PlaybackTrigger は最初の `<video>` を試みる、cycle-1 から既知)
- それ以外で critical/error レベルのコンソールエラーなし

---

### T-16: SNS サイト (X.com) での切替動作 (FR-21, FR-24)

**目的**: SNS サイトでも切替が正常に動作する。

**準備**:
1. Storage をクリア
2. Options Page で以下を登録:
   - ドメイン: `x.com`
   - URL: `https://x.com/home`
3. しきい値を 3 秒に設定
4. 事前に X.com にログイン済みの状態

**手順**: T-14 と同様。

**Pass 条件**:
- 切替成功 (X.com の home が開く、またはアクティブ化される)
- 復帰成功
- 自動再生が動かない動画フィードでも、PlaybackTrigger のコンソールエラーなし

---

### T-17: 後方互換性 — cycle-1 登録済データの動作確認 (NFR-07)

**目的**: cycle-1 でユーザーが登録したデータが、cycle-2 ロード後もマイグレーションなしで動作する。

**準備**:
1. **(オプション、データを準備)** cycle-1 を別途ロードした履歴がある Chrome プロファイル、または以下を Service Worker DevTools コンソールで実行して cycle-1 形式データを直接書き込む:

```javascript
await chrome.storage.local.set({
  sites: [
    { domain: "youtube.com", url: "https://www.youtube.com/feed/subscriptions", priority: 1 },
    { domain: "x.com", url: "https://x.com/home", priority: 2 }
  ],
  threshold_sec: 5
});
```

2. cycle-2 の拡張機能を Unpacked ロード (または既存をリロード)

**手順**:
1. Options Page を開く
2. **検証**: 上記 2 件のサイトが priority 順に表示される
3. **検証**: しきい値が 5 秒で表示される
4. Claude.ai で重い質問を送信
5. **検証**: 切替・復帰が正常に動作

**Pass 条件**:
- データ表示が正常 (マイグレーション処理なしで読める)
- Service Worker のコンソールにマイグレーションエラーなし
- 切替・復帰の動作が cycle-1 と同じ

---

## 3. UI / メッセージング検証 (T-18〜T-20)

### T-18: Options Page 空状態案内の確認 (FR-22)

**準備**: Storage クリア → Options Page を開く

**検証項目**:
- [ ] 「まだ登録がありません。」のテキストが表示される
- [ ] 「こんな使い方ができます:」の見出しが表示される
- [ ] 5 種類の用途例 (動画 / ゲーム / EC ショッピング / SNS チャット / ストレッチ・瞑想) が箇条書き表示される
- [ ] 各用途のサンプル ドメインと URL が `<code>` 形式で表示される
- [ ] 「※ 上記は一例です。」の補足が表示される
- [ ] レイアウトが崩れない (狭い画面 / 標準デスクトップ画面で確認)

### T-19: アイコンのツールチップ表示 (FR-25)

**手順**: ブラウザ右上の WaitLess アイコンにマウスホバー

**検証項目**:
- [ ] ツールチップが `WaitLess — 待ち時間を有効活用 (クリックで設定)` と表示される
- [ ] 「YouTube」のような特定サイト名が含まれていない

### T-20: README の更新確認 (FR-23)

**手順**: `extension/README.md` を開く

**検証項目**:
- [ ] 冒頭に「動画・ゲーム・SNS・EC ショッピング・ストレッチ瞑想など」と幅が示されている
- [ ] 「対応する遷移先パターン」セクションがあり、5 種類のカテゴリ + サンプル URL の表が記載されている
- [ ] アンチスコープに「カテゴリ (タイプ) 別の振る舞い分岐なし」が明記されている

---

## 4. テスト結果記録

各シナリオの実施結果を以下のテンプレートで記録:

```markdown
| シナリオ | 実施日 | 結果 | 備考 |
|---------|-------|------|-----|
| T-01〜T-13 | YYYY-MM-DD | ✅ Pass / ❌ Fail | (cycle-1 リグレッション) |
| T-14 (ゲーム) | | | |
| T-15 (EC) | | | |
| T-16 (SNS) | | | |
| T-17 (後方互換) | | | |
| T-18 (空状態) | | | |
| T-19 (ツールチップ) | | | |
| T-20 (README) | | | |
```

---

## 5. 関連ドキュメント

- ビルド手順: `aidlc-docs/construction/build-and-test/build-instructions.md`
- 要件: `aidlc-docs/inception/requirements/requirements.md`
- cycle-1 シナリオ詳細: `aidlc-docs-waitless-archive/cycle-1/construction/build-and-test/integration-test-instructions.md`
