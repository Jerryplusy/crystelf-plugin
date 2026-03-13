class MemoryRetrieval {
  constructor(ai, config, db) {
    this.ai = ai;
    this.config = config;
    this.db = db;
  }

  async retrieve(sessionId, currentMessage, senderName, recentHistory) {
    if (!this.config.memory?.enabled) return null;

    const question = await this.generateQuestion(currentMessage, senderName, recentHistory);
    if (!question) return null;

    return await this.reactSearch(sessionId, question);
  }

  async generateQuestion(message, sender, history) {
    const historyText = history
      .slice(-15)
      .map((item) => `${item.userName || 'unknown'}: ${item.content}`)
      .join('\n');

    try {
      const result = await this.ai.generateText({
        prompt: `Current chat:\n${historyText}\n\nNow ${sender} said: ${message}\n\nDecide whether older conversation memory is needed to reply well. If yes, output one short search question only. If no retrieval is needed, output exactly NO_RETRIEVAL_NEEDED.`,
        messages: [],
        model: this.config.workingModel || this.config.model,
        temperature: 0.3,
        max_tokens: 120,
      });

      if (!result || result.includes('NO_RETRIEVAL_NEEDED')) return null;
      return result.trim();
    } catch (error) {
      logger.warn(`[crystelf-ai-v2] Memory question generation failed: ${error.message}`);
      return null;
    }
  }

  async reactSearch(sessionId, question) {
    const maxIter = this.config.memory?.maxIterations ?? 3;
    const timeout = this.config.memory?.timeoutMs ?? 15000;
    const start = Date.now();
    let collectedInfo = '';
    const tools = [
      {
        type: 'function',
        function: {
          name: 'search_chat_history',
          description: 'Search earlier chat history by keyword.',
          parameters: {
            type: 'object',
            properties: {
              keyword: { type: 'string', description: 'Keyword to search for' },
            },
            required: ['keyword'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_user_history',
          description: 'View a specific user\'s previous messages in this session.',
          parameters: {
            type: 'object',
            properties: {
              user_id: { type: 'number', description: 'User QQ number' },
            },
            required: ['user_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'found_answer',
          description: 'Stop searching because enough relevant context has been found.',
          parameters: {
            type: 'object',
            properties: {
              answer: { type: 'string', description: 'Summary of the useful memory found' },
              found: { type: 'boolean', description: 'Whether useful context was found' },
            },
            required: ['answer', 'found'],
          },
        },
      },
    ];

    const messages = [
      {
        role: 'system',
        content: `You are doing memory retrieval for a group chat reply. Question: ${question}\nCollected info so far: ${collectedInfo || 'none'}\nIf you still need more context, call a search tool. If you already have enough, call found_answer.`,
      },
    ];

    for (let index = 0; index < maxIter; index++) {
      if (Date.now() - start > timeout) break;

      try {
        const response = await this.ai.complete({
          model: this.config.workingModel || this.config.model,
          messages,
          tools,
          temperature: 0.3,
          max_tokens: 500,
        });

        messages.push(response.raw);

        if (!response.toolCalls.length) {
          return response.content || collectedInfo || null;
        }

        for (const toolCall of response.toolCalls) {
          let args = {};
          try {
            args = JSON.parse(toolCall.arguments || '{}');
          } catch {}

          let result = '';
          if (toolCall.name === 'search_chat_history') {
            const rows = this.db.searchMessages(sessionId, args.keyword, 15);
            result = rows.length
              ? rows.map((item) => `[${new Date(item.timestamp).toLocaleString('zh-CN')}] ${item.userName || 'unknown'}: ${item.content}`).join('\n')
              : `No earlier messages were found for keyword: ${args.keyword}`;
          } else if (toolCall.name === 'search_user_history') {
            const rows = this.db.getMessagesByUser(args.user_id, sessionId, 15);
            result = rows.length
              ? rows.map((item) => `[${new Date(item.timestamp).toLocaleString('zh-CN')}] ${item.content}`).join('\n')
              : 'No earlier messages were found for that user';
          } else if (toolCall.name === 'found_answer') {
            return args.found ? args.answer : null;
          }

          collectedInfo += `${collectedInfo ? '\n\n' : ''}${result}`;
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }
      } catch (error) {
        logger.warn(`[crystelf-ai-v2] Memory retrieval failed: ${error.message}`);
        break;
      }
    }

    return collectedInfo || null;
  }
}

export default MemoryRetrieval;
