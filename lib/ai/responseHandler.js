import MemorySystem from "./memorySystem.js";

/**
 * 响应处理器
 * 处理AI返回的规范化响应
 */
class ResponseHandler {
  constructor() {
    this.memorySystem = MemorySystem;
  }

  /**
   * 处理ai响应
   * @param rawResponse ai原始回复
   * @param userMessage 用户消息
   * @param groupId 群聊id
   * @param user_id 用户id
   * @returns {Promise<[{type: string, data: string, at: boolean, quote: boolean, recall: number}]|Array|*[]>}
   */
  async processResponse(rawResponse, userMessage, groupId,user_id) {
    try {
      const parsedResponse = this.parseAiResponse(rawResponse);
      if (!parsedResponse.success) {
        logger.error(`[crystelf-ai] 解析AI响应失败: ${parsedResponse.error}`);
        return this.createErrorResponse(parsedResponse.error);
      }
      const messages = parsedResponse.messages;
      const processedMessages = [];
      for (const message of messages) {
        const processedMessage = await this.processMessage(message, userMessage, groupId,user_id);
        if (processedMessage) {
          processedMessages.push(processedMessage);
        }
      }
      if (processedMessages.length === 0) {
        return this.createDefaultResponse();
      }
      return processedMessages;
    } catch (error) {
      logger.error(`[crystelf-ai] 处理响应失败: ${error.message}`);
      return this.createErrorResponse('处理响应时发生错误');
    }
  }

  parseAiResponse(response) {
    try {
      const cleanResponse = this.cleanResponseText(response);
      const parsed = JSON.parse(cleanResponse);
      if (Array.isArray(parsed)) {
        return {
          success: true,
          messages: parsed
        };
      } else {
        return {
          success: false,
          error: '响应格式不是数组'
        };
      }
    } catch (error) {
      logger.warn(`[crystelf-ai] AI返回非JSON格式: ${error.message}`);
    }
  }

  /**
   * 清理响应文本
   * @param {string} text 原始文本
   * @returns {string} 清理后的文本
   */
  cleanResponseText(text) {
    if (!text) return '';
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    cleaned = cleaned.trim();
    return cleaned;
  }

  async processMessage(message, userMessage, groupId,userId) {
    try {
      if (!this.validateMessage(message)) {
        logger.warn(`[crystelf-ai] 无效消息格式: ${JSON.stringify(message)}`);
        return null;
      }
      switch (message.type) {
        case 'memory':
          await this.handleMemoryMessage(message, groupId,userId);
          return null;
        case 'recall':
          return this.handleRecallMessage(message);
        case 'function':
          return this.handleFunctionMessage(message);
        default:
          return this.handleNormalMessage(message);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 处理消息失败: ${error.message}`);
      return null;
    }
  }

  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      logger.info('[crystelf-ai] ai返回为空或不是对象')
      return false;
    }
    if (!message.type) {
      logger.info('[crystelf-ai] ai响应未包含type值')
      return false;
    }
    const validTypes = [
      'message', 'code', 'markdown', 'meme', 'at', 'poke',
      'recall', 'emoji-like', 'ai-record', 'function', 'like',
      'file', 'memory'
    ];
    if (!validTypes.includes(message.type)) {
      logger.info(`[crystelf-ai] ai返回未知的type类型:${message.type}`)
      return false;
    }
    /**
    switch (message.type) {
      case 'message':
      case 'code':
      case 'markdown':
      case 'meme':
      case 'ai-record':
      case 'file':
      case 'memory':
      case 'at':
      case 'poke':
      case 'emoji-like':
      case 'like':
        return !!message.id;
      case 'recall':
        return !!message.seq;
      case 'function':
        return !!(message.data && message.data.name);
      default:
        return true;
    }*/return true;
  }

  /**
   * 记忆消息
   * @param message 记忆
   * @param groupId 群聊id
   * @param user_id 用户id
   * @returns {Promise<void>}
   */
  async handleMemoryMessage(message, groupId,user_id) {
    try {
      const memoryId = await this.memorySystem.addMemory(
        groupId,
        user_id,
        message.data,
        message.key || [],
        message.timeout || 30
      );
      if (memoryId) {
        logger.info(`[crystelf-ai] 存储记忆成功: ${memoryId}`);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 存储记忆失败: ${error.message}`);
    }
  }

  handleRecallMessage(message) {
    return {
      type: 'recall',
      seq: message.seq
    };
  }

  /**
   * 函数调用消息
   * @param message 函数消息
   * @returns {{type: string, data}}
   */
  handleFunctionMessage(message) {
    // TOdO 具体的函数调用逻辑
    logger.info(`[crystelf-ai] 函数调用: ${message.data.name}(${message.data.params?.join(', ') || ''})`);
    return {
      type: 'function',
      data: message.data
    };
  }

  //普通消息
  handleNormalMessage(message) {
    // 设置默认值
    let processedMessage = {
      type: message.type,
      data: message.data,
      at: message.at || false,
      quote: message.quote || false,
      recall: message.recall || 0
    };
    if (message.id) processedMessage.id = message.id;
    if (message.seq) processedMessage.seq = message.seq;
    if (message.num) processedMessage.num = message.num;
    if (message.filename) processedMessage.filename = message.filename;
    if (message.language) processedMessage.language = message.language;

    return processedMessage;
  }

  createErrorResponse(error) {
    return [{
      type: 'message',
      data: `抱歉,处理回复时出现了错误..`,
      at: false,
      quote: true,
      recall: 120
    }];
  }

  createDefaultResponse() {
    return [{
      type: 'message',
      data: '抱歉,我暂时无法理解你的意思,请重新表达一下~',
      at: false,
      quote: true,
      recall: 120
    }];
  }
}

export default new ResponseHandler();
