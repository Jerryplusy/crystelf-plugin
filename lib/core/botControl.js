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
        nickName: bot.nickname,
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
   * @param botId
   * @param groupId
   * @returns {Promise<*|null>}
   */
  async getGroupInfo(botId, groupId) {
    const bot = Bot[botId];
    if (!bot) {
      logger.warn(`未找到bot: ${botId}`);
      return null;
    }

    const group = bot.pickGroup(groupId);
    if (!group) {
      logger.warn(`Bot ${botId}中未找到群${groupId}`);
      return null;
    }

    try {
      return await group.getInfo();
    } catch (e) {
      logger.error(`获取群聊信息失败：${groupId}..`);
      return null;
    }
  },

  /**
   * 发送信息到群
   * @param botId bot账号
   * @param message 发送的信息
   * @param groupId 群号
   * @returns {Promise<boolean>}
   */
  async sendMessage(botId, message, groupId) {
    const bot = Bot[botId];
    if (!bot) {
      logger.warn(`未找到bot: ${botId}`);
      return false;
    }

    const group = bot.pickGroup(groupId);
    if (!group) {
      logger.warn(`Bot ${botId}中未找到群${groupId}`);
      return false;
    }

    try {
      return !!(await group.send(message));
    } catch (e) {
      logger.error(`发送群信息失败：${groupId}..`);
      return false;
    }
  },

  /**
   * 广播消息到所有群聊
   * @param message 消息
   * @returns {Promise<void>}
   */
  async broadcastMessage(message) {
    const groupMap = new Map();

    for (const bot of Object.values(Bot)) {
      if (!bot?.uin || !bot.gl) continue;
      for (const [groupId, groupInfo] of bot.gl.entries()) {
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, []);
        }
        groupMap.get(groupId).push(bot);
      }
    }
    const tasks = [];
    for (const [groupId, botList] of groupMap.entries()) {
      const delay = Math.floor(30_000 + Math.random() * 60_000); //30s-90s
      const bot = botList[Math.floor(Math.random() * botList.length)];
      const task = setTimeout(async () => {
        try {
          const group = bot.pickGroup(groupId);
          if (!group) {
            logger.warn(`无法发消息到群${groupId}`);
            return;
          }
          await group.send(message);
          logger.mark(`已广播消息到群 ${groupId}（Bot ${bot.uin}），延迟 ${delay / 1000}s`);
        } catch (err) {
          logger.error(`广播到群 ${groupId} 失败：${err}`);
        }
      }, delay);
      tasks.push(task);
    }
    logger.info(`广播任务已部署，总群数：${groupMap.size}`);
  },
};

export default botControl;
