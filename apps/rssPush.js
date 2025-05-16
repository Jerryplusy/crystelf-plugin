import configControl from '../lib/config/configControl.js';
import rssTools from '../models/rss/rss.js';
import path from 'path';
import screenshot from '../lib/rss/screenshot.js';
import fs from 'fs';

const rssCache = new Map(); // TODO 解决重启后的数据恢复问题

export default class RssPlugin extends plugin {
  constructor() {
    super({
      name: 'crystelf RSS订阅',
      dsc: '定时推送rss解析流',
      rule: [
        {
          reg: '^#rss添加(.+)$',
          fnc: 'addFeed',
          permission: 'master',
        },
        {
          reg: '^#rss移除(\\d+)$',
          fnc: 'removeFeed',
          permission: 'master',
        },
      ],
      task: [
        {
          name: 'RSS定时推送',
          corn: '*/10 * * * *',
          fnc: () => this.pushFeeds(),
        },
      ],
    });
  }

  /**
   * 添加rss
   * @param e
   * @returns {Promise<*>}
   */
  async addFeed(e) {
    const url = e.msg.replace(/^#rss添加/, '').trim();
    const feeds = configControl.get('feeds') || [];
    const groupId = e.group_id;

    const exists = feeds.find((f) => f.url === url);
    if (exists) {
      if (!exists.targetGroups.includes(groupId)) {
        exists.targetGroups.push(groupId);
        await configControl.set('feeds', feeds);
        return e.reply(`群已添加到该rss订阅中..`, true);
      }
      return e.reply(`该rss已存在并包含在该群聊..`, true);
    }
    feeds.push({ url, targetGroup: [groupId], screenshot: true });
    await configControl.set('feeds', feeds);
    return e.reply(`rss解析流设置成功..`);
  }

  /**
   * 移除rss
   * @param e
   * @returns {Promise<*>}
   */
  async removeFeed(e) {
    const index = parseInt(e.msg.replace(/^#rss移除/, '').trim(), 10);
    const feeds = configControl.get('feeds') || [];
    const groupId = e.group_id;

    if (index < 0 || index >= feeds.length) return e.reply('索引无效');

    feeds[index].targetGroups = feeds[index].targetGroups.filter((id) => id !== groupId);
    await configControl.set('feeds', feeds);
    return e.reply('群已移除该订阅');
  }

  /**
   * 检查rss更新
   * @param e
   * @returns {Promise<void>}
   */
  async pushFeeds(e) {
    const feeds = configControl.get('feeds') || [];
    for (const feed of feeds) {
      const latest = await rssTools.fetchFeed(feed.url);
      if (!latest || latest.length) continue;
      const cacheKey = feed.url;
      const lastId = rssCache.get(cacheKey);
      const newItems = lastId ? latest.filter((i) => i.link !== lastId) : latest;
      if (newItems.length) rssCache.set(cacheKey, newItems[0].link);
      for (const groupId of feed.targetGroups) {
        const post = newItems[0];
        const tempPath = path.join(process.cwd(), 'data', `rss-${Date.now()}.png`);
        if (feed.screenshot) {
          await screenshot.generateScreenshot(post, tempPath);
          Bot.pickGroup(groupId)?.sendMsg([segment.image(tempPath)]);
          fs.unlinkSync(tempPath);
        } else {
          Bot.pickGroup(groupId)?.sendMsg(`[RSS推送]\n${post.title}\n${post.link}`);
        }
      }
    }
  }
}
