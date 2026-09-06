import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const blockedDistPaths = [
  path.join('data', 'backups'),
  path.join('data', 'anime.json'),
  path.join('data', 'anime.full.json'),
  path.join('data', 'build-report.json')
];

const formatDistPath = (targetPath) => path.relative(dist, targetPath).replace(/\\/g, '/');

const main = () => {
  if (!fs.existsSync(dist)) {
    console.error('Distribution asset check failed: dist/ does not exist. Run the build first.');
    process.exitCode = 1;
    return;
  }

  const blocked = blockedDistPaths
    .map((entry) => path.join(dist, entry))
    .filter((targetPath) => fs.existsSync(targetPath));

  if (blocked.length) {
    console.error('Distribution asset check failed. Non-runtime artifacts found:');
    blocked.forEach((targetPath) => console.error(`- ${formatDistPath(targetPath)}`));
    process.exitCode = 1;
    return;
  }

  const homePath = path.join(dist, 'index.html');
  const homeHtml = fs.existsSync(homePath) ? fs.readFileSync(homePath, 'utf8') : '';
  const mainStyleMatch = homeHtml.match(/href="\/css\/(main-[A-Za-z0-9_-]+\.css)"/);
  if (!mainStyleMatch || !fs.existsSync(path.join(dist, 'css', mainStyleMatch[1]))) {
    console.error('Distribution asset check failed:');
    console.error('- index.html must reference an existing versioned main stylesheet');
    process.exitCode = 1;
    return;
  }

  const watchlistPath = path.join(dist, 'watchlist.html');
  const sharedStylePosition = homeHtml.indexOf('href="/css/preload-helper.css"');
  if (sharedStylePosition < homeHtml.indexOf(mainStyleMatch[0])) {
    console.error('Distribution asset check failed: shared theme styles must follow home page styles');
    process.exitCode = 1;
    return;
  }
  const watchlistHtml = fs.existsSync(watchlistPath)
    ? fs.readFileSync(watchlistPath, 'utf8')
    : '';
  const watchlistStyleErrors = [];
  if (!watchlistHtml.includes('id="watchlist-critical-styles"')) {
    watchlistStyleErrors.push('watchlist.html is missing inlined production styles');
  }
  const watchlistCss = fs.readFileSync(path.join(dist, 'css', 'watchlist.css'), 'utf8');
  const sharedCss = fs.readFileSync(path.join(dist, 'css', 'preload-helper.css'), 'utf8');
  if (!watchlistHtml.includes(`${watchlistCss}\n${sharedCss}`)) {
    watchlistStyleErrors.push('shared theme styles must follow watchlist page styles');
  }
  if (/href="\/css\/(?:preload-helper|watchlist)\.css"/.test(watchlistHtml)) {
    watchlistStyleErrors.push('watchlist.html still has render-blocking stylesheet requests');
  }
  if (watchlistStyleErrors.length) {
    console.error('Distribution asset check failed:');
    watchlistStyleErrors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log('Distribution asset check passed.');
};

main();
