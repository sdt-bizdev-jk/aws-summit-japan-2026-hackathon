/**
 * EntertainmentAds (cycle-7)
 *
 * 待ち時間に切替先タブへ「広告風ポップアップ」を表示し、最新映画予告などの
 * ショートムービー / 読書を“ちょい外し”のレコメンドとして差し込む。
 * → 関連だけでなく偶然の出会い (セレンディピティ) を生む。
 *
 * スコープ: Chrome のみ。レコメンドはハードコード。外部送信なし。
 * best-effort: 失敗してもコア体験を阻害しない。
 *
 * デモ: 【デモ2】エンタメ発見 / 遷移先: 映画ショート紹介・読書 / 機能: 広告のようにポップアップ
 */

import * as TabManager from './tab_manager.js';

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][Ads]', ...args);
}

/**
 * レコメンド (ハードコード)。url は YouTube/書籍検索にして常に有効なリンクにする。
 * @type {Array<{kind:string,badge:string,emoji:string,accent:string,title:string,desc:string,cta:string,url:string}>}
 */
const ADS = [
  {
    kind: 'movie', badge: '最新予告', emoji: '🎬', accent: '#E5238E',
    title: '話題の最新映画 予告編',
    desc: '今週公開の注目作をショートでチェック',
    cta: 'YouTube で開く',
    videoId: 'aqz-KE-bpKQ', // Big Buck Bunny (埋め込み可・デモ用)
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    kind: 'movie', badge: 'PR', emoji: '🍿', accent: '#7C3AED',
    title: '今夜観るならこの1本',
    desc: '配信中の話題作トレーラー',
    cta: 'YouTube で開く',
    videoId: 'eRsGyueVLvQ', // Sintel (Blender 公開作品・埋め込み可)
    url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
  },
  {
    kind: 'movie', badge: '発見', emoji: '🎥', accent: '#2563EB',
    title: 'いつもと違うジャンルを1本',
    desc: '普段選ばない作品との出会い',
    cta: 'YouTube で開く',
    videoId: 'R6MlUcmOul8', // Tears of Steel (Blender 公開作品・埋め込み可)
    url: 'https://www.youtube.com/watch?v=R6MlUcmOul8',
  },
  {
    kind: 'book', badge: '読書', emoji: '📖', accent: '#0EA5A4',
    title: '話題の一冊を試し読み',
    desc: '待ち時間にちょっと読書',
    cta: '試し読み',
    url: 'https://www.google.com/search?tbm=bks&q=話題の本+ベストセラー',
  },
];

/**
 * セレンディピティ枠を1件選ぶ (ランダム)。
 * @returns {object}
 */
export function pickAd() {
  return ADS[Math.floor(Math.random() * ADS.length)];
}

/**
 * 切替先タブへ広告風ポップアップを注入する (best-effort)。
 * @param {number} tabId
 * @param {object} [ad]
 */
export async function showAdPopup(tabId, ad) {
  if (tabId == null) return;

  // Chrome 設定で OFF なら表示しない (デフォルト ON。ads_enabled === false のみ無効)
  try {
    const stored = await chrome.storage.local.get('ads_enabled');
    if (stored && stored.ads_enabled === false) {
      dlog('ad popup disabled by setting');
      return;
    }
  } catch (_e) {
    // 取得失敗時はデフォルト ON として継続
  }

  const data = ad || pickAd();
  try {
    // 切替先の遷移 (navigate / 新規タブ) が完了してから注入する。
    // 完了前に注入するとポータル等の読込でポップアップ DOM が消える (遷移上書き対策)。
    try {
      await TabManager.waitForTabComplete(tabId);
    } catch (_e) {
      // 待機失敗は無視して継続
    }

    const t = await chrome.tabs.get(tabId);
    const url = (t && t.url) || '';
    // 内蔵ページ (chrome-extension:) と http(s) を許可 (ポータル/Reader もポップアップ対象)
    if (!/^https?:/i.test(url) && !/^chrome-extension:/i.test(url)) {
      dlog('skip ad (unsupported scheme)', url);
      return;
    }

    // 動画 ID があれば YouTube 埋め込み URL を直接渡す。
    // 埋め込みは AI タブ (https://claude.ai オリジン) で行う。
    // ※ chrome-extension:// オリジンからの埋め込みは YouTube に拒否され
    //   「エラー 153」になるため、内蔵プレイヤー経由にはしない。
    const payload = { ...data };
    if (data.videoId) {
      payload.videoSrc = 'https://www.youtube.com/embed/'
        + encodeURIComponent(data.videoId)
        + '?autoplay=1&mute=1&rel=0&playsinline=1';
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectAdPopup,
      args: [payload],
    });
    dlog('ad popup injected', { tabId, title: data.title });
  } catch (e) {
    dlog('showAdPopup failed (ignored)', e);
  }
}

