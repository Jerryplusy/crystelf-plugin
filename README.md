# crystelf-plugin
> 多功能群娱乐插件

## 安装方法
- 使用 Github  

    ```bash
    git clone --depth=1 https://github.com/Jerryplusy/crystelf-plugin ./plugins/crystelf-plugin
    ```
  
- 使用 Crystelf-Gitea镜像 (更新可能滞后)  
    ```bash
    git clone --depth=1 https://git.crystelf.top/Jerry/crystelf-plugin ./plugins/crystelf-plugin
    ```


### 安装依赖  
在`Yunzai`根目录下执行:  
- npm `npm install`
- pnpm `pnpm install`

## 可用功能  
> 某些功能可能会与其他插件发生冲突,在config中调整对应功能关闭即可
<details>
<summary>60s</summary>

- 命令: `60s` 或 `早报`  
![60s.png](resources/readme/60s.png)
</details>
<details>
<summary>更好的<small><del>手性碳</del></small>数字验证</summary>

> bot需要为群管理及以上,操作者需为主人或群管理员
- `#开启验证` 在本群开启验证,默认验证模式为数字验证(100以内加减法)
- `#关闭验证` 在本群关闭验证
- `#切换验证模式` 在数字验证模式和手性碳验证模式之间切换
- `#重新验证@某人` 让这个人重新验证一次  
- `#绕过验证@某人` 你不用再验证了  
- `#设置验证(提示|困难)模式(开启|关闭)` 提示模式开启时,会在图上用`*`标记手性碳位置;困难模式开启时,新人需要回答出全部手性碳位置而不是默认的只需要回答出一个位置
- `#设置验证次数+次数` 最大验证次数
- `#设置撤回(开启|关闭)` 是否撤回错误答案  
![tan.png](resources/readme/tan.png)
</details>
<details>
<summary>自定义加群欢迎</summary>

> 操作者需为主人或群管理员
- `#设置欢迎文案+欢迎词` 在某个群替换默认欢迎文案为欢迎词
- `#设置欢迎图片+图片` 或 `#设置欢迎图片` + 引用图片 在某个群的欢迎词后面加一张图片/表情包
- `#查看欢迎` 查看当前群欢迎词
- `#清除欢迎` 清楚当前群欢迎词  
![welcome.png](resources/readme/welcome.png)

</details>
<details>
<summary>表情回复</summary>

- 开启后bot会监听所有群聊中用户消息中存在的emoji并贴上表情
- `#回应+emoji` 查看当前emoji对应类型及id

</details>
<details>
<summary>戳一戳功能</summary>

- 开启本功能后戳一戳bot会调用晶灵核心的戳一戳词库进行回复
</details>
<details>
<summary>rss订阅及推送</summary>

- `#rss添加+订阅地址` 添加rss订阅源到该群聊,bot会定时检查该源是否更新并推送
- `#rss移除+id` 在本群移除某个订阅
- `#rss拉取+订阅地址` 测试拉取某个rss源

</details>
<details>
<summary>早晚安</summary>

- 在群里正常的发送早晚安时,插件会调用晶灵智能的早晚安api获取文案进行回复
- `早安`
- `晚安`

</details>
<details>
<summary>点歌功能</summary>

