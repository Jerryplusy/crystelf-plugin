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
import tools from "../components/tool.js";
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
        }
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

  async in(e){
    return await index(e);
  }

  async clearChatHistory(e){
      let session = SessionManager.createOrGetSession(e.group_id,e.user_id,e);
      if(!session) return e.reply(`当前有群友正在和${nickname}聊天噢,请等待会话结束..`,true);
      SessionManager.updateChatHistory(e.group_id,[]);
      SessionManager.deactivateSession(e.group_id,e.user_id);
      return e.reply('成功重置聊天,聊天记录已经清除了..',true);
  }
}

Bot.on("message.group",async(e)=>{
  let flag = false;
  if(e.message){
    e.message.forEach(message=>{
      if(message.type === 'at' && message.qq == e.bot.uin){
        flag = true;
      }
    })
  }
  if(!flag) return;
  return await index(e);
})

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
    const userMessage = await extractUserMessage(e.msg, nickname,e);
    if (!userMessage) {
      return;
    }
    const adapter = await YunzaiUtils.getAdapter(e);
    await Message.emojiLike(e,e.message_id,128064,e.group_id,adapter);//👀
    const result = await processMessage(userMessage, e, aiConfig);
    if (result && result.length > 0) {
      // TODO 优化流式输出
      await sendResponse(e, result);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 处理消息失败: ${error.message}`);
    const config = await ConfigControl.get();
    const aiConfig = config?.ai;
    return e.reply(segment.image(await Meme.getMeme(aiConfig.character, 'default')));
  }
}

async function extractUserMessage(msg, nickname, e) {
  if (e.message) {
    let text = [];
    let at = [];
    e.message.forEach(message => {
      logger.info(message);
      if (message.type === 'text') {
        text.push(message.text);
      } else if (message.type === 'at') {
        at.push(message.qq);
      }
    })
    let returnMessage = '';
    if (text.length > 0) {
      text.forEach(message => {
        returnMessage += `[${e.sender?.nickname},id:${e.user_id}]说:${message}\n`;
      })
    }
    if (at.length > 0) {
      at.forEach((at) => {
        if(at === e.bot.uin){
          returnMessage += `[${e.sender?.nickname},id:${e.user_id}]@(at)了你,你的id是${at}\n`;
        }
        else{
        returnMessage += `[${e.sender?.nickname},id:${e.user_id}]@(at)了一个人,id是${at}\n`;
        }
      });
    }
    const imgUrls = await YunzaiUtils.getImages(e, 1, true);
    if(imgUrls){
      returnMessage += `[${e.sender?.nickname},id:${e.user_id}]发送了一张图片(你可能暂时无法查看)\n`;
    }
    return returnMessage;
  }
  logger.warn('[crystelf-ai] 字符串匹配失败,使用空字符串操作');
  return '';
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
  logger.info(`[crystelf-ai] 群${e.group_id} 用户${e.user_id}使用${mode}进行回复..`)
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
 * @param userMessage
 * @param e
 * @returns {Promise<[{type: string, data: string}]>}
 */
async function handleKeywordMode(userMessage, e) {
  const matchResult = await KeywordMatcher.matchKeywords(userMessage, 'ai');

  if (matchResult && matchResult.matched) {
    return [
      {
        type: 'message',
        data: matchResult.text,
        at: false,
        quote: false,
        recall: 0,
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

async function handleAiMode(userMessage, e, aiConfig) {
  return await callAiForResponse(userMessage, e, aiConfig);
}

async function handleMixMode(userMessage, e, aiConfig) {
  const isTooLong = await KeywordMatcher.isMessageTooLong(e.msg);

  if (isTooLong) {
    //消息太长,使用AI回复
    logger.info('[crystelf-ai] 消息过长,使用ai回复')
    return await callAiForResponse(userMessage, e, aiConfig);
  } else {
    const matchResult = await KeywordMatcher.matchKeywords(userMessage, 'ai');
    if (matchResult && matchResult.matched) {
      const session = SessionManager.createOrGetSession(e.group_id, e.user_id,e);
      const historyLen = aiConfig.chatHistory;
      const chatHistory = session.chatHistory.slice(-historyLen|-10);
      const res = [
        {
          type: 'message',
          data: matchResult.text,
          at: false,
          quote: false,
          recall: 0,
        },
      ];
      let resMessage = {
        type: 'message',
        data: matchResult.text + ' [词库预设消息]',
        at: false,
        quote: false,
        recall: 0,
      };
      const newChatHistory = [
        ...chatHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: JSON.stringify(resMessage) },
      ];
      SessionManager.updateChatHistory(e.group_id, newChatHistory);
      SessionManager.deactivateSession(e.group_id,e.user_id);

      return res;
    } else {
      logger.info('[crystelf-ai] 关键词匹配失败,使用ai回复')
      //关键词匹配失败,使用AI回复
      return await callAiForResponse(userMessage, e, aiConfig);
    }
  }
}

async function callAiForResponse(userMessage, e, aiConfig) {
  try {
    //创建session
    const session = SessionManager.createOrGetSession(e.group_id, e.user_id,e);
    if (!session) {
      logger.info(
        `[crystelf-ai] 群${e.group_id} , 用户${e.user_id}无法创建session,请检查是否聊天频繁`
      );
      return null;
    }
    //搜索相关记忆
    const memories = await MemorySystem.searchMemories(e.user_id,e.msg||'',5);
    logger.info(`[crystelf-ai] ${memories}`)
    //构建聊天历史
    const historyLen = aiConfig.chatHistory;
    const chatHistory = session.chatHistory.slice(-historyLen|-10);
    const aiResult = await AiCaller.callAi(userMessage, chatHistory, memories,e);
    if (!aiResult.success) {
      logger.error(`[crystelf-ai] AI调用失败: ${aiResult.error}`);
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
      userMessage,
      e.group_id,
      e.user_id
    );
    //更新session
    const newChatHistory = [
      ...chatHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResult.response },
    ];
    SessionManager.updateChatHistory(e.group_id, newChatHistory);
    SessionManager.deactivateSession(e.group_id,e.user_id);
    return processedResponse;
  } catch (error) {
    logger.error(`[crystelf-ai] AI调用失败: ${error.message}`);
    SessionManager.deactivateSession(e.group_id,e.user_id);
    return [
      {
        type: 'meme',
        data: 'default',
      },
    ];
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
    for (const message of messages) {
      switch (message.type) {
        case 'message':
          if (message.recall > 0) {
            await e.reply(message.data, message.quote, {
              recallMsg: message.recall,
              at: message.at,
            });
          } else {
            await e.reply(message.data, message.quote, {
              at: message.at,
            });
          }
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
          e.reply(segment.at(message.id));
          break;

        case 'poke':
          await handlePokeMessage(e, message);
          break;

        case 'like':
          await handleLikeMessage(e, message);
          break;

        case 'recall':
          await handleRecallMessage(e, message);
          break;

        default:
          logger.warn(`[crystelf-ai] 不支持的消息类型: ${message.type}`);
      }
      await tools.sleep(40);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 发送回复失败: ${error.message}`);
  }
}

