import wsClient from '../../models/ws/wsClient.js';
import configControl from '../config/configControl.js';

const botControl = {
  /**
   * 获取全部bot信息并同步到core
   * @returns {Promise<boolean>}
   */
  async reportBots() {
    const bots = [{ client: configControl.get('coreConfig').wsClientId }];

    for (const bot of Object.values(Bot)) {
      if (!bot || !bot.uin) continue;

      const botInfo = {
        uin: bot.uin,
        groups: [],
      };

      let groupsMap = bot.gl;
      if (groupsMap) {
        for (const [groupId, groupInfo] of groupsMap) {
          botInfo.groups.push({
            group_id: groupId,
            group_name: groupInfo.group_name || '未知',
          });
        }
      }

      bots.push(botInfo);
    }

    const message = {
      type: 'reportBots',
      data: bots,
    };

    return await wsClient.sendMessage(message);
  },

  /**
   * 获取群聊信息
   * @param botUin
   * @param groupId
   * @returns {Promise<*|null>}
   */
  async getGroupInfo(botUin, groupId) {
    const bot = Bot[botUin];
    if (!bot) {
      logger.warn(`未找到bot: ${botUin}`);
      return null;
    }

    const group = bot.pickGroup(groupId);
    if (!group || typeof group.getInfo !== 'function') {
      logger.warn(`Bot ${botUin}中未找到群${groupId}`);
      return null;
    }

    try {
      return await group.getInfo();
    } catch (e) {
      logger.error(`获取群聊信息失败：${groupId}..`);
      return null;
    }
  },
};

export default botControl;
