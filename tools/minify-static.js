import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const assets = [
  { input: path.join(root, 'css', 'styles.css'), output: path.join(root, 'css', 'styles.min.css'), type: 'css' },
  { input: path.join(root, 'css', 'themes.css'), output: path.join(root, 'css', 'themes.min.css'), type: 'css' },
  { input: path.join(root, 'css', 'watchlist.css'), output: path.join(root, 'css', 'watchlist.min.css'), type: 'css' },
  { input: path.join(root, 'js', 'main.js'), output: path.join(root, 'js', 'main.min.js'), type: 'js' },
  { input: path.join(root, 'js', 'watchlist-main.js'), output: path.join(root, 'js', 'watchlist-main.min.js'), type: 'js' }
];

const minifyCss = (input) => {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('');
};

const minifyJs = (input) => {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

assets.forEach((asset) => {
  if (!fs.existsSync(asset.input)) return;
  const raw = fs.readFileSync(asset.input, 'utf8');
  const minified = asset.type === 'css' ? minifyCss(raw) : minifyJs(raw);
  ensureDir(asset.output);
  fs.writeFileSync(asset.output, minified, 'utf8');
});
