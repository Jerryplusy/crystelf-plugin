/**
 * 工具组合建议系统
 * 为AI提供常用的工具组合模式
 */
class ToolCombinations {
  constructor() {
    this.combinations = new Map();
    this.initializeCombinations();
  }

  initializeCombinations() {
    // 信息收集组合
    this.combinations.set('gather_user_info', {
      name: '收集用户信息',
      tools: ['search_memory', 'get_chat_history'],
      description: '同时搜索用户记忆和获取聊天历史',
      useCase: '当需要了解用户背景信息时',
      example: {
        search_memory: { query: '用户偏好', limit: 5 },
        get_chat_history: { count: 10, include_bot: true }
      }
    });

    // 信息收集并回复组合
    this.combinations.set('search_and_respond', {
      name: '搜索并回复',
      tools: ['search_memory', 'send_message'],
      description: '搜索相关信息后立即回复用户',
      useCase: '当能够基于记忆直接回答时',
      example: {
        search_memory: { query: '相关关键词', limit: 3 },
        send_message: { content: '基于搜索结果的回复' }
      }
    });

    // 存储并回复组合
    this.combinations.set('store_and_respond', {
      name: '存储并回复',
      tools: ['store_memory', 'send_message'],
      description: '存储重要信息并回复用户',
      useCase: '当用户提供新的重要信息时',
      example: {
        store_memory: { content: '重要信息', keywords: ['关键词'] },
        send_message: { content: '我记住了这个信息' }
      }
    });

    // 多渠道信息收集
    this.combinations.set('comprehensive_search', {
      name: '全面信息收集',
      tools: ['search_memory', 'get_chat_history', 'need_more_info'],
      description: '全面收集信息并说明还需要什么',
      useCase: '处理复杂问题时',
      example: {
        search_memory: { query: '相关主题', limit: 5 },
        get_chat_history: { count: 15, include_bot: true },
        need_more_info: { missing_info: '具体需求', next_action_plan: '下一步计划' }
      }
    });

    // 内容生成组合
    this.combinations.set('generate_content', {
      name: '生成内容',
      tools: ['render_code', 'send_message'],
      description: '渲染代码并发送说明',
      useCase: '当需要展示代码示例时',
      example: {
        render_code: { code: '示例代码', language: 'javascript' },
        send_message: { content: '这是相关的代码示例' }
      }
    });

    // 完整回复组合
    this.combinations.set('complete_response', {
      name: '完整回复',
      tools: ['find_answer', 'send_message', 'send_meme'],
      description: '给出完整回答并结束对话',
      useCase: '当有足够信息给出最终回答时',
      example: {
        find_answer: { confidence: 0.8, summary: '信息摘要' },
        send_message: { content: '详细回答' },
        send_meme: { emotion: 'happy' }
      }
    });
  }

  /**
   * 获取推荐的工具组合
   * @param {string} scenario - 场景描述
   * @returns {Array} 推荐的组合
   */
  getRecommendations(scenario) {
    const recommendations = [];
    
    // 基于场景关键词匹配
    const scenarioLower = scenario.toLowerCase();
    
    if (scenarioLower.includes('记忆') || scenarioLower.includes('历史')) {
      recommendations.push(this.combinations.get('gather_user_info'));
    }
    
    if (scenarioLower.includes('回答') || scenarioLower.includes('回复')) {
      recommendations.push(this.combinations.get('search_and_respond'));
    }
    
    if (scenarioLower.includes('存储') || scenarioLower.includes('记住')) {
      recommendations.push(this.combinations.get('store_and_respond'));
    }
    
    if (scenarioLower.includes('复杂') || scenarioLower.includes('详细')) {
      recommendations.push(this.combinations.get('comprehensive_search'));
    }
    
    if (scenarioLower.includes('代码') || scenarioLower.includes('示例')) {
      recommendations.push(this.combinations.get('generate_content'));
    }
    
    if (scenarioLower.includes('完成') || scenarioLower.includes('结束')) {
      recommendations.push(this.combinations.get('complete_response'));
    }
    
    return recommendations;
  }

  /**
   * 获取所有组合的描述
   * @returns {string} 格式化的组合描述
   */
  getAllCombinationsDescription() {
    let description = '=== 常用工具组合模式 ===\n\n';
    
    for (const [key, combo] of this.combinations) {
      description += `${combo.name}:\n`;
      description += `- 工具: ${combo.tools.join(', ')}\n`;
      description += `- 说明: ${combo.description}\n`;
      description += `- 适用: ${combo.useCase}\n\n`;
    }
    
    return description;
  }

  /**
   * 验证工具组合的兼容性
   * @param {Array} toolNames - 工具名称数组
   * @returns {Object} 验证结果
   */
  validateCombination(toolNames) {
    const conflicts = [];
    const warnings = [];
    
    // 检查冲突的工具组合
    if (toolNames.includes('find_answer') && toolNames.includes('need_more_info')) {
      conflicts.push('find_answer 和 need_more_info 不能同时使用');
    }
    
    if (toolNames.includes('send_message') && toolNames.length === 1) {
      warnings.push('单独使用 send_message 可能缺少信息收集');
    }
    
    // 检查工具数量
    if (toolNames.length > 5) {
      warnings.push('同时调用过多工具可能影响性能');
    }
    
    return {
      isValid: conflicts.length === 0,
      conflicts,
      warnings,
      toolCount: toolNames.length
    };
  }
}

export default new ToolCombinations();