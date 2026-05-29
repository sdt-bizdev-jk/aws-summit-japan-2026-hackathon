/**
 * ContextRepository (cycle-7)
 *
 * 待ち時間ブラウジング文脈の取り込み。
 *   1. 完了直前に遷移先タブの内容を取得 (captureFromTab)
 *   2. Amazon Bedrock 要約 (※デモ用ハードコード) を生成 (buildBedrockSummary)
 *   3. AI タブへ戻った後、取り込みパネルを注入 (offerReflection)
 *      → ユーザーが「反映」を押すと Claude.ai の入力欄へ追記する
 *
 * スコープ: Chrome のみ。外部送信なし (要約はローカルでハードコード生成)。
 * best-effort: 失敗してもコア体験 (待ち→切替→完了→戻り) を阻害しない (NFR-04)。
 *
 * 関連要件: FR-01/02/04/05/06/07, NFR-01/04/06
 */

const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[WaitLess][Context]', ...args);
}

/**
 * 遷移先タブの可視内容を取得する (FR-01/02)。
 * executeScript(func) でページ内 1 回実行し、結果を直接受け取る。
 * @param {number} tabId
 * @returns {Promise<object|null>} LeisureContextSnapshot 相当。失敗時 null
 */
export async function captureFromTab(tabId) {
  if (tabId == null) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = (tab && tab.url) || '';
    // chrome:// や拡張ページ等は取得対象外 (best-effort)
    if (!/^https?:/i.test(url)) {
      dlog('skip capture (non-http)', url);
      return null;
    }

    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const txt = (el) => (el && el.textContent ? el.textContent.trim() : '');
        const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
          .map(txt).filter(Boolean).slice(0, 8);
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map((a) => ({ text: (a.textContent || '').trim(), href: a.href }))
          .filter((l) => l.text && l.text.length > 1 && /^https?:/i.test(l.href))
          .slice(0, 10);
        let excerpt = '';
        const main = document.querySelector('main, article, #content') || document.body;
        if (main) excerpt = (main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
        const selection = (window.getSelection && window.getSelection().toString().trim()) || '';
        return {
          url: location.href,
          title: document.title || '',
          headings,
          links,
          excerpt,
          selection,
        };
      },
    });

    const ctx = res && res.result ? res.result : null;
    if (!ctx) return null;
    ctx.domain = extractHost(ctx.url);
    ctx.capturedAt = Date.now();
    dlog('captured', { title: ctx.title, domain: ctx.domain, headings: ctx.headings.length });
    return ctx;
  } catch (e) {
    dlog('captureFromTab failed (ignored)', e);
    return null;
  }
}

/**
 * AI タブ (claude.ai) のタスク/プロジェクト文脈を取得する (cycle-7, best-effort)。
 * 会話タイトル + 直近のユーザー発話の抜粋を返す。
 * @param {number} claudeTabId
 * @returns {Promise<{taskTitle:string, taskText:string}|null>}
 */
export async function captureTaskContext(claudeTabId) {
  if (claudeTabId == null) return null;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: claudeTabId },
      func: () => {
        const title = (document.title || '')
          .replace(/\s*[-–|]\s*Claude.*$/i, '')
          .trim();
        let taskText = '';
        const cands = document.querySelectorAll(
          '[data-testid="user-message"], .font-user-message, [data-message-author-role="user"]',
        );
        if (cands && cands.length) {
          taskText = (cands[cands.length - 1].innerText || '')
            .replace(/\s+/g, ' ').trim().slice(0, 200);
        }
        return { taskTitle: title || 'Claude セッション', taskText };
      },
    });
    return res && res.result ? res.result : null;
  } catch (e) {
    dlog('captureTaskContext failed (ignored)', e);
    return null;
  }
}

/**
 * デスクリサーチ用ダイジェスト (※デモ用ハードコード)。
 * タスク文脈を踏まえて、閲覧ページを短く要約する。
 * @param {{taskTitle?:string}} task
 * @param {object} ctx LeisureContextSnapshot
 * @returns {string}
 */
export function buildResearchDigest(task, ctx) {
  const proj = (task && task.taskTitle) || '作業中のタスク';
  let points = [];
  if (ctx.headings && ctx.headings.length) points = ctx.headings.slice(0, 3);
  else if (ctx.title) points = [ctx.title];
  else if (ctx.links && ctx.links.length) points = ctx.links.slice(0, 3).map((l) => l.text);
  const bullets = points.map((p) => `・${p}`).join('\n');
  return [
    `【ローカル簡易要約】「${proj}」の待ち時間に ${ctx.domain || '外部サイト'} を閲覧。`,
    bullets,
  ].filter(Boolean).join('\n');
}

function extractHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_e) {
    return '';
  }
}

/**
 * Amazon Bedrock による要約 (※デモ用ハードコード / FR-06c, BR-05)。
 * 実際には外部呼び出しを行わず、取得済み文脈をテンプレート整形する。
 * @param {object} ctx LeisureContextSnapshot
 * @returns {string}
 */
