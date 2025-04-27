class Handler {
  constructor() {
    this.handlers = new Map([
      ['auth', this.handleAuth.bind(this)],
      ['ping', this.handlePing.bind(this)],
      ['message', this.handleMessageFromServer.bind(this)],
      ['error', this.handleError.bind(this)],
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
}

const handler = new Handler();
export default handler;
