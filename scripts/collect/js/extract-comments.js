/**
 * 小红书笔记页评论抽取（sweep 用）。三个坑：滚动容器是 .note-scroller；评论懒加载；
 * 回复折叠在 div.show-more 后面。
 */
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
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
    await sleep(450);
  }

  let lastCount = 0;
  let plateau = 0;
  for (let i = 0; i < 80; i += 1) {
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(600);
    const count = document.querySelectorAll('.comment-item').length;
    if (count === lastCount) {
      plateau += 1;
      if (plateau >= 12) break;
    } else {
      plateau = 0;
      lastCount = count;
    }
  }

  const nodes = document.querySelectorAll('.comment-item');
  const rows = [];
  const seen = new Set();
  for (const el of nodes) {
    const pick = (selectors) => {
      for (const selector of selectors) {
        const node = el.querySelector(selector);
        const text = clean(node && node.textContent);
        if (text) return text;
      }
      return '';
    };
    const text = pick(['.note-text', '.content .note-text', '.content', '.comment-content']);
    if (!text) continue;

    /**
     * 隐私：不采集评论者用户名和 IP 属地。
     * XHS 的时间与属地混在一个字段里（形如「08-01广东」），这里只取日期，丢掉属地。
     */
    const rawInfo = pick(['.date', '.time', '.info span', '.location']);
    const dateOnly = (rawInfo.match(/\d{4}-\d{2}-\d{2}|\d{2}-\d{2}/) || [''])[0];

    const key = text.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);

    // 上下文：是否楼中楼 + 父评论（回复关系的判断不依赖用户名）
    const ancestor = el.parentElement ? el.parentElement.closest('.comment-item') : null;
    const isReply = Boolean(ancestor);
    const parentText = ancestor
      ? clean((ancestor.querySelector('.note-text, .content .note-text, .content') || {}).textContent)
      : '';

    rows.push({
      date: dateOnly,
      text,
      likes: pick(['.like .count', '.like-wrapper .count', '.count']),
      is_reply: isReply,
      parent_excerpt: parentText ? parentText.slice(0, 300) : undefined,
    });
  }
  return { count: rows.length, domComments: nodes.length, url: location.href, title: document.title, rows };
})()
