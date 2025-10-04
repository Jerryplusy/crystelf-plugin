import ConfigControl from '../config/configControl.js';

class NapcatMessage {}
class LgrMessage {}

async function getMessageAdapter() {
  const adapter = (await ConfigControl.get('config'))?.adapter;
  if (!adapter || adapter === 'nc' || adapter === 'napcat') {
    return new NapcatMessage();
  } else if (adapter === 'lgr' || adapter === 'lagrange') {
    return new LgrMessage();
  }
  return new NapcatMessage();
}

export default await getMessageAdapter();
