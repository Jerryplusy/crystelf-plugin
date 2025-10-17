import ConfigControl from "../config/configControl.js";
import fs from 'fs';
import path from 'path';

class MemorySystem {
  constructor() {
    this.memoryFile = path.join(process.cwd(), 'data', 'crystelf', 'ai_memory.json');
    this.memories = new Map(); // 内存中的记忆存储
    this.defaultTimeout = 30; // 默认超时时间(天)
  }

  async init() {
    try {
      const config = await ConfigControl.get('ai');
      this.defaultTimeout = config?.timeout || 30;
      await this.loadMemories();
      await this.cleanExpiredMemories();
    } catch (error) {
      logger.error(`[crystelf-ai] 记忆系统初始化失败: ${error.message}`);
    }
  } // TODO 群聊id/用户id分组保存

  async loadMemories() {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const data = fs.readFileSync(this.memoryFile, 'utf8');
        const memoriesData = JSON.parse(data);
        for (const [key, memory] of Object.entries(memoriesData)) {
          this.memories.set(key, memory);
        }
        logger.info(`[crystelf-ai] 加载了 ${this.memories.size} 条记忆`);
      } else {
        const memoryDir = path.dirname(this.memoryFile);
        if (!fs.existsSync(memoryDir)) {
          fs.mkdirSync(memoryDir, { recursive: true });
        }
        fs.writeFileSync(this.memoryFile, '{}');
        logger.info('[crystelf-ai] 创建新的记忆文件');
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 加载记忆失败: ${error.message}`);
    }
  }

  async saveMemories() {
    try {
      const memoriesData = Object.fromEntries(this.memories);
      fs.writeFileSync(this.memoryFile, JSON.stringify(memoriesData, null, 2));
      logger.info('[crystelf-ai] 记忆已保存到文件');
    } catch (error) {
      logger.error(`[crystelf-ai] 保存记忆失败: ${error.message}`);
    }
  }

  /**
   * 添加记忆
   * @param data 内容
   * @param keywords 关键词
   * @param timeout 超时时间
   * @returns {Promise<null|string>}
   */
  async addMemory(data, keywords = [], timeout = null) {
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
      this.memories.set(memoryId, memory);
      await this.saveMemories();

      logger.info(`[crystelf-ai] 添加新记忆: ${memoryId}`);
      return memoryId;
    } catch (error) {
      logger.error(`[crystelf-ai] 添加记忆失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 搜索记忆
   * @param keywords 关键词
   * @param limit 数量限制
   * @returns {Promise<*[]>}
   */
  async searchMemories(keywords = [], limit = 10) {
    try {
      const results = [];

      for (const [memoryId, memory] of this.memories) {
        if (Date.now() > memory.expireAt) {
          continue;
        }
        if (keywords.length > 0) {
          const hasMatch = keywords.some(keyword =>
            memory.keywords.includes(keyword) ||
            memory.data.includes(keyword)
          );
          if (!hasMatch) {
            continue;
          }
        }
        memory.accessCount++;
        memory.lastAccessed = Date.now();
        results.push({
          id: memory.id,
          data: memory.data,
          keywords: memory.keywords,
          relevance: this.calculateRelevance(memory, keywords)
        });
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

      for (const [memoryId, memory] of this.memories) {
        if (now > memory.expireAt) {
          this.memories.delete(memoryId);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        await this.saveMemories();
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
