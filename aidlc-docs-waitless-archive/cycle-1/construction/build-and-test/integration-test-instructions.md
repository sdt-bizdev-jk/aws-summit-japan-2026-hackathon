# Integration Test Instructions — WaitLess

**プロジェクト**: WaitLess (Chrome 拡張機能 / Manifest V3)
**フェーズ**: CONSTRUCTION - Build and Test
**作成日**: 2026-05-26

---

## 1. 統合テストの方針

WaitLess は単一ユニット (waitless-extension) 構成のため、**「ユニット間統合」は存在しない**。代わりに、Chrome 拡張機能の 3層 (Service Worker / Content Script / Options Page) と Chrome API + 外部サイト (Claude.ai / 娯楽サイト) との統合を **手動 E2E 検証** で行う。

ハッカソン MVP 規模 + 自動テスト不採用方針 (NFR-04, Q13=C) のため、自動 E2E (Playwright/Puppeteer) は採用しない。

---

## 2. 事前準備

### 2.1 環境
- Chrome 最新安定版 (デベロッパーモード ON)
- Claude.ai のアカウントにログイン済み
- インターネット接続 (Claude.ai および登録娯楽サイトへ)

### 2.2 Unpacked ロード
`build-instructions.md` §3.1 に従って `extension/` を Unpacked ロード済みであること。

### 2.3 検証用 DevTools の用意
2 種類の DevTools を併用する:
- **Service Worker DevTools**: `chrome://extensions/` の WaitLess エントリで「サービス ワーカー」リンクをクリック
- **タブ DevTools**: Claude.ai タブや娯楽タブで `Cmd+Option+I` (macOS) / `F12` (Windows/Linux)

---

## 3. シナリオ別検証手順

### Scenario 1: 基本ロードと初期表示 (US-06 関連)

**目的**: Unpacked ロード後、Options Page を初めて開いた時の挙動を確認

**手順**:
1. WaitLess の Options Page を開く (拡張アイコンクリック、または `chrome://extensions/` の「拡張機能のオプション」リンク)
2. 表示内容を確認

**期待結果**:
- ✅ Header に「WaitLess」とサブタイトルが表示
- ✅ しきい値設定欄に **5** が表示 (デフォルト)
- ✅ 「📋 登録した娯楽サイト」セクションに空状態案内が表示
  - 文言: 「まだ登録がありません。最低 1件 登録すると WaitLess が動作します。優先順位の上位から、開いている同ドメインのタブが選ばれます。」
- ✅ 新規登録フォーム (ドメイン / URL / 追加ボタン) が表示
- ✅ Console にエラーなし

---

### Scenario 2: サイト登録と永続化 (US-05, FR-04, FR-10)

**目的**: 娯楽サイトの登録、ストレージ永続化を確認

**手順**:
1. ドメイン欄に `youtube.com` を入力
2. URL 欄に `https://www.youtube.com/?autoplay=1` を入力
3. 「追加」ボタンをクリック
4. ページをリロード
5. `chrome://extensions/` で WaitLess の「ストレージを検査」または DevTools コンソールで `chrome.storage.local.get(null, console.log)` を実行

**期待結果**:
- ✅ 「追加しました」のメッセージが緑色で 3秒間表示
- ✅ 入力欄がクリアされる
- ✅ サイト一覧テーブルに 1行目が追加: `1 | youtube.com | https://www.youtube.com/?autoplay=1 | [編集 ▲ ▼ 🗑]`
- ✅ ▲ボタンが無効 (priority 1 のため)、▼ボタンが無効 (sites が 1件 のため)
- ✅ ページリロード後も同じ内容が保持される
- ✅ chrome.storage.local の中身に `sites: [{ domain: "youtube.com", url: "...", priority: 1 }], threshold_sec: 5` が記録

---

### Scenario 3: バリデーションエラー (BR-01〜04)

**目的**: 入力バリデーションが UI で機能することを確認

**手順とテストデータ**:

| 入力 | 期待されるエラー |
|------|----------------|
| ドメイン: 空、URL: 空 | エラー: ドメイン名 / URL の形式 |
| ドメイン: `notldomain` | 「ドメイン名の形式が正しくありません」 |
| ドメイン: `youtube.com`, URL: `not-a-url` | 「URL の形式が正しくありません」 |
| ドメイン: `youtube.com`, URL: `ftp://example.com` | 「URL は http:// または https:// で始めてください」 |
| 既登録 `youtube.com` を再度登録 | 「このドメインは既に登録されています」 |
| しきい値に `0` を入力して保存 | 「しきい値は 1 〜 60 の範囲で入力してください」 |
| しきい値に `61` を入力して保存 | 同上 |
| しきい値に `5.5` を入力して保存 | 「しきい値は整数で入力してください」 |

**期待結果**:
- ✅ 各エラーが赤文字で UI 下部に表示
- ✅ 保存はされない (chrome.storage.local が変更されない)

---

### Scenario 4: しきい値の変更と即時反映 (FR-11, BR-19)

