import ConfigControl from '../lib/config/configControl.js';
import initDatabase from '../lib/ai-v2/db.js';
import SessionManager from '../lib/ai-v2/session.js';
import OpenAIChatClient from '../lib/ai-v2/openai-client.js';
import HumanizeEngine from '../lib/ai-v2/humanize/index.js';
import { MessageQueueManager } from '../lib/ai-v2/queue.js';
import {
  buildStoredMessageFromEvent,
  extractContent,
  getBotRole,
  getGroupInfoData,
  getQuotedContent,
  isGroupAllowed,
  isQuotingBot,
  sendAIResponse,
  sendEmoji,
} from '../lib/ai-v2/message.js';
import runChat from '../lib/ai-v2/chat-engine.js';

const runtime = {
  ready: false,
  configHash: '',
  config: null,
  db: null,
  sessionManager: null,
  ai: null,
  humanize: null,
  queueManager: new MessageQueueManager(),
  processing: new Set(),
  cooldownUntil: new Map(),
  cooldownTimers: new Map(),
};

function withDefaults(aiConfig = {}, profile = {}) {
  const merged = {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'deepseek-ai/DeepSeek-V3.2-Exp',
    workingModel: 'deepseek-ai/DeepSeek-V3.2-Exp',
    multimodalWorkingModel: 'Qwen/Qwen2.5-VL-72B-Instruct',
    isMultimodal: true,
    maxContextTokens: 128,
    temperature: 0.8,
    historyCount: 100,
    maxIterations: 8,
    blacklistGroups: [],
    whitelistGroups: [],
    imageAnalysisBlacklistUsers: [],
    maxSessions: 100,
    enableGroupAdmin: true,
    cooldownAfterReplyMs: 20_000,
    dynamicDelay: {
      enabled: true,
      interactionWindowMs: 600_000,
      baseDelayMs: 60_000,
      maxDelayMs: 600_000,
    },
    persona:
      'You are Jingling, a clever and emotionally aware group chat companion. You can be helpful when needed, but you should still sound like a real member of the group instead of a customer-support bot.',
    personality: {
      states: [
        'Energetic and quick-witted, likes joining the flow of the conversation',
        'Sleepy and a little lazy, replies become shorter and softer',
        'Focused and serious, gives more solid and thoughtful answers',
        'Playful and lightly teasing, but never mean-spirited',
      ],
      stateProbability: 0.15,
    },
    replyStyle: {
      baseStyle:
        'Speak like a real group member: natural, concise, a little expressive, and never list-like.',
      multipleStyles: [
        'Super lively, with a bit more excitement and energy',
        'A little cheeky, but not passive-aggressive',
        'Laid-back and low-energy, using fewer words',
        'Feels like joining a running joke with a light tease',
      ],
      multipleProbability: 0.2,
    },
    memory: {
      enabled: true,
      maxIterations: 3,
      timeoutMs: 15000,
    },
    topic: {
      enabled: true,
      messageThreshold: 50,
      timeThresholdMs: 8 * 3600_000,
      maxTopicsPerSession: 20,
    },
    planner: {
      enabled: true,
      idleThresholdMs: 30 * 60_000,
      idleMessageCount: 100,
      idleCheckBotIds: [],
    },
    typo: {
      enabled: true,
      errorRate: 0.03,
      wordReplaceRate: 0.1,
    },
    emoji: {
      enabled: false,
      replyProbability: 0.3,
      characters: ['zhenxun'],
      availableEmotions: [
        'angry',
        'bye',
        'confused',
        'default',
        'good',
        'goodmorning',
        'goodnight',
        'happy',
        'sad',
        'shy',
        'sorry',
        'surprise',
      ],
      useAISelection: false,
    },
    expression: {
      enabled: true,
      maxExpressions: 100,
      sampleSize: 8,
    },
    nicknames: [],
    ...aiConfig,
  };

  const nicknames = new Set(
    [profile?.nickName, ...(Array.isArray(merged.nicknames) ? merged.nicknames : [])].filter(
      Boolean
    )
  );
  merged.nicknames = [...nicknames];
  return merged;
}

