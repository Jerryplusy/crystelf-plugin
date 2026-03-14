import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync, createWriteStream, unlink } from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { extractGifFrames, isGifUrl } from './gif-extractor.js';

const KNOWN_CHARACTERS = [
  'hatsune_miku',
  'kagamine_rin',
  'kagamine_len',
  'megurine_luka',
  'kaito',
  'meiko',
  'unknown',
];

const EMOTION_TAGS = [
  'happy',
  'sad',
  'angry',
  'surprised',
  'confused',
  'excited',
  'tired',
  'shy',
  'proud',
  'funny',
  'cute',
  'love',
  'neutral',
  'default',
];

function getMemeBaseDir() {
  return path.join(process.cwd(), 'data', 'chat', 'meme');
}

export async function calculateImageHash(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return crypto.createHash('md5').update(url).digest('hex');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return crypto.createHash('md5').update(buffer).digest('hex');
  } catch (error) {
    logger.warn(`[crystelf-ai] image hash fallback to url: ${error.message}`);
    return crypto.createHash('md5').update(url).digest('hex');
  }
}

async function downloadImage(url, savePath) {
  return await new Promise((resolve) => {
    const dir = path.dirname(savePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const file = createWriteStream(savePath);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://q.qq.com/',
      },
    };

    protocol
      .get(url, options, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      })
      .on('error', (error) => {
        unlink(savePath, () => {});
        logger.error(`[crystelf-ai] image download failed: ${error.message}`);
        resolve(false);
      });
  });
}

function getImageExtension(url) {
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    return ext;
  }
  return '.jpg';
}

function normalizeAnalysisResult(parsed) {
  const type = parsed?.type === 'meme' ? 'meme' : 'image';
  const description = String(parsed?.description || '').trim();
  const emotion = type === 'meme' ? String(parsed?.emotion || 'default').trim().toLowerCase() : undefined;
  const characters = Array.isArray(parsed?.characters)
    ? parsed.characters.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const normalizedEmotion = EMOTION_TAGS.includes(emotion) ? emotion : 'default';
  const normalizedCharacters = characters.length ? characters : [String(parsed?.character || 'unknown').trim() || 'unknown'];

  return {
    success: Boolean(description),
    type,
    description,
    emotion: normalizedEmotion,
    characters: normalizedCharacters,
    character: normalizedCharacters[0],
  };
}

