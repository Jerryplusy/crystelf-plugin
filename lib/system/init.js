import configControl from '../config/configControl.js';
import rssCache from '../rss/rssCache.js';

export const crystelfInit = {
  async CSH() {
    await configControl.init();
    await rssCache.init();
  },
};
