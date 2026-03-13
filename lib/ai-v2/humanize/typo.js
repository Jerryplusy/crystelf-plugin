class TypoGenerator {
  constructor(config) {
    this.config = config;
  }

  apply(text) {
    if (!this.config.typo?.enabled || !text) return text;

    const errorRate = Number(this.config.typo.errorRate || 0);
    const wordReplaceRate = Number(this.config.typo.wordReplaceRate || 0);
    const replacements = {
      的: '地',
      了: '啦',
      吗: '嘛',
      呢: '捏',
      吧: '叭',
    };

    const chars = [...text].map((char) => {
      if (replacements[char] && Math.random() < errorRate) {
        return replacements[char];
      }
      return char;
    });

    let result = chars.join('');
    if (Math.random() < wordReplaceRate) {
      result = result.replace(/真的/g, '尊嘟').replace(/没有/g, '木有');
    }

    return result;
  }
}

export default TypoGenerator;
