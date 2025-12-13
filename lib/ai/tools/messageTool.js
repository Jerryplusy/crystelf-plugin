import BaseTool from './baseTool.js';

/**
 * 发送消息工具
 * 整合了原来的message、at、quote功能
 */
class SendMessageTool extends BaseTool {
  constructor() {
    super(
      'send_message',
      '发送消息给用户，支持@用户和引用消息',
      {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '消息内容'
          },
          at_user: {
            type: 'string',
            description: '要@的用户QQ号，不需要@时不传此参数'
          },
          quote_message_id: {
            type: 'string',
            description: '要引用的消息ID，不需要引用时不传此参数'
          },
          recall_after: {
            type: 'number',
            description: '多少秒后撤回消息，不需要撤回时不传此参数'
          }
        },
        required: ['content']
      }
    );
  }

  async execute(params, context) {
    const { content, at_user, quote_message_id, recall_after } = params;
    const { e, responseQueue } = context;

    // 构建消息对象，兼容原来的格式
    const messageObj = {
      type: 'message',
      data: content,
      at: at_user ? parseInt(at_user) : -1,
      quote: quote_message_id ? parseInt(quote_message_id) : -1,
      recall: recall_after ? true : false
    };

    // 添加到响应队列
    responseQueue.push(messageObj);

    return {
      success: true,
      message: `已发送消息: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      messageId: Date.now().toString()
    };
  }
}

/**
 * 发送表情包工具
 */
class SendMemeTool extends BaseTool {
  constructor() {
    super(
      'send_meme',
      '发送表情包',
      {
        type: 'object',
        properties: {
          emotion: {
            type: 'string',
            enum: ['angry', 'bye', 'confused', 'default', 'good', 'goodmorning', 'goodnight', 'happy', 'sad', 'shy', 'sorry', 'surprise'],
            description: '表情包情绪类型'
          }
        },
        required: ['emotion']
      }
    );
  }

  async execute(params, context) {
    const { emotion } = params;
    const { responseQueue } = context;

    const memeObj = {
      type: 'meme',
      data: emotion
    };

    responseQueue.push(memeObj);

    return {
      success: true,
      message: `已发送${emotion}表情包`
    };
  }
}

/**
 * 戳一戳工具
 */
class PokeTool extends BaseTool {
  constructor() {
    super(
      'poke_user',
      '戳一戳指定用户',
      {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: '要戳的用户QQ号'
          }
        },
        required: ['user_id']
      }
    );
  }

  async execute(params, context) {
    const { user_id } = params;
    const { e, responseQueue } = context;

    // 不能戳自己
    if (user_id === e.bot.uin.toString()) {
      return {
        success: false,
        message: '不能戳自己'
      };
    }

    const pokeObj = {
      type: 'poke',
      id: parseInt(user_id)
    };

    responseQueue.push(pokeObj);

    return {
      success: true,
      message: `已戳一戳用户 ${user_id}`
    };
  }
}

export { SendMessageTool, SendMemeTool, PokeTool };