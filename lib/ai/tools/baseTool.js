/**
 * 基础工具类
 * 所有工具都应该继承这个类
 */
class BaseTool {
  constructor(name, description, parameters = {}) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
  }

  /**
   * 执行工具
   * @param {Object} params - 工具参数
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>} 执行结果
   */
  async execute(params, context) {
    throw new Error('子类必须实现 execute 方法');
  }

  /**
   * 验证参数
   * @param {Object} params - 参数对象
   * @returns {boolean} 是否有效
   */
  validateParams(params) {
    // 基础参数验证逻辑
    for (const [key, schema] of Object.entries(this.parameters.properties || {})) {
      if (schema.required && !params[key]) {
        throw new Error(`缺少必需参数: ${key}`);
      }
    }
    return true;
  }

  /**
   * 获取工具的JSON Schema定义
   * @returns {Object} JSON Schema
   */
  getSchema() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters
      }
    };
  }
}

export default BaseTool;