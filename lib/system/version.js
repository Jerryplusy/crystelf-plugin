import fs from 'fs';
import url from 'url';
import path from 'path';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.join(__dirname, '../..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const Version = {
  get ver() {
    return pkg.version;
  },
  get author() {
    return pkg.author;
  },
  get name() {
    return pkg.name;
  },
  get description() {
    return pkg.description;
  },
};

export default Version;
