import ConfigControl from '../config/configControl.js';

class NapcatSelf {}
class LgrSelf {}

async function getSelfAdapter() {
  const adapter = (await ConfigControl.get('config'))?.adapter;
  if (!adapter || adapter === 'nc' || adapter === 'napcat') {
    return new NapcatSelf();
  } else if (adapter === 'lgr' || adapter === 'lagrange') {
    return new LgrSelf();
  }
  return new NapcatSelf();
}

export default await getSelfAdapter();
