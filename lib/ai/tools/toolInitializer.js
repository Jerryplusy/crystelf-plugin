import toolRegistry from './toolRegistry.js';
import { SendMessageTool, SendMemeTool, PokeTool } from './messageTool.js';
import { SearchMemoryTool, GetChatHistoryTool } from './retrievalTool.js';
import { StoreMemoryTool } from './memoryTool.js';
import { RenderCodeTool, RenderMarkdownTool, GenerateImageTool } from './contentTool.js';
import { FindAnswerTool, NeedMoreInfoTool } from './controlTool.js';

/**
 * 工具初始化器
 * 负责注册所有可用的工具
 */
class ToolInitializer {
  static async initialize() {
    try {
      // 清空现有工具
      toolRegistry.clear();

      // 注册基础交互工具
      toolRegistry.register(new SendMessageTool());
      toolRegistry.register(new SendMemeTool());
      toolRegistry.register(new PokeTool());

      // 注册信息检索工具
      toolRegistry.register(new SearchMemoryTool());
      toolRegistry.register(new GetChatHistoryTool());

      // 注册记忆管理工具
      toolRegistry.register(new StoreMemoryTool());

      // 注册内容生成工具
      toolRegistry.register(new RenderCodeTool());
      toolRegistry.register(new RenderMarkdownTool());
      toolRegistry.register(new GenerateImageTool());

      // 注册循环控制工具
      toolRegistry.register(new FindAnswerTool());
      toolRegistry.register(new NeedMoreInfoTool());

      const toolCount = toolRegistry.getToolList().length;
      logger.info(`[crystelf-ai] 工具初始化完成，共注册 ${toolCount} 个工具`);
      
      return true;
    } catch (error) {
      logger.error(`[crystelf-ai] 工具初始化失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取工具统计信息
   */
  static getToolStats() {
    const tools = toolRegistry.getToolList();
    const categories = {
      message: 0,
      retrieval: 0,
      memory: 0,
      content: 0,
      other: 0
    };

    tools.forEach(tool => {
      if (tool.name.includes('message') || tool.name.includes('meme') || tool.name.includes('poke')) {
        categories.message++;
      } else if (tool.name.includes('search') || tool.name.includes('get')) {
        categories.retrieval++;
      } else if (tool.name.includes('memory')) {
        categories.memory++;
      } else if (tool.name.includes('render') || tool.name.includes('generate')) {
        categories.content++;
      } else {
        categories.other++;
      }
    });

    return {
      total: tools.length,
      categories,
      tools: tools.map(t => ({ name: t.name, description: t.description }))
    };
  }
}

export default ToolInitializer;