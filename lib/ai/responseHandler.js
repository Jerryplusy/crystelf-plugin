/**
 * 将包含多个 reply 标记的单行文本拆分为多行
 * 例如 "[[[reply:1]]]文字A[[[reply:2]]]文字B" → ["[[[reply:1]]]文字A", "[[[reply:2]]]文字B"]
 */
function splitByReplyMarkers(line) {
  const parts = line.split(/(?=\[\[\[reply:\d+\]\]\]|\(\(\(reply:\d+\)\)\))/);
  return parts.filter(p => p.trim());
}

/**
 * 解析单行文本中的标记，按顺序提取 AT、戳人、引用、记忆
 */
function parseLineMarkers(line) {
  const atUsers = [];
  const pokeUsers = [];
  let quoteId = undefined;
  let memoryData = undefined;

  const atPatterns = [
    /\[\[\[at:(\d+)\]\]\]/g,
    /\(\(\(at:(\d+)\)\)\)/g,
    /\(\(\((\d+)\)\)\)/g,
  ];
  for (const pattern of atPatterns) {
    const matches = [...line.matchAll(pattern)];
    for (const match of matches) {
      const userId = parseInt(match[1], 10);
      atUsers.push(userId);
    }
  }

  const pokePatterns = [/\[\[\[poke:(\d+)\]\]\]/g, /\(\(\(poke:(\d+)\)\)\)/g];
  for (const pattern of pokePatterns) {
    const matches = [...line.matchAll(pattern)];
    for (const match of matches) {
      const userId = parseInt(match[1], 10);
      pokeUsers.push(userId);
    }
  }

  const replyPatterns = [
    /\[\[\[reply:(\d+)\]\]\]/g,
    /\(\(\(reply:\d+\)\)\)/g,
  ];
  for (const pattern of replyPatterns) {
    const matches = [...line.matchAll(pattern)];
    for (const match of matches) {
      if (quoteId === undefined) {
        quoteId = parseInt(match[1], 10);
      }
    }
  }

  // 解析记忆标记 [[[memory:记忆内容:关键词1,关键词2:天数]]]
  const memoryPattern = /\[\[\[memory:([^:]+):([^:]+):(\d+)\]\]\]/g;
  const memoryMatches = [...line.matchAll(memoryPattern)];
  for (const match of memoryMatches) {
    memoryData = {
      data: match[1],
      key: match[2].split(','),
      timeout: parseInt(match[3], 10)
    };
  }

  let cleanText = line
    .replace(/\[\[\[at:\d+\]\]\]/g, "")
    .replace(/\(\(\(at:\d+\)\)\)/g, "")
    .replace(/\(\(\(\d+\)\)\)/g, "")
    .replace(/\[\[\[poke:\d+\]\]\]/g, "")
    .replace(/\(\(\(poke:\d+\)\)\)/g, "")
    .replace(/\[\[\[reply:\d+\]\]\]/g, "")
    .replace(/\(\(\(reply:\d+\)\)\)/g, "")
    .replace(/\[\[\[memory:[^\]]+\]\]\]/g, "")
    .trim();

  return { cleanText, atUsers, pokeUsers, quoteId, memoryData };
}

/**
 * 响应处理器
 * 处理AI返回的文本响应，自动解析标记
 */
class ResponseHandler {
  /**
   * 处理ai响应
   * @param rawResponse ai原始回复
   * @param userMessage 用户消息
   * @param groupId 群聊id
   * @param user_id 用户id
   * @returns {Promise<[{type: string, data: string, at: boolean, quote: boolean, recall: number}]|Array|*[]>}
   */
  async processResponse(rawResponse, userMessage, groupId, user_id) {
    try {
      if (!rawResponse || typeof rawResponse !== 'string') {
        logger.warn('[crystelf-ai] AI返回为空或不是字符串');
        return this.createDefaultResponse();
      }

      const messages = this.parseTextResponse(rawResponse);
      
      if (messages.length === 0) {
        return this.createDefaultResponse();
      }

      return messages;
    } catch (error) {
      logger.error(`[crystelf-ai] 处理响应失败: ${error.message}`);
      return this.createErrorResponse('处理响应时发生错误');
    }
  }

