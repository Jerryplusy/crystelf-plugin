import Version from '../lib/system/version.js';

const Plugin_Name = Version.name;

const _path = process.cwd();
const getRoot = (root = '') => {
  if (root === 'root' || root === 'yunzai') {
    root = `${_path}/`;
  } else if (!root) {
    root = `${_path}/plugins/${Plugin_Name}/`;
  }
  return root;
};

let mc = {
  /**
   * 动态导入JS模块
   * @param {string} file - 模块文件路径（可省略.js后缀）
   * @param {string} [root=""] - 基础根目录（同 createDir）
   * @returns {Promise<object>} 模块导出对象，如导入失败返回空对象
   * @description
   * - 自动添加时间戳参数防止缓存
   * - 自动补全.js后缀
   * @example
   * const module = await fc.importModule("utils/helper")
   */
  async importModule(file, root = '') {
    root = getRoot(root);
    if (!/\.js$/.test(file)) {
      file = file + '.js';
    }
    if (fs.existsSync(`${root}/${file}`)) {
      try {
        let data = await import(`file://${root}/${file}?t=${new Date() * 1}`);
        return data || {};
      } catch (e) {
        console.log(e);
      }
    }
    return {};
  },

  /**
   * 动态导入JS模块的默认导出
   * @param {string} file - 模块文件路径
   * @param {string} [root=""] - 基础根目录（同 createDir）
   * @returns {Promise<object>} 模块的默认导出，如失败返回空对象
   * @example
   * const defaultExport = await fc.importDefault("components/Header")
   */
  async importDefault(file, root) {
    let ret = await fc.importModule(file, root);
    return ret.default || {};
  },
};

export default mc;
