import configControl from '../lib/config/configControl.js';
import rssTools from '../models/rss/rss.js';
import path from 'path';
import screenshot from '../lib/rss/screenshot.js';
import fs from 'fs';
import rssCache from '../lib/rss/rssCache.js';
import schedule from 'node-schedule';
import tools from '../components/tool.js';

export default class RssPlugin extends plugin {
  constructor() {
    super({
      name: 'crystelf RSS订阅',
      dsc: '定时推送rss解析流',
      priority: 114,
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
        {
          reg: '^#rss拉取(.+)$',
          fnc: 'pullFeedNow',
          permission: 'master',
          priority: 100,
        },
        {
          reg: /(https?:\/\/\S+(?:\.atom|\/feed))/i,
          fnc: 'autoAddFeed',
          permission: 'master',
          priority: 500,
        },
      ],
    });
    if (!global.__rss_job_scheduled) {
      schedule.scheduleJob('*/10 * * * *', () => this.pushFeeds());
      global.__rss_job_scheduled = true;
    }
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

    feeds.push({ url, targetGroups: [groupId], screenshot: true });
    await configControl.set('feeds', feeds);
    return e.reply(`rss解析流设置成功..`, true);
  }

  /**
   * 自动添加
   * @param e
   * @returns {Promise<*|boolean>}
   */
  async autoAddFeed(e) {
    //if (/^#rss/i.test(e.msg.trim())) return false;
    const url = e.msg.match(/(https?:\/\/\S+(?:\.atom|\/feed))/i)?.[1];
    if (!url) return false;
    e.msg = `#rss添加 ${url}`;
    return await this.addFeed(e);
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

    if (index < 0 || index >= feeds.length) return e.reply('索引无效..', true);

    feeds[index].targetGroups = feeds[index].targetGroups.filter((id) => id !== groupId);
    await configControl.set('feeds', feeds);
    return e.reply('群已移除该订阅');
  }

  /**
   * 手动拉取
   * @param e
   * @returns {Promise<*>}
   */
  async pullFeedNow(e) {
    const url = e.msg.replace(/^#rss拉取/, '').trim();
    const latest = await rssTools.fetchFeed(url);
    //logger.info(latest);

    if (!latest || !latest.length) {
      return e.reply('拉取失败或无内容..', true);
    }

    const post = latest[0];
    //console.log(post);
    const tempPath = path.join(process.cwd(), 'data', `rss-test-${Date.now()}.png`);
    await screenshot.generateScreenshot(post, tempPath);
    await e.reply([segment.image(tempPath)]);
    fs.unlinkSync(tempPath);
  }

  /**
   * 检查rss更新
   * @returns {Promise<void>}
   */
  async pushFeeds() {
    const feeds = configControl.get('feeds') || [];
    logger.mark(`正在检查rss流更新..`);

    for (const feed of feeds) {
      const latest = await rssTools.fetchFeed(feed.url);
      if (!latest || !latest.length) continue;
      const todayStr = new Date().toISOString().split('T')[0];
      const newItems = [];
      for (const item of latest) {
        const pubDate = item.date;
        if (!pubDate) continue;
        const itemDate = new Date(pubDate).toISOString().split('T')[0];
        if (itemDate !== todayStr) continue;
        if (!(await rssCache.has(feed.url, item.link))) {
          newItems.push(item);
        }
      }
      if (newItems.length) {
        await rssCache.set(feed.url, newItems[0].link);
        for (const groupId of feed.targetGroups) {
          const post = newItems[0];
          const tempPath = path.join(process.cwd(), 'data', `rss-${Date.now()}.png`);
          if (feed.screenshot) {
            await Bot.pickGroup(groupId)?.sendMsg(
              `${configControl.get('nickName')}发现了一条新的rss推送!`
            );
            await tools.sleep(1000);
            //await Bot.pickGroup(groupId)?.sendMsg(`让${configControl.get('nickName')}看看内容是什么..`);
            // TODO 通过人工智能查看内容
            await Bot.pickGroup(groupId)?.sendMsg(
              `[标题] ${post.title}\n[作者] ${post.author}\n[来源} ${post.feedTitle}\n正在努力截图..`
            );
            await screenshot.generateScreenshot(post, tempPath);
            await Bot.pickGroup(groupId)?.sendMsg([segment.image(tempPath)]);
            fs.unlinkSync(tempPath);
          } else {
            await Bot.pickGroup(groupId)?.sendMsg(`[RSS推送]\n${post.title}\n${post.link}`);
          }
        }
      }
    }
  }
}
