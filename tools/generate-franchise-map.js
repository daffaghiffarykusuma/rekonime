import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFranchiseMap, isFranchiseRelationType } from './lib/franchise-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = path.join(__dirname, '..', 'data', 'anime.full.json');
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'data', 'franchise-map.json');
const DEFAULT_CACHE = path.join(__dirname, '..', 'data', 'franchise-relations.cache.json');
const DEFAULT_DELAY_MS = 1400;
const DEFAULT_BATCH_SIZE = 50;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const parseArgs = (args) => {
  const values = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inlineValue] = arg.replace(/^--/, '').split('=');
    if (inlineValue !== undefined) {
      values[rawKey] = inlineValue;
      continue;
    }
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      values[rawKey] = next;
      index += 1;
    } else {
      values[rawKey] = 'true';
    }
  }

  return values;
};

const makeNodeKey = ({ anilistId, malId }) => {
  if (Number.isInteger(anilistId) && anilistId > 0) {
    return `anilist:${anilistId}`;
  }
  if (Number.isInteger(malId) && malId > 0) {
    return `mal:${malId}`;
  }
  return '';
};

const pickMediaTitle = (title) => ({
  userPreferred: String(title?.userPreferred || '').trim(),
  english: String(title?.english || '').trim(),
  romaji: String(title?.romaji || '').trim(),
  native: String(title?.native || '').trim()
});

const mergeNode = (existing, incoming) => {
  if (!existing) {
    return {
      ...incoming,
      isFetched: Boolean(incoming?.isFetched),
      relations: Array.isArray(incoming?.relations) ? incoming.relations : []
    };
  }

  return {
    key: existing.key || incoming.key,
    anilistId: existing.anilistId || incoming.anilistId || null,
    malId: existing.malId || incoming.malId || null,
    format: existing.format || incoming.format || null,
    seasonYear: existing.seasonYear || incoming.seasonYear || null,
    startDate: existing.startDate || incoming.startDate || null,
    title: {
      userPreferred: existing.title?.userPreferred || incoming.title?.userPreferred || '',
      english: existing.title?.english || incoming.title?.english || '',
      romaji: existing.title?.romaji || incoming.title?.romaji || '',
      native: existing.title?.native || incoming.title?.native || ''
    },
    isFetched: Boolean(existing.isFetched || incoming.isFetched),
    relations: Array.isArray(incoming?.relations) && incoming.relations.length > 0
      ? incoming.relations
      : existing.relations
  };
};

const normalizeRelatedNode = (node) => ({
  key: makeNodeKey({ anilistId: node?.id, malId: node?.idMal }),
  anilistId: Number.isInteger(node?.id) ? node.id : null,
  malId: Number.isInteger(node?.idMal) ? node.idMal : null,
  format: String(node?.format || '').trim() || null,
  seasonYear: Number.isInteger(node?.seasonYear) ? node.seasonYear : null,
  startDate: node?.startDate && typeof node.startDate === 'object'
    ? {
        year: Number.isInteger(node.startDate.year) ? node.startDate.year : null,
        month: Number.isInteger(node.startDate.month) ? node.startDate.month : null,
        day: Number.isInteger(node.startDate.day) ? node.startDate.day : null
      }
    : null,
  title: pickMediaTitle(node?.title || {}),
  isFetched: false,
  relations: []
});

const normalizeMedia = (media) => {
  const relations = [];

  for (const edge of media?.relations?.edges || []) {
    if (edge?.node?.type !== 'ANIME') continue;
    if (!isFranchiseRelationType(edge?.relationType)) continue;

    const relatedNode = normalizeRelatedNode(edge.node);
    if (!relatedNode.key) continue;

    relations.push({
      relationType: edge.relationType,
      toKey: relatedNode.key
    });
  }

  return {
    key: makeNodeKey({ anilistId: media?.id, malId: media?.idMal }),
    anilistId: Number.isInteger(media?.id) ? media.id : null,
    malId: Number.isInteger(media?.idMal) ? media.idMal : null,
    format: String(media?.format || '').trim() || null,
    seasonYear: Number.isInteger(media?.seasonYear) ? media.seasonYear : null,
    startDate: media?.startDate && typeof media.startDate === 'object'
      ? {
          year: Number.isInteger(media.startDate.year) ? media.startDate.year : null,
          month: Number.isInteger(media.startDate.month) ? media.startDate.month : null,
          day: Number.isInteger(media.startDate.day) ? media.startDate.day : null
        }
      : null,
    title: pickMediaTitle(media?.title || {}),
    isFetched: true,
    relations
  };
};

