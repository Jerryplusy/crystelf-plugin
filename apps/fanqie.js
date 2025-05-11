import path from 'path';
import fs from 'node:fs';
import Fanqie from './fanqie.js';
import ConfigControl from '../lib/config/configControl.js';

let redis = global.redis;

const outDir = await ConfigControl.get('fanqieConfig')?.outDir;
const apiurl = await ConfigControl.get('fanqieConfig')?.url;
let fq = new Fanqie(apiurl);

function clearCache(e, isTask = false, sessionId = null) {
  const dir = path.join(outDir, 'fanqie');
  if (sessionId) {
    const cdir = path.join(outDir, 'files', sessionId);
    if (fs.existsSync(cdir)) {
      fs.rmSync
        ? fs.rmSync(cdir, { recursive: true, force: true })
        : fs.rmdirSync(cdir, { recursive: true });
    }
    return true;
  }

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync
          ? fs.rmSync(filePath, { recursive: true, force: true })
          : fs.rmdirSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }
  if (!isTask && e) e.reply('缓存已清理', true);
  return true;
}

async function upload(e, filePath) {
  try {
    let res;
    if (e.isGroup) {
      res = e.group.sendFile
        ? await e.group.sendFile(filePath)
        : await e.group.fs?.upload?.(filePath);
    } else {
      res = await e.friend?.sendFile?.(filePath);
    }
    return !!res;
  } catch (err) {
    logger.error(`上传失败：${err.stack}`);
    e.reply(`上传失败：${err.stack}`);
    return false;
  }
}

export default {
  name: 'fanqie',
  desc: '番茄小说下载',
  event: 'message',
  priority: -114,
  rule: [
    {
      reg: '(changdunovel.com/wap/share-v2.html|fanqienovel.com/page)',
      fnc: 'handleJX',
    },
    {
      reg: '#?fq下载(.*)',
      fnc: 'handleID',
    },
    {
      reg: '^fq(允许|禁止)(群|用户)使用',
      fnc: 'handleControl',
    },
    {
      reg: '^fq清(理|除|空)缓存$',
      fnc: 'handleClear',
    },
  ],
  async handleJX(e) {
    const msg = e.msg.trim();
    const book_id = msg.includes('changdunovel')
      ? msg.match(/book_id=(\d+)/)?.[1]
      : msg.match(/page\/(\d+)/)?.[1];
    if (!book_id) return e.reply('无法识别ID');
    return this.handleDownload(e, book_id);
  },
  async handleID(e) {
    const id = e.msg
      .trim()
      .replace(/^#?fq下载/, '')
      .trim();
    return this.handleDownload(e, id);
  },
  async handleControl(e) {
    if (!e.isMaster) return e.reply('你没有权限使用此功能');
    let id = e.msg.trim().replace(/^fq(允许|禁止)(群|用户)使用/, '') || e.group_id;
    const key = e.msg.includes('群') ? `fqxzq:g:${id}` : `fqxzq:u:${id}`;
    redis.set(key, e.msg.includes('允许'));
    e.reply(
      `已${e.msg.includes('允许') ? '允许' : '禁止'}${e.msg.includes('群') ? '群' : '用户'} ${id} 使用`,
      true
    );
  },
  async handleClear(e) {
    if (!e.isMaster) return e.reply('你没有权限使用此功能');
    clearCache(e);
  },
  async handleDownload(e, book_id) {
    const book_info = await fq.get_info(book_id);
    if (!book_info) return e.reply('获取信息失败');
    e.reply(
      `识别: [番茄小说]《${book_info.book_name}》\n作者: ${book_info.author}\n原名: ${book_info.original_book_name}`,
      true
    );

    if (!e.isMaster) {
      const groupAllow = await redis.get(`fqxzq:g:${e.group_id}`);
      const userDeny = await redis.get(`fqxzq:u:${e.user_id}`);
      if (!groupAllow || userDeny) return;
    }

    e.reply('开始下载，请稍等...');
    const ok = await fq.down(book_id, e.message_id);
    if (!ok) return e.reply('下载失败');

    const file = await fq.listen_outdir(path.join(outDir, 'files', String(e.message_id)));
    if (!file) return e.reply('下载超时');

    const success = await upload(e, file);
    clearCache(null, true, String(e.message_id));
    if (!success) return e.reply('上传失败');
    e.reply(`《${book_info.book_name}》上传成功！`, true);
  },
};
