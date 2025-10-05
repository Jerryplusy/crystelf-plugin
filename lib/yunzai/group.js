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
};
export default Group;
