import Path, { defaultConfig } from '../../constants/path.js';
import fc from '../../components/json.js';
import path from 'path';
import fs from 'fs';
import relativelyPath from '../../constants/relativelyPath.js';

const configPath = Path.config;
const dataPath = Path.data;
const configFile = path.join(configPath, 'config.json');
const configDir = relativelyPath.config;

let configCache = {};
let lastModified = 0;

function init() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
      fs.mkdirSync(dataPath, { recursive: true });
      logger.mark(`crystelf 配置文件夹创建成功,位于 ${configPath}..`);
    }

    if (!fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 4), 'utf8');
      logger.mark('crystelf 配置文件创建成功..');
    } else {
      const cfgFile = fs.readFileSync(configFile, 'utf8');
      const loadedConfig = JSON.parse(cfgFile);
      const cfg = { ...defaultConfig, ...loadedConfig };

      if (JSON.stringify(cfg) !== JSON.stringify(loadedConfig)) {
        fs.writeFileSync(configFile, JSON.stringify(cfg, null, 4), 'utf8');
        logger.mark('crystelf 配置文件已更新，补充配置项..');
      }
    }

    const stats = fc.statSync(configDir, 'root');
    configCache = fc.readJSON(configDir, 'root');
    lastModified = stats.mtimeMs;

    if (configCache.debug) {
      logger.info('crystelf-plugin 配置模块初始化成功..');
    }
  } catch (err) {
    logger.warn('crystelf-plugin 初始化配置失败，使用空配置..', err);
    configCache = {};
  }
}

const configControl = {
  async init() {
    init();
  },

  get(key) {
    return key ? configCache[key] : configCache;
  },

  async set(key, value) {
    configCache[key] = value;
    return fc.safeWriteJSON(configDir, configCache, 'root', 4);
  },

  async save() {
    return fc.safeWriteJSON(configDir, configCache, 'root', 4);
  },

  async reload() {
    await init();
    return true;
  },
};

export default configControl;
