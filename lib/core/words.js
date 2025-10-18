import ConfigControl from "../config/configControl.js";
import axios from "axios";

const Words = {
  /**
   * 获取某一类型下文案数组
   * @param type 类型s
   * @returns {Promise<axios.AxiosResponse<any>>}
   */
  async getWordsList(type){
    const coreConfig = await ConfigControl.get()?.coreConfig;
    const coreUrl = coreConfig.coreUrl;
    return await (await axios.post(`${coreUrl}/api/words/list`, {
      type: type,
    }))?.data?.data;
  },

  async getWord(type,name){
    const coreConfig = await ConfigControl.get()?.coreConfig;
    const coreUrl = coreConfig.coreUrl;
    return await (await axios.post(`${coreUrl}/api/words/getText`, {
      type: type,
      id: name
    }))?.data?.data;
  }
}

export default Words;
