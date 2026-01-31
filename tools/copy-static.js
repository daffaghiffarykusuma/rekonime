import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const copyRecursive = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
};

copyRecursive(path.join(root, 'data'), path.join(dist, 'data'));
copyRecursive(path.join(root, 'js', 'data.js'), path.join(dist, 'js', 'data.js'));
copyRecursive(path.join(root, 'sw.js'), path.join(dist, 'sw.js'));
