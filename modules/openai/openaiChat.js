import OpenAI from 'openai';

class OpenaiChat {
  constructor() {
    this.openai = null;
  }

  /**
   * @param apiKey 密钥
   * @param baseUrl openaiAPI地址
   */
  init(apiKey, baseUrl) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl,
    });
  }

  /**
   * @param prompt 用户说的话
   * @param chatHistory 聊天历史记录
   * @param model 模型
   * @param temperature 温度
   * @param customPrompt 提示词
   * @returns {Promise<{success: boolean, aiResponse: string}|{}>}
   */
  async callAi({ prompt, chatHistory = [], model, temperature, customPrompt }) {
    if (!this.openai) {
      logger.error('[crystelf-ai] ai未初始化..');
      return { success: false };
    }
    let systemMessage = {
      role: 'system',
      content: customPrompt || '',
    };
    const messages = [
      systemMessage,
      ...chatHistory,
      {
        role: 'user',
        content: prompt,
      },
    ];

    try {
      //logger.info("[DEBUG] 请求体:", {
      //model: model,
      //messages,
      //});

      const completion = await this.openai.chat.completions.create({
        messages: messages,
        model: model,
        temperature: temperature,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
        response_format: { type: 'json_object' },
        stream: false,
      });

      const aiResponse = completion.choices[0].message.content;
      logger.info(aiResponse);
      return {
        success: true,
        aiResponse: aiResponse,
      };
    } catch (err) {
      logger.error(err);
      return { success: false };
    }
  }
}

export default OpenaiChat;
