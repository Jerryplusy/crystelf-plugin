import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');

const Path = {
  root: rootDir,
  apps: path.join(rootDir, 'apps'),
  components: path.join(rootDir, 'components'),
  config: path.join(rootDir, 'config'),
  constants: path.join(rootDir, 'constants'),
  lib: path.join(rootDir, 'lib'),
  models: path.join(rootDir, 'models'),
  index: path.join(rootDir, 'index.js'),
  pkg: path.join(rootDir, 'package.json'),
};

export default Path;
