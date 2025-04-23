import Path from '../../constants/path.js';
import fc from '../../components/json.js';
import path from 'path';

let configCache = null;
let lastModified = 0;
const configPath = Path.config;
const configFile = path.join(configPath, 'config.json');
const configControl = {
  async getConfig() {
    try {
      const stats = await fc.statSync(configFile, 'root');
      if (!configCache || stats.mtimeMs > lastModified) {
        configCache = await fc.readJSON(configFile, 'root');
        lastModified = stats.mtimeMs;
      }
      return configCache;
    } catch (err) {
      console.error('读取配置失败:', err);
      return {};
    }
  },
  async updateConfig(updater) {
    try {
      const config = this.getConfig();
      configCache = { ...config, ...updater };
      fc.safeWriteJSON(configFile, configCache, 'root', 4);
    } catch (err) {
      console.error('更新配置失败:', err);
    }
  },
};
export default configControl;
