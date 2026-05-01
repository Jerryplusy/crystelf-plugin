import OpenAI from 'openai';

function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text') return part.text || '';
      return '';
    })
    .join('')
    .trim();
}

class OpenAIChatClient {
  constructor(config) {
    this.refreshConfig(config);
  }

  refreshConfig(config) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl,
    });
  }

  async generateText({ prompt, messages = [], model, temperature = 0.7, max_tokens = 800 }) {
    const response = await this.client.chat.completions.create({
      model,
      temperature,
      max_tokens,
      messages: [
        { role: 'system', content: prompt },
        ...messages,
      ],
    });

    const choice = response.choices?.[0]?.message;
    return normalizeContent(choice?.content);
  }

  async complete({ model, messages, temperature = 0.7, max_tokens = 1200 }) {
    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });

    const choice = response.choices?.[0]?.message || {};

    return {
      content: normalizeContent(choice.content),
      raw: {
        role: 'assistant',
        content: choice.content || '',
      },
      reasoning: '',
    };
  }

  async describeImage(imageUrl, model, hint = '') {
    logger.info(`[crystelf-ai] describeImage request model=${model} hint=${JSON.stringify(hint)} url=${imageUrl}`);
    const response = await this.client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content:
            'You are an image analysis assistant. Describe the image faithfully, summarize key objects, people, emotions, text, and scene details in Chinese.',
        },
        {
          role: 'user',
          content: [
            ...(hint ? [{ type: 'text', text: hint }] : []),
            { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } },
          ],
        },
      ],
    });

    const description = normalizeContent(response.choices?.[0]?.message?.content);
    logger.info(`[crystelf-ai] describeImage result content=${JSON.stringify(description)}`);
    return description;
  }
}

export default OpenAIChatClient;
