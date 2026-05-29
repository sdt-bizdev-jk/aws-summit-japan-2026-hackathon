/**
 * IdeBridge (cycle-4 Unit 2)
 *
 * VS Code (Kiro) 拡張機能 (cycle-4 Unit 1) との WebSocket 双方向通信を担うモジュール。
 *
 * Service Worker 起動時に init() され、ws://127.0.0.1:39472 への接続を試みる。
 * 接続失敗時は指数バックオフで永続再試行 (BR-63)。
 *
 * 受信メッセージは既存の SettingsRepository / TabManager の export 関数で処理する
 * (既存ファイルは完全無変更、NFR-27)。
 *
 * 関連 FR: FR-43, FR-44, FR-45, FR-47, FR-50〜52, FR-58〜61
 * 関連 BR: BR-61〜70
 */

import * as SettingsRepository from './settings_repository.js';
import * as TabManager from './tab_manager.js';
import * as StatsRepository from './stats_repository.js';
import * as LeisureClassifier from './leisure_classifier.js';

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][IdeBridge]', ...args);
}
function dwarn(...args) {
  console.warn('[WaitLess][IdeBridge]', ...args);
}
function derror(...args) {
  console.error('[WaitLess][IdeBridge]', ...args);
}

const IPC_URL = 'ws://127.0.0.1:39472';
const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 60_000;
const MAX_BACKOFF_SEC = 30;

/**
 * 内部状態
 */
const _state = {
  ws: null,
  isStarted: false,
  reconnectTimer: null,
  reconnectAttempt: 0,
  pingInterval: null,
  lastPongAt: 0,
  lastPlayTabId: null,   // BR-67: PAUSE_MEDIA で使う
  enabled: true,         // ipc_enabled のキャッシュ
  storageListenerInstalled: false,
};

/**
 * Service Worker 起動時に呼ばれる (BR-61)。
 * service_worker.js の冒頭で `IdeBridge.init()` を呼ぶ。
 * 失敗しても throw しない (Chrome 拡張全体は機能停止させない、NFR-28)。
 */
export async function init() {
  if (_state.isStarted) {
    dlog('init: already started, skipping');
    return;
  }

  // ipc_enabled の現在値を取得 (BR-62、Q2=A: デフォルト true)
  let enabled = true;
  try {
    const stored = await chrome.storage.local.get('ipc_enabled');
    if (stored.ipc_enabled === false) {
      enabled = false;
    }
  } catch (e) {
    dwarn('init: chrome.storage.local.get failed', e);
  }
  _state.enabled = enabled;

  // ストレージ変更購読を一度だけ設置 (Service Worker 再起動でも 1 回のみ)
  if (!_state.storageListenerInstalled) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (!changes.ipc_enabled) return;

      const next = changes.ipc_enabled.newValue !== false;
      const prev = _state.enabled;
      _state.enabled = next;

      if (next && !prev) {
        dlog('storage onChanged: ipc_enabled flipped to true → connecting');
        _connect();
      } else if (!next && prev) {
        dlog('storage onChanged: ipc_enabled flipped to false → shutting down');
        _disconnect({ scheduleReconnect: false });
      }
    });
    _state.storageListenerInstalled = true;
  }

  _state.isStarted = true;

  if (!enabled) {
    dlog('init: ipc_enabled=false, not connecting (BR-62)');
    return;
  }

  _connect();
}

/**
 * IdeBridge を停止する (Options Page でトグルが OFF になった時等)。
 */
export async function shutdown() {
  dlog('shutdown');
  _state.enabled = false;
  _disconnect({ scheduleReconnect: false });
}

/**
 * 現在 IDE 拡張に接続中か (デバッグ用)
 */
export function isConnected() {
  return _state.ws !== null && _state.ws.readyState === WebSocket.OPEN;
}

// ----- 内部関数 -----

