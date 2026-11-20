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
  // Allow the 3,649-title catalog after the Fall 2026 import. Stats defaults
  // compaction (catalog-stats-defaults.js) brought it to about 2.8 MiB.
  ['data/anime.full.index.json', 3.6 * mib],
  ['data/franchise-map.json', 2.5 * mib],
  // Raised from 190 KiB in Nov 2026, when the bundle reached 183 KiB.
  ['js/app.js', 210 * kib],
  ['fonts/phosphor-icons.woff2', 8 * kib],
  // The single text font replaced two files totalling 85.6 KiB (87,692 bytes); keep it below that.
  ['fonts/archivo-latin-variable.woff2', 85 * kib],
  [/^css\/main-[A-Za-z0-9_-]+\.css$/, 125 * kib],
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

  for (const [fileMatcher, budgetBytes] of fileBudgets) {
    const matches = files.filter((entry) => (
      fileMatcher instanceof RegExp
        ? fileMatcher.test(entry.relativePath)
        : entry.relativePath === fileMatcher
    ));
    if (!matches.length) {
      failures.push(`Required budgeted asset is missing: ${fileMatcher}.`);
    }
    for (const file of matches) {
      if (file.size > budgetBytes) {
        failures.push(`${file.relativePath} is ${formatBytes(file.size)}, above budget ${formatBytes(budgetBytes)}.`);
      }
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
