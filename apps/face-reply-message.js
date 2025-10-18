import YunzaiUtils from "../lib/yunzai/utils.js";
import Message from "../lib/yunzai/message.js";

export class FaceReplyMessage extends plugin {
  constructor() {
    super({
      name: 'FaceReplyMessage',
      dsc: '主动回应表情,查看id等',
      event: 'message.group',
      priority: -115,
      rule:[
        {
          reg: '^(#|/)?回应([\\s\\S]*)?$',
          fnc: 're'
        }
      ]
    });
  }

  async re(e){
    if(!e.message_id||e.message.length === 0) return;
    let face = [];
    e.message.forEach((m)=>{
      if(m.type === 'face'){
        face.push({id:m.id,type:'face1'});
      }else if(m.type === 'text'){
        let emojiList = exEmojis(m.text);
        if(emojiList.length){
          for(const emoji of emojiList){
            const id = emoji.codePointAt(0);
            face.push({id:id,type:'face2'});
          }
        }
      }
    });
    const adapter = await YunzaiUtils.getAdapter(e);
    if(face.length){
      for(const f of face){
        e.reply(`类型: ${f.type},ID: ${f.id}`,true);
        await Message.emojiLike(e,e.message_id,String(f.id),e.group_id,adapter);
      }
    }
    return true;
  }

}
function exEmojis(text) {
  //没错,爆红了
  const emojiRegex =
    /(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const emojis = text.match(emojiRegex);
  return emojis || [];
}
