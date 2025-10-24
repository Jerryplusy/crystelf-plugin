import ConfigControl from '../lib/config/configControl.js';

export default class SixSecond extends plugin {
  constructor() {
    super({
      name: '60s',
      dsc: '60api,获取天下事',
      event: 'message',
      priority: -200,
      rule: [
        {
          reg: '^(#|/)?60s|(#|/)?早报$',
          fnc: 'six',
        },
      ],
    });
  }

  async six(e) {
    const url = `${ConfigControl.get('60s')?.url}/v2/60s?encoding=image&force-update=true`;
    return e.reply(segment.image(url), true);
  }
}
