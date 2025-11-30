import ConfigControl from '../lib/config/configControl.js';
import SessionManager from '../lib/ai/sessionManager.js';
import KeywordMatcher from '../lib/ai/keywordMatcher.js';
import AiCaller from '../lib/ai/aiCaller.js';
import ResponseHandler from '../lib/ai/responseHandler.js';
import MemorySystem from '../lib/ai/memorySystem.js';
import Renderer from '../lib/ai/renderer.js';
import Meme from '../lib/core/meme.js';
import Group from '../lib/yunzai/group.js';
import Message from '../lib/yunzai/message.js';
import YunzaiUtils from '../lib/yunzai/utils.js';
import { segment } from 'oicq';
import tools from '../components/tool.js';
const nickname = await ConfigControl.get('profile')?.nickName;

export class crystelfAI extends plugin {
  constructor() {
    super({
      name: 'crystelfAI',
      dsc: '晶灵智能',
      event: 'message.group',
      priority: -1111,
      rule: [
        {
          reg: `^${nickname}([\\s\\S]*)?$`,
          fnc: 'in',
        },
        {
          reg: '^(#|/)?重置(对话|会话)$',
          fnc: 'clearChatHistory',
        },
      ],
    });
    this.isInitialized = false;
  }
  async init() {
    try {
      logger.info('[crystelf-ai] 开始初始化...');
      SessionManager.init();
      KeywordMatcher.init();
      AiCaller.init();
      MemorySystem.init();
      Renderer.init();
      this.isInitialized = true;
      logger.info('[crystelf-ai] 初始化完成');
    } catch (error) {
      logger.error(`[crystelf-ai] 初始化失败: ${error.message}`);
    }
  }

  async in(e) {
    return await index(e);
  }

  async clearChatHistory(e) {
    let session = SessionManager.createOrGetSession(e.group_id, e.user_id, e);
    if (!session) return e.reply(`当前有群友正在和${nickname}聊天噢,请等待会话结束..`, true);
    SessionManager.updateChatHistory(e.group_id, []);
    SessionManager.deactivateSession(e.group_id, e.user_id);
    return e.reply('成功重置聊天,聊天记录已经清除了..', true);
  }
}

Bot.on('message.group', async (e) => {
  let flag = false;
  if (e.message) {
    e.message.forEach((message) => {
      if (message.type === 'at' && message.qq == e.bot.uin) {
        flag = true;
      }
    });
  }
  if (!flag) return;
  return await index(e);
});