**目的**: しきい値変更が Claude.ai 側に即時反映されることを確認

**手順**:
1. Claude.ai タブを別ウィンドウで開いて DevTools のコンソールを開く
2. WaitLess の Options Page でしきい値を `3` に変更し「保存」
3. Claude.ai タブの DevTools コンソールで以下を実行:
   ```js
   chrome.storage.local.get('threshold_sec', console.log)
   ```

**期待結果**:
- ✅ Options Page で「保存しました」緑メッセージ
- ✅ Claude.ai タブのコンソールで `{ threshold_sec: 3 }` が即座に取得できる
- ✅ ClaudeSiteAdapter は次のストリーミング検知から 3秒で WAIT_DETECTED を発火する

---

### Scenario 5: 待ち発生 → 娯楽タブ切替 (US-01, US-02, US-03, FR-01〜06)

**目的**: 中核体験フローの前半 (発生 → 切替 → 再生) を確認

**前提**:
- サイト 1件以上登録 (例: youtube.com / https://www.youtube.com/?autoplay=1)
- しきい値: 3 秒 (検証時間短縮のため)

**手順**:
1. **既存タブ ヒットケース**:
   - 別タブで `https://www.youtube.com/` を開いておく (動画再生中の YouTube ホームでもよい)
   - Claude.ai タブに戻り、長文を生成するプロンプトを送信 (例:「Pythonでフィボナッチ数列を3000語くらい解説してください」)
   - ストリーミングが 3秒 以上 続いたタイミングで自動切替を観察

2. **新規作成 ケース**:
   - 開いている YouTube タブを閉じる
   - 同様に Claude.ai に長文プロンプトを送信
   - 自動切替を観察

**期待結果**:
- ✅ ストリーミング開始から 3秒以上 経過すると、娯楽タブにフォーカスが移る
- ✅ 既存タブヒット時: そのタブがアクティブになる
- ✅ 新規作成時: 登録 URL で新規タブが開く
- ✅ (best-effort) YouTube の場合は動画が自動再生される
- ✅ Service Worker DevTools のコンソールで以下のフローが観察できる:
   - WAIT_DETECTED 受信
   - findOrOpenPlaySite 呼び出し
   - activateTab または openNewTab + injectPlaybackTrigger

**注意**: 動画自動再生はブラウザのオートプレイポリシー次第で失敗することがある (BR-11、要件 §10.3)。失敗してもユーザー体験は止まらない (タブ切替自体は成功)。

---

### Scenario 6: 完了検知 → AIタブへ自動戻り (US-04, FR-07, FR-08)

**目的**: 中核体験フローの後半 (完了 → 戻り) を確認

**前提**: Scenario 5 を実行中の状態 (娯楽タブにいる、Claude.ai はバックグラウンドで応答ストリーミング中)

**手順**:
1. 娯楽タブで動画視聴中、Claude.ai のストリーミングが完了するのを待つ
2. 自動で Claude.ai タブに戻ることを観察

**期待結果**:
- ✅ Claude.ai のストリーミング完了を検知して、Claude.ai タブにフォーカスが戻る
- ✅ Service Worker DevTools のコンソールで COMPLETION_DETECTED 受信が記録
- ✅ RuntimeState.isWaiting が false に戻る (BR-22)

**フォールバック検証 (任意)**:
- Scenario 5 で切替えた直後に Claude.ai タブを **手動で閉じる**
- 出力完了を別途トリガー (難しい場合は省略)
- 期待: TabManager.findClaudeTab() でフォールバック → 該当タブなしなら no-op (エラーで止まらない)

---

### Scenario 7: 短い応答での切替抑制 (BR-12)

**目的**: しきい値未満の短い応答では切替が起きないことを確認

**手順**:
1. しきい値を `5` に戻す
2. Claude.ai に短い応答プロンプトを送信 (例: 「5は素数ですか?はい/いいえだけ」)
3. 応答完了まで待つ

**期待結果**:
- ✅ 5秒未満で完了するため、娯楽タブへの切替は **発生しない**
- ✅ Service Worker のコンソールに WAIT_DETECTED が記録されない

---

### Scenario 8: 重複イベント抑制 (BR-12)

**目的**: ストリーミングが断続的になっても、isWaiting=true の間は重複切替が起きないことを確認

**手順**:
1. Claude.ai でストリーミングを開始 → 切替後、すぐに「停止」ボタンをクリック (短く中断)
2. 同じセッションで再度長文プロンプトを送信

**期待結果**:
- ✅ 1回目の切替で WaitLess の状態は WAITING
- ✅ 中断 (停止クリック) は完了として扱われ、isWaiting=false に戻る
- ✅ 2回目の長文ストリーミングで通常の切替フローが動く (BR-12 が機能、重複切替はない)

---

### Scenario 9: 並び替え (▲ ▼) と 削除 (FR-04)

**目的**: 優先順位変更と削除の永続化を確認

**手順**:
1. 2件以上のサイトを登録 (例: youtube.com, x.com)
2. 2位のサイト行で ▲ ボタンをクリック
3. ページリロード後、順序が変わっていることを確認
4. 1件削除 → 削除確認ダイアログで OK
5. 残りのサイトの priority が再採番されていることを確認 (priority 1 から連番)

**期待結果**:
- ✅ ▲ で順序が入れ替わり、永続化される
- ✅ 削除後 priority が 1 から再採番 (BR-05)

---

### Scenario 10: インライン編集 (US-05)

**目的**: テーブル内編集の挙動を確認

**手順**:
1. サイト一覧の「編集」ボタンをクリック
2. ドメイン / URL を変更して「保存」
3. 「キャンセル」で元に戻る挙動も確認

**期待結果**:
- ✅ 編集モードで input 要素に変わる
- ✅ 「保存」でバリデーション後 updateSite に成功すると、表示モードに戻る (新値表示)
- ✅ 「キャンセル」で元の値に戻る (storage は変更されない)

---

### Scenario 11: アイコンクリック → Options Page (Q8=A)

**目的**: ツールバーアイコンの挙動を確認

**手順**:
1. ツールバー (またはパズルメニュー) の WaitLess アイコンをクリック

**期待結果**:
- ✅ Options Page が新規タブまたは管理画面で開く (`chrome.runtime.openOptionsPage` の挙動依存)
- ✅ ポップアップは **表示されない** (アンチスコープ #7 と整合)

---

### Scenario 12: 外部送信ゼロの確認 (NFR-02)

**目的**: 拡張機能が外部HTTP通信を行っていないことを確認

**手順**:
1. Service Worker DevTools の「Network」タブを開く
2. Options Page でサイト追加 / 削除 / しきい値変更を一通り実行
3. Claude.ai でストリーミング → 切替 → 完了 のフルサイクルを実行
4. Network タブを観察

**期待結果**:
- ✅ Service Worker からの外部 HTTP リクエストが **発生していない** (Chrome API 内部通信のみ)
- ✅ Content Script (claude_site_adapter, playback_trigger) も外部送信なし

---

### Scenario 13: Service Worker 再起動と状態復元 (BR-16)

**目的**: SW がアンロード/再起動されても動作継続することを確認

**手順**:
1. Scenario 5 でストリーミング → 切替を実行 (isWaiting=true 状態)
2. 30秒〜数分間 操作せず放置 (Service Worker はアイドル時にアンロードされる)
3. Claude.ai のストリーミング完了を待つ → 自動戻りが機能するか観察

**期待結果**:
- ✅ Service Worker が再起動しても、session ストレージから RuntimeState が復元される
- ✅ COMPLETION_DETECTED 受信時に Claude.ai タブへ戻る
- ✅ Service Worker DevTools の Console で `[WaitLess]` 関連のエラーが出ていない

> 注: SW のアイドルアンロードのタイミングは Chrome 内部仕様で、確実に再現できない場合あり。

---

## 4. 失敗時の対処

### Claude.ai 側で WAIT_DETECTED が発火しない
- **原因候補**: 停止ボタンの DOM セレクタが Claude.ai の現行 UI と一致していない
- **対処**: `claude_site_adapter.js` の `STOP_BUTTON_SELECTORS` を実機の DOM で確認し、調整 (Q2=C+D の戦術: 属性ベース → テキストフォールバック)
- **デバッグ**: Claude.ai タブの DevTools Console で `document.querySelector('button[aria-label="Stop response"]')` 等を実行して要素特定

### 動画が再生されない
- **原因候補**: ブラウザのオートプレイポリシー
- **対処**: 黙って許容 (BR-11)。サイトに 1度ユーザー操作があれば、以降のセッションで自動再生されることが多い

### 切替後に Claude.ai タブへ戻らない
- **原因候補**: 完了検知の DOM セレクタが UI と一致していない (停止ボタンが消えない/別要素になっている)
- **対処**: 同上、`claude_site_adapter.js` を実機調整

---

## 5. 検証結果テンプレート

| シナリオ | 結果 | 備考 |
|---------|------|------|
| Scenario 1: 基本ロード | ⬜ | |
| Scenario 2: サイト登録と永続化 | ⬜ | |
| Scenario 3: バリデーションエラー | ⬜ | |
| Scenario 4: しきい値即時反映 | ⬜ | |
| Scenario 5: 待ち発生 → 切替 | ⬜ | (best-effort、DOM セレクタ依存) |
| Scenario 6: 完了 → 戻り | ⬜ | |
| Scenario 7: 短い応答抑制 | ⬜ | |
| Scenario 8: 重複イベント抑制 | ⬜ | |
| Scenario 9: 並び替え/削除 | ⬜ | |
| Scenario 10: インライン編集 | ⬜ | |
| Scenario 11: アイコン → Options | ⬜ | |
| Scenario 12: 外部送信ゼロ | ⬜ | |
| Scenario 13: SW 再起動と復元 | ⬜ | |

✅ = 成功 / ❌ = 失敗 / ⬜ = 未実施 / ⚠ = 部分成功
