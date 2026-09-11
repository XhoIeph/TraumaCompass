/**
 * 小红书搜索结果页 DOM 抽取（sweep 用）。优先取 a.cover.mask —— 只有它带 xsec_token。
 */
(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const cards = document.querySelectorAll('section.note-item');
  const rows = [];
  const seen = new Set();
  for (const card of cards) {
    if (card.classList && card.classList.contains('query-note-item')) continue;
    const anchor =
      card.querySelector('a.cover.mask') ||
      card.querySelector('a[href*="/search_result/"]') ||
      card.querySelector('a[href*="/explore/"]') ||
      card.querySelector('a[href*="/note/"]');
    if (!anchor) continue;
    const href = anchor.getAttribute('href') || '';
    const url = href.startsWith('http') ? href : href.startsWith('/') ? location.origin + href : '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const pick = (selectors) => {
      for (const selector of selectors) {
        const node = card.querySelector(selector);
        const text = clean(node && node.textContent);
        if (text) return text;
      }
      return '';
    };
    const idMatch = url.match(/\/(?:search_result|explore|note)\/([0-9a-f]{24})/i);
    rows.push({
      note_id: idMatch ? idMatch[1] : '',
      signed: url.includes('xsec_token='),
      url,
      title: pick(['.title', '.note-title', 'a.title', '.footer .title span']),
      author: pick(['a.author .name', '.author-name', '.nick-name', '.name']),
      likes: pick(['.count', '.like-count', '.like-wrapper .count']),
    });
  }
  return { count: rows.length, url: location.href, signedCount: rows.filter((r) => r.signed).length, rows };
})()
