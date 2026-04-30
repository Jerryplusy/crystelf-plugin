import fs from 'fs';
import path from 'path';
import Path from '../../constants/path.js';

const fsp = fs.promises;
const WORDS_ROOT = path.join(Path.root, 'resources', 'words');

function getWordsRoot() {
  return WORDS_ROOT;
}

function resolveWordPath(type, id) {
  const root = path.resolve(getWordsRoot());
  const filePath = path.resolve(root, String(type), `${String(id)}.json`);

  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`非法文案路径: ${type}/${id}`);
  }

  return filePath;
}

async function readWordFile(type, id) {
  const filePath = resolveWordPath(type, id);
  const raw = await fsp.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error(`文案文件必须是数组: ${filePath}`);
  }

  return data;
}

function pickRandom(words) {
  if (!Array.isArray(words) || words.length === 0) {
    return '';
  }
  return words[Math.floor(Math.random() * words.length)];
}

function applyParams(text, params = {}) {
  const name = params.name || params.nickName;
  if (!name) {
    return text;
  }

  const defaultName = params.defaultName || '真寻';
  return String(text)
    .replaceAll(defaultName, name)
    .replaceAll('{name}', name)
    .replaceAll('{{name}}', name)
    .replaceAll('%name%', name);
}

const Words = {
  /**
   * 获取某一类型下文案数组
   * @param type 类型s
   * @returns {Promise<string[]>}
   */
  async getWordsList(type) {
    const root = path.resolve(getWordsRoot(), String(type));
    const files = await fsp.readdir(root);
    const wordFiles = files.filter((file) => file.endsWith('.json'));
    const wordLists = await Promise.all(
      wordFiles.map(async (file) => readWordFile(type, path.basename(file, '.json')))
    );
    return wordLists.flat();
  },

  async getWord(type, name, params = {}) {
    const words = await readWordFile(type, name);
    return applyParams(pickRandom(words), params);
  },
};

export default Words;
