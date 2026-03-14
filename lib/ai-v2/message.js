import { segment } from 'oicq';
import { parseLineMarkers, splitByReplyMarkers } from './queue.js';
import { getImageTag } from './image-analyzer.js';

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
    logger.debug?.(`[crystelf-ai-v2] 获取引用消息失败: ${error.message}`);
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

  for (const rawMessage of messages) {
    const message = typoGenerator.apply(rawMessage);
    const lines = message.split('\n').filter((item) => item.trim());
    const expandedLines = [];
    for (const line of lines) {
      expandedLines.push(...splitByReplyMarkers(line));
    }

    let pendingReply;
    for (const line of expandedLines) {
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
      if (cleanText) {
        chain.push({ type: 'text', data: { text: cleanText } });
      }

      if (chain.length === 1 && chain[0].type === 'reply') {
        logger.info(
          `[crystelf-ai-v2] skip reply-only line group=${e.group_id} line=${JSON.stringify(line)}`
        );
        continue;
      }

      if (chain.length > 0) {
        await e.bot.sendApi('send_group_msg', {
          group_id: e.group_id,
          message: chain,
        });
      }
    }
  }
}

export async function sendEmoji(e, emojiPath, quoteId) {
  if (!emojiPath) return;

  if (quoteId !== undefined && quoteId !== null && quoteId !== '') {
    await e.bot.sendApi('send_group_msg', {
      group_id: e.group_id,
      message: [
        { type: 'reply', data: { id: String(quoteId) } },
        segment.image(emojiPath),
      ],
    });
    return;
  }

  await e.reply(segment.image(emojiPath), true);
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
