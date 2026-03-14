function buildTriggerGuidance(triggerType, botName) {
  switch (triggerType) {
    case 'reply':
      return `- Trigger type is direct @ mention. This is a direct address to ${botName}. Strongly prefer reply unless the message is empty or obvious spam.`;
    case 'nickname':
      return `- Trigger type is nickname. The raw incoming message matched your name or nickname, which is a meaningful signal you may be the intended respondent. It is still not a guarantee. Judge from the raw wording and recent context whether replying would feel natural.
- If the raw message starts with your name/nickname and the remaining part is a question, request, greeting, or a query about recent chat context, strongly prefer reply.`;
    case 'comment':
      return `- Trigger type is comment/quoted follow-up. The user replied to one of your previous messages, which is a strong signal you may be involved. Still judge from the wording and recent context whether a reply is natural right now.`;
    case 'review':
      return '- Trigger type is review. Several queued messages arrived while you were cooling down. Reply if there is still a natural opening, otherwise wait.';
    case 'poked':
      return '- Trigger type is poked. A short natural response is usually okay unless it is obvious spam.';
    default:
      return '- Use wait only when the message is truly not aimed at you, is empty/noise, or replying would feel unnatural.';
  }
}

class ActionPlanner {
  constructor(ai, config) {
    this.ai = ai;
    this.config = config;
    this.actionHistory = new Map();
  }

  async plan(sessionId, botName, recentHistory, triggerMessage, options = {}) {
    const isIdleCheck = Boolean(options?.isIdleCheck);
    const triggerType = options?.triggerType || 'reply';
    const rawTriggerMessage = options?.rawTriggerMessage || triggerMessage;
    if (!this.config.planner?.enabled) {
      return { action: 'reply', reason: 'planner disabled', rawResponse: 'planner disabled' };
    }

    const historyText = recentHistory
      .slice(-80)
      .map(
        (item) =>
          `[${new Date(item.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}] ${item.userName || botName}: ${item.content}`
      )
      .join('\n');

    const triggerGuidance = buildTriggerGuidance(triggerType, botName);
    const prompt = isIdleCheck
      ? `It is ${new Date().toLocaleString('zh-CN')}. Your name is ${botName}.\n\nRecent group chat:\n${historyText || '(no chat history)'}\n\nThere is no direct trigger right now. Decide whether you should naturally join the conversation.\n\nAvailable actions:\n- reply: you should speak now\n- wait: stay silent for a while\n- complete: nothing meaningful is happening\n\nDecision rules:\n- Only reply if you can join naturally and add value.\n- If the group is just idle and there is no clear opening, prefer wait.\n\nOutput ONLY valid JSON in exactly this shape: {"action":"reply|wait|complete","reason":"short reason","wait_seconds":0}`
      : `It is ${new Date().toLocaleString('zh-CN')}. Your name is ${botName}.\n\nRecent group chat:\n${historyText || '(no chat history)'}\n\nTrigger type: ${triggerType}\nRaw incoming message: ${rawTriggerMessage}\nNormalized trigger message: ${triggerMessage}\n\nDecide whether this is worth replying to. Prefer silence when you truly have nothing useful to add, but do reply when the message naturally invites your participation, asks for help, greets you, teases you, or you can add clear social value.\n\nDecision rules:\n${triggerGuidance}\n- Trigger type is a signal, not an order. Nickname or quoted-message triggers increase the chance that replying is natural, but do not force a reply.\n- Questions, greetings, requests, and playful teasing that naturally invite your participation should usually be answered with reply.\n- If the message asks what was just sent, what just happened, what someone said, or otherwise asks for recent-chat recall, and the recent chat provides enough context, prefer reply instead of wait.\n- Use wait only when the message is broad group chatter, pure noise/spam, or a reply would be awkward and add no value.\n\nOutput ONLY valid JSON in exactly this shape: {"action":"reply|wait|complete","reason":"short reason","wait_seconds":0}`;

    logger.info(`[crystelf-ai-v2] planner prompt session=${sessionId} trigger=${triggerType}\n${prompt}`);

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
