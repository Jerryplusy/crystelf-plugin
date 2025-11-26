import configControl from '../lib/config/configControl.js';
import rssTools from '../modules/rss/rss.js';
import path from 'path';
import screenshot from '../lib/rss/screenshot.js';
import fs from 'fs';
import rssCache from '../lib/rss/rssCache.js';
import schedule from 'node-schedule';
import tools from '../components/tool.js';
// 移除了重复的 import ConfigControl

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
        // 【新增】查看列表功能
        {
          reg: '^#rss列表$',
          fnc: 'listFeeds',
          permission: 'master',
        },
        {
          reg: /(https?:\/\/\S+(?:\.atom|\/feed))/i,
          fnc: 'autoAddFeed',
          permission: 'master',
          priority: 500,
        },
      ],
    });

    // 【修复】定时任务启动逻辑
    // 只要插件加载，且未注册过任务，就启动定时器
    if (!global.__rss_job_scheduled) {
      // 默认每10分钟执行一次
      schedule.scheduleJob('*/10 * * * *', () => this.pushFeeds());
      global.__rss_job_scheduled = true;
      logger.mark('[RSS] 定时检测任务已启动');
    }
  }

  /**
   * 添加rss
   */
  async addFeed(e) {
    const url = e.msg.replace(/^#rss添加/, '').trim();
    if (!url) return e.reply('请输入有效的RSS链接', true);

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
   */
  async autoAddFeed(e) {
    if (!configControl.get()?.config?.rss) {
      return;
    }
    const url = e.msg.match(/(https?:\/\/\S+(?:\.atom|\/feed))/i)?.[1];
    if (!url) return false;
    e.msg = `#rss添加 ${url}`;
    return await this.addFeed(e);
  }

  /**
   * 【新增】查看当前群组订阅列表
   */
  async listFeeds(e) {
    const feeds = configControl.get('feeds') || [];
    const groupId = e.group_id;

    // 筛选当前群组的订阅，保留全局索引以便移除
    const currentGroupFeeds = feeds
      .map((feed, index) => ({ index, ...feed }))
      .filter((feed) => feed.targetGroups.includes(groupId));

    if (currentGroupFeeds.length === 0) {
      return e.reply('当前群组暂无任何RSS订阅。', true);
    }

    const msg = [
      `≡ 当前群组订阅列表 (${currentGroupFeeds.length}) ≡`,
      ...currentGroupFeeds.map((f) => `[${f.index}] ${f.url}`),
      '----------------',
      '提示: 使用 #rss移除+索引号 取消订阅'
    ].join('\n');

    return e.reply(msg);
  }

  /**
   * 【修复】移除rss (增强健壮性)
   */
  async removeFeed(e) {
    // 提取数字
    const match = e.msg.match(/#rss移除\s*(\d+)/);
    if (!match || !match[1]) {
      return e.reply('请指定要移除的订阅索引，例如：#rss移除0', true);
    }

    const index = parseInt(match[1], 10);
    const feeds = configControl.get('feeds') || [];
    const groupId = e.group_id;

    // 越界与有效性检查
    if (isNaN(index) || index < 0 || index >= feeds.length) {
      return e.reply('索引无效，请发送 #rss列表 查看正确索引。', true);
    }

    const targetFeed = feeds[index];
    if (!targetFeed) return e.reply('未找到该配置。', true);

    // 兼容性处理
    if (!Array.isArray(targetFeed.targetGroups)) {
      targetFeed.targetGroups = [];
    }

    // 检查本群是否已订阅
    if (!targetFeed.targetGroups.includes(groupId)) {
      return e.reply('当前群组未订阅此源，无需移除。', true);
    }

    // 执行移除
    targetFeed.targetGroups = targetFeed.targetGroups.filter((id) => id !== groupId);
    await configControl.set('feeds', feeds);

    return await e.reply(`已取消订阅：${targetFeed.title || targetFeed.url}`);
  }

  /**
   * 【修复】手动拉取 (增加错误处理)
   */
  async pullFeedNow(e) {
    const url = e.msg.replace(/^#rss拉取/, '').trim();
    if (!url) return e.reply('请提供RSS链接', true);

    let latest;
    try {
      latest = await rssTools.fetchFeed(url);
    } catch (err) {
      logger.error(`[RSS] 手动拉取失败: ${err.message}`);
      return await e.reply(`拉取失败: ${err.message}`, true);
    }

    if (!latest || !latest.length) {
      return await e.reply('拉取成功但无内容..', true);
    }

    const post = latest[0];
    const tempPath = path.join(process.cwd(), 'data', `rss-test-${Date.now()}.png`);

    try {
      await e.reply(`最新文章：${post.title}\n正在生成预览...`);
      await screenshot.generateScreenshot(post, tempPath);
      await e.reply([segment.image(tempPath)]);
    } catch (err) {
      logger.error(`[RSS] 截图失败: ${err}`);
      await e.reply('生成预览图失败..', true);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  /**
   * 【修复】核心逻辑：检查rss更新
   * 修复了时区问题、逻辑死循环问题和报错导致插件停止的问题
   */
  async pushFeeds() {
    const feeds = configControl.get('feeds') || [];
    // logger.mark(`正在检查rss流更新..`); // 调试时可解开

    for (const feed of feeds) {
      let latest;
      try {
        latest = await rssTools.fetchFeed(feed.url);
      } catch (error) {
        logger.warn(`[RSS] 自动检查 ${feed.url} 失败: ${error.message}，跳过`);
        continue;
      }

      if (!latest || !latest.length) continue;

      const newItems = [];
      // 限制只检查前3条，避免刷屏
      const checkLimit = Math.min(latest.length, 3);

      for (let i = 0; i < checkLimit; i++) {
        const item = latest[i];
        if (!item.link) continue;

        // 【核心修复】不再强制对比 todayStr (解决时区问题)
        // 而是依赖 rssCache 判断是否推送过
        const isCached = await rssCache.has(feed.url, item.link);

        if (!isCached) {
          // 增加一个宽松的时间检查 (48小时内)，防止第一次添加把几年前的文章全发出来
          const pubDate = item.date ? new Date(item.date).getTime() : Date.now();
          // 如果文章没有时间，默认允许推送；如果有时间，则必须在48小时内
          if (!item.date || (Date.now() - pubDate < 172800000)) {
            newItems.push(item);
          }
        }
      }

      if (newItems.length > 0) {
        // 【优化】倒序排列，先发旧的，后发新的
        newItems.reverse();

        for (const post of newItems) {
          // 写入缓存
          await rssCache.set(feed.url, post.link);

          for (const groupId of feed.targetGroups) {
            // 稍微延迟，防止风控
            await tools.sleep(2000);

            const tempPath = path.join(process.cwd(), 'data', `rss-${Date.now()}.png`);
            try {
              if (feed.screenshot) {
                logger.info(`[RSS] 推送更新: ${post.title} -> 群 ${groupId}`);
                // 先发个文字提示
                await Bot.pickGroup(groupId)?.sendMsg(
                  `[RSS] ${post.feedTitle || '订阅更新'}\n${post.title}`
                );

                // 再发图片
                await screenshot.generateScreenshot(post, tempPath);
                await Bot.pickGroup(groupId)?.sendMsg([segment.image(tempPath)]);
              } else {
                await Bot.pickGroup(groupId)?.sendMsg(`[RSS推送]\n${post.title}\n${post.link}`);
              }
            } catch (err) {
              logger.error(`[RSS] 推送消息异常: ${err.message}`);
            } finally {
              // 确保删除临时文件
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
            }
          }
        }
      }
    }
  }
}
