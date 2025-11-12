import { segment } from 'oicq';
import plugin from '../../../lib/plugins/plugin.js';
import {
  word10_list,
  word2_list,
  word3_list,
  word4_list,
  word5_list,
  word6_list,
  word7_list,
  word8_list,
  word9_list,
} from '../constants/zwa/wordlist.js';
import configControl from '../lib/config/configControl.js';
import axios from 'axios';
import ConfigControl from '../lib/config/configControl.js';

const path = process.cwd();
const getCurrentHour = () => new Date().getHours();
let wa = 'https://moe.jitsu.top/img';
let za = 'https://moe.jitsu.top/img';

export class ZWA extends plugin {
  constructor() {
    super({
      name: '早中晚安',
      dsc: 'zzw',
      event: 'message',
      priority: -1110,
      rule: [
        {
          reg: '^(#|/)?晚上好$|^(#|/)?安$|^(#|/)?晚安$|^(#|/)?睡了$|^(#|/)?睡觉$|^(#|/)?睡咯$',
          fnc: 'www',
        },
        {
          reg: '^(#|/)?早$|^(#|/)?早安$|^(#|/)?起床(了)$|^(#|/)?早上好$|^(#|/)?早上好！$|^(#|/)?早！$|^(#|/)?早啊$',
          fnc: 'zzz',
        },
      ],
    });
  }

  async www(e) {
    if (!ConfigControl.get()?.config?.zwa) {
      return;
    }
    const currentHour = getCurrentHour();
    if (currentHour >= 20 && currentHour <= 23) {
      if (e.isMaster) {
        let text_number = Math.ceil(Math.random() * word2_list['length']);
        setTimeout(async () => {
          e.reply([word2_list[text_number - 1], segment.image(wa)], true);
        });
      } else {
        try {
          const coreUrl = configControl.get(`coreConfig`)?.coreUrl;
          const targetUrl = `${coreUrl}/api/words/getText`;
          let response = await axios.post(targetUrl, {
            type: 'MN-hello',
            id: 'good-night',
          });
          await this.reply([response.data.data, segment.image(wa)], true);
        } catch (error) {
          logger.error(`[crystelf-plugin]早晚安出现错误：${error}`);
        }
      }
    } else if (currentHour >= 0 && currentHour <= 2) {
      if (e.isMaster) {
        let text_number = Math.ceil(Math.random() * word2_list['length']);
        setTimeout(async () => {
          e.reply([word2_list[text_number - 1], segment.image(wa)], true);
        });
      } else {
        try {
          const coreUrl = configControl.get(`coreConfig`)?.coreUrl;
          const targetUrl = `${coreUrl}/api/words/getText`;
          let response = await axios.post(targetUrl, {
            type: 'MN-hello',
            id: 'good-night',
          });
          await this.reply([response.data.data, segment.image(wa)], true);
        } catch (error) {
          logger.error(`[crystelf-plugin]早晚安出现错误：${error}`);
        }
      }
    } else if (currentHour >= 3 && currentHour < 7) {
      if (e.isMaster) {
        let text_number = Math.ceil(Math.random() * word7_list['length']);
        setTimeout(async () => {
          e.reply([word7_list[text_number - 1], segment.image(wa)], true);
        });
      } else {
        let text_number = Math.ceil(Math.random() * word8_list['length']);
        setTimeout(async () => {
          e.reply([word8_list[text_number - 1]], true);
        });
      }
    } else {
      let text_number = Math.ceil(Math.random() * word9_list['length']);
      setTimeout(async () => {
        e.reply([word9_list[text_number - 1]], true);
      });
    }
  }

  async zzz(e) {
    //logger.info(ConfigControl.get());
    if (!ConfigControl.get()?.config?.zwa) {
      return;
    }

    const currentHour = getCurrentHour();
    if (currentHour >= 0 && currentHour <= 4) {
      let text_number = Math.ceil(Math.random() * word4_list['length']);
      setTimeout(async () => {
        e.reply([word4_list[text_number - 1]], true);
      });
    } else if (currentHour >= 5 && currentHour <= 11) {
      if (e.isMaster) {
        let text_number = Math.ceil(Math.random() * word3_list['length']);
        setTimeout(async () => {
          e.reply([word3_list[text_number - 1], segment.image(wa)], true);
        });
      } else {
        try {
          const coreUrl = configControl.get(`coreConfig`)?.coreUrl;
          const targetUrl = `${coreUrl}/api/words/getText`;
          let response = await axios.post(targetUrl, {
            type: 'MN-hello',
            id: 'good-morning',
          });
          await this.reply([response.data.data, segment.image(wa)], true);
        } catch (error) {
          logger.error(`[crystelf-plugin]早晚安出现错误:${error}`);
        }
      }
    } else if (currentHour >= 12 && currentHour <= 18) {
      if (e.isMaster) {
        let text_number = Math.ceil(Math.random() * word10_list['length']);
        setTimeout(async () => {
          e.reply([word10_list[text_number - 1], segment.image(wa)], true);
        });
      } else {
        let text_number = Math.ceil(Math.random() * word5_list['length']);
        setTimeout(async () => {
          e.reply([word5_list[text_number - 1]], true);
        });
      }
    } else {
      let text_number = Math.ceil(Math.random() * word6_list['length']);
      setTimeout(async () => {
        e.reply([word6_list[text_number - 1]], true);
      });
    }
  }
}