export function buildBedrockSummary(ctx) {
  if (!ctx) return '';
  // 選択テキスト優先、無ければ見出し、無ければリンク文言、最後に本文抜粋
  let points = [];
  if (ctx.selection) {
    points = [ctx.selection.slice(0, 120)];
  } else if (ctx.headings && ctx.headings.length) {
    points = ctx.headings.slice(0, 5);
  } else if (ctx.links && ctx.links.length) {
    points = ctx.links.slice(0, 5).map((l) => l.text);
  } else if (ctx.excerpt) {
    points = [ctx.excerpt.slice(0, 120)];
  }

  const bullets = points.map((p) => `・${p}`).join('\n');
  const site = ctx.title || ctx.domain || '閲覧ページ';

  return [
    '【Amazon Bedrock 要約】待ち時間に見ていた内容を反映します。',
    `参照: ${site}（${ctx.domain}）`,
    bullets,
    '',
    '上記の気になったポイントを踏まえて、続きをお願いします。',
  ].filter((s) => s !== null && s !== undefined).join('\n');
}

/**
 * AI タブへ取り込みパネルを注入し、ユーザー確認のうえ入力欄へ反映する (FR-04/05/07)。
 * @param {number} claudeTabId
 * @param {object} ctx
 * @param {string} summary
 */
export async function offerReflection(claudeTabId, ctx, summary) {
  if (claudeTabId == null || !ctx) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: claudeTabId },
      func: injectReflectionPanel,
      args: [
        {
          title: ctx.title || '',
          domain: ctx.domain || '',
          url: ctx.url || '',
          summary: summary || '',
        },
      ],
    });
    dlog('offerReflection injected into claude tab', claudeTabId);
  } catch (e) {
    dlog('offerReflection failed (ignored)', e);
  }
}

/**
 * Claude.ai タブ内で実行される (executeScript func)。自己完結であること。
 * 取り込みパネルを画面右下に表示し、「反映」で入力欄へ追記する。
 */
function injectReflectionPanel(data) {
  const PANEL_ID = 'waitless-context-panel';
  const old = document.getElementById(PANEL_ID);
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = PANEL_ID;
  wrap.style.cssText = [
    'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
    'width:360px', 'max-width:90vw', 'background:#1B1B38', 'color:#fff',
    'border:1px solid #3a3a66', 'border-radius:12px',
    'box-shadow:0 8px 28px rgba(0,0,0,.35)', 'font-family:system-ui,-apple-system,sans-serif',
    'overflow:hidden',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 14px;background:#262652;';
  const badge = document.createElement('span');
  badge.textContent = 'Amazon Bedrock';
  badge.style.cssText = 'font-size:10px;font-weight:700;background:#E5238E;color:#fff;padding:3px 8px;border-radius:10px;';
  const htitle = document.createElement('span');
  htitle.textContent = '待ち時間の文脈を取り込み';
  htitle.style.cssText = 'font-size:14px;font-weight:700;';
  header.appendChild(badge);
  header.appendChild(htitle);

  const body = document.createElement('div');
  body.style.cssText = 'padding:12px 14px;';
  const src = document.createElement('div');
  src.textContent = '参照: ' + (data.title || data.domain || '閲覧ページ');
  src.style.cssText = 'font-size:12px;color:#B9B4E0;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  const box = document.createElement('div');
  box.textContent = data.summary || '';
  box.style.cssText = 'font-size:12.5px;line-height:1.6;background:#2E2E5C;border-radius:8px;padding:10px;white-space:pre-wrap;max-height:180px;overflow:auto;';
  body.appendChild(src);
  body.appendChild(box);

  const foot = document.createElement('div');
  foot.style.cssText = 'display:flex;gap:8px;padding:0 14px 14px;';
  const btnApply = document.createElement('button');
  btnApply.textContent = 'AI入力欄に反映';
  btnApply.style.cssText = 'flex:1;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:13px;cursor:pointer;background:#E5238E;color:#fff;';
  const btnClose = document.createElement('button');
  btnClose.textContent = '閉じる';
  btnClose.style.cssText = 'border:1px solid #4a4a7a;border-radius:8px;padding:10px 14px;font-size:13px;cursor:pointer;background:transparent;color:#C9C2F2;';
  foot.appendChild(btnApply);
  foot.appendChild(btnClose);

  wrap.appendChild(header);
  wrap.appendChild(body);
  wrap.appendChild(foot);
  document.body.appendChild(wrap);

  btnClose.addEventListener('click', () => wrap.remove());

  btnApply.addEventListener('click', () => {
    const text = data.summary || '';
    const editor =
      document.querySelector('div.ProseMirror[contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector('textarea');
    let ok = false;
    if (editor) {
      try {
        editor.focus();
        if (editor.tagName === 'TEXTAREA') {
          const start = editor.value ? editor.value + '\n\n' : '';
          editor.value = start + text;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // contenteditable (ProseMirror): execCommand で適切な input イベントを発火
          document.execCommand('insertText', false, (editor.textContent ? '\n\n' : '') + text);
        }
        ok = true;
      } catch (_e) {
        ok = false;
      }
    }
    if (!ok) {
      // フォールバック: クリップボードへコピー
      try { navigator.clipboard.writeText(text); } catch (_e) {}
      btnApply.textContent = 'コピーしました（貼り付けてください）';
      setTimeout(() => wrap.remove(), 1800);
      return;
    }
    btnApply.textContent = '反映しました';
    setTimeout(() => wrap.remove(), 900);
  });

  // 一定時間操作がなければ自動で閉じる (邪魔をしない)
  setTimeout(() => {
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
  }, 30000);
}
