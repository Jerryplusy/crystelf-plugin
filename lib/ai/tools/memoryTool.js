import BaseTool from './baseTool.js';
import MemorySystem from '../memorySystem.js';

/**
 * 存储记忆工具
 */
class StoreMemoryTool extends BaseTool {
  constructor() {
    super(
      'store_memory',
      '存储重要的用户信息到记忆系统',
      {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '要存储的记忆内容，应该简洁明了'
          },
          keywords: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: '记忆的关键词数组，用于后续检索'
          },
          importance: {
            type: 'number',
            description: '记忆重要性等级(1-10)，默认5',
            minimum: 1,
            maximum: 10,
            default: 5
          },
          expire_days: {
            type: 'number',
            description: '记忆保存天数，默认30天',
            default: 30
          }
        },
        required: ['content', 'keywords']
      }
    );
  }

  async execute(params, context) {
    const { content, keywords, importance = 5, expire_days = 30 } = params;
    const { e } = context;

    try {
      // 验证记忆内容的合法性
      if (!this.isValidMemoryContent(content)) {
        return {
          success: false,
          message: '记忆内容不符合存储规范'
        };
      }

      const memoryId = await MemorySystem.addMemory(
        e.group_id,
        e.user_id,
        content,
        keywords,
        expire_days
      );

      if (memoryId) {
        return {
          success: true,
          message: `已存储记忆: ${content.substring(0, 30)}...`,
          memoryId
        };
      } else {
        return {
          success: false,
          message: '记忆存储失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `存储记忆失败: ${error.message}`
      };
    }
  }

  /**
   * 验证记忆内容是否合法
   * @param {string} content - 记忆内容
   * @returns {boolean} 是否合法
   */
  isValidMemoryContent(content) {
    // 不允许存储的内容类型
    const forbiddenPatterns = [
      /主人/i,
      /叫.*主人/i,
      /角色扮演/i,
      /催眠/i,
      /修改.*人设/i,
      /更改.*提示词/i
    ];

    return !forbiddenPatterns.some(pattern => pattern.test(content));
  }
}

export { StoreMemoryTool };