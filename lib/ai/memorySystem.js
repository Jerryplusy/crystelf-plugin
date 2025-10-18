import ConfigControl from "../config/configControl.js";
import fs from 'fs';
import path from 'path';

class MemorySystem {
  constructor() {
    this.baseDir = path.join(process.cwd(), 'data', 'crystelf', 'memories');
    this.memories = new Map(); // 内存中的记忆存储
    this.defaultTimeout = 30; // 默认超时时间(天)
  }

  async init() {
    try {
      const config = await ConfigControl.get('ai');
      this.defaultTimeout = config?.timeout || 30;
      await this.loadAllMemories();
      await this.cleanExpiredMemories();
    } catch (error) {
      logger.error(`[crystelf-ai] 记忆系统初始化失败: ${error.message}`);
    }
  }

  async loadAllMemories() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }

      const groupDirs = fs.readdirSync(this.baseDir);
      for (const groupId of groupDirs) {
        const groupPath = path.join(this.baseDir, groupId);
        if (!fs.statSync(groupPath).isDirectory()) continue;

        const userFiles = fs.readdirSync(groupPath);
        for (const file of userFiles) {
          if (!file.endsWith('.json')) continue;
          const userId = path.basename(file, '.json');
          const filePath = path.join(groupPath, file);
          const data = fs.readFileSync(filePath, 'utf8');
          const memoriesData = JSON.parse(data || '{}');
          for (const [key, memory] of Object.entries(memoriesData)) {
            this.memories.set(`${groupId}_${userId}_${key}`, memory);
          }
        }
      }
      logger.info(`[crystelf-ai] 加载了 ${this.memories.size} 条记忆`);
    } catch (error) {
      logger.error(`[crystelf-ai] 加载记忆失败: ${error.message}`);
    }
  }

  async saveMemories(groupId, userId) {
    try {
      const groupPath = path.join(this.baseDir, groupId);
      const filePath = path.join(groupPath, `${userId}.json`);
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

      fs.writeFileSync(filePath, JSON.stringify(userMemories, null, 2));
      logger.info(`[crystelf-ai] 记忆已保存到 ${groupId}/${userId}.json`);
    } catch (error) {
      logger.error(`[crystelf-ai] 保存记忆失败: ${error.message}`);
    }
  }

  /**
   * 添加记忆
   * @param groupId 群聊id
   * @param userId 用户id
   * @param data 内容
   * @param keywords 关键词
   * @param timeout 超时时间
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
   * @param keywords 关键词
   * @param limit 数量限制
   * @returns {Promise<*[]>}
   */
  async searchMemories(userId, keywords = [], limit = 10) {
    try {
      const results = [];
      const now = Date.now();
      let searchText = '';
      if (keywords.length === 1 && keywords[0].length > 6) {
        searchText = keywords[0].toLowerCase();
        const words = searchText.match(/[\u4e00-\u9fa5]{1,2}|[a-zA-Z0-9]+/g) || [];
        keywords = Array.from(new Set(words.filter(w => w.length > 1))); // 去重+过滤过短词
      }
      const userMemories = [];
      for (const [key, memory] of this.memories) {
        const parts = key.split('_');
        if (parts.length < 3) continue;
        const uid = parts[1];
        if (uid !== userId) continue;
        if (now > memory.expireAt) continue;
        userMemories.push(memory);
      }
      if (userMemories.length === 0) return [];
      for (const memory of userMemories) {
        let matchScore = 0;
        for (const kw of keywords) {
          if (memory.keywords.some(k => k.includes(kw) || kw.includes(k))) matchScore += 10;
          else if (memory.data.includes(kw)) matchScore += 5;
        }
        if (searchText) {
          for (const mk of memory.keywords) {
            if (searchText.includes(mk)) matchScore += 8;
          }
        }
        if (matchScore > 0) {
          memory.accessCount++;
          memory.lastAccessed = now;
          results.push({
            id: memory.id,
            data: memory.data,
            keywords: memory.keywords,
            relevance: matchScore + this.calculateRelevance(memory, keywords)
          });
        }
      }
      results.sort((a, b) => b.relevance - a.relevance);
      return results.slice(0, limit);
    } catch (error) {
      logger.error(`[crystelf-ai] 搜索记忆失败: ${error.message}`);
      return [];
    }
  }


  calculateRelevance(memory, keywords) {
    let score = 0;
    for (const keyword of keywords) {
      if (memory.keywords.includes(keyword)) {
        score += 10;
      }
      if (memory.data.includes(keyword)) {
        score += 5;
      }
    }
    score += Math.min(memory.accessCount * 0.1, 5);
    const daysSinceCreated = (Date.now() - memory.createdAt) / (24 * 60 * 60 * 1000);
    score += Math.max(10 - daysSinceCreated * 0.1, 0);
    return score;
  }

  /**
   * 清理过期记忆
   */
  async cleanExpiredMemories() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [memoryKey, memory] of this.memories) {
        if (now > memory.expireAt) {
          this.memories.delete(memoryKey);
          cleanedCount++;
          const [groupId, userId] = memoryKey.split('_');
          await this.saveMemories(groupId, userId);
        }
      }

      if (cleanedCount > 0) {
        logger.info(`[crystelf-ai] 清理了 ${cleanedCount} 条过期记忆`);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 清理过期记忆失败: ${error.message}`);
    }
  }

  /**
   * 生成记忆ID
   * @returns {string}
   */
  generateMemoryId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new MemorySystem();
