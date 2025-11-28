import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MusicRenderer {
  constructor() {
    this.tempDir = path.join(__dirname, '..', '..','..','..', 'temp');
    this.browser = null;
  }

  /**
   * 初始化渲染器
   */
  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
    } catch (error) {
      logger.error('[crystelf-music] 浏览器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 渲染音乐列表图片
   * @param {Array} songs 歌曲列表
   * @param {string} query 搜索关键词
   * @param {string} groupId 群聊ID
   * @returns {Promise<string>} 图片文件路径
   */
  async renderMusicList(songs, query, groupId) {
    try {
      if (!this.browser) {
        await this.init();
      }
      const page = await this.browser.newPage();
      await page.setViewport({ width: 800, height: Math.max(600, songs.length * 80 + 200) });
      const htmlContent = this.generateHtml(songs, query);
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      const filename = `music_list_${groupId}_${Date.now()}.png`;
      const outputPath = path.join(this.tempDir, filename);
      await page.screenshot({
        path: outputPath,
        type: 'jpeg',
        fullPage: true,
        quality: 90
      });
      await page.close();
      return outputPath;
    } catch (error) {
      logger.error('[crystelf-music] 渲染音乐列表失败:', error);
      throw new Error(`渲染失败: ${error.message}`);
    }
  }

  /**
   * 生成HTML内容
   * @param {Array} songs 歌曲列表
   * @param {string} query 搜索关键词
   * @returns {string} HTML字符串
   */
  generateHtml(songs, query) {
    const currentTime = new Date().toLocaleString('zh-CN');

    const songItems = songs.map((song, index) => `
    <div class="card">
     
      <div class="info">
        <div class="title">${this.escapeHtml(song.displayTitle)}</div>

        <div class="meta">
          <span class="tag artist">${this.escapeHtml(song.displayArtist)}</span>
          <span class="tag album">${this.escapeHtml(song.displayAlbum)}</span>
        </div>

        <div class="extra">
          <span>${song.duration}</span>
          <span>${song.format}</span>
        </div>
      </div>

      <div class="rank">${index + 1}</div>
    </div>
  `).join('');

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>音乐搜索结果</title>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif;
    background: linear-gradient(135deg, #1d2b64, #d9abb8);
    padding: 30px 20px;
    min-height: 100vh;
  }

  .container {
    max-width: 900px;
    margin: auto;
    background: rgba(255,255,255,0.08);
    padding: 35px;
    border-radius: 24px;
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    box-shadow: 0 20px 45px rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.2);
  }

  .header {
    text-align: center;
    margin-bottom: 40px;
    color: #fff;
  }

  .header h1 {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 10px;
  }

  .header .sub {
    font-size: 16px;
    opacity: 0.9;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .card {
    display: flex;
    background: rgba(255,255,255,0.25);
    border-radius: 18px;
    overflow: hidden;
    padding: 18px;
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border: 1px solid rgba(255,255,255,0.3);
    align-items: center;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    position: relative;
    transition: transform 0.25s ease;
  }

  .card:hover {
    transform: translateY(-4px);
  }

  .thumb {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0,0,0,0.2);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .info {
    margin-left: 20px;
    flex: 1;
  }

  .title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #007cc9;
  }

  .meta {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 6px;
    backdrop-filter: blur(8px);
    font-weight: 500;
  }

  .artist {
    background: rgba(13,166,180,0.5);
    color: #fff;
  }

  .album {
    background: rgba(39,255,0,0.36);
    color: #1a1a1a;
  }

  .extra {
    font-size: 12px;
    opacity: 0.85;
    display: flex;
    gap: 15px;
  }

  .rank {
    position: absolute;
    right: 15px;
    top: 15px;
    background: rgba(255,255,255,0.25);
    padding: 6px 12px;
    border-radius: 10px;
    color: #fff;
    font-weight: 600;
    font-size: 15px;
    backdrop-filter: blur(10px);
  }

  @media (max-width: 600px) {
    .card {
      flex-direction: column;
      text-align: center;
    }
    .info {
      margin: 15px 0 0 0;
    }
    .rank {
      top: 12px;
      right: 12px;
    }
  }
</style>

</head>
<body>

<div class="container">

  <div class="header">
    <h1>音乐搜索结果</h1>
    <div class="sub">搜索：${this.escapeHtml(query)} | 时间：${currentTime}</div>
  </div>

  <div class="list">
    ${songItems}
  </div>
  
  <div class="footer" style="margin-top: 20px; color: #fff; text-align: center;">
      你可以直接发送歌曲序号来播放音乐,如1
   </div>
</div>

</body>
</html>
  `;
  }

  /**
   * HTML转义
   * @param {string} text 原始文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    if (!text) return '';
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.toString().replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default MusicRenderer;