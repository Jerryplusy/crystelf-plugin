import crypto from 'crypto';
import axios from 'axios';
import configControl from '../config/configControl.js';

class MusicApi {
  constructor() {
    this.config = null;
    this.baseUrl = null;
    this.username = null;
    this.password = null;
  }

  async init() {
    this.config = configControl.get('music');
    this.baseUrl = this.config.url;
    this.username = this.config.username;
    this.password = this.config.password;
  }

  /**
   * 生成OpenSubsonic API认证token
   * @param {string} salt 随机盐值
   * @returns {string} MD5哈希token
   */
  generateToken(salt) {
    return crypto.createHash('md5').update(this.password + salt).digest('hex');
  }

  /**
   * 构建带认证的API URL
   * @param {string} method API方法名
   * @param {Object} params 额外参数
   * @returns {Object} 包含url和参数的请求对象
   */
  buildApiRequest(method, params = {}) {
    const salt = crypto.randomBytes(16).toString('hex');
    const token = this.generateToken(salt);

    const requestParams = {
      u: this.username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'crystelfmusic',
      f: 'json',
      ...params
    };
    const url = `${this.baseUrl}/rest/${method}.view`;
    return {
      url,
      params: requestParams
    };
  }


  /**
   * 通用API请求方法
   * @param {string} method API方法名
   * @param {Object} params 请求参数
   * @returns {Promise<Object>} API响应
   */
  async request(method, params = {}) {
    try {
      const requestConfig = this.buildApiRequest(method, params);
      const response = await axios.get(requestConfig.url, { params: requestConfig.params });
      if (response.data && response.data['subsonic-response']) {
        const data = response.data['subsonic-response'];
        if (data.status === 'ok') {
          return data;
        } else {
          logger.error(`[crystelf-music] API返回错误: ${data.error?.message || '未知错误'}`);
          return null;
        }
      } else {
        logger.error('[crystelf-music] API返回格式异常');
        return null;
      }
    } catch (error) {
      logger.error(`[crystelf-music] API请求失败 [${method}]: ${error.message}`);
      return null;
    }
  }

  /**
   * 搜索音乐
   * @param {string} query 搜索关键词（歌曲名、歌手名或专辑名）
   * @param {number} count 返回结果数量
   * @returns {Promise<Array>} 搜索结果数组
   */
  async searchMusic(query, count = 20) {
    if (!query || query.trim().length === 0) {
      logger.error('[crystelf-music] 搜索关键词不能为空');
      return null;
    }

    try {
      const response = await this.request('search3', {
        query: query.trim(),
        songCount: count,
        songOffset: 0,
        artistCount: 0,
        albumCount: 0
      });
      const searchResult = response.searchResult3;
      const songs = searchResult?.song || [];
      songs.sort((a, b) => b.score - a.score);
      const topSongs = songs.slice(0, count);
      return this.enhanceSearchResults(topSongs, query);
    } catch (error) {
      logger.error('[crystelf-music] 搜索失败:', error.message);
      return null;
    }
  }


  /**
   * 增强搜索结果并排序
   * @param {Array} songs 原始歌曲列表
   * @param {string} query 搜索关键词
   * @returns {Array} 增强后的歌曲列表
   */
  enhanceSearchResults(songs, query) {
    const queryLower = query.toLowerCase();
    
    return songs.map((song, index) => {
      const title = song.title?.toLowerCase() || '';
      const artist = song.artist?.toLowerCase() || '';
      const album = song.album?.toLowerCase() || '';
      let score = 0;
      if (title.includes(queryLower)) {
        score += 100;
        if (title.startsWith(queryLower)) score += 50;
      }
      if (artist.includes(queryLower)) {
        score += 50;
        if (artist.startsWith(queryLower)) score += 25;
      }
      if (album.includes(queryLower)) {
        score += 30;
        if (album.startsWith(queryLower)) score += 15;
      }
      if (song.duration && song.duration > 120 && song.duration < 480) {
        score += 10;
      }
      score += (1000 - index) * 0.01;
      
      return {
        ...song,
        score,
        displayTitle: song.title || '未知歌曲',
        displayArtist: song.artist || '未知艺术家',
        displayAlbum: song.album || '未知专辑',
        duration: song.duration ? this.formatDuration(song.duration) : '未知',
        format: this.getAudioFormat(song.suffix),
        size: song.size ? this.formatFileSize(song.size) : '未知大小'
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * 根据ID获取歌曲详细信息
   * @param {string} songId 歌曲ID
   * @returns {Promise<Object>} 歌曲详细信息
   */
  async getSongById(songId) {
    try {
      const response = await this.request('getSong', { id: songId });
      return response.song;
    } catch (error) {
      logger.error('[crystelf-music] 获取歌曲信息失败:', error.message);
      return null;
    }
  }

  /**
   * 根据音质设置获取流媒体URL
   * @param {string} songId 歌曲ID
   * @param {number} quality 音质设置 (1=96kbps, 2=320kbps, 3=FLAC)
   * @returns {string} 流媒体URL
   */
  getStreamingUrl(songId, quality) {
    const qualityMap = {
      1: { maxBitRate: 96, format: 'mp3' },
      2: { maxBitRate: 320, format: 'mp3' },
      3: { maxBitRate: 0, format: 'flac' } // 0表示无损
    };

    const q = qualityMap[quality] || qualityMap[3];
    
    const requestConfig = this.buildApiRequest('stream', {
      id: songId,
      maxBitRate: q.maxBitRate,
      format: q.format
    });
    const urlParams = new URLSearchParams(requestConfig.params).toString();
    return `${requestConfig.url}?${urlParams}`;
  }

  /**
   * 格式化时长
   * @param {number} seconds 秒数
   * @returns {string} 格式化后的时长
   */
  formatDuration(seconds) {
    if (!seconds) return '未知';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (!bytes) return '未知';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 根据文件后缀获取音频格式
   * @param {string} suffix 文件后缀
   * @returns {string} 音频格式
   */
  getAudioFormat(suffix) {
    const formatMap = {
      'mp3': 'MP3',
      'flac': 'FLAC',
      'aac': 'AAC',
      'm4a': 'M4A',
      'ogg': 'OGG',
      'wav': 'WAV'
    };
    
    return formatMap[suffix?.toLowerCase()] || suffix?.toUpperCase() || '未知';
  }
}

export default MusicApi;