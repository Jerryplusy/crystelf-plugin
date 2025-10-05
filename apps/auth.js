import configControl from '../lib/config/configControl.js';
import axios from 'axios';
import tools from '../components/tool.js';
import Group from '../lib/yunzai/group.js';
import Message from '../lib/yunzai/message.js';

export class CarbonAuth extends plugin {
  constructor() {
    super({
      name: 'carbon-auth',
      dsc: '手性碳验证',
      event: 'message.group',
      priority: -114514,
      rule: [
        { reg: '^#绕过验证([\\s\\S]*)?$', fnc: 'cmdBypass' },
        { reg: '^#重新验证([\\s\\S]*)?$', fnc: 'cmdRevalidate' },
      ],
    });
    this.pending = new Map();

    //答案监听
    Bot.on?.('message.group', async (e) => {
      const key = `${e.group_id}_${e.user_id}`;
      //logger.info(key);
      const session = this.pending.get(key);
      if (!session) return;
      session.tries++;
      const { type, answer, tries, cfg } = session;

      const pass = async () => {
        this.pending.delete(key);
        const redisKey = `Yz:pendingWelcome:${e.group_id}:${e.user_id}`;
        const cached = await redis.get(redisKey);
        if (cached) {
          try {
            const msgList = JSON.parse(cached);
            await e.reply(msgList);
          } finally {
            await redis.del(redisKey);
          }
        } else {
          return await e.reply('验证通过,欢迎加入本群~', true);
        }
      };

      if (type === 'math') {
        const msgStr = (e.message || [])
          .filter((m) => m.type === 'text')
          .map((m) => m.text)
          .join('')
          .trim();
        const num = parseInt(msgStr, 10);
        if (!isNaN(num) && num === answer) return pass();
        if (tries >= cfg.frequency) {
          this.pending.delete(key);
          if (cfg.recall) await Message.deleteMsg(e, e.message_id);
          e.reply([segment.at(e.user_id), '验证失败,你错太多次辣!'], true);
          return await Group.groupKick(e, e.user_id, e.group_id, false);
        }
        if (cfg.recall) await Message.deleteMsg(e, e.message_id);
        return e.reply(
          [segment.at(e.user_id), `回答错了呢,你还有${cfg.frequency - tries}次机会,再试试看?`],
          true
        );
      }

      if (type === 'carbon') {
        const msgStr = (e.message || [])
          .filter((m) => m.type === 'text')
          .map((m) => m.text)
          .join('');
        const msgRegions = msgStr
          .toUpperCase()
          .replace(/，/g, ',')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const rightRegions = answer.map((r) => r.toUpperCase());

        let correct;
        if (cfg.carbon['hard-mode']) {
          correct = rightRegions.every((r) => msgRegions.includes(r));
        } else {
          correct = rightRegions.some((r) => msgRegions.includes(r));
        }

        if (correct) return pass();
        if (tries >= cfg.frequency) {
          if (cfg.recall) await Message.deleteMsg(e, e.message_id);
          this.pending.delete(key);
          e.reply([segment.at(e.user_id), '验证失败,你错太多次辣!'], true);
          return await Group.groupKick(e, e.user_id, e.group_id, false);
        }
        if (cfg.recall) await Message.deleteMsg(e, e.message_id);
        return e.reply(
          [segment.at(e.user_id), `回答错了呢,你还有${cfg.frequency - tries}次机会,再试试看?`],
          true
        );
      }
    });

    //主动退群
    Bot.on?.('notice.group.decrease', async (e) => {
      const key = `${e.group_id}_${e.user_id}`;
      if (this.pending.has(key)) {
        this.pending.delete(key);
        logger.mark(`[crystelf-plugin] 用户 ${e.user_id} 主动退群，验证流程结束..`);
        e.reply('害,怎么跑路了');
      }
    });

    //加群事件
    Bot.on?.('notice.group.increase', async (e) => {
      if (e.isMaster) return true;
      const key = `${e.group_id}_${e.user_id}`;
      if (this.pending.get(key)) return true;
      await this.auth(e, e.group_id, e.user_id);
    });
  }