async function index(e) {
  try {
    //logger.info('111')
    const config = await ConfigControl.get();
    const aiConfig = config?.ai;
    if (!config?.config?.ai) {
      return;
    }
    if (aiConfig?.blockGroup?.includes(e.group_id)) {
      return;
    }
    if (aiConfig?.whiteGroup?.length > 0 && !aiConfig?.whiteGroup?.includes(e.group_id)) {
      return;
    }
    if (e.user_id === e.bot.uin) {
      return;
    }
    const messageData = await extractUserMessage(e.msg, nickname, e);
    if (!messageData || !messageData.text || messageData.text.length === 0) {
      return e.reply(segment.image(await Meme.getMeme(aiConfig.character, 'default')));
    }
    const result = await processMessage(messageData, e, aiConfig);
    if (result && result.length > 0) {
      await sendResponse(e, result);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 处理消息失败: ${error.message}`);
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e, e.message_id, 10060, e.group_id, adapter);
    //return e.reply(segment.image(await Meme.getMeme(aiConfig.character, 'default')));
  }
}

async function extractUserMessage(msg, nickname, e) {
  if (e.message && msg && msg.trim()!=='' && msg !== '\n') {
    let text = [];
    let at = [];
    const aiConfig = await ConfigControl.get('ai');
    const maxMessageLength = aiConfig?.maxMessageLength || 100;
    const originalMessages = [];
    e.message.forEach((message) => {
      logger.info(message);
      if (message.type === 'text' && message.text !== '' && message.text !== '\n'){
        let displayText = message.text;
        if (message.text && message.text.length > maxMessageLength) {
          const omittedChars = message.text.length - maxMessageLength;
          displayText = message.text.substring(0, maxMessageLength) + `...(省略${omittedChars}字)`;
        }
        text.push(displayText);
      } else if (message.type === 'at') {
        at.push(message.qq);
      } else if (message.type === 'image') {
        if (message.image) {
          originalMessages.push({
            type: 'image_url',
            image_url: {
              url: message.url
            }
          });
        }
      }
    });
    
    let returnMessage = '';
    if (text.length > 0) {
      text.forEach((message) => {
        if(message === '') {
        } else {
          const tempMessage = `[${e.sender?.nickname},id:${e.user_id},seq:${e.message_id}]说:${message}\n`
          returnMessage += tempMessage;
          originalMessages.push({
            type: 'text',
            content: tempMessage
          });
        }
      });
    }
    if(at.length == 1 && at[0] == e.bot.uin && text.length == 0){
      return { text: [], originalMessages: originalMessages };
    }
    if (at.length > 0) {
      for (const at1 of at) {
        if (at1 == e.bot.uin) {
          //returnMessage += `[${e.sender?.nickname},id:${e.user_id}]@(at)了你,你的id是${at}\n`;
        } else {
          const atNickname = await e.group.pickMember(at1).nickname || '一个人';
          const tempMessage = `[${e.sender?.nickname},id:${e.user_id},seq:${e.message_id}]@(at)了${atNickname},id是${at1}\n`
          returnMessage += tempMessage;
          originalMessages.push({
            type: 'text',
            content: tempMessage
          });
        }
      }
    }
    if(e.source || e.reply_id){
      let reply;
      if(e.getReply) reply = await e.getReply();
      else {
        const history = await e.group.getChatHistory(e.source.seq,1);
        reply = history?.pop();
      }
      if(reply){
        const msgArr = Array.isArray(reply) ? reply : reply.message || [];
        msgArr.forEach((msg) => {
          if(msg.type === 'text'){
            const tempMessage = `[${e.sender?.nickname}]引用了[被引用消息:${reply.user_id == e.bot.uin ? '你' : reply.sender?.nickname},id:${reply.user_id},seq:${reply.message_id}]发的一段文本:${msg.text}\n`
            returnMessage += tempMessage;
            originalMessages.push({
              type: 'text',
              content: tempMessage
            });
          }
          if(msg.type === 'image'){
            returnMessage += `[${e.sender?.nickname}]引用了[被引用消息:${reply.user_id == e.bot.uin ? '你' : reply.sender?.nickname},id:${reply.user_id},seq:${reply.message_id}]发的一张图片(你可能暂时无法查看)\n`;
            originalMessages.push({
              type: 'image_url',
              image_url: {
                url: msg.url
              }
            });
          }
        })
      }
    }
    const imgUrls = await YunzaiUtils.getImages(e, 1, true);
    if (imgUrls) {
      returnMessage += `[${e.sender?.nickname},id:${e.user_id},seq:${e.message_id}]发送了一张图片(你可能暂时无法查看)\n`;
    }
    return { text: returnMessage, originalMessages: originalMessages };
  }
  logger.warn('[crystelf-ai] 字符串匹配失败');
  return { text: [], originalMessages: [] };
}

/**
 * 处理用户消息
 * @param userMessage
 * @param e
 * @param aiConfig
 * @returns {Promise<Array|null>}
 */
async function processMessage(userMessage, e, aiConfig) {
  const mode = aiConfig?.mode || 'mix';
  logger.info(`[crystelf-ai] 群${e.group_id} 用户${e.user_id}使用${mode}进行回复..`);
  switch (mode) {
    case 'keyword':
      return await handleKeywordMode(userMessage, e);
    case 'ai':
      return await handleAiMode(userMessage, e, aiConfig);
    case 'mix':
      return await handleMixMode(userMessage, e, aiConfig);
    default:
      logger.warn(`[crystelf-ai] 未知匹配模式: ${mode},将使用混合模式输出`);
      return await handleMixMode(userMessage, e, aiConfig);
  }
}

/**
 * 关键词模式
 * @param messageData
 * @param e
 * @returns {Promise<[{type: string, data: string}]>}
 */
async function handleKeywordMode(messageData, e) {
  const matchResult = await KeywordMatcher.matchKeywords(e.msg, 'ai');

  if (matchResult && matchResult.matched) {
    return [
      {
        type: 'message',
        data: matchResult.text,
        at: -1,
        quote: -1,
        recall: false,
      },
    ];
  }
  logger.warn('[crystelf-ai] 关键词回复模式未查询到输出,将回复表情包');
  return [
    {
      type: 'meme',
      data: 'default',
    },
  ];
}

async function handleAiMode(messageData, e, aiConfig) {
  return await callAiForResponse(messageData, e, aiConfig);
}

async function handleMixMode(messageData, e, aiConfig) {
  const isTooLong = await KeywordMatcher.isMessageTooLong(e.msg);

  if (isTooLong) {
    //消息太长,使用AI回复
    logger.info('[crystelf-ai] 消息过长,使用ai回复');
    return await callAiForResponse(messageData, e, aiConfig);
  } else {
    const matchResult = await KeywordMatcher.matchKeywords(e.msg, 'ai');
    if (matchResult && matchResult.matched) {
      const session = SessionManager.createOrGetSession(e.group_id, e.user_id, e);
      const historyLen = aiConfig.chatHistory;
      const chatHistory = session.chatHistory.slice(-historyLen | -10);
      const res = [
        {
          type: 'message',
          data: matchResult.text,
          at: -1,
          quote: -1,
          recall: false,
        },
      ];
      let resMessage = {
        type: 'message',
        data: matchResult.text,
        at: -1,
        quote: -1,
        recall: false,
      };
      const newChatHistory = [
        ...chatHistory,
        { role: 'user', content: messageData.text },
        { role: 'assistant', content: JSON.stringify(resMessage) },
      ];
      SessionManager.updateChatHistory(e.group_id, newChatHistory);
      SessionManager.deactivateSession(e.group_id, e.user_id);

      return res;
    } else {
      logger.info('[crystelf-ai] 关键词匹配失败,使用ai回复');
      //关键词匹配失败,使用AI回复
      return await callAiForResponse(messageData, e, aiConfig);
    }
  }
}

async function callAiForResponse(messageData, e, aiConfig) {
  try {
    //创建session
    const session = SessionManager.createOrGetSession(e.group_id, e.user_id, e);
    if (!session) {
      logger.info(
        `[crystelf-ai] 群${e.group_id} , 用户${e.user_id}无法创建session,请检查是否聊天频繁`
      );
      const adapter = await YunzaiUtils.getAdapter(e);
      await Message.emojiLike(e, e.message_id, 128166, e.group_id, adapter);
      return null;
    }
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e, e.message_id, 128064, e.group_id, adapter); //👀
    //搜索相关记忆
    const memories = await MemorySystem.searchMemories(e.user_id, e.msg || '', 5);
    logger.info(`[crystelf-ai] ${memories}`);
    //构建聊天历史
    const historyLen = aiConfig.chatHistory;
    const chatHistory = session.chatHistory.slice(-historyLen | -10);
    
    // 根据多模态开关决定调用方式
    const aiResult = await AiCaller.callAi(messageData.text, chatHistory, memories, e, messageData.originalMessages);
    
    if (!aiResult.success) {
      logger.error(`[crystelf-ai] AI调用失败: ${aiResult.error}`);
      SessionManager.deactivateSession(e.group_id, e.user_id);
      return [
        {
          type: 'meme',
          data: 'default',
        },
      ];
    }
    //处理响应
    const processedResponse = await ResponseHandler.processResponse(
      aiResult.response,
      messageData.text,
      e.group_id,
      e.user_id
    );
    //更新session
    const newChatHistory = [
      ...chatHistory,
      { role: 'user', content: messageData.text },
      { role: 'assistant', content: aiResult.response },
    ];
    SessionManager.updateChatHistory(e.group_id, newChatHistory);
    SessionManager.deactivateSession(e.group_id, e.user_id);
    return processedResponse;
  } catch (error) {
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e, e.message_id, 10060, e.group_id, adapter);
    logger.error(`[crystelf-ai] AI调用失败: ${error.message}`);
    SessionManager.deactivateSession(e.group_id, e.user_id);
    return [];
  }
}

/**
 * 发送消息
 * @param e
 * @param messages 消息数组
 * @returns {Promise<void>}
 */
async function sendResponse(e, messages) {
  try {
    const adapter = await YunzaiUtils.getAdapter(e);
    for (const message of messages) {
      switch (message.type) {
        case 'message':
          await Message.sendGroupMessage(e,e.group_id,message.data,message.at,message.quote,adapter);
          break;

        case 'code':
          await handleCodeMessage(e, message);
          break;

        case 'markdown':
          await handleMarkdownMessage(e, message);
          break;

        case 'meme':
          await handleMemeMessage(e, message);
          break;

        case 'at':
          if(message.id != e.bot.uin)e.reply(segment.at(message.id));
          break;

        case 'poke':
          await handlePokeMessage(e, message);
          break;

        default:
          logger.warn(`[crystelf-ai] 不支持的消息类型: ${message.type}`);
      }
      await tools.sleep(40);
    }
  } catch (error) {
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e, e.message_id, 10060, e.group_id, adapter);
    logger.error(`[crystelf-ai] 发送回复失败: ${error}`);
  }
}

async function handleCodeMessage(e, message) {
  try {
    //渲染代码为图片
    logger.info(message);
    logger.info(message.language);
    const imagePath = await Renderer.renderCode(message.data, message.language);
    if (imagePath) {
      await e.reply(segment.image(imagePath));
    } else {
      await e.reply('渲染代码失败了,待会儿再试试吧..', true);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 处理代码消息失败: ${error.message}`);
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e, e.message_id, 10060, e.group_id, adapter);
    await e.reply('渲染代码失败了,待会儿再试试吧..', true);
  }
}