function _connect() {
  if (!_state.enabled) {
    dlog('_connect: disabled, skip');
    return;
  }
  if (_state.ws !== null) {
    dlog('_connect: already have ws, skip');
    return;
  }
  if (_state.reconnectTimer !== null) {
    clearTimeout(_state.reconnectTimer);
    _state.reconnectTimer = null;
  }

  let ws;
  try {
    ws = new WebSocket(IPC_URL);
  } catch (e) {
    dwarn('_connect: WebSocket construct failed', e);
    _scheduleReconnect();
    return;
  }
  _state.ws = ws;

  ws.addEventListener('open', () => {
    dlog('connected to', IPC_URL);
    _state.reconnectAttempt = 0;
    _state.lastPongAt = Date.now();
    _startPingLoop();
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      dwarn('invalid JSON received', e);
      return;
    }
    _handleMessage(msg).catch((err) => derror('_handleMessage threw', err));
  });

  ws.addEventListener('close', () => {
    dlog('connection closed');
    _disconnect({ scheduleReconnect: true });
  });

  ws.addEventListener('error', (e) => {
    // ws の error は close も後続するので、ここではログのみ
    dwarn('socket error', e);
  });
}

/**
 * 接続を切る + (オプションで) 次回再接続をスケジュール。
 */
function _disconnect({ scheduleReconnect }) {
  _stopPingLoop();
  if (_state.ws) {
    try {
      _state.ws.close();
    } catch (e) {
      dwarn('_disconnect: ws.close threw', e);
    }
    _state.ws = null;
  }
  if (_state.reconnectTimer !== null) {
    clearTimeout(_state.reconnectTimer);
    _state.reconnectTimer = null;
  }
  // BR-69: lastPlayTabId は保持

  if (scheduleReconnect && _state.enabled) {
    _scheduleReconnect();
  }
}

/**
 * 指数バックオフで再接続を予約 (BR-63、Q1=A)。
 * 1s → 2s → 4s → 8s → 16s → 30s で頭打ち。
 */
function _scheduleReconnect() {
  if (!_state.enabled) return;
  if (_state.reconnectTimer !== null) return;

  const attempt = _state.reconnectAttempt;
  const baseSec = Math.min(2 ** attempt, MAX_BACKOFF_SEC);
  const delayMs = baseSec * 1000;
  _state.reconnectAttempt += 1;

  dlog(`scheduling reconnect in ${baseSec}s (attempt=${_state.reconnectAttempt})`);
  _state.reconnectTimer = setTimeout(() => {
    _state.reconnectTimer = null;
    _connect();
  }, delayMs);
}

function _startPingLoop() {
  _stopPingLoop();
  _state.pingInterval = setInterval(_pingLoop, PING_INTERVAL_MS);
}

function _stopPingLoop() {
  if (_state.pingInterval !== null) {
    clearInterval(_state.pingInterval);
    _state.pingInterval = null;
  }
}

/**
 * BR-64: 60秒以上 PONG 受信なし → 接続死亡判定で再接続。
 */
function _pingLoop() {
  if (!_state.ws || _state.ws.readyState !== WebSocket.OPEN) {
    return;
  }
  if (_state.lastPongAt > 0 && Date.now() - _state.lastPongAt > PONG_TIMEOUT_MS) {
    dwarn(`PONG timeout (>${PONG_TIMEOUT_MS}ms), forcing reconnect`);
    _disconnect({ scheduleReconnect: true });
    return;
  }
  _send({ type: 'PING' });
}

/**
 * BR-70: 送信前に readyState を確認、失敗時は黙って drop。
 */
function _send(msg) {
  if (!_state.ws || _state.ws.readyState !== WebSocket.OPEN) {
    dlog('_send: not open, dropping', msg && msg.type);
    return;
  }
  try {
    _state.ws.send(JSON.stringify(msg));
  } catch (e) {
    dwarn('_send: ws.send threw', e);
  }
}

// ----- メッセージ処理 -----

/**
 * URL からドメインを抽出 (BR-66 で使用)。
 */
function _extractDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_e) {
    return '';
  }
}

/**
 * cycle-1 の opened (existing/navigated/new) を pass (1/2/3) にマップ (BR-66)。
 */
function _mapOpenedToPass(opened) {
  switch (opened) {
    case 'existing': return 1;
    case 'navigated': return 2;
    case 'new': return 3;
    default: return 3;
  }
}

