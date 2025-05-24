import cfg from '../../../lib/config/config.js';
import tool from '../components/tool.js';
import axios from 'axios';
import configControl from '../lib/config/configControl.js';

const replyText = configControl.get('poke')?.replyText;
const replyVoice = configControl.get('poke')?.replyVoice;
const mutePick = configControl.get('poke')?.mutePick;
const muteTime = configControl.get('poke')?.muteTime;

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
  logger.info('谁戳主人了...');
  if (cfg.masterQQ.includes(e.operator_id) || e.self_id === e.operator_id) {
    return;
  }
  await e.reply(`你几把谁啊，敢戳我主人，胆子好大啊你🤚😡🤚`);
  await tool.sleep(1000);
  await e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
  return true;
}

async function masterPoke(e) {
  logger.info(`跟主人一起戳！`);
  if (e.target_id !== e.uin) {
    await e.bot.sendApi('group_poke', {
      group_id: e.group_id,
      user_id: e.target_id,
    });
  }
  return true;
}

async function handleBotPoke(e) {
  const randomNum = Math.random();

  if (randomNum < replyText) {
    try {
      const res = await axios.get(
        `${configControl.get(`coreConfig`)?.coreUrl}/api/words/getText/poke`
      );
      if (res.data?.success) {
        return await e.reply(res.data.data);
      } else {
        return await e.reply(`戳一戳出错了!${configControl.get('nickName')}不知道该说啥好了..`);
      }
    } catch (err) {
      logger.error('戳一戳请求失败', err);
      return await e.reply(`戳一戳出错了!${configControl.get('nickName')}不知道该说啥好了..`);
    }
  }

  if (randomNum < replyText + replyVoice) {
    try {
      const res = await axios.get(
        `${configControl.get(`coreConfig`)?.coreUrl}/api/words/getText/poke`
      );
      if (res.data?.success) {
        let message = cleanText(res.data.data.toString());
        logger.info(message);
        return await e.bot.sendApi('get_ai_record', {
          group_id: e.group_id,
          character: 'lucy-voice-hoige',
          text: message,
        });
      }
    } catch (err) {
      logger.error('语音生成失败', err);
      return await e.reply(`戳一戳出错了!${configControl.get('nickName')}不知道该说啥好了..`);
    }
  }

  if (randomNum < replyText + replyVoice + mutePick) {
    let mutetype = Math.ceil(Math.random() * 4);

    const botInfo = await e.bot.getGroupMemberInfo(e.group_id, e.bot.uin);
    const isAdmin = botInfo.role === 'admin' || botInfo.role === 'owner';
    if (!isAdmin) mutetype = 5;

    switch (mutetype) {
      case 1:
        await e.reply('我生气了！砸挖撸多!木大！木大木大！');
        await tool.sleep(1000);
        return await tryMute(e, 60 * muteTime);
      case 2:
        await e.reply('不！！');
        await tool.sleep(1000);
        await e.reply('准！！');
        await tool.sleep(1000);
        await e.reply('戳！！');
        await tool.sleep(1000);
        await tryMute(e, 60 * muteTime);
        await tool.sleep(1000);
        return await e.reply('！！');
      case 3:
        await e.reply('吃我10068拳！');
        await tool.sleep(1000);
        await e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
        await tryMute(e, 60 * muteTime);
        return;
      case 4:
        await e.reply('哼，我可是会还手的哦——');
        await tool.sleep(1000);
        await e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
        return await tryMute(e, 60 * muteTime);
      case 5:
        await e.reply('哼，要不是我不是管理，早🈲盐你了！');
        await tool.sleep(1000);
        return await e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
    }
  }

  // 普通 poke 回复
  const returnType = Math.round(Math.random() * 3);
  const replies = [
    '吃我一拳喵！',
    '你刚刚是不是戳我了，你是坏蛋！我要戳回去，哼！！！',
    '是不是要本萝莉揍你一顿才开心啊！！！',
  ];
  if (replies[returnType]) {
    await e.reply(replies[returnType]);
    await tool.sleep(1000);
    return await e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
  }
}

function cleanText(inputText) {
  return inputText.replace(/[^\w\s,.!?]/g, '');
}

async function tryMute(e, duration) {
  try {
    await e.group.muteMember(e.operator_id, duration);
  } catch (err) {
    logger.warn(`禁言失败: ${err}`);
    await e.reply('气死我了！禁言不了你');
  }
}
