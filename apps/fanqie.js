import fs from 'node:fs';
import path from 'path';
import chokidar from 'chokidar';
import ConfigControl from '../lib/config/configControl.js';
import Fanqie from '../modules/apps/fanqie/fanqie.js';

/**
 * 本功能由 y68(github@yeqiu6080) 提供技术支持
 */
export default class FanqiePlugin extends plugin {
  constructor() {
    super({
      name: 'crystelf-fanqie',
      dsc: '番茄小说下载器',
      event: 'message',
      priority: -114,
      rule: [
        {
          reg: '(changdunovel.com/wap/share-v2.html|fanqienovel.com/page)',
          fnc: 'handleFanqieLink',
        },
        {
          reg: '#?fq下载(.*)',
          fnc: 'downloadByBookId',
        },
        {
          reg: '^fq清(理|除|空)缓存$',
          fnc: 'clearFanqieCache',
        },
      ],
    });

    this.initPromise = this.initFanqieConfig();
    this.fanqieClient = null;

    // 注册计划任务
    this.task = {
      cron: '0 0 16 * * ?',
      name: '定时清理番茄缓存',
      fnc: () => this.clearFanqieCache(false, true),
    };
  }

  async initFanqieConfig() {
    this.outDir = await ConfigControl.get('fanqieConfig')?.outDir;
    this.apiUrl = await ConfigControl.get('fanqieConfig')?.url;
    this.fanqieClient = new Fanqie(this.apiUrl);
  }

  /**
   * 监听下载输出目录
   */
  async waitForOutputFile(dir, timeout = 30000) {
    if (!dir) return false;

    return new Promise((resolve) => {
      const watcher = chokidar.watch(dir, {
        persistent: true,
        ignoreInitial: true,
      });

      const timer = setTimeout(() => {
        watcher.close();
        resolve(false);
      }, timeout);

      watcher.on('add', (filePath) => {
        clearTimeout(timer);
        watcher.close();
        resolve(filePath);
      });
    });
  }

  /**
   * 清理缓存
   */
  async clearFanqieCache(e, isScheduled = false, specificId = false) {
    if (!isScheduled && e && !e.isMaster) {
      e.reply('你没有权限使用此功能', true);
      return false;
    }

    if (!this.outDir) {
      await this.initPromise;
      if (!this.outDir) {
        if (e) e.reply('缓存目录未初始化，无法清理', true);
        return false;
      }
    }

    if (specificId) {
      const specificPath = path.join(this.outDir, 'files', specificId);
      if (fs.existsSync(specificPath)) {
        fs.rmSync(specificPath, { recursive: true, force: true });
      }
    }

    const mainCachePath = path.join(this.outDir, 'fanqie');
    if (fs.existsSync(mainCachePath)) {
      fs.readdirSync(mainCachePath).forEach((file) => {
        const fullPath = path.join(mainCachePath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      });
    }

    if (!isScheduled && e) e.reply('缓存清理完成', true);
    return true;
  }

  /**
   * 解析网页链接中的 book_id
   */
  async handleFanqieLink(e) {
    if (!ConfigControl.get()?.config?.fanqie) {
      return;
    }
    const message = e.msg.trim();
    let bookId = null;

    try {
      if (message.includes('changdunovel.com')) {
        bookId = message.match(/book_id=(\d+)/)[1];
      } else {
        bookId = message.match(/page\/(\d+)/)[1];
      }
    } catch {
      return e.reply('解析失败，请检查链接是否正确', true);
    }

    return this.downloadFanqieBook(e, bookId);
  }

  /**
   * 使用 #fq下载 命令下载
   */
  async downloadByBookId(e) {
    if (!ConfigControl.get()?.config?.fanqie) {
      return;
    }
    const bookId = e.msg.replace(/^#?fq下载/, '').trim();
    return this.downloadFanqieBook(e, bookId);
  }

  /**
   * 执行下载并上传文件
   */
  async downloadFanqieBook(e, bookId) {
    await this.initPromise;

    let bookInfo;
    try {
      bookInfo = await this.fanqieClient.get_info(bookId);
    } catch (err) {
      logger.error(err);
      return e.reply('获取小说信息失败', true);
    }

    if (!bookInfo) return e.reply('获取失败，请稍后再试', true);

    e.reply(
      `识别小说：[番茄小说]《${bookInfo.book_name}》\n作者：${bookInfo.author}\n原名：${bookInfo.original_book_name}`,
      true
    );

    e.reply('开始下载，请稍等片刻...', true);
    const startTime = Date.now();

    try {
      await this.fanqieClient.down(bookId, e.message_id);
    } catch (err) {
      logger.error(err);
      return e.reply('下载失败，请稍后重试', true);
    }

    const outPath = path.join(this.outDir, 'files', String(e.message_id));
    let finalFilePath = await this.waitForOutputFile(outPath);
    if (!finalFilePath) return e.reply('下载超时', true);

    // 文件重命名防止空格
    const safePath = finalFilePath.replace(/ /g, '_');
    if (finalFilePath !== safePath) {
      try {
        fs.renameSync(finalFilePath, safePath);
        finalFilePath = safePath;
      } catch (err) {
        logger.error(`重命名失败：${err.stack}`);
        return e.reply('重命名失败', true);
      }
    }

    const uploaded = await this.sendFileToUser(e, finalFilePath);
    await this.clearFanqieCache(false, true, String(e.message_id));

    if (!uploaded) return e.reply('上传失败', true);

    e.reply(`《${bookInfo.book_name}》上传成功，耗时 ${(Date.now() - startTime) / 1000}s`);
    return true;
  }

  /**
   * 上传文件至群或私聊
   */
  async sendFileToUser(e, filePath) {
    try {
      const fileName = path.basename(filePath);
      if (e.isGroup) {
        return await e.bot.sendApi('upload_group_file', {
          group_id: e.group_id,
          file: filePath,
          name: fileName,
        });
      } else if (e.friend) {
        return await e.bot.sendApi('upload_private_file', {
          user_id: e.user_id,
          file: filePath,
          name: fileName,
        });
      }
    } catch (err) {
      logger.error(`文件上传失败：${logger.red(err.stack)}`);
      e.reply(`上传失败：${err.message}`, true);
      return null;
    }
  }
}
