import ConfigControl from "../config/configControl.js";
import fs from 'fs';
import path from 'path';

class MemorySystem {
  constructor() {
    this.baseDir = path.join(process.cwd(), 'data', 'crystelf', 'memories');
    this.memories = new Map();//缓存个别加载的记忆
    this.defaultTimeout = 30;
  }
  async init() {
    try {
      const config = await ConfigControl.get('ai');
      this.defaultTimeout = config?.timeout || 30;
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      logger.info('[crystelf-ai] 记忆系统初始化完成');
    } catch (error) {
      logger.error(`[crystelf-ai] 记忆系统初始化失败: ${error.message}`);
    }
  }

  /**
   * 动态加载单个用户的记忆
   */
  async loadUserMemories(groupId, userId) {
    try {
      const filePath = path.join(this.baseDir, String(groupId), `${String(userId)}.json`);
      if (!fs.existsSync(filePath)) return {};
      const data = await fs.promises.readFile(filePath, 'utf8');
      const json = JSON.parse(data || '{}');
      for (const [key, memory] of Object.entries(json)) {
        this.memories.set(`${groupId}_${userId}_${key}`, memory);
      }
      return json;
    } catch (error) {
      logger.error(`[crystelf-ai] 加载用户记忆失败(${groupId}/${userId}): ${error.message}`);
      return {};
    }
  }

  //保存指定用户记忆
  async saveMemories(groupId, userId) {
    try {
      const groupPath = path.join(this.baseDir, String(groupId));
      const filePath = path.join(groupPath, `${String(userId)}.json`);
      if (!fs.existsSync(groupPath)) {
        fs.mkdirSync(groupPath, { recursive: true });
      }
      const userMemories = {};
      for (const [key, memory] of this.memories) {
        if (key.startsWith(`${groupId}_${userId}_`)) {
          const memoryId = key.split(`${groupId}_${userId}_`)[1];
          userMemories[memoryId] = memory;
        }
      }
      await fs.promises.writeFile(filePath, JSON.stringify(userMemories, null, 2), 'utf8');
      logger.info(`[crystelf-ai] 记忆已保存到 ${groupId}/${userId}.json`);
    } catch (error) {
      logger.error(`[crystelf-ai] 保存记忆失败: ${error.message}`);
    }
  }

  /**
   * 添加新的记忆
   * @param groupId
   * @param userId
   * @param data 内容
   * @param keywords 关键词数组
   * @param timeout 超时
   * @returns {Promise<null|string>}
   */
  async addMemory(groupId, userId, data, keywords = [], timeout = null) {
    try {
      const memoryId = this.generateMemoryId();
      const expireTime = timeout || this.defaultTimeout;
      const memory = {
        id: memoryId,
        data,
        keywords,
        createdAt: Date.now(),
        expireAt: Date.now() + (expireTime * 24 * 60 * 60 * 1000),
        accessCount: 0,
        lastAccessed: Date.now()
      };
      this.memories.set(`${groupId}_${userId}_${memoryId}`, memory);
      await this.saveMemories(groupId, userId);
      logger.info(`[crystelf-ai] 添加新记忆: ${groupId}/${userId}/${memoryId}`);
      return memoryId;
    } catch (error) {
      logger.error(`[crystelf-ai] 添加记忆失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 搜索记忆
   * @param userId 用户id
   * @param input 输入
   * @param limit 最大记忆
   * @returns {Promise<*[]>}
   */
  async searchMemories(userId, input = '', limit = 10) {
    try {
      if(input === '') return null;
      const keywords = this.extractKeywords(input);
      const results = [];
      const now = Date.now();
      //遍历所有群聊目录
      const groupDirs = fs.existsSync(this.baseDir) ? fs.readdirSync(this.baseDir) : [];
      for (const groupId of groupDirs) {
        const filePath = path.join(this.baseDir, String(groupId), `${String(userId)}.json`);
        if (!fs.existsSync(filePath)) continue;
        const data = await fs.promises.readFile(filePath, 'utf8');
        const json = JSON.parse(data || '{}');
        for (const memory of Object.values(json)) {
          if (now > memory.expireAt) continue; // 跳过过期
          const matchScore = this.calculateMatchScore(memory, keywords);
          if (matchScore > 0) {
            memory.accessCount = (memory.accessCount || 0) + 1;
            memory.lastAccessed = now;
            results.push({
              id: memory.id,
              data: memory.data,
              keywords: memory.keywords,
              relevance: matchScore
            });
          }
        }
      }
      results.sort((a, b) => b.relevance - a.relevance);
      return results.slice(0, limit);
    } catch (error) {
      logger.error(`[crystelf-ai] 搜索记忆失败: ${error.message}`);
      return [];
    }
  }

  //提取关键词
  extractKeywords(text) {
    if (!text) return [];
    text = text.toLowerCase();
    const words = text.match(/[\u4e00-\u9fa5]{1,2}|[a-zA-Z0-9]+/g) || [];
    return Array.from(new Set(words.filter(w => w.length > 0)));
  }

  //记忆匹配分数
  calculateMatchScore(memory, keywords) {
    let score = 0;
    //const text = (memory.data || '').toLowerCase();
    for (const kw of keywords) {
      for (const mk of memory.keywords || []) {
        if (mk.includes(kw) || kw.includes(mk)) score += 10;
      }
      //if (text.includes(kw)) score += 6;
    }
    score += Math.min((memory.accessCount || 0) * 0.2, 5);
    const daysSinceCreated = (Date.now() - memory.createdAt) / (24 * 60 * 60 * 1000);
    score += Math.max(10 - daysSinceCreated * 0.1, 0);
    return score;
  }
  generateMemoryId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new MemorySystem();
