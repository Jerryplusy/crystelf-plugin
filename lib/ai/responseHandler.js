import MemorySystem from "./memorySystem.js";
import configControl from "../config/configControl.js";

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
          success: true,
          messages: [parsed]//处理模型降智返回对象的情况
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
    }return true;
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

  //对上下文消息进行处理
  handleChatHistory(message) {
      let messageToHistory = [];
  }

  createErrorResponse(error) {
    const nickName = configControl.get('profile')?.nickName;
    return [{
      type: 'message',
      data: `${nickName}的服务器去火星开小差了..`,
      at: false,
      quote: true,
      recall: 120
    }];
  }

  createDefaultResponse() {
    const nickName = configControl.get('profile')?.nickName;
    return [{
      type: 'message',
      data: `${nickName}的服务器去火星开小差了..`,
      at: false,
      quote: true,
      recall: 120
    }];
  }
}

export default new ResponseHandler();
