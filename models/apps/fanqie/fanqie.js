import axios from 'axios';

class Fanqie {
  constructor(apiurl) {
    this.apiurl = apiurl;
  }

  async get_info(book_id) {
    try {
      let url = `${this.apiurl}/api/info?book_id=${book_id}&source=fanqie`;
      let res = await axios.get(url);
      if (res.status !== 200 || !res.data) throw new Error('请求失败或无数据');
      let result = res.data['data'];
      if (!result) throw new Error('data 字段不存在');
      return {
        author: result.author,
        book_name: result.book_name,
        original_book_name: result.original_book_name,
      };
    } catch (e) {
      logger.error(e);
      return false;
    }
  }
  async down(book_id, msg_id) {
    try {
      let url = `${this.apiurl}/api/down?book_id=${book_id}&source=fanqie&type=txt&user_id=${msg_id}`;
      // 发送get请求
      await axios.get(url);
      return true;
    } catch (e) {
      logger.error(e);
      return false;
    }
  }
}

export default Fanqie;
