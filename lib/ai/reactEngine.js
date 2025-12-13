import ConfigControl from '../config/configControl.js';
import toolRegistry from './tools/toolRegistry.js';
import AiCaller from './aiCaller.js';
import ContextBuilder from './contextBuilder.js';
import MemorySystem from './memorySystem.js';
import ToolCombinations from './tools/toolCombinations.js';

/**
 * ReAct引擎
 * Reasoning + Acting 循环
 */
class ReactEngine {
  constructor() {
    this.maxIterations = 5;
    this.timeout = 30000;
    this.toolTimeout = 10000;
    this.enableThinking = false;
  }

  async init() {
    try {
      const config = await ConfigControl.get('ai');
      const reactConfig = config?.reactConfig || {};
      
      this.maxIterations = reactConfig.maxIterations || 5;
      this.timeout = reactConfig.timeout || 30000;
      this.toolTimeout = reactConfig.toolTimeout || 10000;
      this.enableThinking = reactConfig.enableThinking || false;
      
      logger.info('[crystelf-ai] ReAct引擎初始化完成');
    } catch (error) {
      logger.error(`[crystelf-ai] ReAct引擎初始化失败: ${error.message}`);
    }
  }

  /**
   * 执行ReAct循环
   * @param {string} userInput - 用户输入
   * @param {Object} context - 执行上下文
   * @returns {Promise<Object>} 执行结果
   */
  async execute(userInput, context) {
    const startTime = Date.now();
    const responseQueue = [];
    const thinkingSteps = [];
    
    // 扩展上下文
    const executionContext = {
      ...context,
      responseQueue,
      startTime,
      userInput
    };

    try {
      // 构建基础上下文（包含记忆搜索）
      const memories = await MemorySystem.searchMemories(context.e.user_id, userInput, 5);
      const baseContext = await ContextBuilder.buildBaseContext(context.e, memories);
      
      let shouldContinue = true;
      let iteration = 0;
      
      while (shouldContinue && iteration < this.maxIterations) {
        // 检查超时
        if (Date.now() - startTime > this.timeout) {
          logger.warn(`[crystelf-ai] ReAct超时，已迭代 ${iteration} 次`);
          break;
        }

        // 构建当前迭代的上下文
        const iterationContext = ContextBuilder.buildIterationContext(
          baseContext, 
          iteration, 
          thinkingSteps, 
          userInput
        );

        // 思考阶段
        const thought = await this.think(iterationContext, iteration);
        
        // 决策阶段
        const decision = await this.decide(thought, iterationContext, iteration);
        
        // 行动阶段
        const observation = await this.act(decision, executionContext);
        
        // 记录思考步骤
        const step = {
          iteration: iteration + 1,
          thought,
          decision,
          observation,
          timestamp: Date.now(),
          // 新增：AI的推理过程和工具调用详情
          reasoning: decision.reasoning || thought,
          toolsUsed: observation.multipleTools ? 
            observation.toolResults?.map(tr => tr.toolName) || [] : 
            [decision.action || decision.tool_calls?.[0]?.function?.name].filter(Boolean),
          executionTime: observation.duration || 0,
          success: observation.success !== false
        };
        thinkingSteps.push(step);

        // 检查是否应该结束循环
        if (observation.shouldEnd === true) {
          logger.info(`[crystelf-ai] AI决定结束循环，第${iteration + 1}轮完成`);
          shouldContinue = false;
        } else if (observation.shouldEnd === false) {
          logger.info(`[crystelf-ai] AI决定继续收集信息，进入第${iteration + 2}轮`);
          shouldContinue = true;
        }

        iteration++;
      }

      // 如果循环结束但没有响应，添加默认响应
      if (responseQueue.length === 0) {
        responseQueue.push({
          type: 'message',
          data: iteration >= this.maxIterations ? 
            '我已经尽力思考了，但可能需要更多信息才能给出完美的回答...' :
            '让我来帮助您解决这个问题。',
          at: -1,
          quote: -1,
          recall: false
        });
      }

      // 重置上下文构建器
      ContextBuilder.reset();

      return {
        success: true,
        responses: responseQueue,
        thinkingSteps: this.enableThinking ? thinkingSteps : [],
        iterations: iteration,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`[crystelf-ai] ReAct执行失败: ${error.message}`);
      
      // 重置上下文构建器
      ContextBuilder.reset();
      
      // 返回错误响应
      return {
        success: false,
        error: error.message,
        responses: [{
          type: 'message',
          data: '抱歉，我在处理您的请求时遇到了问题...',
          at: -1,
          quote: -1,
          recall: false
        }],
        thinkingSteps: this.enableThinking ? thinkingSteps : []
      };
    }
  }

  /**
   * 思考阶段
   */
  async think(iterationContext, iteration) {
    const personalityPrompt = await ContextBuilder.buildPersonalityPrompt();
    
    const thinkingPrompt = `${personalityPrompt}

${iterationContext}

=== 思考任务 ===
请仔细分析当前情况，思考：
1. 用户的真实需求是什么？
2. 我现在掌握了哪些信息？
3. 还缺少什么关键信息？
4. 下一步应该采取什么行动？

请简洁明了地描述你的思考过程。`;

    try {
      const response = await this.callAI(thinkingPrompt, {});
      return response || '继续分析用户需求';
    } catch (error) {
      logger.error(`[crystelf-ai] 思考阶段失败: ${error.message}`);
      return '继续分析用户需求';
    }
  }

