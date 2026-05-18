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

const copyRuntimeData = () => {
  const runtimeDataFiles = [
    'anime.preview.json',
    'anime.full.json',
    'anime.json',
    'franchise-map.json'
  ];

  runtimeDataFiles.forEach((fileName) => {
    copyRecursive(path.join(root, 'data', fileName), path.join(dist, 'data', fileName));
  });
};

const readBuildVersion = () => {
  const versionPath = path.join(dist, 'version.json');
  if (!fs.existsSync(versionPath)) return 'dev';
  try {
    const payload = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    return String(payload?.version || 'dev');
  } catch {
    return 'dev';
  }
};

const copyServiceWorker = () => {
  const swSourcePath = path.join(root, 'sw.js');
  if (!fs.existsSync(swSourcePath)) return;
  const cacheVersion = readBuildVersion();
  const source = fs.readFileSync(swSourcePath, 'utf8');
  const stamped = source.replace(/__REKONIME_CACHE_VERSION__/g, cacheVersion);
  const outputPath = path.join(dist, 'sw.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, stamped, 'utf8');
};

const stripInjectedStylesheetLinks = () => {
  const htmlFiles = ['index.html', 'watchlist.html'];
  const injectedStylesheetPattern = /\s*<link\s+rel="stylesheet"\s+crossorigin\s+href="\/css\/(?:main|watchlist2|noncritical-styles)\.css">\r?\n?/g;

  htmlFiles.forEach((fileName) => {
    const filePath = path.join(dist, fileName);
    if (!fs.existsSync(filePath)) return;
    const source = fs.readFileSync(filePath, 'utf8');
    const next = source.replace(injectedStylesheetPattern, '\n');
    if (next !== source) {
      fs.writeFileSync(filePath, next, 'utf8');
    }
  });
};

copyRuntimeData();
copyRecursive(path.join(root, 'js', 'data.js'), path.join(dist, 'js', 'data.js'));
copyRecursive(path.join(root, 'js', 'sw-cache-policy.js'), path.join(dist, 'js', 'sw-cache-policy.js'));
copyRecursive(path.join(root, 'js', 'bootstrap'), path.join(dist, 'js', 'bootstrap'));
copyRecursive(path.join(root, 'health.html'), path.join(dist, 'health.html'));
copyServiceWorker();
stripInjectedStylesheetLinks();
