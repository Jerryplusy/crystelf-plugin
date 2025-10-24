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
   * @param e
   * @returns {Promise<{success: boolean, response: (*|string), rawResponse: (*|string)}|{success: boolean, error: string}|{success: boolean, error}>}
   */
  async callAi(prompt, chatHistory = [], memories = [],e) {
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
        customPrompt: await this.getSystemPrompt(e),
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
   * @param e
   * @returns {Promise<Object|{success: boolean, error: string}|{success: boolean, error}>}
   */
  async callAiStream(prompt, chatHistory = [], memories = [], onChunk = null,e) {
    if (!this.isInitialized || !this.config) {
      logger.error('[crystelf-ai] 未初始化或配置无效');
      return { success: false, error: 'AI调用器未初始化' };
    }

    if (!this.config.stream) {
      logger.warn('[crystelf-ai] 流式输出未启用,使用普通调用');
      return await this.callAi(prompt, chatHistory, memories,e);
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
    if (memories && memories.length > 0) {
      fullPrompt += '你可能会用到的记忆,请按情况使用,如果不合语境请忽略:\n';
      memories.forEach((memory, index) => {
        fullPrompt += `${index + 1}. 关键词:${memory.keywords},内容:${memory.data}\n`;
      });
      fullPrompt += '\n';
    }
    fullPrompt += `以下是用户说的内容,会以[用户昵称,用户qq号]的形式给你,但是请注意,你回复message块的时候不需要带[]以及里面的内容,正常回复你想说的话即可:\n${prompt}\n`;
    return fullPrompt;
  }

  /**
   * 获取系统提示词
   * @param {object} e 上下文事件对象
   * @returns {Promise<string>} 系统提示词
   */
  async getSystemPrompt(e) {
    try {
      const basePrompt = this.config?.stream
        ? await getStreamSystemPrompt()
        : await getSystemPrompt();
      const config = await ConfigControl.get();
      const botInfo = {
        id: e.bot?.uin || '未知',
        name: config?.profile?.nickName || '晶灵'
      };

      const userInfo = {
        id: e.user_id || e.sender?.user_id || '未知',
        name: e.sender?.card || e.sender?.nickname || '用户',
        isMaster: e.isMaster,
      };
      const contextIntro = [
        `以下是当前对话的上下文信息（仅供你理解对话背景，请勿泄露，只有在需要的时候使用,不要主动提起）：`,
        `[你的信息]`,
        `- 你的昵称：${botInfo.name}`,
        `- 你的qq号：${botInfo.id}`,
        `- 目前北京时间: ${new Date.now()}`
        ``,
        `[跟你对话的用户的信息]`,
        `- 他的名字：${userInfo.name}`,
        `- 他的qq号(id)：${userInfo.id}`,
        `- 他${userInfo.isMaster ? '是':'不是'}你的主人`,
        ``,
        ``,
        `请基于以上上下文进行理解,这些信息是当你需要的时候使用的,绝对不能泄露这些信息,也不能主动提起`,
        ``,
      ].join('\n');
      return `${contextIntro}${basePrompt}`;
    } catch (error) {
      logger.error(`[crystelf-ai] 生成系统提示词失败: ${error.message}`);
      return await getSystemPrompt();
    }
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
