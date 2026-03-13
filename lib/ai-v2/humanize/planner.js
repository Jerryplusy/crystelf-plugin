class ActionPlanner {
  constructor(ai, config) {
    this.ai = ai;
    this.config = config;
    this.actionHistory = new Map();
  }

  async plan(sessionId, botName, recentHistory, triggerMessage, options = {}) {
    const isIdleCheck = Boolean(options?.isIdleCheck);
    const triggerType = options?.triggerType || 'reply';
    if (!this.config.planner?.enabled) {
      return { action: 'reply', reason: 'planner disabled', rawResponse: 'planner disabled' };
    }

    const historyText = recentHistory
      .slice(-80)
      .map((item) => `[${new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}] ${item.userName || botName}: ${item.content}`)
      .join('\n');

    const prompt = isIdleCheck
      ? `It is ${new Date().toLocaleString('zh-CN')}. Your name is ${botName}.\n\nRecent group chat:\n${historyText || '(no chat history)'}\n\nThere is no direct trigger right now. Decide whether you should naturally join the conversation.\n\nAvailable actions:\n- reply: you should speak now\n- wait: stay silent for a while\n- complete: nothing meaningful is happening\n\nOutput ONLY valid JSON in exactly this shape: {\"action\":\"reply|wait|complete\",\"reason\":\"short reason\",\"wait_seconds\":0}`
      : `It is ${new Date().toLocaleString('zh-CN')}. Your name is ${botName}.\n\nRecent group chat:\n${historyText}\n\nTrigger message: ${triggerMessage}\n\nDecide whether this is worth replying to. Prefer silence when you have nothing useful to add, but do reply when you were directly addressed, asked for help, or can add clear value.\n\nOutput ONLY valid JSON in exactly this shape: {\"action\":\"reply|wait|complete\",\"reason\":\"short reason\",\"wait_seconds\":0}`;

    try {
      const response = await this.ai.generateText({
        prompt,
        messages: [],
        model: this.config.workingModel || this.config.model,
        temperature: isIdleCheck ? 0.3 : 0.2,
        max_tokens: 200,
      });

      const match = response.match(/\{[\s\S]*\}/);
      if (!match) {
        return { action: 'reply', reason: 'planner parse failed', rawResponse: response };
      }

      const parsed = JSON.parse(match[0]);
      const result = {
        action: ['reply', 'wait', 'complete'].includes(parsed.action) ? parsed.action : 'reply',
        reason: parsed.reason || '',
        waitSeconds: Number(parsed.wait_seconds || 0),
        rawResponse: response,
      };

      const history = this.actionHistory.get(sessionId) || [];
      history.push({ action: result.action, time: Date.now() });
      this.actionHistory.set(sessionId, history.slice(-10));

      return result;
    } catch (error) {
      logger.warn(`[crystelf-ai-v2] Planner failed, fallback to reply: ${error.message}`);
      return { action: 'reply', reason: 'planner error', rawResponse: String(error?.message || error) };
    }
  }
}

export default ActionPlanner;
