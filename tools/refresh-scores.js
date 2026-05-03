import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTrustedMalEpisodePageUrl } from './lib/mal-pagination-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'anime.json');
const DEFAULT_SAVE_INTERVAL = 25;
const DEFAULT_MAL_DELAY_MS = 1200;
const DEFAULT_JIKAN_DELAY_MS = 400;
const DEFAULT_CONCURRENCY = 4;
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
    concurrency: DEFAULT_CONCURRENCY,
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
    } else if (key === 'concurrency' && value) {
      options.concurrency = Math.max(1, parseNumberArg(value, DEFAULT_CONCURRENCY));
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

const extractNextEpisodePageUrl = (html, currentUrl) => {
  const nextHref = html.match(/<link rel="next" href="([^"]+)"/i)?.[1];
  const parsed = nextHref ? parseTrustedMalEpisodePageUrl(nextHref, currentUrl) : null;
  return parsed ? parsed.toString() : null;
};

const extractCanonicalEpisodePageUrl = (html, currentUrl) => {
  const canonicalHref = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  const parsed = canonicalHref ? parseTrustedMalEpisodePageUrl(canonicalHref, currentUrl) : null;
  if (!parsed) return null;
  parsed.search = '';
  return parsed.toString();
};

const buildFallbackEpisodePageUrl = (currentUrl, html, pageEpisodeCount) => {
  if (pageEpisodeCount < 100) return null;

  try {
    const parsedCurrent = parseTrustedMalEpisodePageUrl(currentUrl);
    if (!parsedCurrent) return null;
    const currentOffset = Number(parsedCurrent.searchParams.get('offset') || '0');
    const nextOffset = currentOffset + 100;
    const canonicalBaseUrl = extractCanonicalEpisodePageUrl(html, currentUrl) || `${parsedCurrent.origin}${parsedCurrent.pathname}`;
    const parsedNext = parseTrustedMalEpisodePageUrl(canonicalBaseUrl);
    if (!parsedNext) return null;
    parsedNext.searchParams.set('offset', String(nextOffset));
    return parsedNext.toString();
  } catch {
    return null;
  }
};

const mergeEpisodePages = (pages) => {
  const episodesByNumber = new Map();

  for (const episode of pages.flat()) {
    const episodeNumber = Number(episode?.episode);
    const score = Number(episode?.score);
    if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) continue;
    if (!Number.isFinite(score) || score < 1 || score > 5) continue;
    episodesByNumber.set(episodeNumber, { episode: episodeNumber, score });
  }

  return [...episodesByNumber.values()].sort((left, right) => left.episode - right.episode);
};

const sanitizeEpisodeList = (episodes) => {
  if (!Array.isArray(episodes)) return [];

  return episodes
    .map((episode) => ({
      episode: Number(episode?.episode),
      score: Number(episode?.score)
    }))
    .filter((episode) => (
      Number.isInteger(episode.episode) &&
      episode.episode > 0 &&
      Number.isFinite(episode.score) &&
      episode.score >= 1 &&
      episode.score <= 5
    ))
    .sort((left, right) => left.episode - right.episode);
};

class ServiceScheduler {
  constructor(intervalMs) {
    this.intervalMs = Math.max(0, Number(intervalMs) || 0);
    this.nextRunAt = 0;
    this.queue = Promise.resolve();
  }

  schedule(task) {
    const run = async () => {
      const waitMs = Math.max(0, this.nextRunAt - Date.now());
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      this.nextRunAt = Date.now() + this.intervalMs;
      return task();
    };

    const scheduled = this.queue.then(run, run);
    this.queue = scheduled.catch(() => undefined);
    return scheduled;
  }
}

const episodesChanged = (existing, incoming) => {
  const current = sanitizeEpisodeList(existing);
  if (current.length !== incoming.length) return true;
  for (let i = 0; i < incoming.length; i += 1) {
    if (current[i]?.episode !== incoming[i].episode) return true;
    if (current[i]?.score !== incoming[i].score) return true;
  }
  return false;
};

