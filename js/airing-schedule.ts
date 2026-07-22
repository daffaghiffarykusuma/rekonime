// @ts-nocheck
import { CacheManager } from './services/cache-manager.ts';
import { Logger } from './services/logger.ts';
import { sanitizeImageUrl as sanitizeSafeImageUrl } from './urlSanitizer.ts';

export const AIRING_REFRESH_INTERVAL_MS = 60 * 1000;
export const PLACEHOLDER_COVER = 'https://via.placeholder.com/120x170?text=No+Image';

const AIRING_CACHE_PREFIX = 'rekonime.airing-schedule.v1';
const AIRING_CACHE_TTL_MS = 90 * 60 * 1000;
const AIRING_BATCH_SIZE = 25;
const AIRING_SOURCE_URL = 'https://graphql.anilist.co';
const ALLOWED_IMAGE_HOSTS = [
  'cdn.myanimelist.net',
  'myanimelist.cdn-dena.com',
  'via.placeholder.com',
  'images.weserv.nl'
];
const WATCH_STATUS_LABELS = {
  planned: 'Want to watch',
  watching: 'Watching now',
  completed: 'Finished',
  dropped: 'Stopped'
};
const GRAPHQL_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        id
        idMal
        status
        episodes
        nextAiringEpisode {
          episode
          airingAt
          timeUntilAiring
        }
      }
    }
  }
`;

const sanitizeCoverUrl = (value) => {
  const sanitized = sanitizeSafeImageUrl(value, {
    allowRelative: false,
    allowedHosts: ALLOWED_IMAGE_HOSTS
  });
  return sanitized || PLACEHOLDER_COVER;
};

const getScheduleCacheKey = (malId) => `${AIRING_CACHE_PREFIX}:${malId}`;

const normalizeInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const normalizeWatchStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return WATCH_STATUS_LABELS[normalized] ? normalized : 'planned';
};

const normalizeAnimeRecord = (anime, fallbackId = '') => {
  if (!anime || typeof anime !== 'object') return null;
  const id = String(anime.id || fallbackId || '').trim();
  if (!id) return null;
  return {
    id,
    title: String(anime.title || 'Unknown title').trim() || 'Unknown title',
    cover: sanitizeCoverUrl(anime.cover),
    studio: String(anime.studio || '').trim(),
    year: anime.year || null,
    malId: normalizeInteger(anime.malId),
    anilistId: normalizeInteger(anime.anilistId),
    episodeCount: getEpisodeCount(anime)
  };
};

function getEpisodeCount(anime) {
  const direct = normalizeInteger(anime?.episodeCount ?? anime?.episodesTotal ?? anime?.episodes);
  if (direct) return direct;
  if (!Array.isArray(anime?.episodes) || anime.episodes.length === 0) return null;
  const maxEpisode = anime.episodes.reduce((highest, entry, index) => {
    const candidate = normalizeInteger(entry?.episode);
    if (candidate) return Math.max(highest, candidate);
    return Math.max(highest, index + 1);
  }, 0);
  return maxEpisode > 0 ? maxEpisode : null;
}

const readCachedSchedule = (malId) => {
  if (!malId) return null;
  const cached = CacheManager.getJSON(getScheduleCacheKey(malId), { fallback: null, validate: false });
  if (!cached || typeof cached !== 'object') return null;
  return cached;
};

const writeCachedSchedule = (malId, schedule) => {
  if (!malId) return;
  CacheManager.setJSON(getScheduleCacheKey(malId), {
    fetchedAt: Date.now(),
    data: schedule
  }, { validate: false });
};

const normalizeScheduleResponse = (node, fallbackMalId = null) => {
  const malId = normalizeInteger(node?.idMal) || normalizeInteger(fallbackMalId);
  if (!malId) return null;
  const nextEpisode = normalizeInteger(node?.nextAiringEpisode?.episode);
  const airingAt = normalizeInteger(node?.nextAiringEpisode?.airingAt);
  return {
    malId,
    status: String(node?.status || '').trim().toUpperCase() || 'UNKNOWN',
    episodeCount: normalizeInteger(node?.episodes),
    nextAiringEpisode: nextEpisode && airingAt
      ? {
          episode: nextEpisode,
          airingAt,
          timeUntilAiring: Number.isFinite(Number(node?.nextAiringEpisode?.timeUntilAiring))
            ? Number(node.nextAiringEpisode.timeUntilAiring)
            : null
        }
      : null
  };
};

const chunk = (items, size) => {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

const fetchScheduleBatch = async (malIds) => {
  if (!Array.isArray(malIds) || malIds.length === 0) return new Map();
  const response = await fetch(AIRING_SOURCE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { ids: malIds }
    })
  });
  if (!response.ok) throw new Error(`AniList schedule request failed: ${response.status}`);
  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const error = new Error('AniList schedule query failed');
    error.details = payload.errors;
    throw error;
  }

  const map = new Map();
  const media = Array.isArray(payload?.data?.Page?.media) ? payload.data.Page.media : [];
  media.forEach((node) => {
    const normalized = normalizeScheduleResponse(node);
    if (!normalized) return;
    map.set(normalized.malId, normalized);
  });

  malIds.forEach((malId) => {
    if (!map.has(malId)) {
      map.set(malId, normalizeScheduleResponse(null, malId));
    }
  });

  return map;
};

export const fetchAiringSchedules = async (animeItems) => {
  const uniqueMalIds = [...new Set(
    (Array.isArray(animeItems) ? animeItems : [])
      .map(item => normalizeInteger(item?.malId))
      .filter(Boolean)
  )];
  const scheduleMap = new Map();
  const staleIds = [];
  const now = Date.now();

  uniqueMalIds.forEach((malId) => {
    const cached = readCachedSchedule(malId);
    if (!cached?.data) {
      staleIds.push(malId);
      return;
    }
    const age = now - Number(cached.fetchedAt || 0);
    if (age <= AIRING_CACHE_TTL_MS) {
      scheduleMap.set(malId, cached.data);
      return;
    }
    scheduleMap.set(malId, cached.data);
    staleIds.push(malId);
  });

  if (staleIds.length === 0) {
    return scheduleMap;
  }

  const batches = chunk(staleIds, AIRING_BATCH_SIZE);
  for (const batch of batches) {
    try {
      const fetched = await fetchScheduleBatch(batch);
      fetched.forEach((schedule, malId) => {
        scheduleMap.set(malId, schedule);
        writeCachedSchedule(malId, schedule);
      });
    } catch (error) {
      Logger?.warn?.('Failed to refresh airing schedule batch', {
        error,
        malIds: batch
      });
    }
  }

  return scheduleMap;
};

const formatEpisodeLabel = (episode, totalEpisodes) => {
  if (!episode) return 'Episode schedule pending';
  if (totalEpisodes) {
    return `Episode ${episode} of ${totalEpisodes}`;
  }
  return `Episode ${episode}`;
};

export const formatCountdownLabel = (targetMs, nowMs = Date.now()) => {
  const delta = Math.max(0, Number(targetMs || 0) - Number(nowMs || 0));
  const totalMinutes = Math.ceil(delta / 60000);

  if (totalMinutes <= 1) return 'in under a minute';
  if (totalMinutes < 60) return `in ${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes ? `in ${totalHours}h ${minutes}m` : `in ${totalHours}h`;
  }

  const totalDays = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (totalDays < 7) {
    return hours ? `in ${totalDays}d ${hours}h` : `in ${totalDays}d`;
  }

  return `in ${totalDays} days`;
};

