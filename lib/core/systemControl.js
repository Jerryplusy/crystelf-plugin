import configControl from '../config/configControl.js';
import axios from 'axios';

let systemControl = {
  async systemRestart() {
    const token = configControl.get('coreConfig')?.token;
    const coreUrl = configControl.get('coreConfig')?.coreUrl;
    const postUrl = coreUrl + '/api/system/restart';
    //logger.info(returnData);
    return await axios.post(postUrl, { token: token });
  },

  async getRestartTime() {
    const token = configControl.get('coreConfig')?.token;
    const coreUrl = configControl.get('coreConfig')?.coreUrl;
    const postUrl = coreUrl + '/api/system/getRestartTime';
    return axios.post(postUrl, { token: token });
  },
};
export default systemControl;
