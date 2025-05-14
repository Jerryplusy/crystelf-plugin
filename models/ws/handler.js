import botControl from '../../lib/core/botControl.js';
import wsClient from './wsClient.js';

class Handler {
  constructor() {
    this.handlers = new Map([
      ['auth', this.handleAuth.bind(this)],
      ['ping', this.handlePing.bind(this)],
      ['message', this.handleMessageFromServer.bind(this)],
      ['error', this.handleError.bind(this)],
      ['getGroupInfo', this.handleGetGroupInfo.bind(this)],
      ['sendMessage', this.handleSendMessage.bind(this)],
    ]);
  }

  async handle(client, msg) {
    const handler = this.handlers.get(msg.type);
    if (handler) {
      await handler(client, msg);
    } else {
      logger.warn(`未知消息类型: ${msg.type}`);
    }
  }

  async handleAuth(client, msg) {
    if (msg.success) {
      logger.mark('crystelf WS 认证成功..');
    } else {
      logger.error('crystelf WS 认证失败，关闭连接..');
      client.ws.close(4001, '认证失败');
    }
  }

  async handlePing(client, msg) {
    await client.sendMessage({ type: 'pong' });
  }

  async handleMessageFromServer(client, msg) {
    logger.mark(`crystelf 服务端消息: ${msg.data}`);
  }

  async handleError(client, msg) {
    logger.warn(`crystelf WS 错误:${msg.data}`);
  }

  /**
  获取群聊信息，自动回调
  @examples 请求示例
  ```json
  {
  requestId: 114514,
  type: 'getGroupInfo',
  data: {
    botId: 114514,
    groupId: 114514,
    },
  }
  ```
   **/
  async handleGetGroupInfo(client, msg) {
    const requestId = msg?.requestId;
    const botId = msg.data?.botId;
    const groupId = msg.data?.groupId;
    const type = msg.type + 'Return';
    const groupData = await botControl.getGroupInfo(botId, groupId);
    const returnData = {
      type: type,
      requestId: requestId,
      data: groupData,
    };
    await wsClient.sendMessage(returnData);
  }

  /**
   * 发送信息到群聊
   * @param client
   * @param msg
   * @returns {Promise<void>}
   */
  async handleSendMessage(client, msg) {
    const botId = msg.data?.botId;
    const groupId = msg.data?.groupId;
    const message = msg.data?.message;
    await botControl.sendMessage(botId, message, groupId);
  }
}

const handler = new Handler();
export default handler;
