let date = {
  /**
   * 格式化日期时间
   * @param {Date|number|string} [date=new Date()] - 可接收Date对象、时间戳或日期字符串
   * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - 格式模板，支持：
   *                           YYYY-年, MM-月, DD-日,
   *                           HH-时, mm-分, ss-秒
   * @returns {string} 格式化后的日期字符串
   * @example
   * fc.formatDate(new Date(), 'YYYY年MM月DD日') // "2023年08月15日"
   */
  formatDate(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, '0');

    return format
      .replace(/YYYY/g, pad(d.getFullYear()))
      .replace(/MM/g, pad(d.getMonth() + 1))
      .replace(/DD/g, pad(d.getDate()))
      .replace(/HH/g, pad(d.getHours()))
      .replace(/mm/g, pad(d.getMinutes()))
      .replace(/ss/g, pad(d.getSeconds()));
  },

  formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return (
      [
        days > 0 ? `${days}天` : '',
        hours > 0 ? `${hours}小时` : '',
        mins > 0 ? `${mins}分钟` : '',
        secs > 0 ? `${secs}秒` : '',
      ]
        .filter(Boolean)
        .join(' ') || '0秒'
    );
  },
};

export default date;
