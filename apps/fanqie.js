import fs from 'node:fs';
import path from 'path';
import chokidar from 'chokidar';
import ConfigControl from '../lib/config/configControl.js';
import configControl from '../lib/config/configControl.js';
import Fanqie from '../models/apps/fanqie/fanqie.js';
import axios from 'axios';
import FormData from 'form-data';

let redis = global.redis;

export class xzq extends plugin {
  constructor() {
    super({
      name: 'fanqie',
      dsc: 'fq下载器',
      event: 'message',
      priority: -114,
      rule: [
        {
          reg: '(changdunovel.com/wap/share-v2.html|fanqienovel.com/page)',
          fnc: 'jx',
        },
        {
          reg: '#?fq下载(.*)',
          fnc: 'byid',
        },
        {
          reg: '^fq(允许|禁止)(群|用户)使用',
          fnc: 'control',
        },
        {
          reg: '^fq清(理|除|空)缓存$',
          fnc: 'clearCache',
        },
      ],
    });
    this.initConfigPromise = this.initConfig();
    this.fq = null;
    this.task = {
      cron: '0 0 16 * * ?',
      name: 'fq自动清理缓存',
      fnc: () => this.clearCache(false, true),
    };
  }

  async initConfig() {
    this.outDir = await ConfigControl.get('fanqieConfig')?.outDir;
    this.apiurl = await ConfigControl.get('fanqieConfig')?.url;
    this.fq = new Fanqie(this.apiurl);
  }

  async listen_outdir(dir, timeout = 30000) {
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
      console.log(`已开始监听目录: ${dir}`);
    });
  }

  async clearCache(e, is_task = false, zd = false) {
    if (!is_task && (!e || !e.isMaster)) {
      if (e) e.reply('你没有权限使用此功能', true);
      return false;
    }
    if (!this.outDir) {
      await this.initConfigPromise;
      if (!this.outDir) {
        if (e) e.reply('缓存目录未初始化，无法清理缓存', true);
        return false;
      }
    }

    if (zd) {
      const targetDir = path.join(this.outDir, 'files', zd);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    }

    const fanqieDir = path.join(this.outDir, 'fanqie');
    if (fs.existsSync(fanqieDir)) {
      fs.readdirSync(fanqieDir).forEach((file) => {
        const fullPath = path.join(fanqieDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
      });
    }

    if (!is_task && e) e.reply('缓存已清理', true);
    return true;
  }

  async control(e) {
    if (!e.isMaster) return e.reply('你没有权限使用此功能', true);

    let id = e.msg.trim().replace(/^fq(允许|禁止)(群|用户)使用/, '') || e.group_id;
    const keyPrefix = e.msg.includes('群') ? 'g' : 'u';
    const key = `fqxzq:${keyPrefix}:${id}`;
    const allow = e.msg.includes('允许');

    await redis.set(key, allow);
    e.reply(
      `已${allow ? '允许' : '禁止'}${keyPrefix === 'g' ? '群' : '用户'}${id}使用此功能`,
      true
    );
    return true;
  }

  async byid(e) {
    const book_id = e.msg
      .trim()
      .replace(/^#?fq下载/, '')
      .trim();
    return this.xz(e, book_id);
  }

  async jx(e) {
    const msg = e.msg.trim();
    let book_id = null;
    try {
      if (msg.includes('changdunovel.com')) {
        book_id = msg.match(/book_id=(\d+)/)[1];
      } else {
        book_id = msg.match(/page\/(\d+)/)[1];
      }
    } catch {
      return e.reply('链接解析失败，请检查链接是否正确', true);
    }
    return this.xz(e, book_id);
  }

  async xz(e, id) {
    await this.initConfigPromise;
    let book_info;
    try {
      book_info = await this.fq.get_info(id);
    } catch (err) {
      logger.error(err);
      return e.reply('获取信息失败', true);
    }

    if (!book_info) return e.reply('获取信息失败', true);

    e.reply(
      `识别:[番茄小说]《${book_info.book_name}》\n作者:${book_info.author}\n原名:${book_info.original_book_name}`,
      true
    );

    if (!e.isMaster) {
      const allowGroup = e.isGroup ? await redis.get(`fqxzq:g:${e.group_id}`) : null;
      const allowUser = await redis.get(`fqxzq:u:${e.user_id}`);
      if (!allowGroup && !allowUser) return false;
    }

    e.reply('开始下载，请稍等', true);
    const startTime = Date.now();

    try {
      await this.fq.down(id, e.message_id);
    } catch (err) {
      logger.error(err);
      return e.reply('下载失败', true);
    }

    const outPath = path.join(this.outDir, 'files', String(e.message_id));
    let filePath = await this.listen_outdir(outPath);
    if (!filePath) return e.reply('下载超时', true);

    const safeFilePath = filePath.replace(/ /g, '_');
    if (filePath !== safeFilePath) {
      try {
        fs.renameSync(filePath, safeFilePath);
        filePath = safeFilePath;
      } catch (err) {
        logger.error(`重命名文件失败：${err.stack}`);
        return e.reply('文件重命名失败', true);
      }
    }

    const uploadReturn = await this.upload(e, filePath);
    await this.clearCache(false, true, String(e.message_id));
    if (!uploadReturn) return e.reply('上传失败', true);

    e.reply(
      `《${book_info.book_name}》上传成功，用时 ${(Date.now() - startTime) / 1000}s\n下载链接为${uploadReturn.url},将在10分钟后删除，请及时下载`
    );
    return true;
  }

  async upload(e, filePath) {
    try {
      /*
      let res;
      if (e.isGroup) {
        res = e.bot.sendApi('upload_group_file', {
          group_id: e.group_id,
          file: filePath,
          name: path.basename(filePath),
          folder: 'fanqie',
        });
      } else if (e.friend) {
        res = e.bot.sendApi('upload_private_file', {
          user_id: e.user_id,
          file: filePath,
          name: path.basename(filePath),
        });
      }
      return !!res;
       */
      const form = new FormData();
      if (!fs.existsSync(filePath)) {
        logger.error(`文件不存在：${filePath}`);
        e.reply(`文件上传失败`, true);
        return;
      }
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => {
        logger.error('文件读取错误：', err);
      });
      form.append('file', fileStream);
      form.append('token', configControl.get('coreConfig')?.token);
      const uploadUrl = `${configControl.get('coreConfig')?.coreUrl}/public/upload?dir=fanqie&expire=600`;
      const response = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      if (response?.success) {
        const url = response.data?.url;
        const message = response.data?.message;
        return { url, message };
      }
    } catch (err) {
      logger.error(`文件上传错误：${logger.red(err.stack)}`);
      e.reply(`文件上传失败：${err.message}`, true);
      return null;
    }
  }
}
