import ConfigControl from '../lib/config/configControl.js';
import Message from '../lib/yunzai/message.js';

export class FaceReply extends plugin {
  constructor() {
    super({
      name: 'face-reply',
      dsc: '给消息中的表情贴上回应',
      event: 'message.group',
      priority: -114,
    });
  }

  async accept(e) {
    if (!ConfigControl.get('config')?.faceReply) return;
    if (!e.message_id || e.message.length === 0) return;
    let face = [];
    e.message.forEach((m) => {
      if (m.type === 'face') {
        face.push({ id: m.id });
      } else if (m.type === 'text') {
        let emojiList = exEmojis(m.text);
        if (emojiList.length) {
          for (const emoji of emojiList) {
            const id = emoji.codePointAt(0);
            face.push({ id: id });
          }
        }
      }
    });
    if (face.length) {
      for (const f of face) {
        await Message.emojiLike(e, e.message_id, String(f.id));
      }
    }
  }
}

//从消息中提取emoji
function exEmojis(text) {
  //没错,爆红了
  const emojiRegex =
    /(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const emojis = text.match(emojiRegex);
  return emojis || [];
}
