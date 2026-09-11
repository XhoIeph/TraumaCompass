/**
 * 深扫笔记页图片（含评论区）：先把评论区滚到底并展开折叠回复，再收集 CDN 图片。
 */
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const scroller = document.querySelector('.note-scroller') || document.scrollingElement;

  for (let round = 0; round < 40; round += 1) {
    const toggles = [...document.querySelectorAll('div.show-more')].filter((el) => !el.dataset.tcClicked);
    if (toggles.length === 0) break;
    for (const el of toggles) {
      el.dataset.tcClicked = '1';
      try {
        el.click();
      } catch {
        /* 忽略 */
      }
    }
    await sleep(400);
  }

  let last = 0;
  let plateau = 0;
  for (let i = 0; i < 80; i += 1) {
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(600);
    const count = document.querySelectorAll('.comment-item').length;
    if (count === last) {
      plateau += 1;
      if (plateau >= 12) break;
    } else {
      plateau = 0;
      last = count;
    }
  }

  const isCdn = (url) => Boolean(url) && /xhscdn|sns-webpic|sns-img/i.test(url);
  const seen = new Map();
  for (const img of document.querySelectorAll('img')) {
    const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
    if (!isCdn(src)) continue;
    const key = src.split('!')[0];
    if (seen.has(key)) continue;
    seen.set(key, {
      src,
      w: img.naturalWidth || 0,
      h: img.naturalHeight || 0,
      inComment: Boolean(img.closest('.comment-item, .comments-container, .comment-inner')),
    });
  }
  const all = [...seen.values()];
  return {
    domComments: document.querySelectorAll('.comment-item').length,
    total: all.length,
    images: all
      .filter((i) => i.inComment || /\/comment\//.test(i.src) || i.w >= 500)
      .sort((a, b) => b.w * b.h - a.w * a.h)
      .slice(0, 60),
  };
})()
