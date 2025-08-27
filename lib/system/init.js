import configControl from '../config/configControl.js';
import rssCache from '../rss/rssCache.js';

export const crystelfInit = {
  async CSH() {
    await configControl.init();
    await rssCache.init();
    logger.mark('crystelf-plugin 完成初始化');
  },
};
