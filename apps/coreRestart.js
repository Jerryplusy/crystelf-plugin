import systemControl from '../lib/core/systemControl.js';
import tools from '../components/tool.js';

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
    const returnData = await systemControl.systemRestart();
    if (returnData?.data?.success) {
      e.reply(`操作成功:${returnData?.data?.data}..`);
    } else {
      e.reply(`操作失败:${returnData?.data?.data}..`);
    }
    await tools.sleep(8000);
    const restartTime = await systemControl.getRestartTime();
    if (restartTime) {
      e.reply(`晶灵核心重启成功！耗时${restartTime?.data?.data}秒..`);
    } else {
      e.reply(`核心重启花的时间有点久了呢..${restartTime?.data?.data}`);
    }
  }
}
