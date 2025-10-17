import ConfigControl from "../config/configControl.js";

/**
 * Session管理器
 */
class SessionManager {
  constructor() {
    this.sessions = new Map(); // 存储群聊ID到session的映射
    this.maxSessions = 10; // 默认最大sessions数量
    this.userSessions = new Map(); // 存储用户ID到群聊ID的映射,确保一个群只有一个用户聊天
  }
  // TODO 优化session处理逻辑,主人不清理session等
  async init() {
    try {
      const config = await ConfigControl.get('ai');
      this.maxSessions = config?.maxSessions || 10;
    } catch (error) {
      logger.error(`[crystelf-ai] 初始化失败: ${error.message}`);
    }
  }

  /**
   * 创建/获取session
   * @param groupId 群聊id
   * @param userId 用户id
   * @returns {{groupId, userId, chatHistory: *[], memory: *[], createdAt: number, lastActive: number}|any|null}
   */
  createOrGetSession(groupId, userId) {
    //是否已有该群聊的session
    if (this.sessions.has(groupId)) {
      const session = this.sessions.get(groupId);
      //当前用户不是session的拥有者,返回null
      if (session.userId !== userId) {
        return null;
      }
      //更新最后活动时间
      session.lastActive = Date.now();
      return session;
    }
    // 检查是否达到最大sessions数量
    if (this.sessions.size >= this.maxSessions) {
      this.cleanOldestSession();
    }
    const session = {
      groupId,
      userId,
      chatHistory: [],
      memory: [],
      createdAt: Date.now(),
      lastActive: Date.now()
    };

    this.sessions.set(groupId, session);
    logger.info(`[crystelf-ai] 创建新session: 群${groupId}, 用户${userId}`);
    return session;
  }

  /**
   * 清理最旧的session
   */
  cleanOldestSession() {
    let oldestSession = null;
    let oldestTime = Date.now();
    for (const [groupId, session] of this.sessions) {
      if (session.lastActive < oldestTime) {
        oldestTime = session.lastActive;
        oldestSession = groupId;
      }
    }
    if (oldestSession) {
      this.sessions.delete(oldestSession);
      logger.info(`[crystelf-ai] 清理最旧session: 群${oldestSession}`);
    }
  }

  /**
   * 获取session
   * @param groupId
   * @returns {any|null}
   */
  getSession(groupId) {
    return this.sessions.get(groupId) || null;
  }

  /**
   * 删除session
   * @param groupId
   */
  removeSession(groupId) {
    if (this.sessions.has(groupId)) {
      this.sessions.delete(groupId);
      logger.info(`[crystelf-ai] 删除session: 群${groupId}`);
    }
  }

  /**
   * 更新聊天历史
   * @param groupId
   * @param chatHistory
   */
  updateChatHistory(groupId, chatHistory) {
    const session = this.sessions.get(groupId);
    if (session) {
      session.chatHistory = chatHistory;
      session.lastActive = Date.now();
    }
  }

  /**
   * 清理超时的sessions
   * @param {number} timeout 超时时间(毫秒)
   */
  cleanTimeoutSessions(timeout = 30 * 60 * 1000) { // 默认30分钟
    const now = Date.now();
    for (const [groupId, session] of this.sessions) {
      if (now - session.lastActive > timeout) {
        this.sessions.delete(groupId);
        logger.info(`[crystelf-ai] 清理超时session: 群${groupId}`);
      }
    }
  }
}

export default new SessionManager();
