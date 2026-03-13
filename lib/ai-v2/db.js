import fs from 'fs';
import path from 'path';
import Path from '../../constants/path.js';

const DB_PATH = path.join(Path.data, 'ai-chat-db.json');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createEmptyData() {
  return {
    sessions: {},
    messages: [],
    topics: [],
    expressions: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class JsonChatDatabase {
  constructor(filePath = DB_PATH) {
    this.filePath = filePath;
    this.data = createEmptyData();
    this.loaded = false;
  }

  init() {
    if (this.loaded) return;
    ensureDir(this.filePath);

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
      this.loaded = true;
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = raw ? JSON.parse(raw) : createEmptyData();
      this.data = {
        sessions: parsed.sessions || {},
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        expressions: Array.isArray(parsed.expressions) ? parsed.expressions : [],
      };
    } catch (error) {
      logger.warn(`[crystelf-ai-v2] 读取聊天数据库失败，已重建: ${error.message}`);
      this.data = createEmptyData();
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    }

    this.loaded = true;
  }

  flush() {
    ensureDir(this.filePath);
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  saveSession(meta) {
    this.init();
    this.data.sessions[meta.id] = clone(meta);
    this.flush();
  }

  getSession(id) {
    this.init();
    return this.data.sessions[id] ? clone(this.data.sessions[id]) : null;
  }

  saveMessage(msg) {
    this.init();
    const nextId = this.data.messages.length > 0 ? (this.data.messages[this.data.messages.length - 1].id || 0) + 1 : 1;
    this.data.messages.push({ id: nextId, ...clone(msg) });
    if (this.data.messages.length > 5000) {
      this.data.messages = this.data.messages.slice(-5000);
    }
    this.flush();
  }

  getMessages(sessionId, limit = 100, before) {
    this.init();
    let rows = this.data.messages.filter((row) => row.sessionId === sessionId);
    if (before) {
      rows = rows.filter((row) => row.timestamp < before);
    }
    rows = rows.sort((a, b) => a.timestamp - b.timestamp || (a.id || 0) - (b.id || 0));
    return clone(rows.slice(-limit));
  }

  getBotMessages(groupId, limit = 50) {
    this.init();
    const rows = this.data.messages
      .filter((row) => row.groupId === groupId && row.role === 'assistant')
      .sort((a, b) => a.timestamp - b.timestamp || (a.id || 0) - (b.id || 0));
    return clone(rows.slice(-limit));
  }

  getMessagesByUser(userId, sessionId, limit = 20) {
    this.init();
    let rows = this.data.messages.filter((row) => row.userId === userId);
    if (sessionId) {
      rows = rows.filter((row) => row.sessionId === sessionId);
    }
    rows = rows.sort((a, b) => a.timestamp - b.timestamp || (a.id || 0) - (b.id || 0));
    return clone(rows.slice(-limit));
  }

  searchMessages(sessionId, keyword, limit = 20) {
    this.init();
    const rows = this.data.messages
      .filter((row) => row.sessionId === sessionId && String(row.content || '').includes(keyword))
      .sort((a, b) => a.timestamp - b.timestamp || (a.id || 0) - (b.id || 0));
    return clone(rows.slice(-limit));
  }

  updateCompressedContext(sessionId, context) {
    this.init();
    if (!this.data.sessions[sessionId]) return;
    this.data.sessions[sessionId].compressedContext = context;
    this.data.sessions[sessionId].updatedAt = Date.now();
    this.flush();
  }

  deleteSessionMessages(sessionId) {
    this.init();
    this.data.messages = this.data.messages.filter((row) => row.sessionId !== sessionId);
    this.data.topics = this.data.topics.filter((row) => row.sessionId !== sessionId);
    this.data.expressions = this.data.expressions.filter((row) => row.sessionId !== sessionId);
    if (this.data.sessions[sessionId]) {
      this.data.sessions[sessionId].compressedContext = null;
      this.data.sessions[sessionId].updatedAt = Date.now();
    }
    this.flush();
  }

  deleteBotMessages(sessionId) {
    this.init();
    this.data.messages = this.data.messages.filter((row) => !(row.sessionId === sessionId && row.role === 'assistant'));
    this.flush();
  }

  saveTopic(topic) {
    this.init();
    const nextId = this.data.topics.length > 0 ? (this.data.topics[this.data.topics.length - 1].id || 0) + 1 : 1;
    this.data.topics.push({ id: nextId, ...clone(topic) });
    this.flush();
    return nextId;
  }

  getTopics(sessionId, limit = 10) {
    this.init();
    const rows = this.data.topics
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => b.updatedAt - a.updatedAt || (b.id || 0) - (a.id || 0));
    return clone(rows.slice(0, limit));
  }

  updateTopic(id, updates) {
    this.init();
    const index = this.data.topics.findIndex((row) => row.id === id);
    if (index === -1) return;
    this.data.topics[index] = { ...this.data.topics[index], ...clone(updates) };
    this.flush();
  }

  saveExpression(expr) {
    this.init();
    const nextId = this.data.expressions.length > 0 ? (this.data.expressions[this.data.expressions.length - 1].id || 0) + 1 : 1;
    this.data.expressions.push({ id: nextId, ...clone(expr) });
    this.flush();
  }

  getExpressions(sessionId, limit = 50) {
    this.init();
    const rows = this.data.expressions
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt || (b.id || 0) - (a.id || 0));
    return clone(rows.slice(0, limit));
  }

  getExpressionCount(sessionId) {
    this.init();
    return this.data.expressions.filter((row) => row.sessionId === sessionId).length;
  }

  deleteOldestExpressions(sessionId, keepCount) {
    this.init();
    const target = this.data.expressions
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt || (b.id || 0) - (a.id || 0))
      .slice(0, keepCount)
      .map((row) => row.id);
    this.data.expressions = this.data.expressions.filter((row) => row.sessionId !== sessionId || target.includes(row.id));
    this.flush();
  }

  close() {}
}

let instance;

export function initDatabase() {
  if (!instance) {
    instance = new JsonChatDatabase();
  }
  instance.init();
  return instance;
}

export default initDatabase;
