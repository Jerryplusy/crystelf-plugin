import ConfigControl from '../config/configControl.js';
import axios from 'axios';

const Meme = {
  async getMeme(character, status) {
    const coreConfig = await ConfigControl.get()?.coreConfig;
    const coreUrl = coreConfig?.coreUrl;
    const token = coreConfig?.token;
    //logger.info(`${coreUrl}/api/meme`);
    return `${coreUrl}/api/meme?token=${token}?character=${character}&status=${status}`;
  },
};

export default Meme;
