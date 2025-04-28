import wsClient from '../../models/ws/wsClient.js';
import configControl from '../config/configControl.js';

const botControl = {
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
};

export default botControl;
