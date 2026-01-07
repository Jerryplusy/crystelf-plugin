import Path, { defaultConfig } from '../../constants/path.js';
import path from 'path';
import fs from 'fs';
import fc from '../../components/json.js';

const fsp = fs.promises;
const pluginConfigPath = Path.defaultConfigPath;
const dataConfigPath = Path.config;
const configFile = path.join(dataConfigPath, 'config.json');
let configCache = {};
let watchers = [];

/**
 * 初始化配置
 */
async function init() {
  try {
    // 确保数据配置目录存在
    try {
      await fsp.access(dataConfigPath);
    } catch {
      await fsp.mkdir(dataConfigPath, { recursive: true });
      logger.mark(`[crystelf-plugin] 配置目录创建成功: ${dataConfigPath}`);
    }

    // 确保默认配置目录存在
    try {
      await fsp.access(pluginConfigPath);
    } catch {
      logger.warn(`[crystelf-plugin] 默认配置目录不存在: ${pluginConfigPath}`);
    }

    // 处理主配置文件
    const pluginDefaultFile = path.join(pluginConfigPath, 'config.json');
    try {
      await fsp.access(configFile);
    } catch {
      try {
        await fsp.copyFile(pluginDefaultFile, configFile);
        logger.mark(`[crystelf-plugin] 默认配置复制成功: ${configFile}`);
      } catch (copyError) {
        logger.warn(`[crystelf-plugin] 复制默认配置失败,创建空配置: ${copyError}`);
        await fc.writeJSON(configFile, {});
      }
    }
    let pluginFiles = [];
    try {
      pluginFiles = (await fsp.readdir(pluginConfigPath)).filter((f) => f.endsWith('.json'));
    } catch (error) {
      logger.warn(`[crystelf-plugin] 读取默认配置目录失败: ${error}`);
    }

    // 复制缺失的配置文件
    for (const file of pluginFiles) {
      const pluginFilePath = path.join(pluginConfigPath, file);
      const dataFilePath = path.join(dataConfigPath, file);
      try {
        await fsp.access(dataFilePath);
      } catch {
        try {
          await fsp.copyFile(pluginFilePath, dataFilePath);
          logger.mark(`[crystelf-plugin] 配置文件缺失，已复制: ${file}`);
        } catch (copyError) {
          logger.warn(`[crystelf-plugin] 复制配置文件失败 ${file}: ${copyError}`);
        }
      }
    }

    // 读取所有配置文件
    const files = (await fsp.readdir(dataConfigPath)).filter((f) => f.endsWith('.json'));
    configCache = {};

    for (const file of files) {
      const filePath = path.join(dataConfigPath, file);
      const name = path.basename(file, '.json');
      try {
        let data = await fc.readJSON(filePath);
        const pluginFilePath = path.join(pluginConfigPath, file);
        try {
          await fsp.access(pluginFilePath);
          const pluginData = await fc.readJSON(pluginFilePath);

          if (Array.isArray(data) && Array.isArray(pluginData)) {
            // 合并数组类型配置
            const strSet = new Set(data.map((x) => JSON.stringify(x)));
            for (const item of pluginData) {
              const str = JSON.stringify(item);
              if (!strSet.has(str)) {
                data.push(item);
                strSet.add(str);
              }
            }
          } else if (!Array.isArray(data) && !Array.isArray(pluginData)) {
            // 合并对象类型配置
            data = fc.mergeConfig(data, pluginData);
          }

          // 保存合并后的配置
          await fc.writeJSON(filePath, data);
        } catch (mergeError) {
          logger.error('[crystelf-plugin]合并配置失败..');
          logger.error(mergeError);
          // 忽略合并错误,使用现有数据
        }

        configCache[name] = data;
      } catch (e) {
        logger.warn(`[crystelf-plugin] 读取配置文件 ${file} 失败:`, e);
      }
    }

    if (configCache.debug) {
      logger.info('[crystelf-plugin] 配置模块初始化成功..');
    }
  } catch (err) {
    logger.warn('[crystelf-plugin] 配置初始化失败,使用空配置..', err);
    configCache = {};
  }
}

/**
 * 配置文件热更新
 */
function watchConfigs() {
  for (const w of watchers) {
    w.close();
  }
  watchers = [];

  fsp.readdir(dataConfigPath).then((files) => {
    files
      .filter((f) => f.endsWith('.json'))
      .forEach((file) => {
        const filePath = path.join(dataConfigPath, file);
        const watcher = fs.watch(filePath, async (eventType) => {
          if (eventType === 'change') {
            try {
              const data = await fc.readJSON(filePath);
              const name = path.basename(file, '.json');
              configCache[name] = data;
              logger.info(`[crystelf-plugin] 配置热更新: ${file}`);
            } catch (e) {
              logger.warn(`[crystelf-plugin] 热更新读取失败 ${file}:`, e);
            }
          }
        });
        watchers.push(watcher);
      });
  });
}

const configControl = {
  async init() {
    await init();
    watchConfigs();
  },

  get(key) {
    return key ? configCache[key] : configCache;
  },

  async set(key, value) {
    // 更新内存中的配置
    configCache[key] = value;
    const filePath = path.join(dataConfigPath, `${key}.json`);

    try {
      // 尝试访问文件,如果存在则直接写入
      await fsp.access(filePath);
      await fc.writeJSON(filePath, value);
    } catch (error) {
      // 文件不存在,创建新文件
      try {
        // 确保目录存在
        await fsp.mkdir(dataConfigPath, { recursive: true });
        // 直接写入新文件
        await fc.writeJSON(filePath, value);
        logger.mark(`[crystelf-plugin] 创建新配置文件: ${filePath}`);
      } catch (writeError) {
        logger.error(`[crystelf-plugin] 创建配置文件失败: ${writeError}`);
        throw writeError;
      }
    }
  },

  /**
   * 批量设置配置
   * @param {Object} configs - 配置对象，键为配置名，值为配置数据
   */
  async setMultiple(configs) {
    // 确保目录存在
    await fsp.mkdir(dataConfigPath, { recursive: true });

    for (const [key, value] of Object.entries(configs)) {
      try {
        // 更新内存中的配置
        configCache[key] = value;
        const filePath = path.join(dataConfigPath, `${key}.json`);

        // 写入配置文件
        await fc.writeJSON(filePath, value);
      } catch (error) {
        logger.error(`[crystelf-plugin] 设置配置失败 ${key}: ${error}`);
        throw error;
      }
    }
  },

  async save() {
    // 确保目录存在
    await fsp.mkdir(dataConfigPath, { recursive: true });

    for (const [key, value] of Object.entries(configCache)) {
      const filePath = path.join(dataConfigPath, `${key}.json`);

      try {
        // 直接写入配置文件
        await fc.writeJSON(filePath, value);
      } catch (error) {
        logger.error(`[crystelf-plugin] 保存配置文件失败 ${filePath}: ${error}`);
        throw error;
      }
    }
  },

  async reload() {
    await init();
    watchConfigs();
    return true;
  },
};

export default configControl;
