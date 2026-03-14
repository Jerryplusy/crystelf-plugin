import ConfigControl from '../lib/config/configControl.js';
import cfg from '../../../lib/config/config.js';
import PluginsLoader from '../../../lib/plugins/loader.js';
import initDatabase from '../lib/ai-v2/db.js';
import SessionManager from '../lib/ai-v2/session.js';
import OpenAIChatClient from '../lib/ai-v2/openai-client.js';
import HumanizeEngine from '../lib/ai-v2/humanize/index.js';
import { MessageQueueManager } from '../lib/ai-v2/queue.js';
import RateLimiter from '../lib/ai-v2/rate-limiter.js';
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
import { processImage } from '../lib/ai-v2/image-analyzer.js';

const AI_PLUGIN_NAME = 'crystelfAI';
const POKE_COOLDOWN_MS = 10 * 60_000;
const IDLE_CHECK_INTERVAL_MS = 60_000;

const runtime = {
  ready: false,
  configHash: '',
  config: null,
  db: null,
  sessionManager: null,
  ai: null,
  humanize: null,
  rateLimiter: null,
  queueManager: new MessageQueueManager(),
  processing: new Set(),
  cooldownUntil: new Map(),
  cooldownTimers: new Map(),
  cooldownMessages: new Map(),
  dynamicDelayQueues: new Map(),
  pokeCooldowns: new Map(),
  groupLastActivityTime: new Map(),
  groupMessageCount: new Map(),
  groupLastBotMessageTime: new Map(),
  groupMessageCountAfterBot: new Map(),
  groupBotsMapping: new Map(),
  idleCheckProcessing: new Set(),
  groupLastIdleCheckTime: new Map(),
  idleCheckTimer: null,
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

function createRateLimiter(config) {
  if (runtime.rateLimiter?.dispose) {
    runtime.rateLimiter.dispose();
  }

  runtime.rateLimiter = new RateLimiter({
    dynamicDelay: config.dynamicDelay,
  });
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
    createRateLimiter(config);
    runtime.ready = true;
    runtime.config = config;
    runtime.configHash = configHash;
    ensureIdleCheckTimer();
    return runtime;
  }

  if (runtime.configHash !== configHash) {
    runtime.config = config;
    runtime.configHash = configHash;
    runtime.ai.refreshConfig(config);
    runtime.sessionManager.maxSize = config.maxSessions;
    runtime.humanize = new HumanizeEngine(runtime.ai, config, runtime.db);
    createRateLimiter(config);
  }

  ensureIdleCheckTimer();
  return runtime;
}

