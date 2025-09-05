import cfg from '../../../lib/config/config.js';
import tool from '../components/tool.js';
import axios from 'axios';
import configControl from '../lib/config/configControl.js';

const replyPoke = configControl.get('poke')?.replyPoke;
const nickName = configControl.get('profile')?.nickName;

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
    if (cfg.masterQQ.includes(e.target_id) && e.operator_id !== e.target_id) {
      return await pokeMaster(e);
    }

    if (cfg.masterQQ.includes(e.operator_id)) {
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
  await e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
  return true;
}

async function masterPoke(e) {
  logger.info(`跟主人一起戳!`);
  if (e.target_id !== e.uin) {
    await e.bot.sendApi('group_poke', {
      group_id: e.group_id,
      user_id: e.target_id,
    });
  }
  return true;
}

async function handleBotPoke(e) {
  try {
    const coreUrl = configControl.get(`coreConfig`)?.coreUrl;
    const targetUrl = `${coreUrl}/api/words/getText`;
    const res = await axios.post(targetUrl, {
      type: 'poke',
      id: 'poke',
      name: nickName,
    });
    if (res.data.success) {
      await e.reply(res.data.data, false, 110);
      if (Math.random() < replyPoke) {
        await tool.sleep(1000);
        await e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
      }
    } else {
      await e.reply(
        `戳一戳出错了!${configControl.get('profile')?.nickName}不知道该说啥好了..`,
        false,
        { recallMsg: 60 }
      );
    }
  } catch (err) {
    logger.error('戳一戳请求失败', err);
    await e.reply(
      `戳一戳出错了!${configControl.get('profile')?.nickName}不知道该说啥好了..`,
      false,
      { recallMsg: 60 }
    );
  }
}
