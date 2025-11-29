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
      const index = parseInt(e.msg);
      if (isNaN(index) || index < 1 || index > 20) {
        return;
      }
      const searchResult = musicSearch.getGroupSearchResult(e.group_id);
      if (!searchResult) {
        return;
      }
      const adapter = await YunzaiUtils.getAdapter(e);
      await Message.emojiLike(e,e.message_id,60,e.group_id,adapter);
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
   * 发送音乐结果
   * @param {Object} e 事件对象
   * @param {Object} result 播放结果
   */
  async sendMusicResult(e, result) {
    try {
      const { song, audioFile, type, quality, message } = result;
      //await e.reply(message);
      const adapter = await YunzaiUtils.getAdapter(e);
      if (type === 'voice' || quality === 1) {
        await Group.sendGroupRecord(e, e.group_id, `file://${audioFile}`, adapter);
      } else {
        const extension = await this.getFileExtension();
        const sanitizedTitle = song.displayTitle.replace(/\s+/g, '_');
        const sanitizedArtist = song.displayArtist.replace(/\s+/g, '_');
        const filename = `${sanitizedTitle} - ${sanitizedArtist}.${extension}`;
        await Group.sendGroupFile(e, e.group_id, `file://${audioFile}`, filename, adapter);
      }
      musicSearch.clearUserSelection(e.group_id, e.user_id);
      logger.info(`[crystelf-music] 音乐发送成功: ${song.displayTitle}`);
    } catch (error) {
      logger.error('[crystelf-music] 发送音乐结果失败:', error);
      await e.reply('发送音乐失败,请稍后重试', true);
    }
  }

  /**
   * 获取文件扩展名
   * @returns {string} 文件扩展名
   */
  async getFileExtension() {
    const musicConfig =await ConfigControl.get('music');
    //if(musicConfig.quality === '3'){
      //return 'flac'
    //}
    return 'flac'
  }
}