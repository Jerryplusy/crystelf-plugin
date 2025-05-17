import crypto from 'crypto';
import paths from '../../constants/path.js';
import path from 'path';
import fs from 'fs';
import configControl from '../config/configControl.js';

const redis = global.redis;
const cachePath = path.join(paths.rssCache, 'rss_cache.json');
const MAX_CACHE = configControl.get('maxFeed');

const rssCache = {
  /**
   * url转hash
   * @param url
   * @returns {string}
   */
  urlToKey(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return `rss_cache:${hash}`;
  },

  async init() {
    await this.loadLocalToRedis();
  },

  /**
   * 获取已缓存的 link 数组
   * @param url
   * @returns {Promise<any[]|any|*[]>}
   */
  async get(url) {
    const key = this.urlToKey(url);
    const raw = await redis.get(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [parsed]; // 向后兼容老数据
    } catch {
      return [raw];
    }
  },

  /**
   * 判断某条是否已缓存
   * @param url
   * @param link
   * @returns {Promise<boolean>}
   */
  async has(url, link) {
    const cached = await this.get(url);
    return cached.includes(link);
  },

  /**
   * 添加新 link 到缓存
   * @param url
   * @param latestLink
   * @returns {Promise<void>}
   */
  async set(url, latestLink) {
    const key = this.urlToKey(url);
    let cached = await this.get(url);
    cached = [latestLink, ...cached.filter((l) => l !== latestLink)].slice(0, MAX_CACHE);

    await redis.set(key, JSON.stringify(cached));
    await this.saveToLocal(url, cached);
  },

  /**
   * 保存到本地文件
   * @param url
   * @param latestLinks
   * @returns {Promise<void>}
   */
  async saveToLocal(url, latestLinks) {
    let localData = {};
    try {
      if (fs.existsSync(cachePath)) {
        localData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      }
    } catch (err) {
      logger.error(`本地rss缓存读取失败..`, err);
    }
    localData[url] = latestLinks;
    fs.writeFileSync(cachePath, JSON.stringify(localData, null, 2), 'utf-8');
  },

  /**
   * 从本地缓存加载到 redis
   * @returns {Promise<void>}
   */
  async loadLocalToRedis() {
    if (!fs.existsSync(cachePath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      for (const [url, value] of Object.entries(data)) {
        const key = this.urlToKey(url);
        const safeArray = Array.isArray(value) ? value : [value];
        await redis.set(key, JSON.stringify(safeArray));
      }
      logger.info(`[RSS] 本地缓存已加载至 Redis`);
    } catch (err) {
      logger.error(`[RSS] 加载本地缓存失败`, err);
    }
  },
};

export default rssCache;
