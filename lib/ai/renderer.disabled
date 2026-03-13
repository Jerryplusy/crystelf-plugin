import ConfigControl from '../config/configControl.js';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import markdownit from 'markdown-it';
import hljs from 'highlight.js';

class Renderer {
  constructor() {
    this.browser = null;
    this.config = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      this.config = await ConfigControl.get('ai');
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.isInitialized = true;
    } catch (error) {
      logger.error(`[crystelf-renderer] 初始化失败: ${error.message}`);
    }
  }

  async renderCode(code, language) {
    if (!this.isInitialized) await this.init();

    try {
      const page = await this.browser.newPage();
      const html = this.getCodeTemplate(code, language, this.config?.codeRenderer || {});
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#render-complete', { timeout: 5000 });
      const rect = await page.evaluate(() => {
        const body = document.body;
        return { width: body.scrollWidth, height: body.scrollHeight };
      });
      await page.setViewport({
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      });

      const tempDir = path.join(process.cwd(), 'temp', 'html','crystelf-plugin');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const filepath = path.join(tempDir, `code_${Date.now()}.png`);

      await page.screenshot({ path: filepath, fullPage: false });
      await page.close();
      logger.info(`[crystelf-ai] 代码渲染完成: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error(`[crystelf-ai] 代码渲染失败: ${error.message}`);
      return null;
    }
  }

  async renderMarkdown(markdown) {
    if (!this.isInitialized) await this.init();
    try {
      const page = await this.browser.newPage();
      const html = this.getMarkdownTemplate(markdown, this.config?.markdownRenderer || {});
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#render-complete', { timeout: 5000 });
      //计算页面尺寸
      const rect = await page.evaluate(() => {
        const body = document.body;
        const main = document.querySelector('.markdown-body') || body;
        const rect = main.getBoundingClientRect();
        return {
          width: Math.min(Math.ceil(rect.width + 40), 1200),
          height: Math.ceil(rect.height + 40),
        };
      });

      await page.setViewport({
        width: rect.width,
        height: Math.min(rect.height, 3000),
        deviceScaleFactor: 2,
      });
      const tempDir = path.join(process.cwd(), 'temp', 'html','crystelf-plugin');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const filepath = path.join(tempDir, `markdown_${Date.now()}.png`);

      await page.screenshot({ path: filepath, fullPage: false });
      await page.close();
      logger.info(`[crystelf-ai] Markdown渲染完成: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error(`[crystelf-ai] Markdown渲染失败: ${error.message}`);
      return null;
    }
  }

  getCodeTemplate(code, language, config = {}) {
    const themeColor = '#274179';
    const fontSize = config.fontSize || 16;
    const escapedCode = this.escapeHtml(code);

    const colorMap = {
      javascript: 'from-yellow-400 to-yellow-600',
      typescript: 'from-blue-400 to-blue-600',
      python: 'from-cyan-400 to-cyan-600',
      html: 'from-orange-400 to-red-500',
      css: 'from-indigo-400 to-indigo-600',
      json: 'from-emerald-400 to-emerald-600',
      yaml: 'from-amber-400 to-amber-600',
      c: 'from-blue-300 to-blue-500',
      cpp: 'from-blue-400 to-indigo-600',
      java: 'from-red-400 to-orange-500',
      kotlin: 'from-pink-400 to-purple-500',
      csharp: 'from-violet-400 to-purple-600',
      'c#': 'from-violet-400 to-purple-600',
      dotnet: 'from-purple-400 to-indigo-600',
      bash: 'from-gray-400 to-gray-600',
      shell: 'from-gray-400 to-gray-600',
      text: 'from-slate-400 to-slate-600',
    };
    const barColor = colorMap[language.toLowerCase()] || 'from-cyan-400 to-cyan-600';

    let highlightedCode = '';
    try {
      if (hljs.getLanguage(language)) {
        highlightedCode = hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } else {
        highlightedCode = hljs.highlightAuto(code).value;
      }
    } catch {
      highlightedCode = this.escapeHtml(code);
    }

    const lines = highlightedCode
      .split('\n')
      .map(
        (line, i) => `<div class="line"><span class="line-number">${i + 1}</span><span class="line-content">${line}</span></div>`
      )
      .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code&display=swap');
        body { background-color: ${themeColor}; margin: 0; padding: 20px; font-family: 'Fira Code', monospace; }
        .code-container {
          background-color: rgba(45,60,83,0.8);
          border-radius: 10px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 20px rgba(0,0,0,0.5);
          max-width: 800px;
        }
        .code-header {
          display: flex;
          align-items: center;
          padding: 10px 15px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .language-tag {
          background-image: linear-gradient(to right, ${barColor.replace('-', ' ')});
          color: white;
          padding: 3px 8px;
          border-radius: 5px;
          font-family: sans-serif;
          font-size: 14px;
        }
        .code-body pre {
          padding: 15px;
          font-size: ${fontSize}px;
          line-height: 0.8;
          overflow-x: auto;
        }
        .line {
          display: flex;
          margin: 0;
          padding: 0;
          line-height: 1.2;
        }
        .line-number {
          text-align: right;
          margin-right: 12px;
          color: #9ca3af;
          user-select: none;
        }
      </style>
    </head>
    <body>
      <div class="code-container">
        <div class="code-header">
          <span class="language-tag">${language}</span>
        </div>
        <div class="code-body">
          <pre><code class="hljs ${language}">${lines}</code></pre>
        </div>
      </div>
      <div id="render-complete"></div>
    </body>
    </html>
  `;
  }


  getMarkdownTemplate(markdown, config = {}) {
    const themeColor = '#274179';
    const fontSize = config.fontSize || 18;
    const md = markdownit({
      html: true,
      linkify: true,
      typographer: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return (
              '<pre class="hljs"><code>' +
              hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
              '</code></pre>'
            );
          } catch (__) {}
        }
        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
      },
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap" rel="stylesheet">
      <style>
        body {
          background-color: ${themeColor};
          color: #e2e8f0;
          font-family: 'Noto Sans SC', sans-serif;
          font-size: ${fontSize}px;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          display: flex;
          justify-content: center;
        }

        .markdown-body {
          width: 100%;
          max-width: 900px;
          box-sizing: border-box;
        }

        h1, h2, h3, h4, h5, h6 {
          color: #f1f5f9;
          border-bottom: 1px solid #334155;
          padding-bottom: 5px;
          margin-top: 1.5em;
        }

        a {
          color: #38bdf8;
          text-decoration: none;
        }
        a:hover { text-decoration: underline; }

        code {
          background-color: #1e293b;
          padding: 2px 5px;
          border-radius: 5px;
        }
        pre {
          background-color: #1e293b;
          padding: 15px;
          border-radius: 10px;
          overflow-x: auto;
        }
        blockquote {
          border-left: 4px solid #334155;
          padding-left: 15px;
          color: #9ca3af;
          margin: 1em 0;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          background-color: #1e293b;
          border-radius: 8px;
          overflow: hidden;
        }
        th, td {
          border: 1px solid #334155;
          padding: 10px 12px;
          text-align: left;
        }
        th {
          background-color: #0f172a;
          color: #f1f5f9;
        }
        tr:nth-child(even) {
          background-color: #16213d;
        }

        img {
          max-width: 100%;
          border-radius: 10px;
          display: block;
          margin: 10px auto;
        }
      </style>
    </head>
    <body>
      <div class="markdown-body">
        ${md.render(markdown)}
        <div id="render-complete"></div>
      </div>
    </body>
    </html>
  `;
  }


  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
    }
  }
}

export default new Renderer();
