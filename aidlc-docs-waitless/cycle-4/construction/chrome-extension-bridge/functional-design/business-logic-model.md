# cycle-4 — Unit 2 (chrome-extension-bridge) — Business Logic Model

最終更新: 2026-05-27

Unit 2 の責務: 既存 WaitLess Chrome 拡張に **IDE 連携モジュール** (`sw/ide_bridge.js`) を追加し、VS Code 拡張側 (Unit 1) の WebSocket サーバーに接続して、IPC メッセージを既存の TabManager / SettingsRepository への呼び出しに翻訳する。

---

## 1. 全体像

```
[Unit 1 (vscode-extension)]
   IpcClient (WebSocket Server :39472)
            |
            | ws (双方向 JSON)
            v
[Unit 2 (chrome-extension-bridge)]
   sw/ide_bridge.js
       ├─→ SettingsRepository.getSettings()  (既存、無変更)
       ├─→ TabManager.findOrOpenPlaySite()    (既存、無変更)
       └─→ TabManager.injectPlaybackPause()   (既存、無変更、Q4=D 実コード確認済)
```

---

## 2. ライフサイクル

```
[Service Worker spin up]
   └→ service_worker.js が `import IdeBridge` + `IdeBridge.init()` 呼び出し

[IdeBridge.init()]
   ├→ chrome.storage.local.get('ipc_enabled')
   │   ├─ ipc_enabled === false → 何もしない (BR-66 で OFF 動作)
   │   └─ ipc_enabled === true (デフォルト) → 以下続行
   ├→ chrome.storage.onChanged を購読 (トグル変更で動的 ON/OFF)
   └→ _connect() で WebSocket 接続を試行
        ├─ 成功: PING 送信ループ開始 + メッセージリスナー登録
        └─ 失敗: 指数バックオフで再試行 (Q1=A)

[接続中]
   PING ループ (30秒ごと、PONG 受信で生存確認)
   メッセージ受信 → _handleMessage() でディスパッチ

[切断検知]
   再接続を再試行 (指数バックオフで継続、Q1=A)

[Service Worker idle unload]
   WebSocket 自動切断
   → 次の Service Worker spin up で IdeBridge.init() が再実行され、再接続

[Options Page トグル OFF]
   chrome.storage.onChanged で検知
   → IdeBridge.shutdown() で接続切断、再接続停止
```

---

## 3. メッセージディスパッチロジック

`_handleMessage(msg)` の動作:

```
受信 msg = { type, payload, requestId? }

switch (msg.type) {
  case 'GET_SITES':
    sites = await SettingsRepository.getSites();
    送信 { type: 'SITES_RESPONSE', requestId, payload: { sites } };
    break;

  case 'FIND_OR_OPEN_TAB':
    url = msg.payload.url;
    result = await TabManager.findOrOpenPlaySite([{ url, priority: 1, domain: extractDomain(url) }]);
    if (result == null) {
      送信 { type: 'TAB_OPENED', requestId, payload: { ok: false, reason: 'no_tab' } };
    } else {
      // 起動 pass を 'existing'/'navigated'/'new' から 1/2/3 にマップ
      pass = mapOpenedToPass(result.opened);  // existing→1, navigated→2, new→3
      
      // 動画再生試行 (BR-65、cycle-1 と同じく PlaybackTrigger 注入)
      await TabManager.injectPlaybackTrigger(result.tabId);
      
      // playTabId を記録 (BR-53 / BR-67、PAUSE_MEDIA で使う)
      _state.lastPlayTabId = result.tabId;
      
      送信 { type: 'TAB_OPENED', requestId, payload: { tabId: result.tabId, pass } };
    }
    break;

  case 'PAUSE_MEDIA':
    // notify (応答待たない、BR-50)
    if (_state.lastPlayTabId != null) {
      await TabManager.injectPlaybackPause(_state.lastPlayTabId);
    }
    送信 { type: 'MEDIA_PAUSED', payload: { ok: true } };  // 任意 (Unit 1 は無視する)
    break;

  case 'PONG':
    // ヘルスチェック応答、何もしない (タイマー側で生存確認)
    break;

  default:
    console.warn('[IdeBridge] unknown message type', msg.type);
}
```

---

## 4. 内部状態モデル

```javascript
const _state = {
  ws: null,                    // 現在の WebSocket インスタンス
  isStarted: false,            // init() が成功したか
  reconnectTimer: null,        // setTimeout ハンドル (再接続用)
  reconnectAttempt: 0,         // 連続失敗回数 (指数バックオフの基数)
  pingInterval: null,          // setInterval ハンドル (PING ループ)
  lastPongAt: 0,               // 最終 PONG 受信時刻 (タイムアウト判定用)
  lastPlayTabId: null,         // 直近の TAB_OPENED tabId (PAUSE_MEDIA 用、BR-67)
  enabled: true,               // ipc_enabled のキャッシュ
};
```

