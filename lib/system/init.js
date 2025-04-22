import Path from '../../constants/path.js';

export const crystelfInit = {
  CSH: () => {
    logger.info(Path.root);
    logger.mark('crystelf 完成初始化');
  },
};
