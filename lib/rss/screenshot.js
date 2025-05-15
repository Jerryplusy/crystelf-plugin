import fs from 'fs';
import paths from './../../constants/path.js';
import puppeteer from 'puppeteer';

const screenshot = {
  /**
   * rss网页截图
   * @param feedItem 对象
   * @param savePath 保存路径
   * @returns {Promise<*>}
   */
  async generateScreenshot(feedItem, savePath) {
    const htmlTemplate = fs.readFileSync(paths.rssHTML, 'utf-8');
    const html = htmlTemplate
      .replace('{{title}}', feedItem.title)
      .replace('{{author}}', feedItem.author)
      .replace('{{content}}', feedItem.content)
      .replace('{{link}}', feedItem.link)
      .replace('{{date}}', new Date(feedItem.date).toLocaleString())
      .replace('{{feedTitle}}', feedItem.feedTitle)
      .replace('{{image}}', feedItem.image || '');

    const browser = await puppeteer.launch({ headers: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 800, height: 600 });
    await page.screenshot({ path: savePath, fullPage: true });
    await browser.close();
    return savePath;
  },
};

export default screenshot;
