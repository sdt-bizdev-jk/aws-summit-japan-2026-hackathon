# Business Rules — waitless-extension

**プロジェクト**: WaitLess
**ユニット**: U1 (waitless-extension)
**フェーズ**: CONSTRUCTION - Functional Design
**作成日**: 2026-05-26

このドキュメントは、Unit U1 の **業務ルール / バリデーション / フォールバック規則** を定義する。

---

## 1. 入力バリデーションルール

### BR-01: domain 入力 (Q5-1=B)

| 項目 | 規則 |
|------|------|
| 必須 | はい (空文字は不可) |
| 形式 | 正規表現 `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` に一致 |
| 長さ | 1〜255 文字 |
| 大文字小文字 | 区別しない (内部では小文字に正規化して保存) |
| `www.` の扱い | 入力時の `www.` は除去して保存 (例: `www.youtube.com` → `youtube.com`) |
| エラーメッセージ | 「ドメイン名の形式が正しくありません (例: youtube.com)」 |

実装ノート: 正規化後の domain で重複チェックを行う (BR-03)。

### BR-02: url 入力 (Q5-2=B)

| 項目 | 規則 |
|------|------|
| 必須 | はい |
| 形式 | `new URL(input)` でパース成功し、`url.protocol` が `https:` または `http:` であること |
| 長さ | 1〜2048 文字 |
| 補足 | プロトコルなし入力 (`youtube.com/...`) は受け付けない (パース失敗) |
| エラーメッセージ | 「URL の形式が正しくありません (https:// または http:// で始まるフル URL を入力してください)」 |

### BR-03: domain 重複 (Q5-3=A)

| 項目 | 規則 |
|------|------|
| 重複可否 | **不可** (既登録 domain と同一の domain は新規追加できない) |
| 比較 | BR-01 で正規化された値同士の文字列等価 |
| 編集時 | インライン編集で domain を変更する場合も、自分以外の既存 domain と一致する場合は不可 |
| エラーメッセージ | 「このドメインは既に登録されています」 |

### BR-04: しきい値 threshold_sec (Q6=A, Q6-2=A)

| 項目 | 規則 |
|------|------|
| 型 | 整数 |
| 範囲 | **1 〜 60** (両端含む) |
| デフォルト | **5** (Settings に未設定時) |
| 範囲外入力 | UI で **エラー表示**、保存させない (クランプはしない) |
| 小数入力 | エラー (整数のみ) |
| エラーメッセージ | 「しきい値は 1 〜 60 の整数で入力してください」 |

---

## 2. 優先順位とソートのルール

### BR-05: priority 値の連番化

| 項目 | 規則 |
|------|------|
| 型 | 整数、1 から始まる連番 (1, 2, 3, ...) |
| 採番タイミング | site 追加 / 削除 / 並び替えのタイミングで内部的に再採番 |
| 採番アルゴリズム | reorderSites 操作の `orderedDomains` の順に priority を 1, 2, 3, ... と再採番。drop された domain や重複は事前に除外 |
| addSite 時 | 既存 sites の最大 priority + 1 を新規 site に付与 |
| deleteSite 時 | 削除後、残った sites を current order のまま 1 から再採番 |

### BR-06: site リストのソート

| 項目 | 規則 |
|------|------|
| ソート方向 | priority 昇順 (1 が最も高優先) |
| 同順位 | 発生しない (BR-05 で連番化される) |
| 取得時の順序 | `getSites()` は priority 昇順で返す。OptionsApp と TabManager は両者ともこの順序を信頼する |

---

## 3. タブ一致判定ルール

### BR-07: domain 一致判定 (Q4-2=C)

| 項目 | 規則 |
|------|------|
| 判定基準 | タブの URL から `extractDomain` で抽出したホスト名と、Site の `domain` の文字列等価 |
| `extractDomain` 規則 | `new URL(tab.url).hostname` から `^www\.` を除去 |
| サブドメインの扱い | サブドメインは別ドメインとして扱う (例: `m.youtube.com` は `youtube.com` と一致しない) |
| chrome:// 等の特殊URL | URL パース失敗 → 不一致 |

### BR-08: 探索ウィンドウ範囲 (Q4-1=A)

| 項目 | 規則 |
|------|------|
| 範囲 | `chrome.windows.getLastFocused({ populate: true })` で取得した **現在のフォーカスウィンドウのみ** |
| 複数ウィンドウ | 他ウィンドウのタブは探索対象外 (=新規作成にフォールバックする) |
| 副作用 | 他ウィンドウで娯楽タブが既に開いていても見つからない (現在ウィンドウに新規が増える可能性あり、ユーザー受容済) |

### BR-09: 新規タブ作成 / 登録 URL 遷移のルール

| 項目 | 規則 |
|------|------|
| 探索戦略 | **2パス探索**: Pass 1 で全 sites の URL 完全一致を優先順位順に探す → Pass 2 で全 sites のドメイン一致を優先順位順に探す → どちらもなければ Pass 3 で新規作成 |
| Pass 1: URL 完全一致 (続きから再生意図) | 既存タブをそのままアクティブ化 (遷移なし)。動画は PlaybackTrigger で再開試行 |
| Pass 2: ドメインのみ一致 | **登録 URL へ `chrome.tabs.update` で navigate + アクティブ化** (CQ2=B「毎回登録 URL を開く」を CQ3=A 優先順位と整合的に解釈) |
| Pass 3: ヒットなし | sites[0] (priority 1) の `url` で新規タブを作成 |
| 開くウィンドウ | 現在のフォーカスウィンドウ |
| 連続作成防止 | 既に同サイクルで開いている場合は重複作成しない (RuntimeState.isWaiting で抑制) |

### BR-09b: 完了サイクルでの娯楽タブ動画一時停止

| 項目 | 規則 |
|------|------|
| 発火タイミング | `onCompletionDetected` で AI タブにアクティブ化を行う直前 |
| 対象タブ | RuntimeState.getPlayTabId() で記録された娯楽タブ |
| 注入する Content Script | `extension/content/playback_pause.js` (動的注入) |
| 動作 | 全 `<video>` 要素を `pause()` (再生中・終了済以外)。それで効かないサイトはサイト固有の一時停止ボタンを試行 |
| 失敗時 | 黙って許容 (BR-11 と同方針) |
| 効果 | 次に同タブが切替先になった時 (URL 完全一致パス)、PlaybackTrigger の `play()` で続きから再生される |

---

## 4. 動画自動再生のフォールバック規則 (Q3=D)

### BR-10: PlaybackTrigger 試行順序

```
1. サイト固有セレクタ (主要サイト 2〜3 件)
   - YouTube: `.ytp-large-play-button`, `.ytp-play-button`
   - Vimeo: `button.vp-controls-play`
   - ニコニコ: `.MainVideoPlayer button[aria-label="再生"]`
2. 汎用 <video> 要素の play() 試行
3. 全て失敗したら静かに諦める
```

### BR-11: 失敗時の挙動
- ブラウザのオートプレイポリシーで play()/click() が拒否されても、コンソール warn のみ
- ユーザーへの通知 (バッジ/通知) は行わない (アンチスコープ #5)
- タブ切替自体は成功しているため、ユーザーは手動で再生できる

---

## 5. 重複イベント抑制ルール (Property 1)

### BR-12: WAIT_DETECTED 重複抑制

| 状況 | 挙動 |
|------|------|
| `RuntimeState.isWaiting() == false` で受信 | 通常処理 (待ち発生サイクル開始) |
| `RuntimeState.isWaiting() == true` で受信 | **無視** (ログ出力のみ、何もしない) |

これにより以下が保証される:
- 同一サイクル中に複数回の WAIT が発火しても切替は 1 回
- ストリーミングが一旦切れて再開した場合の二重切替を防ぐ

### BR-13: COMPLETION_DETECTED ガード

| 状況 | 挙動 |
|------|------|
| `RuntimeState.isWaiting() == true` | 通常処理 (戻りサイクル) |
| `RuntimeState.isWaiting() == false` | **no-op** (戻り済 or 待ち未発生時の通知) |

---

## 6. エラー時のフォールバック規則

### BR-14: 戻り先 Claude.ai タブ消失

```
1. RuntimeState.getClaudeTabId() で記録された ID を取得
2. TabManager.tabExists(id) で生存確認
   ✓ 生存: そのタブをアクティブ化
   ✗ 消失: TabManager.findClaudeTab() でフォールバック
              ✓ 生存: そのタブをアクティブ化
              ✗ 不在: no-op (Claude.ai を開いていない、何もできない)
3. RuntimeState.setWaiting(false) で必ずリセット
```

### BR-15: 娯楽タブの作成失敗

```
chrome.tabs.create が失敗 (例: ネットワーク不在、URL 不正):
  → console.error
  → RuntimeState.setWaiting(false) でリセット
  → ユーザー体験を止めない
```

### BR-16: Service Worker 再起動

```
SW 起動時:
  RuntimeState.restoreFromSession()
    chrome.storage.session.get('runtime_state')
      ✓ 復元: 保存されていた状態を継続
      ✗ なし: { isWaiting: false, claudeTabId: null, playTabId: null } で初期化
```

### BR-17: 設定保存の例外

```
SettingsRepository.set* で chrome.storage.local が例外を投げた場合:
  → console.error
  → { ok: false, reason: 'storage_error' } を返す
  → OptionsApp はエラーメッセージを UI に表示
```

### BR-18: 不明な sendMessage タイプ

```
MessageRouter.handle:
  switch type の default ケース → 何もしない (no-op、警告ログ任意)
  前方互換性のため安全に無視
```

---

## 7. しきい値の動的反映ルール

### BR-19: storage.onChanged の即時反映

| 項目 | 規則 |
|------|------|
| 監視対象 | `chrome.storage.local` の `threshold_sec` キーの変化 |
| 反映タイミング | 変化検知の **次の startWaitTimer から** 適用される (進行中のタイマーは古い値で完了させる、シンプルさ優先) |
| 影響範囲 | ClaudeSiteAdapter (Content Script) のみ。WaitOrchestrator/TabManager は読まない |

---

## 8. ストレージのデフォルト値補完

### BR-20: SettingsRepository.getSettings の補完

```
async function getSettings():
    raw = await chrome.storage.local.get(['sites', 'threshold_sec'])
    return {
        sites: Array.isArray(raw.sites) ? raw.sites : [],
        thresholdSec: Number.isInteger(raw.threshold_sec)
            && 1 <= raw.threshold_sec <= 60
            ? raw.threshold_sec
            : 5  // デフォルト 5
    }
```

- ストレージに何も入っていない初回も、ステートとして問題なく動作する
- 意図せず壊れた値 (型違いや範囲外) はデフォルトに戻して安全側に倒す

---

## 9. 拡張機能インストール時の初期化

### BR-21: onInstalled イベント

```
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason == 'install'):
        // 必要であればデフォルト設定を書き込む
        // 本仕様では BR-20 が補完するため、何もしなくても良い
        // ユーザーは Options Page を開いて初回登録する想定 (US-06)
})
```

---

## 10. 完了条件のルール

### BR-22: 待ちサイクルの完了

「1 サイクル」とは以下のいずれかで終了する:
- a) `COMPLETION_DETECTED` 受信 (正常完了 → BR-13 で戻り)
- b) 戻り先タブが見つからず BR-14 のフォールバックも失敗 (no-op で終了、isWaiting=false)
- c) `RuntimeState.reset()` が呼ばれた (異常系リカバリ)

いずれの場合も **isWaiting は最終的に false に戻る** ことを保証する (Property 1 の支え)。

---

## 11. ルール適用箇所のサマリ

| ルール ID | 適用箇所 |
|----------|----------|
| BR-01 〜 BR-04 | OptionsApp (UI バリデーション) + SettingsRepository (保存前バリデーション、二重保証) |
| BR-05, BR-06 | SettingsRepository |
| BR-07, BR-08, BR-09 | TabManager |
| BR-10, BR-11 | PlaybackTrigger |
| BR-12, BR-13 | WaitOrchestrator + RuntimeState |
| BR-14 | WaitOrchestrator + TabManager |
| BR-15 | TabManager |
| BR-16 | service_worker.js + RuntimeState |
| BR-17 | SettingsRepository + OptionsApp |
| BR-18 | MessageRouter |
| BR-19 | ClaudeSiteAdapter |
| BR-20 | SettingsRepository |
| BR-21 | service_worker.js (onInstalled) |
| BR-22 | WaitOrchestrator + RuntimeState (横断) |