const resolveRetryDelay = (response, fallbackMs) => {
  const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
  if (Number.isInteger(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }

  const resetHeader = Number.parseInt(response.headers.get('x-ratelimit-reset') || '', 10);
  if (Number.isInteger(resetHeader) && resetHeader > 0) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (resetHeader > nowSeconds) {
      return (resetHeader - nowSeconds + 1) * 1000;
    }
  }

  return fallbackMs;
};

const postGraphQL = async ({ query, variables, delayMs, label }) => {
  while (true) {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 429) {
      const retryDelay = resolveRetryDelay(response, Math.max(delayMs * 4, 10000));
      console.warn(`AniList rate limit hit for ${label}. Retrying in ${Math.ceil(retryDelay / 1000)}s.`);
      await wait(retryDelay);
      continue;
    }

    if (response.status === 404) {
      await wait(delayMs);
      return null;
    }

    if (!response.ok) {
      throw new Error(`AniList request failed for ${label} with HTTP ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      throw new Error(`AniList returned GraphQL errors for ${label}: ${payload.errors.map(error => error.message).join('; ')}`);
    }

    await wait(delayMs);
    return payload?.data || null;
  }
};

const ANILIST_BATCH_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        idMal
        format
        seasonYear
        startDate {
          year
          month
          day
        }
        title {
          userPreferred
          english
          romaji
          native
        }
        relations {
          edges {
            relationType
            node {
              id
              idMal
              type
              format
              seasonYear
              startDate {
                year
                month
                day
              }
              title {
                userPreferred
                english
                romaji
                native
              }
            }
          }
        }
      }
    }
  }
`;

const MAL_SINGLE_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      id
      idMal
      format
      seasonYear
      startDate {
        year
        month
        day
      }
      title {
        userPreferred
        english
        romaji
        native
      }
      relations {
        edges {
          relationType
          node {
            id
            idMal
            type
            format
            seasonYear
            startDate {
              year
              month
              day
            }
            title {
              userPreferred
              english
              romaji
              native
            }
          }
        }
      }
    }
  }
`;

const writeCache = (cachePath, nodes) => {
  if (!cachePath) return;
  fs.writeFileSync(cachePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    nodes
  }));
};

const readCache = (cachePath) => {
  if (!cachePath || !fs.existsSync(cachePath)) return [];
  const payload = readJson(cachePath);
  return Array.isArray(payload?.nodes) ? payload.nodes : [];
};

const fetchAllRelationNodes = async ({ catalogAnime, delayMs, batchSize, cachePath }) => {
  const nodes = new Map();
  const pendingAniListIds = [];
  const pendingMalIds = [];
  const queuedAniListIds = new Set();
  const queuedMalIds = new Set();
  const fetchedKeys = new Set();

  const enqueueNode = (nodeLike) => {
    const key = makeNodeKey(nodeLike);
    if (!key || fetchedKeys.has(key)) return;

    if (Number.isInteger(nodeLike?.anilistId) && !queuedAniListIds.has(nodeLike.anilistId)) {
      queuedAniListIds.add(nodeLike.anilistId);
      pendingAniListIds.push(nodeLike.anilistId);
      return;
    }

    if (Number.isInteger(nodeLike?.malId) && !queuedMalIds.has(nodeLike.malId)) {
      queuedMalIds.add(nodeLike.malId);
      pendingMalIds.push(nodeLike.malId);
    }
  };

  const upsertRawNode = (rawNode) => {
    if (!rawNode?.key) return;
    nodes.set(rawNode.key, mergeNode(nodes.get(rawNode.key), rawNode));
  };

  for (const cachedNode of readCache(cachePath)) {
    upsertRawNode(cachedNode);
  }

  for (const cachedNode of nodes.values()) {
    if (!cachedNode?.isFetched) continue;
    fetchedKeys.add(cachedNode.key);
  }

  for (const anime of catalogAnime) {
    enqueueNode({ anilistId: anime?.anilistId, malId: anime?.malId });
  }

  for (const cachedNode of nodes.values()) {
    if (!cachedNode?.isFetched) {
      enqueueNode(cachedNode);
    }
  }

  let requestCount = 0;
  let discoveredRelationCount = 0;

  while (pendingAniListIds.length > 0 || pendingMalIds.length > 0) {
    if (pendingAniListIds.length > 0) {
      const batch = pendingAniListIds.splice(0, batchSize);
      requestCount += 1;

      const data = await postGraphQL({
        query: ANILIST_BATCH_QUERY,
        variables: { ids: batch },
        delayMs,
        label: `AniList batch ${requestCount}`
      });

      const mediaList = data?.Page?.media || [];
      for (const media of mediaList) {
        const rawNode = normalizeMedia(media);
        if (!rawNode.key) continue;

        upsertRawNode(rawNode);
        fetchedKeys.add(rawNode.key);

        for (const edge of media?.relations?.edges || []) {
          if (edge?.node?.type !== 'ANIME') continue;
          if (!isFranchiseRelationType(edge?.relationType)) continue;
          const relatedNode = normalizeRelatedNode(edge.node);
          if (!relatedNode.key) continue;

          upsertRawNode(relatedNode);
          enqueueNode(relatedNode);
          discoveredRelationCount += 1;
        }
      }

      if (requestCount % 10 === 0 || (pendingAniListIds.length === 0 && pendingMalIds.length === 0)) {
        writeCache(cachePath, Array.from(nodes.values()));
        console.log(`Fetched ${nodes.size} relation nodes after ${requestCount} requests.`);
      }

      continue;
    }

    const nextMalId = pendingMalIds.shift();
    requestCount += 1;
    const data = await postGraphQL({
      query: MAL_SINGLE_QUERY,
      variables: { idMal: nextMalId },
      delayMs,
      label: `MAL ${nextMalId}`
    });

    const media = data?.Media;
    if (!media) continue;

    const rawNode = normalizeMedia(media);
    if (!rawNode.key) continue;

    upsertRawNode(rawNode);
    fetchedKeys.add(rawNode.key);

    for (const edge of media?.relations?.edges || []) {
      if (edge?.node?.type !== 'ANIME') continue;
      if (!isFranchiseRelationType(edge?.relationType)) continue;
      const relatedNode = normalizeRelatedNode(edge.node);
      if (!relatedNode.key) continue;

      upsertRawNode(relatedNode);
      enqueueNode(relatedNode);
      discoveredRelationCount += 1;
    }

    if (requestCount % 10 === 0 || (pendingAniListIds.length === 0 && pendingMalIds.length === 0)) {
      writeCache(cachePath, Array.from(nodes.values()));
    }
  }

  writeCache(cachePath, Array.from(nodes.values()));
  return {
    nodes: Array.from(nodes.values()),
    requestCount,
    discoveredRelationCount
  };
};

const main = async () => {
  const values = parseArgs(process.argv.slice(2));
  const inputPath = values.input || DEFAULT_INPUT;
  const outputPath = values.output || DEFAULT_OUTPUT;
  const cachePath = values.cache || DEFAULT_CACHE;
  const delayMs = Number.parseInt(values['delay-ms'] || '', 10) || DEFAULT_DELAY_MS;
  const batchSize = Number.parseInt(values['batch-size'] || '', 10) || DEFAULT_BATCH_SIZE;

  const catalog = readJson(inputPath);
  const catalogAnime = Array.isArray(catalog?.anime) ? catalog.anime : [];

  console.log(`Generating franchise map from ${catalogAnime.length} catalog entries...`);
  const relationGraph = await fetchAllRelationNodes({
    catalogAnime,
    delayMs,
    batchSize,
    cachePath
  });

  const franchiseMap = buildFranchiseMap(catalogAnime, relationGraph.nodes);
  const output = {
    generatedAt: franchiseMap.generatedAt,
    source: 'AniList GraphQL relations',
    requestCount: relationGraph.requestCount,
    relationNodeCount: relationGraph.nodes.length,
    discoveredRelationCount: relationGraph.discoveredRelationCount,
    franchises: franchiseMap.franchises,
    byAnimeId: franchiseMap.byAnimeId
  };

  fs.writeFileSync(outputPath, JSON.stringify(output));
  console.log(`Wrote ${Object.keys(output.byAnimeId).length} franchise entries to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
