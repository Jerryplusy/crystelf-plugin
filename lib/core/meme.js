import ConfigControl from '../config/configControl.js';

const Meme = {
  /**
   * 获取随机表情url
   * @param character 角色
   * @param status 状态
   * @returns {Promise<string>}
   */
  async getMeme(character, status) {
    const coreConfig = await ConfigControl.get()?.coreConfig;
    const coreUrl = coreConfig?.coreUrl;
    const token = coreConfig?.token;
    //logger.info(`${coreUrl}/api/meme`);
    return `${coreUrl}/api/meme?token=${token}?character=${character}&status=${status}`;
  },
};

export default Meme;
