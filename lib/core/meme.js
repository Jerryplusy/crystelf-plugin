const Meme = {
  /**
   * core 表情 API 已下线依赖，暂不提供远程表情。
   * @param character 角色
   * @param status 状态
   * @returns {Promise<null>}
   */
  async getMeme(character, status) {
    globalThis.logger?.warn?.(`[crystelf-plugin] 表情 API 已停用: character=${character}, status=${status}`);
    return null;
  },
};

export default Meme;
