// cycle-6 自動検証: LeisureClassifier.classify の分類正しさ (BR-87/88/89)
// 実行: node aidlc-docs/construction/build-and-test/verify-classifier.mjs
import { classify, getGenreDefs } from '../../../extension/sw/leisure_classifier.js';

let pass = 0, fail = 0;
function eq(label, actual, expected) {
  if (actual === expected) { pass++; }
  else { fail++; console.error(`FAIL: ${label} => got "${actual}", expected "${expected}"`); }
}

// ホスト名一致
eq('youtube video', classify('https://www.youtube.com/watch?v=abc').genreId, 'video');
eq('music.youtube → music', classify('https://music.youtube.com/').genreId, 'music');
eq('netflix domain', classify('https://www.netflix.com/jp/').genreId, 'video');
eq('spotify', classify('https://open.spotify.com/').genreId, 'music');
eq('x.com sns', classify('https://x.com/home').genreId, 'sns');
eq('instagram sns', classify('https://www.instagram.com/').genreId, 'sns');
eq('yahoo news', classify('https://news.yahoo.co.jp/').genreId, 'news');
eq('shopping.yahoo ec', classify('https://shopping.yahoo.co.jp/').genreId, 'ec');
eq('steam game', classify('https://store.steampowered.com/').genreId, 'game');
eq('cookpad cooking', classify('https://cookpad.com/').genreId, 'cooking');
eq('jalan travel', classify('https://www.jalan.net/').genreId, 'travel');
eq('headspace relax', classify('https://www.headspace.com/jp').genreId, 'relax');
eq('shonenjump manga', classify('https://shonenjumpplus.com/').genreId, 'manga');
eq('dazn sports', classify('https://www.dazn.com/ja-JP/home').genreId, 'sports');
eq('zenn reading', classify('https://zenn.dev/').genreId, 'reading');

// ドメイン一致 (eTLD+1)
eq('amazon.co.jp ec (domain)', classify('https://www.amazon.co.jp/').genreId, 'ec');
eq('sub.netflix domain fallback', classify('https://help.netflix.com/').genreId, 'video');

// reader (内蔵) → reading
eq('reader internal', classify('chrome-extension://abcdefghijklmnopabcdefghijklmnop/reader/reader.html').genreId, 'reading');

// 未知 → other
eq('unknown other', classify('https://example.org/foo').genreId, 'other');
eq('invalid url other', classify('not a url').genreId, 'other');
eq('empty other', classify('').genreId, 'other');

// getGenreDefs に other を含む 13 件
const defs = getGenreDefs();
eq('genre defs count', defs.length, 13);
eq('genre defs has other', defs.some(d => d.id === 'other'), true);

console.log(`\nClassifier: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
