import configControl from '../lib/config/configControl.js';
import YunzaiUtils from '../lib/yunzai/utils.js';

export class welcomeNewcomerSetting extends plugin {
  constructor() {
    super({
      name: 'welcome-newcomer-set',
      dsc: '新人入群欢迎设置',
      event: 'message.group',
      priority: -1000,
      rule: [
        {
          reg: '^#设置欢迎(文案|图片)([\\s\\S]*)?$',
          fnc: 'setWelcome',
        },
        {
          reg: '^#查看欢迎$',
          fnc: 'viewWelcome',
        },
        {
          reg: '^#清除欢迎$',
          fnc: 'clearWelcome',
        },
      ],
    });
  }

  /**
   * 设置欢迎语
   * @param e
   * @returns {Promise<boolean|*>}
   */
  async setWelcome(e) {
    if (!(e.isMaster || ['owner', 'admin'].includes(e.sender?.role))) {
      return e.reply('只有群主或管理员可以设置欢迎消息哦~', true);
    }
    const groupId = e.group_id;
    const type = e.msg.includes('文案') ? 'text' : 'image';
    const allCfg = configControl.get('newcomer') || {};
    const cfg = allCfg[groupId] || {};

    if (type === 'text') {
      const text = e.msg.replace(/^#设置欢迎文案/, '').trim();
      if (!text) return e.reply('请在命令后输入欢迎文案..', true);
      cfg.text = text;
      allCfg[groupId] = cfg;
      await configControl.set('newcomer', allCfg);
      return e.reply(`欢迎文案设置成功：\n${text}..`, true);
    }

    if (type === 'image') {
      const imgs = await YunzaiUtils.getImages(e, 1);
      if (!imgs?.length) return e.reply('未检测到图片..', true);
      cfg.image = imgs[0];
      allCfg[groupId] = cfg;
      await configControl.set('newcomer', allCfg);
      return e.reply('欢迎图片设置成功!', true);
    }
  }

  async viewWelcome(e) {
    const groupId = e.group_id;
    const allCfg = configControl.get('newcomer') || {};
    const cfg = allCfg[groupId];

    if (!cfg) return e.reply('该群尚未设置欢迎内容..', true);

    const msg = [`当前欢迎: `];
    if (cfg.text) msg.push(cfg.text);
    if (cfg.image) msg.push(segment.image(cfg.image));
    await e.reply(msg);
  }

  async clearWelcome(e) {
    if (!(e.isMaster || ['owner', 'admin'].includes(e.sender?.role))) {
      return e.reply('只有群主或管理员可以设置欢迎消息哦~', true);
    }
    const groupId = e.group_id;
    const allCfg = configControl.get('newcomer') || {};
    if (!allCfg[groupId]) return e.reply('该群没有设置欢迎消息..', true);
    delete allCfg[groupId];
    await configControl.set('newcomer', allCfg);
    return e.reply(`已清除群${groupId}的欢迎设置..`, true);
  }
}
