import BaseTool from './baseTool.js';

/**
 * 找到答案工具 - 结束ReAct循环
 */
class FindAnswerTool extends BaseTool {
  constructor() {
    super(
      'find_answer',
      '当你已经收集到足够信息并准备给出最终回答时使用此工具',
      {
        type: 'object',
        properties: {
          confidence: {
            type: 'number',
            description: '回答的信心程度(0-1)，1表示非常确信',
            minimum: 0,
            maximum: 1
          },
          summary: {
            type: 'string',
            description: '简要总结你收集到的关键信息'
          },
          ready_to_respond: {
            type: 'boolean',
            description: '是否准备好给出最终回答',
            default: true
          }
        },
        required: ['confidence', 'summary']
      }
    );
  }

  async execute(params, context) {
    const { confidence, summary, ready_to_respond = true } = params;
    
    logger.info(`[crystelf-ai] AI决定结束循环 - 信心度: ${confidence}, 摘要: ${summary}`);
    
    return {
      success: true,
      message: `已收集足够信息，准备回答`,
      shouldEnd: true,
      confidence,
      summary,
      readyToRespond: ready_to_respond
    };
  }
}

/**
 * 需要更多信息工具 - 继续ReAct循环
 */
class NeedMoreInfoTool extends BaseTool {
  constructor() {
    super(
      'need_more_info',
      '当你需要更多信息才能给出满意回答时使用此工具',
      {
        type: 'object',
        properties: {
          missing_info: {
            type: 'string',
            description: '描述还缺少什么关键信息'
          },
          next_action_plan: {
            type: 'string',
            description: '下一步计划采取什么行动获取信息'
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: '获取这些信息的紧急程度',
            default: 'medium'
          }
        },
        required: ['missing_info', 'next_action_plan']
      }
    );
  }

  async execute(params, context) {
    const { missing_info, next_action_plan, urgency = 'medium' } = params;
    
    logger.info(`[crystelf-ai] AI需要更多信息 - 缺失: ${missing_info}, 计划: ${next_action_plan}`);
    
    return {
      success: true,
      message: `需要更多信息: ${missing_info}`,
      shouldEnd: false,
      missingInfo: missing_info,
      nextPlan: next_action_plan,
      urgency
    };
  }
}

export { FindAnswerTool, NeedMoreInfoTool };