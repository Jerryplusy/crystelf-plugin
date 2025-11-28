import configControl from '../config/configControl.js';
import MusicApi from './musicApi.js';
import MusicRenderer from './musicRenderer.js';
import AudioProcessor from './audioProcessor.js';

class MusicSearch {
  constructor() {
    this.api = new MusicApi();
    this.renderer = new MusicRenderer();
    this.audioProcessor = new AudioProcessor();
    this.searchHistory = new Map();
    this.userSelections = new Map();
  }

  /**
   * 初始化搜索管理器
   */
  async init() {
    try {
      await this.api.init();
      await this.renderer.init();
      await this.audioProcessor.init();
    } catch (error) {
      logger.error('[crystelf-music] 音乐搜索管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理用户搜索请求
   * @param {Object} e 事件对象
   * @param {string} keyword 搜索关键词
   * @returns {Promise<Object>} 搜索结果
   */
  async handleSearch(e, keyword) {
    try {
      const groupId = e.group_id;
      this.clearGroupSearch(groupId);
      const songs = await this.api.searchMusic(keyword, 15);

      if (!songs || songs.length === 0) {
        return {
          success: false,
          message: '未找到相关音乐,请尝试其他关键词'
        };
      }
      this.searchHistory.set(String(groupId), {
        songs,
        query: keyword,
        timestamp: Date.now(),
        userId: e.user_id
      });
      const imagePath = await this.renderer.renderMusicList(songs, keyword, groupId);

      return {
        success: true,
        songs,
        imagePath,
        message: `找到 ${songs.length} 首相关音乐,请选择你要听的歌曲`
      };

    } catch (error) {
      logger.error('[crystelf-music] 搜索处理失败:', error);

      let errorMessage = '搜索失败,请稍后重试';
      if (error.message.includes('API')) {
        errorMessage = '音乐服务器连接失败,请检查配置';
      } else if (error.message.includes('搜索')) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * 处理用户选择播放
   * @param {Object} e 事件对象
   * @param {number|string} selection 用户选择的序号
   * @returns {Promise<Object>} 播放结果
   */
  async handleSelection(e, selection) {
    try {
      const groupId = e.group_id;
      const userId = e.user_id;
      let index;
      if (typeof selection === 'string') {
        index = parseInt(selection) - 1; // the user entered 1 based and changed to 0 based
      } else {
        index = selection - 1;
      }

      if (isNaN(index) || index < 0) {
        return {
          success: false,
          message: '请输入有效的歌曲序号（1-20）'
        };
      }
      const searchResult = this.searchHistory.get(String(groupId));
      if (!searchResult) {
        return {
          success: false,
          message: '没有找到搜索结果,请先使用 "#点歌 + 歌名" 进行搜索'
        };
      }

      const { songs, query } = searchResult;

      if (index >= songs.length) {
        return {
          success: false,
          message: `序号超出范围,当前搜索结果只有 ${songs.length} 首歌曲`
        };
      }

      const selectedSong = songs[index];
      this.userSelections.set(`${String(groupId)}_${userId}`, {
        song: selectedSong,
        index,
        timestamp: Date.now()
      });
      const config = configControl.get('music');
      const quality = config?.quality || 3;
      const streamUrl = this.api.getStreamingUrl(selectedSong.id, quality);
      const downloadResult = await this.audioProcessor.downloadAudio(streamUrl, selectedSong, groupId);
      const processResult = await this.audioProcessor.processAudio(downloadResult.filePath, selectedSong, quality, groupId);
      return {
        success: true,
        song: selectedSong,
        audioFile: processResult.filePath,
        type: processResult.type,
        quality: quality,
        originalSong: selectedSong,
        message: `正在播放: ${selectedSong.displayTitle} - ${selectedSong.displayArtist}`
      };

    } catch (error) {
      logger.error('[crystelf-music] 播放处理失败:', error);
      return {
        success: false,
        message: `播放失败: ${error.message}`
      };
    }
  }

  /**
   * 直接播放模式 - 根据歌名搜索并播放第一首
   * @param {Object} e 事件对象
   * @param {string} songName 歌曲名称
   * @returns {Promise<Object>} 播放结果
   */
  async handleDirectPlay(e, songName) {
    try {
      const groupId = e.group_id;
      const songs = await this.api.searchMusic(songName, 5);

      if (!songs || songs.length === 0) {
        return {
          success: false,
          message: `未找到歌曲 "${songName}",请检查歌名是否正确`
        };
      }

      const firstSong = songs[0];
      this.userSelections.set(String(groupId), {
        song: firstSong,
        index: 0,
        timestamp: Date.now(),
        directPlay: true
      });
      const config = configControl.get('music');
      const quality = config?.quality || 3;
      const streamUrl = this.api.getStreamingUrl(firstSong.id, quality);
      const downloadResult = await this.audioProcessor.downloadAudio(streamUrl, firstSong, groupId);
      const processResult = await this.audioProcessor.processAudio(downloadResult.filePath, firstSong, quality, groupId);
      return {
        success: true,
        song: firstSong,
        audioFile: processResult.filePath,
        type: processResult.type,
        quality: quality,
        originalSong: firstSong,
        message: `正在播放: ${firstSong.displayTitle} - ${firstSong.displayArtist}`,
        searchQuery: songName,
        foundIndex: 0
      };

    } catch (error) {
      logger.error('[crystelf-music] 直接播放失败:', error);

      return {
        success: false,
        message: `播放失败: ${error.message}`
      };
    }
  }

  /**
   * 获取当前群的搜索结果
   * @param {string} groupId 群聊ID
   * @returns {Object|null} 搜索结果
   */
  getGroupSearchResult(groupId) {
    return this.searchHistory.get(String(groupId)) || null;
  }

  /**
   * 清理群聊搜索状态
   * @param {string} groupId 群聊ID
   */
  clearGroupSearch(groupId) {
    this.searchHistory.delete(String(groupId));
    for (const key of this.userSelections.keys()) {
      if (key.startsWith(`${String(groupId)}_`)) {
        this.userSelections.delete(key);
      }
    }
  }

  /**
   * 清理用户选择记录
   * @param {string} groupId 群聊ID
   * @param {string} userId 用户ID
   */
  clearUserSelection(groupId, userId) {
    this.userSelections.delete(`${String(groupId)}_${userId}`);
  }

  /**
   * 关闭搜索管理器
   */
  async close() {
    try {
      await this.renderer.close();
      await this.audioProcessor.cleanupAll();
      this.searchHistory.clear();
      this.userSelections.clear();
    } catch (error) {
      logger.error('[crystelf-music] 关闭搜索管理器时出错:', error);
    }
  }
}

export default MusicSearch;