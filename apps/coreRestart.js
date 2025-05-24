import systemControl from '../lib/core/systemControl.js';
import tools from '../components/tool.js';
import configControl from '../lib/config/configControl.js';

export default class CoreRestart extends plugin {
  constructor() {
    super({
      name: 'crystelf重启核心',
      dsc: '实现核心的重启功能',
      rule: [
        {
          reg: '^#core重启$',
          fnc: 'restart',
          permission: 'master',
        },
      ],
    });
  }

  async restart(e) {
    if (!configControl.get('core')) {
      return e.reply(`晶灵核心未启用..`, true);
    }
    const returnData = await systemControl.systemRestart();
    if (returnData?.data?.success) {
      await e.reply(`操作成功:${returnData?.data?.data}..`, true);
    } else {
      await e.reply(`操作失败:${returnData?.data?.data}..`, true);
    }
    await tools.sleep(8000);
    const restartTime = await systemControl.getRestartTime();
    if (restartTime) {
      await e.reply(`晶灵核心重启成功！耗时${restartTime?.data?.data}秒..`, true);
    } else {
      await e.reply(`核心重启花的时间有点久了呢..${restartTime?.data?.data}`, true);
    }
  }
}
