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
    const rows = this.db.getExpressions(sessionId, sampleSize * 3);
    if (!rows.length) return '';

    const selected = [...rows].sort(() => Math.random() - 0.5).slice(0, sampleSize);
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
        prompt: `Analyze the following chat messages from user \"${userName}\" and extract their speaking habits.\n\nMessages:\n${rows.map((item) => item.content).join('\n')}\n\nOutput strict JSON in this shape: {\"expressions\":[{\"situation\":\"usage context\",\"style\":\"style description\",\"example\":\"original example\"}]}. Use the same language as the original chat messages for the extracted content.`,
        messages: [],
        model: this.config.workingModel || this.config.model,
        temperature: 0.3,
        max_tokens: 500,
      });

      const match = response.match(/\{[\s\S]*\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed.expressions)) continue;

      const now = Date.now();
      for (const item of parsed.expressions) {
        if (!item.situation || !item.style || !item.example) continue;
        this.db.saveExpression({
          sessionId,
          userId,
          userName,
          situation: item.situation,
          style: item.style,
          example: item.example,
          createdAt: now,
        });
      }

      const maxExpressions = this.config.expression?.maxExpressions ?? 100;
      if (this.db.getExpressionCount(sessionId) > maxExpressions) {
        this.db.deleteOldestExpressions(sessionId, maxExpressions);
      }
    }
  }
}

export default ExpressionLearner;
