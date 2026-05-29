/**
 * LeisureClassifier (cycle-6)
 *
 * 切替先 URL を 12 ジャンル + "other" のいずれかに分類する (FR-74)。
 * ポータルページ (cycle-5) の 12 ジャンルと 1:1 対応。
 *
 * 分類は段階マッチ (BR-87, A1=A):
 *   1. URL 完全一致 (GenreDef.urls)
 *   2. ホスト名一致 (サブドメイン込み、GenreDef.hosts)
 *   3. ドメイン一致 (eTLD+1 相当、GenreDef.domains)
 *   4. いずれもなし → "other"
 * 同一段階で複数マッチし得る場合は GENRE_DEFS 配列の先頭から最初の 1 つを採用 (決定的)。
 *
 * chrome-extension://.../reader/... は "reading" に固定分類 (BR-88)。
 * 不正 URL は "other" を返し、例外は投げない (BR-89、純粋関数)。
 *
 * 関連 FR: FR-74
 * 関連 BR: BR-87, BR-88, BR-89
 */

/**
 * @typedef {Object} GenreDef
 * @property {string} id
 * @property {string} label
 * @property {string} emoji
 * @property {string[]} urls    完全一致候補
 * @property {string[]} hosts   ホスト名候補 (サブドメイン込み、小文字)
 * @property {string[]} domains ドメイン候補 (eTLD+1 相当、小文字)
 */

/** @type {GenreDef[]} */
const GENRE_DEFS = [
  {
    id: 'video', label: '動画視聴', emoji: '🎬',
    urls: [],
    hosts: ['www.youtube.com', 'youtube.com', 'www.netflix.com', 'www.hulu.jp', 'www.disneyplus.com', 'abema.tv'],
    domains: ['netflix.com', 'hulu.jp', 'disneyplus.com', 'abema.tv'],
  },
  {
    id: 'music', label: '音楽', emoji: '🎵',
    urls: [],
    hosts: ['open.spotify.com', 'music.youtube.com', 'music.apple.com', 'music.amazon.co.jp', 'soundcloud.com', 'awa.fm'],
    domains: ['spotify.com', 'soundcloud.com', 'awa.fm'],
  },
  {
    id: 'ec', label: 'EC ショッピング', emoji: '🛒',
    urls: [],
    hosts: ['www.amazon.co.jp', 'www.rakuten.co.jp', 'shopping.yahoo.co.jp', 'zozo.jp', 'jp.mercari.com', 'www.yodobashi.com'],
    domains: ['amazon.co.jp', 'rakuten.co.jp', 'zozo.jp', 'mercari.com', 'yodobashi.com'],
  },
  {
    id: 'game', label: 'ゲーム', emoji: '🎮',
    urls: [],
    hosts: ['store.steampowered.com', 'store.epicgames.com', 'store-jp.nintendo.com', 'store.playstation.com', 'itch.io', 'games.yahoo.co.jp'],
    domains: ['steampowered.com', 'epicgames.com', 'nintendo.com', 'playstation.com', 'itch.io'],
  },
  {
    id: 'sns', label: 'SNS', emoji: '💬',
    urls: [],
    hosts: ['x.com', 'www.instagram.com', 'www.facebook.com', 'www.tiktok.com', 'www.reddit.com', 'www.threads.net'],
    domains: ['x.com', 'twitter.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'reddit.com', 'threads.net'],
  },
  {
    id: 'news', label: 'ニュース', emoji: '📰',
    urls: [],
    hosts: ['news.yahoo.co.jp', 'www3.nhk.or.jp', 'www.itmedia.co.jp', 'www.bloomberg.co.jp', 'www.gizmodo.jp', 'gigazine.net'],
    domains: ['nhk.or.jp', 'itmedia.co.jp', 'bloomberg.co.jp', 'gizmodo.jp', 'gigazine.net'],
  },
  {
    id: 'reading', label: '読書', emoji: '📖',
    urls: [],
    hosts: ['www.aozora.gr.jp', 'note.com', 'zenn.dev', 'kakuyomu.jp'],
    domains: ['aozora.gr.jp', 'note.com', 'zenn.dev', 'kakuyomu.jp'],
  },
  {
    id: 'manga', label: '漫画', emoji: '📚',
    urls: [],
    hosts: ['shonenjumpplus.com', 'piccoma.com', 'manga.line.me', 'www.cmoa.jp', 'pocket.shonenmagazine.com', 'mechacomic.jp'],
    domains: ['shonenjumpplus.com', 'piccoma.com', 'cmoa.jp', 'shonenmagazine.com', 'mechacomic.jp'],
  },
  {
    id: 'sports', label: 'スポーツ', emoji: '⚽',
    urls: [],
    hosts: ['www.dazn.com', 'sports.yahoo.co.jp', 'nba.rakuten.co.jp', 'www.jleague.jp', 'www.sumo.or.jp', 'number.bunshun.jp'],
    domains: ['dazn.com', 'jleague.jp', 'sumo.or.jp'],
  },
  {
    id: 'cooking', label: '料理', emoji: '🍳',
    urls: [],
    hosts: ['cookpad.com', 'delishkitchen.tv', 'www.kurashiru.com', 'oceans-nadia.com', 'recipe.rakuten.co.jp', 'erecipe.woman.excite.co.jp'],
    domains: ['cookpad.com', 'delishkitchen.tv', 'kurashiru.com', 'oceans-nadia.com'],
  },
  {
    id: 'travel', label: '旅行', emoji: '✈️',
    urls: [],
    hosts: ['www.jalan.net', 'travel.rakuten.co.jp', 'www.booking.com', 'www.airbnb.jp', 'www.tripadvisor.jp', 'www.expedia.co.jp'],
    domains: ['jalan.net', 'booking.com', 'airbnb.jp', 'tripadvisor.jp', 'expedia.co.jp'],
  },
  {
    id: 'relax', label: 'リラックス', emoji: '🧘',
    urls: [],
    hosts: ['www.headspace.com', 'www.calm.com'],
    domains: ['headspace.com', 'calm.com'],
  },
];

const OTHER_DEF = { id: 'other', label: 'その他', emoji: '🔖' };

/**
 * URL のホスト名を小文字で返す (失敗時は空文字)。
 */
function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_e) {
    return '';
  }
}

