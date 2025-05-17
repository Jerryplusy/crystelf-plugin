import crypto from 'crypto';
import paths from '../../constants/path.js';
import path from 'path';
import fs from 'fs';

const redis = global.redis;
const cachePath = path.join(paths.rssCache, 'rss_cache.json');

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
   * 从redis中获取数据
   * @param url
   * @returns {Promise<*>}
   */
  async get(url) {
    const key = this.urlToKey(url);
    return await redis.get(key);
  },

  /**
   * 保存数据至redis和本地
   * @param url
   * @param latestLink
   * @returns {Promise<void>}
   */
  async set(url, latestLink) {
    const key = this.urlToKey(url);
    await redis.set(key, latestLink);
    await this.saveToLocal(url, latestLink);
  },

  /**
   * 保存至本地
   * @param url
   * @param latestLink
   * @returns {Promise<void>}
   */
  async saveToLocal(url, latestLink) {
    let localData = {};
    try {
      if (fs.existsSync(cachePath)) {
        localData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      }
    } catch (err) {
      logger.error(`本地rss缓存读取失败..`, err);
    }
    localData[url] = latestLink;
    fs.writeFileSync(cachePath, JSON.stringify(localData, null, 2), 'utf-8');
  },

  /**
   * 从本地加载数据至redis
   * @returns {Promise<void>}
   */
  async loadLocalToRedis() {
    if (!fs.existsSync(cachePath)) return;
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    for (const [url, link] of Object.entries(data)) {
      const key = this.urlToKey(url);
      await redis.set(key, link);
    }
    logger.info(`[RSS]本地缓存已加载至redis..`);
  },
};

export default rssCache;
