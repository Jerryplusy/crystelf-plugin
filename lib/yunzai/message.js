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
  async emojiLike(e, message_id, emoji_id, group_id, adapter = 'nc') {
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
  },

  /**
   * 发送群聊消息
   * @param e
   * @param group_id 群号
   * @param message 消息内容字符串
   * @param at -1 不@ 其他 被@的qq号
   * @param quote_seq -1 不引用 其他 引用的消息seq
   * @param adapter nc/lgr
   * @returns {Promise<*>}
   */
  async sendGroupMessage(e,group_id,message,at = -1,quote_seq = -1,adapter = 'nc'){
    if(adapter === 'nc') {
      const msgChain = [];
      if (typeof quote_seq !== 'boolean' && quote_seq !== -1 && quote_seq !== undefined) {
        msgChain.push({
          type: "reply",
          data: {
            "id": quote_seq
          }
        });
      }
      if (at && at !== -1) {
        msgChain.push({
          type: "at",
          data: {
            "qq": at
          }
        });
      }
      msgChain.push({
        type: "text",
        data: {
          "text": message
        }
      });
      return await e.bot.sendApi('send_group_msg',{
        group_id : group_id,
        message: msgChain
      })
    } else if (adapter === 'lgr') {
      const messageData = {};
      if(quote_seq && quote_seq !== -1) {
        messageData.reply = {
          type: "reply",
          data: {
            "id": quote_seq
          }
        };
      }
      if(at && at !== -1) {
        messageData.at = {
          type: "at",
          data: {
            "qq": at
          }
        };
      }
      messageData.text = {
        type: "text",
        data: {
          "text": message
        }
      };
      return await e.bot.sendApi('send_group_msg',{
        group_id: group_id,
        message :{
          type: "dict",
          data : messageData
        }
      })
    }
  }
};
export default Message;
