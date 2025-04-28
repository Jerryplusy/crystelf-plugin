import botControl from '../lib/core/botControl.js';

export default class ReportBots extends plugin {
  constructor() {
    super({
      name: 'crystelf Bot状态上报',
      dsc: '定时上报botID和群聊列表',
      rule: [
        {
          reg: '^#crystelf同步$',
          fnc: 'manualReport',
          permission: 'master',
        },
      ],
      task: {
        name: 'crystelf定时同步',
        corn: '0 */30 * * * *',
        fnc: 'autoReport',
      },
    });
  }

  async autoReport() {
    await botControl.reportBots();
  }

  async manualReport(e) {
    let success = await botControl.reportBots();
    if (success) {
      e.reply('crystelf Bot信息已同步到核心..');
    } else {
      e.reply('crystelf Bot同步失败：核心未连接..');
    }
  }
}
