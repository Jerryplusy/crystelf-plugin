let tools = {
  /**
   * 延时函数
   * @param {number} ms - 等待的毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

export default tools;
