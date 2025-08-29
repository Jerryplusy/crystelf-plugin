let tools = {
  /**
   * 延时函数
   * @param {number} ms - 等待的毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * 生成指定范围内的随机整数
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};

export default tools;