async function handleMarkdownMessage(e, message) {
  try {
    //渲染Markdown为图片
    const imagePath = await Renderer.renderMarkdown(message.data);
    if (imagePath) {
      await e.reply(segment.image(imagePath));
    } else {
      //渲染失败 TODO 构造转发消息发送,避免刷屏
      await e.reply('渲染markdown失败了,待会儿再试试吧..', true);
    }
  } catch (error) {
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e, e.message_id, 10060, e.group_id, adapter);
    logger.error(`[crystelf-ai] 处理Markdown消息失败: ${error.message}`);
    await e.reply('渲染markdown失败了,待会儿再试试吧..', true);
  }
}

async function handleMemeMessage(e, message) {
  try {
    const config = await ConfigControl.get('ai');
    const memeConfig = config?.memeConfig || {};
    const availableEmotions = memeConfig.availableEmotions || ['happy', 'sad', 'angry', 'confused'];
    //情绪是否有效
    const emotion = availableEmotions.includes(message.data) ? message.data : 'default';
    const character = memeConfig.character || 'default';
    const memeUrl = await Meme.getMeme(character, emotion);
    await e.reply(segment.image(memeUrl));
  } catch (error) {
    logger.error(`[crystelf-ai] 处理表情消息失败: ${error.message}`);
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e, e.message_id, 10060, e.group_id, adapter);
    //e.reply(segment.image(await Meme.getMeme(aiConfig.character, 'default')));
  }
}

async function handlePokeMessage(e, message) {
  try {
    if(message.id != e.bot.uin){
    await Group.groupPoke(e, message.id, e.group_id);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 戳一戳失败: ${error.message}`);
  }
}

//定期清理过期sessions
setInterval(
  async () => {
    try {
      SessionManager.cleanTimeoutSessions();
    } catch (error) {
      logger.error(`[crystelf-ai] 清理过期sessions失败: ${error.message}`);
    }
  },
  5 * 60 * 1000
); //5分钟清理一次
