# Component Dependency — WaitLess

**プロジェクト**: WaitLess
**フェーズ**: INCEPTION - Application Design
**作成日**: 2026-05-26

---

## 1. 依存マトリクス

行 (Caller) が 列 (Callee) を呼び出す方向の依存。`✓` = 直接依存、`(M)` = sendMessage 経由、`(S)` = storage.onChanged 経由、`(I)` = 動的注入。

| Caller \ Callee | MessageRouter | WaitOrchestrator | TabManager | SettingsRepository | RuntimeState | ClaudeSiteAdapter | PlaybackTrigger | OptionsApp | OptionsAPI |
|----|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| MessageRouter      |   | ✓ | ✓ | ✓ |   |   |   |   |   |
| WaitOrchestrator   |   |   | ✓ | ✓ | ✓ |   |   |   |   |
| TabManager         |   |   |   |   |   |   | (I) |   |   |
| SettingsRepository |   |   |   |   |   |   |   |   |   |
| RuntimeState       |   |   |   |   |   |   |   |   |   |
| ClaudeSiteAdapter  | (M) |   |   | (S) |   |   |   |   |   |
| PlaybackTrigger    |   |   |   |   |   |   |   |   |   |
| OptionsApp         |   |   |   |   |   |   |   |   | ✓ |
| OptionsAPI         | (M) |   |   |   |   |   |   |   |   |

### 観察ポイント
- **循環依存なし** (上の三角形のみが埋まり、対称箇所が空)
- SettingsRepository / RuntimeState / TabManager / PlaybackTrigger は **何も呼ばないリーフコンポーネント** (Chrome API のみに依存)
- Content Script (ClaudeSiteAdapter) と Options Page (OptionsAPI) は **MessageRouter を経由してのみ** Service Worker のロジックに到達する → 層境界が明確

---

## 2. レイヤー区分

```
+-----------------------------------+
| Layer 4: UI / Page                |
|   - OptionsApp                    |
+-----------------------------------+
              |
              v
+-----------------------------------+
| Layer 3: Adapter / Boundary       |
|   - ClaudeSiteAdapter             |
|   - PlaybackTrigger               |
|   - OptionsAPI                    |
+-----------------------------------+
              |
              v sendMessage / storage.onChanged
+-----------------------------------+
| Layer 2: Orchestration            |
|   - MessageRouter                 |
|   - WaitOrchestrator              |
+-----------------------------------+
              |
              v
+-----------------------------------+
| Layer 1: Domain Services          |
|   - TabManager                    |
|   - SettingsRepository            |
|   - RuntimeState                  |
+-----------------------------------+
              |
              v
+-----------------------------------+
| Layer 0: Chrome API + DOM         |
+-----------------------------------+
```

各レイヤーは **下位レイヤーのみ** を呼び出し、上位への呼び出しは イベント (sendMessage / storage.onChanged) を介する。

---

## 3. 通信パターン

### 3.1 sendMessage (リクエスト/応答)

```
[Source]                [Destination (MessageRouter)]
  ClaudeSiteAdapter ---> MessageRouter
  OptionsAPI         ---> MessageRouter
  PlaybackTrigger    ---> (使わない、即時実行のみ)
```

#### メッセージ種別
| Type | Source | Destination | 応答必要 |
|------|--------|-------------|---------|
| `WAIT_DETECTED` | ClaudeSiteAdapter | WaitOrchestrator | No |
| `COMPLETION_DETECTED` | ClaudeSiteAdapter | WaitOrchestrator | No |
| `GET_SETTINGS` | OptionsAPI | SettingsRepository | Yes |
| `ADD_SITE` / `UPDATE_SITE` / `DELETE_SITE` / `REORDER_SITES` / `SET_THRESHOLD` | OptionsAPI | SettingsRepository | Yes (`{ ok, reason? }`) |

### 3.2 storage.onChanged (放送/購読)

```
[Producer]                                 [Subscriber]
  SettingsRepository (chrome.storage.local) ---> ClaudeSiteAdapter (threshold_sec)
                                            ---> (任意) WaitOrchestrator (sites)
```

OptionsApp で `SET_THRESHOLD` した直後、ClaudeSiteAdapter は storage.onChanged を介してしきい値の最新値を取得する。sendMessage 経由ではないため疎結合。

### 3.3 動的注入 (chrome.scripting.executeScript)

```
TabManager.injectPlaybackTrigger(tabId)
   ---> chrome.scripting.executeScript({ target: { tabId }, files: ['content/playback_trigger.js'] })
   ---> 娯楽タブで PlaybackTrigger が即時実行される
```

PlaybackTrigger は static な content_scripts 宣言ではなく、Service Worker から必要時のみ注入される。

---

## 4. データフロー図

### 4.1 待ち発生サイクル (US-01 → US-02 → US-03)