async function ensureRuntime() {
  const allConfig = ConfigControl.get() || {};
  const config = withDefaults(allConfig.ai, allConfig.profile);
  const configHash = JSON.stringify(config);

  if (!runtime.ready) {
    runtime.db = initDatabase();
    runtime.sessionManager = new SessionManager(runtime.db, config.maxSessions);
    runtime.ai = new OpenAIChatClient(config);
    runtime.humanize = new HumanizeEngine(runtime.ai, config, runtime.db);
    runtime.ready = true;
    runtime.config = config;
    runtime.configHash = configHash;
    return runtime;
  }

  if (runtime.configHash !== configHash) {
    runtime.config = config;
    runtime.configHash = configHash;
    runtime.ai.refreshConfig(config);
    runtime.sessionManager.maxSize = config.maxSessions;
    runtime.humanize = new HumanizeEngine(runtime.ai, config, runtime.db);
  }

  return runtime;
}

function detectResetCommand(e) {
  return /^([#\/])?重置(对话|会话)$/.test((e.msg || '').trim());
}

async function detectTrigger(e, config) {
  const extracted = extractContent(e, config, config.nicknames);
  const quotedBot = await isQuotingBot(e);

  logger.info(
    `[crystelf-ai-v2] trigger check group=${e.group_id} user=${e.user_id} text=${JSON.stringify(extracted.text)} directAt=${Boolean(extracted.isDirectAt)} nicknameMatched=${Boolean(extracted.nicknameMatched)} images=${extracted.imageUrls?.length || 0}`
  );

  if (quotedBot) {
    logger.info(`[crystelf-ai-v2] trigger matched quoted bot message in group=${e.group_id}`);
    return {
      shouldTrigger: true,
      reason: 'comment',
      extracted,
      quotedBot,
    };
  }

  if (extracted.isDirectAt) {
    logger.info(`[crystelf-ai-v2] trigger matched direct @ in group=${e.group_id}`);
    return {
      shouldTrigger: true,
      reason: 'reply',
      extracted,
      quotedBot: null,
    };
  }

  if (extracted.nicknameMatched) {
    logger.info(`[crystelf-ai-v2] trigger matched nickname in group=${e.group_id}`);
    return {
      shouldTrigger: true,
      reason: 'nickname',
      extracted,
      quotedBot: null,
    };
  }

  logger.info(`[crystelf-ai-v2] trigger miss in group=${e.group_id} user=${e.user_id}`);
  return {
    shouldTrigger: false,
    reason: '',
    extracted,
    quotedBot: null,
  };
}

async function buildTargetMessage(e, config, trigger) {
  const quoted = await getQuotedContent(e);
  const userName = e.sender?.card || e.sender?.nickname || String(e.user_id);
  let content = trigger.extracted.text || '';

  if (quoted?.content) {
    content = `${content ? `${content}\n` : ''}[引用消息] ${quoted.senderName}: ${quoted.content}`;
  }
  if (!content && trigger.extracted.imageUrls.length > 0) {
    content = '[用户发送了图片]';
  }
  if (!content) {
    content = '你好';
  }

  return {
    userName,
    userId: e.user_id,
    userRole: e.sender?.role || 'member',
    userTitle: e.sender?.title,
    content,
    messageId: e.message_id,
    timestamp: Date.now(),
    imageUrls: trigger.extracted.imageUrls,
    replyContext: trigger.reason,
  };
}

function saveIncomingMessage(e, sessionId, storedText, runtimeState) {
  if (!storedText) return;
  runtimeState.db.saveMessage(buildStoredMessageFromEvent(e, sessionId, storedText));
}

async function getHumanizeContexts(runtimeState, sessionId, targetMessage, history) {
  const memoryContext = await runtimeState.humanize.memoryRetrieval.retrieve(
    sessionId,
    targetMessage.content,
    targetMessage.userName,
    history
  );

  return {
    memoryContext: memoryContext || undefined,
    topicContext: runtimeState.humanize.topicTracker.getTopicContext(sessionId) || undefined,
    expressionContext:
      runtimeState.humanize.expressionLearner.getExpressionContext(sessionId) || undefined,
  };
}

async function saveBotMessages(runtimeState, sessionId, e, messages) {
  const now = Date.now();
  const botNickname = runtimeState.config.nicknames[0] || '晶灵';
  for (const message of messages) {
    runtimeState.db.saveMessage({
      sessionId,
      role: 'assistant',
      content: message,
      userId: e.bot.uin,
      userName: botNickname,
      userRole: 'member',
      groupId: e.group_id,
      groupName: e.group_name || e.group?.info?.group_name,
      timestamp: now,
    });
  }
}

async function processGroupMessage(e, runtimeState, trigger, reviewPayload) {
  const sessionId = `group:${e.group_id}`;
  logger.info(
    `[crystelf-ai-v2] process start session=${sessionId} trigger=${trigger.reason} review=${Boolean(reviewPayload)}`
  );
  if (runtimeState.processing.has(sessionId)) {
    logger.info(`[crystelf-ai-v2] session already processing, enqueue review session=${sessionId}`);
    runtimeState.queueManager.enqueue(sessionId, e, 'review');
    return;
  }

  runtimeState.processing.add(sessionId);
  try {
    runtimeState.sessionManager.getOrCreate(sessionId, 'group', e.group_id);
    const history = runtimeState.db.getMessages(sessionId, runtimeState.config.historyCount);

    const targetMessage =
      reviewPayload || (await buildTargetMessage(e, runtimeState.config, trigger));
    const triggerType = reviewPayload ? 'review' : trigger.reason;
    let plannerResult = {
      action: 'reply',
      reason: `direct trigger: ${triggerType}`,
      rawResponse: 'bypassed for direct @ trigger',
    };

    if (triggerType !== 'reply') {
      plannerResult = await runtimeState.humanize.actionPlanner.plan(
        sessionId,
        runtimeState.config.nicknames[0] || '晶灵',
        history,
        targetMessage.content,
        {
          isIdleCheck: trigger.reason === 'idle',
          triggerType,
        }
      );

      logger.info(
        `[crystelf-ai-v2] planner raw session=${sessionId} trigger=${triggerType} raw=${JSON.stringify(plannerResult.rawResponse || '')}`
      );
      logger.info(
        `[crystelf-ai-v2] planner result session=${sessionId} trigger=${triggerType} action=${plannerResult.action} reason=${JSON.stringify(plannerResult.reason || '')}`
      );

      if (plannerResult.action === 'wait' || plannerResult.action === 'complete') {
        logger.info(
          `[crystelf-ai-v2] skip reply by planner session=${sessionId} action=${plannerResult.action}`
        );
        return;
      }
    } else {
      logger.info(`[crystelf-ai-v2] bypass planner for direct @ trigger session=${sessionId}`);
    }

    const botRole = await getBotRole(e);
    const groupInfo = await getGroupInfoData(e);
    const humanizeContexts = await getHumanizeContexts(
      runtimeState,
      sessionId,
      targetMessage,
      history
    );

    const toolCtx = {
      event: e,
      sessionId,
      groupId: e.group_id,
      userId: e.user_id,
      config: runtimeState.config,
      db: runtimeState.db,
      ai: runtimeState.ai,
      botRole,
      pendingImageUrls: targetMessage.imageUrls,
    };

    const result = await runChat(
      runtimeState.ai,
      toolCtx,
      history,
      targetMessage,
      {
        config: runtimeState.config,
        groupName: groupInfo.groupName,
        memberCount: groupInfo.memberCount,
        botNickname: runtimeState.config.nicknames[0] || '晶灵',
        botRole,
        isGroup: true,
        plannerThoughts: plannerResult.reason,
        replyContext: {
          type: reviewPayload ? 'review' : trigger.reason,
        },
        reviewMessages: reviewPayload?.reviewMessages,
        ...humanizeContexts,
      },
      runtimeState.humanize
    );

    if (result.messages.length > 0) {
      logger.info(
        `[crystelf-ai-v2] sending ${result.messages.length} message(s) session=${sessionId}`
      );
      await sendAIResponse(e, result.messages, runtimeState.humanize.typoGenerator);
      await saveBotMessages(runtimeState, sessionId, e, result.messages);
      if (result.emojiPath) {
        logger.info(`[crystelf-ai-v2] sending emoji session=${sessionId}`);
        await sendEmoji(e, result.emojiPath);
      }
      runtimeState.cooldownUntil.set(
        sessionId,
        Date.now() + runtimeState.config.cooldownAfterReplyMs
      );
      scheduleCooldownFlush(sessionId, runtimeState.config.cooldownAfterReplyMs);
    } else {
      logger.warn(`[crystelf-ai-v2] chat engine returned no messages session=${sessionId}`);
    }
  } catch (error) {
    logger.error(`[crystelf-ai-v2] 处理群消息失败: ${error.message}`);
  } finally {
    runtimeState.processing.delete(sessionId);
  }
}

async function flushQueuedMessages(sessionId) {
  const runtimeState = await ensureRuntime();
  if (runtimeState.processing.has(sessionId)) {
    logger.info(`[crystelf-ai-v2] flush skipped because session still processing: ${sessionId}`);
    return;
  }

  const queue = runtimeState.queueManager.getQueue(sessionId);
  if (!queue.length) {
    logger.info(`[crystelf-ai-v2] flush skipped because queue is empty: ${sessionId}`);
    return;
  }

  logger.info(
    `[crystelf-ai-v2] flushing queued messages session=${sessionId} count=${queue.length}`
  );

  runtimeState.queueManager.clearQueue(sessionId);
  const latest = queue[queue.length - 1].event;
  const reviewMessages = queue.map(({ event }) => {
    const extracted = extractContent(event, runtimeState.config, runtimeState.config.nicknames);
    return {
      content: extracted.text || '[无文本]',
      userName: event.sender?.card || event.sender?.nickname || String(event.user_id),
      userId: event.user_id,
      messageId: event.message_id,
    };
  });

  await processGroupMessage(
    latest,
    runtimeState,
    {
      reason: 'review',
      extracted: extractContent(latest, runtimeState.config, runtimeState.config.nicknames),
    },
    {
      userName: reviewMessages.length > 1 ? '多人' : reviewMessages[0]?.userName || '未知用户',
      userId: reviewMessages[0]?.userId || latest.user_id,
      userRole: 'member',
      content: reviewMessages.map((item) => `${item.userName}: ${item.content}`).join('\n'),
      messageId: reviewMessages[reviewMessages.length - 1]?.messageId,
      timestamp: Date.now(),
      imageUrls: [],
      reviewMessages: {
        contents: reviewMessages.map((item) => item.content),
        userNames: reviewMessages.map((item) => item.userName),
        messageIds: reviewMessages.map((item) => item.messageId),
      },
    }
  );
}

function scheduleCooldownFlush(sessionId, delayMs) {
  if (runtime.cooldownTimers.has(sessionId)) {
    clearTimeout(runtime.cooldownTimers.get(sessionId));
  }

  const timer = setTimeout(() => {
    runtime.cooldownTimers.delete(sessionId);
    flushQueuedMessages(sessionId).catch((error) => {
      logger.error(`[crystelf-ai-v2] flush 队列失败: ${error.message}`);
    });
  }, delayMs);

  runtime.cooldownTimers.set(sessionId, timer);
}

async function onGroupMessage(e) {
  const runtimeState = await ensureRuntime();
  const appConfig = ConfigControl.get('config') || {};
  logger.info(
    `[crystelf-ai-v2] onGroupMessage group=${e.group_id} user=${e.user_id} raw=${JSON.stringify(e.raw_message || '')}`
  );
  if (!appConfig.ai) {
    logger.warn('[crystelf-ai-v2] skip because app config ai is disabled');
    return;
  }
  if (e.user_id === e.bot.uin) {
    logger.info('[crystelf-ai-v2] skip self message');
    return;
  }
  if (!e.group_id) {
    logger.warn('[crystelf-ai-v2] skip because group_id is missing');
    return;
  }
  if (!isGroupAllowed(e.group_id, runtimeState.config)) {
    logger.info(`[crystelf-ai-v2] skip because group=${e.group_id} is not allowed`);
    return;
  }
  if (!runtimeState.config.apiKey) {
    logger.warn('[crystelf-ai-v2] skip because apiKey is empty');
    return;
  }

  const trigger = await detectTrigger(e, runtimeState.config);
  const sessionId = `group:${e.group_id}`;

  const storedText = await buildTargetMessage(e, runtimeState.config, {
    extracted: trigger.extracted,
    reason: trigger.reason || 'observe',
  })
    .then((item) => item.content)
    .catch(() => '');
  saveIncomingMessage(e, sessionId, storedText, runtimeState);

  runtimeState.humanize.topicTracker.onMessage(sessionId).catch(() => null);
  runtimeState.humanize.expressionLearner
    .onMessage(sessionId, buildStoredMessageFromEvent(e, sessionId, storedText))
    .catch(() => null);

  if (!trigger.shouldTrigger) {
    logger.info(`[crystelf-ai-v2] skip because message is not a trigger session=${sessionId}`);
    return;
  }

  if (detectResetCommand(e)) {
    logger.info(
      `[crystelf-ai-v2] skip normal flow because reset command matched session=${sessionId}`
    );
    return;
  }

  const cooldownUntil = runtimeState.cooldownUntil.get(sessionId) || 0;
  if (Date.now() < cooldownUntil || runtimeState.processing.has(sessionId)) {
    logger.info(
      `[crystelf-ai-v2] enter cooldown queue session=${sessionId} cooldownLeft=${Math.max(cooldownUntil - Date.now(), 0)} processing=${runtimeState.processing.has(sessionId)}`
    );
    runtimeState.queueManager.enqueue(sessionId, e, 'review');
    scheduleCooldownFlush(sessionId, Math.max(cooldownUntil - Date.now(), 1000));
    return;
  }

  await processGroupMessage(e, runtimeState, trigger);
}

export class crystelfAI extends plugin {
  constructor() {
    super({
      name: 'crystelfAI',
      dsc: '晶灵智能',
      event: 'message.group',
      priority: -1111,
      rule: [
        {
          reg: '^(#|/)?重置(对话|会话)$',
          fnc: 'clearChatHistory',
        },
      ],
    });
  }

  async clearChatHistory(e) {
    const runtimeState = await ensureRuntime();
    const sessionId = `group:${e.group_id}`;
    runtimeState.sessionManager.getOrCreate(sessionId, 'group', e.group_id);
    runtimeState.db.deleteSessionMessages(sessionId);
    runtimeState.db.deleteBotMessages(sessionId);
    runtimeState.cooldownUntil.delete(sessionId);
    return e.reply('当前群会话已重置，聊天上下文清空了。', true);
  }
}

Bot.on('message.group', async (e) => {
  logger.info(
    `[crystelf-ai-v2] Bot event message.group received group=${e.group_id} user=${e.user_id}`
  );
  await onGroupMessage(e);
});
