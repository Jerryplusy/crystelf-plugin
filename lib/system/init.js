import configControl from '../config/configControl.js';

export const crystelfInit = {
  async CSH() {
    await configControl.init();
    logger.mark('crystelf 完成初始化');
  },
};
