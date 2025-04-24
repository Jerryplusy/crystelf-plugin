import OpenAI from 'openai';

class ChatTools {
  constructor() {
    this.openai = null;
  }

  init(apiKey, baseUrl) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseUrl: baseUrl,
    });
  }

  async callAi({ prompt, chatHistory = [], model, temperature, customPrompt }) {
    if (!this.openai) {
      logger.err('ai未初始化..');
      return {};
    }
    let systemMessage = { role: 'system', content: customPrompt || '' };
    const messages = [systemMessage, ...chatHistory, { role: 'user', content: prompt }];

    try {
      const completion = await this.openai.chat.completions.create({
        messages: messages,
        model: model,
        temperature: temperature,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      });

      const aiResponse = completion.choices[0].message.content;

      return {
        success: true,
        aiResponse: aiResponse,
      };
    } catch (err) {
      logger.err(err);
      return {};
    }
  }
}
export default ChatTools;
