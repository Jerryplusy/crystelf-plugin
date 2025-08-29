import url from 'url';
import fs from 'fs';
import path from 'path';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

//这里储存的都是绝对路径
const Path = {
  root: rootDir,
  apps: path.join(rootDir, 'apps'),
  components: path.join(rootDir, 'components'),
  defaultConfig: path.join(rootDir, 'config/config.json'),
  defaultConfigPath: path.join(rootDir, 'config'),
  config: path.resolve(rootDir, '../../data/crystelf'),
  constants: path.join(rootDir, 'constants'),
  lib: path.join(rootDir, 'lib'),
  models: path.join(rootDir, 'models'),
  index: path.join(rootDir, 'index.js'),
  pkg: path.join(rootDir, 'package.json'),
  yunzai: path.join(rootDir, '../../'),
  data: path.join(rootDir, '../../data/crystelf/data'),
  rssHTML: path.join(rootDir, 'constants/rss/rss_template.html'),
  rssCache: path.join(rootDir, '../../data/crystelf'),
};

const configFile = fs.readFileSync(Path.defaultConfig, 'utf8');
export const defaultConfig = JSON.parse(configFile);

export default Path;
