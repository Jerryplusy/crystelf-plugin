import WebSocket from 'ws';
import configControl from '../../lib/config/configControl.js';
import handler from './handler.js';

class WsClient {
  constructor() {
    this.ws = null;
    this.wsURL = null;
    this.secret = null;
    this.clientId = null;
    this.reconnectInterval = null;
    this.isReconnecting = false;
  }

  async initialize() {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        logger.mark('crystelf WS 客户端已连接..');
        return;
      }

      this.wsURL = configControl.get('coreConfig')?.wsUrl;
      this.secret = configControl.get('coreConfig')?.wsSecret;
      this.clientId = configControl.get('coreConfig')?.wsClientId;
      this.reconnectInterval = configControl.get('coreConfig')?.wsReConnectInterval;

      //logger.info(this.wsURL);
      this.ws = new WebSocket(this.wsURL);

      this.ws.on('open', () => {
        logger.mark('crystelf WS 客户端连接成功..');
        this.authenticate();
      });

      this.ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw);
          handler.handle(this, data);
        } catch (err) {
          logger.err(err);
        }
      });

      this.ws.on('error', (err) => {
        logger.error('WS 连接错误:', err);
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`crystelf WS 客户端连接断开:${code} - ${reason}`);
        this.reconnect();
      });
    } catch (err) {
      logger.error(err);
    }
  }

  async authenticate() {
    const authMsg = {
      type: 'auth',
      secret: this.secret,
      clientId: this.clientId,
    };
    await this.sendMessage(authMsg);
  }

  async sendMessage(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      logger.warn('crystelf WS 服务器未连接，无法发送消息..');
    }
  }

  async reconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    logger.mark('crystelf WS 客户端尝试重连..');
    setTimeout(() => {
      this.isReconnecting = false;
      this.initialize();
    }, this.reconnectInterval);
  }
}

const wsClient = new WsClient();

export default wsClient;
