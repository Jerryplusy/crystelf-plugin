import fs from 'fs';
import path from 'path';
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

let fc = {
  /**
   * 递归创建目录结构
   * @param {string} [path=""] - 要创建的相对路径，支持多级目录（如 "dir1/dir2"）
   * @param {string} [root=""] - 基础根目录，可选值：
   *                            - "root" 或 "yunzai": 使用 Yunzai 根目录
   *                            - 空值: 使用插件目录
   * @param {boolean} [includeFile=false] - 是否包含最后一级作为文件名
   * @example
   * fc.createDir("config/deepseek", "root") // 在 Yunzai 根目录创建 config/deepseek 目录
   */
  createDir(path = '', root = '', includeFile = false) {
    root = getRoot(root);
    let pathList = path.split('/');
    let nowPath = root;
    pathList.forEach((name, idx) => {
      name = name.trim();
      if (!includeFile && idx <= pathList.length - 1) {
        nowPath += name + '/';
        if (name) {
          if (!fs.existsSync(nowPath)) {
            fs.mkdirSync(nowPath);
          }
        }
      }
    });
  },

  /**
   * 读取JSON文件
   * @param {string} [file=""] - JSON文件路径（相对路径）
   * @param {string} [root=""] - 基础根目录（同 createDir）
   * @returns {object} 解析后的JSON对象，如文件不存在或解析失败返回空对象
   * @example
   * const config = fc.readJSON("config.json", "root")
   */
  readJSON(file = '', root = '') {
    root = getRoot(root);
    if (fs.existsSync(`${root}/${file}`)) {
      try {
        return JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8'));
      } catch (e) {
        console.log(e);
      }
    }
    return {};
  },

  statSync(file = '', root = '') {
    root = getRoot(root);
    try {
      return fs.statSync(`${root}/${file}`);
    } catch (e) {
      console.log(e);
    }
  },

  /**
   * 写入JSON文件（完全覆盖）
   * @param {string} file - 目标文件路径
   * @param {object} data - 要写入的JSON数据
   * @param {string} [root=""] - 基础根目录（同 createDir）
   * @param {number} [space=4] - JSON格式化缩进空格数
   * @returns {boolean} 是否写入成功
   * @warning 此方法会完全覆盖目标文件原有内容
   * @example
   * fc.writeJSON("config.json", {key: "value"}, "root", 4)
   */
  writeJSON(file, data, root = '', space = 4) {
    fc.createDir(file, root, true);
    root = getRoot(root);
    try {
      fs.writeFileSync(`${root}/${file}`, JSON.stringify(data, null, space));
      return true;
    } catch (err) {
      logger.error(err);
      return false;
    }
  },

  /**
   * 安全写入JSON文件（合并模式）
   * @param {string} file - 目标文件路径
   * @param {object} data - 要合并的数据
   * @param {string} [root=""] - 基础根目录（同 createDir）
   * @param {number} [space=4] - JSON格式化缩进空格数
   * @returns {boolean} 是否写入成功
   * @description
   * - 如果目标文件不存在，创建新文件
   * - 如果目标文件存在，深度合并新旧数据
   * - 如果目标文件损坏，会创建新文件并记录警告
   * @example
   * fc.safewriteJSON("config.json", {newKey: "value"})
   */
  safeWriteJSON(file, data, root = '', space = 4) {
    fc.createDir(file, root, true);
    root = getRoot(root);
    const filePath = `${root}/${file}`;

    try {
      let existingData = {};
      if (fs.existsSync(filePath)) {
        try {
          existingData = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
        } catch (e) {
          logger.warn(`无法解析现有JSON文件 ${filePath}，将创建新文件`);
        }
      }

      const mergedData = this.deepMerge(existingData, data);

      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, space));
      return true;
    } catch (err) {
      logger.error(`写入JSON文件失败 ${filePath}:`, err);
      return false;
    }
  },

  /**
   * 深度合并两个对象
   * @param {object} target - 目标对象（将被修改）
   * @param {object} source - 源对象
   * @returns {object} 合并后的目标对象
   * @description
   * - 递归合并嵌套对象
   * - 对于非对象属性直接覆盖
   * - 不会合并数组（数组会被直接覆盖）
   * @example
   * const merged = fc.deepMerge({a: 1}, {b: {c: 2}})
   * // 返回 {a: 1, b: {c: 2}}
   */
  deepMerge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          target[key] &&
          typeof target[key] === 'object'
        ) {
          this.deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
    return target;
  },

  /**
   * 递归读取目录中的特定扩展名文件
   * @param {string} directory - 要搜索的目录路径
   * @param {string} extension - 文件扩展名（不带点）
   * @param {string} [excludeDir] - 要排除的目录名
   * @returns {string[]} 匹配的文件相对路径数组
   * @description
   * - 自动跳过以下划线开头的文件
   * - 结果包含子目录中的文件
   * @example
   * const jsFiles = fc.readDirRecursive("./plugins", "js", "node_modules")
   */
  readDirRecursive(directory, extension, excludeDir) {
    let files = fs.readdirSync(directory);

    let jsFiles = files.filter(
      (file) => path.extname(file) === `.${extension}` && !file.startsWith('_')
    );

    files
      .filter((file) => fs.statSync(path.join(directory, file)).isDirectory())
      .forEach((subdirectory) => {
        if (subdirectory === excludeDir) {
          return;
        }

        const subdirectoryPath = path.join(directory, subdirectory);
        jsFiles.push(
          ...fc
            .readDirRecursive(subdirectoryPath, extension, excludeDir)
            .map((fileName) => path.join(subdirectory, fileName))
        );
      });

    return jsFiles;
  },

  /**
   * 深度克隆对象（支持基本类型/数组/对象/Date/RegExp）
   * @param {*} source - 要克隆的数据
   * @returns {*} 深度克隆后的副本
   * @description
   * - 处理循环引用
   * - 保持原型链
   * - 支持特殊对象类型（Date/RegExp等）
   * @example
   * const obj = { a: 1, b: [2, 3] };
   * const cloned = fc.deepClone(obj);
   */
  deepClone(source) {
    const cache = new WeakMap();

    const clone = (value) => {
      if (value === null || typeof value !== 'object') {
        return value;
      }

      if (cache.has(value)) {
        return cache.get(value);
      }

      if (value instanceof Date) return new Date(value);
      if (value instanceof RegExp) return new RegExp(value);

      const target = new value.constructor();
      cache.set(value, target);

      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          target[key] = clone(value[key]);
        }
      }

      return target;
    };

    return clone(source);
  },
};

export default fc;
