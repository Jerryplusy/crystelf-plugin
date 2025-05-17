import configControl from '../config/configControl.js';
import wsClient from '../../models/ws/wsClient.js';
import rssCache from '../rss/rssCache.js';

export const crystelfInit = {
  async CSH() {
    await configControl.init();
    await rssCache.init();
    if (configControl.get('core')) {
      await wsClient.initialize();
    }
    logger.mark('crystelf 完成初始化');
  },
};
