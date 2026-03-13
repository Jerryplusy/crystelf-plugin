import ConfigControl from "../config/configControl.js";

//会话管理
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.groupHistories = new Map();
    this.maxSessions = 10;
    this.maxSessionsPerGroup = 3;
  }

  async init() {
    try {
      const config = await ConfigControl.get("ai");
      this.maxSessions = config?.maxSessions || 10;
      this.maxSessionsPerGroup = config?.maxSessionsPerGroup || 3;
    } catch (error) {
      logger.error(`[crystelf-ai] SessionManager 初始化失败: ${error.message}`);
    }
  }

  /**
   * 创建或获取会话
   * @param groupId
   * @param userId
   * @param e
   * @returns {*|{groupId, userId, isMaster: boolean, chatHistory: null, memory: *[], createdAt: number, lastActive: number, active: boolean}|null}
   */
  createOrGetSession(groupId, userId, e) {
    let groupSessions = this.sessions.get(groupId);
    if (!groupSessions) {
      groupSessions = new Map();
      this.sessions.set(groupId, groupSessions);
    }

    // 检查该群的活跃会话数量
    let activeCount = 0;
    let activeSession = null;
    for (const s of groupSessions.values()) {
      if (s.active) {
        activeCount++;
        activeSession = s;
      }
    }

    // 如果当前用户已经有活跃会话，直接返回
    const existingSession = groupSessions.get(userId);
    if (existingSession && existingSession.active) {
      existingSession.lastActive = Date.now();
      return existingSession;
    }

    // 群内会话数量限制检查
    if (activeCount >= this.maxSessionsPerGroup) {
      if (e?.isMaster) {
        // 主人强制创建，清理最老的非主人会话
        this.cleanOldestActiveSessionInGroup(groupId, false);
      } else {
        logger.info(`[crystelf-ai] 群${groupId}活跃会话已达上限(${this.maxSessionsPerGroup}),拒绝用户${userId}创建新会话`);
        return null;
      }
    }

    if (this.totalActiveSessionCount() >= this.maxSessions) {
      if (e.isMaster) {
        this.cleanOldestActiveSession();
      } else {
        logger.info('[crystelf-ai] 全局活跃session达上限..');
        return null;
      }
    }

    let userSession = groupSessions.get(userId);
    if (!userSession) {
      userSession = {
        groupId,
        userId,
        isMaster: !!e?.isMaster,
        chatHistory: null,
        memory: [],
        createdAt: Date.now(),
        lastActive: Date.now(),
        active: true,
      };
      groupSessions.set(userId, userSession);
      logger.info(`[crystelf-ai] 创建新session: 群${groupId}, 用户${userId}${userSession.isMaster ? "(master)" : ""}`);
    } else {
      userSession.active = true;
      userSession.lastActive = Date.now();
      logger.info(`[crystelf-ai] 重新激活session: 群${groupId}, 用户${userId}`);
    }

    for (const s of groupSessions.values()) {
      if (s.userId !== userId) s.active = false;
    }
    if (!this.groupHistories.has(groupId)) {
      this.groupHistories.set(groupId, []);
    }
    userSession.chatHistory = this.groupHistories.get(groupId);

    return userSession;
  }

  /**
   * 清理群内最老的会话
   * @param groupId
   * @param includeMaster 是否包含主人
   */
  cleanOldestActiveSessionInGroup(groupId, includeMaster = false) {
    const groupSessions = this.sessions.get(groupId);
    if (!groupSessions) return;

    let oldest = null;
    let oldestTime = Date.now();

    for (const [userId, session] of groupSessions) {
      if (!session.active) continue;
      if (!includeMaster && session.isMaster) continue;
      if (session.lastActive < oldestTime) {
        oldestTime = session.lastActive;
        oldest = userId;
      }
    }

    if (oldest) {
      groupSessions.delete(oldest);
      logger.info(`[crystelf-ai] 清理群${groupId}最旧活跃session: 用户${oldest}`);
    }
  }

  /**
   * 标记一个会话为不活跃
   * @param groupId
   * @param userId
   */
  deactivateSession(groupId, userId) {
    const session = this.sessions.get(groupId)?.get(userId);
    if (session) {
      session.active = false;
      logger.info(`[crystelf-ai] 标记session不活跃: 群${groupId}, 用户${userId}`);
    }
  }

  /**
   * 清理最老会话
   */
  cleanOldestActiveSession() {
    let oldest = null;
    let oldestTime = Date.now();
    for (const [groupId, groupSessions] of this.sessions) {
      for (const [userId, session] of groupSessions) {
        if (!session.active || session.isMaster) continue;
        if (session.lastActive < oldestTime) {
          oldestTime = session.lastActive;
          oldest = { groupId, userId };
        }
      }
    }

    if (oldest) {
      const groupSessions = this.sessions.get(oldest.groupId);
      groupSessions?.delete(oldest.userId);
      logger.info(`[crystelf-ai] 清理最旧活跃session: 群${oldest.groupId}, 用户${oldest.userId}`);
    }
  }

  /**
   * 获取会话
   * @param groupId
   * @returns {{active}|any|null}
   */
  getSession(groupId) {
    const groupSessions = this.sessions.get(groupId);
    if (!groupSessions) return null;
    for (const s of groupSessions.values()) {
      if (s.active) return s;
    }
    return null;
  }

  /**
   * 获取群内所有活跃会话数
   * @param groupId
   * @returns {number}
   */
  getActiveSessionCountInGroup(groupId) {
    const groupSessions = this.sessions.get(groupId);
    if (!groupSessions) return 0;
    let count = 0;
    for (const s of groupSessions.values()) {
      if (s.active) count++;
    }
    return count;
  }

  removeSession(groupId, e) {
    const groupSessions = this.sessions.get(groupId);
    if (!groupSessions) return;
    for (const [userId, session] of groupSessions) {
      if (session.isMaster && !e?.isMaster) continue;
      groupSessions.delete(userId);
      logger.info(`[crystelf-ai] 删除session: 群${groupId}, 用户${userId}`);
    }
    if (groupSessions.size === 0) {
      this.sessions.delete(groupId);
      this.groupHistories.delete(groupId);
    }
  }

  /**
   * 更新聊天记录
   * @param groupId
   * @param chatHistory
   */
  updateChatHistory(groupId, chatHistory) {
    if (this.groupHistories.has(groupId)) {
      this.groupHistories.set(groupId, chatHistory);
    } else {
      this.groupHistories.set(groupId, chatHistory);
    }
    const session = this.getSession(groupId);
    if (session) {
      session.lastActive = Date.now();
      session.chatHistory = this.groupHistories.get(groupId);
    }
  }

  cleanTimeoutSessions(timeout = 30 * 60 * 1000) {
    const now = Date.now();
    for (const [groupId, groupSessions] of this.sessions) {
      for (const [userId, session] of groupSessions) {
        if (session.isMaster) continue;
        if (now - session.lastActive > timeout) {
          groupSessions.delete(userId);
          logger.info(`[crystelf-ai] 清理超时session: 群${groupId}, 用户${userId}`);
        }
      }
      if (groupSessions.size === 0) {
        this.sessions.delete(groupId);
        this.groupHistories.delete(groupId);
      }
    }
  }

  totalSessionCount() {
    let count = 0;
    for (const g of this.sessions.values()) count += g.size;
    return count;
  }

  totalActiveSessionCount() {
    let count = 0;
    for (const g of this.sessions.values()) {
      for (const s of g.values()) if (s.active) count++;
    }
    return count;
  }
}

export default new SessionManager();
