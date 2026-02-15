import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'anime.json');
const DEFAULT_SAVE_INTERVAL = 25;
const DEFAULT_MAL_DELAY_MS = 1200;
const DEFAULT_JIKAN_DELAY_MS = 400;
const MAX_RETRIES = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseNumberArg = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseArgs = (argv) => {
  const options = {
    dataPath: DEFAULT_DATA_PATH,
    limit: null,
    startIndex: 0,
    saveInterval: DEFAULT_SAVE_INTERVAL,
    malDelayMs: DEFAULT_MAL_DELAY_MS,
    jikanDelayMs: DEFAULT_JIKAN_DELAY_MS,
    malIds: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const key = arg.replace(/^--/, '');
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? next : null;

    if (value !== null) i += 1;

    if (key === 'data' && value) {
      options.dataPath = path.resolve(process.cwd(), value);
    } else if (key === 'limit' && value) {
      const parsed = Number(value);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } else if (key === 'start-index' && value) {
      options.startIndex = parseNumberArg(value, 0);
    } else if (key === 'save-interval' && value) {
      options.saveInterval = Math.max(1, parseNumberArg(value, DEFAULT_SAVE_INTERVAL));
    } else if (key === 'mal-delay-ms' && value) {
      options.malDelayMs = Math.max(0, parseNumberArg(value, DEFAULT_MAL_DELAY_MS));
    } else if (key === 'jikan-delay-ms' && value) {
      options.jikanDelayMs = Math.max(0, parseNumberArg(value, DEFAULT_JIKAN_DELAY_MS));
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

const getMalId = (anime) => (
  anime?.mal_id ??
  anime?.malId ??
  anime?.metadata?.malId ??
  anime?.metadata?.mal_id
);

const getSlug = (anime) => {
  const fromData = anime?.metadata?.id || anime?.id;
  if (fromData) return String(fromData);

  const title = anime?.metadata?.title || anime?.title || '';
  return String(title)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const parseEpisodeScores = (html) => {
  const rows = html.match(/<tr class="episode-list-data"[\s\S]*?<\/tr>/g) || [];
  const episodes = [];

  for (const row of rows) {
    let epMatch = row.match(/episode-number[^>]*data-raw="(\d+)"/);
    if (!epMatch) {
      epMatch = row.match(/episode-number[^>]*>\s*(\d+)\s*</);
    }

    const episodeNumber = epMatch ? Number(epMatch[1]) : null;
    if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) continue;

    const scoreMatch = row.match(/episode-poll[^>]*data-raw="([0-9]+(?:\.[0-9]+)?)"/);
    if (!scoreMatch) continue;

    const score = Number(scoreMatch[1]);
    if (!Number.isFinite(score) || score < 1 || score > 5) continue;

    episodes.push({ episode: episodeNumber, score });
  }

  return episodes.sort((left, right) => left.episode - right.episode);
};

const episodesChanged = (existing, incoming) => {
  if (!Array.isArray(existing) || existing.length !== incoming.length) return true;
  for (let i = 0; i < incoming.length; i += 1) {
    if (existing[i]?.episode !== incoming[i].episode) return true;
    if (existing[i]?.score !== incoming[i].score) return true;
  }
  return false;
};

const fetchWithRetry = async (url, options = {}) => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === MAX_RETRIES) {
        throw new Error(`HTTP ${response.status}`);
      }

      const retryAfter = response.headers.get('retry-after');
      const backoffMs = retryAfter ? Number(retryAfter) * 1000 : 1000 * (attempt + 1);
      await sleep(backoffMs);
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }

  throw new Error(`Failed to fetch ${url}`);
};

const fetchCommunityScore = async (malId) => {
  const url = `https://api.jikan.moe/v4/anime/${malId}`;
  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'rekonime-refresh-scores/1.0',
      Accept: 'application/json'
    }
  });
  const payload = await response.json();
  const raw = payload?.data?.score;
  const score = Number(raw);
  return Number.isFinite(score) ? score : null;
};

