import fs from 'fs';
import path from 'path';
import Version from '../lib/system/version.js';

const fsp = fs.promises;
const Plugin_Name = Version.name;

const _path = process.cwd();
const getRoot = (root = '') => {
  if (root === 'root' || root === 'yunzai') {
    root = `${_path}/`;
  } else if (!root || root === '') {
    root = `${_path}/plugins/${Plugin_Name}/`;
  }
  return root;
};

let fc = {
  /**
   * 递归创建目录结构
   */
  async createDir(p = '', root = '', includeFile = false) {
    root = getRoot(root);
    const pathList = p.split('/');
    let nowPath = root;

    for (let idx = 0; idx < pathList.length; idx++) {
      const name = pathList[idx].trim();
      if (!includeFile && idx <= pathList.length - 1) {
        nowPath += name + '/';
        if (name) {
          try {
            await fsp.access(nowPath);
          } catch {
            await fsp.mkdir(nowPath);
          }
        }
      }
    }
  },

  /**
   * 读取json文件
   * @param filePath 绝对路径
   * @returns {Promise<{}|any>}
   */
  async readJSON(filePath) {
    try {
      const data = await fsp.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  },

  /**
   * 写入
   * @param filePath 绝对路径
   * @param data
   * @returns {Promise<void>}
   */
  async writeJSON(filePath, data) {
    await fsp.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
  },

  /**
   * 合并配置
   * @param base 基准配置
   * @param addon 额外配置
   * @returns {*}
   */
  mergeConfig(base, addon) {
    const result = { ...base };
    for (const [key, value] of Object.entries(addon)) {
      if (!(key in result)) {
        result[key] = value;
      } else if (
        typeof result[key] === 'object' &&
        typeof value === 'object' &&
        !Array.isArray(result[key]) &&
        !Array.isArray(value)
      ) {
        result[key] = this.mergeConfig(result[key], value);
      }
    }
    return result;
  },

  /**
   * 异步递归读取目录中的特定扩展名文件
   */
  async readDirRecursive(directory, extension, excludeDir) {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    let files = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        if (path.extname(entry.name) === `.${extension}` && !entry.name.startsWith('_')) {
          files.push(entry.name);
        }
      } else if (entry.isDirectory()) {
        if (entry.name === excludeDir) continue;
        const subFiles = await this.readDirRecursive(
          path.join(directory, entry.name),
          extension,
          excludeDir
        );
        files.push(...subFiles.map((fileName) => path.join(entry.name, fileName)));
      }
    }
    return files;
  },
};
export default fc;
