const Group = {
  /**
   * 群戳一戳
   * @param e
   * @param user_id 被戳的用户
   * @param group_id 群号
   * @returns {Promise<*>}
   */
  async groupPoke(e, user_id, group_id) {
    return await e.bot.sendApi('group_poke', {
      group_id: group_id,
      user_id: user_id,
    });
  },

  /**
   * 群踢人
   * @param e
   * @param user_id 要踢的人
   * @param group_id 群号
   * @param ban 是否允许再次加群
   * @returns {Promise<*>}
   */
  async groupKick(e, user_id, group_id, ban) {
    return await e.bot.sendApi('set_group_kick', {
      user_id: user_id,
      group_id: group_id,
      reject_add_request: ban,
    });
  },

  /**
   * 发送群语音
   * @param e
   * @param group_id
   * @param file 本地文件：file://,网络文件:https://
   * @param adapter nc/lgr
   * @returns {Promise<void>}
   */
  async sendGroupRecord(e,group_id,file,adapter='nc'){
    if(adapter==='nc'){
      return await e.bot.sendApi('send_group_msg',{
        group_id:group_id,
        message: [
          {
            type: "record",
            data: {
              file : file,
            }
          }
        ]
      })
    } else if(adapter === 'lgr'){
      return await e.bot.sendApi('send_group_msg',{
        group_id: group_id,
        message:{
          type: "dict",
          data:{
            file:file
          }
        }
      })
    }
  },

  /**
   * 发送群文件
   * @param e
   * @param group_id
   * @param file file://
   * @param name 文件名
   * @param adapter nc/lgr
   * @returns {Promise<void>}
   */
  async sendGroupFile(e,group_id,file,name,adapter='nc'){
    if(adapter==='nc'){
      return await e.bot.sendApi('upload_group_file',{
        group_id: group_id,
        file: file,
        name: name
      })
    }
    else if(adapter==='lgr'){
      return await e.bot.sendApi('upload_group_file',{
        group_id:group_id,
        file:file,
        name:name
      })
    }
  }
};
export default Group;
