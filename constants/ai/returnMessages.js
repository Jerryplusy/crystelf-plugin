// 规范ai返回形式
const returnMessages = [
  {
    type: 'message',
    data: 'Hello, this is a text message.',
  },
  {
    type: 'image',
    data: 'test',
  },
  {
    type: 'at',
    data: 114514,
  },
  {
    type: 'function',
    data: '1',
    extra: {
      params: {
        1: '1',
        2: '2',
      },
      callAI: true,
    },
  },
];

export default returnMessages;
