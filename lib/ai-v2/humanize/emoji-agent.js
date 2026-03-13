import fs from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';

const AVAILABLE_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'surprised',
  'confused',
  'excited',
  'tired',
  'shy',
  'proud',
  'default',
  'funny',
  'cute',
  'love',
  'neutral',
];

class EmojiAgent {
  constructor(ai, config, db) {
    this.ai = ai;
    this.config = config;
    this.db = db;
    this.memeBaseDir = path.join(process.cwd(), 'data', 'chat', 'meme');
  }

  getAvailableCharacters() {
    if (!existsSync(this.memeBaseDir)) {
      return [];
    }

    return readdirSync(this.memeBaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  getAvailableEmotions(character) {
    if (!character) {
      const targetCharacters = (this.config.emoji?.characters || []).length
        ? this.config.emoji.characters
        : this.getAvailableCharacters();
      return [...new Set(targetCharacters.flatMap((item) => this.getAvailableEmotions(item)))];
    }

    const characterDir = path.join(this.memeBaseDir, character);
    if (!existsSync(characterDir)) {
      return [];
    }

    return readdirSync(characterDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  parseAllMemeIntents(text) {
    const regex = /\[meme:([^\]]+)\]/gi;
    return [...String(text || '').matchAll(regex)].map((item) => ({
      emotion: item[1].trim().toLowerCase(),
    }));
  }

  async processMemeResponse(text, sessionId) {
    if (!this.config.emoji?.enabled || !text) {
      return { success: false, cleanedText: text, error: 'emoji disabled or empty text' };
    }

    const intents = this.parseAllMemeIntents(text);
    if (!intents.length) {
      return { success: false, cleanedText: text, error: 'No meme intent found in response' };
    }

    const chatHistory = this.db.getMessages(sessionId, 20);
    const configChars = this.config.emoji?.characters || [];
    const targetCharacters = configChars.length ? configChars : this.getAvailableCharacters();
    logger.info(`[crystelf-ai-v2] emoji characters=${JSON.stringify(targetCharacters)}`);

    const intent = intents[0];
    logger.info(`[crystelf-ai-v2] emoji intent=${intent.emotion}`);
    const result = await this.pickEmoji(targetCharacters, intent.emotion, chatHistory);
    if (!result.success || !result.emojiPath) {
      return {
        success: false,
        cleanedText: this.cleanMemeMarker(text),
        error: result.error || 'Failed to pick emoji',
      };
    }

    return {
      success: true,
      emojiPath: result.emojiPath,
      emojiDescription: result.description,
      cleanedText: this.cleanMemeMarker(text),
    };
  }

  normalizeEmotion(emotion) {
    const normalized = String(emotion || '').toLowerCase();
    if (AVAILABLE_EMOTIONS.includes(normalized)) {
      return normalized;
    }

    const mapping = {
      开心: 'happy',
      难过: 'sad',
      生气: 'angry',
      惊讶: 'surprised',
      困惑: 'confused',
      兴奋: 'excited',
      疲倦: 'tired',
      害羞: 'shy',
      骄傲: 'proud',
      默认: 'default',
      有趣: 'funny',
      可爱: 'cute',
      爱: 'love',
      中性: 'neutral',
    };

    return mapping[normalized] || 'default';
  }

  async pickEmoji(characters, emotion, chatHistory) {
    try {
      const normalizedEmotion = this.normalizeEmotion(emotion);
      logger.info(
        `[crystelf-ai-v2] emoji pick emotion=${normalizedEmotion} characters=${JSON.stringify(characters)}`
      );

      let allEmojis = [];
      for (const character of characters) {
        const emotionDir = path.join(this.memeBaseDir, character, normalizedEmotion);
        if (existsSync(emotionDir)) {
          const files = (await fs.readdir(emotionDir)).filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          });
          allEmojis.push(...files.map((file) => ({ path: path.join(emotionDir, file), character, file })));
        }
      }

      if (!allEmojis.length && normalizedEmotion !== 'default') {
        for (const character of characters) {
          const defaultDir = path.join(this.memeBaseDir, character, 'default');
          if (existsSync(defaultDir)) {
            const files = (await fs.readdir(defaultDir)).filter((file) => {
              const ext = path.extname(file).toLowerCase();
              return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            });
            allEmojis.push(...files.map((file) => ({ path: path.join(defaultDir, file), character, file })));
          }
        }
      }

      if (!allEmojis.length) {
        return { success: false, error: `No emojis found for ${normalizedEmotion}` };
      }

      if (!this.config.emoji?.useAISelection) {
        logger.info('[crystelf-ai-v2] emoji useAISelection=false, random pick');
        return this.randomPick(allEmojis);
      }

      return await this.selectByAI(allEmojis, normalizedEmotion, chatHistory);
    } catch (error) {
      logger.error(`[crystelf-ai-v2] emoji pick failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async selectByAI(emojis, emotion, chatHistory) {
    const model = this.config.workingModel || this.config.model;
    const listText = emojis
      .map(
        (item, index) =>
          `${index + 1}. [${item.character}] ${path.basename(item.file, path.extname(item.file))}`
      )
      .join('\n');
    const systemPrompt = `You are an emoji/sticker selection assistant. Select the most appropriate emoji/sticker from the list based on chat context.\n\nAvailable emojis (${emotion}):\n${listText}\n\nReturn JSON: {"selectedIndex":1,"reason":"brief reason"}`;
    const historyText = chatHistory
      .slice(-10)
      .map((item) => `${item.role === 'assistant' ? 'Bot' : item.userName || 'User'}: ${item.content}`)
      .join('\n');
    const userPrompt = `Chat history:\n${historyText}\n\nSelect the most appropriate emoji for emotion "${emotion}".`;

    try {
      const response = await this.ai.complete({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      logger.info(`[crystelf-ai-v2] emoji ai raw content=${JSON.stringify(response.content || '')}`);
      const match = String(response.content || '').match(/\{[\s\S]*\}/);
      if (!match) {
        return this.randomPick(emojis);
      }

      const result = JSON.parse(match[0]);
      const selectedIndex = Number(result.selectedIndex);
      if (!selectedIndex || selectedIndex < 1 || selectedIndex > emojis.length) {
        return this.randomPick(emojis);
      }

      const selected = emojis[selectedIndex - 1];
      const description = path.basename(selected.file, path.extname(selected.file));
      logger.info(
        `[crystelf-ai-v2] emoji ai selected index=${selectedIndex} reason=${JSON.stringify(result.reason || '')} file=${selected.file}`
      );
      return { success: true, emojiPath: selected.path, description };
    } catch (error) {
      logger.warn(`[crystelf-ai-v2] emoji ai selection failed, fallback random: ${error.message}`);
      return this.randomPick(emojis);
    }
  }

  randomPick(emojis) {
    const selected = emojis[Math.floor(Math.random() * emojis.length)];
    const description = path.basename(selected.file, path.extname(selected.file));
    logger.info(`[crystelf-ai-v2] emoji random selected file=${selected.file}`);
    return { success: true, emojiPath: selected.path, description };
  }

  cleanMemeMarker(text) {
    let cleaned = String(text || '').replace(/\[meme:[^\]]+\]/gi, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim();
    return cleaned;
  }
}

export default EmojiAgent;