function ensureIdleCheckTimer() {
  if (runtime.idleCheckTimer) {
    return;
  }

  runtime.idleCheckTimer = setInterval(async () => {
    if (!runtime.ready || !runtime.config?.apiKey || !runtime.config?.planner?.enabled) {
      return;
    }

    const cfg = runtime.config;
    const now = Date.now();
    const idleThreshold = cfg.planner.idleThresholdMs ?? 30 * 60_000;
    const messageCountThreshold = cfg.planner.idleMessageCount ?? 100;

    for (const [sessionId, lastTime] of runtime.groupLastActivityTime) {
      const lastCheckTime = runtime.groupLastIdleCheckTime.get(sessionId) ?? 0;
      if (now - lastCheckTime < IDLE_CHECK_INTERVAL_MS) {
        continue;
      }

      if (runtime.processing.has(sessionId) || runtime.idleCheckProcessing.has(sessionId)) {
        continue;
      }

      const groupId = Number(sessionId.split(':')[1]);
      if (!groupId || !isGroupAllowed(groupId, cfg)) {
        continue;
      }

      let lastBotTime = runtime.groupLastBotMessageTime.get(sessionId) ?? 0;
      if (!lastBotTime) {
        const botMessages = runtime.db.getBotMessages(groupId, 1);
        if (botMessages.length > 0) {
          lastBotTime = botMessages[botMessages.length - 1].timestamp;
          runtime.groupLastBotMessageTime.set(sessionId, lastBotTime);
        }
      }

      const lastActivityTime = Math.max(lastTime, lastBotTime);
      if (now - lastActivityTime < idleThreshold) {
        continue;
      }

      const messageCountAfterBot = runtime.groupMessageCountAfterBot.get(sessionId) ?? 0;
      const messageCount =
        lastBotTime > 0 ? messageCountAfterBot : (runtime.groupMessageCount.get(sessionId) ?? 0);

      if (messageCount < messageCountThreshold) {
        continue;
      }

      const botsInGroup = runtime.groupBotsMapping.get(sessionId);
      if (!botsInGroup || botsInGroup.size === 0) {
        continue;
      }

      const configuredBotIds =
        Array.isArray(cfg.planner.idleCheckBotIds) && cfg.planner.idleCheckBotIds.length > 0
          ? cfg.planner.idleCheckBotIds.map((item) => Number(item))
          : [...botsInGroup];
      const availableBotIds = [...botsInGroup].filter((botId) => configuredBotIds.includes(botId));
      if (availableBotIds.length === 0) {
        continue;
      }

      const selfId = availableBotIds[Math.floor(Math.random() * availableBotIds.length)];
      const bot = Bot?.[selfId];
      if (!bot) {
        continue;
      }

      runtime.idleCheckProcessing.add(sessionId);
      try {
        logger.info(`[crystelf-ai-v2] idle trigger session=${sessionId}`);

        const history = runtime.db.getMessages(sessionId, cfg.historyCount);
        const botNickname = cfg.nicknames[0] || '晶灵';
        const plannerResult = await runtime.humanize.actionPlanner.plan(
          sessionId,
          botNickname,
          history,
          '[Check if you want to answer the call]',
          {
            isIdleCheck: true,
            triggerType: 'idle',
            rawTriggerMessage: '[Check if you want to answer the call]',
          }
        );

        logger.info(
          `[crystelf-ai-v2] idle planner session=${sessionId} action=${plannerResult.action} reason=${JSON.stringify(plannerResult.reason || '')}`
        );

        if (plannerResult.action !== 'reply') {
          runtime.groupMessageCount.set(sessionId, 0);
          runtime.groupMessageCountAfterBot.set(sessionId, 0);
          runtime.groupLastIdleCheckTime.set(sessionId, now);
          continue;
        }

        const idleEvent = {
          bot,
          self_id: selfId,
          group_id: groupId,
        };
        const targetMessage = {
          userName: 'system',
          userId: 0,
          userRole: 'member',
          content: "[No one in the group is talking? I'll answer!]",
          messageId: 0,
          timestamp: now,
          imageUrls: [],
        };

        await runReplyFlow(idleEvent, runtime, {
          sessionId,
          targetMessage,
          replyType: 'idle',
          plannerThoughts: `You stumbled upon some message in this group and decided to reply.
Suggestion:
- Quote messages from group friends appropriately (using [[[reply:message ID]]] format)
- Don't mention your intentions like "I'm here to answer" or something like a normal chat`,
        });

        startCooldownTimer(sessionId, groupId, selfId);
        runtime.groupMessageCount.set(sessionId, 0);
        runtime.groupMessageCountAfterBot.set(sessionId, 0);
        runtime.groupLastIdleCheckTime.set(sessionId, now);
        logger.info(`[crystelf-ai-v2] idle reply sent session=${sessionId}`);
      } catch (error) {
        logger.error(`[crystelf-ai-v2] idle check failed session=${sessionId}: ${error.message}`);
      } finally {
        runtime.idleCheckProcessing.delete(sessionId);
      }
    }
  }, IDLE_CHECK_INTERVAL_MS);
}

