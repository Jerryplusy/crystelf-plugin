let tools = {
  /**
   * 异步延时函数
   * @param {number} ms - 等待的毫秒数
   * @returns {Promise<void>}
   * @example
   * await fc.sleep(1000) // 等待1秒
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * 生成指定范围内的随机整数
   * @param {number} min - 最小值（包含）
   * @param {number} max - 最大值（包含）
   * @returns {number} 范围内的随机整数
   * @example
   * const randomNum = fc.randomInt(1, 10) // 可能返回 5
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * 防抖函数
   * @param {Function} fn - 要执行的函数
   * @param {number} [delay=300] - 延迟时间（毫秒）
   * @param {boolean} [immediate=false] - 是否立即执行
   * @returns {Function} 防抖处理后的函数
   * @description
   * 1. immediate=true时：先立即执行，后续调用在delay时间内被忽略
   * 2. immediate=false时：延迟执行，重复调用会重置计时器
   * @example
   * window.addEventListener('resize', fc.debounce(() => {
   *   console.log('resize end');
   * }, 500));
   */
  debounce(fn, delay = 300, immediate = false) {
    let timer = null;
    return function (...args) {
      if (immediate && !timer) {
        fn.apply(this, args);
      }

      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!immediate) {
          fn.apply(this, args);
        }
        timer = null;
      }, delay);
    };
  },

  /**
   * 异步重试机制
   * @param {Function} asyncFn - 返回Promise的异步函数
   * @param {number} [maxRetries=3] - 最大重试次数
   * @param {number} [delay=1000] - 重试间隔（毫秒）
   * @param {Function} [retryCondition] - 重试条件函数(err => boolean)
   * @returns {Promise} 最终成功或失败的结果
   * @example
   * await fc.retry(fetchData, 5, 2000, err => err.status !== 404);
   */
  async retry(asyncFn, maxRetries = 3, delay = 1000, retryCondition = () => true) {
    let attempt = 0;
    let lastError;

    while (attempt <= maxRetries) {
      try {
        return await asyncFn();
      } catch (err) {
        lastError = err;
        if (attempt === maxRetries || !retryCondition(err)) {
          break;
        }
        attempt++;
        await this.sleep(delay);
      }
    }

    throw lastError;
  },

  /**
   * 将对象转换为URL查询字符串
   * @param {object} params - 参数对象
   * @param {boolean} [encode=true] - 是否进行URL编码
   * @returns {string} 查询字符串（不带问号）
   * @example
   * fc.objectToQuery({a: 1, b: 'test'}) // "a=1&b=test"
   */
  objectToQuery(params, encode = true) {
    return Object.entries(params)
      .map(([key, val]) => {
        const value = val === null || val === undefined ? '' : val;
        return `${key}=${encode ? encodeURIComponent(value) : value}`;
      })
      .join('&');
  },

  /**
   * 从错误堆栈中提取简洁的错误信息
   * @param {Error} error - 错误对象
   * @param {number} [depth=3] - 保留的堆栈深度
   * @returns {string} 格式化后的错误信息
   * @example
   * try { ... } catch(err) {
   *   logger.error(fc.formatError(err));
   * }
   */
  formatError(error, depth = 3) {
    if (!(error instanceof Error)) return String(error);

    const stack = error.stack?.split('\n') || [];
    const message = `${error.name}: ${error.message}`;

    if (stack.length <= 1) return message;

    return [message, ...stack.slice(1, depth + 1).map((line) => line.trim())].join('\n    at ');
  },
};

export default tools;
