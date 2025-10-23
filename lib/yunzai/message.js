const Message = {
  /**
   * 群撤回消息
   * @param e
   * @param message_id 消息id
   * @returns {Promise<*>}
   */
  async deleteMsg(e, message_id) {
    return await e.bot.sendApi('delete_msg', {
      message_id: message_id,
    });
  },

  /**
   * 群表情回应
   * @param e
   * @param message_id 消息id
   * @param emoji_id 表情id
   * @param group_id 群号
   * @param adapter nc/lgr
   * @returns {Promise<*>}
   */
  async emojiLike(e, message_id, emoji_id, group_id, adapter) {
    if (adapter === 'nc') {
      return await e.bot.sendApi('set_msg_emoji_like', {
        message_id: message_id,
        emoji_id: emoji_id,
        set: true,
      });
    } else if (adapter === 'lgr') {
      return await e.bot.sendApi('set_group_reaction', {
        group_id: group_id,
        message_id: message_id,
        code: emoji_id,
        is_add: true,
      });
    }
  },

  /**
   * 获取群聊聊天历史记录
   * @param e
   * @param group_id
   * @param message_seq seq
   * @param count 数量
   * @param reverseOrder 倒序
   * @param adapter 适配器
   * @returns {Promise<*>}
   */
  async getGroupHistory(e,group_id,message_seq,count = 20,reverseOrder = false,adapter = 'nc'){
    if(adapter === 'nc') {
      return await e.bot.sendApi('get_group_msg_history', {
        group_id: group_id,
        message_seq: message_seq,
        count: count,
        reverseOrder: reverseOrder,
      })
    } else if (adapter === 'lgr') {
      return await e.bot.sendApi('get_group_msg_history', {
        group_id: group_id,
        message_id:message_seq,
        count: count,
      })
    }
  }
};
export default Message;
