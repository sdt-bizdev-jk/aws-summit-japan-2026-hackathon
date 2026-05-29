/**
 * WaitLess Player (cycle-7)
 *
 * 拡張機能内蔵の動画再生ページ。?v=<YouTube動画ID> を受け取り、
 * YouTube の埋め込みプレイヤーを全面表示する。
 *
 * AI タブ (claude.ai) のページ CSP は外部 iframe を制限する可能性があるため、
 * 本ページ (chrome-extension:// = web_accessible_resource) を経由して埋め込む。
 * 拡張機能ページ自身の CSP は frame を制限しないため YouTube 埋め込みが通る。
 */
(function () {
  const v = new URLSearchParams(location.search).get('v') || '';
  const f = document.createElement('iframe');
  f.id = 'f';
  f.src = 'https://www.youtube.com/embed/' + encodeURIComponent(v)
    + '?autoplay=1&mute=1&rel=0&playsinline=1';
  f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  f.setAttribute('allowfullscreen', '');
  document.body.appendChild(f);
})();
