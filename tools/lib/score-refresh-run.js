import { createScoreRefreshRequest, DEFAULT_MAL_DELAY_MS, DEFAULT_JIKAN_DELAY_MS, ScoreRefreshStoppedError } from './score-refresh-request.js';
import { fetchCommunityScore } from './mal-community-score.js';
import { parseTrustedMalEpisodePageUrl } from './mal-pagination-url.js';

export const SCORE_REFRESH_DEFAULTS = Object.freeze({
  limit: null, startIndex: 0, saveInterval: 25, concurrency: 1,
  malDelayMs: DEFAULT_MAL_DELAY_MS, jikanDelayMs: DEFAULT_JIKAN_DELAY_MS,
  malIds: null, scoreSource: 'mal'
});

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

const fetchEpisodeScores = async (malId, slug, request) => {
  const visitedUrls = new Set();
  const pageEpisodes = [];
  let nextUrl = `https://myanimelist.net/anime/${malId}/${slug}/episode`;

  while (nextUrl && !visitedUrls.has(nextUrl)) {
    visitedUrls.add(nextUrl);

    const response = await request(nextUrl, {
      headers: { 'User-Agent': 'rekonime-refresh-scores/1.0' }
    });
    const html = await response.text();
    const episodes = parseEpisodeScores(html);
    pageEpisodes.push(episodes);
    nextUrl = extractNextEpisodePageUrl(html, nextUrl) || buildFallbackEpisodePageUrl(nextUrl, html, episodes.length);
  }

  return mergeEpisodePages(pageEpisodes);
};

/**
 * Owns one catalog refresh. `root` is mutated in place; `save(root)` must persist
 * synchronously and throw on failure. `request(url, init)` must honor HTTP errors
 * (the default request module supplies pacing, retries, and provider protection).
 *
 * `run()` starts once and resolves to status, reason, stats, failedMalIds, and the
 * earliest unsuccessful/unfinished filtered resumeIndex. `stop()` checkpoints
 * immediately, aborts requests, and freezes catalog changes; pending adapters may
 * still need to settle before the run promise resolves. Events describe progress.
 */
export const createScoreRefreshRun = ({ root, options: suppliedOptions = {}, request: suppliedRequest,
  save, onEvent = () => {} }) => {
  const options = { ...SCORE_REFRESH_DEFAULTS, ...suppliedOptions };
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

  let stoppedReason;
  let halted = false;
  let finalResult;
  let execution;
  const completed = new Set();
  const failedMalIds = new Set();
  const controller = new AbortController();
  const providerRequest = suppliedRequest || createScoreRefreshRequest({
    ...options,
    onCooldown: event => onEvent({ type: 'cooldown', ...event }),
    onProviderUnavailable: event => onEvent({ type: 'provider-unavailable', ...event })
  });
  const request = (url, init = {}) => {
    controller.signal.throwIfAborted();
    return providerRequest(url, { ...init, signal: controller.signal });
  };
  const outcome = (status) => {
    let resumeIndex = startIndex;
    while (completed.has(resumeIndex)) resumeIndex += 1;
    return { status, reason: stoppedReason, resumeIndex, stats: { ...stats }, failedMalIds: [...failedMalIds] };
  };
  const checkpoint = () => {
    try { save(root); }
    catch (error) {
      // Freeze before another resolved worker can resume its microtask.
      halted = true;
      controller.abort();
      throw error;
    }
  };

  const stop = () => {
    if (finalResult) return finalResult;
    halted = true;
    controller.abort();
    checkpoint();
    finalResult = outcome('interrupted');
    return finalResult;
  };

  const processEntry = async ({ anime }, absoluteIndex) => {
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
      fetchCommunityScore(malId, request, options.scoreSource),
      fetchEpisodeScores(malId, slug, request)
    ]);

    if (halted) return;

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
      onEvent({ type: 'fetch-failed', kind: 'score', index: absoluteIndex, total: target.length, title, malId, reason: communityResult.reason?.message || String(communityResult.reason) });
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
      onEvent({ type: 'fetch-failed', kind: 'episode', index: absoluteIndex, total: target.length, title, malId, reason: episodesResult.reason?.message || String(episodesResult.reason) });
    }

    stats.processed += 1;

    const rejected = [communityResult, episodesResult].filter((result) => result.status === 'rejected');
    if (rejected.length > 0) failedMalIds.add(malId);
    else completed.add(absoluteIndex);
    const protectionFailure = rejected.find((result) => result.reason instanceof ScoreRefreshStoppedError);
    if (protectionFailure) stoppedReason ??= protectionFailure.reason.message;

    if (stats.processed % options.saveInterval === 0) {
      checkpoint();
      onEvent({ type: 'saved', processed: stats.processed, total: target.length });
    } else if (stats.processed % 10 === 0) {
      onEvent({ type: 'progress', processed: stats.processed, total: target.length });
    }
  };

  const execute = async () => {
    if (finalResult) return finalResult;
    onEvent({ type: 'started', total: target.length, startIndex, endIndex });
    let cursor = 0;
    const worker = async () => {
      while (!halted && !stoppedReason && cursor < target.length) {
        const currentIndex = cursor++;
        await processEntry(target[currentIndex], startIndex + currentIndex);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(options.concurrency, target.length || 1) }, worker));
      if (!finalResult) {
        checkpoint();
        finalResult = outcome(stoppedReason ? 'stopped' : 'completed');
      }
      return finalResult;
    } catch (error) {
      // A failed checkpoint must not leave other workers mutating the catalog.
      halted = true;
      controller.abort();
      throw error;
    }
  };

  return { run: () => execution ??= execute(), stop };
};
