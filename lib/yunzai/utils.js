export default class YunzaiUtils {
  /**
   * 获取消息中的图片
   * @param e
   * @param limit 限制
   * @param limited 是否只返回引用或发送图片
   * @returns {Promise<string[]>}
   */
  static async getImages(e, limit = 1,limited = false) {
    let imgUrls = [];
    const me = `https://q1.qlogo.cn/g?b=qq&s=640&nk=${e.user_id}`;

    // 获取引用消息
    if (e.source || e.reply_id) {
      let reply;
      if (e.getReply) reply = await e.getReply();
      else {
        const history = await (e.isGroup ? e.group : e.friend).getChatHistory(
          e.isGroup ? e.source.seq : e.source.time,
          1
        );
        reply = history?.pop();
      }

      if (reply) {
        const msgArr = Array.isArray(reply) ? reply : reply.message || [];
        imgUrls = msgArr.filter((m) => m.type === 'image').map((m) => m.url);
      }
    }
    if (!imgUrls.length && e.message) {
      imgUrls = e.message.filter((m) => m.type === 'image').map((m) => m.url);
    }
    if (!imgUrls.length && !limited) imgUrls = [me];
    if(imgUrls.length === 0) return null;
    return imgUrls.slice(0, limit);
  }

  /**
   * 看看使用的是哪个适配器
   * @param e
   * @returns {Promise<*>}
   */
  static async getAdapter(e) {
    const adapter = e.bot.version?.app_name;
    if (adapter === 'NapCat.Onebot') {
      return 'nc';
    } else if (adapter === 'Lagrange.OneBot') {
      return 'lgr';
    } else return 'nc';
  }
}
