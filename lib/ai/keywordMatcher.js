import ConfigControl from '../config/configControl.js';
import Words from '../core/words.js';


//关键词匹配器
class KeywordMatcher {
  constructor() {
    this.keywordCache = new Map();
    this.isInitialized = false;
  }

  /**
   * 初始化关键词匹配器
   */
  async init() {
    try {
      await this.preloadKeywords();
      this.isInitialized = true;
    } catch (error) {
      logger.error(`[crystelf-ai] 初始化失败: ${error.message}`);
    }
  }

  /**
   * 预加载关键词列表
   */
  async preloadKeywords() {
    try {
      const aiKeywords = await this.getKeywordsList('ai');
      if (aiKeywords && aiKeywords.length > 0) {
        this.keywordCache.set('ai', aiKeywords);
        logger.info(`[crystelf-ai] 预加载关键词: ${aiKeywords.length} 个`);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 预加载关键词失败: ${error.message}`);
    }
  }

  /**
   * 获取关键词列表
   * @param type 关键词类型
   * @returns {Promise<axios.AxiosResponse<*>|*[]|any>}
   */
  async getKeywordsList(type) {
    try {
      if (this.keywordCache.has(type)) {
        return this.keywordCache.get(type);
      }
      const keywords = await Words.getWordsList(type);
      if (keywords && keywords.length > 0) {
        this.keywordCache.set(type, keywords);
      }
      return keywords || [];
    } catch (error) {
      logger.error(`[crystelf-ai] 获取关键词列表失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取关键词文本
   * @param type 类型
   * @param name 名称
   * @returns {Promise<*|string|string>}
   */
  async getKeywordText(type, name) {
    try {
      const text = await Words.getWord(type, name);
      return text || '';
    } catch (error) {
      logger.error(`[crystelf-ai] 获取关键词文本失败: ${error.message}`);
      return '';
    }
  }

  /**
   * 匹配消息中的关键词
   * @param message 消息
   * @param type 类型
   * @returns {Promise<{keyword: (any|*|any), text: (*|string), matched: boolean, type: string}|null>}
   */
  async matchKeywords(message, type = 'ai') {
    if (!message || !this.isInitialized) {
      return null;
    }
    try {
      const keywords = await this.getKeywordsList(type);
      if (!keywords || keywords.length === 0) {
        return null;
      }
      for (const keyword of keywords) {
        if (message.includes(keyword)) {
          const text = await this.getKeywordText(type, keyword);
          return {
            keyword,
            text,
            matched: true,
            type: 'exact',
          };
        }
      }
      return null;
    } catch (error) {
      logger.error(`[crystelf-ai] 匹配关键词失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 检查消息长度是否超过限制
   * @param message 消息
   * @returns {Promise<boolean>}
   */
  async isMessageTooLong(message) {
    try {
      const config = await ConfigControl.get('ai');
      const maxMix = config?.maxMix || 5;
      //计算消息长度
      const cleanMessage = message.replace(/\s+/g, '').trim();
      return cleanMessage.length > maxMix;
    } catch (error) {
      logger.error(`[crystelf-ai] 检查消息长度失败: ${error.message}`);
      return false;
    }
  }
}

export default new KeywordMatcher();