export async function analyzeImage(ai, imageUrl, model, gifBuffer) {
  try {
    logger.info(`[crystelf-ai] image analyze request model=${model} url=${imageUrl}`);
    let imageUrls = [imageUrl];
    let originalGifBuffer = gifBuffer;

    if (await isGifUrl(imageUrl)) {
      const gifResult = await extractGifFrames(imageUrl);
      if (gifResult?.frames?.length) {
        imageUrls = gifResult.frames;
        originalGifBuffer = gifResult.buffer;
      }
    }

    const systemPrompt = `You are an image classification and analysis assistant. Your task is to analyze images and provide structured information.

Instructions:
1. Classify the image as either "meme" or "image":
   - "meme": anime/cartoon reaction images or expressive stickers
   - "image": regular images conveying information
2. Provide a brief description in Chinese (max 30 words).
3. For memes only:
   - Emotion tag: ${EMOTION_TAGS.join(', ')} (choose ONLY ONE)
   - Character names: use English names, array format, can contain multiple values. Known examples: ${KNOWN_CHARACTERS.join(', ')}

Response format (JSON):
{
  "type": "meme" or "image",
  "description": "brief description in Chinese",
  "emotion": "emotion tag",
  "characters": ["character1", "character2"]
}`;

    const userText =
      imageUrls.length > 1
        ? `Please analyze these ${imageUrls.length} frames from an animated image and provide the classification and description.`
        : 'Please analyze this image and provide the classification and description.';

    const requestPayload = {
      model,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url, detail: 'auto' } })),
          ],
        },
      ],
    };

    let response;
    try {
      response = await ai.client.chat.completions.create({
        ...requestPayload,
        response_format: { type: 'json_object' },
      });
    } catch (error) {
      const message = String(error?.message || error);
      if (!message.includes('json_object') && !message.includes('response_format')) {
        throw error;
      }
      logger.warn(
        `[crystelf-ai] image analyze fallback without response_format model=${model} reason=${message}`
      );
      response = await ai.client.chat.completions.create(requestPayload);
    }

    const raw = response.choices?.[0]?.message?.content || '';
    logger.info(`[crystelf-ai] image analyze raw url=${imageUrl} content=${JSON.stringify(raw)}`);
    const jsonMatch = String(raw).match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'json not found' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result = normalizeAnalysisResult(parsed);
    result.gifBuffer = originalGifBuffer;
    logger.info(
      `[crystelf-ai] image analyze result type=${result.type} emotion=${result.emotion || ''} characters=${JSON.stringify(result.characters || [])} description=${JSON.stringify(result.description || '')}`
    );
    return result;
  } catch (error) {
    logger.error(`[crystelf-ai] image analyze failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function processImage(ai, imageUrl, model, db) {
  try {
    const hash = await calculateImageHash(imageUrl);
    const existing = db.getImageByHash(hash);
    if (existing) {
      logger.info(`[crystelf-ai] image exists hash=${hash} description=${existing.description}`);
      return existing;
    }

    const analysis = await analyzeImage(ai, imageUrl, model);
    if (!analysis.success || !analysis.type) {
      logger.warn(`[crystelf-ai] image analysis failed url=${imageUrl} error=${analysis.error || ''}`);
      return null;
    }

    let filePath;
    if (analysis.type === 'meme' && analysis.emotion && analysis.description) {
      const ext = analysis.gifBuffer ? '.gif' : getImageExtension(imageUrl);
      const safeDesc = analysis.description.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_');
      const fileName = `${safeDesc}${ext}`;
      const characters = analysis.characters?.length ? analysis.characters : [analysis.character || 'unknown'];
      const savedPaths = await Promise.all(
        characters.map(async (character) => {
          const memeDir = path.join(getMemeBaseDir(), character, analysis.emotion);
          const targetPath = path.join(memeDir, fileName);
          if (!existsSync(memeDir)) {
            await fs.mkdir(memeDir, { recursive: true });
          }
          if (analysis.gifBuffer) {
            try {
              await fs.writeFile(targetPath, analysis.gifBuffer);
              logger.info(`[crystelf-ai] meme saved character=${character} path=${targetPath}`);
              return targetPath;
            } catch (error) {
              logger.warn(`[crystelf-ai] meme save failed character=${character}: ${error.message}`);
              return null;
            }
          }
          const downloaded = await downloadImage(imageUrl, targetPath);
          if (downloaded) {
            logger.info(`[crystelf-ai] meme downloaded character=${character} path=${targetPath}`);
            return targetPath;
          }
          logger.warn(`[crystelf-ai] meme download failed character=${character} url=${imageUrl}`);
          return null;
        })
      );
      filePath = savedPaths.find(Boolean);
    }

    const record = {
      hash,
      url: imageUrl,
      type: analysis.type,
      description: analysis.description || '未知',
      emotion: analysis.emotion,
      character: analysis.character,
      characters: analysis.characters || [],
      filePath,
      createdAt: Date.now(),
    };

    db.saveImage(record);
    logger.info(`[crystelf-ai] image record saved hash=${hash} type=${record.type} description=${record.description}`);
    return record;
  } catch (error) {
    logger.error(`[crystelf-ai] processImage failed: ${error.message}`);
    return null;
  }
}

export async function getImageTag(imageUrl, db) {
  const hash = await calculateImageHash(imageUrl);
  const record = db.getImageByHash(hash);
  if (record) {
    return `[${record.type}:${record.description}]`;
  }
  return '[image]';
}
