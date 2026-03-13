class TopicTracker {
  constructor(ai, config, db) {
    this.ai = ai;
    this.config = config;
    this.db = db;
    this.messageCounters = new Map();
    this.lastCheckTime = new Map();
  }

  async onMessage(sessionId) {
    if (!this.config.topic?.enabled) return;

    const count = (this.messageCounters.get(sessionId) || 0) + 1;
    this.messageCounters.set(sessionId, count);

    const threshold = this.config.topic.messageThreshold ?? 50;
    const timeThreshold = this.config.topic.timeThresholdMs ?? 8 * 3600_000;
    const lastCheck = this.lastCheckTime.get(sessionId) || 0;
    const now = Date.now();
    const shouldCheck = count >= threshold || (now - lastCheck > timeThreshold && count >= 15);

    if (!shouldCheck) return;

    this.messageCounters.set(sessionId, 0);
    this.lastCheckTime.set(sessionId, now);
    this.analyzeTopics(sessionId).catch((error) => {
      logger.warn(`[crystelf-ai-v2] Topic analysis failed: ${error.message}`);
    });
  }

  getTopicContext(sessionId) {
    const rows = this.db.getTopics(sessionId, this.config.topic?.maxTopicsPerSession ?? 5);
    if (!rows.length) return '';

    const lines = rows.map((item) => {
      let keywords = [];
      try {
        keywords = JSON.parse(item.keywords || '[]');
      } catch {}
      return `- ${item.title} (${new Date(item.updatedAt).toLocaleString('zh-CN')}) Keywords: ${keywords.join(', ')}\n  ${item.summary}`;
    });

    return `## Recent Topics\n${lines.join('\n')}`;
  }

  async analyzeTopics(sessionId) {
    const messages = this.db.getMessages(sessionId, 80);
    if (messages.length < 10) return;

    const historyTopicTitles = this.db.getTopics(sessionId, 20).map((item) => item.title).join('\n');
    const messagesBlock = messages.map((item, index) => `[${index + 1}] ${item.userName || 'unknown'}: ${item.content}`).join('\n');
    const response = await this.ai.generateText({
      prompt: `You are a topic analysis assistant.\nExisting topic titles:\n${historyTopicTitles || '(none)'}\n\nChat log:\n${messagesBlock}\n\nIdentify the ongoing topics in the chat, summarize them, and output strict JSON in this shape: {\"topics\":[{\"title\":\"Topic title in the chat\'s language\",\"keywords\":[\"keyword1\"],\"summary\":\"Short summary in the chat\'s language\"}]}`,
      messages: [],
      model: this.config.workingModel || this.config.model,
      temperature: 0.3,
      max_tokens: 900,
    });

    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.topics)) return;

    const existingTopics = this.db.getTopics(sessionId, 20);
    const now = Date.now();
    for (const item of parsed.topics) {
      if (!item.title || !item.summary) continue;
      const existing = existingTopics.find((row) => row.title === item.title || this.isSimilar(row.title, item.title));
      if (existing?.id) {
        this.db.updateTopic(existing.id, {
          summary: item.summary,
          keywords: JSON.stringify(item.keywords || []),
          messageCount: (existing.messageCount || 0) + messages.length,
          updatedAt: now,
        });
      } else {
        this.db.saveTopic({
          sessionId,
          title: item.title,
          keywords: JSON.stringify(item.keywords || []),
          summary: item.summary,
          messageCount: messages.length,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  isSimilar(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    let common = 0;
    for (const item of setA) {
      if (setB.has(item)) common++;
    }
    return (common * 2) / (setA.size + setB.size) > 0.7;
  }
}

export default TopicTracker;
