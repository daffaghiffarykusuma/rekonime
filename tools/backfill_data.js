import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTrustedMalEpisodePageUrl } from './lib/mal-pagination-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '..', 'data', 'anime.json');
const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const ANILIST_DELAY_MS = 900; // ~66 req/min
const MAL_DELAY_MS = 2000; // respectful scrape delay
const SAVE_INTERVAL = 50; // save after every N updates
const MAX_RETRIES = 4;

const args = process.argv.slice(2);
const RUN_ANILIST = !args.includes('--episodes-only');
const RUN_EPISODES = !args.includes('--anilist-only');
const SKIP_KNOWN_MISSING = args.includes('--skip-known-missing');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createSlug(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getMalId(anime) {
  return anime?.mal_id ?? anime?.metadata?.malId ?? anime?.malId ?? anime?.metadata?.mal_id;
}

function getTitle(anime) {
  return anime?.metadata?.title || anime?.title || '';
}

function getSlug(anime) {
  return anime?.metadata?.id || anime?.id || createSlug(getTitle(anime));
}

function isTv(anime) {
  const type = anime?.metadata?.type;
  if (!type) return true;
  return String(type).toLowerCase() === 'tv';
}

function ensureScrapeError(anime, message) {
  if (!anime.scrape_errors) anime.scrape_errors = [];
  if (!anime.scrape_errors.includes(message)) anime.scrape_errors.push(message);
}

async function fetchWithRetry(url, options = {}) {
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (![429, 500, 502, 503, 504].includes(res.status)) {
        throw new Error(`HTTP ${res.status}`);
      }
      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : 1000 * (attempt + 1);
      await sleep(waitMs);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(1000 * (attempt + 1));
    }
    attempt += 1;
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function fetchAniList(malId) {
  const query = `
    query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        id
        trailer { id site thumbnail }
      }
    }
  `;

  const res = await fetchWithRetry(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'rekonime-backfill/1.0'
    },
    body: JSON.stringify({ query, variables: { idMal: Number(malId) } })
  });

  const payload = await res.json();
  if (payload.errors) return null;
  return payload?.data?.Media || null;
}

function buildTrailerFromAniList(trailer) {
  if (!trailer || trailer.site?.toLowerCase() !== 'youtube' || !trailer.id) return null;
  const id = trailer.id;
  return {
    site: 'youtube',
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnail: trailer.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    source: 'anilist'
  };
}

function parseEpisodeScores(html) {
  const rows = html.match(/<tr class="episode-list-data"[\s\S]*?<\/tr>/g) || [];
  const episodes = [];

  for (const row of rows) {
    let epMatch = row.match(/episode-number[^>]*data-raw="(\d+)"/);
    if (!epMatch) {
      epMatch = row.match(/episode-number[^>]*>\s*(\d+)\s*</);
    }
    const epNum = epMatch ? Number(epMatch[1]) : null;
    if (!epNum || !Number.isFinite(epNum)) continue;

    const scoreMatch = row.match(/episode-poll[^>]*data-raw="([0-9]+(?:\.[0-9]+)?)"/);
    if (!scoreMatch) continue;
    const score = Number(scoreMatch[1]);
    if (!Number.isFinite(score)) continue;

    episodes.push({ episode: epNum, score });
  }

  return episodes.sort((a, b) => a.episode - b.episode);
}

function extractNextEpisodePageUrl(html, currentUrl) {
  const nextHref = html.match(/<link rel="next" href="([^"]+)"/i)?.[1];
  const parsed = nextHref ? parseTrustedMalEpisodePageUrl(nextHref, currentUrl) : null;
  return parsed ? parsed.toString() : null;
}

function extractCanonicalEpisodePageUrl(html, currentUrl) {
  const canonicalHref = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  const parsed = canonicalHref ? parseTrustedMalEpisodePageUrl(canonicalHref, currentUrl) : null;
  if (!parsed) return null;
  parsed.search = '';
  return parsed.toString();
}

function buildFallbackEpisodePageUrl(currentUrl, html, pageEpisodeCount) {
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
}

function mergeEpisodePages(pages) {
  const episodesByNumber = new Map();

  for (const episode of pages.flat()) {
    const episodeNumber = Number(episode?.episode);
    const score = Number(episode?.score);
    if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) continue;
    if (!Number.isFinite(score) || score < 1 || score > 5) continue;
    episodesByNumber.set(episodeNumber, { episode: episodeNumber, score });
  }

  return [...episodesByNumber.values()].sort((a, b) => a.episode - b.episode);
}

