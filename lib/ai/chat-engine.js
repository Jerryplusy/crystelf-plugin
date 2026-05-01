import { buildSystemPrompt } from './prompt.js';
import { parseLineMarkers } from './queue.js';
import ConfigControl from '../config/configControl.js';

function parseMessages(text) {
  if (!text || !text.trim()) return [];
  return text.split(/\n---\n/).map((item) => item.trim()).filter(Boolean);
}

function extractEmojiQuoteId(text) {
  if (!text || !text.trim()) return undefined;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const { quoteId } = parseLineMarkers(trimmed);
    if (quoteId !== undefined) return quoteId;
  }

  return undefined;
}

export async function runChat(ai, toolCtx, history, targetMessage, promptCtx, humanize) {
  const debugEnabled = ConfigControl.get('config')?.debug === true;
  const prompt = buildSystemPrompt({
    ...promptCtx,
    chatHistory: history,
    targetMessage,
    emojiAgent: humanize?.emojiAgent,
  });

  if (debugEnabled) {
    logger.info(`[crystelf-ai] full prompt session=${toolCtx.sessionId}\n${prompt}`);
  }

  const messages = [{ role: 'system', content: prompt }];
  if (toolCtx.pendingImageUrls?.length) {
    logger.info(
      `[crystelf-ai] attach multimodal images session=${toolCtx.sessionId} count=${toolCtx.pendingImageUrls.length}`
    );
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: targetMessage.content },
        ...toolCtx.pendingImageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
      ],
    });
  }

  const response = await ai.complete({
    model: toolCtx.config.model,
    messages,
    temperature: toolCtx.config.temperature,
    max_tokens: 1200,
  });

  let lastTextContent = '';
  if (response.content) {
    lastTextContent = response.content;
    logger.info(
      `[crystelf-ai] ai raw output session=${toolCtx.sessionId} content=${JSON.stringify(response.content)}`
    );
  }

  const memeResult = await humanize.emojiAgent.processMemeResponse(lastTextContent, toolCtx.sessionId);
  const finalText = memeResult.cleanedText || lastTextContent;
  const emojiQuoteId = extractEmojiQuoteId(finalText);

  logger.info(
    `[crystelf-ai] ai final output session=${toolCtx.sessionId} content=${JSON.stringify(finalText || '')} emoji=${Boolean(memeResult.success)} quote=${emojiQuoteId ?? 'none'}`
  );

  return {
    messages: parseMessages(finalText),
    toolCalls: [],
    emojiPath: memeResult.success ? memeResult.emojiPath : null,
    emojiQuoteId,
  };
}

export default runChat;
