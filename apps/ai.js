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
          fnc: 'index',
        },
      ],
    });
    this.isInitialized = false;
  }
  async init() {
    try {
      logger.info('[crystelf-ai] 开始初始化...');
      await SessionManager.init();
      await KeywordMatcher.init();
      await AiCaller.init();
      await MemorySystem.init();
      await Renderer.init();
      this.isInitialized = true;
      logger.info('[crystelf-ai] 初始化完成');
    } catch (error) {
      logger.err(`[crystelf-ai] 初始化失败: ${error.message}`);
    }
  }

  async index(e) {
    try {
      if (!this.isInitialized) {
        await this.init();
      }
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
      const userMessage = this.extractUserMessage(e.msg, nickname);
      if (!userMessage) {
        return;
      }
      logger.info(
        `[crystelf-ai] 收到消息: 群${e.group_id}, 用户${e.user_id}, 内容: ${userMessage}`
      );
      const result = await this.processMessage(userMessage, e, aiConfig);
      if (result && result.length > 0) {
        // TODO 优化流式输出
        await this.sendResponse(e, result);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 处理消息失败: ${error.message}`);
      const config = await ConfigControl.get();
      const aiConfig = config?.ai;
      return e.reply(segment.image(await Meme.getMeme(aiConfig.character, 'default')));
    }
  }

  extractUserMessage(msg, nickname) {
    if (!msg || !nickname) return '';
    const regex = new RegExp(`^${nickname}\\s*([\\s\\S]*)?$`);
    const match = msg.match(regex);
    if (match && match[1]) {
      return match[1].trim();
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
  async processMessage(userMessage, e, aiConfig) {
    const mode = aiConfig?.mode || 'mix';

    switch (mode) {
      case 'keyword':
        return await this.handleKeywordMode(userMessage, e);
      case 'ai':
        return await this.handleAiMode(userMessage, e, aiConfig);
      case 'mix':
        return await this.handleMixMode(userMessage, e, aiConfig);
      default:
        logger.warn(`[crystelf-ai] 未知匹配模式: ${mode},将使用混合模式输出`);
        return await this.handleMixMode(userMessage, e, aiConfig);
    }
  }

  /**
   * 关键词模式
   * @param userMessage
   * @param e
   * @returns {Promise<[{type: string, data: string}]>}
   */
  async handleKeywordMode(userMessage, e) {
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

  async handleAiMode(userMessage, e, aiConfig) {
    return await this.callAiForResponse(userMessage, e, aiConfig);
  }

  async handleMixMode(userMessage, e, aiConfig) {
    const isTooLong = await KeywordMatcher.isMessageTooLong(userMessage);

    if (isTooLong) {
      //消息太长,使用AI回复
      return await this.callAiForResponse(userMessage, e, aiConfig);
    } else {
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
      } else {
        //关键词匹配失败,使用AI回复
        return await this.callAiForResponse(userMessage, e, aiConfig);
      }
    }
  }

  async callAiForResponse(userMessage, e, aiConfig) {
    try {
      //创建session
      const session = SessionManager.createOrGetSession(e.group_id, e.user_id);
      if (!session) {
        logger.info(
          `[crystelf-ai] 群${e.group_id} , 用户${e.user_id}无法创建session,请检查是否聊天频繁`
        );
        return null;
      }
      //搜索相关记忆
      const memories = await MemorySystem.searchMemories([userMessage], 5);
      //构建聊天历史
      const chatHistory = session.chatHistory.slice(-10);
      const aiResult = await AiCaller.callAi(userMessage, chatHistory, memories);
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
        e.group_id
      );
      //更新session
      const newChatHistory = [
        ...chatHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResult.response },
      ];
      SessionManager.updateChatHistory(e.group_id, newChatHistory);
      return processedResponse;
    } catch (error) {
      logger.error(`[crystelf-ai] AI调用失败: ${error.message}`);
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
  async sendResponse(e, messages) {
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
            await this.handleCodeMessage(e, message);
            break;

          case 'markdown':
            await this.handleMarkdownMessage(e, message);
            break;

          case 'meme':
            await this.handleMemeMessage(e, message);
            break;

          case 'at':
            await e.reply(segment.at(message.id));
            break;

          case 'poke':
            await this.handlePokeMessage(e, message);
            break;

          case 'like':
            await this.handleLikeMessage(e, message);
            break;

          case 'recall':
            await this.handleRecallMessage(e, message);
            break;

          default:
            logger.warn(`[crystelf-ai] 不支持的消息类型: ${message.type}`);
        }
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 发送回复失败: ${error.message}`);
    }
  }

  async handleCodeMessage(e, message) {
    try {
      //渲染代码为图片
      const imagePath = await Renderer.renderCode(message.data, message.language || 'text');
      if (imagePath) {
        await e.reply(segment.image(imagePath));
      } else {
        // 渲染失败 TODO 构造转发消息发送,避免刷屏
        await e.reply(segment.code(message.data));
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 处理代码消息失败: ${error.message}`);
      await e.reply(segment.code(message.data));
    }
  }

  async handleMarkdownMessage(e, message) {
    try {
      //渲染Markdown为图片
      const imagePath = await Renderer.renderMarkdown(message.data);
      if (imagePath) {
        await e.reply(segment.image(imagePath));
      } else {
        //渲染失败 TODO 构造转发消息发送,避免刷屏
        await e.reply(message.data);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 处理Markdown消息失败: ${error.message}`);
      await e.reply(message.data);
    }
  }

  async handleMemeMessage(e, message) {
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

  async handlePokeMessage(e, message) {
    try {
      await Group.groupPoke(e, message.id, e.group_id);
    } catch (error) {
      logger.error(`[crystelf-ai] 戳一戳失败: ${error.message}`);
    }
  }

  async handleLikeMessage(e, message) {
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

  async handleRecallMessage(e, message) {
    try {
      if (message.seq) {
        await Message.deleteMsg(e, message.seq);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 撤回消息失败: ${error.message}`);
    }
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