const fetchEpisodeScores = async (malId, slug) => {
  const url = `https://myanimelist.net/anime/${malId}/${slug}/episode`;
  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'rekonime-refresh-scores/1.0'
    }
  });
  const html = await response.text();
  return parseEpisodeScores(html);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.dataPath)) {
    throw new Error(`Data file not found: ${options.dataPath}`);
  }

  const root = JSON.parse(fs.readFileSync(options.dataPath, 'utf8'));
  const animeList = Array.isArray(root?.anime) ? root.anime : [];

  const entries = animeList.map((anime, index) => ({ anime, index }));
  const filteredEntries = options.malIds
    ? entries.filter(({ anime }) => options.malIds.has(Number(getMalId(anime))))
    : entries;

  const startIndex = Math.min(options.startIndex, filteredEntries.length);
  const maxItems = options.limit === null
    ? filteredEntries.length - startIndex
    : Math.min(options.limit, filteredEntries.length - startIndex);
  const endIndex = startIndex + maxItems;
  const target = filteredEntries.slice(startIndex, endIndex);

  const stats = {
    processed: 0,
    updatedEpisodes: 0,
    unchangedEpisodes: 0,
    updatedCommunityScore: 0,
    unchangedCommunityScore: 0,
    episodeErrors: 0,
    scoreErrors: 0
  };

  console.log(`Updating scores for ${target.length} anime (index ${startIndex}..${Math.max(startIndex, endIndex - 1)})`);
  if (options.malIds) {
    console.log(`Mode: filtered MAL IDs (${options.malIds.size})`);
  }
  console.log(`Data path: ${path.relative(process.cwd(), options.dataPath)}`);
  console.log(`MAL delay: ${options.malDelayMs}ms | Jikan delay: ${options.jikanDelayMs}ms | Save interval: ${options.saveInterval}`);

  for (let i = 0; i < target.length; i += 1) {
    const absoluteIndex = startIndex + i;
    const { anime } = target[i];
    const malId = Number(getMalId(anime));
    const title = anime?.metadata?.title || anime?.title || `index-${absoluteIndex}`;
    const slug = getSlug(anime);

    stats.processed += 1;

    if (!Number.isFinite(malId)) {
      stats.episodeErrors += 1;
      stats.scoreErrors += 1;
      continue;
    }

    let nextCommunityScore = null;
    try {
      nextCommunityScore = await fetchCommunityScore(malId);
      if (!anime.metadata || typeof anime.metadata !== 'object') anime.metadata = {};
      const previous = Number(anime.metadata.score);
      if (Number.isFinite(nextCommunityScore) && previous !== nextCommunityScore) {
        anime.metadata.score = nextCommunityScore;
        stats.updatedCommunityScore += 1;
      } else {
        stats.unchangedCommunityScore += 1;
      }
    } catch (error) {
      stats.scoreErrors += 1;
      console.error(`[${absoluteIndex + 1}/${target.length}] Score fetch failed for "${title}" (MAL ${malId}): ${error.message}`);
    }

    if (options.jikanDelayMs > 0) {
      await sleep(options.jikanDelayMs);
    }

    try {
      const episodes = await fetchEpisodeScores(malId, slug);
      if (episodes.length > 0) {
        const hasChanges = episodesChanged(anime.episodes, episodes);
        if (hasChanges) {
          anime.episodes = episodes;
          stats.updatedEpisodes += 1;
        } else {
          stats.unchangedEpisodes += 1;
        }
      } else {
        stats.unchangedEpisodes += 1;
      }
    } catch (error) {
      stats.episodeErrors += 1;
      console.error(`[${absoluteIndex + 1}/${target.length}] Episode fetch failed for "${title}" (MAL ${malId}): ${error.message}`);
    }

    if (options.malDelayMs > 0) {
      await sleep(options.malDelayMs);
    }

    if (stats.processed % options.saveInterval === 0) {
      fs.writeFileSync(options.dataPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
      console.log(`Saved progress: ${stats.processed}/${target.length}`);
    } else if (stats.processed % 10 === 0) {
      console.log(`Progress: ${stats.processed}/${target.length}`);
    }
  }

  fs.writeFileSync(options.dataPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');

  console.log('\nRefresh complete.');
  console.log(`Processed: ${stats.processed}`);
  console.log(`Community score updated: ${stats.updatedCommunityScore}`);
  console.log(`Community score unchanged: ${stats.unchangedCommunityScore}`);
  console.log(`Community score errors: ${stats.scoreErrors}`);
  console.log(`Episodes updated: ${stats.updatedEpisodes}`);
  console.log(`Episodes unchanged/no-new-data: ${stats.unchangedEpisodes}`);
  console.log(`Episode errors: ${stats.episodeErrors}`);
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
