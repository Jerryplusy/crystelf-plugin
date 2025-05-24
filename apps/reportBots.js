import botControl from '../lib/core/botControl.js';
import configControl from '../lib/config/configControl.js';
import schedule from 'node-schedule';
import axios from 'axios';

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
      await e.reply('crystelf Bot信息已同步到核心..', true);
    } else {
      await e.reply('crystelf Bot同步失败：核心未连接..', true);
    }
  }

  async broadcast(e) {
    const msg = e?.msg?.match(/^#crystelf广播(.+)$/)?.[1]?.trim();
    if (!msg) {
      return e.reply('广播内容不能为空');
    }
    await e.reply(`开始广播消息到所有群..`);
    try {
      const sendData = {
        token: configControl.get('coreConfig')?.token,
        message: msg.toString(),
      };
      const url = configControl.get('coreConfig')?.coreUrl;
      const returnData = await axios.post(url, sendData);
      if (returnData?.success) {
        return await e.reply(`操作成功:${returnData?.data.toString()}`);
      } else {
        return await e.reply(`广播出现错误，请检查日志..`);
      }
    } catch (err) {
      logger.error(`广播执行异常: ${err.message}`);
      return await e.reply('广播过程中发生错误，请检查日志..');
    }
  }
}
