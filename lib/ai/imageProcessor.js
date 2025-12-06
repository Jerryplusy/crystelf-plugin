import axios from 'axios';

class ImageProcessor {
  constructor() {
    this.isInitialized = false;
    this.config = null;
  }

  init(config) {
    try {
      this.config = config;
      this.isInitialized = true;
    } catch (error) {
      logger.error(`[crystelf-ai] 图像处理器初始化失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成或编辑图像
   * @param {string} prompt - 图像描述
   * @param {boolean} editMode - 是否为编辑模式
   * @param {string|null} sourceImageArr - 源图像URL数组
   * @param {Object} config - 配置对象
   * @returns {Promise<Object>} 处理结果
   */
  async generateOrEditImage(prompt, editMode = false, sourceImageArr = [], config = this.config) {
    if (!this.isInitialized && !config) {
      return {
        success: false,
        error: '图像处理器未初始化'
      };
    }

    try {
      const mergedConfig = this.mergeImageConfig(config || this.config);
      
      if (editMode && sourceImageArr) {
        return await this.editImage(prompt, sourceImageArr, mergedConfig);
      } else {
        return await this.generateImage(prompt, mergedConfig);
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 图像处理失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成图像 - 使用OpenAI标准接口
   * @param {string} prompt - 图像描述
   * @param {Object} config - 配置对象
   * @returns {Promise<Object>} 生成结果
   */
  async generateImage(prompt, config) {
    try {
      logger.info(`[crystelf-ai] 开始生成图像: ${prompt}`);

      const requestBody = {
        prompt: prompt,
        model: config.model || 'gemini-3-pro-image-preview',
        n: config.n || 1,
        size: config.size || '1024x1024',
        quality: config.quality || 'standard',
        style: config.style || 'vivid',
        response_format: config.responseFormat || 'url',
        user: config.user || undefined
      };

      const response = await axios.post(
        `${config.baseApi}/v1/images/generations`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: config.timeout || 60000
        }
      );

      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageData = response.data.data[0];
        const imageUrl = imageData.url || imageData.b64_json;
        
        logger.info(`[crystelf-ai] 图像生成成功: ${imageUrl ? 'URL' : 'Base64数据'}`);
        return {
          success: true,
          imageUrl: imageUrl,
          revisedPrompt: imageData.revised_prompt,
          description: prompt,
          model: config.model || 'gemini-3-pro-image-preview',
          rawResponse: response.data
        };
      } else {
        logger.error(`[crystelf-ai] 无效的API响应格式: ${JSON.stringify(response.data)}`);
        return {
          success: false,
          error: '无效的API响应格式'
        };
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 图像生成失败: ${error.message}`);
      return {
        success: false,
        error: `图像生成失败: ${error.message}`
      };
    }
  }

