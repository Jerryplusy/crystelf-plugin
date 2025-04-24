import axios from 'axios';

class OllamaChat {
  constructor() {
    this.apiUrl = null;
    this.apiKey = null;
  }

  /**
   *
   * @param apiKey 密钥
   * @param baseUrl ollamaAPI地址
   */
  init(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.apiUrl = baseUrl;
  }

  /**
   *
   * @param prompt 用户命令+提示词（融合）
   * @param chatHistory 历史记录
   * @param model 模型
   * @param temperature 温度
   * @returns {Promise<{success: boolean}|{success: boolean, aiResponse: (*|string)}>}
   */
  async callAi({ prompt, chatHistory = [], model, temperature }) {
    if (!this.apiUrl || !this.apiKey) {
      logger.err('ollama未初始化..');
      return { success: false };
    }

    const requestData = {
      model: model,
      prompt: prompt,
      temperature: temperature,
      history: chatHistory,
    };

    try {
      const response = await axios.post(`${this.apiUrl}/v1/complete`, requestData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const aiResponse = response.data?.choices[o]?.text || '';

      return {
        success: true,
        aiResponse: aiResponse,
      };
    } catch (err) {
      logger.err(err);
      return { success: false };
    }
  }
}

export default OllamaChat;
