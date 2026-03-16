import Path from '../../constants/path.js';
import path from 'path';
import fs from 'fs';
import fc from '../../components/json.js';

const fsp = fs.promises;
const pluginConfigPath = Path.defaultConfigPath;
const dataConfigPath = Path.config;
const configFile = path.join(dataConfigPath, 'config.json');
const LEGACY_AI_KEYS = [
  'mode',
  'baseApi',
  'modelType',
  'multimodalEnabled',
  'smartMultimodal',
  'multimodalModel',
  'maxMix',
  'timeout',
  'chatHistory',
  'getChatHistoryLength',
  'keywordCache',
  'blockGroup',
  'whiteGroup',
  'character',
  'botPersona',
  'memeConfig',
  'imageConfig',
];
let configCache = {};
let watchers = [];

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function toArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergePlainObject(defaultValue, currentValue) {
  return {
    ...(isObject(defaultValue) ? deepClone(defaultValue) : {}),
    ...(isObject(currentValue) ? currentValue : {}),
  };
}

function isLegacyAiConfig(config) {
  return isObject(config) && LEGACY_AI_KEYS.some((key) => key in config);
}

function migrateLegacyAiConfig(legacyConfig, defaultAiConfig) {
  const migrated = deepClone(defaultAiConfig);

  migrated.apiUrl = legacyConfig.apiUrl || legacyConfig.baseApi || migrated.apiUrl;
  migrated.apiKey = legacyConfig.apiKey || migrated.apiKey;
  migrated.model = legacyConfig.model || legacyConfig.modelType || migrated.model;
  migrated.workingModel = legacyConfig.workingModel || legacyConfig.modelType || migrated.workingModel;
  migrated.multimodalWorkingModel =
    legacyConfig.multimodalWorkingModel || legacyConfig.multimodalModel || migrated.multimodalWorkingModel;
  migrated.isMultimodal =
    typeof legacyConfig.isMultimodal === 'boolean'
      ? legacyConfig.isMultimodal
      : typeof legacyConfig.multimodalEnabled === 'boolean'
        ? legacyConfig.multimodalEnabled
        : migrated.isMultimodal;
  migrated.nicknames = toArray(legacyConfig.nicknames, migrated.nicknames);
  migrated.persona = legacyConfig.persona || legacyConfig.botPersona || migrated.persona;
  migrated.maxContextTokens = legacyConfig.maxContextTokens || migrated.maxContextTokens;
  migrated.temperature = legacyConfig.temperature ?? migrated.temperature;
  migrated.historyCount =
    legacyConfig.historyCount || legacyConfig.getChatHistoryLength || legacyConfig.chatHistory || migrated.historyCount;
  migrated.maxIterations = legacyConfig.maxIterations ?? migrated.maxIterations;
  migrated.blacklistGroups = toArray(legacyConfig.blacklistGroups || legacyConfig.blockGroup, migrated.blacklistGroups);
  migrated.whitelistGroups = toArray(legacyConfig.whitelistGroups || legacyConfig.whiteGroup, migrated.whitelistGroups);
  migrated.imageAnalysisBlacklistUsers = toArray(
    legacyConfig.imageAnalysisBlacklistUsers,
    migrated.imageAnalysisBlacklistUsers,
  );
  migrated.maxSessions = legacyConfig.maxSessions || migrated.maxSessions;
  migrated.enableGroupAdmin =
    typeof legacyConfig.enableGroupAdmin === 'boolean'
      ? legacyConfig.enableGroupAdmin
      : migrated.enableGroupAdmin;
  migrated.cooldownAfterReplyMs = legacyConfig.cooldownAfterReplyMs || migrated.cooldownAfterReplyMs;

  migrated.dynamicDelay = mergePlainObject(migrated.dynamicDelay, legacyConfig.dynamicDelay);
  migrated.personality = mergePlainObject(migrated.personality, legacyConfig.personality);
  migrated.replyStyle = mergePlainObject(migrated.replyStyle, legacyConfig.replyStyle);
  migrated.memory = mergePlainObject(migrated.memory, legacyConfig.memory);
  migrated.topic = mergePlainObject(migrated.topic, legacyConfig.topic);
  migrated.planner = mergePlainObject(migrated.planner, legacyConfig.planner);
  migrated.typo = mergePlainObject(migrated.typo, legacyConfig.typo);
  migrated.emoji = mergePlainObject(migrated.emoji, legacyConfig.emoji);
  migrated.expression = mergePlainObject(migrated.expression, legacyConfig.expression);

  if (legacyConfig.character && (!Array.isArray(migrated.emoji.characters) || migrated.emoji.characters.length === 0)) {
    migrated.emoji.characters = [legacyConfig.character];
  }
  if (legacyConfig.memeConfig?.character && (!Array.isArray(migrated.emoji.characters) || migrated.emoji.characters.length === 0)) {
    migrated.emoji.characters = [legacyConfig.memeConfig.character];
  }
  if (Array.isArray(legacyConfig.memeConfig?.availableEmotions) && legacyConfig.memeConfig.availableEmotions.length > 0) {
    migrated.emoji.availableEmotions = legacyConfig.memeConfig.availableEmotions;
  }

  return migrated;
}