/**
 * ホスト名から eTLD+1 相当 (ドメイン) を抽出する。
 * 完全な PSL は持たず、日本でよくある 2 段 TLD (co.jp, ne.jp, or.jp, gr.jp, ac.jp,
 * go.jp, lg.jp, com など) を考慮した簡易ロジック。
 * 例: "news.yahoo.co.jp" -> "yahoo.co.jp"、"music.youtube.com" -> "youtube.com"
 */
function extractRegistrableDomain(hostname) {
  if (!hostname) return '';
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;

  const TWO_LEVEL_SUFFIXES = new Set([
    'co.jp', 'ne.jp', 'or.jp', 'gr.jp', 'ac.jp', 'go.jp', 'lg.jp', 'ed.jp',
    'co.uk', 'org.uk', 'com.au',
  ]);
  const lastTwo = parts.slice(-2).join('.');
  if (TWO_LEVEL_SUFFIXES.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * URL を 12 ジャンル + "other" に分類する (BR-87)。
 * @param {string} url
 * @returns {{ genreId: string, genreLabel: string, emoji: string }}
 */
export function classify(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return { genreId: OTHER_DEF.id, genreLabel: OTHER_DEF.label, emoji: OTHER_DEF.emoji };
  }

  // BR-88: 内蔵 Reader Page は "reading" に固定
  // chrome-extension://<id>/reader/reader.html 形式
  if (/^chrome-extension:\/\//i.test(url) && /\/reader\//i.test(url)) {
    const reading = GENRE_DEFS.find((g) => g.id === 'reading');
    return { genreId: 'reading', genreLabel: reading.label, emoji: reading.emoji };
  }

  // Pass 1: URL 完全一致
  for (const g of GENRE_DEFS) {
    if (g.urls && g.urls.includes(url)) {
      return { genreId: g.id, genreLabel: g.label, emoji: g.emoji };
    }
  }

  const host = getHostname(url);
  if (!host) {
    return { genreId: OTHER_DEF.id, genreLabel: OTHER_DEF.label, emoji: OTHER_DEF.emoji };
  }

  // Pass 2: ホスト名一致 (サブドメイン込み)
  for (const g of GENRE_DEFS) {
    if (g.hosts && g.hosts.includes(host)) {
      return { genreId: g.id, genreLabel: g.label, emoji: g.emoji };
    }
  }

  // Pass 3: ドメイン (eTLD+1) 一致
  const domain = extractRegistrableDomain(host);
  for (const g of GENRE_DEFS) {
    if (g.domains && g.domains.includes(domain)) {
      return { genreId: g.id, genreLabel: g.label, emoji: g.emoji };
    }
    // hosts にドメイン素体が入っているケースも拾う (例 x.com は hosts/domains 両方)
    if (g.hosts && g.hosts.includes(domain)) {
      return { genreId: g.id, genreLabel: g.label, emoji: g.emoji };
    }
  }

  // Pass 4: その他
  return { genreId: OTHER_DEF.id, genreLabel: OTHER_DEF.label, emoji: OTHER_DEF.emoji };
}

/**
 * 全ジャンル定義 (ラベル/絵文字) を返す。ダッシュボードの内訳ラベル表示用。
 * "other" を含む。
 * @returns {Array<{ id: string, label: string, emoji: string }>}
 */
export function getGenreDefs() {
  const defs = GENRE_DEFS.map((g) => ({ id: g.id, label: g.label, emoji: g.emoji }));
  defs.push({ id: OTHER_DEF.id, label: OTHER_DEF.label, emoji: OTHER_DEF.emoji });
  return defs;
}