const syncEpisodeCountMetadata = (anime, episodes) => {
  if (!Array.isArray(episodes) || episodes.length === 0) return;

  const highestEpisodeNumber = Math.max(...episodes.map((episode) => Number(episode?.episode) || 0));
  if (!Number.isInteger(highestEpisodeNumber) || highestEpisodeNumber <= 0) return;

  if (!anime.metadata || typeof anime.metadata !== 'object') {
    anime.metadata = {};
  }

  const currentEpisodeCount = Number(anime.metadata.episodes_count);
  if (!Number.isFinite(currentEpisodeCount) || highestEpisodeNumber > currentEpisodeCount) {
    anime.metadata.episodes_count = highestEpisodeNumber;
  }
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

const fetchEpisodeScores = async (malId, slug, scheduler) => {
  const visitedUrls = new Set();
  const pageEpisodes = [];
  let nextUrl = `https://myanimelist.net/anime/${malId}/${slug}/episode`;

  while (nextUrl && !visitedUrls.has(nextUrl)) {
    visitedUrls.add(nextUrl);

    const response = scheduler
      ? await scheduler.schedule(() => fetchWithRetry(nextUrl, {
        headers: {
          'User-Agent': 'rekonime-refresh-scores/1.0'
        }
      }))
      : await fetchWithRetry(nextUrl, {
        headers: {
          'User-Agent': 'rekonime-refresh-scores/1.0'
        }
    });
    const html = await response.text();
    const episodes = parseEpisodeScores(html);
    pageEpisodes.push(episodes);
    nextUrl = extractNextEpisodePageUrl(html, nextUrl) || buildFallbackEpisodePageUrl(nextUrl, html, episodes.length);
  }

  return mergeEpisodePages(pageEpisodes);
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
  console.log(`MAL delay: ${options.malDelayMs}ms | Jikan delay: ${options.jikanDelayMs}ms | Save interval: ${options.saveInterval} | Concurrency: ${options.concurrency}`);

  const malScheduler = new ServiceScheduler(options.malDelayMs);
  const jikanScheduler = new ServiceScheduler(options.jikanDelayMs);

  const writeProgress = () => {
    fs.writeFileSync(options.dataPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
  };

  const processEntry = async ({ anime }, absoluteIndex, total) => {
    const malId = Number(getMalId(anime));
    const title = anime?.metadata?.title || anime?.title || `index-${absoluteIndex}`;
    const slug = getSlug(anime);

    if (!Number.isFinite(malId)) {
      stats.episodeErrors += 1;
      stats.scoreErrors += 1;
      stats.processed += 1;
      return;
    }

    const [communityResult, episodesResult] = await Promise.allSettled([
      jikanScheduler.schedule(() => fetchCommunityScore(malId)),
      fetchEpisodeScores(malId, slug, malScheduler)
    ]);

    if (communityResult.status === 'fulfilled') {
      const nextCommunityScore = communityResult.value;
      if (!anime.metadata || typeof anime.metadata !== 'object') anime.metadata = {};
      const previous = Number(anime.metadata.score);
      if (Number.isFinite(nextCommunityScore) && previous !== nextCommunityScore) {
        anime.metadata.score = nextCommunityScore;
        stats.updatedCommunityScore += 1;
      } else {
        stats.unchangedCommunityScore += 1;
      }
    } else {
      stats.scoreErrors += 1;
      console.error(`[${absoluteIndex + 1}/${total}] Score fetch failed for "${title}" (MAL ${malId}): ${communityResult.reason?.message || communityResult.reason}`);
    }

    if (episodesResult.status === 'fulfilled') {
      const episodes = sanitizeEpisodeList(episodesResult.value);
      const sanitizedExisting = sanitizeEpisodeList(anime.episodes);
      if (episodes.length > 0) {
        syncEpisodeCountMetadata(anime, episodes);
        const hasChanges = episodesChanged(sanitizedExisting, episodes);
        if (hasChanges) {
          anime.episodes = episodes;
          stats.updatedEpisodes += 1;
        } else if (!Array.isArray(anime.episodes) || anime.episodes.length !== sanitizedExisting.length) {
          anime.episodes = sanitizedExisting;
          stats.updatedEpisodes += 1;
        } else {
          stats.unchangedEpisodes += 1;
        }
      } else if (episodesChanged(anime.episodes, sanitizedExisting)) {
        anime.episodes = sanitizedExisting;
        stats.updatedEpisodes += 1;
      } else {
        stats.unchangedEpisodes += 1;
      }
    } else {
      stats.episodeErrors += 1;
      console.error(`[${absoluteIndex + 1}/${total}] Episode fetch failed for "${title}" (MAL ${malId}): ${episodesResult.reason?.message || episodesResult.reason}`);
    }

    stats.processed += 1;

    if (stats.processed % options.saveInterval === 0) {
      writeProgress();
      console.log(`Saved progress: ${stats.processed}/${total}`);
    } else if (stats.processed % 10 === 0) {
      console.log(`Progress: ${stats.processed}/${total}`);
    }
  };

  let cursor = 0;
  const workerCount = Math.min(options.concurrency, target.length || 1);

  const worker = async () => {
    while (cursor < target.length) {
      const currentIndex = cursor;
      cursor += 1;
      const absoluteIndex = startIndex + currentIndex;
      await processEntry(target[currentIndex], absoluteIndex, target.length);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  writeProgress();

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
