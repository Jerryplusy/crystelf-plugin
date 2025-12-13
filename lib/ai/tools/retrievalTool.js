import BaseTool from './baseTool.js';
import MemorySystem from '../memorySystem.js';

/**
 * 搜索记忆工具
 */
class SearchMemoryTool extends BaseTool {
  constructor() {
    super(
      'search_memory',
      '搜索用户的历史记忆和对话信息',
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词或问题'
          },
          limit: {
            type: 'number',
            description: '返回结果数量限制，默认5条',
            default: 5
          }
        },
        required: ['query']
      }
    );
  }

  async execute(params, context) {
    const { query, limit = 5 } = params;
    const { e } = context;

    try {
      const memories = await MemorySystem.searchMemories(e.user_id, query, limit);
      
      if (!memories || memories.length === 0) {
        return {
          success: true,
          message: '未找到相关记忆',
          memories: []
        };
      }

      const formattedMemories = memories.map(memory => ({
        content: memory.data,
        keywords: memory.keywords,
        relevance: memory.relevance,
        createdAt: new Date(memory.createdAt).toLocaleString()
      }));

      return {
        success: true,
        message: `找到 ${memories.length} 条相关记忆`,
        memories: formattedMemories
      };
    } catch (error) {
      return {
        success: false,
        message: `搜索记忆失败: ${error.message}`,
        memories: []
      };
    }
  }
}

/**
 * 获取聊天历史工具
 */
class GetChatHistoryTool extends BaseTool {
  constructor() {
    super(
      'get_chat_history',
      '获取最近的聊天历史记录',
      {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: '获取消息数量，默认10条',
            default: 10
          },
          include_bot: {
            type: 'boolean',
            description: '是否包含机器人自己的消息，默认true',
            default: true
          }
        }
      }
    );
  }

  async execute(params, context) {
    const { count = 10, include_bot = true } = params;
    const { e } = context;

    try {
      const history = await e.group.getChatHistory(e.message_id, count);
      
      if (!history || history.length === 0) {
        return {
          success: true,
          message: '未找到聊天历史',
          history: []
        };
      }

      const formattedHistory = history
        .filter(msg => include_bot || msg.sender?.user_id !== e.bot.uin)
        .map(msg => {
          const textContent = msg.message
            ?.filter(m => m.type === 'text')
            ?.map(m => m.text)
            ?.join('') || '';
          
          return {
            user_id: msg.sender?.user_id,
            nickname: msg.sender?.nickname,
            content: textContent,
            timestamp: new Date(msg.time * 1000).toLocaleString(),
            message_id: msg.message_id
          };
        })
        .filter(msg => msg.content.trim() !== '');

      return {
        success: true,
        message: `获取到 ${formattedHistory.length} 条聊天记录`,
        history: formattedHistory
      };
    } catch (error) {
      return {
        success: false,
        message: `获取聊天历史失败: ${error.message}`,
        history: []
      };
    }
  }
}

export { SearchMemoryTool, GetChatHistoryTool };