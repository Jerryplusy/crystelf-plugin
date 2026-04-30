import cfg from '../../../lib/config/config.js';
import tool from '../components/tool.js';
import configControl from '../lib/config/configControl.js';
import ConfigControl from '../lib/config/configControl.js';
import Words from '../lib/core/words.js';
import Group from '../lib/yunzai/group.js';

export default class ChuochuoPlugin extends plugin {
  constructor() {
    super({
      name: '戳一戳',
      dsc: '喜欢戳鸡气人',
      event: 'notice.group.poke',
      priority: -114510,
      rule: [
        {
          fnc: 'chuoyichuo',
        },
      ],
    });
  }

  async chuoyichuo(e) {
    if (!ConfigControl.get()?.config?.poke) {
      return;
    }

    if (cfg.masterQQ.includes(e.target_id) && e.operator_id !== e.target_id) {
      return await pokeMaster(e);
    }

    if (cfg.masterQQ.includes(e.operator_id) && e.target_id !== e.self_id) {
      return await masterPoke(e);
    }

    if (e.target_id === e.self_id) {
      return await handleBotPoke(e);
    }
  }
}

async function pokeMaster(e) {
  logger.info('谁戳主人了..');
  if (cfg.masterQQ.includes(e.operator_id) || e.self_id === e.operator_id) {
    return;
  }
  await e.reply(`小嘿子不许戳!`, false, { recallMsg: 60 });
  await tool.sleep(1000);
  await Group.groupPoke(e, e.operator_id, e.group_id);
  return true;
}

async function masterPoke(e) {
  if(e.target_id === e.self_id) return;
  logger.info(`跟主人一起戳!`);
  return await Group.groupPoke(e, e.target_id, e.group_id);
}

async function handleBotPoke(e) {
  try {
    const replyPoke = configControl.get('poke')?.replyPoke;
    const nickName = configControl.get('profile')?.nickName;
    const text = await Words.getWord('poke', 'poke', { name: nickName });

    await e.reply(text, false, 110);
    if (Math.random() < replyPoke) {
      await tool.sleep(1000);
      return await Group.groupPoke(e, e.operator_id, e.group_id);
    }
    return true;
  } catch (err) {
    logger.error('戳一戳请求失败', err);
    return await e.reply(
      `戳一戳出错了!${configControl.get('profile')?.nickName}不知道该说啥好了..`,
      false,
      { recallMsg: 60 }
    );
  }
}
