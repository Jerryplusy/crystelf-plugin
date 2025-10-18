import pinyin from 'pinyin-pro';

class PinyinUtils {
  /**
   * 将中文转化为拼音
   * @param text 文本
   * @param toneType none
   * @returns {*|string}
   */
  static toPinyin(text, toneType = 'none') {
    try {
      return pinyin.pinyin(text, {
        toneType,
        type: 'string',
        nonZh: 'consecutive'
      });
    } catch (error) {
      logger.error(`[crystelf-ai] 拼音转换失败: ${error.message}`);
      return text;
    }
  }

  /**
   * 检查文本是否包含拼音关键词
   * @param text
   * @param pinyinKeywords
   * @returns {{keyword: *, matched: boolean, type: string}|null}
   */
  static matchPinyin(text, pinyinKeywords) {
    if (!text || !pinyinKeywords || pinyinKeywords.length === 0) {
      return null;
    }
    const textPinyin = this.toPinyin(text.toLowerCase());
    for (const keyword of pinyinKeywords) {
      if (textPinyin.includes(keyword.toLowerCase())) {
        return {
          keyword,
          matched: true,
          type: 'pinyin'
        };
      }
    }
    return null;
  }

  /**
   * 检查文本是否包含关键词
   * @param text 文本
   * @param chineseKeywords 中文关键词数组
   * @param pinyinKeywords 拼音关键词数组
   * @returns {{keyword: *, matched: boolean, type: string}|null|{keyword: *, matched: boolean, type: string}}
   */
  static matchKeywords(text, chineseKeywords = [], pinyinKeywords = []) {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    for (const keyword of chineseKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return {
          keyword,
          matched: true,
          type: 'chinese'
        };
      }
    }
    if (pinyinKeywords.length > 0) {
      return this.matchPinyin(text, pinyinKeywords);
    }
    return null;
  }
}

export default PinyinUtils;