- 使用[hifi公共音源库](https://github.com/sachinsenal0x64/hifi)提供服务,
- 由于音源位于海外,大陆连接下载音乐时可能遇到缓慢问题,考虑优化网络环境
- 由于海外音源,搜歌时考虑使用繁体中文,英文等进行搜索以处理搜索不到的情况
- 默认下载flac/CD无损级音乐,可在配置文件调整为mp3音质或直接通过语音发送
- ~~可以听周杰伦~~
- `#点歌晴天`
- `#听1`
- `#听夜曲`

> 直接#听+歌曲名可能播放错误的歌曲

</details>
<details>
<summary>晶灵智能✨</summary>

> 与机器人进行普通的对话吧!

单次对话消耗tokens>2000,请合理安排使用  
支持功能:  
- [X] 自定义人设  
- [X] 自动调整回复长度及自动分段发送  
- [X] 发送聊天消息时决定是否引用及是否@  
- [X] 根据语境发送表情包 (需要晶灵核心)  
- [X] 戳一戳别人  
- [X] 代码高亮渲染  
- [X] Markdown渲染  
- [X] 自定义上下文长度  
- [X] 记忆存储及搜索  
- [X] 自定义会话管理  
- [X] 支持获取引用消息,使用seq标记  
- [X] 支持群聊上下文消息  
- [ ] 支持调用更多工具  
- [X] 获取引用消息  
- [X] 适配多模态模型,查看图片等  
- [ ] 支持联网搜索  
- [X] 支持生成图片  
- [ ] 支持渲染数学公式  
- [ ] 违禁词检测  
- [ ] 使用toon代替json与模型交互  


**填写完配置文件后开箱即用!**  
支持@调用及昵称开头语句调用  
![meme.jpg](resources/readme/meme.jpg)
![md.jpg](resources/readme/md.jpg)
![code.jpg](resources/readme/code.jpg)
</details>

## 插件配置  

## **本插件已适配锅巴,请务必使用锅巴进行插件配置**  

**请不要修改插件目录下 `config` 文件夹中的文件**

## 关于晶灵核心  
晶灵核心是一个开源的api服务,使用nestjs框架编写,本插件部分功能依赖于晶灵核心,如戳一戳,早晚安,晶灵智能等.  
其中,全部功能都可以使用官方提供的api进行操作,如果部分地区被墙或速度过慢,可以参考教程自行部署晶灵核心.  
晶灵核心及文案等数据均开源,但表情数据及图片为闭源不公开,如自行部署需要考虑表情问题(如自行收集表情包存于相关目录下).  
自行搭建请前往[晶灵核心仓库](https://github.com/crystelf/crystelf-core)

## 关于兼容性
| 框架/适配器          | 是否适配   |
|-----------------|--------|
| TRSS-Yunzai     | 完全适配   |
| Miao-Yunzai     | 可能出现问题 |
| Onebot-Napcat   | 完全适配   |
| Onebot-Lgr      | 完全适配   |
| Onebot-LLTwoBot | 部分适配   |
| ICQQ            | 可能出现问题 |
## 联系我们  
如果遇到任何问题,欢迎提出issue或加入我们的QQ群进行交流.    
闲聊群: [884788970](https://qun.qq.com/universal-share/share?ac=1&authKey=H6t8wQF4wz2okV93sQMB3X2ase0BdgAZQoKYQwf4iYIXY76TIynhInTYeRux1pGy&busi_data=eyJncm91cENvZGUiOiI4ODQ3ODg5NzAiLCJ0b2tlbiI6ImZVWGlqOHdIaUUwKzZtWmI2cU9wL1E5c2tBYzN5dDFqTzUyU29mazcwMmJmbkFXT1VobVhhbkRjbWhoMHR0WjciLCJ1aW4iOiIzNDc5NDQ1NzAzIn0%3D&data=yAdFXNuwB1TL2thCUrfZIhkO2Ud7PRHiwAGWH_Bd2Ev0L9rBfvpV7vfGb1xMqJsO8rvU_6ob-PI6JYt2EV8PtA&svctype=4&tempid=h5_group_info)  
开发者咕咕群: [1023625838](https://qun.qq.com/universal-share/share?ac=1&authKey=CqKLFZD7YY51MiiN6h2gzTOCUHt8Nh6UhPj%2Bl9nMsugTnAU3A%2FWGh5ezqClno1HI&busi_data=eyJncm91cENvZGUiOiIxMDIzNjI1ODM4IiwidG9rZW4iOiIxZUMzdExTWTV6WTBnQngvNHVGT3dNZlVFWVJ6aVJEUS9sOEpZZnozaHUvRjYrVkxZa2kyMFFmMXVYQXBEdm1lIiwidWluIjoiMzQ3OTQ0NTcwMyJ9&data=FgsEtwv4kJmNCu_tw55iWkw5Sw7m4YTXf8RP4kHodaTfYJ8OfQraUe2dXw5OAWS4SqqzOfZmCjVravKMt9aJWg&svctype=4&tempid=h5_group_info)    
