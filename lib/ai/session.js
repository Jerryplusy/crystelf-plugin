class SessionManager {
  constructor(db, maxSize = 100) {
    this.db = db;
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  getOrCreate(id, type, targetId) {
    const cached = this.get(id);
    if (cached) return cached;

    const now = Date.now();
    const session = {
      id,
      type,
      targetId,
      createdAt: now,
      updatedAt: now,
      compressedContext: null,
    };

    this.db.saveSession(session);
    this.addToCache(id, session);
    return session;
  }

  get(id) {
    if (this.cache.has(id)) {
      return this.touch(id);
    }

    const session = this.db.getSession(id);
    if (!session) return null;
    this.addToCache(id, session);
    return session;
  }

  touch(id) {
    const session = this.cache.get(id);
    if (!session) return null;
    this.cache.delete(id);
    session.updatedAt = Date.now();
    this.cache.set(id, session);
    this.db.saveSession(session);
    return session;
  }

  resetBotMessages(id) {
    this.db.deleteBotMessages(id);
  }

  addToCache(id, session) {
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(id, { ...session });
  }
}

export default SessionManager;