  /**
   * 决策阶段
   */
  async decide(thought, iterationContext, iteration) {
    const toolSchemas = toolRegistry.getToolSchemas();
    const personalityPrompt = await ContextBuilder.buildPersonalityPrompt();
    
    const systemPrompt = `${personalityPrompt}

${iterationContext}

=== 决策指南 ===
基于你的思考："${thought}"

你现在需要决定下一步行动。可用工具：
${JSON.stringify(toolSchemas, null, 2)}

重要规则：
1. 你可以同时调用多个工具来提高效率，例如同时搜索记忆和获取聊天历史
2. 如果你已经有足够信息回答用户，使用 find_answer 工具表示准备结束
3. 如果需要更多信息，可以先调用 need_more_info 说明需求，然后调用相应的信息收集工具
4. 使用具体的工具来收集信息（如 search_memory, get_chat_history 等）
5. 使用 send_message 等工具来回复用户
6. 优先考虑用户的实际需求，不要过度收集信息
7. 合理利用并行工具调用，但避免调用冲突的工具

${ToolCombinations.getAllCombinationsDescription()}

请调用最合适的工具（可以是多个）。记住：
- 优先使用推荐的工具组合来提高效率
- 可以根据具体情况调整组合中的参数
- 避免调用冲突的工具（如同时使用find_answer和need_more_info）`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请根据当前思考决定下一步行动。' }
    ];

    try {
      // 调用支持工具调用的AI
      const response = await this.callAIWithTools(messages, toolSchemas, {});
      return response;
    } catch (error) {
      logger.error(`[crystelf-ai] 决策阶段失败: ${error.message}`);
      return {
        action: 'send_message',
        parameters: {
          content: '我在思考过程中遇到了问题，请稍后再试。'
        }
      };
    }
  }

  /**
   * 行动阶段 - 支持多工具并行调用
   */
  async act(decision, context) {
    try {
      if (decision.tool_calls && decision.tool_calls.length > 0) {
        // 处理多个工具调用
        const toolResults = [];
        const toolPromises = [];
        
        logger.info(`[crystelf-ai] 准备并行执行 ${decision.tool_calls.length} 个工具`);
        
        // 并行执行所有工具调用
        for (const toolCall of decision.tool_calls) {
          const toolName = toolCall.function.name;
          const parameters = JSON.parse(toolCall.function.arguments);
          
          logger.info(`[crystelf-ai] 调用工具: ${toolName}, 参数: ${JSON.stringify(parameters)}`);
          
          const toolPromise = toolRegistry.executeTool(toolName, parameters, context)
            .then(result => ({
              toolName,
              parameters,
              result,
              toolCallId: toolCall.id
            }))
            .catch(error => ({
              toolName,
              parameters,
              result: {
                success: false,
                message: `工具执行失败: ${error.message}`
              },
              toolCallId: toolCall.id,
              error: error.message
            }));
          
          toolPromises.push(toolPromise);
        }
        
        // 等待所有工具执行完成
        const results = await Promise.all(toolPromises);
        
        // 整合结果
        let shouldEnd = null;
        let hasError = false;
        const messages = [];
        
        for (const { toolName, parameters, result, toolCallId, error } of results) {
          toolResults.push({
            toolName,
            parameters,
            result,
            toolCallId,
            success: !error
          });
          
          if (error) {
            hasError = true;
            messages.push(`工具 ${toolName} 执行失败: ${error}`);
          } else {
            messages.push(`工具 ${toolName} 执行成功: ${result.message || result.result || '完成'}`);
            
            // 检查循环控制
            if (result.shouldEnd !== undefined) {
              shouldEnd = result.shouldEnd;
            }
          }
        }
        
        return {
          success: !hasError,
          message: messages.join('\n'),
          toolResults,
          shouldEnd,
          multipleTools: true,
          toolCount: decision.tool_calls.length
        };
        
      } else if (decision.action) {
        // 处理单个直接行动
        const result = await toolRegistry.executeTool(decision.action, decision.parameters, context);
        return {
          ...result,
          multipleTools: false,
          toolCount: 1
        };
      } else {
        return {
          success: false,
          message: '未识别的决策格式',
          multipleTools: false,
          toolCount: 0
        };
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 行动阶段失败: ${error.message}`);
      return {
        success: false,
        message: `执行行动失败: ${error.message}`,
        multipleTools: false,
        toolCount: 0
      };
    }
  }

  /**
   * 调用AI（文本模式）
   */
  async callAI(prompt, context) {
    // 创建临时的事件对象用于AI调用
    const tempE = {
      user_id: 'react_system',
      bot: { uin: 'system' },
      group_id: 'system'
    };
    
    const result = await AiCaller.callTextAi(prompt, [], [], tempE);
    
    if (result.success) {
      return result.response;
    } else {
      throw new Error(result.error || 'AI调用失败');
    }
  }

  /**
   * 调用AI（工具调用模式）
   */
  async callAIWithTools(messages, tools, context) {
    // 使用系统配置调用AI
    const config = await ConfigControl.get('ai');
    const apiCaller = AiCaller.getUserOpenaiInstance('system', config);
    
    try {
      const completion = await apiCaller.openai.chat.completions.create({
        model: config.modelType,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: config.temperature || 0.7,
        parallel_tool_calls: true  // 启用并行工具调用
      });

      const message = completion.choices[0].message;
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        logger.info(`[crystelf-ai] AI决定调用 ${message.tool_calls.length} 个工具: ${message.tool_calls.map(tc => tc.function.name).join(', ')}`);
        return {
          tool_calls: message.tool_calls,
          finished: false,
          reasoning: message.content || '执行工具调用'
        };
      } else {
        return {
          action: 'send_message',
          parameters: {
            content: message.content
          },
          finished: true,
          reasoning: message.content
        };
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 工具调用AI失败: ${error.message}`);
      throw error;
    }
  }
}

export default new ReactEngine();