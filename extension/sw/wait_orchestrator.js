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
import * as StatsRepository from './stats_repository.js';
import * as LeisureClassifier from './leisure_classifier.js';
import * as ContextRepository from './context_repository.js';
import * as EntertainmentAds from './entertainment_ads.js';

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][SW]', ...args);
}

/**
 * cycle-6: 切替先タブの URL を取得して余暇種別を判定し、進行中サイクルへ補完する。
 * best-effort: 失敗してもコア体験を止めない (BR-97, NFR-74)。
 *
 * @param {number} tabId 切替先タブ
 */
async function attachLeisureStats(tabId) {
  try {
    const pending = RuntimeState.getStatsPending();
    if (!pending) return;

    let url = '';
    try {
      const tab = await chrome.tabs.get(tabId);
      url = (tab && tab.url) || (tab && tab.pendingUrl) || '';
    } catch (_e) {
      url = '';
    }

    const domain = TabManager.extractDomain(url);
    const { genreId } = LeisureClassifier.classify(url);

    pending.leisureStartAt = Date.now();
    pending.leisureDomain = domain || null;
    pending.leisureGenreId = genreId || null;
    await RuntimeState.setStatsPending(pending);
    dlog('attachLeisureStats', { tabId, domain, genreId });
  } catch (e) {
    dlog('attachLeisureStats failed (ignored)', e);
  }
}

/**
 * cycle-6: 進行中の統計サイクルを確定して stats_events へ記録する (BR-82, BR-83, BR-85)。
 * 切替なし (leisureStartAt=null) でも記録する (F6=A)。
 * best-effort: 失敗してもコア体験を止めない (BR-97)。
 */
