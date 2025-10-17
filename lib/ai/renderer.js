import ConfigControl from "../config/configControl.js";
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

//渲染器
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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.isInitialized = true;
    } catch (error) {
      logger.error(`[crystelf-renderer] 初始化失败: ${error.message}`);
    }
  }

  /**
   * 渲染代码为图片
   * @param code 代码
   * @param language 语言
   * @returns {Promise<null|string>}
   */
  async renderCode(code, language = 'text') {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const page = await this.browser.newPage();
      const codeConfig = this.config?.codeRenderer || {};
      const html = this.generateCodeHTML(code, language, codeConfig);
      await page.setContent(html);
      await page.setViewport({ width: 800, height: 600 });
      const tempDir = path.join(process.cwd(), 'temp', 'html');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const filename = `code_${Date.now()}.png`;
      const filepath = path.join(tempDir, filename);
      await page.screenshot({
        path: filepath,
        fullPage: true,
        type: 'png'
      });
      await page.close();
      logger.info(`[crystelf-ai] 代码渲染完成: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error(`[crystelf-ai] 代码渲染失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 渲染md为图片
   * @param markdown
   * @returns {Promise<null|string>}
   */
  async renderMarkdown(markdown) {
    if (!this.isInitialized) {
      await this.init();
    }
    try {
      const page = await this.browser.newPage();
      const markdownConfig = this.config?.markdownRenderer || {};
      const html = this.generateMarkdownHTML(markdown, markdownConfig);
      await page.setContent(html);
      await page.setViewport({ width: 800, height: 600 });
      const tempDir = path.join(process.cwd(), 'temp', 'html');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const filename = `markdown_${Date.now()}.png`;
      const filepath = path.join(tempDir, filename);
      await page.screenshot({
        path: filepath,
        fullPage: true,
        type: 'png'
      });
      await page.close();
      logger.info(`[crystelf-ai] Markdown渲染完成: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error(`[crystelf-ai] Markdown渲染失败: ${error.message}`);
      return null;
    }
  }


  /**
   * 生成代码html
   * @param code 代码内容
   * @param language 语言
   * @param config 配置
   * @returns {string}
   */
  generateCodeHTML(code, language, config) {
    const theme = config.theme || 'github';
    const fontSize = config.fontSize || 14;
    const lineNumbers = config.lineNumbers !== false;
    const backgroundColor = config.backgroundColor || '#f6f8fa';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Code Render</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-${theme}.min.css">
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: ${backgroundColor};
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: ${fontSize}px;
            line-height: 1.5;
        }
        pre {
            margin: 0;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            background-color: white;
            border: 1px solid #e1e4e8;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        code {
            font-family: inherit;
        }
        ${lineNumbers ? `
        .line-numbers {
            counter-reset: line;
        }
        .line-numbers .line-number {
            counter-increment: line;
            position: relative;
            display: block;
        }
        .line-numbers .line-number:before {
            content: counter(line);
            position: absolute;
            left: -2em;
            width: 2em;
            text-align: right;
            color: #6a737d;
            user-select: none;
        }
        ` : ''}
    </style>
</head>
<body>
    <pre class="language-${language}${lineNumbers ? ' line-numbers' : ''}"><code>${this.escapeHtml(code)}</code></pre>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
</body>
</html>`;
  }

  /**
   * 生成Markdown HTML
   * @param {string} markdown Markdown内容
   * @param {Object} config 配置
   * @returns {string} HTML内容
   */
  generateMarkdownHTML(markdown, config) {
    const theme = config.theme || 'light';
    const fontSize = config.fontSize || 14;
    const codeTheme = config.codeTheme || 'github';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Markdown Render</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-${theme}.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-${codeTheme}.min.css">
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-size: ${fontSize}px;
            line-height: 1.6;
        }
        .markdown-body {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        ${theme === 'dark' ? `
        .markdown-body {
            background-color: #0d1117;
            color: #c9d1d9;
        }
        ` : ''}
    </style>
</head>
<body>
    <div class="markdown-body">
        <div id="markdown-content"></div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    <script>
        const markdown = \`${this.escapeHtml(markdown)}\`;
        document.getElementById('markdown-content').innerHTML = marked.parse(markdown);
        Prism.highlightAll();
    </script>
</body>
</html>`;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
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
