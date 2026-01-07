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
    field: 'ai.mode',
    label: '对话模式',
    component: 'Select',
    bottomHelpMessage: '推荐使用混合模式，如果你不喜欢词库或不想消耗token可以修改',
    componentProps: {
      options: [
        { label: '混合模式', value: 'mix' },
        { label: 'AI模式', value: 'ai' },
        { label: '词库模式', value: 'keyword' },
      ],
      placeholder: '请选择对话模式',
    },
  },
  {
    field: 'ai.baseApi',
    label: 'API基础地址',
    component: 'Input',
    bottomHelpMessage: '请求基础api地址(仅支持openai),其余可自行部署newapi代理',
    required: true,
    componentProps: {
      placeholder: '请输入API基础地址，如: https://api.siliconflow.cn/v1',
    },
  },
  {
    field: 'ai.apiKey',
    label: 'API密钥',
    component: 'InputPassword',
    bottomHelpMessage: '用于请求API的密钥',
    required: true,
    componentProps: {
      placeholder: '请输入API密钥',
    },
  },
  {
    field: 'ai.modelType',
    label: '文本模型',
    component: 'Input',
    bottomHelpMessage: '用于文本生成的模型名称',
    required: true,
    componentProps: {
      placeholder: '请输入模型名称，如: deepseek-ai/DeepSeek-V3.2-Exp',
    },
  },
  {
    field: 'ai.temperature',
    label: '聊天温度',
    component: 'InputNumber',
    bottomHelpMessage: '温度越高聊天的发散性越高，可选0-2.0',
    componentProps: {
      min: 0,
      max: 2,
      step: 0.1,
      precision: 1,
      placeholder: '请输入温度值，如: 1.2',
    },
  },
  {
    field: 'ai.concurrency',
    label: '最大并发数',
    component: 'InputNumber',
    bottomHelpMessage: '最大同时聊天群数，一个群最多一个人聊天',
    componentProps: {
      min: 1,
      max: 10,
      step: 1,
      placeholder: '请输入最大并发数',
    },
  },
  {
    field: 'ai.maxMix',
    label: '混合模式阈值',
    component: 'InputNumber',
    bottomHelpMessage: '混合模式下，如果用户消息长度大于这个值，那么使用ai回复',
    componentProps: {
      min: 1,
      step: 1,
      placeholder: '请输入消息长度阈值',
    },
  },
  {
    field: 'ai.timeout',
    label: '记忆超时时间',
    component: 'InputNumber',
    bottomHelpMessage: '记忆默认超时时间(天)',
    componentProps: {
      min: 1,
      max: 365,
      step: 1,
      placeholder: '请输入超时天数',
    },
  },
  {
    field: 'ai.maxSessions',
    label: '最大会话数',
    component: 'InputNumber',
    bottomHelpMessage: '最大同时存在的活跃群聊数量',
    componentProps: {
      min: 1,
      max: 50,
      step: 1,
      placeholder: '请输入最大会话数',
    },
  },
  {
    field: 'ai.chatHistory',
    label: '聊天历史长度',
    component: 'InputNumber',
    bottomHelpMessage: '聊天上下文最大长度',
    componentProps: {
      min: 1,
      max: 50,
      step: 1,
      placeholder: '请输入聊天历史长度',
    },
  },
  {
    field: 'ai.maxMessageLength',
    label: '最大消息长度',
    component: 'InputNumber',
    bottomHelpMessage: '处理群消息的最大长度',
    componentProps: {
      min: 50,
      max: 100,
      step: 10,
      placeholder: '请输入最大消息长度',
    },
  },
  {
    field: 'ai.getChatHistoryLength',
    label: '获取上下文长度',
    component: 'InputNumber',
    bottomHelpMessage: '获取到的聊天上下文长度',
    componentProps: {
      min: 1,
      max: 100,
      step: 1,
      placeholder: '请输入获取上下文长度',
    },
  },
  {
    field: 'ai.keywordCache',
    label: '词库缓存',
    component: 'Switch',
    bottomHelpMessage: '是否缓存词库到本地',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.botPersona',
    label: '机器人人设',
    component: 'InputTextArea',
    bottomHelpMessage: '机器人的性格和行为描述',
    componentProps: {
      rows: 4,
      placeholder: '请输入机器人人设描述',
    },
  },
  {
    field: 'ai.character',
    label: '表情包角色',
    component: 'Select',
    bottomHelpMessage: '回复表情包时的角色(能力有限,目前仅支持一种角色)',
    componentProps: {
      options: [{ label: '真寻', value: 'zhenxun' }],
      placeholder: '请选择表情包角色',
    },
  },
  {
    field: 'ai.multimodalEnabled',
    label: '多模态模式',
    component: 'Switch',
    bottomHelpMessage: '启用后将使用多模态模型',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.smartMultimodal',
    label: '智能多模态',
    component: 'Switch',
    bottomHelpMessage: '开启时只有有图片才用多模态模型，其他情况使用默认模型',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.multimodalModel',
    label: '多模态模型',
    component: 'Input',
    bottomHelpMessage: '用于多模态处理的模型名称',
    required: true,
    componentProps: {
      placeholder: '请输入多模态模型名称，例如Qwen/Qwen2.5-VL-72B-Instruct',
    },
  },
  {
    field: 'ai.imageConfig.enabled',
    label: '图像生成功能',
    component: 'Switch',
    bottomHelpMessage: '是否允许ai生成图像',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.imageConfig.imageMode',
    label: '图像生成模式',
    component: 'Select',
    bottomHelpMessage:
      'openai使用/v1/images/generations接口(如Qwen-Image), chat使用对话式生图模型(如gemini-3-pro-image-preview)',
    componentProps: {
      options: [
        { label: 'OpenAI接口', value: 'openai' },
        { label: '对话式生成', value: 'chat' },
      ],
      placeholder: '请选择图像生成模式',
    },
  },
  {
    field: 'ai.imageConfig.model',
    label: '图像生成模型',
    component: 'Input',
    bottomHelpMessage: '用于图像生成的模型名称',
    required: true,
    componentProps: {
      placeholder: '请输入图像生成模型名称,例如如gemini-3-pro-image-preview',
    },
  },
  {
    field: 'ai.imageConfig.baseApi',
    label: '图像API地址',
    component: 'Input',
    bottomHelpMessage: '图像生成API基础地址,不加v1',
    required: true,
    componentProps: {
      placeholder: '请输入图像API地址，例如https://api.siliconflow.cn',
    },
  },
  {
    field: 'ai.imageConfig.apiKey',
    label: '图像API密钥',
    component: 'InputPassword',
    bottomHelpMessage: '用于图像生成的API密钥',
    required: false,
    componentProps: {
      placeholder: '请输入图像API密钥',
    },
  },
  {
    field: 'ai.imageConfig.timeout',
    label: '图像生成超时',
    component: 'InputNumber',
    bottomHelpMessage: '图像生成超时时间(毫秒)',
    componentProps: {
      min: 1000,
      max: 300000,
      step: 1000,
      placeholder: '请输入超时时间(毫秒)',
    },
  },
  {
    field: 'ai.imageConfig.maxRetries',
    label: '最大重试次数',
    component: 'InputNumber',
    bottomHelpMessage: '图像生成失败时的最大重试次数',
    componentProps: {
      min: 0,
      max: 10,
      step: 1,
      placeholder: '请输入最大重试次数',
    },
  },
  {
    field: 'ai.imageConfig.quality',
    label: '图像质量',
    component: 'Select',
    bottomHelpMessage: '生成图像的质量',
    componentProps: {
      options: [
        { label: '标准', value: 'standard' },
        { label: '高质量', value: 'high' },
      ],
      placeholder: '请选择图像质量',
    },
  },
  {
    field: 'ai.imageConfig.style',
    label: '图像风格',
    component: 'Select',
    bottomHelpMessage: '生成图像的风格',
    componentProps: {
      options: [
        { label: '自然', value: 'natural' },
        { label: '生动', value: 'vivid' },
      ],
      placeholder: '请选择图像风格',
    },
  },
  {
    field: 'ai.imageConfig.size',
    label: '图像尺寸',
    component: 'Select',
    bottomHelpMessage: '生成图像的尺寸',
    componentProps: {
      options: [
        { label: '1024x1024', value: '1024x1024' },
        { label: '1792x1024', value: '1792x1024' },
        { label: '1024x1792', value: '1024x1792' },
      ],
      placeholder: '请选择图像尺寸',
    },
  },
  {
    field: 'ai.imageConfig.responseFormat',
    label: '响应格式',
    component: 'Select',
    bottomHelpMessage: '图像响应的格式,建议url',
    componentProps: {
      options: [
        { label: 'URL', value: 'url' },
        { label: 'Base64', value: 'b64_json' },
      ],
      placeholder: '请选择响应格式',
    },
  },
  {
    field: 'ai.blockGroup',
    label: '禁用群聊',
    component: 'InputArray',
    bottomHelpMessage: '黑名单群聊，插件不会在这些群聊中工作',
    componentProps: {
      placeholder: '请输入群号，按回车添加',
    },
  },
  {
    field: 'ai.whiteGroup',
    label: '白名单群聊',
    component: 'InputArray',
    bottomHelpMessage: '白名单群聊，存在时黑名单将被禁用',
    componentProps: {
      placeholder: '请输入群号，按回车添加',
    },
  },
  {
    field: 'ai.codeRenderer.theme',
    label: '代码主题',
    component: 'Select',
    bottomHelpMessage: '代码渲染的主题',
    componentProps: {
      options: [
        { label: 'GitHub', value: 'github' },
        { label: 'Monokai', value: 'monokai' },
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
      ],
      placeholder: '请选择代码主题',
    },
  },
  {
    field: 'ai.codeRenderer.fontSize',
    label: '代码字体大小',
    component: 'InputNumber',
    bottomHelpMessage: '代码渲染的字体大小',
    componentProps: {
      min: 10,
      max: 24,
      step: 1,
      placeholder: '请输入字体大小',
    },
  },
  {
    field: 'ai.codeRenderer.lineNumbers',
    label: '显示行号',
    component: 'Switch',
    bottomHelpMessage: '是否显示代码行号',
    componentProps: {
      checkedValue: true,
      unCheckedValue: false,
    },
  },
  {
    field: 'ai.codeRenderer.backgroundColor',
    label: '背景颜色',
    component: 'Input',
    bottomHelpMessage: '代码渲染的背景颜色',
    componentProps: {
      placeholder: '请输入背景颜色，如: #f6f8fa',
    },
  },
  {
    field: 'ai.markdownRenderer.theme',
    label: 'Markdown主题',
    component: 'Select',
    bottomHelpMessage: 'Markdown渲染的主题',
    componentProps: {
      options: [
        { label: '深色', value: 'dark' },
        { label: '浅色', value: 'light' },
      ],
      placeholder: '请选择Markdown主题',
    },
  },
  {
    field: 'ai.markdownRenderer.fontSize',
    label: 'Markdown字体大小',
    component: 'InputNumber',
    bottomHelpMessage: 'Markdown渲染的字体大小',
    componentProps: {
      min: 10,
      max: 24,
      step: 1,
      placeholder: '请输入字体大小',
    },
  },
  {
    field: 'ai.markdownRenderer.codeTheme',
    label: '代码主题',
    component: 'Select',
    bottomHelpMessage: 'Markdown中代码块的主题',
    componentProps: {
      options: [
        { label: 'GitHub', value: 'github' },
        { label: 'Monokai', value: 'monokai' },
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
      ],
      placeholder: '请选择代码主题',
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
    field: 'profile.nickname',
    label: '机器人昵称',
    component: 'Input',
    bottomHelpMessage: '机器人的昵称',
    componentProps: {
      placeholder: '请输入机器人昵称',
    },
  },
];

export default guobaSchema;