  /**
   * 验证
   * @param e 事件
   * @param group_id 群号
   * @param user_id 带验证用户id
   * @returns {Promise<*>}
   */
  async auth(e, group_id, user_id) {
    const cfg = await configControl.get('auth');
    if (!cfg) return;
    const groupCfg = cfg.groups[group_id] || cfg.default;
    if (!groupCfg.enable) return;
    const key = `${group_id}_${user_id}`;
    this.pending.set(key, 1); //初始化
    if (groupCfg.carbon.enable) {
      try {
        const res = await axios.post(`${cfg.url}/captcha/chiralCarbon/getChiralCarbonCaptcha`, {
          answer: true,
          hint: groupCfg.carbon.hint,
        });
        if (!res.data?.data?.data) return e.reply('获取验证图失败，请稍后重试..');
        const { base64, regions } = res.data.data.data;
        const regionCount = regions.length;
        this.pending.set(key, { type: 'carbon', answer: regions, tries: 0, cfg: groupCfg });
        e.reply([
          segment.at(user_id),
          segment.image(base64),
          `上图中有一块或多块区域含有手性碳原子\n为了加入本群,你需要在${groupCfg.timeout}秒内正确找出${groupCfg.carbon['hard-mode'] ? '全部含有手性碳的区域' : '其中任意一块包含手性碳的区域'}\n回答的话,直接回复区域代号即可,多个区域用逗号隔开\n提示一下,本图共有${regionCount}块手性碳区域噢..`,
        ]);
      } catch (err) {
        logger.error('[crystelf-plugin] 请求手性碳验证API失败..', err);
      }
    } else {
      await tools.sleep(500);
      const a = Math.floor(Math.random() * 100);
      const b = Math.floor(Math.random() * 100);
      const op = Math.random() > 0.5 ? '+' : '-';
      const ans = op === '+' ? a + b : a - b;
      this.pending.set(key, { type: 'math', answer: ans, tries: 0, cfg: groupCfg });
      e.reply([segment.at(user_id), `请在${groupCfg.timeout}秒内发送${a} ${op} ${b}的计算结果..`]);
    }

    if (groupCfg.timeout > 60) {
      setTimeout(
        async () => {
          if (this.pending.has(key)) {
            await e.reply([segment.at(user_id), `小朋友,你还有1分钟的时间完成验证噢~`]);
          }
        },
        (groupCfg.timeout - 60) * 1000
      );
    }

    setTimeout(async () => {
      if (this.pending.has(key)) {
        this.pending.delete(key);
        await e.reply([segment.at(user_id), `小朋友,验证超时啦!请重新申请入群~`]);
        await Group.groupKick(e, e.user_id, e.group_id, false);
      }
    }, groupCfg.timeout * 1000);
  }

  async cmdBypass(e) {
    if (!(e.sender && (e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))) {
      return e.reply('只有群主或管理员可以使用此命令..', true);
    }
    const atElem = (e.message || []).find((m) => m.type === 'at');
    if (!atElem || !atElem.qq) return e.reply('你想绕过谁?', true);
    const targetId = Number(atElem.qq);
    const groupId = e.group_id;
    const key = `${groupId}_${targetId}`;
    if (this.pending.has(key)) this.pending.delete(key);
    const redisKey = `Yz:pendingWelcome:${groupId}:${targetId}`;
    const cached = await redis.get(redisKey);
    if (cached) {
      try {
        const msgList = JSON.parse(cached);
        await e.reply(msgList);
      } finally {
        await redis.del(redisKey);
      }
    } else {
      return await e.reply([segment.at(targetId), '欢迎加入本群~'], true);
    }
  }

  async cmdRevalidate(e) {
    if (!(e.sender && (e.sender.role === 'owner' || e.sender.role === 'admin' || e.isMaster))) {
      return e.reply('只有群主或管理员可以使用此命令..', true);
    }
    let atElem = (e.message || []).find((m) => m.type === 'at');
    if (!atElem || !atElem.qq) return e.reply('你要验证谁?', true);
    const targetId = Number(atElem.qq);
    const member = await e.group.pickMember(targetId).getInfo();
    if (member.role === 'owner' || member.role === 'admin') {
      return e.reply('这对吗', true);
    }
    const key = `${e.group_id}_${targetId}`;
    if (this.pending.get(key)) return e.reply('这孩子已经在验证了..', true);
    await this.auth(e, e.group_id, targetId);
  }
}
