import fs from 'node:fs';
import path from 'path';
import chokidar from 'chokidar';
import ConfigControl from '../lib/config/configControl.js';
import Fanqie from '../models/apps/fanqie/fanqie.js';

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
    return new Promise((resolve, reject) => {
      const watcher = chokidar.watch(dir, {
        persistent: true,
        ignoreInitial: true,
      });
      let timer = setTimeout(() => {
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
      if (this.initConfigPromise) {
        await this.initConfigPromise;
      }
      if (!this.outDir) {
        if (e) e.reply('缓存目录未初始化，无法清理缓存', true);
        return false;
      }
    }
    const dir = path.join(this.outDir, 'fanqie');
    if (zd) {
      const cdir = path.join(this.outDir, 'files', zd);
      if (!fs.existsSync(cdir)) {
        if (e) e.reply('目录不存在', true);
        return false;
      }
      if (fs.rmSync) {
        fs.rmSync(cdir, { recursive: true, force: true });
      } else {
        fs.rmdirSync(cdir, { recursive: true });
      }
    }
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (fs.rmSync) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.rmdirSync(filePath, { recursive: true });
          }
        } else {
          fs.unlinkSync(filePath);
        }
      }
    }
    if (!is_task && e) e.reply('缓存已清理', true);
    return true;
  }
  async control(e) {
    if (!e.isMaster) {
      e.reply('你没有权限使用此功能', true);
      return false;
    }
    let id = e.msg.trim().replace(/^fq(允许|禁止)(群|用户)使用/, '');
    if (id == '') {
      id = e.group_id;
    }
    if (e.msg.includes('群')) {
      if (e.msg.includes('允许')) {
        redis.set(`fqxzq:g:${id}`, true);
        e.reply(`已允许群${id}使用此功能`, true);
      } else {
        redis.set(`fqxzq:g:${id}`, false);
        e.reply(`已禁止群${id}使用此功能`, true);
      }
    } else {
      if (e.msg.includes('允许')) {
        redis.set(`fqxzq:u:${id}`, true);
        e.reply(`已允许用户${id}使用此功能`, true);
      } else {
        redis.set(`fqxzq:u:${id}`, false);
        e.reply(`已禁止用户${id}使用此功能`, true);
      }
      return true;
    }
  }
  async byid(e) {
    let msg = e.msg.trim();
    let book_id = msg.replace('#?fq下载', '').trim();
    return this.xz(e, book_id);
  }
  async jx(e) {
    let book_id,
      msg = e.msg.trim();
    if (msg.includes('changdunovel.com/wap/share-v2.html')) {
      book_id = msg.match(/book_id=(\d+)/)[1];
    } else {
      book_id = msg.match(/page\/(\d+)/)[1];
    }
    return this.xz(e, book_id);
  }
  async xz(e, id) {
    await this.initConfigPromise;
    let book_id = id;
    let book_info;
    try {
      book_info = await this.fq.get_info(book_id);
    } catch (err) {
      logger.error(err);
      e.reply('获取信息失败', true);
      return true;
    }
    if (!book_info) {
      e.reply('获取信息失败', true);
      return true;
    }
    e.reply(
      `识别:[番茄小说]《${book_info.book_name}》\n作者:${book_info.author}\n原名:${book_info.original_book_name}`,
      true
    );
    if (!e.isMaster) {
      if (
        !(e.isGroup && redis.get(`fqxzq:g:${e.group_id})` || !redis.get(`fqxzq:u:${e.user_id}`)))
      ) {
        return false;
      }
    }
    e.reply('开始下载,请稍等', true);
    let starttime = Date.now();
    let ok;
    try {
      ok = await this.fq.down(book_id, e.message_id);
    } catch (err) {
      logger.error(err);
      e.reply('下载失败', true);
      return true;
    }
    if (!ok) {
      e.reply('下载失败', true);
      return true;
    }
    let file;
    try {
      file = await this.listen_outdir(path.join(this.outDir, 'files', String(e.message_id)));
    } catch (err) {
      logger.error(err);
      e.reply('下载超时', true);
      return true;
    }
    if (!file) {
      e.reply('下载超时', true);
      return true;
    }
    ok = await this.upload(e, file, book_info);
    if (!ok) {
      this.clearCache(false, true, String(e.message_id));
      e.reply('上传失败', true);
      return true;
    }
    this.clearCache(false, true, String(e.message_id));
    e.reply(
      `《${book_info.book_name}》上传成功,总用时:${((Date.now() - starttime) / 1000).toFixed(2)}s`,
      true
    );
  }
  async upload(e, filePath, bookInfo) {
    try {
      let res;
      if (e.isGroup) {
        res = await e.bot.sendApi('upload_group_file', {
          group_id: e.group_id,
          file: filePath,
          name: bookInfo.book_name,
          folder: 'fanqie',
        });
      } else if (e.friend) {
        res = await e.bot.sendApi('upload_private_file', {
          user_id: e.user_id,
          file: filePath,
          name: bookInfo.book_name,
        });
      }
      if (res) {
        return true;
      }
    } catch (err) {
      logger.error(`文件上传错误：${logger.red(err.stack)}`);
      if (e && e.reply) await e.reply(`文件上传错误：${err.stack}`);
      return false;
    }
  }
}
