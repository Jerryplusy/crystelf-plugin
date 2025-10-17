import ConfigControl from '../config/configControl.js';
import OpenaiChat from '../../modules/openai/openaiChat.js';
import OllamaChat from '../../modules/ollama/ollamaChat.js';
import { getSystemPrompt, getStreamSystemPrompt } from '../../constants/ai/prompts.js';

//ai调用器
class AiCaller {
  constructor() {
    this.openaiChat = new OpenaiChat();
    this.ollamaChat = new OllamaChat();
    this.isInitialized = false;
    this.apiType = 'openai';
    this.config = null;
  }

  /**
   * 初始化AI调用器
   */
  async init() {
    try {
      this.config = await ConfigControl.get('ai');
      if (!this.config) {
        logger.error('[crystelf-ai] 配置加载失败');
        return;
      }
      if (this.config.type === 'ollama') {
        this.apiType = 'ollama';
        this.ollamaChat.init(this.config.apiKey, this.config.baseApi);
      } else {
        this.apiType = 'openai';
        this.openaiChat.init(this.config.apiKey, this.config.baseApi);
      }

      this.isInitialized = true;
      logger.info('[crystelf-ai] 初始化完成');
    } catch (error) {
      logger.error(`[crystelf-ai] 初始化失败: ${error.message}`);
    }
  }

  /**
   * ai回复
   * @param prompt 用户输入
   * @param chatHistory 聊天历史
   * @param memories 记忆
   * @returns {Promise<{success: boolean, response: (*|string), rawResponse: (*|string)}|{success: boolean, error: string}|{success: boolean, error}>}
   */
  async callAi(prompt, chatHistory = [], memories = []) {
    if (!this.isInitialized || !this.config) {
      logger.error('[crystelf-ai] 未初始化或配置无效');
      return { success: false, error: 'AI调用器未初始化' };
    }

    try {
      const fullPrompt = this.buildPrompt(prompt, memories);
      const apiCaller = this.apiType === 'ollama' ? this.ollamaChat : this.openaiChat;
      const result = await apiCaller.callAi({
        prompt: fullPrompt,
        chatHistory: chatHistory,
        model: this.config.modelType,
        temperature: this.config.temperature,
        customPrompt: await this.getSystemPrompt(),
      });

      if (result.success) {
        return {
          success: true,
          response: result.aiResponse,
          rawResponse: result.aiResponse,
        };
      } else {
        return {
          success: false,
          error: 'AI调用失败',
        };
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 调用失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 流式回复
   * @param prompt 用户说的话
   * @param chatHistory 聊天记录
   * @param memories 记忆
   * @param onChunk 流式数据回调函数
   * @returns {Promise<Object|{success: boolean, error: string}|{success: boolean, error}>}
   */
  async callAiStream(prompt, chatHistory = [], memories = [], onChunk = null) {
    if (!this.isInitialized || !this.config) {
      logger.error('[crystelf-ai] 未初始化或配置无效');
      return { success: false, error: 'AI调用器未初始化' };
    }

    if (!this.config.stream) {
      logger.warn('[crystelf-ai] 流式输出未启用,使用普通调用');
      return await this.callAi(prompt, chatHistory, memories);
    }

    try {
      // 构建完整的prompt
      const fullPrompt = this.buildPrompt(prompt, memories);
      // TODO 流式API实现
      const result = await this.callAi(prompt, chatHistory, memories);

      if (result.success && onChunk) {
        // 模拟流式输出，将回复分段发送
        const response = result.response;
        const chunks = this.splitResponseIntoChunks(response);

        for (const chunk of chunks) {
          onChunk(chunk);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return result;
    } catch (error) {
      logger.error(`[crystelf-ai] 流式调用失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 构造完整的prompt
   * @param prompt
   * @param memories
   * @returns {string}
   */
  buildPrompt(prompt, memories = []) {
    let fullPrompt = '';
    // TODO 加入标准信息
    if (memories && memories.length > 0) {
      fullPrompt += '相关记忆：\n';
      memories.forEach((memory, index) => {
        fullPrompt += `${index + 1}. ${memory.data}\n`;
      });
      fullPrompt += '\n';
    }
    fullPrompt += `用户说: ${prompt}\n`;
    fullPrompt += '请根据以上信息进行回复：\n';
    return fullPrompt;
  }

  /**
   * 获取系统提示词
   * @returns {Promise<string>} 系统提示词
   */
  async getSystemPrompt() {
    return this.config?.stream ? await getStreamSystemPrompt() : await getSystemPrompt();
  }

  /**
   * 将回复分割成多个块用于流式输出
   * @param {string} response 完整回复
   * @returns {Array} 分割后的块数组
   */
  splitResponseIntoChunks(response) {
    const chunks = [];
    const maxChunkSize = 50;
    for (let i = 0; i < response.length; i += maxChunkSize) {
      chunks.push(response.slice(i, i + maxChunkSize));
    }
    return chunks;
  }
}

export default new AiCaller();