  /**
   * 编辑图像 - 使用OpenAI标准接口
   * @param {string} prompt - 编辑描述
   * @param {string} sourceImageArr - 源图像URL数组
   * @param {Object} config - 配置对象
   * @returns {Promise<Object>} 编辑结果
   */
  async editImage(prompt, sourceImageArr, config) {
    try {
      logger.info(`[crystelf-ai] 开始编辑图像: ${prompt}, 源图像数量: ${sourceImageArr.length}`);
      
      if (!sourceImageArr || sourceImageArr.length === 0) {
        return {
          success: false,
          error: '编辑图像需要提供源图像'
        };
      }
      const sourceImage = sourceImageArr[0];
      let imageData = sourceImage;
      if (sourceImage.startsWith('http')) {
        try {
          const imageResponse = await axios.get(sourceImage, {
            responseType: 'arraybuffer',
            timeout: 30000
          });
          const base64 = Buffer.from(imageResponse.data).toString('base64');
          imageData = `data:image/png;base64,${base64}`;
        } catch (error) {
          logger.error(`[crystelf-ai] 下载源图像失败: ${error.message}`);
          return {
            success: false,
            error: `下载源图像失败: ${error.message}`
          };
        }
      }

      const requestBody = {
        image: imageData,
        prompt: prompt,
        model: config.model || 'gemini-3-pro-image-preview',
        n: config.n || 1,
        size: config.size || '1024x1024',
        response_format: config.responseFormat || 'url',
        user: config.user || undefined
      };

      const response = await axios.post(
        `${config.baseApi}/v1/images/edits`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: config.timeout || 60000
        }
      );

      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageData = response.data.data[0];
        const imageUrl = imageData.url || imageData.b64_json;
        
        logger.info(`[crystelf-ai] 图像编辑成功: ${imageUrl ? 'URL' : 'Base64数据'}`);
        return {
          success: true,
          imageUrl: imageUrl,
          description: prompt,
          model: config.model || 'gemini-3-pro-image-preview',
          rawResponse: response.data
        };
      } else {
        logger.error(`[crystelf-ai] 无效的API响应格式: ${JSON.stringify(response.data)}`);
        return {
          success: false,
          error: '无效的API响应格式'
        };
      }
    } catch (error) {
      logger.error(`[crystelf-ai] 图像编辑失败: ${error.message}`);
      return {
        success: false,
        error: `图像编辑失败: ${error.message}`
      };
    }
  }

  /**
   * 从响应内容中提取图像URL
   * @param {string} content - 响应内容
   * @returns {string|null} 图像URL
   */
  extractImageUrl(content) {
    if (!content) return null;
    const urlPatterns = [
      /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i,
      /!\[.*?\]\((https?:\/\/[^\s]+)\)/i,
      /\[.*?\]\((https?:\/\/[^\s]+)\)/i
    ];

    for (const pattern of urlPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    if (content.startsWith('http')) {
      return content.trim();
    }

    return null;
  }

  /**
   * 合并图像配置
   * @param {Object} userConfig - 用户配置
   * @returns {Object} 合并后的配置
   */
  mergeImageConfig(userConfig) {
    const defaultImageConfig = {
      enabled: true,
      model: 'gemini-3-pro-image-preview',
      baseApi: 'https://api.openai.com',
      apiKey: '',
      maxTokens: 4000,
      temperature: 0.7,
      size: '1024x1024',
      responseFormat: 'url',
      modalities: ['text', 'image'],
      timeout: 30000,
      quality: 'standard',
      style: 'vivid'
    };

    if (userConfig?.imageConfig) {
      return {
        ...defaultImageConfig,
        ...userConfig.imageConfig
      };
    }

    const imageRelatedKeys = [
      'model', 'baseApi', 'apiKey', 'maxTokens', 'temperature', 
      'size', 'responseFormat', 'modalities', 'timeout', 'quality', 'style'
    ];

    const mergedConfig = { ...defaultImageConfig };
    
    for (const key of imageRelatedKeys) {
      if (userConfig[key] !== undefined) {
        mergedConfig[key] = userConfig[key];
      }
    }
    return mergedConfig;
  }

  /**
   * 验证图像配置
   * @param {Object} config - 配置对象
   * @returns {Object} 验证结果
   */
  validateImageConfig(config) {
    const errors = [];

    if (!config.apiKey) {
      errors.push('API密钥不能为空');
    }

    if (!config.baseApi) {
      errors.push('API基础地址不能为空');
    }

    if (!config.model) {
      errors.push('模型名称不能为空');
    }

    const validSizes = ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'];
    if (config.size && !validSizes.includes(config.size)) {
      errors.push(`图像尺寸必须是以下之一: ${validSizes.join(', ')}`);
    }

    const validQualities = ['standard', 'hd'];
    if (config.quality && !validQualities.includes(config.quality)) {
      errors.push(`图像质量必须是以下之一: ${validQualities.join(', ')}`);
    }

    const validStyles = ['vivid', 'natural'];
    if (config.style && !validStyles.includes(config.style)) {
      errors.push(`图像风格必须是以下之一: ${validStyles.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

const imageProcessor = new ImageProcessor();

export { imageProcessor, ImageProcessor };