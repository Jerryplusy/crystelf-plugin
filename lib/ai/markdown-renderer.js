import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

export async function renderMarkdownToImage(markdownContent) {
  const { default: puppeteer } = await import('puppeteer');
  const html = buildHtml(markdownContent);
  const outputDir = path.join(process.cwd(), 'temp', 'crystelf-plugin', 'markdown');
  await fs.mkdir(outputDir, { recursive: true });
  const filename = `md-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;
  const outputPath = path.join(outputDir, filename);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const element = await page.$('.markdown-body');
    if (element) {
      await element.screenshot({ path: outputPath });
    } else {
      await page.screenshot({ path: outputPath, fullPage: true });
    }
  } finally {
    await browser.close();
  }

  return outputPath;
}

function buildHtml(markdownContent) {
  const body = md.render(String(markdownContent || ''));
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px;
    background: var(--page-bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  }
  :root {
    color-scheme: light dark;
    --page-bg: #f6f8fa;
    --canvas: #ffffff;
    --fg: #24292f;
    --muted: #57606a;
    --border: #d0d7de;
    --border-muted: #d8dee4;
    --accent: #0969da;
    --code-bg: rgba(175, 184, 193, 0.2);
    --pre-bg: #f6f8fa;
    --table-head-bg: #f6f8fa;
    --shadow: 0 12px 36px rgba(27, 31, 36, 0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --page-bg: #0d1117;
      --canvas: #161b22;
      --fg: #c9d1d9;
      --muted: #8b949e;
      --border: #30363d;
      --border-muted: #21262d;
      --accent: #58a6ff;
      --code-bg: rgba(110, 118, 129, 0.4);
      --pre-bg: #0d1117;
      --table-head-bg: #161b22;
      --shadow: 0 12px 36px rgba(1, 4, 9, 0.36);
    }
  }
  .markdown-body {
    width: 844px;
    max-width: 844px;
    padding: 34px 40px;
    background: var(--canvas);
    border: 1px solid var(--border-muted);
    border-radius: 8px;
    box-shadow: var(--shadow);
    line-height: 1.7;
    font-size: 16px;
  }
  h1, h2, h3, h4, h5, h6 {
    margin: 24px 0 12px;
    line-height: 1.35;
    font-weight: 700;
  }
  h1 { font-size: 30px; border-bottom: 1px solid var(--border-muted); padding-bottom: 10px; }
  h2 { font-size: 24px; border-bottom: 1px solid var(--border-muted); padding-bottom: 8px; }
  h3 { font-size: 20px; }
  a { color: var(--accent); text-decoration: none; }
  p, ul, ol, blockquote, pre, table { margin: 12px 0; }
  ul, ol { padding-left: 1.7em; }
  blockquote {
    padding: 0 1em;
    color: var(--muted);
    border-left: 4px solid var(--border);
  }
  code {
    padding: 0.2em 0.4em;
    border-radius: 6px;
    background: var(--code-bg);
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    font-size: 0.92em;
  }
  pre {
    padding: 16px;
    overflow: hidden;
    border-radius: 8px;
    background: var(--pre-bg);
  }
  pre code {
    padding: 0;
    background: transparent;
    white-space: pre-wrap;
    word-break: break-word;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    padding: 8px 10px;
    border: 1px solid var(--border);
  }
  th { background: var(--table-head-bg); }
  hr {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background: var(--border-muted);
    border: 0;
  }
  img { max-width: 100%; }
</style>
</head>
<body>
  <article class="markdown-body">${body}</article>
</body>
</html>`;
}
