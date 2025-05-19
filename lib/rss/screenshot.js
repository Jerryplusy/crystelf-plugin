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
      .replace(/{{title}}/g, feedItem.title)
      .replace(/{{author}}/g, feedItem.author)
      .replace(/{{content}}/g, feedItem.content)
      .replace(/{{link}}/g, feedItem.link)
      .replace(/{{date}}/g, new Date(feedItem.date).toLocaleString())
      .replace(/{{feedTitle}}/g, feedItem.feedTitle)
      .replace(/{{image}}/g, feedItem.image || '');

    const browser = await puppeteer.launch({
      headers: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1.5 });
    await page.screenshot({ path: savePath, fullPage: true });
    await browser.close();
    return savePath;
  },
};

export default screenshot;
