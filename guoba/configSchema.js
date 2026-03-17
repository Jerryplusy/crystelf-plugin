import fs from 'fs';
import path from 'path';

const SUPPORTED_EMOTION_OPTIONS = [
  'happy',
  'sad',
  'angry',
  'surprised',
  'confused',
  'excited',
  'tired',
  'shy',
  'proud',
  'default',
  'funny',
  'cute',
  'love',
  'neutral',
].map((value) => ({ label: value, value }));

function normalizeNumber(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

function dedupeByValue(options = []) {
  const map = new Map();
  for (const item of options) {
    if (!item || item.value === undefined || item.value === null) continue;
    const key = String(item.value);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function getBotInstances() {
  const botRoot = globalThis.Bot;
  const uins = Array.isArray(botRoot?.uin) ? botRoot.uin : [];
  return uins
    .map((uin) => ({ uin, bot: botRoot?.[uin] }))
    .filter((item) => item.bot);
}

function getGroupOptions() {
  const options = [];
  for (const { bot } of getBotInstances()) {
    const groupMap = bot?.gl;
    if (!groupMap || typeof groupMap.values !== 'function') continue;
    for (const group of groupMap.values()) {
      const id = normalizeNumber(group?.group_id);
      if (!id) continue;
      const name = String(group?.group_name || group?.name || '').trim();
      options.push({
        label: name ? `${name}(${id})` : String(id),
        value: id,
      });
    }
  }
  return dedupeByValue(options);
}

function getFriendOptions() {
  const options = [];
  for (const { bot } of getBotInstances()) {
    const friendMap = bot?.fl;
    if (!friendMap || typeof friendMap.values !== 'function') continue;
    for (const friend of friendMap.values()) {
      const id = normalizeNumber(friend?.user_id);
      if (!id) continue;
      const nickname = String(friend?.nickname || friend?.remark || '').trim();
      options.push({
        label: nickname ? `${nickname}(${id})` : String(id),
        value: id,
      });
    }
  }
  return dedupeByValue(options);
}

function getMemeCharacterOptions() {
  const memeBaseDir = path.join(process.cwd(), 'data', 'chat', 'meme');
  if (!fs.existsSync(memeBaseDir)) return [];
  try {
    return fs
      .readdirSync(memeBaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ label: entry.name, value: entry.name }));
  } catch (error) {
    globalThis.logger?.warn?.(`[crystelf-plugin] 读取表情角色目录失败: ${error.message}`);
    return [];
  }
}

const BOT_ID_OPTIONS = Array.isArray(globalThis.Bot?.uin)
  ? globalThis.Bot.uin.map((item) => {
      const value = Number(item) || String(item);
      return { label: String(item), value };
    })
  : [];

const GROUP_OPTIONS = getGroupOptions();
const FRIEND_OPTIONS = getFriendOptions();
const MEME_CHARACTER_OPTIONS = getMemeCharacterOptions();

function createTagsSelectProps(placeholder, extra = {}) {
  return {
    mode: 'tags',
    placeholder: placeholder || '请输入',
    ...extra,
  };
}

function createMultiSelectWithOptions(placeholder, options = [], extra = {}) {
  return {
    mode: 'multiple',
    options,
    placeholder: placeholder || '请选择',
    ...extra,
  };
}

const guobaSchema = [
  // config.json - 主配置
  {
    label: '主配置',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: 'config.debug',
    label: '调试模式',
    component: 'Switch',
    bottomHelpMessage: '是否启用调试模式',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.core',
    label: '晶灵核心',
    component: 'Switch',
    bottomHelpMessage: '是否启用晶灵核心相关功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.maxFeed',
    label: '最长订阅',
    component: 'InputNumber',
    bottomHelpMessage: '最长订阅数量',
    componentProps: {
      min: 1,
      max: 50,
      step: 1,
      placeholder: '请输入最长订阅数量',
    },
  },
  {
    field: 'config.autoUpdate',
    label: '自动更新',
    component: 'Switch',
    bottomHelpMessage: '是否自动更新插件',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.poke',
    label: '戳一戳功能',
    component: 'Switch',
    bottomHelpMessage: '是否启用戳一戳功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.60s',
    label: '60s新闻',
    component: 'Switch',
    bottomHelpMessage: '是否启用60s新闻功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.zwa',
    label: '早晚安',
    component: 'Switch',
    bottomHelpMessage: '是否启用早晚安功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.rss',
    label: 'RSS订阅',
    component: 'Switch',
    bottomHelpMessage: '是否启用RSS订阅功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.help',
    label: '帮助功能',
    component: 'Switch',
    bottomHelpMessage: '是否启用帮助功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.welcome',
    label: '入群欢迎功能',
    component: 'Switch',
    bottomHelpMessage: '是否启用欢迎功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.faceReply',
    label: '表情回复（贴表情）',
    component: 'Switch',
    bottomHelpMessage: '是否启用表情回复功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.ai',
    label: '晶灵智能',
    component: 'Switch',
    bottomHelpMessage: '是否启用AI功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.music',
    label: '点歌',
    component: 'Switch',
    bottomHelpMessage: '是否启用点歌功能',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'config.auth',
    label: '入群验证功能',
    component: 'Switch',
    bottomHelpMessage: '是否启用入群验证',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },

  // coreConfig.json - 核心配置
  {
    label: '晶灵核心配置',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: 'coreConfig.coreUrl',
    label: '核心API地址',
    component: 'Input',
    bottomHelpMessage: '晶灵核心API地址',
    componentProps: {
      placeholder: '请输入核心API地址',
    },
  },
  {
    field: 'coreConfig.token',
    label: '核心Token',
    component: 'InputPassword',
    required: false,
    bottomHelpMessage: '晶灵核心可选访问Token',
    componentProps: {
      placeholder: '请输入核心Token',
    },
  },

  // auth.json - 认证配置
  {
    label: '入群验证',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: 'auth.url',
    label: '手性碳验证API地址',
    component: 'Input',
    bottomHelpMessage: '验证基础api，有需求可自建',
    componentProps: {
      placeholder: '请输入验证API地址',
    },
  },
  {
    field: 'auth.default.enable',
    label: '全局启用验证',
    component: 'Switch',
    bottomHelpMessage: '是否在全部群聊启用验证',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'auth.default.carbon.enable',
    label: '手性碳验证',
    component: 'Switch',
    bottomHelpMessage: '是否默认启用手性碳验证,关闭则为数字验证',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'auth.default.carbon.hint',
    label: '手性碳验证提示',
    component: 'Switch',
    bottomHelpMessage: '是否显示手性碳验证提示(使用星号标注手性碳位置)',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'auth.default.carbon.hard-mode',
    label: '手性碳验证困难模式',
    component: 'Switch',
    bottomHelpMessage: '是否启用手性碳验证困难模式(困难模式下需要找出全部手性碳)',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'auth.default.timeout',
    label: '验证超时时间',
    component: 'InputNumber',
    bottomHelpMessage: '验证超时时间(秒)',
    componentProps: {
      min: 30,
      max: 600,
      step: 10,
      placeholder: '请输入验证超时时间(秒)',
    },
  },
  {
    field: 'auth.default.recall',
    label: '撤回未认证消息',
    component: 'Switch',
    bottomHelpMessage: '是否撤回验证通过前用户发送的消息',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'auth.default.frequency',
    label: '最大验证次数',
    component: 'InputNumber',
    bottomHelpMessage: '验证的最大次数，超过视为失败',
    componentProps: {
      min: 1,
      max: 24,
      step: 1,
      placeholder: '请输入最大验证次数',
    },
  },

  // ai.json - AI配置
  {
    label: '晶灵智能',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: 'ai.apiUrl',
    label: 'API地址',
    component: 'Input',
    bottomHelpMessage: 'OpenAI 兼容接口地址',
    required: true,
    componentProps: {
      placeholder: '请输入 API 地址，如 https://api.openai.com/v1',
    },
  },
  {
    field: 'ai.apiKey',
    label: 'API密钥',
    component: 'InputPassword',
    bottomHelpMessage: '请求模型接口使用的密钥',
    componentProps: {
      placeholder: '请输入 API 密钥',
    },
  },
  {
    field: 'ai.model',
    label: '主对话模型',
    component: 'Input',
    bottomHelpMessage: '主回复使用的模型名称',
    required: true,
    componentProps: {
      placeholder: '请输入模型名称',
    },
  },
  {
    field: 'ai.workingModel',
    label: '工作模型',
    component: 'Input',
    bottomHelpMessage: '用于 planner、记忆、话题、表达学习，以及表情包 AI 二次筛选',
    componentProps: {
      placeholder: '请输入工作模型名称',
    },
  },
  {
    field: 'ai.multimodalWorkingModel',
    label: '多模态模型',
    component: 'Input',
    bottomHelpMessage: '用于图片分析、表情包入库和看图描述',
    componentProps: {
      placeholder: '请输入多模态模型名称',
    },
  },
  {
    field: 'ai.isMultimodal',
    label: '启用多模态',
    component: 'Switch',
    bottomHelpMessage: '开启后允许自动分析群聊图片，并在对话中看图',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.autoImageAnalysis',
    label: '自动看图',
    component: 'Switch',
    bottomHelpMessage: '自动分析群内图片并入库，开启多模态后生效',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.nicknames',
    label: '额外昵称',
    component: 'Select',
    bottomHelpMessage: '会与 profile.nickName 合并，作为昵称触发词',
    componentProps: createTagsSelectProps('请输入昵称'),
  },
  {
    field: 'ai.persona',
    label: '晶灵人设',
    component: 'Input',
    bottomHelpMessage: 'AI 的核心人设提示词，支持直接粘贴长文本',
    componentProps: {
      type: 'textarea',
      rows: 5,
      placeholder: '请输入人设描述',
    },
  },
  {
    field: 'ai.temperature',
    label: '主温度',
    component: 'InputNumber',
    bottomHelpMessage: '主对话温度，越高越发散',
    componentProps: {
      min: 0,
      max: 2,
      step: 0.1,
      precision: 1,
      placeholder: '请输入温度值',
    },
  },
  {
    field: 'ai.historyCount',
    label: '历史条数',
    component: 'InputNumber',
    bottomHelpMessage: '每次注入提示词的历史消息条数',
    componentProps: {
      min: 10,
      max: 300,
      step: 10,
      placeholder: '请输入历史条数',
    },
  },
  {
    field: 'ai.maxIterations',
    label: '最大迭代',
    component: 'InputNumber',
    bottomHelpMessage: '工具调用最大轮次，-1 表示不限制',
    componentProps: {
      min: -1,
      max: 20,
      step: 1,
      placeholder: '请输入最大迭代次数',
    },
  },
  {
    field: 'ai.maxSessions',
    label: '会话缓存',
    component: 'InputNumber',
    bottomHelpMessage: '会话缓存上限',
    componentProps: {
      min: 1,
      max: 500,
      step: 1,
      placeholder: '请输入最大会话数',
    },
  },
  {
    field: 'ai.enableGroupAdmin',
    label: '群管理工具',
    component: 'Switch',
    bottomHelpMessage: '是否允许 AI 调用禁言/踢人等群管理工具',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.cooldownAfterReplyMs',
    label: '回复冷却',
    component: 'InputNumber',
    bottomHelpMessage: '回复后进入冷却期，期间的新消息会被收集并合并处理',
    componentProps: {
      min: 0,
      max: 300000,
      step: 1000,
      placeholder: '请输入冷却毫秒数',
    },
  },
  {
    field: 'ai.blacklistGroups',
    label: '黑名单群',
    component: 'Select',
    bottomHelpMessage: '这些群不会触发 AI；仍会同时受到 Yunzai 全局黑白名单影响',
    componentProps: createMultiSelectWithOptions('请选择黑名单群', GROUP_OPTIONS),
  },
  {
    field: 'ai.whitelistGroups',
    label: '白名单群',
    component: 'Select',
    bottomHelpMessage: '非空时仅这些群会触发 AI；仍会同时受到 Yunzai 全局黑白名单影响',
    componentProps: createMultiSelectWithOptions('请选择白名单群', GROUP_OPTIONS),
  },
  {
    field: 'ai.imageAnalysisBlacklistUsers',
    label: '看图黑名单',
    component: 'Select',
    bottomHelpMessage: '这些 QQ 的消息不会触发自动看图入库和图片分析',
    componentProps: createMultiSelectWithOptions('请选择QQ号', FRIEND_OPTIONS),
  },
  {
    label: '动态延迟',
    component: 'SOFT_GROUP_BEGIN'
  },
  {
    field: 'ai.dynamicDelay.enabled',
    label: '启用动态延迟',
    component: 'Switch',
    bottomHelpMessage: '开启后，直接 @Bot 时会根据近期参与互动的人数延迟并合并回复',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.dynamicDelay.interactionWindowMs',
    label: '互动窗口',
    component: 'InputNumber',
    bottomHelpMessage: '统计多少时间内有多少不同用户参与了 @Bot 互动（毫秒）',
    componentProps: {
      min: 1000,
      max: 3600000,
      step: 1000,
      placeholder: '请输入窗口时长',
    },
  },
  {
    field: 'ai.dynamicDelay.baseDelayMs',
    label: '基础延迟',
    component: 'InputNumber',
    bottomHelpMessage: '每多一个活跃互动用户，额外增加的延迟时长（毫秒）',
    componentProps: {
      min: 0,
      max: 600000,
      step: 1000,
      placeholder: '请输入基础延迟',
    },
  },
  {
    field: 'ai.dynamicDelay.maxDelayMs',
    label: '最大延迟',
    component: 'InputNumber',
    bottomHelpMessage: '动态延迟上限（毫秒）',
    componentProps: {
      min: 0,
      max: 3600000,
      step: 1000,
      placeholder: '请输入最大延迟',
    },
  },
  {
    label: '人格与风格',
    component: 'SOFT_GROUP_BEGIN'
  },
  {
    field: 'ai.personality.states',
    label: '人格状态',
    component: 'Select',
    bottomHelpMessage: '可随机切换的人格状态文案',
    componentProps: createTagsSelectProps('请输入人格状态'),
  },
  {
    field: 'ai.personality.stateProbability',
    label: '人格概率',
    component: 'InputNumber',
    bottomHelpMessage: '每次生成提示词时，随机切换人格状态的概率',
    componentProps: {
      min: 0,
      max: 1,
      step: 0.01,
      precision: 2,
      placeholder: '请输入概率',
    },
  },
  {
    field: 'ai.replyStyle.baseStyle',
    label: '基础风格',
    component: 'Input',
    bottomHelpMessage: '默认回复风格，支持直接粘贴长文本',
    componentProps: {
      type: 'textarea',
      rows: 4,
      placeholder: '请输入基础风格',
    },
  },
  {
    field: 'ai.replyStyle.multipleStyles',
    label: '附加风格',
    component: 'Select',
    bottomHelpMessage: '可随机注入的一组附加风格',
    componentProps: createTagsSelectProps('请输入附加风格'),
  },
  {
    field: 'ai.replyStyle.multipleProbability',
    label: '附加概率',
    component: 'InputNumber',
    bottomHelpMessage: '每次生成提示词时，随机附加一种风格的概率',
    componentProps: {
      min: 0,
      max: 1,
      step: 0.01,
      precision: 2,
      placeholder: '请输入概率',
    },
  },
  {
    label: '记忆 / 话题 / Planner',
    component: 'SOFT_GROUP_BEGIN'
  },
  {
    field: 'ai.memory.enabled',
    label: '启用记忆',
    component: 'Switch',
    bottomHelpMessage: '是否启用记忆检索',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.memory.maxIterations',
    label: '记忆轮次',
    component: 'InputNumber',
    bottomHelpMessage: '记忆检索最大轮次',
    componentProps: {
      min: 1,
      max: 10,
      step: 1,
      placeholder: '请输入最大轮次',
    },
  },
  {
    field: 'ai.memory.timeoutMs',
    label: '记忆超时',
    component: 'InputNumber',
    bottomHelpMessage: '记忆检索超时（毫秒）',
    componentProps: {
      min: 1000,
      max: 120000,
      step: 1000,
      placeholder: '请输入超时毫秒数',
    },
  },
  {
    field: 'ai.topic.enabled',
    label: '启用话题',
    component: 'Switch',
    bottomHelpMessage: '是否启用话题追踪',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.topic.messageThreshold',
    label: '话题阈值',
    component: 'InputNumber',
    bottomHelpMessage: '累计多少条消息后触发一次话题分析',
    componentProps: {
      min: 5,
      max: 200,
      step: 1,
      placeholder: '请输入阈值',
    },
  },
  {
    field: 'ai.topic.timeThresholdMs',
    label: '话题间隔',
    component: 'InputNumber',
    bottomHelpMessage: '重新分析话题的时间间隔（毫秒）',
    componentProps: {
      min: 60000,
      max: 86400000,
      step: 60000,
      placeholder: '请输入时间间隔',
    },
  },
  {
    field: 'ai.topic.maxTopicsPerSession',
    label: '最大话题数',
    component: 'InputNumber',
    bottomHelpMessage: '提示词中注入的话题数量上限',
    componentProps: {
      min: 1,
      max: 100,
      step: 1,
      placeholder: '请输入最大话题数',
    },
  },
  {
    field: 'ai.planner.enabled',
    label: '启用Planner',
    component: 'Switch',
    bottomHelpMessage: '是否启用回复动作规划器',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.planner.idleThresholdMs',
    label: '空闲阈值',
    component: 'InputNumber',
    bottomHelpMessage: '距离最后一次群内发言超过多久后，才会进入空闲插话候选（毫秒）',
    componentProps: {
      min: 60000,
      max: 86400000,
      step: 60000,
      placeholder: '请输入空闲阈值',
    },
  },
  {
    field: 'ai.planner.idleMessageCount',
    label: '空闲消息数',
    component: 'InputNumber',
    bottomHelpMessage: '自上次 Bot 发言后，至少累计多少条消息才允许空闲插话',
    componentProps: {
      min: 1,
      max: 1000,
      step: 1,
      placeholder: '请输入消息数',
    },
  },
  {
    field: 'ai.planner.idleCheckBotIds',
    label: '空闲Bot列表',
    component: 'Select',
    bottomHelpMessage: '限制哪些 Bot 参与空闲插话；留空表示当前群中所有在线 Bot 都可参与',
    componentProps: createMultiSelectWithOptions('请选择 Bot', BOT_ID_OPTIONS),
  },
  {
    label: '错别字 / 表情包 / 表达学习',
    component: 'SOFT_GROUP_BEGIN'
  },
  {
    field: 'ai.typo.enabled',
    label: '启用错别字',
    component: 'Switch',
    bottomHelpMessage: '模拟轻微的真人打字错误',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.typo.errorRate',
    label: '单字错误率',
    component: 'InputNumber',
    bottomHelpMessage: '单字替换概率',
    componentProps: {
      min: 0,
      max: 1,
      step: 0.01,
      precision: 2,
      placeholder: '请输入概率',
    },
  },
  {
    field: 'ai.typo.wordReplaceRate',
    label: '整词错误率',
    component: 'InputNumber',
    bottomHelpMessage: '整词替换概率',
    componentProps: {
      min: 0,
      max: 1,
      step: 0.01,
      precision: 2,
      placeholder: '请输入概率',
    },
  },
  {
    field: 'ai.emoji.enabled',
    label: '启用表情包',
    component: 'Switch',
    bottomHelpMessage: '允许 AI 用 [meme:emotion] 发送本地表情包',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.emoji.replyProbability',
    label: '表情概率',
    component: 'InputNumber',
    bottomHelpMessage: '每次构建提示词时，有多大概率告诉 AI 可以发一张表情包',
    componentProps: {
      min: 0,
      max: 1,
      step: 0.01,
      precision: 2,
      placeholder: '请输入概率',
    },
  },
  {
    field: 'ai.emoji.characters',
    label: '表情角色',
    component: 'Select',
    bottomHelpMessage: '限制可用的表情角色目录；留空则自动扫描 data/chat/meme',
    componentProps: createTagsSelectProps('请选择或输入角色名', { options: MEME_CHARACTER_OPTIONS }),
  },
  {
    field: 'ai.emoji.availableEmotions',
    label: '可用情绪',
    component: 'Select',
    bottomHelpMessage: '限制 AI 允许使用的表情情绪；留空则按目录自动判断',
    componentProps: createMultiSelectWithOptions('请选择可用情绪', SUPPORTED_EMOTION_OPTIONS),
  },
  {
    field: 'ai.emoji.useAISelection',
    label: 'AI筛图',
    component: 'Switch',
    bottomHelpMessage: '开启后会让工作模型在候选表情包中二次挑选，关闭则随机选择',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.expression.enabled',
    label: '启用表达学习',
    component: 'Switch',
    bottomHelpMessage: '是否学习群成员表达习惯',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.expression.maxExpressions',
    label: '最大表达数',
    component: 'InputNumber',
    bottomHelpMessage: '每个会话最多保存多少条表达习惯',
    componentProps: {
      min: 1,
      max: 500,
      step: 1,
      placeholder: '请输入最大表达数',
    },
  },
  {
    field: 'ai.expression.sampleSize',
    label: '注入表达数',
    component: 'InputNumber',
    bottomHelpMessage: '每次提示词注入多少条表达习惯',
    componentProps: {
      min: 1,
      max: 50,
      step: 1,
      placeholder: '请输入注入条数',
    },
  },
  // 60s.json - 60s新闻配置
  {
    label: '60s新闻',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: '60s.url',
    label: '60s新闻API',
    component: 'Input',
    bottomHelpMessage: '60s新闻的API地址',
    required: true,
    componentProps: {
      placeholder: '请输入60s新闻API地址',
    },
  },

  // music.json - 音乐配置
  {
    label: '点歌配置',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: 'music.url',
    label: '音乐API地址',
    component: 'Input',
    bottomHelpMessage: '音乐API地址',
    required: true,
    componentProps: {
      placeholder: '请输入音乐API地址',
    },
  },
  {
    field: 'music.username',
    label: '音乐API用户名',
    component: 'Input',
    bottomHelpMessage: '音乐API用户名',
    componentProps: {
      placeholder: '请输入音乐API用户名',
    },
  },
  {
    field: 'music.password',
    label: '音乐API密码',
    component: 'InputPassword',
    bottomHelpMessage: '音乐API密码',
    componentProps: {
      placeholder: '请输入音乐API密码',
    },
  },

  // poke.json - 戳一戳配置
  {
    label: '戳一戳',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: 'poke.replyPoke',
    label: '戳一戳回戳概率',
    component: 'InputNumber',
    bottomHelpMessage: '戳一戳回戳概率',
    componentProps: {
      min: 0,
      max: 1,
      step: 0.1,
      placeholder: '请输入回戳概率',
    },
  },

  // profile.json - 用户资料配置
  {
    label: '机器人资料',
    component: 'SOFT_GROUP_BEGIN',
  },
  {
    field: 'profile.nickName',
    label: '机器人昵称',
    component: 'Input',
    bottomHelpMessage: '机器人的昵称',
    componentProps: {
      placeholder: '请输入机器人昵称',
    },
  },
];

export default guobaSchema;
