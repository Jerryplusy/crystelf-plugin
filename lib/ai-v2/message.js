import { segment } from 'oicq';
import { parseLineMarkers, splitByReplyMarkers } from './queue.js';

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
    .map((item) => item.text || item.data?.text || '')
    .join('')
    .trim();

  return {
    quoted: true,
    messageId: String(quoted.message_id || e.reply_id || e.source?.seq || ''),
    content,
  };
}

export async function getQuotedContent(e) {
  const quoted = await getQuotedMessage(e);
  if (!quoted) return null;

  const message = Array.isArray(quoted.message) ? quoted.message : [];
  const content = message
    .filter((item) => item.type === 'text')
    .map((item) => item.text || item.data?.text || '')
    .join('')
    .trim();
  const imageSeg = message.find((item) => item.type === 'image');

  return {
    messageId: String(quoted.message_id || e.reply_id || e.source?.seq || ''),
    senderName: quoted.sender?.nickname || quoted.sender?.card || '未知用户',
    content,
    imageUrl: imageSeg?.url || imageSeg?.data?.url,
  };
}

export function extractContent(e, config, nicknames = []) {
  const textParts = [];
  const imageUrls = [];
  let directAt = false;

  for (const item of Array.isArray(e.message) ? e.message : []) {
    if (item.type === 'text' && item.text && item.text.trim()) {
      textParts.push(item.text);
    } else if (item.type === 'at') {
      if (String(item.qq) === String(e.bot.uin)) {
        directAt = true;
      } else {
        textParts.push(`[@${item.qq}]`);
      }
    } else if (item.type === 'image' && (item.url || item.data?.url)) {
      imageUrls.push(item.url || item.data.url);
    } else if (item.type === 'record') {
      textParts.push('[用户发送了语音]');
    } else if (item.type === 'video') {
      textParts.push('[用户发送了视频]');
    }
  }

  let text = textParts.join('').trim();
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
      text = trimmed.replace(new RegExp(`^${escapeRegExp(nickname)}[,:：，\s]*`), '').trim() || '你好';
      break;
    }
  }

  if (!text && imageUrls.length > 0) {
    text = '[用户发送了图片]';
  }

  return {
    text,
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
        if (String(atId) !== String(e.bot.uin)) {
          chain.push(segment.at(atId));
        }
      }
      if (cleanText) {
        chain.push({ type: 'text', data: { text: cleanText } });
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

export async function sendEmoji(e, emojiPath) {
  if (!emojiPath) return;
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
