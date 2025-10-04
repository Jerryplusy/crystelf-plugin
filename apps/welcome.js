import configControl from '../lib/config/configControl.js';

export class welcomeNewcomer extends plugin {
  constructor() {
    super({
      name: 'welcome-newcomer',
      dsc: '新人入群欢迎',
      event: 'notice.group.increase',
      priority: -1000,
    });
  }

  /**
   * 新人入群欢迎
   * @returns {Promise<void>}
   */
  async accept(e) {
    if (e.user_id === e.self_id) return;
    const groupId = e.group_id;
    const cdKey = `Yz:newcomers:${groupId}`;
    if (await redis.get(cdKey)) return;
    await redis.set(cdKey, '1', { EX: 30 });
    const allCfg = configControl.get('newcomer') || {};
    const cfg = allCfg[groupId] || {};
    const msgList = [segment.at(e.user_id)];
    if (cfg.text) msgList.push(cfg.text);
    if (cfg.image) msgList.push(segment.image(cfg.image));
    if (!cfg.text && !cfg.image) msgList.push('欢迎新人~！');
    await e.reply(msgList);
  }
}