export const formatLocalDateTimeLabel = (targetMs, { locale, timeZone } = {}) => {
  const date = new Date(targetMs);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  }).format(date);
};

const isSameCalendarDay = (leftMs, rightMs, { timeZone } = {}) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone ? { timeZone } : {})
  });
  return formatter.format(new Date(leftMs)) === formatter.format(new Date(rightMs));
};

const buildStatusBadge = ({ behindCount, airsToday }) => {
  if (behindCount > 0) {
    return {
      tone: 'ready',
      label: behindCount === 1 ? '1 ready now' : `${behindCount} ready now`
    };
  }
  if (airsToday) {
    return {
      tone: 'today',
      label: 'Later today'
    };
  }
  return {
    tone: 'next',
    label: 'Next drop'
  };
};

const compareDashboardItems = (left, right) => {
  const leftPriority = left.behindCount > 0 ? 0 : 1;
  const rightPriority = right.behindCount > 0 ? 0 : 1;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return left.airingAtMs - right.airingAtMs;
};

export const buildAiringDashboardModel = ({
  entries,
  animeItems,
  scheduleMap,
  nowMs = Date.now(),
  locale,
  timeZone
} = {}) => {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const animeIndex = new Map();

  (Array.isArray(animeItems) ? animeItems : []).forEach((anime) => {
    const normalized = normalizeAnimeRecord(anime);
    if (!normalized) return;
    animeIndex.set(normalized.id, normalized);
  });

  normalizedEntries.forEach((entry) => {
    const normalized = normalizeAnimeRecord(entry?.snapshot, entry?.id);
    if (!normalized || animeIndex.has(normalized.id)) return;
    animeIndex.set(normalized.id, normalized);
  });

  const eligibleEntries = normalizedEntries.filter((entry) => {
    const status = normalizeWatchStatus(entry?.status);
    return status === 'planned' || status === 'watching';
  });

  const items = eligibleEntries.map((entry) => {
    const anime = animeIndex.get(String(entry?.id || '').trim());
    const schedule = scheduleMap instanceof Map ? scheduleMap.get(normalizeInteger(anime?.malId)) : null;
    if (!anime || !schedule || schedule.status !== 'RELEASING' || !schedule.nextAiringEpisode) {
      return null;
    }

    const airingAtMs = schedule.nextAiringEpisode.airingAt * 1000;
    const nextEpisode = schedule.nextAiringEpisode.episode;
    const totalEpisodes = schedule.episodeCount || anime.episodeCount || null;
    const releasedEpisodes = Math.max(nextEpisode - 1, 0);
    const progress = Math.max(0, Number(entry?.progress) || 0);
    const behindCount = Math.max(0, releasedEpisodes - progress);
    const airsToday = isSameCalendarDay(airingAtMs, nowMs, { timeZone });
    const badge = buildStatusBadge({ behindCount, airsToday });
    const watchStatus = normalizeWatchStatus(entry?.status);

    return {
      id: anime.id,
      title: anime.title,
      cover: anime.cover,
      studio: anime.studio,
      year: anime.year,
      watchStatus,
      watchStatusLabel: WATCH_STATUS_LABELS[watchStatus] || WATCH_STATUS_LABELS.planned,
      progress,
      behindCount,
      nextEpisode,
      totalEpisodes,
      releasedEpisodes,
      airingAtMs,
      airsToday,
      badge,
      countdownLabel: formatCountdownLabel(airingAtMs, nowMs),
      airDateLabel: formatLocalDateTimeLabel(airingAtMs, { locale, timeZone }),
      episodeLabel: formatEpisodeLabel(nextEpisode, totalEpisodes),
      readinessLabel: behindCount > 0
        ? `${behindCount} released${behindCount === 1 ? ' episode' : ' episodes'} waiting`
        : (releasedEpisodes > 0
          ? `Caught up through episode ${releasedEpisodes}`
          : 'Premiere has not aired yet')
    };
  }).filter(Boolean).sort(compareDashboardItems);

  const availableNowCount = items.filter(item => item.behindCount > 0).length;
  const airingTodayCount = items.filter(item => item.airsToday).length;
  const nextUpItem = items[0] || null;

  return {
    eligibleEntries: eligibleEntries.length,
    items,
    counts: {
      availableNow: availableNowCount,
      airingToday: airingTodayCount,
      tracking: items.length
    },
    nextUpLabel: nextUpItem ? nextUpItem.countdownLabel : 'No upcoming releases',
    subtitle: items.length > 0
      ? 'See what is ready now and when the next episode lands. Times shown in your local time.'
      : 'Times automatically match your browser time zone whenever an airing title is available.'
  };
};

