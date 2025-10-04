import ConfigControl from '../config/configControl.js';

class NapcatGroup {}
class LgrGroup {}

async function getGroupAdapter() {
  const adapter = (await ConfigControl.get('config'))?.adapter;
  if (!adapter || adapter === 'nc' || adapter === 'napcat') {
    return new NapcatGroup();
  } else if (adapter === 'lgr' || adapter === 'lagrange') {
    return new LgrGroup();
  }
  return new NapcatGroup();
}

export default await getGroupAdapter();
