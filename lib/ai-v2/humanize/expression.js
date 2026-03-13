class ExpressionLearner {
  constructor(ai, config, db) {
    this.ai = ai;
    this.config = config;
    this.db = db;
    this.pendingMessages = new Map();
    this.batchSize = 30;
  }

  async onMessage(sessionId, message) {
    if (!this.config.expression?.enabled) return;
    if (message.role !== 'user' || !message.userId || !message.content || message.content.length < 4) return;

    const pending = this.pendingMessages.get(sessionId) || [];
    pending.push(message);
    this.pendingMessages.set(sessionId, pending);

    if (pending.length < this.batchSize) return;

    this.pendingMessages.set(sessionId, []);
    this.learn(sessionId, pending).catch((error) => {
      logger.warn(`[crystelf-ai-v2] Expression learning failed: ${error.message}`);
    });
  }

  getExpressionContext(sessionId) {
    const sampleSize = this.config.expression?.sampleSize ?? 8;
    const rows = this.db.getExpressions(sessionId, sampleSize * 5);
    if (!rows.length) return '';

    const uniqueRows = [];
    const seenUsers = new Set();
    for (const row of rows) {
      const userKey = String(row.userId || row.userName || '');
      if (seenUsers.has(userKey)) continue;
      seenUsers.add(userKey);
      uniqueRows.push(row);
      if (uniqueRows.length >= sampleSize) break;
    }

    const selected = uniqueRows;
    return `## Expression Habits\n${selected
      .map((item) => `- When ${item.situation}, ${item.userName} tends to ${item.style} (example: \"${item.example}\")`)
      .join('\n')}`;
  }

  async learn(sessionId, messages) {
    const grouped = new Map();
    for (const message of messages) {
      const list = grouped.get(message.userId) || [];
      list.push(message);
      grouped.set(message.userId, list);
    }

    for (const [userId, rows] of grouped.entries()) {
      if (rows.length < 3) continue;
      const userName = rows[0].userName || `User${userId}`;
      const response = await this.ai.generateText({
        prompt: `Analyze the following chat messages from user \"${userName}\" and extract their single most representative speaking habit.\n\nMessages:\n${rows.map((item) => item.content).join('\n')}\n\nReturn ONLY ONE habit for this user, not multiple. Output strict JSON in this shape: {\"expression\":{\"situation\":\"usage context\",\"style\":\"style description\",\"example\":\"original example\"}}. Use the same language as the original chat messages for the extracted content.`,
        messages: [],
        model: this.config.workingModel || this.config.model,
        temperature: 0.3,
        max_tokens: 500,
      });

      const match = response.match(/\{[\s\S]*\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]);
      const item = parsed?.expression || parsed?.expressions?.[0];
      if (!item?.situation || !item?.style || !item?.example) continue;

      const now = Date.now();
      this.db.replaceExpressionForUser(sessionId, userId, {
        sessionId,
        userId,
        userName,
        situation: item.situation,
        style: item.style,
        example: item.example,
        createdAt: now,
      });

      const maxExpressions = this.config.expression?.maxExpressions ?? 100;
      if (this.db.getExpressionCount(sessionId) > maxExpressions) {
        this.db.deleteOldestExpressions(sessionId, maxExpressions);
      }
    }
  }
}

export default ExpressionLearner;