async function _handleMessage(msg) {
  if (!msg || typeof msg.type !== 'string') {
    dwarn('_handleMessage: invalid message');
    return;
  }

  const { type, payload, requestId } = msg;
  dlog('received', type, requestId ? `(rid=${requestId})` : '');

  switch (type) {
    case 'PONG':
      _state.lastPongAt = Date.now();
      return;

    case 'PING':
      _send({ type: 'PONG' });
      return;

    case 'GET_SITES': {
      let sites = [];
      try {
        sites = await SettingsRepository.getSites();
      } catch (e) {
        dwarn('GET_SITES: getSites failed', e);
      }
      _send({ type: 'SITES_RESPONSE', requestId, payload: { sites } });
      return;
    }

    case 'FIND_OR_OPEN_TAB': {
      const url = payload && typeof payload.url === 'string' ? payload.url : '';
      if (!url) {
        _send({ type: 'TAB_OPENED', requestId, payload: { ok: false, reason: 'invalid_url' } });
        return;
      }

      // 単一 URL を sites 配列形式に正規化して 2 パス探索を依頼
      const fakeSites = [{ url, priority: 1, domain: _extractDomain(url) }];
      let result;
      try {
        result = await TabManager.findOrOpenPlaySite(fakeSites);
      } catch (e) {
        dwarn('FIND_OR_OPEN_TAB: findOrOpenPlaySite threw', e);
        _send({ type: 'TAB_OPENED', requestId, payload: { ok: false, reason: 'tab_manager_error' } });
        return;
      }

      if (!result) {
        _send({ type: 'TAB_OPENED', requestId, payload: { ok: false, reason: 'no_tab' } });
        return;
      }

      // BR-65: PlaybackTrigger 注入 (失敗は許容)
      try {
        await TabManager.injectPlaybackTrigger(result.tabId);
      } catch (e) {
        dwarn('FIND_OR_OPEN_TAB: injectPlaybackTrigger threw', e);
      }

      // BR-67: tabId を記録
      _state.lastPlayTabId = result.tabId;

      const pass = _mapOpenedToPass(result.opened);
      _send({ type: 'TAB_OPENED', requestId, payload: { tabId: result.tabId, pass } });
      return;
    }

    case 'PAUSE_MEDIA': {
      // BR-50: VS Code 側は応答待たない notify (こちらの送信応答は任意)
      const tabId = _state.lastPlayTabId;
      if (tabId == null) {
        dlog('PAUSE_MEDIA: no lastPlayTabId, skipping');
        // 応答は送らない (Unit 1 は無視するため)
        return;
      }
      try {
        await TabManager.injectPlaybackPause(tabId);
        _send({ type: 'MEDIA_PAUSED', payload: { ok: true } });
      } catch (e) {
        dwarn('PAUSE_MEDIA: injectPlaybackPause threw', e);
        _send({ type: 'MEDIA_PAUSED', payload: { ok: false } });
      }
      return;
    }

    case 'STATS_RECORD': {
      // cycle-6: VS Code (Kiro) からの IDE 待ちサイクル統計を記録する (S2, A4=A, F4=A)。
      // 余暇種別は Chrome 側 LeisureClassifier で分類 (分類ロジック集約)。応答不要 (notify)。
      try {
        const p = payload || {};
        const leisureUrlOrDomain = p.leisureUrl || p.leisureDomain || '';
        const hasLeisure = p.leisureStartAt != null;
        const genreId = hasLeisure && leisureUrlOrDomain
          ? LeisureClassifier.classify(leisureUrlOrDomain).genreId
          : null;
        await StatsRepository.recordCycle({
          id: p.id,
          waitStartAt: p.waitStartAt,
          waitEndAt: p.waitEndAt,
          leisureStartAt: p.leisureStartAt != null ? p.leisureStartAt : null,
          leisureEndAt: p.leisureEndAt != null ? p.leisureEndAt : null,
          leisureDomain: p.leisureDomain != null ? p.leisureDomain : null,
          leisureGenreId: genreId,
        });
        dlog('STATS_RECORD recorded', { genreId });
      } catch (e) {
        dwarn('STATS_RECORD: recordCycle threw', e);
      }
      return;
    }

    default:
      dwarn('_handleMessage: unknown type', type);
  }
}
