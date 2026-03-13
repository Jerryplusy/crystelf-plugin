import { createTools } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import { parseLineMarkers } from './queue.js';

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

function buildOpenAITools(tools) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export async function runChat(ai, toolCtx, history, targetMessage, promptCtx, humanize) {
  const { tools } = createTools(toolCtx);
  const allToolCalls = [];
  let toolResults = [];
  let lastTextContent = '';
  const maxIterations = toolCtx.config.maxIterations ?? 8;

  for (let iteration = 0; maxIterations === -1 || iteration < maxIterations; iteration++) {
    const prompt = buildSystemPrompt({
      ...promptCtx,
      toolResults: iteration > 0 ? toolResults : undefined,
      chatHistory: history,
      targetMessage,
      emojiAgent: humanize?.emojiAgent,
    });

    logger.info(`[crystelf-ai-v2] full prompt session=${toolCtx.sessionId} iteration=${iteration}\n${prompt}`);

    const messages = [{ role: 'system', content: prompt }];
    if (iteration === 0 && toolCtx.pendingImageUrls?.length) {
      logger.info(
        `[crystelf-ai-v2] attach multimodal images session=${toolCtx.sessionId} count=${toolCtx.pendingImageUrls.length}`
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
      tools: tools.length ? buildOpenAITools(tools) : undefined,
      temperature: toolCtx.config.temperature,
      max_tokens: 1200,
    });

    if (response.content) {
      lastTextContent = response.content;
      logger.info(
        `[crystelf-ai-v2] ai raw output session=${toolCtx.sessionId} iteration=${iteration} content=${JSON.stringify(response.content)}`
      );
    }

    if (!response.toolCalls.length) {
      break;
    }

    const newToolResults = [];
    let hasReturnToAI = false;
    for (const toolCall of response.toolCalls) {
      let args = {};
      try {
        args = JSON.parse(toolCall.arguments || '{}');
      } catch {}

      const handler = tools.find((tool) => tool.name === toolCall.name);
      if (!handler) continue;

      if (toolCall.name === 'end_session') {
        await handler.handler(args, toolCtx.event);
        return { messages: [], toolCalls: allToolCalls, emojiPath: null };
      }

      try {
        const result = await handler.handler(args, toolCtx.event);
        allToolCalls.push({ name: toolCall.name, args, result });
        if (handler.returnToAI) {
          hasReturnToAI = true;
          newToolResults.push({ toolName: toolCall.name, result });
        }
      } catch (error) {
        const result = { error: error.message };
        allToolCalls.push({ name: toolCall.name, args, result });
        if (handler.returnToAI) {
          hasReturnToAI = true;
          newToolResults.push({ toolName: toolCall.name, result });
        }
      }
    }

    toolResults = newToolResults;
    if (!hasReturnToAI) break;
  }

  const memeResult = await humanize.emojiAgent.processMemeResponse(lastTextContent, toolCtx.sessionId);
  const finalText = memeResult.cleanedText || lastTextContent;
  const emojiQuoteId = extractEmojiQuoteId(finalText);

  logger.info(
    `[crystelf-ai-v2] ai final output session=${toolCtx.sessionId} content=${JSON.stringify(finalText || '')} emoji=${Boolean(memeResult.success)} quote=${emojiQuoteId ?? 'none'}`
  );

  return {
    messages: parseMessages(finalText),
    toolCalls: allToolCalls,
    emojiPath: memeResult.success ? memeResult.emojiPath : null,
    emojiQuoteId,
  };
}

export default runChat;
