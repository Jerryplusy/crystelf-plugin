import configControl from '../config/configControl.js';
import wsClient from '../../models/ws/wsClient.js';

export const crystelfInit = {
  async CSH() {
    await configControl.init();
    await wsClient.initialize();
    logger.mark('crystelf 完成初始化');
  },
};
