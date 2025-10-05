import configControl from '../lib/config/configControl.js';
import tools from '../components/tool.js';

export class welcomeNewcomer extends plugin {
  constructor() {
    super({
      name: 'welcome-newcomer',
      dsc: '新人入群欢迎',
      event: 'notice.group.increase',
      priority: -1000,
    });
  }

  async accept(e) {
    try {
      await tools.sleep(600);
      if (e.user_id === e.self_id) return;
      const groupId = e.group_id;
      const cdKey = `Yz:newcomers:${groupId}`;
      if (await redis.get(cdKey)) return;
      await redis.set(cdKey, '1', { EX: 30 });
      const newcomerCfg = (await configControl.get('newcomer')) || {};
      const welcomeCfg = newcomerCfg[groupId] || {};
      const authCfg = await configControl.get('auth');
      const groupAuthCfg = authCfg?.groups?.[groupId] || authCfg?.default || {};
      const msgList = [segment.at(e.user_id)];
      if (welcomeCfg.text) msgList.push(welcomeCfg.text);
      if (welcomeCfg.image) msgList.push(segment.image(welcomeCfg.image));
      if (!welcomeCfg.text && !welcomeCfg.image) msgList.push('欢迎新人~！');
      if (groupAuthCfg?.enable) {
        // 缓存欢迎消息
        const redisKey = `Yz:pendingWelcome:${groupId}:${e.user_id}`;
        await redis.set(redisKey, JSON.stringify(msgList), { EX: 300 });
        return;
      }
      // 未开启验证
      await e.reply(msgList);
    } catch (err) {
      return e.reply('加群欢迎出现错误，请重新设置加群欢迎', true);
    }
  }
}
