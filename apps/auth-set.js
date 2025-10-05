import configControl from '../lib/config/configControl.js';
import ConfigControl from '../lib/config/configControl.js';

export class carbonAuthSetting extends plugin {
  constructor() {
    super({
      name: 'carbonAuth-setting',
      dsc: '手性碳验证设置',
      event: 'message.group',
      priority: -1000,
      rule: [
        { reg: '^#开启验证$', fnc: 'enableAuth' },
        { reg: '^#关闭验证$', fnc: 'disableAuth' },
        { reg: '^#切换验证模式$', fnc: 'switchMode' },
        { reg: '^#设置验证(提示|困难)模式(开启|关闭)$', fnc: 'setCarbonMode' },
        { reg: '^#设置验证次数(\\d+)$', fnc: 'setFrequency' },
        { reg: '^#设置撤回(开启|关闭)$', fnc: 'setRecall' },
      ],
    });
  }

  //获取奇妙的配置
  async _getCfg(e) {
    const cfg = (await configControl.get('auth')) || {};
    const groupCfg = cfg.groups[e.group_id] || JSON.parse(JSON.stringify(cfg.default));
    return { cfg, groupCfg };
  }

  //保存奇妙的配置
  async _saveCfg(e, cfg, groupCfg) {
    cfg.groups[e.group_id] = groupCfg;
    await configControl.set('auth', cfg);
  }

  //在制定群开启验证
  async enableAuth(e) {
    if (!(e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))
      return e.reply('只有群主或管理员可以设置验证..', true);
    const botMember = await e.group?.pickMember?.(e.bot.uin);
    const info = await botMember?.getInfo();
    if (info.role !== 'admin' || info.role !== 'owner') {
      return e.reply(`${ConfigControl.get('profile')?.nickName}不是管理,没法帮你验证啦..`, true);
    }
    const { cfg, groupCfg } = await this._getCfg(e);
    groupCfg.enable = true;
    await this._saveCfg(e, cfg, groupCfg);
    return e.reply('本群已开启入群验证,验证模式为数字验证..', true);
  }

  async disableAuth(e) {
    if (!(e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))
      return e.reply('只有群主或管理员可以设置验证..', true);
    const { cfg, groupCfg } = await this._getCfg(e);
    groupCfg.enable = false;
    await this._saveCfg(e, cfg, groupCfg);
    return e.reply('已关闭本群新人验证..', true);
  }

  async switchMode(e) {
    if (!(e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))
      return e.reply('只有群主或管理员可以设置验证..', true);
    const { cfg, groupCfg } = await this._getCfg(e);
    groupCfg.carbon.enable = !groupCfg.carbon.enable;
    await this._saveCfg(e, cfg, groupCfg);
    return e.reply(
      groupCfg.carbon.enable ? '已切换为手性碳验证模式..' : '已切换为数字验证模式..',
      true
    );
  }

  async setCarbonMode(e) {
    if (!(e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))
      return e.reply('只有群主或管理员可以设置验证..', true);
    const [, type, state] = e.msg.match(/^#设置验证(提示|困难)模式(开启|关闭)$/);
    const { cfg, groupCfg } = await this._getCfg(e);
    if (type === '提示') groupCfg.carbon.hint = state === '开启';
    if (type === '困难') groupCfg.carbon['hard-mode'] = state === '开启';
    await this._saveCfg(e, cfg, groupCfg);
    return e.reply(`已${state}手性碳${type}模式..`, true);
  }

  async setFrequency(e) {
    if (!(e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))
      return e.reply('只有群主或管理员可以设置验证..', true);
    const [, num] = e.msg.match(/^#设置验证次数(\d+)$/);
    const { cfg, groupCfg } = await this._getCfg(e);
    groupCfg.frequency = parseInt(num);
    await this._saveCfg(e, cfg, groupCfg);
    return e.reply(`已将最大尝试次数设置为 ${num}..`, true);
  }

  async setRecall(e) {
    if (!(e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))
      return e.reply('只有群主或管理员可以设置验证..', true);
    const [, state] = e.msg.match(/^#设置撤回(开启|关闭)$/);
    const { cfg, groupCfg } = await this._getCfg(e);
    groupCfg.recall = state === '开启';
    await this._saveCfg(e, cfg, groupCfg);
    return e.reply(`已${state}错误回答自动撤回功能..`, true);
  }
}
