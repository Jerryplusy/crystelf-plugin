import Meme from '../../core/meme.js';

class EmojiAgent {
  constructor(config) {
    this.config = config;
  }

  getAvailableCharacters() {
    const characters = this.config.emoji?.characters || [];
    return characters.length ? characters : ['zhenxun'];
  }

  getAvailableEmotions() {
    const emotions = this.config.emoji?.availableEmotions || [];
    return emotions.length
      ? emotions
      : ['angry', 'bye', 'confused', 'default', 'good', 'goodmorning', 'goodnight', 'happy', 'sad', 'shy', 'sorry', 'surprise'];
  }

  async processMemeResponse(text) {
    if (!this.config.emoji?.enabled || !text) {
      return { success: false, cleanedText: text };
    }

    const match = text.match(/\[meme:([^\]]+)\]/i);
    if (!match) {
      return { success: false, cleanedText: text };
    }

    const requestedEmotion = String(match[1]).trim().toLowerCase();
    const availableEmotions = this.getAvailableEmotions();
    const emotion = availableEmotions.includes(requestedEmotion) ? requestedEmotion : 'default';
    const character = this.getAvailableCharacters()[0];
    logger.info(
      `[crystelf-ai-v2] emoji pick requested=${requestedEmotion} resolved=${emotion} character=${character}`
    );
    const emojiPath = await Meme.getMeme(character, emotion);
    logger.info(
      `[crystelf-ai-v2] emoji pick result success=${Boolean(emojiPath)} path=${emojiPath || ''}`
    );
    return {
      success: Boolean(emojiPath),
      emojiPath,
      cleanedText: text.replace(match[0], '').trim(),
    };
  }
}

export default EmojiAgent;
