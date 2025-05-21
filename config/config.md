### 参考以下注释进行配置，不要带注释粘贴，也不要改动`default.json`

配置文件位于`yunzai`根目录`/data/crystelf下`

参考注释：

``` yaml
{
  "debug": true,\\是否启用调试模式
  "core": true,\\是否启用晶灵核心相关功能
  "coreConfig": { //晶灵核心配置
    "coreUrl": "", //核心网址，需要加https://前缀
    "wsUrl": "", //ws连接地址如ws://
    "wsClientId": "",//端id
    "wsSecret": "", wsmiy
    "wsReConnectInterval": "5000",
    "token": ""//postAPI调用密钥
  },
  "maxFeed": 10,//最大缓存rss流
  "feeds": [//rss相关配置，无需手动更改
    {
      "url": "",
      "targetGroups": [114,154],
      "screenshot": true
    }
  ],
  "fanqieConfig": {//番茄小说功能
    "url": "http://127.0.0.1:6868",
    "outDir": "/home/user/debian/cache/Downloads"
  },
  "poke": {//戳一戳概率，加起来不超过1，余下的概率为反击概率
    "replyText": 0.4,
    "replyVoice": 0.2,
    "mutePick": 0.1,
    "pai": 0.1,
    ""muteTime": 2"
  },
  "mode": "deepseek",//deepseekORopenai
  "modelType": "deepseek-ai/DeepSeek-V3",//无需更改
  "historyLength": 3,
  "maxLength": 3,
  "chatTemperature": 1,
  "pluginTemperature": 0.5,
  "nickName": "寄气人",//昵称
  "checkChat": {
    "rdNum": 2,//随机数，0-100
    "masterReply": true,//主人回复
    "userId": [ //一定回复的人
      114514
    ],
    "blackGroups": [//不许使用的群聊
      114,
      514
    ],
    "enableGroups": [//一定回复的群聊
      11115
    ]
  },
  "maxMessageLength": 100//最大上下文
}

```
