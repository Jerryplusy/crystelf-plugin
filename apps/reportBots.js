import botControl from '../lib/core/botControl.js';

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
        },
        {
          reg: '^#crystelf广播(.+)$',
          fnc: 'broadcast',
          permission: 'master',
        },
      ],
      task: [
        {
          name: 'crystelf定时同步',
          corn: '*/30 * * * *',
          fnc: () => this.autoReport(),
        },
      ],
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

  async broadcast(e) {
    const msg = e?.msg?.match(/^#crystelf广播(.+)$/)?.[1]?.trim();
    if (!msg) {
      return e.reply('广播内容不能为空');
    }

    e.reply(`开始广播消息到所有群（内容：${msg}）..`);

    try {
      await botControl.broadcastMessage(msg);
    } catch (err) {
      logger.error(`广播执行异常: ${err.message}`);
      return e.reply('广播过程中发生错误，请检查日志..');
    }
  }
}
