import ConfigControl from '../../config/configControl.js';

class ActionPlanner {
  constructor(ai, config) {
    this.ai = ai;
    this.config = config;
    this.actionHistory = new Map();
  }

  async plan(sessionId, botName, recentHistory, lastTriggerMessage, options = {}) {
    const isIdleCheck = Boolean(options?.isIdleCheck);
    const triggerText = options?.rawTriggerMessage || lastTriggerMessage;
    const debugEnabled = ConfigControl.get('config')?.debug === true;

    if (!this.config.planner?.enabled) {
      return { action: 'reply', reason: 'planner disabled', rawResponse: 'planner disabled' };
    }

    const history = this.actionHistory.get(sessionId) || [];
    const recentActions = history.slice(-10);
    const actionsBlock = recentActions
      .map((item) => `[${new Date(item.time).toLocaleTimeString()}] ${item.action}`)
      .join('\n');

    const chatBlock = recentHistory
      .slice(-100)
      .map((item) => {
        const time = new Date(item.timestamp);
        const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(
          time.getMinutes()
        ).padStart(2, '0')}`;
        return `[${timeStr}] ${item.userName || (item.role === 'assistant' ? botName : 'unknown')}: ${item.content}`;
      })
      .join('\n');

    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    let prompt;

    if (isIdleCheck) {
      prompt = `It is ${timeStr}. Your name is ${botName}.

Here is the recent chat content (from oldest to most recent):
${chatBlock || '(no chat history)'}

IMPORTANT: There is no specific trigger message this time. You are being proactively invited to observe the group chat and decide whether to speak up.

REPLY when ANY of these is true:
- The conversation mentions ${botName} (you), AI, or any topic you know about
- There's any question unanswered
- The conversation is about school, life, tech, or anything you can contribute to
- Even fragmented/random messages - you can start a new topic or comment on something!

WAIT only when:
- The conversation is clearly done and everyone left
- There's absolutely nothing you can think of to say

IMPORTANT: When in doubt, REPLY! Group chats are often casual and fragmented - that's okay! Your message doesn't need to be perfect, just be natural and friendly.

Available actions:

reply - Send a message to naturally join the conversation (1-2 sentences max, be concise!)

wait - Stay silent and continue observing

complete - The chat is dead, no one is talking

IMPORTANT: You MUST output ONLY valid JSON, no other text. The JSON must be in this exact format:
{"action": "reply", "reason": "your reason here", "wait_seconds": 0}

OR for wait:
{"action": "wait", "reason": "your reason here", "wait_seconds": 60}

OR for complete:
{"action": "complete", "reason": "your reason here", "wait_seconds": 0}

DO NOT include any explanation, markdown formatting, or additional text. Only output the JSON.`;
    } else {
      prompt = `It is ${timeStr}. Your name is ${botName}.

Here is the chat content:
${chatBlock}

Action history:
${actionsBlock || '(none)'}

Message that triggered you: ${triggerText}

Available actions:

reply - Respond ONLY when truly necessary:
- Someone directly asked you a question
- Someone mentioned you specifically
- Something needs explanation or clarification
- There's an obvious opportunity to add real value

wait - DEFAULT choice. Stay silent when:
- You have nothing meaningful to add
- The conversation doesn't need you
- Someone else is already handling it
- You're just being polite but have nothing to say

complete - The chat is over, no activity for a while

IMPORTANT: Silence is golden. When in doubt, WAIT. Don't speak just because you can.

IMPORTANT: You MUST output ONLY valid JSON, no other text. The JSON must be in this exact format:
{"action": "reply", "reason": "your reason here", "wait_seconds": 0}

OR for wait:
{"action": "wait", "reason": "your reason here", "wait_seconds": 30}

OR for complete:
{"action": "complete", "reason": "your reason here", "wait_seconds": 0}

DO NOT include any explanation, markdown formatting, or additional text. Only output the JSON.`;
    }

    try {
      if (debugEnabled) {
        logger.info(
          `[crystelf-ai] planner prompt session=${sessionId} last=${JSON.stringify(String(triggerText || '').slice(0, 80))} idle=${isIdleCheck}\n${prompt}`
        );
      }

      const content = await this.ai.generateText({
        prompt,
        messages: [],
        model: this.config.workingModel || this.config.model,
        temperature: isIdleCheck ? 0.3 : 0.2,
        max_tokens: isIdleCheck ? 300 : 500,
      });

      if (!content || !content.trim()) {
        logger.warn('[crystelf-ai] planner empty response, fallback reply');
        return { action: 'reply', reason: 'empty response', rawResponse: content || '' };
      }

      let jsonStr = '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      if (!jsonStr) {
        logger.warn(
          `[crystelf-ai] planner failed to find json: ${String(content).slice(0, 100)}`
        );
        return { action: 'reply', reason: 'parse failed', rawResponse: content };
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        try {
          jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          parsed = JSON.parse(jsonStr);
        } catch {
          logger.warn(`[crystelf-ai] planner failed to parse json: ${jsonStr.slice(0, 100)}`);
          return { action: 'reply', reason: 'parse failed', rawResponse: content };
        }
      }

      const action =
        parsed.action === 'wait'
          ? 'wait'
          : parsed.action === 'complete'
            ? 'complete'
            : 'reply';

      const waitSeconds =
        action === 'wait'
          ? Math.min(Math.max(Number(parsed.wait_seconds || 30), 10), 300)
          : 0;

      const result = {
        action,
        reason: parsed.reason || '',
        waitSeconds,
        waitMs: waitSeconds > 0 ? waitSeconds * 1000 : undefined,
        rawResponse: content,
      };

      const actions = this.actionHistory.get(sessionId) || [];
      actions.push({ action, time: Date.now() });
      if (actions.length > 20) actions.splice(0, actions.length - 20);
      this.actionHistory.set(sessionId, actions);

      logger.info(
        `[crystelf-ai] planner final session=${sessionId} action=${action} reason=${JSON.stringify(result.reason)}${result.waitMs ? ` waitMs=${result.waitMs}` : ''}`
      );
      return result;
    } catch (error) {
      logger.error(`[crystelf-ai] planner error: ${error.message}`);
      return { action: 'reply', reason: 'error fallback', rawResponse: String(error?.message || error) };
    }
  }
}

export default ActionPlanner;
