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
    try {
      await fsp.access(dataConfigPath);
    } catch {
      await fsp.mkdir(dataConfigPath, { recursive: true });
      logger.mark(`[crystelf-plugin] 配置目录创建成功: ${dataConfigPath}`);
    }
    const pluginDefaultFile = path.join(pluginConfigPath, 'config.json');
    try {
      await fsp.access(configFile);
    } catch {
      await fsp.copyFile(pluginDefaultFile, configFile);
      logger.mark(`[crystelf-plugin] 默认配置复制成功: ${configFile}`);
    }
    const pluginFiles = (await fsp.readdir(pluginConfigPath)).filter((f) => f.endsWith('.json'));
    for (const file of pluginFiles) {
      const pluginFilePath = path.join(pluginConfigPath, file);
      const dataFilePath = path.join(dataConfigPath, file);
      try {
        await fsp.access(dataFilePath);
      } catch {
        await fsp.copyFile(pluginFilePath, dataFilePath);
        logger.mark(`[crystelf-plugin] 配置文件缺失，已复制: ${file}`);
      }
    }
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
            const strSet = new Set(data.map((x) => JSON.stringify(x)));
            for (const item of pluginData) {
              const str = JSON.stringify(item);
              if (!strSet.has(str)) {
                data.push(item);
                strSet.add(str);
              }
            }
          } else if (!Array.isArray(data) && !Array.isArray(pluginData)) {
            data = fc.mergeConfig(data, pluginData);
          }
          await fc.writeJSON(filePath, data);
        } catch {}
        configCache[name] = data;
      } catch (e) {
        logger.warn(`[crystelf-plugin] 读取配置文件 ${file} 失败:`, e);
      }
    }
    if (configCache.debug) {
      logger.info('[crystelf-plugin] 配置模块初始化成功..');
    }
  } catch (err) {
    logger.warn('[crystelf-plugin] 配置初始化失败，使用空配置..', err);
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
    configCache[key] = value;
    const filePath = path.join(dataConfigPath, `${key}.json`);
    try {
      await fsp.access(filePath);
      await fc.writeJSON(filePath, value);
    } catch {
      let cfg = await fc.readJSON(configFile);
      if (Array.isArray(cfg)) {
        cfg.push(value);
      } else {
        cfg[key] = value;
      }
      await fc.writeJSON(configFile, cfg);
    }
  },

  async save() {
    for (const [key, value] of Object.entries(configCache)) {
      const filePath = path.join(dataConfigPath, `${key}.json`);
      try {
        await fsp.access(filePath);
        await fc.writeJSON(filePath, value);
      } catch {
        let cfg = await fc.readJSON(configFile);
        if (Array.isArray(cfg)) {
          cfg = value;
        } else {
          cfg[key] = value;
        }
        await fc.writeJSON(configFile, cfg);
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