async function finalizeStatsCycle() {
  try {
    const p = RuntimeState.getStatsPending();
    if (!p) return;

    const now = Date.now();
    const hasLeisure = p.leisureStartAt != null;
    const event = {
      id: p.id,
      source: 'chrome',
      waitStartAt: p.waitStartAt,
      waitEndAt: now,
      leisureStartAt: hasLeisure ? p.leisureStartAt : null,
      leisureEndAt: hasLeisure ? now : null,
      leisureGenreId: hasLeisure ? p.leisureGenreId : null,
      leisureDomain: hasLeisure ? p.leisureDomain : null,
      resumeActionAt: null,
      // 切替ありなら復帰監視対象 ('pending')、切替なしは対象外 (null)
      resumeOutcome: hasLeisure ? 'pending' : null,
      reLeftWithinStay: hasLeisure ? false : null,
      dateKey: p.dateKey || StatsRepository.toDateKey(p.waitStartAt),
    };
    await StatsRepository.appendEvent(event);
    await RuntimeState.setStatsPending(null);

    // 切替ありサイクルのみ、復帰操作/再離脱の解決対象として id を保持 (M-04/M-05)
    await RuntimeState.setStatsResumeTargetId(hasLeisure ? p.id : null);
    dlog('finalizeStatsCycle', event.id, 'hasLeisure=', hasLeisure);
  } catch (e) {
    dlog('finalizeStatsCycle failed (ignored)', e);
  }
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

  // cycle-6: 進行中の統計サイクルを開始 (BR-81, BR-83, F1=B)
  // 既存の未確定 pending があれば放棄して上書き (BR-81)
  try {
    const now = Date.now();
    await RuntimeState.setStatsPending({
      id: `chrome-${now}`,
      source: 'chrome',
      waitStartAt: now,
      leisureStartAt: null,
      leisureDomain: null,
      leisureGenreId: null,
      dateKey: StatsRepository.toDateKey(now),
    });
  } catch (e) {
    dlog('beginCycle (statsPending) failed (ignored)', e);
  }

  let sites;
  try {
    sites = await SettingsRepository.getSites();
    dlog('sites loaded', sites);
  } catch (e) {
    console.error('[WaitLess][SW] getSites failed', e);
    await RuntimeState.setWaiting(false);
    // cycle-6: statsPending は残し、完了時に「切替なしサイクル」として確定する (F6=A, BR-83)
    return;
  }

  // 登録 0件 → 何もしない (Options Page 側で空状態案内)
  if (!sites || sites.length === 0) {
    dlog('no registered sites; aborting');
    await RuntimeState.setWaiting(false);
    // cycle-6: statsPending は残し、完了時に「切替なしサイクル」として確定する (F6=A, BR-83)
    return;
  }

  // cycle-7: エンタメ発見ポップアップが有効な場合、外部タブへは一切遷移しない。
  // タブ切替の代わりに、現在の AI タブ (claude.ai) 中央へポップアップを表示する。
  let adsEnabled = true;
  try {
    const stored = await chrome.storage.local.get('ads_enabled');
    adsEnabled = !(stored && stored.ads_enabled === false);
  } catch (_e) {
    adsEnabled = true;
  }

  if (adsEnabled) {
    dlog('ads on; showing popup on AI tab without switching tabs');
    await RuntimeState.setWaiting(false);
    if (claudeTabId != null) {
      await EntertainmentAds.showAdPopup(claudeTabId);
    }
    return;
  }

  const result = await TabManager.findOrOpenPlaySite(sites);
  dlog('findOrOpenPlaySite result', result);
  if (!result) {
    // 異常: ウィンドウ取得失敗等
    dlog('findOrOpenPlaySite returned null; aborting');
    await RuntimeState.setWaiting(false);
    // cycle-6: statsPending は残し、完了時に「切替なしサイクル」として確定する (F6=A, BR-83)
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

  // cycle-6: 切替先の余暇種別を判定して進行中サイクルに補完 (BR-84, A5=A)
  await attachLeisureStats(result.tabId);
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
  // cycle-6: 統計サイクルの確定 (isWaiting ガードより前。切替なしでも記録する F6=A, BR-83)
  // ClaudeSiteAdapter は WAIT_DETECTED 送信済みなら必ず COMPLETION_DETECTED を送る。
  await finalizeStatsCycle();

  if (!RuntimeState.isWaiting()) {
    return; // ガード (BR-13)
  }

  // 娯楽タブの動画を一時停止 (戻る前に)
  const playTabId = RuntimeState.getPlayTabId();

  // cycle-7: 一時停止の前に、遷移先タブの閲覧文脈を取得する (FR-01, best-effort)
  let leisureContext = null;
  if (playTabId != null) {
    leisureContext = await ContextRepository.captureFromTab(playTabId);
    await TabManager.injectPlaybackPause(playTabId);
  }

  const recordedId = RuntimeState.getClaudeTabId();
  const targetCandidate = recordedId != null ? recordedId : claudeTabId;

  let activated = false;
  let activatedTabId = null;

  if (targetCandidate != null && (await TabManager.tabExists(targetCandidate))) {
    await TabManager.activateTab(targetCandidate);
    activated = true;
    activatedTabId = targetCandidate;
  } else {
    // フォールバック: Claude.ai タブを再探索 (BR-14)
    const fallback = await TabManager.findClaudeTab();
    if (fallback != null) {
      await TabManager.activateTab(fallback);
      activated = true;
      activatedTabId = fallback;
    }
  }

  if (!activated) {
    console.info('[WaitLess] no Claude.ai tab to activate; staying as is');
  }

  // cycle-7: AI タブへ戻った後、取り込みパネルを提示する (FR-04/05, best-effort)
  if (activatedTabId != null && leisureContext) {
    const summary = ContextRepository.buildBedrockSummary(leisureContext);
    await ContextRepository.offerReflection(activatedTabId, leisureContext, summary);
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

/**
 * cycle-6: 復帰後の最初のユーザー操作を受けて集中復帰秒数を解決する (BR-93, M-05)。
 * @param {number} at 操作時刻 (epoch ms)
 */
export async function onResumeAction(at) {
  try {
    const id = RuntimeState.getStatsResumeTargetId();
    if (!id) return;
    const resumeAt = (typeof at === 'number' && isFinite(at)) ? at : Date.now();
    await StatsRepository.resolveResume(id, { resumeActionAt: resumeAt, outcome: 'resumed' });
    // 解決済みなので対象をクリア (再離脱判定は別途継続する場合があるが、復帰は一度きり)
    await RuntimeState.setStatsResumeTargetId(null);
    dlog('onResumeAction resolved', id);
  } catch (e) {
    dlog('onResumeAction failed (ignored)', e);
  }
}

/**
 * cycle-6: 復帰タイムアウト (操作なし) を受けて未復帰として確定する (BR-94, M-07)。
 */
export async function onResumeTimeout() {
  try {
    const id = RuntimeState.getStatsResumeTargetId();
    if (!id) return;
    await StatsRepository.resolveResume(id, { resumeActionAt: null, outcome: 'timeout' });
    await RuntimeState.setStatsResumeTargetId(null);
    dlog('onResumeTimeout resolved', id);
  } catch (e) {
    dlog('onResumeTimeout failed (ignored)', e);
  }
}

/**
 * cycle-6: 復帰後しきい値内の自発的な再離脱を記録する (BR-90, BR-91, M-04)。
 */
export async function onReLeft() {
  try {
    const id = RuntimeState.getStatsResumeTargetId();
    if (!id) return;
    await StatsRepository.markReLeft(id, true);
    dlog('onReLeft recorded', id);
  } catch (e) {
    dlog('onReLeft failed (ignored)', e);
  }
}
