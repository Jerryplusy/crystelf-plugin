import fs from 'fs/promises';
import path from 'path';
import ConfigControl from '../config/configControl.js';

/**
 * 用户AI配置管理器
 * 处理每个用户的独立AI配置，支持用户自定义API密钥、模型等设置
 */
class UserConfigManager {
  constructor() {
    this.basePath = path.join(process.cwd(), 'data', 'crystelf', 'ai');
    this.userConfigs = new Map();
    this.globalConfig = null;
  }

  async init() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      this.globalConfig = await ConfigControl.get('ai');
    } catch (error) {
      logger.error(`[crystelf-ai] 用户配置管理器初始化失败: ${error.message}`);
    }
  }

  /**
   * 获取用户的AI配置
   * @param {string} userId - 用户QQ号
   * @returns {Promise<Object>} 合并后的用户配置
   */
  async getUserConfig(userId) {
    try {
      if (this.userConfigs.has(userId)) {
        return this.userConfigs.get(userId);
      }

      const userConfigPath = path.join(this.basePath, `${userId}.json`);
      let userConfig = {};

      try {
        const configData = await fs.readFile(userConfigPath, 'utf-8');
        userConfig = JSON.parse(configData);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn(`[crystelf-ai] 用户 ${userId} 的配置文件解析失败，使用默认配置: ${error.message}`);
        }
      }
      const mergedConfig = this.mergeConfigs(this.globalConfig, userConfig);
      this.userConfigs.set(userId, mergedConfig);
      
      return mergedConfig;
    } catch (error) {
      logger.error(`[crystelf-ai] 获取用户 ${userId} 配置失败: ${error.message}`);
      return this.globalConfig;
    }
  }

  /**
   * 保存用户配置
   * @param {string} userId - 用户QQ号
   * @param {Object} config - 用户配置
   */
  async saveUserConfig(userId, config) {
    try {
      const userConfigPath = path.join(this.basePath, `${userId}.json`);
      const filteredConfig = this.filterUserConfig(config);
      
      await fs.writeFile(userConfigPath, JSON.stringify(filteredConfig, null, 2));
      const mergedConfig = this.mergeConfigs(this.globalConfig, filteredConfig);
      this.userConfigs.set(userId, mergedConfig);
    } catch (error) {
      logger.error(`[crystelf-ai] 保存用户 ${userId} 配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 合并全局配置和用户配置
   * @param {Object} globalConfig - 全局配置
   * @param {Object} userConfig - 用户配置
   * @returns {Object} 合并后的配置
   */
  mergeConfigs(globalConfig, userConfig) {
    if (!globalConfig) return userConfig;
    if (!userConfig || Object.keys(userConfig).length === 0) return globalConfig;
    const mergedConfig = JSON.parse(JSON.stringify(globalConfig));
    for (const [key, value] of Object.entries(userConfig)) {
      if (this.isUserConfigurable(key)) {
        mergedConfig[key] = value;
      }
    }

    return mergedConfig;
  }

  /**
   * 判断配置项是否允许用户自定义
   * @param {string} key - 配置项键名
   * @returns {boolean} 是否允许用户配置
   */
  isUserConfigurable(key) {
    const forbiddenKeys = [
      'blacklist', 'whitelist', 'blackWords', 
      'enableGroups', 'disableGroups'
    ];
    
    return !forbiddenKeys.includes(key);
  }

  /**
   * 过滤用户配置，移除不允许的配置项
   * @param {Object} config - 原始配置
   * @returns {Object} 过滤后的配置
   */
  filterUserConfig(config) {
    const filtered = {};
    
    for (const [key, value] of Object.entries(config)) {
      if (this.isUserConfigurable(key)) {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }

  /**
   * 清除用户配置缓存
   * @param {string} userId - 用户QQ号，如果不传则清除所有缓存
   */
  clearCache(userId) {
    if (userId) {
      this.userConfigs.delete(userId);
    } else {
      this.userConfigs.clear();
    }
  }

  /**
   * 重新加载全局配置
   */
  async reloadGlobalConfig() {
    this.globalConfig = await ConfigControl.get('ai');
    this.clearCache(); // 清除缓存，下次获取时会重新合并配置
  }

  /**
   * 获取用户配置目录路径
   * @returns {string} 用户配置目录路径
   */
  getUserConfigPath() {
    return this.basePath;
  }

  /**
   * 检查用户是否存在自定义配置
   * @param {string} userId - 用户QQ号
   * @returns {Promise<boolean>} 是否存在自定义配置
   */
  async hasUserConfig(userId) {
    try {
      const userConfigPath = path.join(this.basePath, `${userId}.json`);
      await fs.access(userConfigPath);
      return true;
    } catch {
      return false;
    }
  }
}

export default new UserConfigManager();