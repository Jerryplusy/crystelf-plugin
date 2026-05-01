class ExpressionLearner {
  constructor(ai, config, db) {
    this.ai = ai;
    this.config = config;
    this.db = db;
    this.pendingMessagesByUser = new Map();
    this.learningUsers = new Set();
  }

  async onMessage(_sessionId, message) {
    if (!this.config.expression?.enabled) return;
    if (message.role !== 'user') return;
    if (!message.content || message.content.length < 4) return;
    if (!message.userId) return;

    const pending = this.pendingMessagesByUser.get(message.userId) || [];
    pending.push(message);
    this.pendingMessagesByUser.set(message.userId, pending);

    await this.tryLearn(message.userId);
  }

  getExpressionContextForUser(userId, userName) {
    if (!this.config.expression?.enabled) return '';
    if (!userId) return '';

    const sampleSize = this.config.expression?.sampleSize ?? 8;
    const expressions = this.db.getExpressionsByUser(userId, sampleSize);
    if (!expressions.length) return '';

    const selected = expressions.slice(0, sampleSize);
    const habits = selected.map(
      (expr) => `- When ${expr.situation}: ${expr.style} (e.g. "${expr.example}")`
    );

    return `## Expression Habits\nExpression habits learned from ${userName}. If you are replying to this user, you may naturally reference these habits:\n${habits.join('\n')}`;
  }

  async tryLearn(userId) {
    if (this.learningUsers.has(userId)) return;

    const threshold = Math.max(1, this.config.expression?.learnAfterMessages ?? 100);
    const pending = this.pendingMessagesByUser.get(userId) || [];
    if (pending.length < threshold) return;

    this.learningUsers.add(userId);
    try {
      while (true) {
        const current = this.pendingMessagesByUser.get(userId) || [];
        if (current.length < threshold) break;

        const batch = current.slice(0, threshold);
        this.pendingMessagesByUser.set(userId, current.slice(threshold));
        await this.learnForUser(userId, batch);
      }
    } catch (error) {
      logger.warn(`[crystelf-ai] Expression learning failed for user ${userId}: ${error.message}`);
    } finally {
      this.learningUsers.delete(userId);
    }
  }

  async learnForUser(userId, messages) {
    if (!messages.length) return;

    const maxHabits = Math.max(1, this.config.expression?.sampleSize ?? 8);
    const userName = messages[messages.length - 1].userName || `User${userId}`;
    const msgTexts = messages.map((item) => item.content).join('\n');

    const previousExpressions = this.db.getExpressionsByUser(userId, maxHabits);
    const previousText = previousExpressions.length
      ? previousExpressions
        .map(
          (expr, index) =>
            `${index + 1}. situation=${expr.situation}; style=${expr.style}; example=${expr.example}`
        )
        .join('\n')
      : 'None';

    const content = await this.ai.generateText({
      prompt: `You are refining expression habits for a single user named "${userName}".

New messages from this user:
${msgTexts}

Previously learned habits:
${previousText}

Task:
1. Merge previous habits and new evidence.
2. Remove weak or duplicated habits.
3. Output a revised list with at most ${maxHabits} habits.
4. situation/style/example must be in the SAME LANGUAGE as this user's messages.

Output strictly in JSON:
{"expressions":[{"situation":"...","style":"...","example":"..."}]}

If nothing reliable can be extracted, keep stable previous habits when possible. If still nothing, output {"expressions":[]}.`,
      messages: [],
      model: this.config.workingModel || this.config.model,
      temperature: 0.2,
      max_tokens: 600,
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.expressions)) return;

    const normalized = parsed.expressions
      .map((expr) => ({
        situation: String(expr?.situation || '').trim(),
        style: String(expr?.style || '').trim(),
        example: String(expr?.example || '').trim(),
      }))
      .filter((expr) => expr.situation && expr.style && expr.example)
      .slice(0, maxHabits);

    if (!normalized.length) return;

    this.db.replaceExpressionsByUser(userId, userName, normalized);
    logger.info(`[crystelf-ai] expression updated user=${userName}(${userId}) count=${normalized.length}`);
  }
}

export default ExpressionLearner;
