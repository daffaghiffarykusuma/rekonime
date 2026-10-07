import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createScoreRefreshRun, SCORE_REFRESH_DEFAULTS } from './lib/score-refresh-run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'anime.json');

const parseNumberArg = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const parseScoreRefreshArgs = (argv) => {
  const options = { ...SCORE_REFRESH_DEFAULTS, dataPath: DEFAULT_DATA_PATH };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const key = arg.replace(/^--/, '');
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? next : null;

    if (value !== null) i += 1;

    if (key === 'score-source') {
      if (!['auto', 'mal'].includes(value)) throw new Error('--score-source must be auto or mal');
      options.scoreSource = value;
    } else if (key === 'data' && value) {
      options.dataPath = path.resolve(process.cwd(), value);
    } else if (key === 'limit' && value) {
      const parsed = Number(value);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } else if (key === 'start-index' && value) {
      options.startIndex = parseNumberArg(value, 0);
    } else if (key === 'save-interval' && value) {
      options.saveInterval = Math.max(1, parseNumberArg(value, SCORE_REFRESH_DEFAULTS.saveInterval));
    } else if (key === 'mal-delay-ms' && value) {
      options.malDelayMs = Math.max(0, parseNumberArg(value, SCORE_REFRESH_DEFAULTS.malDelayMs));
    } else if (key === 'jikan-delay-ms' && value) {
      options.jikanDelayMs = Math.max(0, parseNumberArg(value, SCORE_REFRESH_DEFAULTS.jikanDelayMs));
    } else if (key === 'concurrency' && value) {
      options.concurrency = Math.max(1, parseNumberArg(value, SCORE_REFRESH_DEFAULTS.concurrency));
    } else if (key === 'mal-ids' && value) {
      const ids = value
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((part) => Number.isFinite(part) && part > 0);
      options.malIds = ids.length ? new Set(ids) : null;
    }
  }

  return options;
};

const printResume = ({ resumeIndex }) => {
  console.log(`Progress saved. Resume later with the same data, filters and season date using --start-index ${resumeIndex}.`);
};

// Shared CLI adapter for whole-catalog and seasonal runs. Importing it does no work.
export const refreshScores = async (options) => {
  if (!fs.existsSync(options.dataPath)) throw new Error(`Data file not found: ${options.dataPath}`);
  const root = JSON.parse(fs.readFileSync(options.dataPath, 'utf8'));
  const run = createScoreRefreshRun({
    root, options,
    save: catalog => fs.writeFileSync(options.dataPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8'),
    onEvent: event => {
      if (event.type === 'started') {
        console.log(`Updating scores for ${event.total} anime (index ${event.startIndex}..${Math.max(event.startIndex, event.endIndex - 1)})`);
        if (options.malIds) console.log(`Mode: filtered MAL IDs (${options.malIds.size})`);
        console.log(`Data path: ${path.relative(process.cwd(), options.dataPath)}`);
        console.log(`Community score source: ${options.scoreSource}`);
        const jikanPacing = options.scoreSource === 'auto' ? ` | Jikan delay: ${options.jikanDelayMs}ms` : '';
        console.log(`MAL delay: ${options.malDelayMs}ms${jikanPacing} | Save interval: ${options.saveInterval} | Concurrency: ${options.concurrency}`);
      } else if (event.type === 'cooldown') {
        console.log(`${event.hostname}: ${event.reason}. Pausing provider requests for ${Math.ceil(event.delayMs / 1000)} seconds.`);
      } else if (event.type === 'provider-unavailable') {
        console.log(`${event.hostname}: repeated ${event.reason}. Using MAL for community scores for the rest of this run, with the same MAL pacing. A new run will try Jikan again.`);
      } else if (event.type === 'fetch-failed') {
        console.error(`[${event.index + 1}/${event.total}] ${event.kind === 'score' ? 'Score' : 'Episode'} fetch failed for "${event.title}" (MAL ${event.malId}): ${event.reason}`);
      } else if (event.type === 'saved' || event.type === 'progress') {
        console.log(`${event.type === 'saved' ? 'Saved progress' : 'Progress'}: ${event.processed}/${event.total}`);
      }
    }
  });
  const interrupt = () => {
    printResume(run.stop());
    process.exit(130);
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  let result;
  try { result = await run.run(); }
  finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
  if (result.status === 'stopped') {
    console.error(`\nRefresh stopped: ${result.reason}`);
    printResume(result);
    process.exitCode = 1;
  } else console.log('\nRefresh complete.');
  const { stats } = result;
  console.log(`Processed: ${stats.processed}`);
  console.log(`Community score updated: ${stats.updatedCommunityScore}`);
  console.log(`Community score unchanged: ${stats.unchangedCommunityScore}`);
  console.log(`Community score errors: ${stats.scoreErrors}`);
  console.log(`Episodes updated: ${stats.updatedEpisodes}`);
  console.log(`Episodes unchanged/no-new-data: ${stats.unchangedEpisodes}`);
  console.log(`Episode errors: ${stats.episodeErrors}`);
  if (result.failedMalIds.length) console.log(`Failed MAL IDs: ${result.failedMalIds.join(',')}`);
  return result;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await refreshScores(parseScoreRefreshArgs(process.argv.slice(2))); }
  catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
