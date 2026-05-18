import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const mib = 1024 * 1024;
const kib = 1024;

const totalBudgetBytes = 27 * mib;
const fileBudgets = new Map([
  ['js/data.js', 1.5 * mib],
  ['data/anime.full.json', 20 * mib],
  ['data/franchise-map.json', 2.5 * mib],
  ['data/anime.preview.json', 1.5 * mib],
  ['js/app.js', 225 * kib],
  ['css/styles.css', 170 * kib],
  ['css/main.css', 125 * kib],
  ['css/watchlist.css', 100 * kib]
]);

const formatBytes = (bytes) => {
  if (bytes >= mib) return `${(bytes / mib).toFixed(2)} MiB`;
  if (bytes >= kib) return `${(bytes / kib).toFixed(1)} KiB`;
  return `${bytes} B`;
};

const listFiles = (dir, base = dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(absolutePath, base);
    }
    if (!entry.isFile()) {
      return [];
    }
    const relativePath = path.relative(base, absolutePath).replace(/\\/g, '/');
    return [{ absolutePath, relativePath, size: fs.statSync(absolutePath).size }];
  });
};

const main = () => {
  if (!fs.existsSync(dist)) {
    console.error('Distribution size budget check failed: dist/ does not exist. Run the build first.');
    process.exitCode = 1;
    return;
  }

  const files = listFiles(dist);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const failures = [];

  if (totalBytes > totalBudgetBytes) {
    failures.push(`Total dist size ${formatBytes(totalBytes)} exceeds budget ${formatBytes(totalBudgetBytes)}.`);
  }

  for (const [relativePath, budgetBytes] of fileBudgets) {
    const file = files.find((entry) => entry.relativePath === relativePath);
    if (!file) continue;
    if (file.size > budgetBytes) {
      failures.push(`${relativePath} is ${formatBytes(file.size)}, above budget ${formatBytes(budgetBytes)}.`);
    }
  }

  const largest = [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 8)
    .map((file) => `- ${file.relativePath}: ${formatBytes(file.size)}`);

  if (failures.length) {
    console.error('Distribution size budget check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    console.error('');
    console.error('Largest files:');
    largest.forEach((line) => console.error(line));
    process.exitCode = 1;
    return;
  }

  console.log(`Distribution size budget check passed. Total: ${formatBytes(totalBytes)} / ${formatBytes(totalBudgetBytes)}.`);
  console.log('Largest files:');
  largest.forEach((line) => console.log(line));
};

main();
