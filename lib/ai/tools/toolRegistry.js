/**
 * 工具注册表
 * 管理所有可用的工具
 */
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.toolSchemas = [];
  }

  /**
   * 注册工具
   * @param {BaseTool} tool - 工具实例
   */
  register(tool) {
    this.tools.set(tool.name, tool);
    this.toolSchemas.push(tool.getSchema());
    logger.info(`[crystelf-ai] 注册工具: ${tool.name}`);
  }

  /**
   * 获取工具
   * @param {string} name - 工具名称
   * @returns {BaseTool|null} 工具实例
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * 获取所有工具的Schema
   * @returns {Array} 工具Schema数组
   */
  getToolSchemas() {
    return this.toolSchemas;
  }

  /**
   * 执行工具
   * @param {string} name - 工具名称
   * @param {Object} params - 参数
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>} 执行结果
   */
  async executeTool(name, params, context) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`工具不存在: ${name}`);
    }

    try {
      tool.validateParams(params);
      const startTime = Date.now();
      const result = await tool.execute(params, context);
      const duration = Date.now() - startTime;
      
      logger.info(`[crystelf-ai] 工具 ${name} 执行完成，耗时: ${duration}ms`);
      
      return {
        success: true,
        result,
        toolName: name,
        duration,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`[crystelf-ai] 工具 ${name} 执行失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        toolName: name,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取工具列表
   * @returns {Array} 工具信息数组
   */
  getToolList() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * 清空所有工具
   */
  clear() {
    this.tools.clear();
    this.toolSchemas = [];
  }
}

// 创建全局工具注册表实例
const toolRegistry = new ToolRegistry();

export default toolRegistry;