function syncEpisodeCountMetadata(anime, episodes) {
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
}

async function fetchEpisodeScores(malId, slug) {
  const pageEpisodes = [];
  const visitedUrls = new Set();
  let nextUrl = `https://myanimelist.net/anime/${malId}/${slug}/episode`;

  while (nextUrl && !visitedUrls.has(nextUrl)) {
    visitedUrls.add(nextUrl);
    const res = await fetchWithRetry(nextUrl, {
      headers: {
        'User-Agent': 'rekonime-backfill/1.0'
      }
    });
    const html = await res.text();
    const episodes = parseEpisodeScores(html);
    pageEpisodes.push(episodes);
    nextUrl = extractNextEpisodePageUrl(html, nextUrl) || buildFallbackEpisodePageUrl(nextUrl, html, episodes.length);
    if (nextUrl && !visitedUrls.has(nextUrl)) {
      await sleep(MAL_DELAY_MS);
    }
  }

  return mergeEpisodePages(pageEpisodes);
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const animeList = data.anime || [];

  const missingAniList = animeList.filter((anime) => {
    if (!isTv(anime)) return false;
    const meta = anime.metadata || {};
    return !meta.anilistId || !meta.trailer;
  });

  const missingEpisodes = animeList.filter((anime) => {
    if (!isTv(anime)) return false;
    const needsEpisodes = !anime.episodes || anime.episodes.length === 0;
    if (!needsEpisodes) return false;
    if (!SKIP_KNOWN_MISSING) return true;
    return !(Array.isArray(anime.scrape_errors) && anime.scrape_errors.includes('No episode scores found'));
  });

  console.log(`Missing AniList/trailer: ${missingAniList.length}`);
  console.log(`Missing episode scores: ${missingEpisodes.length}`);

  let updated = 0;
  let anilistUpdated = 0;
  let episodeUpdated = 0;

  if (RUN_ANILIST) {
    console.log('\nBackfilling AniList IDs + trailers...');
    let counter = 0;

    for (const anime of missingAniList) {
      const malId = getMalId(anime);
      if (!malId) continue;

      counter += 1;
      const title = getTitle(anime);

      try {
        const media = await fetchAniList(malId);
        if (media) {
          if (!anime.metadata) anime.metadata = {};
          if (!anime.metadata.anilistId && media.id) {
            anime.metadata.anilistId = media.id;
            anilistUpdated += 1;
          }

          if (!anime.metadata.trailer) {
            const trailer = buildTrailerFromAniList(media.trailer);
            if (trailer) {
              anime.metadata.trailer = trailer;
              anilistUpdated += 1;
            }
          }
        }
      } catch (err) {
        console.error(`AniList error for ${title} (MAL ${malId}): ${err.message}`);
      }

      if (counter % SAVE_INTERVAL === 0) {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
        console.log(`  Saved progress at ${counter}/${missingAniList.length}`);
      }

      await sleep(ANILIST_DELAY_MS);
    }

    console.log(`AniList updates applied: ${anilistUpdated}`);
  }

  if (RUN_EPISODES) {
    console.log('\nBackfilling episode scores...');
    let counter = 0;
    for (const anime of missingEpisodes) {
      const malId = getMalId(anime);
      if (!malId) continue;

      counter += 1;
      const title = getTitle(anime);
      const slug = getSlug(anime);

      try {
        const episodes = await fetchEpisodeScores(malId, slug);
        if (episodes.length > 0) {
          syncEpisodeCountMetadata(anime, episodes);
          anime.episodes = episodes;
          // Clear scrape error if previously marked as missing
          if (Array.isArray(anime.scrape_errors)) {
            anime.scrape_errors = anime.scrape_errors.filter((err) => err !== 'No episode scores found');
          }
          episodeUpdated += 1;
        } else {
          ensureScrapeError(anime, 'No episode scores found');
        }
      } catch (err) {
        console.error(`Episode scrape error for ${title} (MAL ${malId}): ${err.message}`);
        ensureScrapeError(anime, 'No episode scores found');
      }

      if (counter % SAVE_INTERVAL === 0) {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
        console.log(`  Saved progress at ${counter}/${missingEpisodes.length}`);
      }

      await sleep(MAL_DELAY_MS);
    }
  }

  updated = anilistUpdated + episodeUpdated;

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log('\nDone.');
  console.log(`AniList updates: ${anilistUpdated}`);
  console.log(`Episode updates: ${episodeUpdated}`);
})();

