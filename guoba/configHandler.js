import ConfigControl from '../lib/config/configControl.js';
import UserConfigManager from '../lib/ai/userConfigManager.js';
import lodash from 'lodash';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * 配置处理逻辑
 * 处理锅巴WebUI的配置读取、设置和保存
 */

/**
 * 将嵌套对象转换为扁平化的点分隔路径
 * @param {Object} obj - 要扁平化的对象
 * @param {string} prefix - 前缀
 * @returns {Object} 扁平化的对象
 */
function flattenObject(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    // 跳过以?开头的注释字段
    if (key.startsWith('?')) continue;

    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // 递归处理嵌套对象
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * 获取当前配置
 * @returns {Promise<Object>} 当前配置对象
 */
export function getConfigData() {
  // 获取所有配置文件
  const allConfigs = ConfigControl.get();
  const result = {};

  // 将各个配置文件的内容扁平化到结果对象中
  for (const [configName, configData] of Object.entries(allConfigs)) {
    if (configName === 'feeds' || configName === 'newcomer') continue;
    // 将配置数据扁平化
    const flattened = flattenObject(configData, configName);
    Object.assign(result, flattened);
  }

  return result;
}

/**
 * 设置配置数据
 * @param {Object} data - 新的配置数据
 * @param {Object} options - 选项对象，包含Result等
 * @returns {Promise<Object>} 操作结果
 */
export async function setConfigData(data, { Result }) {
  try {
    // 将扁平化的数据重新组织成配置文件结构
    const configUpdates = {};

    for (const [fieldPath, value] of Object.entries(data)) {
      const parts = fieldPath.split('.');
      const configName = parts[0];

      // 跳过feeds和newcomer配置
      if (configName === 'feeds' || configName === 'newcomer') continue;

      if (!configUpdates[configName]) {
        configUpdates[configName] = {};
      }

      // 使用lodash.set设置嵌套属性
      const keyPath = parts.slice(1).join('.');
      lodash.set(configUpdates[configName], keyPath, value);
    }

    // 只更新实际有变化的配置文件
    for (const [configName, newConfigData] of Object.entries(configUpdates)) {
      // 获取现有配置
      const existingConfig = ConfigControl.get(configName) || {};

      // 检查配置是否真的发生了变化
      const isChanged = !lodash.isEqual(
        newConfigData,
        lodash.pick(existingConfig, Object.keys(newConfigData))
      );

      if (isChanged) {
        // 合并配置（保留注释字段）
        const updatedConfig = lodash.merge({}, existingConfig, newConfigData);

        // 保存配置
        await ConfigControl.set(configName, updatedConfig);
      }
    }

    return Result.ok({}, '保存成功~');
  } catch (error) {
    logger.error('[crystelf-plugin] 保存配置失败:', error);
    return Result.error('保存配置失败: ' + error.message);
  }
}

/**
 * 重置配置为默认值
 * @param {Object} options - 选项对象,包含Result等
 * @returns {Promise<Object>} 操作结果
 */
export async function resetConfig({ Result }) {
  try {
    // 获取插件目录路径
    const __filename = fileURLToPath(import.meta.url);
    const pluginDir = path.dirname(__filename);
    const configDir = path.join(pluginDir, '..', '..', 'config');

    // 获取数据目录路径
    const dataConfigPath = path.join(process.cwd(), 'data', 'crystelf');

    // 确保数据目录存在
    if (!fs.existsSync(dataConfigPath)) {
      fs.mkdirSync(dataConfigPath, { recursive: true });
    }

    // 读取所有配置文件
    const configFiles = fs.readdirSync(configDir).filter((file) => file.endsWith('.json'));
    const defaultConfigs = {};

    // 复制每个配置文件
    for (const file of configFiles) {
      const configName = path.basename(file, '.json');
      const sourcePath = path.join(configDir, file);
      const targetPath = path.join(dataConfigPath, file);

      try {
        // 读取源配置文件
        const configContent = fs.readFileSync(sourcePath, 'utf8');
        const configData = JSON.parse(configContent);

        // 写入目标配置文件
        fs.writeFileSync(targetPath, configContent, 'utf8');

        // 添加到默认配置对象
        defaultConfigs[configName] = configData;
      } catch (error) {
        logger.error(`[crystelf-ai] 复制配置文件失败 ${file}: ${error.message}`);
        return Result.error({}, `复制配置文件失败 ${file}: ${error.message}`);
      }
    }

    // 使用 ConfigControl.setMultiple 重置所有配置
    await ConfigControl.setMultiple(defaultConfigs);

    // 清除用户配置缓存
    UserConfigManager.clearCache();

    return Result.ok({}, '重置成功~');
  } catch (error) {
    logger.error(`[crystelf-ai] 重置配置失败: ${error.message}`);
    return Result.error({}, `重置失败: ${error.message}`);
  }
}

/**
 * 导出配置
 * @param {Object} options - 选项对象，包含Result等
 * @returns {Promise<Object>} 操作结果，包含配置数据
 */
export async function exportConfig({ Result }) {
  try {
    const config = await getConfigData();
    return Result.ok({ config }, '导出成功~');
  } catch (error) {
    logger.error(`[crystelf-ai] 导出配置失败: ${error.message}`);
    return Result.error({}, `导出失败: ${error.message}`);
  }
}

/**
 * 导入配置
 * @param {Object} data - 包含配置数据的对象
 * @param {Object} options - 选项对象,包含Result等
 * @returns {Promise<Object>} 操作结果
 */
export async function importConfig(data, { Result }) {
  try {
    if (!data.config) {
      return Result.error({}, '导入数据格式错误');
    }

    // 验证配置
    const validationResult = validateConfig(data.config);
    if (!validationResult.valid) {
      return Result.error({}, `配置验证失败: ${validationResult.errors.join(', ')}`);
    }

    // 使用 ConfigControl.setMultiple 保存配置
    await ConfigControl.setMultiple(data.config);

    // 清除用户配置缓存
    UserConfigManager.clearCache();

    return Result.ok({}, '导入成功~');
  } catch (error) {
    logger.error(`[crystelf-ai] 导入配置失败: ${error.message}`);
    return Result.error({}, `导入失败: ${error.message}`);
  }
}

/**
 * 验证配置
 * @param {string|Object} configType - 配置类型或配置对象
 * @param {Object} config - 要验证的配置对象（当第一个参数是配置类型时）
 * @returns {Object} 验证结果,包含valid和errors
 */
function validateConfig(configType, config = null) {
  // 如果只有一个参数,则认为是配置对象,进行通用验证
  if (config === null) {
    config = configType;
    configType = 'general';
  }

  const errors = [];

  // 根据配置类型进行特定验证
  switch (configType) {
    case 'ai':
      // 验证AI配置
      if (!config.baseApi) {
        errors.push('API基础地址不能为空');
      }

      if (!config.mode) {
        errors.push('对话模式不能为空');
      }

      if (!config.apiKey) {
        errors.push('API密钥不能为空');
      }

      if (!config.modelType) {
        errors.push('模型名称不能为空');
      }

      if (!config.multimodalModel) {
        errors.push('多模态模型名称不能为空');
      }

      if (!config.character) {
        errors.push('表情包角色不能为空');
      }

      if (!config.botPersona) {
        errors.push('机器人人设不能为空');
      }

      // 验证数值范围
      if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
        errors.push('温度值必须在0-2之间');
      }

      if (config.concurrency !== undefined && (config.concurrency < 1 || config.concurrency > 10)) {
        errors.push('并发数必须在1-10之间');
      }

      if (
        config.chatHistory !== undefined &&
        (config.chatHistory < 1 || config.chatHistory > 100)
      ) {
        errors.push('聊天历史长度必须在1-100之间');
      }

      // 验证数组字段
      if (config.blockGroup && !Array.isArray(config.blockGroup)) {
        errors.push('禁用群聊必须是数组');
      }

      if (config.whiteGroup && !Array.isArray(config.whiteGroup)) {
        errors.push('白名单群聊必须是数组');
      }
      break;

    case '60s':
      // 验证60s新闻配置
      if (!config.url) {
        errors.push('60s新闻API地址不能为空');
      }
      break;

    case 'auth':
      // 验证验证配置
      if (!config.url) {
        errors.push('验证API地址不能为空');
      }
      break;

    case 'music':
      // 验证音乐配置
      if (!config.url) {
        errors.push('音乐服务器url不能为空');
      }
      if (!config.username) {
        errors.push('音乐服务器用户名不能为空');
      }
      if (!config.password) {
        errors.push('音乐服务器密码不能为空');
      }
      if (!config.quality) {
        errors.push('音乐质量不能为空');
      }
      break;

    case 'poke':
      // 验证戳一戳配置
      if (config.replyPoke !== undefined && (config.replyPoke < 0 || config.replyPoke > 1)) {
        errors.push('戳一戳概率必须在0-1之间');
      }
      break;

    case 'profile':
      // 验证个人资料配置
      if (!config.nickName) {
        errors.push('机器人昵称不能为空');
      }
      break;

    case 'coreConfig':
      // 验证核心配置
      if (!config.coreUrl) {
        errors.push('核心url不能为空');
      }
      break;

    default:
      // 通用验证
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
