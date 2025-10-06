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
   * @returns {Promise<*>}
   */
  async emojiLike(e, message_id, emoji_id) {
    return await e.bot.sendApi('set_msg_emoji_like', {
      message_id: message_id,
      emoji_id: emoji_id,
      set: true,
    });
  },
};
export default Message;
