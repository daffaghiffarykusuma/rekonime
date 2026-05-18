import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const sourcePreviewPath = path.join(root, 'data', 'anime.preview.json');
const runtimePreviewPath = path.join(dist, 'data', 'anime.preview.json');

const rawBudgetBytes = 700 * 1024;
const gzipBudgetBytes = 160 * 1024;

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const hasPopulatedArray = (value) => Array.isArray(value) && value.length > 0;

const main = () => {
  const failures = [];

  if (!fs.existsSync(runtimePreviewPath)) {
    console.error('Runtime preview check failed: dist/data/anime.preview.json does not exist. Run the build first.');
    process.exitCode = 1;
    return;
  }

  const runtimeBytes = fs.readFileSync(runtimePreviewPath);
  const runtimePayload = readJson(runtimePreviewPath);
  const runtimeAnime = Array.isArray(runtimePayload?.anime) ? runtimePayload.anime : [];
  const rawSize = runtimeBytes.length;
  const gzipSize = zlib.gzipSync(runtimeBytes).length;

  if (rawSize > rawBudgetBytes) {
    failures.push(`Runtime preview raw size ${formatBytes(rawSize)} exceeds budget ${formatBytes(rawBudgetBytes)}.`);
  }

  if (gzipSize > gzipBudgetBytes) {
    failures.push(`Runtime preview gzip size ${formatBytes(gzipSize)} exceeds budget ${formatBytes(gzipBudgetBytes)}.`);
  }

  const entriesWithEpisodes = runtimeAnime
    .filter((anime) => hasPopulatedArray(anime?.episodes))
    .slice(0, 5)
    .map((anime) => anime.id || anime.title || 'unknown');

  if (entriesWithEpisodes.length) {
    failures.push(`Runtime preview contains populated episode arrays: ${entriesWithEpisodes.join(', ')}.`);
  }

  const entriesWithFranchise = runtimeAnime
    .filter((anime) => anime?.franchise !== undefined)
    .slice(0, 5)
    .map((anime) => anime.id || anime.title || 'unknown');

  if (entriesWithFranchise.length) {
    failures.push(`Runtime preview contains franchise metadata: ${entriesWithFranchise.join(', ')}.`);
  }

  if (fs.existsSync(sourcePreviewPath)) {
    const sourcePayload = readJson(sourcePreviewPath);
    const sourceAnime = Array.isArray(sourcePayload?.anime) ? sourcePayload.anime : [];
    const sourceHasFullShape = sourceAnime.some((anime) => hasPopulatedArray(anime?.episodes) || anime?.franchise !== undefined);
    if (!sourceHasFullShape) {
      failures.push('Source preview no longer appears validation-compatible; expected at least one entry with episode or franchise detail.');
    }
  }

  if (failures.length) {
    console.error('Runtime preview check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Runtime preview check passed. Raw: ${formatBytes(rawSize)} / ${formatBytes(rawBudgetBytes)}. Gzip: ${formatBytes(gzipSize)} / ${formatBytes(gzipBudgetBytes)}.`);
};

main();
