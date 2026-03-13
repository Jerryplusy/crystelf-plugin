function createMessageTools() {
  return [
    {
      name: 'end_session',
      description: '结束当前会话，不再继续回复。',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: '结束原因，可选' },
        },
      },
      returnToAI: false,
      handler: async (args) => ({ success: true, ended: true, reason: args.reason || '' }),
    },
  ];
}

function createInfoTools(toolCtx) {
  const tools = [];
  if (!toolCtx.groupId) return tools;

  const imageAnalysisBlocked = (toolCtx.config.imageAnalysisBlacklistUsers || []).includes(toolCtx.userId);

  tools.push({
    name: 'get_group_member_info',
    description: '获取群成员详细资料。',
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'number', description: '成员 QQ 号' },
      },
      required: ['user_id'],
    },
    returnToAI: true,
    handler: async (args) => {
      try {
        const result = await toolCtx.event.bot.sendApi('get_group_member_info', {
          group_id: toolCtx.groupId,
          user_id: args.user_id,
          no_cache: true,
        });
        const info = result?.data || {};
        return {
          nickname: info.nickname,
          card: info.card,
          sex: info.sex,
          age: info.age,
          area: info.area,
          level: info.level,
          title: info.title,
          role: info.role,
        };
      } catch (error) {
        return { error: `获取成员信息失败: ${error.message}` };
      }
    },
  });

  tools.push({
    name: 'get_group_member_list',
    description: '获取群成员列表（最多 50 个）。',
    parameters: { type: 'object', properties: {} },
    returnToAI: true,
    handler: async () => {
      try {
        const result = await toolCtx.event.bot.sendApi('get_group_member_list', {
          group_id: toolCtx.groupId,
          no_cache: true,
        });
        const members = Array.isArray(result?.data)
          ? result.data.map((item) => ({ user_id: item.user_id, nickname: item.card || item.nickname, role: item.role })).slice(0, 50)
          : [];
        return { members, total: Array.isArray(result?.data) ? result.data.length : members.length };
      } catch (error) {
        return { error: `获取成员列表失败: ${error.message}` };
      }
    },
  });

  if (toolCtx.config.isMultimodal) {
    tools.push({
      name: 'view_image',
      description: '根据消息 ID 查看图片并获得图片描述。',
      parameters: {
        type: 'object',
        properties: {
          message_id: { type: 'number', description: '包含图片的消息 ID' },
        },
        required: ['message_id'],
      },
      returnToAI: true,
      handler: async (args) => {
        if (imageAnalysisBlocked) {
          return { error: '当前用户被禁止使用看图能力' };
        }
        try {
          const result = await toolCtx.event.bot.sendApi('get_msg', { message_id: args.message_id });
          const message = Array.isArray(result?.data?.message) ? result.data.message : [];
          const image = message.find((item) => item.type === 'image' && (item.url || item.data?.url));
          const imageUrl = image?.url || image?.data?.url;
          if (!imageUrl) {
            return { error: '指定消息里没有可分析的图片' };
          }
          const description = await toolCtx.ai.describeImage(imageUrl, toolCtx.config.multimodalWorkingModel, '请描述这张群聊图片');
          return { success: true, description };
        } catch (error) {
          return { error: `图片分析失败: ${error.message}` };
        }
      },
    });

    tools.push({
      name: 'view_member_avatar',
      description: '查看群成员头像并获得描述。',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'number', description: '成员 QQ 号' },
        },
        required: ['user_id'],
      },
      returnToAI: true,
      handler: async (args) => {
        if (imageAnalysisBlocked) {
          return { error: '当前用户被禁止使用头像分析能力' };
        }
        try {
          const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${args.user_id}&s=640`;
          const description = await toolCtx.ai.describeImage(avatarUrl, toolCtx.config.multimodalWorkingModel, `请描述 QQ 用户 ${args.user_id} 的头像`);
          return { success: true, description };
        } catch (error) {
          return { error: `头像分析失败: ${error.message}` };
        }
      },
    });
  }

  return tools;
}

function createAdminTools(toolCtx) {
  if (!toolCtx.groupId || !toolCtx.config.enableGroupAdmin || !['admin', 'owner'].includes(toolCtx.botRole)) {
    return [];
  }

  return [
    {
      name: 'mute_member',
      description: '禁言某位群成员。',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'number', description: '成员 QQ 号' },
          duration: { type: 'number', description: '禁言秒数' },
        },
        required: ['user_id', 'duration'],
      },
      returnToAI: false,
      handler: async (args) => {
        await toolCtx.event.bot.sendApi('set_group_ban', {
          group_id: toolCtx.groupId,
          user_id: args.user_id,
          duration: args.duration,
        });
        return { success: true };
      },
    },
    {
      name: 'kick_member',
      description: '将某位群成员移出群聊。',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'number', description: '成员 QQ 号' },
          reject_add_request: { type: 'boolean', description: '是否拒绝再次加群' },
        },
        required: ['user_id'],
      },
      returnToAI: false,
      handler: async (args) => {
        await toolCtx.event.bot.sendApi('set_group_kick', {
          group_id: toolCtx.groupId,
          user_id: args.user_id,
          reject_add_request: Boolean(args.reject_add_request),
        });
        return { success: true };
      },
    },
  ];
}

export function createTools(toolCtx) {
  return {
    tools: [...createMessageTools(), ...createInfoTools(toolCtx), ...createAdminTools(toolCtx)],
  };
}

export default createTools;