---

## 5. 指数バックオフロジック (Q1=A)

```
function _calculateBackoffMs(attempt) {
  // 1s → 2s → 4s → 8s → 16s → 30s (以降 30s 固定)
  const baseSec = Math.min(2 ** attempt, 30);
  return baseSec * 1000;
}
```

- 接続失敗時に `_state.reconnectAttempt++`、次回再試行までの待機時間を計算
- 接続成功時に `_state.reconnectAttempt = 0` でリセット
- 最大 30 秒 (FR-51)

---

## 6. PING / PONG ヘルスチェック

```
[init() で接続成功直後]
   _state.lastPongAt = Date.now();
   _state.pingInterval = setInterval(_pingLoop, 30_000);

function _pingLoop() {
  if (Date.now() - _state.lastPongAt > 60_000) {
    // 60秒応答なし → 接続死亡判定、再接続
    _disconnect();
    _scheduleReconnect();
    return;
  }
  if (_state.ws && _state.ws.readyState === WebSocket.OPEN) {
    _state.ws.send(JSON.stringify({ type: 'PING' }));
  }
}

[PONG 受信時]
   _state.lastPongAt = Date.now();
```

---

## 7. Options Page トグル連動

```
[Options Page でトグル変更 → chrome.storage.local.set({ ipc_enabled: bool })]
   └→ chrome.storage.onChanged が発火
        └→ IdeBridge の購読リスナーが反応
             ├─ true → IdeBridge.init() (再接続開始)
             └─ false → IdeBridge.shutdown() (切断 + 再接続停止)
```

---

## 8. service_worker.js への変更 (最小)

cycle-3 v0.3.0 の `service_worker.js` の末尾に **2 行のみ**追加:

```javascript
// (既存のまま)
import * as RuntimeState from './sw/runtime_state.js';
import * as MessageRouter from './sw/message_router.js';
+import * as IdeBridge from './sw/ide_bridge.js';   // ★ cycle-4 追加

MessageRouter.init();
+IdeBridge.init().catch((e) => console.warn('[WaitLess][SW] IdeBridge init failed', e));   // ★ cycle-4 追加

// (以下既存のまま)
```

それ以外の既存ファイル (`message_router.js`, `wait_orchestrator.js`, `tab_manager.js`, `settings_repository.js`, `runtime_state.js`, `content/*`, `reader/*`) は **完全無変更** (NFR-27 厳守)。

---

## 9. cycle-1〜3 の体験との両立

cycle-4 で追加した IdeBridge は **既存の WaitOrchestrator フローと並行して動く**:

- Claude.ai での待ち発生 → WaitOrchestrator が 2 パス探索 → 動画タブで再生 → Claude 完了で動画停止 + Claude タブに戻る (cycle-1〜3 のフロー、無変更)
- Kiro での待ち発生 → IdeBridge 経由で 2 パス探索 → 動画タブで再生 → Kiro 完了で動画停止 + Kiro 最前面化 (cycle-4 のフロー、新規)

**両者は独立**。同時に動くこともあり得るが、TabManager の関数を呼ぶだけで内部状態 (RuntimeState) は **WaitOrchestrator フローのみが触る** ため、IdeBridge 側で意図しない汚染が起きない。

---

## 10. Options Page への変更 (FR-61)

`extension/options/options.html` に追加するセクション (簡略版):

```html
<section id="ipc-section">
  <h2>IDE 連携 (cycle-4 実験的)</h2>
  <label>
    <input type="checkbox" id="ipc-toggle" data-testid="options-ipc-toggle" />
    Kiro IDE 連携を有効にする (ws://127.0.0.1:39472)
  </label>
  <p class="hint">
    Kiro IDE 用の WaitLess IDE 拡張機能と連動して、
    AI 待ち時間に動画タブで自動再生 / 完了時に一時停止します。
  </p>
</section>
```

`extension/options/options.js` に追加するロジック (簡略版):

```javascript
// init() 内で呼ぶ
async function initIpcToggle() {
  const toggle = document.getElementById('ipc-toggle');
  if (!toggle) return;
  
  const stored = await chrome.storage.local.get('ipc_enabled');
  // Q2=A: デフォルト true
  toggle.checked = stored.ipc_enabled !== false;
  
  toggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ ipc_enabled: toggle.checked });
    // Service Worker 側で chrome.storage.onChanged を購読しているので
    // 自動的に IdeBridge.init() / shutdown() が呼ばれる
  });
}
```

---

## 11. 関連ドキュメント

- ビジネスルール: `business-rules.md`
- NFR inline 対応: `nfr-inline.md`
- Application Design (Unit 2 部分): `aidlc-docs/inception/application-design/components.md` §2
- Unit 1 IPC プロトコル: `aidlc-docs/construction/vscode-extension/functional-design/domain-entities.md` §3
