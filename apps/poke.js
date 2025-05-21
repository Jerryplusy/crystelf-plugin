import cfg from '../../../lib/config/config.js';
import tool from '../components/tool.js';
import axios from 'axios';
import configControl from '../lib/config/configControl.js';

const replyText = 0.4;
const replyVoice = 0.2;
const mutePick = 0.1;
const pai = 0.1;

export default class pockpock extends plugin {
  constructor() {
    super({
      name: '戳一戳',
      dsc: '喜欢戳鸡气人',
      event: 'notice.group.poke',
      priority: -114510,
      rule: [
        {
          fnc: '11111',
        },
      ],
    });
  }

  async chuoyichuo(e) {}
}

async function pokeMaster(e) {
  logger.info('谁戳主人了..');
  if (cfg.masterQQ.includes(e.operator_id) || e.self_id === e.operator_id) {
    return;
  }
  e.reply(`你几把谁啊，敢戳我亲爱的主人，胆子好大啊你🤚😡🤚`);
  await tool.sleep(1000);
  e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.operator_id });
  return true;
}

async function masterPoke(e) {
  logger.info(`跟主人一起戳！`);
  e.bot.sendApi('group_poke', { group_id: this.e.group_id, user_id: e.target_id });
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
      return await e.reply(`戳一戳出错了!${configControl.get('nickName')}不知道要说啥好了..`);
    }
  }
}

function cleanText(inputText) {
  //保留逗号、句号、感叹号、问号，及字母和数字
  return inputText.replace(/[^\w\s,.!?]/g, '');
}