function detectResetCommand(e) {
  return /^([#\/])?重置(对话|会话)$/.test((e.msg || '').trim());
}

function getSessionId(groupId) {
  return `group:${groupId}`;
}

function getBotUin(e) {
  return e?.bot?.uin || e?.self_id;
}

function getSenderName(e) {
  return e?.sender?.card || e?.sender?.nickname || String(e?.user_id ?? e?.operator_id ?? 0);
}

function getSenderRole(e) {
  return e?.sender?.role || 'member';
}

function getGroupName(e) {
  return e?.group_name || e?.group?.info?.group_name;
}

function isPluginActiveInLoader() {
  const priority = Array.isArray(PluginsLoader?.priority) ? PluginsLoader.priority : [];
  if (!priority.length) {
    return true;
  }

  return priority.some((item) => item?.name === AI_PLUGIN_NAME);
}

function isAllowedByYunzai(e) {
  if (!PluginsLoader.checkBlack(e)) {
    return false;
  }

  if (!PluginsLoader.checkDisable({ e, name: AI_PLUGIN_NAME })) {
    return false;
  }

  const groupCfg = cfg.getGroup(e.self_id, e.group_id);
  if (groupCfg?.disable?.length && groupCfg.disable.includes(AI_PLUGIN_NAME)) {
    return false;
  }
  return !(groupCfg?.enable?.length && !groupCfg.enable.includes(AI_PLUGIN_NAME));
}

function canHandleAIEvent(e) {
  if (!isPluginActiveInLoader()) {
    logger.info('[crystelf-ai-v2] skip because Yunzai is in stopped state or plugin is unloaded');
    return false;
  }

  if (!isAllowedByYunzai(e)) {
    logger.info(
      `[crystelf-ai-v2] skip because blocked by Yunzai global/group config group=${e.group_id || 'private'} user=${e.user_id || e.operator_id || 0}`
    );
    return false;
  }

  return true;
}

async function getMemberName(bot, groupId, userId) {
  try {
    const result = await bot.sendApi('get_group_member_info', {
      group_id: groupId,
      user_id: userId,
      no_cache: true,
    });
    return result?.data?.card || result?.data?.nickname || String(userId);
  } catch {
    return String(userId);
  }
}

function recordGroupActivity(runtimeState, e) {
  const sessionId = getSessionId(e.group_id);
  const selfId = getBotUin(e);

  runtimeState.groupLastActivityTime.set(sessionId, Date.now());
  runtimeState.groupMessageCount.set(
    sessionId,
    (runtimeState.groupMessageCount.get(sessionId) ?? 0) + 1
  );
  runtimeState.groupMessageCountAfterBot.set(
    sessionId,
    (runtimeState.groupMessageCountAfterBot.get(sessionId) ?? 0) + 1
  );

  let bots = runtimeState.groupBotsMapping.get(sessionId);
  if (!bots) {
    bots = new Set();
    runtimeState.groupBotsMapping.set(sessionId, bots);
  }
  if (selfId) {
    bots.add(Number(selfId));
  }
}

function clearCooldownTimer(sessionId) {
  const timer = runtime.cooldownTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    runtime.cooldownTimers.delete(sessionId);
  }
}

function markBotActivity(runtimeState, sessionId) {
  const now = Date.now();
  runtimeState.groupLastBotMessageTime.set(sessionId, now);
  runtimeState.groupMessageCountAfterBot.set(sessionId, 0);
}

async function detectTrigger(e, config, db) {
  const extracted = await extractContent(e, config, config.nicknames, db);
  const quotedBot = await isQuotingBot(e);

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

  return {
    shouldTrigger: false,
    reason: '',
    extracted,
    quotedBot: null,
  };
}

async function buildTargetMessage(e, config, trigger, db) {
  const quoted = await getQuotedContent(e, db);
  const userName = getSenderName(e);
  let content = trigger.extracted?.text || '';

  if (quoted?.content) {
    content = `${content ? `${content}\n` : ''}[引用消息] ${quoted.senderName}: ${quoted.content}`;
  }
  if (!content && trigger.extracted?.imageUrls?.length > 0) {
    content = '[image]';
  }
  if (!content) {
    content = '你好';
  }

  return {
    userName,
    userId: e.user_id,
    userRole: getSenderRole(e),
    userTitle: e.sender?.title,
    content,
    messageId: e.message_id,
    timestamp: Date.now(),
    imageUrls: trigger.extracted?.imageUrls || [],
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

async function saveBotMessages(runtimeState, sessionId, event, messages, groupInfo) {
  const now = Date.now();
  const botNickname = runtimeState.config.nicknames[0] || '晶灵';
  const botUin = getBotUin(event);
  const groupName = groupInfo?.groupName || getGroupName(event);

  for (const message of messages) {
    runtimeState.db.saveMessage({
      sessionId,
      role: 'assistant',
      content: message,
      userId: botUin,
      userName: botNickname,
      userRole: 'member',
      groupId: event.group_id,
      groupName,
      timestamp: now,
    });
  }

  markBotActivity(runtimeState, sessionId);
}

async function maybeProcessImages(e, runtimeState) {
  if (
    !runtimeState.config.isMultimodal ||
    (runtimeState.config.imageAnalysisBlacklistUsers || []).includes(e.user_id)
  ) {
    return;
  }

  for (const seg of Array.isArray(e.message) ? e.message : []) {
    const imageUrl = seg?.url || seg?.data?.url;
    if (seg?.type === 'image' && imageUrl) {
      processImage(
        runtimeState.ai,
        imageUrl,
        runtimeState.config.multimodalWorkingModel,
        runtimeState.db
      ).catch((error) => {
        logger.warn(`[crystelf-ai-v2] auto image processing failed: ${error.message}`);
      });
    }
  }
}

function collectCooldownMessage(sessionId, e, content, isDirectAt) {
  const messages = runtime.cooldownMessages.get(sessionId) || [];
  messages.push({
    event: e,
    content: content || '[无文本]',
    userName: getSenderName(e),
    userId: e.user_id,
    messageId: e.message_id,
    timestamp: Date.now(),
    isDirectAt,
  });
  runtime.cooldownMessages.set(sessionId, messages);
}

function collectDynamicDelayMessage(sessionId, e, content) {
  let queueData = runtime.dynamicDelayQueues.get(sessionId);
  if (!queueData) {
    queueData = {
      messages: [],
      timer: null,
      delayUntil: 0,
    };
    runtime.dynamicDelayQueues.set(sessionId, queueData);
  }

  queueData.messages.push({
    event: e,
    content: content || '[无文本]',
    userName: getSenderName(e),
    userId: e.user_id,
    messageId: e.message_id,
    timestamp: Date.now(),
  });
}

async function runReplyFlow(event, runtimeState, options) {
  const {
    sessionId,
    targetMessage,
    replyType,
    plannerThoughts,
    reviewMessages,
    history,
    groupInfo,
  } = options;

  runtimeState.sessionManager.getOrCreate(sessionId, 'group', event.group_id);
  const chatHistory =
    history || runtimeState.db.getMessages(sessionId, runtimeState.config.historyCount);
  const botRole = await getBotRole({ bot: event.bot, group_id: event.group_id });
  const resolvedGroupInfo =
    groupInfo ||
    (await getGroupInfoData({
      bot: event.bot,
      group_id: event.group_id,
      group_name: event.group_name,
      group: event.group,
    }));
  const humanizeContexts = await getHumanizeContexts(
    runtimeState,
    sessionId,
    targetMessage,
    chatHistory
  );

  const toolCtx = {
    event,
    sessionId,
    groupId: event.group_id,
    userId: targetMessage.userId || event.user_id || 0,
    config: runtimeState.config,
    db: runtimeState.db,
    ai: runtimeState.ai,
    botRole,
    pendingImageUrls: targetMessage.imageUrls,
  };

  const result = await runChat(
    runtimeState.ai,
    toolCtx,
    chatHistory,
    targetMessage,
    {
      config: runtimeState.config,
      groupName: resolvedGroupInfo.groupName,
      memberCount: resolvedGroupInfo.memberCount,
      botNickname: runtimeState.config.nicknames[0] || '晶灵',
      botQQ: getBotUin(event),
      botRole,
      isGroup: true,
      plannerThoughts,
      replyContext: {
        type: replyType,
      },
      reviewMessages,
      ...humanizeContexts,
    },
    runtimeState.humanize
  );

  if (result.messages.length > 0 || result.emojiPath) {
    logger.info(
      `[crystelf-ai-v2] sending ${result.messages.length} message(s) session=${sessionId} type=${replyType}`
    );
    if (result.messages.length > 0) {
      await sendAIResponse(event, result.messages, runtimeState.humanize.typoGenerator);
      await saveBotMessages(runtimeState, sessionId, event, result.messages, resolvedGroupInfo);
    } else {
      markBotActivity(runtimeState, sessionId);
    }
    if (result.emojiPath) {
      await sendEmoji(event, result.emojiPath, result.emojiQuoteId);
    }
    return { sent: true, result };
  }

  logger.warn(`[crystelf-ai-v2] chat engine returned no messages session=${sessionId}`);
  return { sent: false, result };
}

async function processGroupMessage(e, runtimeState, trigger, reviewPayload) {
  const sessionId = getSessionId(e.group_id);
  const triggerType = reviewPayload ? 'review' : trigger.reason;

  logger.info(
    `[crystelf-ai-v2] process start session=${sessionId} trigger=${triggerType} review=${Boolean(reviewPayload)}`
  );

  if (runtimeState.processing.has(sessionId)) {
    runtimeState.queueManager.enqueue(sessionId, e, triggerType);
    logger.info(`[crystelf-ai-v2] session busy, enqueue trigger session=${sessionId}`);
    return false;
  }

  runtimeState.processing.add(sessionId);
  try {
    const targetMessage =
      reviewPayload || (await buildTargetMessage(e, runtimeState.config, trigger, runtimeState.db));
    const history = runtimeState.db.getMessages(sessionId, runtimeState.config.historyCount);
    const messageContent = trigger.extracted?.originalText || targetMessage.content;
    const shouldRateLimit = !reviewPayload && triggerType !== 'idle' && triggerType !== 'poked';

    let plannerResult = {
      action: 'reply',
      reason: `direct trigger: ${triggerType}`,
      rawResponse: 'bypassed for direct @ trigger',
    };

    if (triggerType !== 'reply' && !reviewPayload) {
      plannerResult = await runtimeState.humanize.actionPlanner.plan(
        sessionId,
        runtimeState.config.nicknames[0] || '晶灵',
        history,
        targetMessage.content,
        {
          isIdleCheck: trigger.reason === 'idle',
          triggerType,
          rawTriggerMessage: trigger.extracted?.originalText || targetMessage.content,
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
        return false;
      }
    } else if (triggerType === 'reply') {
      logger.info(`[crystelf-ai-v2] bypass planner for direct @ trigger session=${sessionId}`);
    }

    if (
      shouldRateLimit &&
      !runtimeState.rateLimiter.canProcess(e.user_id, e.group_id, messageContent)
    ) {
      logger.info(`[crystelf-ai-v2] rate limited session=${sessionId} user=${e.user_id}`);
      return false;
    }

    if (shouldRateLimit) {
      runtimeState.rateLimiter.record(e.user_id, e.group_id, messageContent);
    }

    const response = await runReplyFlow(e, runtimeState, {
      sessionId,
      targetMessage,
      replyType: reviewPayload ? 'review' : triggerType,
      plannerThoughts: plannerResult.reason,
      reviewMessages: reviewPayload?.reviewMessages,
      history,
    });

    if (response.sent) {
      runtimeState.cooldownUntil.set(
        sessionId,
        Date.now() + runtimeState.config.cooldownAfterReplyMs
      );
      startCooldownTimer(sessionId, e.group_id, getBotUin(e));
      runtimeState.sessionManager.touch(sessionId);
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`[crystelf-ai-v2] 处理群消息失败: ${error.message}`);
    return false;
  } finally {
    runtimeState.processing.delete(sessionId);
    await processQueuedMessages(sessionId);
  }
}

async function processReviewMessages(sessionId, groupId, collected, selfId) {
  if (!collected.length || runtime.processing.has(sessionId)) {
    return;
  }

  runtime.processing.add(sessionId);
  try {
    const mergedContents = collected.map((item) => item.content);
    const userNames = collected.map((item) => item.userName);
    const messageIds = collected.map((item) => item.messageId);
    const mergedContent = mergedContents.join('\n---\n');
    const first = collected[0];
    const targetMessage = {
      userName: userNames.join(', '),
      userId: first.userId,
      userRole: getSenderRole(first.event),
      content: mergedContent,
      messageId: first.messageId,
      timestamp: Date.now(),
      imageUrls: [],
    };

    const event = {
      bot: Bot?.[selfId] || first.event?.bot,
      self_id: selfId,
      group_id: groupId,
      user_id: first.userId,
      group_name: getGroupName(first.event),
    };

    const response = await runReplyFlow(event, runtime, {
      sessionId,
      targetMessage,
      replyType: 'review',
      reviewMessages: {
        contents: mergedContents,
        userNames,
        messageIds,
      },
    });

    if (response.sent) {
      runtime.sessionManager.touch(sessionId);
      startCooldownTimer(sessionId, groupId, selfId);
    }
  } catch (error) {
    logger.error(
      `[crystelf-ai-v2] review processing failed session=${sessionId}: ${error.message}`
    );
  } finally {
    runtime.processing.delete(sessionId);
    await processQueuedMessages(sessionId);
  }
}

async function processCooldownWithPlanner(sessionId, groupId, collected, selfId) {
  if (!collected.length || runtime.processing.has(sessionId)) {
    return;
  }

  runtime.processing.add(sessionId);
  try {
    const mergedContent = collected.map((item) => item.content).join('\n');
    const first = collected[0];
    const history = runtime.db.getMessages(sessionId, runtime.config.historyCount);
    const botNickname = runtime.config.nicknames[0] || '晶灵';

    const plannerResult = await runtime.humanize.actionPlanner.plan(
      sessionId,
      botNickname,
      history,
      mergedContent,
      {
        triggerType: 'comment',
        rawTriggerMessage: mergedContent,
      }
    );

    logger.info(
      `[crystelf-ai-v2] cooldown planner session=${sessionId} action=${plannerResult.action} reason=${JSON.stringify(plannerResult.reason || '')}`
    );

    if (plannerResult.action !== 'reply') {
      return;
    }

    const targetMessage = {
      userName: first.userName,
      userId: first.userId,
      userRole: getSenderRole(first.event),
      content: mergedContent,
      messageId: first.messageId,
      timestamp: Date.now(),
      imageUrls: [],
    };

    const event = {
      bot: Bot?.[selfId] || first.event?.bot,
      self_id: selfId,
      group_id: groupId,
      user_id: first.userId,
      group_name: getGroupName(first.event),
    };

    const response = await runReplyFlow(event, runtime, {
      sessionId,
      targetMessage,
      replyType: 'comment',
      plannerThoughts: `After you spoke, the following messages were sent in the group. Use this context to respond naturally.\nPlanned reason: ${plannerResult.reason}`,
      reviewMessages: {
        contents: collected.map((item) => item.content),
        userNames: collected.map((item) => item.userName),
        messageIds: collected.map((item) => item.messageId),
      },
      history,
    });

    if (response.sent) {
      runtime.sessionManager.touch(sessionId);
      startCooldownTimer(sessionId, groupId, selfId);
    }
  } catch (error) {
    logger.error(`[crystelf-ai-v2] cooldown planner failed session=${sessionId}: ${error.message}`);
  } finally {
    runtime.processing.delete(sessionId);
    await processQueuedMessages(sessionId);
  }
}

async function processDynamicDelayQueue(sessionId, groupId, selfId) {
  const queueData = runtime.dynamicDelayQueues.get(sessionId);
  if (!queueData || queueData.messages.length === 0) {
    runtime.dynamicDelayQueues.delete(sessionId);
    return;
  }

  const messages = queueData.messages;
  runtime.dynamicDelayQueues.delete(sessionId);

  if (runtime.processing.has(sessionId)) {
    logger.info(`[crystelf-ai-v2] dynamic delay skipped because session busy session=${sessionId}`);
    return;
  }

  runtime.processing.add(sessionId);
  try {
    const mergedContents = messages.map((item) => item.content);
    const userNames = messages.map((item) => item.userName);
    const messageIds = messages.map((item) => item.messageId);
    const first = messages[0];
    const targetMessage = {
      userName: userNames.join(', '),
      userId: first.userId,
      userRole: getSenderRole(first.event),
      content: mergedContents.join('\n---\n'),
      messageId: first.messageId,
      timestamp: Date.now(),
      imageUrls: [],
    };

    const event = {
      bot: Bot?.[selfId] || first.event?.bot,
      self_id: selfId,
      group_id: groupId,
      user_id: first.userId,
      group_name: getGroupName(first.event),
    };

    logger.info(
      `[crystelf-ai-v2] dynamic delay flush session=${sessionId} count=${messages.length} users=${new Set(messages.map((item) => item.userId)).size}`
    );

    const response = await runReplyFlow(event, runtime, {
      sessionId,
      targetMessage,
      replyType: 'review',
      reviewMessages: {
        contents: mergedContents,
        userNames,
        messageIds,
      },
    });

    if (response.sent) {
      runtime.rateLimiter.clearGroupInteractions(groupId);
      runtime.sessionManager.touch(sessionId);
      startCooldownTimer(sessionId, groupId, selfId);
    }
  } catch (error) {
    logger.error(
      `[crystelf-ai-v2] dynamic delay processing failed session=${sessionId}: ${error.message}`
    );
  } finally {
    runtime.processing.delete(sessionId);
    await processQueuedMessages(sessionId);
  }
}

function startDynamicDelayTimer(sessionId, groupId, delayMs, selfId) {
  let queueData = runtime.dynamicDelayQueues.get(sessionId);
  if (!queueData) {
    queueData = {
      messages: [],
      timer: null,
      delayUntil: Date.now() + delayMs,
    };
    runtime.dynamicDelayQueues.set(sessionId, queueData);
  }

  if (queueData.timer) {
    clearTimeout(queueData.timer);
  }

  queueData.delayUntil = Date.now() + delayMs;
  logger.info(
    `[crystelf-ai-v2] dynamic delay start session=${sessionId} delayMs=${delayMs} interactions=${runtime.rateLimiter.getInteractionCount(groupId)}`
  );

  queueData.timer = setTimeout(() => {
    processDynamicDelayQueue(sessionId, groupId, selfId).catch((error) => {
      logger.error(
        `[crystelf-ai-v2] dynamic delay flush failed session=${sessionId}: ${error.message}`
      );
    });
  }, delayMs);
}

function startCooldownTimer(sessionId, groupId, selfId) {
  clearCooldownTimer(sessionId);

  const cooldownMs = runtime.config.cooldownAfterReplyMs ?? 20_000;
  runtime.cooldownUntil.set(sessionId, Date.now() + cooldownMs);
  runtime.cooldownMessages.set(sessionId, []);

  const timer = setTimeout(() => {
    runtime.cooldownTimers.delete(sessionId);
    const collected = runtime.cooldownMessages.get(sessionId) || [];

    runtime.cooldownMessages.delete(sessionId);
    runtime.cooldownUntil.delete(sessionId);

    if (collected.length === 0) {
      logger.info(`[crystelf-ai-v2] cooldown finished with no messages session=${sessionId}`);
      return;
    }

    const directAtMessages = collected.filter((item) => item.isDirectAt);
    if (directAtMessages.length > 0) {
      processReviewMessages(sessionId, groupId, collected, selfId).catch((error) => {
        logger.error(
          `[crystelf-ai-v2] cooldown review failed session=${sessionId}: ${error.message}`
        );
      });
      return;
    }

    processCooldownWithPlanner(sessionId, groupId, collected, selfId).catch((error) => {
      logger.error(
        `[crystelf-ai-v2] cooldown planner failed session=${sessionId}: ${error.message}`
      );
    });
  }, cooldownMs);

  runtime.cooldownTimers.set(sessionId, timer);
}

async function getQueuedContent(item, runtimeState) {
  if (item.triggerReason === 'poked') {
    const senderId = item.event.user_id || item.event.operator_id;
    const senderName = await getMemberName(item.event.bot, item.event.group_id, senderId);
    return `[${senderName} poked you]`;
  }

  const extracted = await extractContent(
    item.event,
    runtimeState.config,
    runtimeState.config.nicknames,
    runtimeState.db
  );

  return extracted.text || (extracted.imageUrls.length > 0 ? '[image]' : '');
}

async function processQueuedMessages(sessionId) {
  if (runtime.processing.has(sessionId)) {
    return;
  }

  const queue = runtime.queueManager.getQueue(sessionId);
  if (!queue.length) {
    runtime.queueManager.clearActiveTarget(sessionId);
    return;
  }

  runtime.queueManager.clearQueue(sessionId);
  runtime.processing.add(sessionId);

  try {
    logger.info(`[crystelf-ai-v2] queue flush session=${sessionId} count=${queue.length}`);
    const queuedContents = [];
    for (const item of queue) {
      const content = await getQueuedContent(item, runtime);
      if (content) {
        queuedContents.push({ item, content });
      }
    }

    if (!queuedContents.length) {
      return;
    }

    const first = queuedContents[0].item.event;
    const groupId = first.group_id;
    const selfId = getBotUin(first);
    const targetMessage = {
      userName: getSenderName(first),
      userId: first.user_id || first.operator_id || 0,
      userRole: getSenderRole(first),
      content: queuedContents.map((item) => item.content).join('\n'),
      messageId: first.message_id,
      timestamp: Date.now(),
      imageUrls: [],
    };

    const event = {
      bot: Bot?.[selfId] || first.bot,
      self_id: selfId,
      group_id: groupId,
      user_id: targetMessage.userId,
      group_name: getGroupName(first),
    };

    const replyType = queuedContents.every((entry) => entry.item.triggerReason === 'poked')
      ? 'poked'
      : 'comment';

    const response = await runReplyFlow(event, runtime, {
      sessionId,
      targetMessage,
      replyType,
    });

    if (response.sent) {
      runtime.sessionManager.touch(sessionId);
      startCooldownTimer(sessionId, groupId, selfId);
    }
  } catch (error) {
    logger.error(`[crystelf-ai-v2] queue processing failed session=${sessionId}: ${error.message}`);
  } finally {
    runtime.processing.delete(sessionId);
    runtime.queueManager.clearActiveTarget(sessionId);
  }
}

async function onGroupMessage(e) {
  const runtimeState = await ensureRuntime();
  const appConfig = ConfigControl.get('config') || {};
  if (!appConfig.ai) {
    return;
  }
  if (!canHandleAIEvent(e)) {
    return;
  }
  if (e.user_id === getBotUin(e)) {
    return;
  }
  if (!e.group_id) {
    return;
  }
  if (!isGroupAllowed(e.group_id, runtimeState.config)) {
    return;
  }
  if (!runtimeState.config.apiKey) {
    return;
  }

  const sessionId = getSessionId(e.group_id);
  recordGroupActivity(runtimeState, e);

  const trigger = await detectTrigger(e, runtimeState.config, runtimeState.db);
  const storedText = await buildTargetMessage(
    e,
    runtimeState.config,
    {
      extracted: trigger.extracted,
      reason: trigger.reason || 'observe',
    },
    runtimeState.db
  )
    .then((item) => item.content)
    .catch(() => trigger.extracted?.text || '');

  saveIncomingMessage(e, sessionId, storedText, runtimeState);
  await maybeProcessImages(e, runtimeState);

  runtimeState.humanize.topicTracker.onMessage(sessionId).catch(() => null);
  runtimeState.humanize.expressionLearner
    .onMessage(sessionId, buildStoredMessageFromEvent(e, sessionId, storedText))
    .catch(() => null);

  if (detectResetCommand(e)) {
    logger.info(
      `[crystelf-ai-v2] skip normal flow because reset command matched session=${sessionId}`
    );
    return;
  }

  const cooldownUntil = runtimeState.cooldownUntil.get(sessionId) ?? 0;
  if (Date.now() < cooldownUntil) {
    collectCooldownMessage(sessionId, e, storedText, Boolean(trigger.extracted?.isDirectAt));
    return;
  }

  const delayQueue = runtimeState.dynamicDelayQueues.get(sessionId);
  if (delayQueue && Date.now() < delayQueue.delayUntil) {
    if (trigger.reason === 'reply') {
      runtimeState.rateLimiter.recordInteraction(e.group_id, e.user_id);
      collectDynamicDelayMessage(
        sessionId,
        e,
        storedText || trigger.extracted?.originalText || trigger.extracted?.text
      );
      logger.info(`[crystelf-ai-v2] dynamic delay collected direct @ session=${sessionId}`);
    }
    return;
  }

  if (!trigger.shouldTrigger) {
    return;
  }

  if (runtimeState.processing.has(sessionId)) {
    runtimeState.queueManager.enqueue(sessionId, e, trigger.reason);
    logger.info(`[crystelf-ai-v2] session busy, trigger queued session=${sessionId}`);
    return;
  }

  if (trigger.reason === 'reply' && runtimeState.config.dynamicDelay?.enabled) {
    if (
      !runtimeState.rateLimiter.canProcess(
        e.user_id,
        e.group_id,
        trigger.extracted?.originalText || storedText || trigger.extracted?.text || ''
      )
    ) {
      logger.info(`[crystelf-ai-v2] rate limited direct @ session=${sessionId} user=${e.user_id}`);
      return;
    }

    runtimeState.rateLimiter.recordInteraction(e.group_id, e.user_id);
    const delayInfo = runtimeState.rateLimiter.getDelayInfo(e.group_id);
    if (delayInfo.shouldDelay) {
      const content =
        trigger.extracted?.originalText || storedText || trigger.extracted?.text || '[无文本]';
      runtimeState.rateLimiter.record(e.user_id, e.group_id, content);
      collectDynamicDelayMessage(sessionId, e, content);
      startDynamicDelayTimer(sessionId, e.group_id, delayInfo.delayMs, getBotUin(e));
      return;
    }
  }

  await processGroupMessage(e, runtimeState, trigger);
}

async function onGroupPoke(e) {
  const runtimeState = await ensureRuntime();
  const appConfig = ConfigControl.get('config') || {};
  if (!appConfig.ai) {
    return;
  }
  if (!canHandleAIEvent(e)) {
    return;
  }

  const selfId = Number(getBotUin(e));
  if (!e.group_id || !selfId || Number(e.target_id) !== selfId) {
    return;
  }
  if (!runtimeState.config.apiKey || !isGroupAllowed(e.group_id, runtimeState.config)) {
    return;
  }

  const lastPoke = runtimeState.pokeCooldowns.get(e.group_id) ?? 0;
  if (Date.now() - lastPoke < POKE_COOLDOWN_MS) {
    return;
  }
  runtimeState.pokeCooldowns.set(e.group_id, Date.now());

  const sessionId = getSessionId(e.group_id);
  if (runtimeState.processing.has(sessionId)) {
    runtimeState.queueManager.enqueue(sessionId, e, 'poked');
    logger.info(`[crystelf-ai-v2] poke queued session=${sessionId}`);
    return;
  }

  runtimeState.processing.add(sessionId);
  try {
    runtimeState.sessionManager.getOrCreate(sessionId, 'group', e.group_id);
    const senderId = e.user_id || e.operator_id;
    const senderName = await getMemberName(e.bot, e.group_id, senderId);
    const targetMessage = {
      userName: senderName,
      userId: senderId,
      userRole: 'member',
      content: `[${senderName} poked you]`,
      messageId: 0,
      timestamp: Date.now(),
      imageUrls: [],
    };

    const response = await runReplyFlow(e, runtimeState, {
      sessionId,
      targetMessage,
      replyType: 'poked',
    });

    if (response.sent) {
      runtimeState.sessionManager.touch(sessionId);
    }
  } catch (error) {
    logger.error(`[crystelf-ai-v2] poke processing failed session=${sessionId}: ${error.message}`);
  } finally {
    runtimeState.processing.delete(sessionId);
    await processQueuedMessages(sessionId);
  }
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
    const sessionId = getSessionId(e.group_id);
    runtimeState.sessionManager.getOrCreate(sessionId, 'group', e.group_id);
    runtimeState.db.deleteSessionMessages(sessionId);
    runtimeState.db.deleteBotMessages(sessionId);
    runtimeState.cooldownUntil.delete(sessionId);
    runtimeState.cooldownMessages.delete(sessionId);
    clearCooldownTimer(sessionId);
    return e.reply('当前群会话已重置，聊天上下文清空了。', true);
  }
}

Bot.on('message.group', async (e) => {
  await onGroupMessage(e);
});

Bot.on('notice.group.poke', async (e) => {
  await onGroupPoke(e);
});