/**
 * 切替先タブ内で実行される (executeScript func)。自己完結であること。
 * 画面右下に広告風カードをスライドインで表示し、CTA で新規タブを開く。
 */
function injectAdPopup(ad) {
  const ID = 'waitless-ad-popup';
  const old = document.getElementById(ID);
  if (old) old.remove();

  // 画面中央に薄い背景 (クリックで閉じる) + カードを表示
  const backdrop = document.createElement('div');
  backdrop.id = ID;
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(10,10,20,.45)', 'opacity:0', 'transition:opacity .3s ease',
    'font-family:system-ui,-apple-system,sans-serif',
  ].join(';');

  const hasVideo = !!ad.videoSrc;
  const card = document.createElement('div');
  card.style.cssText = [
    hasVideo ? 'width:640px' : 'width:380px', 'max-width:92vw',
    'background:#13132b', 'color:#fff',
    'border-radius:16px', 'box-shadow:0 18px 50px rgba(0,0,0,.5)', 'overflow:hidden',
    'transform:scale(.9)', 'opacity:0',
    'transition:transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s ease',
  ].join(';');

  const badge = document.createElement('span');
  badge.textContent = ad.badge || 'PR';
  badge.style.cssText = 'position:absolute;top:10px;left:10px;z-index:2;font-size:10px;font-weight:700;background:rgba(0,0,0,.6);padding:3px 8px;border-radius:10px;letter-spacing:.04em;';
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', '閉じる');
  close.style.cssText = 'position:absolute;top:8px;right:8px;z-index:2;width:26px;height:26px;border:none;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:16px;line-height:1;cursor:pointer;';

  // メディア領域: 動画があれば iframe (16:9)、無ければグラデ + 絵文字
  const thumb = document.createElement('div');
  if (hasVideo) {
    thumb.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;background:#000;';
    const iframe = document.createElement('iframe');
    iframe.src = ad.videoSrc;
    iframe.style.cssText = 'border:0;width:100%;height:100%;display:block;';
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    thumb.appendChild(iframe);
  } else {
    thumb.style.cssText = `position:relative;height:120px;display:flex;align-items:center;justify-content:center;font-size:52px;background:linear-gradient(135deg, ${ad.accent}, #1B1B38);`;
    thumb.textContent = ad.emoji || '🎬';
  }
  thumb.appendChild(badge);
  thumb.appendChild(close);

  const body = document.createElement('div');
  body.style.cssText = 'padding:12px 14px 14px;';
  const title = document.createElement('div');
  title.textContent = ad.title || '';
  title.style.cssText = 'font-size:15px;font-weight:700;margin-bottom:4px;';
  const desc = document.createElement('div');
  desc.textContent = ad.desc || '';
  desc.style.cssText = 'font-size:12px;color:#B9B4E0;margin-bottom:12px;';
  const cta = document.createElement('button');
  cta.textContent = (ad.cta || '見る') + ' →';
  cta.style.cssText = `width:100%;border:none;border-radius:9px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;background:${ad.accent};color:#fff;`;
  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(cta);

  card.appendChild(thumb);
  card.appendChild(body);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  // フェード + スケールイン
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    card.style.transform = 'scale(1)';
    card.style.opacity = '1';
  });

  const remove = () => {
    backdrop.style.opacity = '0';
    card.style.transform = 'scale(.92)';
    card.style.opacity = '0';
    setTimeout(() => backdrop.remove(), 320);
  };
  close.addEventListener('click', remove);
  // 背景クリックで閉じる (カード自体のクリックは無視)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) remove(); });
  cta.addEventListener('click', () => {
    try { window.open(ad.url, '_blank', 'noopener'); } catch (_e) {}
    remove();
  });

  // 一定時間で自動的に閉じる (邪魔しない)。動画は長めに表示。
  setTimeout(remove, hasVideo ? 60000 : 12000);
}
