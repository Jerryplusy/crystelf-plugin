import BaseTool from './baseTool.js';
import Renderer from '../renderer.js';

/**
 * 渲染代码工具
 */
class RenderCodeTool extends BaseTool {
  constructor() {
    super(
      'render_code',
      '将代码渲染为高亮图片',
      {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '要渲染的代码内容'
          },
          language: {
            type: 'string',
            description: '编程语言类型，如javascript、python、java等'
          }
        },
        required: ['code', 'language']
      }
    );
  }

  async execute(params, context) {
    const { code, language } = params;
    const { responseQueue } = context;

    const codeObj = {
      type: 'code',
      data: code,
      language: language
    };

    responseQueue.push(codeObj);

    return {
      success: true,
      message: `已渲染${language}代码块`
    };
  }
}

/**
 * 渲染Markdown工具
 */
class RenderMarkdownTool extends BaseTool {
  constructor() {
    super(
      'render_markdown',
      '将Markdown内容渲染为图片',
      {
        type: 'object',
        properties: {
          markdown: {
            type: 'string',
            description: '要渲染的Markdown内容'
          }
        },
        required: ['markdown']
      }
    );
  }

  async execute(params, context) {
    const { markdown } = params;
    const { responseQueue } = context;

    const markdownObj = {
      type: 'markdown',
      data: markdown
    };

    responseQueue.push(markdownObj);

    return {
      success: true,
      message: '已渲染Markdown内容'
    };
  }
}

/**
 * 生成图片工具
 */
class GenerateImageTool extends BaseTool {
  constructor() {
    super(
      'generate_image',
      '根据描述生成图片',
      {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: '图片生成的描述文本'
          },
          style: {
            type: 'string',
            enum: ['natural', 'vivid'],
            description: '图片风格，默认natural',
            default: 'natural'
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1792x1024', '1024x1792'],
            description: '图片尺寸，默认1024x1024',
            default: '1024x1024'
          }
        },
        required: ['prompt']
      }
    );
  }

  async execute(params, context) {
    const { prompt, style = 'natural', size = '1024x1024' } = params;
    const { responseQueue } = context;

    const imageObj = {
      type: 'image',
      data: prompt,
      style: style,
      size: size
    };

    responseQueue.push(imageObj);

    return {
      success: true,
      message: `已生成图片: ${prompt.substring(0, 30)}...`
    };
  }
}

export { RenderCodeTool, RenderMarkdownTool, GenerateImageTool };