async function migrateConfigIfNeeded(name, data, pluginData, filePath) {
  if (name !== 'ai' || !isLegacyAiConfig(data)) {
    return data;
  }

  const migrated = migrateLegacyAiConfig(data, pluginData);
  await fc.writeJSON(filePath, migrated);
  logger.mark('[crystelf-plugin] 检测到旧版 AI 配置，已自动迁移到新版本');
  return migrated;
}

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

    try {
      await fsp.access(pluginConfigPath);
    } catch {
      logger.warn(`[crystelf-plugin] 默认配置目录不存在: ${pluginConfigPath}`);
    }

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

          data = await migrateConfigIfNeeded(name, data, pluginData, filePath);

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
        } catch (mergeError) {
          logger.error('[crystelf-plugin]合并配置失败..');
          logger.error(mergeError);
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
  for (const watcher of watchers) {
    watcher.close();
  }
  watchers = [];

  fsp.readdir(dataConfigPath).then((files) => {
    files
      .filter((f) => f.endsWith('.json'))
      .forEach((file) => {
        const filePath = path.join(dataConfigPath, file);
        const watcher = fs.watch(filePath, async (eventType) => {
          if (eventType !== 'change') return;
          try {
            const name = path.basename(file, '.json');
            let data = await fc.readJSON(filePath);
            const pluginFilePath = path.join(pluginConfigPath, file);
            let pluginData = {};
            try {
              pluginData = await fc.readJSON(pluginFilePath);
            } catch {}
            data = await migrateConfigIfNeeded(name, data, pluginData, filePath);
            configCache[name] = data;
            logger.info(`[crystelf-plugin] 配置热更新: ${file}`);
          } catch (e) {
            logger.warn(`[crystelf-plugin] 热更新读取失败 ${file}:`, e);
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
    } catch (error) {
      try {
        await fsp.mkdir(dataConfigPath, { recursive: true });
        await fc.writeJSON(filePath, value);
        logger.mark(`[crystelf-plugin] 创建新配置文件: ${filePath}`);
      } catch (writeError) {
        logger.error(`[crystelf-plugin] 创建配置文件失败: ${writeError}`);
        throw writeError;
      }
    }
  },

  async setMultiple(configs) {
    await fsp.mkdir(dataConfigPath, { recursive: true });

    for (const [key, value] of Object.entries(configs)) {
      try {
        configCache[key] = value;
        const filePath = path.join(dataConfigPath, `${key}.json`);
        await fc.writeJSON(filePath, value);
      } catch (error) {
        logger.error(`[crystelf-plugin] 设置配置失败 ${key}: ${error}`);
        throw error;
      }
    }
  },

  async save() {
    await fsp.mkdir(dataConfigPath, { recursive: true });

    for (const [key, value] of Object.entries(configCache)) {
      const filePath = path.join(dataConfigPath, `${key}.json`);
      try {
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