  /**
   * 解析文本响应
   * 按原始顺序处理代码块、markdown块和普通文本
   */
  parseTextResponse(text) {
    const messages = [];
    const lines = text.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // 检查是否是代码块开始
      if (line.startsWith('```')) {
        // 提取语言标识
        let language = 'text';
        let codeContent = line.slice(3).trim();
        
        // 如果语言标识在当前行
        if (language === 'text' && codeContent) {
          // 可能是 ```javascript 这样的情况
        }
        
        // 收集代码块内容
        const codeLines = [];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          if (nextLine && nextLine.trim() === '```') {
            break;
          }
          codeLines.push(nextLine);
          i++;
        }
        
        // 解析代码块
        const fullCodeBlock = line + '\n' + codeLines.join('\n') + '\n```';
        const langMatch = line.match(/^```(\w+)/);
        if (langMatch) {
          language = langMatch[1];
        }
        
        const code = codeLines.join('\n').trim();
        
        // 判断是代码还是 markdown
        if (language === 'markdown' || language === 'md') {
          messages.push({
            type: 'markdown',
            data: code,
            at: -1,
            quote: -1,
            recall: false
          });
        } else {
          messages.push({
            type: 'code',
            data: code,
            language: language,
            at: -1,
            quote: -1,
            recall: false
          });
        }
        
        i++;
        continue;
      }
      
      // 处理普通文本行
      if (line) {
        const expandedLines = splitByReplyMarkers(line);
        
        for (const expandedLine of expandedLines) {
          const { cleanText: lineText, atUsers, pokeUsers, quoteId, memoryData } = parseLineMarkers(expandedLine);
          
          if (!lineText && pokeUsers.length === 0 && !memoryData) {
            continue;
          }

          // 处理记忆
          if (memoryData) {
            messages.push({
              type: 'memory',
              data: memoryData.data,
              key: memoryData.key,
              timeout: memoryData.timeout,
              at: -1,
              quote: -1,
              recall: false
            });
          }

          // 检查是否包含图片生成请求
          if (lineText.includes('生成图片') || lineText.includes('画一张') || lineText.includes('帮我画')) {
            messages.push({
              type: 'image',
              data: lineText,
              at: atUsers.length > 0 ? atUsers[0] : -1,
              quote: quoteId !== undefined ? quoteId : -1,
              recall: false
            });
            continue;
          }

          // 检查是否为表情包（情绪关键词）
          const validEmotions = ['happy', 'sad', 'angry', 'confused', 'shy', 'surprise', 'bye', 'sorry', 'good', 'goodmorning', 'goodnight', 'default'];
          const lowerText = lineText.toLowerCase().trim();
          if (validEmotions.includes(lowerText)) {
            messages.push({
              type: 'meme',
              data: lowerText,
              at: -1,
              quote: -1,
              recall: false
            });
            continue;
          }

          // 普通消息
          if (pokeUsers.length > 0) {
            for (const pokeId of pokeUsers) {
              messages.push({
                type: 'poke',
                id: pokeId,
                at: -1,
                quote: -1,
                recall: false
              });
            }
          }

          if (lineText) {
            messages.push({
              type: 'message',
              data: lineText,
              at: atUsers.length > 0 ? atUsers[0] : -1,
              quote: quoteId !== undefined ? quoteId : -1,
              recall: false
            });
          }
        }
      }
      
      i++;
    }

    return messages;
  }

  createErrorResponse(error) {
    return [{
      type: 'message',
      data: '抱歉，我遇到了一些问题，请稍后再试~',
      at: -1,
      quote: -1,
      recall: false
    }];
  }

  createDefaultResponse() {
    return [{
      type: 'message',
      data: '抱歉，我暂时不知道该怎么回复~',
      at: -1,
      quote: -1,
      recall: false
    }];
  }

  async handleMemoryMessage(e, message, groupId, userId) {
    try {
      const MemorySystem = await import('./memorySystem.js');
      const memoryId = await MemorySystem.default.addMemory(
        groupId,
        userId,
        message.data,
        message.key || [],
        message.timeout || 30
      );
      if (memoryId) {
        logger.info(`[crystelf-ai] 存储记忆成功: ${memoryId}`);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 存储记忆失败: ${error.message}`);
    }
  }
}

export default new ResponseHandler();