async function handleCodeMessage(e, message) {
  try {
    //渲染代码为图片
    logger.info(message);
    logger.info(message.language)
    const imagePath = await Renderer.renderCode(message.data, message.language);
    if (imagePath) {
      await e.reply(segment.image(imagePath));
    } else {
      await e.reply('渲染代码失败了,待会儿再试试吧..',true);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 处理代码消息失败: ${error.message}`);
    await e.reply('渲染代码失败了,待会儿再试试吧..',true);
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
      await e.reply('渲染markdown失败了,待会儿再试试吧..',true);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 处理Markdown消息失败: ${error.message}`);
    await e.reply('渲染markdown失败了,待会儿再试试吧..',true);
  }
}

async function handleMemeMessage(e, message) {
  try {
    const config = await ConfigControl.get('ai');
    const memeConfig = config?.memeConfig || {};
    const availableEmotions = memeConfig.availableEmotions || [
      'happy',
      'sad',
      'angry',
      'confused',
    ];
    //情绪是否有效
    const emotion = availableEmotions.includes(message.data) ? message.data : 'default';
    const character = memeConfig.character || 'default';
    const memeUrl = await Meme.getMeme(character, emotion);
    await e.reply(segment.image(memeUrl));
  } catch (error) {
    logger.error(`[crystelf-ai] 处理表情消息失败: ${error.message}`);
    e.reply(segment.image(await Meme.getMeme(aiConfig.character, 'default')));
  }
}

async function handlePokeMessage(e, message) {
  try {
    await Group.groupPoke(e, message.id, e.group_id);
  } catch (error) {
    logger.error(`[crystelf-ai] 戳一戳失败: ${error.message}`);
  }
}

async function handleLikeMessage(e, message) {
  try {
    // TODO 点赞逻辑
    const adapter = await YunzaiUtils.getAdapter(e);
    const messageId = e.message_id || e.source?.id;

    if (messageId) {
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 点赞失败: ${error.message}`);
  }
}

async function handleRecallMessage(e, message) {
  try {
    if (message.seq) {
      await Message.deleteMsg(e, message.seq);
    }
  } catch (error) {
    logger.error(`[crystelf-ai] 撤回消息失败: ${error.message}`);
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
