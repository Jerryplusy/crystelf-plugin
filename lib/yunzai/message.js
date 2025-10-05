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
};
export default Message;
