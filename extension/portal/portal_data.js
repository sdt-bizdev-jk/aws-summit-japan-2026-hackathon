/**
 * WaitLess Portal Data (cycle-5)
 *
 * 娯楽ポータルページ用の静的データ。
 * window.PORTAL_DATA としてグローバルに公開する。
 *
 * 関連 Functional Design: BR-74, BR-77 (Application Design §2.2 / functional-design/business-rules.md)
 *
 * スキーマ:
 *   window.PORTAL_DATA: Array<{
 *     genre: string,            // ジャンル表示名
 *     emoji: string,            // ジャンルの代表絵文字
 *     cards: Array<{
 *       name:   string,         // サイト名
 *       url:    string,         // 完全URL (http(s)://)
 *       emoji?: string,         // カード固有絵文字 (省略時は genre.emoji を継承)
 *     }>
 *   }>
 *
 * 注意: Reader Page (内蔵) の URL は実行時に組み立てるため、ここではプレースホルダ
 *      "__READER_INTERNAL__" を入れる。portal.js が injectInternalUrls() で実 URL に置換する。
 */

window.PORTAL_DATA = [
  {
    genre: "動画視聴",
    emoji: "🎬",
    cards: [
      { name: "YouTube",            url: "https://www.youtube.com/",            emoji: "▶️" },
      { name: "Netflix",            url: "https://www.netflix.com/jp/",         emoji: "🎞️" },
      { name: "Amazon Prime Video", url: "https://www.amazon.co.jp/Prime-Video", emoji: "📺" },
      { name: "Hulu",               url: "https://www.hulu.jp/",                emoji: "💚" },
      { name: "Disney+",            url: "https://www.disneyplus.com/ja-jp",    emoji: "🏰" },
      { name: "ABEMA",              url: "https://abema.tv/",                   emoji: "🟢" },
    ],
  },
  {
    genre: "音楽",
    emoji: "🎵",
    cards: [
      { name: "Spotify",       url: "https://open.spotify.com/",       emoji: "🟢" },
      { name: "YouTube Music", url: "https://music.youtube.com/",      emoji: "🎶" },
      { name: "Apple Music",   url: "https://music.apple.com/jp/",     emoji: "🍎" },
      { name: "Amazon Music",  url: "https://music.amazon.co.jp/",     emoji: "🎧" },
      { name: "SoundCloud",    url: "https://soundcloud.com/",         emoji: "☁️" },
      { name: "AWA",           url: "https://awa.fm/",                 emoji: "🎼" },
    ],
  },
  {
    genre: "EC ショッピング",
    emoji: "🛒",
    cards: [
      { name: "Amazon",           url: "https://www.amazon.co.jp/",        emoji: "📦" },
      { name: "楽天市場",         url: "https://www.rakuten.co.jp/",       emoji: "🛍️" },
      { name: "Yahoo!ショッピング", url: "https://shopping.yahoo.co.jp/",    emoji: "🟣" },
      { name: "ZOZOTOWN",         url: "https://zozo.jp/",                 emoji: "👕" },
      { name: "メルカリ",         url: "https://jp.mercari.com/",          emoji: "🔄" },
      { name: "ヨドバシ.com",     url: "https://www.yodobashi.com/",       emoji: "💡" },
    ],
  },
  {
    genre: "ゲーム",
    emoji: "🎮",
    cards: [
      { name: "Steam",            url: "https://store.steampowered.com/",       emoji: "🚂" },
      { name: "Epic Games",       url: "https://store.epicgames.com/ja/",       emoji: "⚔️" },
      { name: "Nintendo Store",   url: "https://store-jp.nintendo.com/",        emoji: "🍄" },
      { name: "PlayStation",      url: "https://store.playstation.com/ja-jp/",  emoji: "🎯" },
      { name: "itch.io",          url: "https://itch.io/",                      emoji: "🕹️" },
      { name: "Yahoo!ゲーム",     url: "https://games.yahoo.co.jp/",            emoji: "👾" },
    ],
  },
  {
    genre: "SNS",
    emoji: "💬",
    cards: [
      { name: "X (Twitter)", url: "https://x.com/home",                 emoji: "✖️" },
      { name: "Instagram",   url: "https://www.instagram.com/",         emoji: "📸" },
      { name: "Facebook",    url: "https://www.facebook.com/",          emoji: "👥" },
      { name: "TikTok",      url: "https://www.tiktok.com/",            emoji: "🎵" },
      { name: "Reddit",      url: "https://www.reddit.com/",            emoji: "🤖" },
      { name: "Threads",     url: "https://www.threads.net/",           emoji: "🧵" },
    ],
  },
  {
    genre: "ニュース",
    emoji: "📰",
    cards: [
      { name: "Yahoo!ニュース",   url: "https://news.yahoo.co.jp/",          emoji: "🗞️" },
      { name: "NHK ニュース",     url: "https://www3.nhk.or.jp/news/",       emoji: "📡" },
      { name: "ITmedia",          url: "https://www.itmedia.co.jp/",         emoji: "💻" },
      { name: "Bloomberg",        url: "https://www.bloomberg.co.jp/",       emoji: "💹" },
      { name: "Gizmodo Japan",    url: "https://www.gizmodo.jp/",            emoji: "🔬" },
      { name: "GIGAZINE",         url: "https://gigazine.net/",              emoji: "📡" },
    ],
  },
  {
    genre: "読書",
    emoji: "📖",
    cards: [
      { name: "Reader Page (内蔵)", url: "__READER_INTERNAL__",                 emoji: "📚" },
      { name: "Kindle Store",       url: "https://www.amazon.co.jp/Kindle-本",  emoji: "📕" },
      { name: "青空文庫",           url: "https://www.aozora.gr.jp/",            emoji: "📜" },
      { name: "note",               url: "https://note.com/",                    emoji: "📝" },
      { name: "Zenn",               url: "https://zenn.dev/",                    emoji: "💎" },
      { name: "カクヨム",           url: "https://kakuyomu.jp/",                 emoji: "✒️" },
    ],
  },
  {
    genre: "漫画",
    emoji: "📚",
    cards: [
      { name: "少年ジャンプ+",   url: "https://shonenjumpplus.com/",   emoji: "📕" },
      { name: "ピッコマ",         url: "https://piccoma.com/web/",     emoji: "🌈" },
      { name: "LINE Manga",       url: "https://manga.line.me/",       emoji: "💚" },
      { name: "コミックシーモア", url: "https://www.cmoa.jp/",         emoji: "🐳" },
      { name: "マガポケ",         url: "https://pocket.shonenmagazine.com/", emoji: "📖" },
      { name: "めちゃコミック",   url: "https://mechacomic.jp/",       emoji: "💖" },
    ],
  },
  {
    genre: "スポーツ",
    emoji: "⚽",
    cards: [
      { name: "DAZN",          url: "https://www.dazn.com/ja-JP/home", emoji: "📡" },
      { name: "スポナビ",       url: "https://sports.yahoo.co.jp/",     emoji: "🏟️" },
      { name: "NBA Japan",      url: "https://nba.rakuten.co.jp/",      emoji: "🏀" },
      { name: "J.LEAGUE",       url: "https://www.jleague.jp/",         emoji: "⚽" },
      { name: "大相撲",         url: "https://www.sumo.or.jp/",         emoji: "🤼" },
      { name: "Number Web",     url: "https://number.bunshun.jp/",      emoji: "🏆" },
    ],
  },
  {
    genre: "料理",
    emoji: "🍳",
    cards: [
      { name: "クックパッド",     url: "https://cookpad.com/",          emoji: "👨‍🍳" },
      { name: "DELISH KITCHEN",   url: "https://delishkitchen.tv/",     emoji: "🥘" },
      { name: "kurashiru",        url: "https://www.kurashiru.com/",    emoji: "🍱" },
      { name: "Nadia",            url: "https://oceans-nadia.com/",     emoji: "🥗" },
      { name: "楽天レシピ",       url: "https://recipe.rakuten.co.jp/", emoji: "🍴" },
      { name: "E・レシピ",        url: "https://erecipe.woman.excite.co.jp/", emoji: "🍽️" },
    ],
  },
  {
    genre: "旅行",
    emoji: "✈️",
    cards: [
      { name: "じゃらん",           url: "https://www.jalan.net/",         emoji: "🏨" },
      { name: "楽天トラベル",       url: "https://travel.rakuten.co.jp/",  emoji: "🗺️" },
      { name: "Booking.com",        url: "https://www.booking.com/",       emoji: "🛏️" },
      { name: "Airbnb",             url: "https://www.airbnb.jp/",         emoji: "🏠" },
      { name: "トリップアドバイザー", url: "https://www.tripadvisor.jp/", emoji: "🦉" },
      { name: "Expedia",            url: "https://www.expedia.co.jp/",     emoji: "🌍" },
    ],
  },
  {
    genre: "リラックス",
    emoji: "🧘",
    cards: [
      { name: "YouTube ヨガ",     url: "https://www.youtube.com/results?search_query=ヨガ+10分", emoji: "🧘‍♀️" },
      { name: "Headspace",        url: "https://www.headspace.com/jp",                              emoji: "🧠" },
      { name: "Calm",             url: "https://www.calm.com/",                                     emoji: "🌊" },
      { name: "ストレッチ動画",   url: "https://www.youtube.com/results?search_query=ストレッチ+5分", emoji: "🤸" },
      { name: "焚き火動画",       url: "https://www.youtube.com/results?search_query=焚き火+作業用", emoji: "🔥" },
      { name: "水族館ライブ",     url: "https://www.youtube.com/results?search_query=aquarium+live", emoji: "🐠" },
    ],
  },
];