export const createAiringScheduleRuntime = ({
  onModel = () => {},
  now = () => Date.now(),
  setIntervalFn = globalThis.setInterval?.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval?.bind(globalThis),
  refreshIntervalMs = AIRING_REFRESH_INTERVAL_MS,
  fetchSchedules = fetchAiringSchedules
} = {}) => {
  let currentInput = null;
  let currentScheduleMap = new Map();
  let refreshHandle = 0;

  const stopTicker = () => {
    if (!refreshHandle || typeof clearIntervalFn !== 'function') return;
    clearIntervalFn(refreshHandle);
    refreshHandle = 0;
  };

  const emitModel = () => {
    if (!currentInput) return null;
    const model = buildAiringDashboardModel({
      ...currentInput,
      scheduleMap: currentScheduleMap,
      nowMs: now()
    });
    onModel(model);
    return model;
  };

  const startTicker = (model) => {
    stopTicker();
    if (!model?.items?.length || typeof setIntervalFn !== 'function') return;
    refreshHandle = setIntervalFn(() => {
      emitModel();
    }, refreshIntervalMs);
  };

  return {
    async update({ entries, animeItems, locale, timeZone } = {}) {
      currentInput = {
        entries: Array.isArray(entries) ? entries : [],
        animeItems: Array.isArray(animeItems) ? animeItems : [],
        locale,
        timeZone
      };
      currentScheduleMap = await fetchSchedules(currentInput.animeItems);
      const model = emitModel();
      startTicker(model);
      return model;
    },

    destroy() {
      stopTicker();
      currentInput = null;
      currentScheduleMap = new Map();
    }
  };
};
