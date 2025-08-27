import Parser from 'rss-parser';

const parser = new Parser();
//去掉不干净的东西
const cleanHTML = (html) => {
  return html
    .replace(/该渲染由.*?<\/blockquote>/gs, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
};

const rssTools = {
  /**
   * 拉取rss
   * 已适配Atom&RSS2.0
   * @param url rss地址
   * @returns {Promise<{title: *, link: *, content: *, author, date, feedTitle: string, feedLink: string, image}[]|null>}
   */
  async fetchFeed(url) {
    try {
      const feed = await parser.parseURL(url);
      return feed.items.map((item) => ({
        title: item.title,
        link: item.link,
        content: cleanHTML(item['content:encoded'] || item.content || item.description || ''),
        author: item.creator || item.author || feed.title,
        date: item.pubDate || item.isoDate,
        feedTitle: feed.title,
        feedLink: feed.link,
        image: feed.image?.url || feed.logo || '',
      }));
    } catch (err) {
      logger.error(`RSS 拉取失败: ${url}`, err);
      return null;
    }
  },
};

export default rssTools;
