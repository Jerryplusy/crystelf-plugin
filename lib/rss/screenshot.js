import fs from 'fs';
import paths from './../../constants/path.js';
import puppeteer from 'puppeteer';

const screenshot = {
  /**
   * 调用浏览器截图
   * @param title 标题
   * @param link 链接
   * @param description 描述
   * @returns {Promise<string>} 图片所在目录
   */
  // TODO 待优化
  async rssScreenshot(title, link, description = '') {
    const templatePath = paths.rssHTML;
    let html = fs.readFileSync(templatePath, 'utf8');

    html = html
      .replace('{{title}}', title || '')
      .replace('{{link}}', link || '')
      .replace('{{description}}', description || '');

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const imagePath = `/tmp/rss_card_${Date.now()}.png`;
    await page.screenshot({ path: imagePath });
    await browser.close();
    return imagePath;
  },
};

export default screenshot;
