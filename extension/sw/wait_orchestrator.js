/**
 * WaitOrchestrator
 *
 * 中核体験ループ (待ち発生 -> 娯楽タブ切替 -> 完了 -> Claude.ai タブ戻り) のオーケストレーター。
 *
 * 関連 FR: FR-03, FR-05, FR-06, FR-07, FR-08
 * 関連ルール: BR-12, BR-13, BR-14, BR-22
 */

import * as TabManager from './tab_manager.js';
import * as SettingsRepository from './settings_repository.js';
import * as RuntimeState from './runtime_state.js';

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][SW]', ...args);
}

/**
 * 「待ち発生」イベントを処理する。
 *
 * BR-12: isWaiting=true の間は重複発火を抑制する
 *
 * @param {number|null} claudeTabId 待ち発生元の Claude.ai タブの ID
 * @param {number} _durationMs 既経過時間 (ログ用、未使用)
 */
export async function onWaitDetected(claudeTabId, _durationMs) {
  dlog('onWaitDetected', { claudeTabId, isWaiting: RuntimeState.isWaiting() });

  // 重複イベント抑制 (BR-12, Property 1)
  if (RuntimeState.isWaiting()) {
    dlog('skipped: already waiting');
    return;
  }

  await RuntimeState.setWaiting(true);
  await RuntimeState.setClaudeTabId(claudeTabId);

  let sites;
  try {
    sites = await SettingsRepository.getSites();
    dlog('sites loaded', sites);
  } catch (e) {
    console.error('[WaitLess][SW] getSites failed', e);
    await RuntimeState.setWaiting(false);
    return;
  }

  // 登録 0件 → 何もしない (Options Page 側で空状態案内)
  if (!sites || sites.length === 0) {
    dlog('no registered sites; aborting');
    await RuntimeState.setWaiting(false);
    return;
  }

  const result = await TabManager.findOrOpenPlaySite(sites);
  dlog('findOrOpenPlaySite result', result);
  if (!result) {
    // 異常: ウィンドウ取得失敗等
    dlog('findOrOpenPlaySite returned null; aborting');
    await RuntimeState.setWaiting(false);
    return;
  }

  // 動画再生試行 (BR-10): 既存/新規いずれの場合も注入を試行
  await TabManager.injectPlaybackTrigger(result.tabId);

  // 切替先タブをアクティブ化 (新規作成は create({active:true}) で済むが、
  // 既存タブヒット時は明示的に activateTab を呼ぶ必要がある。
  // 念のため両方のケースで呼ぶ (ウィンドウフォーカスも揃える))
  await TabManager.activateTab(result.tabId);

  await RuntimeState.setPlayTabId(result.tabId);
  dlog('switched to play tab', result.tabId);
}

/**
 * 「完了検知」イベントを処理する。
 *
 * BR-13: 待ち中でなければ no-op
 * BR-14: 戻り先タブ消失時のフォールバック
 *
 * @param {number|null} claudeTabId 完了発火元の Claude.ai タブの ID
 */
export async function onCompletionDetected(claudeTabId) {
  if (!RuntimeState.isWaiting()) {
    return; // ガード (BR-13)
  }

  // 娯楽タブの動画を一時停止 (戻る前に)
  const playTabId = RuntimeState.getPlayTabId();
  if (playTabId != null) {
    await TabManager.injectPlaybackPause(playTabId);
  }

  const recordedId = RuntimeState.getClaudeTabId();
  const targetCandidate = recordedId != null ? recordedId : claudeTabId;

  let activated = false;

  if (targetCandidate != null && (await TabManager.tabExists(targetCandidate))) {
    await TabManager.activateTab(targetCandidate);
    activated = true;
  } else {
    // フォールバック: Claude.ai タブを再探索 (BR-14)
    const fallback = await TabManager.findClaudeTab();
    if (fallback != null) {
      await TabManager.activateTab(fallback);
      activated = true;
    }
  }

  if (!activated) {
    console.info('[WaitLess] no Claude.ai tab to activate; staying as is');
  }

  // 状態リセット (BR-22)
  await RuntimeState.setWaiting(false);
  await RuntimeState.setPlayTabId(null);
  await RuntimeState.setClaudeTabId(null);
}

/**
 * 異常系リカバリ用に、状態を初期化する
 */
export async function reset() {
  await RuntimeState.reset();
}
