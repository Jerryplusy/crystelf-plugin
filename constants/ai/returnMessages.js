// 规范ai返回形式
// 数组形式
// 所有type可选,至少有一个
// 可以有多个同样的type
const returnMessages = [
  {
    type: 'message',
    data: 'Hello, this is a text message.',
    at: false, //可选
    quote: false, //可选
    recall: 0, //可选,非必要为0,最大为120s后撤回
  },
  {
    type: 'code',
    data: '```python print("hello world");```")',
  },
  //图片格式发送md,仅在需要渲染表格或其他需要md的地方,普通信息使用message
  {
    type: 'markdown',
    data: '# hi',
  },
  {
    type: 'meme',
    data: 'happy',
  },
  {
    type: 'at',
    id: '114514',
  },
  {
    type: 'poke',
    id: '114514',
  },
  {
    type: 'recall',
    seq: '111',
  },
  {
    type: 'emoji-like',
    id: '114514',
  },
  {
    type: 'ai-record',
    data: 'hello',
  },
  {
    type: 'like',
    id: '114514',
    num: 10, //默认10次,可根据情绪或需求改变次数,最大10次
  },
  {
    type: 'file',
    data: 'a long message',
    filename: 'message.txt',
  },
  //要记住的东西,可选
  //记忆内容要简洁,关键词便于检索
  {
    type: 'memory',
    data: 'data to memory',
    key: ['key1', 'key2'],
  },
  //概括用户说了什么,必须
  //内容需简洁
  {
    type: 'summary',
    data: 'something',
  },
];

export default returnMessages;
