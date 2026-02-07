import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const homeIndexPath = path.join(root, 'home', 'index.html');
const viteConfigPath = path.join(root, 'vite.config.js');

const errors = [];

if (fs.existsSync(homeIndexPath)) {
  errors.push('home/index.html exists; home entrypoint should be served via rewrite only.');
}

const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
if (/home\s*:\s*resolve\(__dirname,\s*['"]home\/index\.html['"]\)/.test(viteConfig)) {
  errors.push('vite.config.js still defines a duplicated home entrypoint.');
}

if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
} else {
  console.log('Entrypoint deduplication check passed.');
}
