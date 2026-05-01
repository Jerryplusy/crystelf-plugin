import { segment } from 'oicq';
import { parseLineMarkers, splitByReplyMarkers } from './queue.js';
import { getImageTag } from './image-analyzer.js';
import { extractStandaloneMarkdownBlock, splitOutgoingUnits, summarizeMarkdown, MARKDOWN_OPEN_TAG } from './markdown-message.js';
import { renderMarkdownToImage } from './markdown-renderer.js';
import ConfigControl from '../config/configControl.js';

function getSegmentText(item) {
  return item?.text ?? item?.data?.text ?? '';
}

function getSegmentAtQQ(item) {
  return item?.qq ?? item?.data?.qq ?? item?.data?.id;
}

function getSegmentImageUrl(item) {
  return item?.url || item?.data?.url || item?.data?.file;
}


export function isGroupAllowed(groupId, config) {
  if ((config.whitelistGroups || []).length > 0) {
    return config.whitelistGroups.includes(groupId);
  }
  if ((config.blacklistGroups || []).length > 0) {
    return !config.blacklistGroups.includes(groupId);
  }
  return true;
}

export async function getQuotedMessage(e) {
  try {
    if (e.getReply) {
      return await e.getReply();
    }
    if (e.reply_id || e.source?.seq || e.source?.message_id) {
      const replyId = e.reply_id || e.source?.message_id || e.source?.seq;
      return (await e.bot.sendApi('get_msg', { message_id: replyId })).data;
    }
  } catch (error) {
    logger.debug?.(`[crystelf-ai] 获取引用消息失败: ${error.message}`);
  }
  return null;
}

export async function isQuotingBot(e) {
  const quoted = await getQuotedMessage(e);
  const senderId = quoted?.sender?.user_id || quoted?.user_id;
  if (!quoted || String(senderId) !== String(e.bot.uin)) return null;

  const message = Array.isArray(quoted.message) ? quoted.message : [];
  const content = message
    .filter((item) => item.type === 'text')
    .map((item) => getSegmentText(item))
    .join('')
    .trim();

  return {
    quoted: true,
    messageId: String(quoted.message_id || e.reply_id || e.source?.seq || ''),
    content,
  };
}

export async function getQuotedContent(e, db) {
  const quoted = await getQuotedMessage(e);
  if (!quoted) return null;

  const message = Array.isArray(quoted.message) ? quoted.message : [];
  const textContent = message
    .filter((item) => item.type === 'text')
    .map((item) => getSegmentText(item))
    .join('')
    .trim();
  const imageSegs = message.filter((item) => item.type === 'image');
  const imageTags = [];
  for (const item of imageSegs) {
    const imageUrl = getSegmentImageUrl(item);
    if (!imageUrl || !db) {
      imageTags.push('[image]');
      continue;
    }
    try {
      imageTags.push(await getImageTag(imageUrl, db));
    } catch {
      imageTags.push('[image]');
    }
  }
  const content = [textContent, ...imageTags].filter(Boolean).join(' ').trim();
  const imageSeg = imageSegs[0];

  return {
    messageId: String(quoted.message_id || e.reply_id || e.source?.seq || ''),
    senderName: quoted.sender?.nickname || quoted.sender?.card || '未知用户',
    content,
    imageUrl: getSegmentImageUrl(imageSeg),
  };
}

export async function extractContent(e, config, nicknames = [], db) {
  const textParts = [];
  const imageUrls = [];
  const imageTags = [];
  let directAt = false;

  for (const item of Array.isArray(e.message) ? e.message : []) {
    const textValue = getSegmentText(item);
    const atQQ = getSegmentAtQQ(item);
    const imageUrl = getSegmentImageUrl(item);

    if (item.type === 'text' && textValue && textValue.trim()) {
      textParts.push(textValue);
    } else if (item.type === 'at') {
      if (atQQ !== undefined && String(atQQ) === String(e.bot.uin)) {
        directAt = true;
      } else if (atQQ !== undefined) {
        textParts.push(`[@${atQQ}]`);
      }
    } else if (item.type === 'image' && imageUrl) {
      imageUrls.push(imageUrl);
      if (db) {
        try {
          imageTags.push(await getImageTag(imageUrl, db));
        } catch {
          imageTags.push('[image]');
        }
      } else {
        imageTags.push('[image]');
      }
    } else if (item.type === 'record') {
      textParts.push('[用户发送了语音]');
    } else if (item.type === 'video') {
      textParts.push('[用户发送了视频]');
    }
  }

  let text = [...textParts, ...imageTags].join(' ').trim();
  const originalText = text;
  if (!text && directAt) {
    text = '[@you with no text]';
  }

  let nicknameMatched = false;
  let nicknameUsed = '';
  for (const nickname of nicknames) {
    if (!nickname) continue;
    const trimmed = text.trim();
    if (trimmed.startsWith(nickname)) {
      nicknameMatched = true;
      nicknameUsed = nickname;
      text = trimmed.replace(new RegExp(`^${escapeRegExp(nickname)}[,:：，\\s]*`), '').trim() || '你好';
      break;
    }
  }

  if (!text && imageUrls.length > 0) {
    text = '[image]';
  }

  return {
    text,
    originalText,
    imageUrls,
    isDirectAt: directAt,
    nicknameMatched,
    nicknameUsed,
  };
}

export async function getBotRole(e) {
  try {
    const result = await e.bot.sendApi('get_group_member_info', {
      group_id: e.group_id,
      user_id: e.bot.uin,
      no_cache: true,
    });
    return result?.data?.role || 'member';
  } catch {
    return 'member';
  }
}

