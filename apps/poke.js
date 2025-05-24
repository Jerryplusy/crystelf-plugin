import cfg from '../../../lib/config/config.js';
import tool from '../components/tool.js';
import axios from 'axios';
import configControl from '../lib/config/configControl.js';

const replyText = configControl.get('poke')?.replyText;
const replyVoice = configControl.get('poke')?.replyVoice;
const mutePick = configControl.get('poke')?.mutePick;
const muteTime = configControl.get('poke')?.muteTime;

export default class pockpock extends plugin {
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
    if (cfg.masterQQ.includes(e.target_id)) {
      await pokeMaster(e);
    } else if (cfg.masterQQ.includes(e.operator_id)) {
      await masterPoke(e);
    } else if (e.target_id === e.self_id) {
      await chuochuo(e);
    }
  }
}

async function pokeMaster(e) {
  logger.info('谁戳主人了..');
  if (cfg.masterQQ.includes(e.operator_id) || e.self_id === e.operator_id) {
    return;
  }
  e.reply(`你几把谁啊，敢戳我主人，胆子好大啊你🤚😡🤚`);
  await tool.sleep(1000);
  e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.operator_id });
  return true;
}

async function masterPoke(e) {
  logger.info(`跟主人一起戳！`);
  e.bot.sendApi('group_poke', { group_id: e.group_id, user_id: e.target_id });
  return true;
}

async function chuochuo(e) {
  const randomNum = Math.random();
  if (randomNum < replyText) {
    const returnData = await axios.get(
      `${configControl.get(`coreConfig`)?.coreUrl}/api/words/getText/poke`
    );
    if (returnData?.success) {
      return await e.reply(returnData.data);
    } else {
      return await e.reply(`戳一戳出错了!${configControl.get('nickName')}不知道该说啥好了..`);
    }
  } else if (randomNum < replyText + replyVoice) {
    const returnData = await axios.get(
      `${configControl.get(`coreConfig`)?.coreUrl}/api/words/getText/poke`
    );
    if (returnData?.success) {
      let message = returnData?.data;
      message = cleanText(message);
      return await this.e.bot.sendApi('get_ai_record', {
        group_id: e.group_id,
        character: 'lucy-voice-hoige',
        text: message,
      });
    } else {
      return await e.reply(`戳一戳出错了!${configControl.get('nickName')}不知道该说啥好了..`);
    }
  } else if (randomNum < replyText + replyVoice + mutePick) {
    let mutetype = Math.ceil(Math.random() * 4);
    if (!Bot.pickMember(e.group_id, this.e.uin).getInfo()?.role === ('admin' || 'owner')) {
      mutetype = 5;
    }
    if (mutetype === 1) {
      e.reply('我生气了！砸挖撸多!木大！木大木大！');
      await tool.sleep(1000);
      await e.group.muteMember(e.operator_id, 60 * muteTime);
      return true;
    }
    if (mutetype === 2) {
      e.reply('不！！');
      await tool.sleep(1000);
      e.reply('准！！');
      await tool.sleep(1000);
      e.reply('戳！！');
      await tool.sleep(1000);
      await e.group.muteMember(e.operator_id, 60 * muteTime);
      await tool.sleep(1000);
      e.reply('！！');
      return true;
    }
    if (mutetype === 3) {
      e.reply('吃我10068拳！');
      await tool.sleep(1000);
      e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.operator_id });
      await e.group.muteMember(e.operator_id, 60 * muteTime);
      await tool.sleep(1000);
      return true;
    }
    if (mutetype === 4) {
      e.reply('哼，我可是会还手的哦——');
      await tool.sleep(1000);
      e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.operator_id });
      await e.group.muteMember(e.operator_id, 60 * muteTime);
      return true;
    }
    if (mutetype === 5) {
      e.reply('哼，要不是我不是管理，早🈲盐你了！');
      await tool.sleep(1000);
      e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.operator_id });
    }
  } else {
    const returnType = Math.round(Math.random() * 3);
    if (returnType === 1) {
      e.reply('吃我一拳喵！');
      await tool.sleep(1000);
      e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.operator_id });
      return true;
    } else if (returnType === 2) {
      e.reply('你刚刚是不是戳我了，你是坏蛋！我要戳回去，哼！！！');
      await tool.sleep(1000);
      await e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.operator_id });
      return true;
    } else if (returnType === 3) {
      e.reply('是不是要本萝莉揍你一顿才开心啊！！！');
      await tool.sleep(1000);
      await e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.operator_id });
      return true;
    }
  }
}

function cleanText(inputText) {
  //保留逗号、句号、感叹号、问号，及字母和数字
  return inputText.replace(/[^\w\s,.!?]/g, '');
}
