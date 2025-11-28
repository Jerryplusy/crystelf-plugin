import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioProcessor {
  constructor() {
    this.tempDir = path.join(__dirname, '..', '..','..','..', 'temp');
    this.audioDir = path.join(this.tempDir, 'audio');
    this.ffmpegPath = this.findFFmpegPath();
  }

  /**
   * 查找系统中的ffmpeg路径
   * @returns {string|null} ffmpeg路径或null
   */
  findFFmpegPath() {
    try {
      //Start by checking if ffmpeg is included in the environment variable PATH
      const pathEnv = process.env.PATH || process.env.Path;
      if (pathEnv) {
        const pathSeparator = process.platform === 'win32' ? ';' : ':';
        const pathDirs = pathEnv.split(pathSeparator);
        
        for (const dir of pathDirs) {
          try {
            const ffmpegPath = process.platform === 'win32' 
              ? path.join(dir, 'ffmpeg.exe')
              : path.join(dir, 'ffmpeg');
            
            if (fs.existsSync(ffmpegPath)) {
              fs.accessSync(ffmpegPath, fs.constants.X_OK);
              return ffmpegPath;
            }
          } catch {

          }
        }
      }

      //check common ffmpeg paths
      const possiblePaths = [
        'ffmpeg',
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
        'D:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Users\\*\\AppData\\Local\\ffmpeg\\bin\\ffmpeg.exe'
      ];

      for (const p of possiblePaths) {
        //wildcard situation
        if (p.includes('*')) {
          const baseDir = p.split('\\*')[0];
          try {
            const dirs = fs.readdirSync(baseDir);
            for (const dir of dirs) {
              const fullPath = path.join(baseDir, dir, 'bin', 'ffmpeg.exe');
              if (fs.existsSync(fullPath)) {
                fs.accessSync(fullPath, fs.constants.X_OK);
                return fullPath;
              }
            }
          } catch {

          }
        } else {
          try {
            fs.accessSync(p, fs.constants.X_OK);
            return p;
          } catch {

          }
        }
      }

      // check if ffmpeg can be executed directly
      try {
        const testProcess = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
        testProcess.on('spawn', () => {
          testProcess.kill();
        });
        testProcess.on('error', () => {
          logger.warn('[crystelf-music] ffmpeg 不在PATH中,可能存在问题');
        });
        return 'ffmpeg';
      } catch {
        return null;
      }
    } catch (error) {
      logger.error('[crystelf-music] 查找 ffmpeg 路径时出错:', error);
      return null;
    }
  }

  /**
   * 初始化音频处理器
   */
  async init() {
    try {
      // make sure the temporary directory exists
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
      
      if (!fs.existsSync(this.audioDir)) {
        fs.mkdirSync(this.audioDir, { recursive: true });
      }

      if (this.ffmpegPath) {
      } else {
        logger.warn('[crystelf-music] 未找到ffmpeg,低音质转换功能可能不可用');
      }
    } catch (error) {
      logger.error('[crystelf-music] 音频处理器初始化失败:', error);
    }
  }

  /**
   * 下载音频文件
   * @param {string} url 音频URL
   * @param {Object} songInfo 歌曲信息
   * @param {string} groupId 群聊ID
   * @returns {Promise<Object>} 下载结果
   */
  async downloadAudio(url, songInfo, groupId) {
    try {
      const filename = `${this.sanitizeFilename(songInfo.displayTitle)}_${songInfo.id}.${this.getFileExtension(url)}`;
      const filePath = path.join(this.audioDir, filename);

      logger.info(`[crystelf-music] 开始下载音频: ${songInfo.displayTitle}`);

      // check if the file already exists
      if (fs.existsSync(filePath)) {
        logger.info(`[crystelf-music] 文件已存在,使用缓存: ${filename}`);
        return {
          success: true,
          filePath,
          filename,
          size: fs.statSync(filePath).size,
          cached: true
        };
      }

      const startTime = Date.now();
      let lastProgressTime = startTime;
      let lastProgressPercent = 0;

      // download the file
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'crystelf-music/1.0'
        },
        onDownloadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );

          const currentTime = Date.now();
          if (percentCompleted - lastProgressPercent >= 10 || 
              currentTime - lastProgressTime >= 5000) {
            const loadedSize = this.formatFileSize(progressEvent.loaded);
            const totalSize = this.formatFileSize(progressEvent.total || 0);
            const speed = this.formatFileSize(
              (progressEvent.loaded * 1000) / (currentTime - startTime)
            );
            
            logger.info(
              `[crystelf-music] 下载进度: ${percentCompleted}% (${loadedSize}/${totalSize}) ` +
              `速度: ${speed}/s - ${songInfo.displayTitle}`
            );
            lastProgressPercent = percentCompleted;
            lastProgressTime = currentTime;
          }
        }
      });
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = fs.statSync(filePath);
      const downloadTime = (Date.now() - startTime) / 1000;
      const avgSpeed = this.formatFileSize(stats.size / downloadTime);
      
      logger.info(
        `[crystelf-music] 音频下载完成: ${filename} (${this.formatFileSize(stats.size)}) ` +
        `耗时: ${downloadTime.toFixed(1)}秒 平均速度: ${avgSpeed}/s`
      );

      return {
        success: true,
        filePath,
        filename,
        size: stats.size,
        cached: false
      };

    } catch (error) {
      logger.error(`[crystelf-music] 下载音频失败:`, error);
    }
  }

  /**
   * 处理音频文件
   * @param {string} filePath 音频文件路径
   * @param {Object} songInfo 歌曲信息
   * @param {number} quality 音质设置 (1=低音质转语音, 2=320kbps, 3=FLAC)
   * @param {string} groupId 群聊ID
   * @returns {Promise<Object>} 处理结果
   */
  async processAudio(filePath, songInfo, quality, groupId) {
    try {
      const filename = path.basename(filePath, path.extname(filePath));
      
      if (quality === 1) {
        return await this.convertToVoice(filePath, filename, songInfo, groupId);
      } else {
        return {
          success: true,
          filePath,
          originalPath: filePath,
          type: 'audio',
          quality: quality,
          songInfo
        };
      }
    } catch (error) {
      logger.error('[crystelf-music] 音频处理失败:', error);
    }
  }

  /**
   * 将音频转换为语音格式
   * @param {string} inputPath 输入文件路径
   * @param {string} filename 文件名
   * @param {Object} songInfo 歌曲信息
   * @param {string} groupId 群聊ID
   * @returns {Promise<Object>} 转换结果
   */
  async convertToVoice(inputPath, filename, songInfo, groupId) {
    if (!this.ffmpegPath) {
      logger.error('[crystelf-music] 未找到ffmpeg,无法进行语音转换');
      return null;
    }

    const outputPath = path.join(this.audioDir, `${filename}_voice.silk`);
    
    try {
      logger.info(`[crystelf-music] 开始转换为语音格式: ${songInfo.displayTitle}`);
      const ffmpegArgs = [
        '-i', inputPath,
        '-ar', '24000',      // sampling rate 24khz
        '-ac', '1',          // mono
        '-ab', '32k',        // bit rate 32kbps
        '-f', 'wav',         // convert to wav first
        '-'
      ];

      const wavPath = path.join(this.audioDir, `${filename}_temp.wav`);
      
      // convert to wav
      await this.runFFmpeg(ffmpegArgs, wavPath);

      // convert to voice format
      const finalArgs = [
        '-i', wavPath,
        '-ar', '16000',      // voice sampling rate
        '-ac', '1',          // mono
        '-ab', '16k',        // voice bit rate
        '-f', 'wav',
        outputPath
      ];

      await this.runFFmpeg(finalArgs, null);
      try {
        fs.unlinkSync(wavPath);
      } catch {}

      const stats = fs.statSync(outputPath);
      logger.info(`[crystelf-music] 语音转换完成: ${path.basename(outputPath)} (${this.formatFileSize(stats.size)})`);

      return {
        success: true,
        filePath: outputPath,
        originalPath: inputPath,
        type: 'voice',
        quality: 1,
        songInfo
      };

    } catch (error) {
      logger.error('[crystelf-music] 语音转换失败:', error);
      logger.info('[crystelf-music] 转换失败,返回原始音频文件');
      return {
        success: true,
        filePath: inputPath,
        originalPath: inputPath,
        type: 'audio',
        quality: 1,
        songInfo,
        warning: '语音转换失败,已发送原始音频文件'
      };
    }
  }

  /**
   * 执行ffmpeg命令
   * @param {Array} args ffmpeg参数
   * @param {string|null} outputPath 输出文件路径
   * @returns {Promise<void>}
   */
  async runFFmpeg(args, outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg退出代码: ${code}, 错误: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`ffmpeg执行失败: ${error.message}`));
      });
      if (outputPath) {
        const outputStream = fs.createWriteStream(outputPath);
        ffmpeg.stdout.pipe(outputStream);
      }
    });
  }

  /**
   * 清理临时文件
   * @param {string} filePath 文件路径
   * @param {number} maxAge 最大保留时间（毫秒）
   */
  async cleanupFile(filePath, maxAge = 30 * 60 * 1000) { // default 30 minutes
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const age = Date.now() - stats.mtime.getTime();
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      logger.warn('[crystelf-music] 清理文件失败:', error.message);
    }
  }

  /**
   * 清理所有临时文件
   */
  async cleanupAll() {
    try {
      if (fs.existsSync(this.audioDir)) {
        const files = fs.readdirSync(this.audioDir);
        let cleaned = 0;
        
        for (const file of files) {
          const filePath = path.join(this.audioDir, file);
          await this.cleanupFile(filePath, 0);
          cleaned++;
        }
      }
    } catch (error) {
      logger.error('[crystelf-music] 清理临时文件失败:', error);
    }
  }

  /**
   * 清理文件名中的特殊字符
   * @param {string} filename 原始文件名
   * @returns {string} 清理后的文件名
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  /**
   * 根据URL获取文件扩展名
   * @param {string} url 文件URL
   * @returns {string} 文件扩展名
   */
  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = path.extname(pathname);
      return ext ? ext.substring(1) : 'mp3';
    } catch {
      return 'mp3';
    }
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export default AudioProcessor;