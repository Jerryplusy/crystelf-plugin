import MusicSearch from '../lib/music/musicSearch.js';
import Group from '../lib/yunzai/group.js';
import Message from '../lib/yunzai/message.js';
import YunzaiUtils from '../lib/yunzai/utils.js';
import ConfigControl from '../lib/config/configControl.js';

let musicSearch = globalThis.__CRYSTELF_MUSIC__;

if (!musicSearch) {
  musicSearch = new MusicSearch();
  globalThis.__CRYSTELF_MUSIC__ = musicSearch;
  musicSearch.init().then(() => {
    logger.info('[crystelf-music] 初始化');
  }).catch(err => {
    logger.error('[crystelf-music] 初始化失败: ' + err);
  });
}

export class CrystelfMusic extends plugin {
  constructor() {
    super({
      name: 'crystelf-music',
      dsc: '音乐点歌插件',
      event: 'message.group',
      priority: -1000,
      rule: [
        {
          reg: '^#?点歌\\s*(.+)$',
          fnc: 'handleSearch'
        },
        {
          reg: '^#?听\\s*(.+)',
          fnc: 'handleDirectPlay'
        },
        {
          reg: '^([1-9]|1\\d|20)$',
          fnc: 'handleIndexSelection'
        }
      ]
    });
  }

  /**
   * 处理点歌搜索
   * @param {Object} e 事件对象
   */
  async handleSearch(e) {
    try {
      if (!ConfigControl.get()?.config?.music) {
        return;
      }
      const keyword = e.msg.replace(/^#?点歌\s*/, '').trim();
      if (!keyword) {
        return await e.reply('请输入要点的歌名,例如：#点歌夜曲');
      }
      const adapter = await YunzaiUtils.getAdapter(e);
      await Message.emojiLike(e, e.message_id, 60, e.group_id, adapter);
      const result = await musicSearch.handleSearch(e, keyword);
      if (result.success) {
        await e.reply({
          type: 'image',
          file: `file://${result.imagePath}`
        });
      } else {
        await e.reply(`${result.message}`, true);
      }
    } catch (error) {
      logger.error('[crystelf-music] 处理搜索失败:', error);
      await e.reply('搜索失败,请稍后重试', true);
    }
  }

  /**
   * 处理直接播放
   * @param {Object} e 事件对象
   */
  async handleDirectPlay(e) {
    try {
      if (!ConfigControl.get()?.config?.music) {
        return;
      }
      const content = e.msg.replace(/^#?听\s*/, '').trim();
      if (!content) {
        return await e.reply('请输入要听的歌名或序号,例如：#听 夜曲 或 #听 1', true);
      }
      const index = parseInt(content);
      if (!isNaN(index) && index >= 1 && index <= 20) {
        const searchResult = musicSearch.getGroupSearchResult(e.group_id);
        if (!searchResult) {
          return await e.reply('没有找到当前可选择的音乐列表，请先搜索歌曲', true);
        }
        const adapter = await YunzaiUtils.getAdapter(e);
        await Message.emojiLike(e, e.message_id, 60, e.group_id, adapter);
        const result = await musicSearch.handleSelection(e, index);
        if (result.success) {
          await this.sendMusicResult(e, result);
        } else {
          await e.reply(`${result.message}`, true);
        }
      } else {
        const adapter = await YunzaiUtils.getAdapter(e);
        await Message.emojiLike(e, e.message_id, 60, e.group_id, adapter);

        const result = await musicSearch.handleDirectPlay(e, content);
        if (result.success) {
          await this.sendMusicResult(e, result);
        } else {
          await e.reply(`${result.message}`, true);
        }
      }
    } catch (error) {
      logger.error('[crystelf-music] 处理直接播放失败:', error);
      await e.reply('播放失败,请稍后重试', true);
    }
  }

  /**
   * 处理序号选择
   * @param {Object} e 事件对象
   */
  async handleIndexSelection(e) {
    try {
      if (!ConfigControl.get()?.config?.music) {
        return;
      }
      const index = parseInt(e.msg);
      if (isNaN(index) || index < 1 || index > 20) {
        return;
      }
      const searchResult = musicSearch.getGroupSearchResult(e.group_id);
      if (!searchResult) {
        return;
      }
      const adapter = await YunzaiUtils.getAdapter(e);
      await Message.emojiLike(e, e.message_id, 60, e.group_id, adapter);
      const result = await musicSearch.handleSelection(e, index);
      if (result.success) {
        await this.sendMusicResult(e, result);
        await musicSearch.clearGroupSearch(e.group_id);
      } else {
        await e.reply(`${result.message}`, true);
      }
    } catch (error) {
      logger.error('[crystelf-music] 处理序号选择失败:', error);
    }
  }

/**
   * 发送音乐结果 (修复文件名非法字符 + 失败转语音)
   * @param {Object} e 事件对象
   * @param {Object} result 播放结果
   */
  async sendMusicResult(e, result) {
    try {
      const { song, audioFile, type, quality, message } = result;
      const adapter = await YunzaiUtils.getAdapter(e);

      if (type === 'voice' || quality === 1) {
        await Group.sendGroupRecord(e, e.group_id, `file://${audioFile}`, adapter);
      } else {
        const extension = await this.getFileExtension();
        
        // --- 核心修复开始 ---
        // 过滤掉 Windows 文件名非法字符 ( \ / : * ? " < > | )
        const sanitize = (str) => str.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
        
        const sanitizedTitle = sanitize(song.displayTitle);
        const sanitizedArtist = sanitize(song.displayArtist);
        const filename = `${sanitizedTitle} - ${sanitizedArtist}.${extension}`;
        // --- 核心修复结束 ---
        
        try {
            // 尝试上传文件 (现在的 filename 已经很干净了)
            await Group.sendGroupFile(e, e.group_id, `file://${audioFile}`, filename, adapter);
        } catch (fileErr) {
            logger.warn(`[crystelf-music] 文件发送失败(文件名: ${filename})，尝试转为语音: ${fileErr.message}`);
            // 失败兜底：发送语音
            await Group.sendGroupRecord(e, e.group_id, `file://${audioFile}`, adapter);
        }
      }
      
      musicSearch.clearUserSelection(e.group_id, e.user_id);
      logger.info(`[crystelf-music] 音乐处理完成: ${song.displayTitle}`);
    } catch (error) {
      logger.error('[crystelf-music] 发送音乐结果彻底失败:', error);
      await e.reply('发送音乐失败,请稍后重试', true);
    }
  }

  /**
   * 获取文件扩展名
   * @returns {string} 文件扩展名
   */
  async getFileExtension() {
    const musicConfig = await ConfigControl.get('music');
    //if(musicConfig.quality === '3'){
      //return 'flac'
    //}
    return 'flac'
  }
}
