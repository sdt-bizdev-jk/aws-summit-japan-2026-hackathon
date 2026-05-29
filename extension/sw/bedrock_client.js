/**
 * BedrockClient (cycle-7)
 *
 * Amazon Bedrock Runtime (InvokeModel) を Service Worker から直接呼び出す軽量クライアント。
 *
 * 認証方式 (優先順):
 *   1. Bearer Token (短期APIキー): bedrockApiKey が設定されている場合
 *      → Authorization: Bearer <token> ヘッダーを使用 (SigV4不要)
 *      → 環境変数: AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-XXX"
 *   2. SigV4 署名: accessKeyId / secretAccessKey が設定されている場合
 *      → Web Crypto (crypto.subtle) で自前実装 (外部ライブラリ不使用)
 *
 * 認証情報は Options Page で設定し chrome.storage.local.bedrock_config に保存する:
 *   Bearer Token: { region, modelId, bedrockApiKey }
 *   SigV4:        { region, modelId, accessKeyId, secretAccessKey, sessionToken? }
 *
 * 未設定 / 失敗時は null を返す (呼び出し側でローカル要約にフォールバック)。
 * best-effort。デモ用途。
 */

const SERVICE = 'bedrock';
const DEBUG = true;
function dlog(...args) { if (DEBUG) console.log('[WaitLess][Bedrock]', ...args); }
function dwarn(...args) { console.warn('[WaitLess][Bedrock]', ...args); }

const enc = new TextEncoder();

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', typeof str === 'string' ? enc.encode(str) : str);
  return hex(new Uint8Array(buf));
}
function hex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return new Uint8Array(sig);
}
async function signingKey(secret, dateStamp, region) {
  let k = await hmac(enc.encode('AWS4' + secret), dateStamp);
  k = await hmac(k, region);
  k = await hmac(k, SERVICE);
  k = await hmac(k, 'aws4_request');
  return k;
}

/**
 * 設定を読む。
 * Bearer Token (bedrockApiKey) または SigV4 (accessKeyId + secretAccessKey) のどちらかが
 * 揃っていれば有効な設定として返す。
 * @returns {Promise<object|null>}
 */
export async function getConfig() {
  try {
    const res = await chrome.storage.local.get('bedrock_config');
    const c = res && res.bedrock_config;
    if (!c || !c.region || !c.modelId) return null;
    // Bearer Token 認証
    if (c.bedrockApiKey) return c;
    // SigV4 認証
    if (c.accessKeyId && c.secretAccessKey) return c;
    return null;
  } catch (_e) {
    return null;
  }
}

export async function isConfigured() {
  return (await getConfig()) != null;
}

/**
 * Bedrock の Claude (messages API) でテキスト生成する。
 * @param {string} prompt
 * @param {number} [maxTokens]
 * @returns {Promise<string|null>}
 */
export async function invoke(prompt, maxTokens = 400) {
  const cfg = await getConfig();
  if (!cfg) {
    dlog('invoke skipped: not configured (region/modelId と bedrockApiKey または accessKeyId/secretAccessKey が必要)');
    return null;
  }
  dlog('invoke start', { region: cfg.region, modelId: cfg.modelId, authMode: cfg.bedrockApiKey ? 'bearer' : 'sigv4' });

  const host = `bedrock-runtime.${cfg.region}.amazonaws.com`;
  const wireSeg = encodeURIComponent(cfg.modelId);
  const endpoint = `https://${host}/model/${wireSeg}/invoke`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    let headers;

    if (cfg.bedrockApiKey) {
      // --- Bearer Token 認証 (短期APIキー) ---
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.bedrockApiKey}`,
      };
      dlog('using Bearer Token auth');
    } else {
      // --- SigV4 署名認証 ---
      // SigV4 (S3以外) の正規URIは、送出パスをさらにもう一度エンコードする (double encode)。
      const canonicalUri = `/model/${encodeURIComponent(wireSeg)}/invoke`;

      const now = new Date();
      const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzdate.slice(0, 8);

      const payloadHash = await sha256Hex(body);

      let canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzdate}\n`;
      let signedHeaders = 'content-type;host;x-amz-date';
      if (cfg.sessionToken) {
        canonicalHeaders += `x-amz-security-token:${cfg.sessionToken}\n`;
        signedHeaders += ';x-amz-security-token';
      }

      const canonicalRequest = ['POST', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
      const scope = `${dateStamp}/${cfg.region}/${SERVICE}/aws4_request`;
      const stringToSign = ['AWS4-HMAC-SHA256', amzdate, scope, await sha256Hex(canonicalRequest)].join('\n');

      const key = await signingKey(cfg.secretAccessKey, dateStamp, cfg.region);
      const signature = hex(await hmac(key, stringToSign));
      const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      headers = {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzdate,
        'Authorization': authorization,
      };
      if (cfg.sessionToken) headers['X-Amz-Security-Token'] = cfg.sessionToken;
      dlog('using SigV4 auth');
    }

    const resp = await fetch(endpoint, { method: 'POST', headers, body });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      dwarn('invoke HTTP error', resp.status, t.slice(0, 200));
      return null;
    }
    const data = await resp.json();
    const text = data && Array.isArray(data.content)
      ? data.content.map((c) => (c && c.text) || '').join('').trim()
      : '';
    dlog('invoke ok', { chars: text.length });
    return text || null;
  } catch (e) {
    dwarn('invoke failed', e);
    return null;
  }
}

/**
 * 訪問ページの内容を、タスク文脈を踏まえて要約する。
 * @param {{taskTitle?:string}} task
 * @param {object} ctx LeisureContextSnapshot (title, headings, excerpt, domain)
 * @returns {Promise<string|null>}
 */
export async function summarizePage(task, ctx) {
  if (!ctx) return null;
  if (!(await isConfigured())) return null;

  const proj = (task && task.taskTitle) || '作業中のタスク';
  const headings = (ctx.headings || []).slice(0, 8).join(' / ');
  const prompt = [
    `あなたはリサーチ補佐です。次のWebページを、ユーザーが取り組んでいるタスク「${proj}」の文脈を踏まえて日本語で要約してください。`,
    'タスクとの関連が分かるよう、箇条書き3〜4点で簡潔に。前置き不要。',
    '',
    `ページタイトル: ${ctx.title || ''}`,
    `ドメイン: ${ctx.domain || ''}`,
    `見出し: ${headings}`,
    `本文抜粋: ${(ctx.excerpt || '').slice(0, 3000)}`,
  ].join('\n');

  const out = await invoke(prompt, 400);
  return out;
}
