import chalk from 'chalk';
import Version from './lib/system/version.js';
import fc from './components/json.js';
import Path from './constants/path.js';
import { crystelfInit } from './lib/system/init.js';
import updater from './lib/system/updater.js';

logger.info(
  chalk.rgb(134, 142, 204)(`crystelf-plugin ${Version.ver} 初始化~ by ${Version.author}`)
);

updater.checkAndUpdate().catch((err) => {
  logger.err(err);
});

await crystelfInit.CSH().then(logger.mark('[crystelf-plugin] crystelf-plugin 完成初始化'));

const appPath = Path.apps;
const jsFiles = await fc.readDirRecursive(appPath, 'js');

let ret = jsFiles.map((file) => {
  return import(`./apps/${file}`);
});

ret = await Promise.allSettled(ret);

let apps = {};
for (let i in jsFiles) {
  let name = jsFiles[i].replace('.js', '');

  if (ret[i].status !== 'fulfilled') {
    logger.error(name, ret[i].reason);
    continue;
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
}

export { apps };
