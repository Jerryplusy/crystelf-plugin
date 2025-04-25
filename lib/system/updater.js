import child_process from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Path from '../../constants/path.js';

const GIT_DIR = path.join(Path.root, '.git');

const execStr = (cmd) => child_process.execSync(cmd, { cwd: Path.root }).toString().trim();

const Updater = {
  isGitRepo() {
    return fs.existsSync(GIT_DIR);
  },

  getBranch() {
    return execStr('git symbolic-ref --short HEAD');
  },

  getLocalHash() {
    return execStr('git rev-parse HEAD');
  },

  getRemoteHash(branch = 'main') {
    return execStr(`git rev-parse origin/${branch}`);
  },

  async hasUpdate() {
    try {
      const branch = this.getBranch();

      await new Promise((resolve, reject) => {
        child_process.exec('git fetch', { cwd: Path.root }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      const local = this.getLocalHash();
      const remote = this.getRemoteHash(branch);

      return local !== remote;
    } catch (err) {
      logger.error('[crystelf-plugin] 检查更新失败:', err);
      return false;
    }
  },

  async update() {
    logger.mark(chalk.cyan('[crystelf-plugin] 检测到插件有更新，自动执行 git pull'));
    child_process.execSync('git pull', {
      cwd: Path.root,
      stdio: 'inherit',
    });
    logger.mark(chalk.green('[crystelf-plugin] 插件已自动更新完成'));
  },

  async checkAndUpdate() {
    if (!this.isGitRepo()) {
      logger.warn('[crystelf-plugin] 当前目录不是 Git 仓库，自动更新功能已禁用');
      return;
    }

    try {
      if (await this.hasUpdate()) {
        await this.update();
      } else {
        logger.info('[crystelf-plugin] 当前已是最新版本，无需更新');
      }
    } catch (err) {
      logger.error('[crystelf-plugin] 自动更新失败:', err);
    }
  },
};

export default Updater;
