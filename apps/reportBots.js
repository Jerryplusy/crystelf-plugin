import botControl from '../lib/core/botControl.js';
import configControl from '../lib/config/configControl.js';
import schedule from 'node-schedule';

export default class ReportBots extends plugin {
  constructor() {
    super({
      name: 'crystelf Bot状态上报',
      dsc: '一些操作bot的功能',
      rule: [
        {
          reg: '^#crystelf同步$',
          fnc: 'manualReport',
          permission: 'master',
        } /*,
        {
          reg: '^#crystelf广播(.+)$',
          fnc: 'broadcast',
          permission: 'master',
        },*/,
      ],
    });
    schedule.scheduleJob('*/30 * * * *', () => this.autoReport());
  }

  async autoReport() {
    logger.mark(`正在自动同步bot数据到晶灵核心..`);
    if (configControl.get('core')) {
      await botControl.reportBots();
    }
  }

  async manualReport(e) {
    if (!configControl.get('core')) {
      return e.reply(`晶灵核心未启用..`, true);
    }
    let success = await botControl.reportBots();
    if (success) {
      e.reply('crystelf Bot信息已同步到核心..', true);
    } else {
      e.reply('crystelf Bot同步失败：核心未连接..', true);
    }
  }
}
