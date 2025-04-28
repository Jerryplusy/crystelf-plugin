import wsClient from '../../models/ws/wsClient.js';

const botControl = {
  async reportBots() {
    const bots = [];

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

    return await wsClient.sendMessage({
      type: 'reportBots',
      data: bots,
    });
  },
};

export default botControl;