```
+---------------------+
| Claude.ai タブ        |
|  ClaudeSiteAdapter |
|   - DOM変化検知     |
|   - N秒タイマー     |
+----------+----------+
           |
           | (1) WAIT_DETECTED { claudeTabId, durationMs }
           v
+---------------------+
| Service Worker       |
|  MessageRouter     | ---> (2) ---> WaitOrchestrator.onWaitDetected
|                    |                    |
|                    |                    | (3a) sites を取得
|                    |                    v
|                    |                  SettingsRepository
|                    |                    |
|                    |               (3b) RuntimeState 更新
|                    |                    |
|                    |               (3c) findOrOpenPlaySite(sites)
|                    |                    v
|                    |                  TabManager
|                    |                    |
+--------------------+--------------------+
                                          |
                              +-----------+----------------+
                              |                            |
                  既存タブヒット                      新規作成
                  activateTab                       openNewTab
                                                    + injectPlaybackTrigger
                              |                            |
                              v                            v
+----------------------------------------------+
| 娯楽タブ                                        |
|  (新規の場合) PlaybackTrigger 即時実行         |
|  (既存の場合) URL パラメータ ?autoplay=1 等で |
|              既に再生されている前提            |
+----------------------------------------------+
```

### 4.2 完了サイクル (US-04)

```
+---------------------+
| Claude.ai タブ        |
|  ClaudeSiteAdapter |
|   - 完了 DOM 検知   |
+----------+----------+
           |
           | (1) COMPLETION_DETECTED { claudeTabId }
           v
+---------------------+
| Service Worker       |
|  MessageRouter     | ---> WaitOrchestrator.onCompletionDetected
|                    |          |
|                    |          | (2) RuntimeState.isWaiting() チェック
|                    |          |
|                    |          | (3) TabManager.activateTab(claudeTabId)
|                    |          |     (フォールバックは findClaudeTab)
|                    |          |
|                    |          | (4) RuntimeState.setWaiting(false)
+--------------------+----------+
                                |
                                v
                        Claude.ai タブにフォーカス戻る
```

### 4.3 設定更新サイクル (US-05, US-06)

```
+---------------------+
| Options Page         |
|  OptionsApp        |
|   - フォーム入力    |
|   - バリデーション  |
+----------+----------+
           |
           | OptionsAPI.addSite(...) など
           v
+---------------------+
| sendMessage          |
|  ADD_SITE 等         |
+----------+----------+
           |
           v
+---------------------+
| Service Worker       |
|  MessageRouter     | ---> SettingsRepository.addSite (等)
|                    |              |
|                    |              v
|                    |         chrome.storage.local
+--------------------+
           |
           | (副次) storage.onChanged 発火
           v
+---------------------+
| Claude.ai タブ        |
|  ClaudeSiteAdapter |
|   - threshold_sec   |
|     を即時更新      |
+---------------------+
```

---

## 5. ライフサイクル

### 5.1 拡張機能インストール時
1. `manifest.json` の `background.service_worker` で Service Worker が起動
2. Service Worker 内で `MessageRouter.init()` 呼び出し
3. `RuntimeState.restoreFromSession()` を試行 (初回は何もない)
4. ユーザーがオプションページを開く → OptionsApp.init() → 空状態 → オンボーディング表示

### 5.2 ユーザーが Claude.ai タブを開いた時
1. `manifest.json` の `content_scripts.matches` により ClaudeSiteAdapter が自動注入
2. ClaudeSiteAdapter.init() 呼び出し
3. SettingsRepository (sendMessage) 経由でしきい値を取得
4. MutationObserver 開始

### 5.3 待ち発生 (中略、§4.1 参照)

### 5.4 完了 (中略、§4.2 参照)

### 5.5 Service Worker のアイドルアンロード/再起動
- Manifest V3 の Service Worker は使われていない時にアンロードされる
- 次のメッセージ到着で再起動 → `MessageRouter.init()` 再実行 → `RuntimeState.restoreFromSession()` で状態復元

### 5.6 拡張機能アンインストール時
- `chrome.storage.local` のデータは Chrome 側でクリアされる (拡張機能管理の標準動作)

---

## 6. 安定性ポイント

| ポイント | 対策 |
|---------|------|
| Claude.ai の DOM 変更でシグナルが壊れる | ClaudeSiteAdapter にロジックを閉じ込め、Functional Design でセレクタを最小限の組合せにする。壊れたら直す運用 |
| Service Worker の再起動 | RuntimeState を session ストレージで復元 |
| 既存タブが閉じている時の戻り | findClaudeTab のフォールバック、ヒットしなければ no-op |
| 重複イベント (WAIT_DETECTED 連発) | RuntimeState.isWaiting フラグで抑制 |
| 動画再生失敗 | PlaybackTrigger は best-effort、失敗を黙って許容 |

---

## 7. 循環依存の不在 (確認)

§1 の依存マトリクスは上三角 (caller の方が「上位レイヤー」) のみが埋まっており、対称な箇所はすべて空 → **循環依存なし**。

レイヤー観点でも (§2) 上から下への一方向のみ + イベント (sendMessage / storage.onChanged) を介した間接通信のみ → **アーキテクチャ的にも循環なし**。