export async function getGroupInfoData(e) {
  try {
    const result = await e.bot.sendApi('get_group_info', { group_id: e.group_id, no_cache: true });
    return {
      groupName: result?.data?.group_name || e.group_name || e.group?.info?.group_name,
      memberCount: result?.data?.member_count,
    };
  } catch {
    return {
      groupName: e.group_name || e.group?.info?.group_name,
      memberCount: undefined,
    };
  }
}

export async function sendAIResponse(e, messages, typoGenerator) {
  if (!messages.length) return;
  const config = ConfigControl.get('ai') || {};
  const enableMarkdownScreenshot = config.enableMarkdownScreenshot ?? true;
  const enableTypingDelay = config.enableTypingDelay ?? false;
  const typingDelayController = createTypingDelayController(config);

  for (const rawMessage of messages) {
    const expandedLines = expandOutgoingLines(rawMessage, typoGenerator);

    let pendingReply;
    let lastDelayBasisText = '';
    for (let index = 0; index < expandedLines.length; index++) {
      const line = expandedLines[index];
      const { cleanText, atUsers, pokeUsers, quoteId } = parseLineMarkers(line);
      if (quoteId !== undefined) pendingReply = quoteId;

      for (const pokeId of pokeUsers) {
        await e.bot.sendApi('group_poke', {
          group_id: e.group_id,
          user_id: pokeId,
        }).catch(() => null);
      }

      const chain = [];
      if (pendingReply !== undefined) {
        chain.push({ type: 'reply', data: { id: String(pendingReply) } });
        pendingReply = undefined;
      }
      for (const atId of atUsers) {
        if (atId !== undefined && String(atId) !== String(e.bot.uin)) {
          chain.push({ type: 'at', data: { qq: String(atId) } });
        }
      }

      const markdownContent = extractStandaloneMarkdownBlock(cleanText);
      if (markdownContent) {
        const imagePath = await buildMarkdownImage(markdownContent, enableMarkdownScreenshot);
        if (imagePath) {
          chain.push(segment.image(imagePath));
          lastDelayBasisText = summarizeMarkdown(markdownContent);
        } else {
          chain.push({ type: 'text', data: { text: markdownContent } });
          lastDelayBasisText = markdownContent;
        }
      } else if (cleanText) {
        chain.push({ type: 'text', data: { text: cleanText } });
        lastDelayBasisText = cleanText;
      }

      if (chain.length === 1 && chain[0].type === 'reply') {
        logger.info(
          `[crystelf-ai] skip reply-only line group=${e.group_id} line=${JSON.stringify(line)}`
        );
        continue;
      }

      if (chain.length > 0) {
        await e.bot.sendApi('send_group_msg', {
          group_id: e.group_id,
          message: chain,
        });
      }

      if (enableTypingDelay && index < expandedLines.length - 1) {
        await waitTypingDelay(lastDelayBasisText || line, typingDelayController);
      }
    }
  }
}

function expandOutgoingLines(text, typoGenerator) {
  const units = splitOutgoingUnits(text);
  const expandedLines = [];

  for (const unit of units) {
    if (!unit.trim()) continue;
    if (unit.includes(MARKDOWN_OPEN_TAG)) {
      expandedLines.push(unit);
      continue;
    }

    const normalizedUnit = normalizeActionLineBreaks(unit);
    const typoApplied = typoGenerator.apply(normalizedUnit);
    const lineParts = typoApplied
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const linePart of lineParts) {
      expandedLines.push(...splitByReplyMarkers(linePart));
    }
  }

  return expandedLines;
}

function normalizeActionLineBreaks(text) {
  return String(text || '').replace(
    /\\\s*(?=(?:\[meme:[^\]]+\]|\[\[\[reply:\d+\]\]\]|\(\(\(reply:\d+\)\)\)))/gi,
    '\n'
  );
}

async function buildMarkdownImage(markdownContent, enableMarkdownScreenshot) {
  if (!enableMarkdownScreenshot) return null;

  try {
    return await renderMarkdownToImage(markdownContent);
  } catch (error) {
    logger.error(`[crystelf-ai] markdown render failed: ${error.message}`);
    return null;
  }
}

function calculateTypingDelayMs(text) {
  const chars = Array.from(String(text || '').replace(/\s+/g, '')).length;
  return Math.max(150, Math.min(2000, 150 + chars * 65));
}

function createTypingDelayController(config) {
  const rawMaxTotalMs = Number(config.typingDelayMaxTotalMs);
  const maxTotalMs = Number.isFinite(rawMaxTotalMs) && rawMaxTotalMs >= 0 ? rawMaxTotalMs : 10_000;
  return {
    spentMs: 0,
    maxTotalMs,
  };
}

async function waitTypingDelay(text, controller) {
  const remainingMs = controller.maxTotalMs - controller.spentMs;
  if (remainingMs <= 0) return;
  const delayMs = Math.min(calculateTypingDelayMs(text), remainingMs);
  if (delayMs <= 0) return;
  controller.spentMs += delayMs;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function sendEmoji(e, emojiPath, quoteId) {
  if (!emojiPath) return;

  const message = [];
  if (quoteId !== undefined && quoteId !== null && quoteId !== '') {
    message.push({ type: 'reply', data: { id: String(quoteId) } });
  }
  message.push(segment.image(emojiPath));

  await e.bot.sendApi('send_group_msg', {
    group_id: e.group_id,
    message,
  });
}

export function buildStoredMessageFromEvent(e, sessionId, contentText) {
  return {
    sessionId,
    role: 'user',
    content: contentText,
    userId: e.user_id,
    userName: e.sender?.card || e.sender?.nickname || String(e.user_id),
    userRole: e.sender?.role || 'member',
    userTitle: e.sender?.title,
    groupId: e.group_id,
    groupName: e.group_name || e.group?.info?.group_name,
    timestamp: Date.now(),
    messageId: e.message_id,
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
