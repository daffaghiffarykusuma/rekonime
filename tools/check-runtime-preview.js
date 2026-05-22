import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const runtimePreviewPath = path.join(dist, 'data', 'anime.preview.json');
const runtimeFullIndexPath = path.join(dist, 'data', 'anime.full.index.json');
const runtimeFullPath = path.join(dist, 'data', 'anime.full.json');
const detailDir = path.join(dist, 'data', 'anime.detail');

const fullIndexRawBudgetBytes = 4 * 1024 * 1024;
const detailChunkRawBudgetBytes = 128 * 1024;

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const hasPopulatedArray = (value) => Array.isArray(value) && value.length > 0;

const listFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(absolutePath);
    return entry.isFile() ? [absolutePath] : [];
  });
};

const main = () => {
  const failures = [];

  if (fs.existsSync(runtimePreviewPath)) {
    failures.push('Runtime distribution still contains data/anime.preview.json; first load must use anime.full.index.json directly.');
  }

  if (fs.existsSync(runtimeFullPath)) {
    failures.push('Runtime distribution contains monolithic data/anime.full.json; use anime.full.index.json plus detail chunks instead.');
  }

  if (!fs.existsSync(runtimeFullIndexPath)) {
    failures.push('Runtime full index is missing: data/anime.full.index.json.');
  } else {
    const indexBytes = fs.readFileSync(runtimeFullIndexPath);
    const indexPayload = readJson(runtimeFullIndexPath);
    const indexAnime = Array.isArray(indexPayload?.anime) ? indexPayload.anime : [];
    if (indexBytes.length > fullIndexRawBudgetBytes) {
      failures.push(`Runtime full index raw size ${formatBytes(indexBytes.length)} exceeds budget ${formatBytes(fullIndexRawBudgetBytes)}.`);
    }
    const entriesWithFullEpisodes = indexAnime
      .filter((anime) => hasPopulatedArray(anime?.episodes))
      .slice(0, 5)
      .map((anime) => anime.id || anime.title || 'unknown');
    if (entriesWithFullEpisodes.length) {
      failures.push(`Runtime full index contains populated episode arrays: ${entriesWithFullEpisodes.join(', ')}.`);
    }
    const entriesWithRollingAverages = indexAnime
      .filter((anime) => hasPopulatedArray(anime?.stats?.rollingAverage))
      .slice(0, 5)
      .map((anime) => anime.id || anime.title || 'unknown');
    if (entriesWithRollingAverages.length) {
      failures.push(`Runtime full index contains detailed rolling averages: ${entriesWithRollingAverages.join(', ')}.`);
    }
    const entriesWithoutDetailPath = indexAnime
      .filter((anime) => typeof anime?.detailPath !== 'string' || !anime.detailPath)
      .slice(0, 5)
      .map((anime) => anime.id || anime.title || 'unknown');
    if (entriesWithoutDetailPath.length) {
      failures.push(`Runtime full index entries are missing detail paths: ${entriesWithoutDetailPath.join(', ')}.`);
    }
  }

  const detailFiles = listFiles(detailDir);
  if (!detailFiles.length) {
    failures.push('Runtime detail chunks are missing: data/anime.detail/*.json.');
  }
  const oversizedDetailFiles = detailFiles
    .map((filePath) => ({ filePath, size: fs.statSync(filePath).size }))
    .filter((file) => file.size > detailChunkRawBudgetBytes)
    .slice(0, 5);
  if (oversizedDetailFiles.length) {
    failures.push(`Runtime detail chunks exceed ${formatBytes(detailChunkRawBudgetBytes)}: ${oversizedDetailFiles.map((file) => `${path.relative(dist, file.filePath).replace(/\\/g, '/')} (${formatBytes(file.size)})`).join(', ')}.`);
  }

  if (failures.length) {
    console.error('Runtime catalog check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  const indexBytes = fs.readFileSync(runtimeFullIndexPath);
  const indexGzipBytes = zlib.gzipSync(indexBytes).length;
  console.log(`Runtime catalog check passed. Full index raw: ${formatBytes(indexBytes.length)} / ${formatBytes(fullIndexRawBudgetBytes)}. Gzip: ${formatBytes(indexGzipBytes)}.`);
};

main();
