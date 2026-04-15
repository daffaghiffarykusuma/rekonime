const SELECTED_RELATION_TYPES = new Set([
  'PREQUEL',
  'SEQUEL',
  'SIDE_STORY',
  'SPIN_OFF',
  'ALTERNATIVE',
  'SUMMARY',
  'PARENT'
]);

const MAINLINE_RELATION_TYPES = new Set(['PREQUEL', 'SEQUEL']);
const ATTACHMENT_PRIORITY = {
  SIDE_STORY: 0,
  SPIN_OFF: 1,
  ALTERNATIVE: 2,
  SUMMARY: 3,
  PARENT: 4,
  RELATED: 5
};
const FORMAT_PRIORITY = {
  TV: 0,
  TV_SHORT: 1,
  ONA: 2,
  MOVIE: 3,
  OVA: 4,
  SPECIAL: 5,
  MUSIC: 6
};

const toArray = (value) => Array.isArray(value) ? value : [];

const slugify = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'franchise';

const makeNodeKey = ({ anilistId, malId }) => {
  if (Number.isInteger(anilistId) && anilistId > 0) {
    return `anilist:${anilistId}`;
  }
  if (Number.isInteger(malId) && malId > 0) {
    return `mal:${malId}`;
  }
  return '';
};

const pickDisplayTitle = (node, localAnime) => {
  const localTitle = String(localAnime?.title || '').trim();
  if (localTitle) return localTitle;

  const english = String(node?.title?.english || '').trim();
  const romaji = String(node?.title?.romaji || '').trim();
  const preferred = String(node?.title?.userPreferred || '').trim();
  const nativeTitle = String(node?.title?.native || '').trim();
  return english || romaji || preferred || nativeTitle || 'Untitled';
};

const getNodeYear = (node, localAnime) => {
  const rawYear = localAnime?.year ?? node?.startDate?.year ?? node?.seasonYear ?? null;
  return Number.isInteger(rawYear) ? rawYear : null;
};

const getNodeFormat = (node, localAnime) => {
  const format = String(localAnime?.type || node?.format || '').trim();
  return format || 'ANIME';
};

const getDateRank = (node, localAnime) => {
  const year = getNodeYear(node, localAnime);
  const month = Number.isInteger(node?.startDate?.month) ? node.startDate.month : 13;
  const day = Number.isInteger(node?.startDate?.day) ? node.startDate.day : 32;
  const safeYear = Number.isInteger(year) ? year : 9999;
  return (safeYear * 10000) + (month * 100) + day;
};

const compareNodes = (a, b, localByKey, nodeMap) => {
  const localA = localByKey.get(a);
  const localB = localByKey.get(b);
  const nodeA = nodeMap.get(a);
  const nodeB = nodeMap.get(b);

  const yearRank = getDateRank(nodeA, localA) - getDateRank(nodeB, localB);
  if (yearRank !== 0) return yearRank;

  const formatRank = (FORMAT_PRIORITY[getNodeFormat(nodeA, localA)] ?? 99) - (FORMAT_PRIORITY[getNodeFormat(nodeB, localB)] ?? 99);
  if (formatRank !== 0) return formatRank;

  const titleRank = pickDisplayTitle(nodeA, localA).localeCompare(pickDisplayTitle(nodeB, localB));
  if (titleRank !== 0) return titleRank;

  return a.localeCompare(b);
};

const getSupplementaryScore = (key, nodeMap, localByKey) => {
  const node = nodeMap.get(key);
  const localAnime = localByKey.get(key);
  const format = getNodeFormat(node, localAnime);
  const title = pickDisplayTitle(node, localAnime).toLowerCase();

  let score = 0;
  if (format === 'MOVIE') score += 4;
  if (format === 'OVA' || format === 'SPECIAL') score += 3;
  if (format === 'ONA' || format === 'TV_SHORT') score += 1;
  if (/chronicle|summary|recap|movie|special|part\s+[ivx]+/.test(title)) score += 2;
  return score;
};

const createCatalogLookup = (catalogAnime) => {
  const byKey = new Map();
  const byId = new Map();

  for (const anime of toArray(catalogAnime)) {
    if (anime?.id) {
      byId.set(anime.id, anime);
    }
    const anilistKey = makeNodeKey({ anilistId: anime?.anilistId, malId: null });
    const malKey = makeNodeKey({ anilistId: null, malId: anime?.malId });
    if (anilistKey) byKey.set(anilistKey, anime);
    if (malKey) byKey.set(malKey, anime);
  }

  return { byKey, byId };
};

const normalizeRelationNodes = (rawNodes) => {
  const nodes = new Map();

  for (const rawNode of toArray(rawNodes)) {
    const key = rawNode?.key || makeNodeKey(rawNode);
    if (!key) continue;

    const relations = [];
    for (const relation of toArray(rawNode?.relations)) {
      const relationType = String(relation?.relationType || '').trim();
      if (!SELECTED_RELATION_TYPES.has(relationType)) continue;

      const related = relation?.node || relation;
      const toKey = relation?.toKey || makeNodeKey(related || {});
      if (!toKey || toKey === key) continue;

      relations.push({
        relationType,
        toKey
      });
    }

    nodes.set(key, {
      key,
      anilistId: Number.isInteger(rawNode?.anilistId) ? rawNode.anilistId : null,
      malId: Number.isInteger(rawNode?.malId) ? rawNode.malId : null,
      format: String(rawNode?.format || '').trim() || null,
      seasonYear: Number.isInteger(rawNode?.seasonYear) ? rawNode.seasonYear : null,
      startDate: rawNode?.startDate && typeof rawNode.startDate === 'object'
        ? {
            year: Number.isInteger(rawNode.startDate.year) ? rawNode.startDate.year : null,
            month: Number.isInteger(rawNode.startDate.month) ? rawNode.startDate.month : null,
            day: Number.isInteger(rawNode.startDate.day) ? rawNode.startDate.day : null
          }
        : null,
      title: rawNode?.title && typeof rawNode.title === 'object'
        ? {
            userPreferred: String(rawNode.title.userPreferred || '').trim(),
            english: String(rawNode.title.english || '').trim(),
            romaji: String(rawNode.title.romaji || '').trim(),
            native: String(rawNode.title.native || '').trim()
          }
        : {},
      relations
    });
  }

  return nodes;
};

const buildComponentKeys = (nodeMap) => {
  const adjacency = new Map();

  for (const node of nodeMap.values()) {
    if (!adjacency.has(node.key)) {
      adjacency.set(node.key, new Set());
    }
    for (const relation of node.relations) {
      if (!nodeMap.has(relation.toKey)) continue;
      adjacency.get(node.key).add(relation.toKey);
      if (!adjacency.has(relation.toKey)) {
        adjacency.set(relation.toKey, new Set());
      }
      adjacency.get(relation.toKey).add(node.key);
    }
  }

  const seen = new Set();
  const components = [];

  for (const key of adjacency.keys()) {
    if (seen.has(key)) continue;
    const stack = [key];
    const component = [];
    seen.add(key);

    while (stack.length > 0) {
      const next = stack.pop();
      component.push(next);
      const neighbors = adjacency.get(next);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
};

const buildSupplementaryCandidates = (componentKeys, nodeMap, localByKey) => {
  const componentKeySet = new Set(componentKeys);
  const candidates = new Map();

  for (const key of componentKeys) {
    const node = nodeMap.get(key);
    if (!node) continue;

    for (const relation of node.relations) {
      if (!componentKeySet.has(relation.toKey)) continue;
      if (MAINLINE_RELATION_TYPES.has(relation.relationType)) continue;

      let attachedKey = relation.toKey;
      let anchorKey = key;

      if (relation.relationType === 'PARENT') {
        attachedKey = key;
        anchorKey = relation.toKey;
      } else if (relation.relationType === 'ALTERNATIVE' || relation.relationType === 'SUMMARY') {
        const sourceScore = getSupplementaryScore(key, nodeMap, localByKey);
        const targetScore = getSupplementaryScore(relation.toKey, nodeMap, localByKey);
        if (sourceScore > targetScore) {
          attachedKey = key;
          anchorKey = relation.toKey;
        }
      }

      const candidate = {
        relationType: relation.relationType,
        anchorKey,
        anchorOrder: Number.MAX_SAFE_INTEGER
      };

      candidates.set(attachedKey, selectPrimaryAttachment(candidates.get(attachedKey), candidate));
    }
  }

  return candidates;
};

const buildMainlineGraph = (componentKeys, nodeMap, supplementaryKeys = new Set()) => {
  const componentKeySet = new Set(componentKeys);
  const nodeKeys = new Set();
  const edges = new Set();
  const incoming = new Map();
  const outgoing = new Map();

  const addEdge = (fromKey, toKey) => {
    if (!componentKeySet.has(fromKey) || !componentKeySet.has(toKey) || fromKey === toKey) return;
    if (supplementaryKeys.has(fromKey) || supplementaryKeys.has(toKey)) return;
    const edgeKey = `${fromKey}->${toKey}`;
    if (edges.has(edgeKey)) return;
    edges.add(edgeKey);
    nodeKeys.add(fromKey);
    nodeKeys.add(toKey);
    if (!incoming.has(toKey)) incoming.set(toKey, new Set());
    if (!outgoing.has(fromKey)) outgoing.set(fromKey, new Set());
    incoming.get(toKey).add(fromKey);
    outgoing.get(fromKey).add(toKey);
  };

  for (const key of componentKeys) {
    const node = nodeMap.get(key);
    if (!node) continue;
    for (const relation of node.relations) {
      if (!MAINLINE_RELATION_TYPES.has(relation.relationType)) continue;
      if (!componentKeySet.has(relation.toKey)) continue;

      if (relation.relationType === 'SEQUEL') {
        addEdge(key, relation.toKey);
      } else if (relation.relationType === 'PREQUEL') {
        addEdge(relation.toKey, key);
      }
    }
  }

  return {
    nodeKeys,
    edges,
    incoming,
    outgoing
  };
};

const topoSortMainline = ({ nodeKeys, incoming, outgoing }, localByKey, nodeMap) => {
  const pendingIncoming = new Map();
  const queue = [];

  for (const key of nodeKeys) {
    pendingIncoming.set(key, new Set(incoming.get(key) || []));
  }

  for (const key of nodeKeys) {
    if ((pendingIncoming.get(key)?.size || 0) === 0) {
      queue.push(key);
    }
  }

  queue.sort((a, b) => compareNodes(a, b, localByKey, nodeMap));
  const order = [];

  while (queue.length > 0) {
    const next = queue.shift();
    order.push(next);
    const targets = Array.from(outgoing.get(next) || []);

    for (const target of targets) {
      const targetIncoming = pendingIncoming.get(target);
      if (!targetIncoming) continue;
      targetIncoming.delete(next);
      if (targetIncoming.size === 0) {
        queue.push(target);
      }
    }

    queue.sort((a, b) => compareNodes(a, b, localByKey, nodeMap));
  }

  if (order.length !== nodeKeys.size) {
    return Array.from(nodeKeys).sort((a, b) => compareNodes(a, b, localByKey, nodeMap));
  }

  return order;
};

const isLinearMainline = ({ nodeKeys, incoming, outgoing }) => {
  if (nodeKeys.size <= 1) return false;

  let roots = 0;
  for (const key of nodeKeys) {
    const inDegree = incoming.get(key)?.size || 0;
    const outDegree = outgoing.get(key)?.size || 0;
    if (inDegree === 0) roots += 1;
    if (inDegree > 1 || outDegree > 1) return false;
  }

  return roots === 1;
};

const selectPrimaryAttachment = (existing, candidate) => {
  if (!existing) return candidate;
  if (candidate.anchorOrder < existing.anchorOrder) return candidate;
  if (candidate.anchorOrder > existing.anchorOrder) return existing;

  const candidateRank = ATTACHMENT_PRIORITY[candidate.relationType] ?? 99;
  const existingRank = ATTACHMENT_PRIORITY[existing.relationType] ?? 99;
  if (candidateRank < existingRank) return candidate;
  if (candidateRank > existingRank) return existing;
  return candidate.anchorKey.localeCompare(existing.anchorKey) < 0 ? candidate : existing;
};

const buildOrderedItems = ({ componentKeys, mainline, mode, entryKey, localByKey, nodeMap, supplementaryCandidates = new Map() }) => {
  const sortedAllKeys = [...componentKeys].sort((a, b) => compareNodes(a, b, localByKey, nodeMap));
  const mainOrder = mainline.order.length > 0 ? mainline.order : (entryKey ? [entryKey] : []);
  const mainOrderIndex = new Map(mainOrder.map((key, index) => [key, index]));
  const attachmentsByAnchor = new Map();
  for (const [attachedKey, originalCandidate] of supplementaryCandidates.entries()) {
    const candidate = {
      ...originalCandidate,
      anchorOrder: mainOrderIndex.get(originalCandidate.anchorKey) ?? Number.MAX_SAFE_INTEGER
    };
    if (!mainOrderIndex.has(candidate.anchorKey)) continue;
    if (!attachmentsByAnchor.has(candidate.anchorKey)) {
      attachmentsByAnchor.set(candidate.anchorKey, []);
    }
    attachmentsByAnchor.get(candidate.anchorKey).push({
      key: attachedKey,
      relationType: candidate.relationType
    });
  }

  for (const [anchorKey, attachments] of attachmentsByAnchor.entries()) {
    attachments.sort((left, right) => {
      const relationRank = (ATTACHMENT_PRIORITY[left.relationType] ?? 99) - (ATTACHMENT_PRIORITY[right.relationType] ?? 99);
      if (relationRank !== 0) return relationRank;
      return compareNodes(left.key, right.key, localByKey, nodeMap);
    });
  }

  const items = [];
  const added = new Set();

  const pushItem = (key, {
    bucket = 'related',
    relationType = 'RELATED',
    isEntry = false,
    anchorKey = null,
    mainOrderValue = null
  } = {}) => {
    if (added.has(key)) return;
    const node = nodeMap.get(key);
    if (!node) return;

    const localAnime = localByKey.get(key);
    const anchorAnime = anchorKey ? localByKey.get(anchorKey) : null;
    const anchorNode = anchorKey ? nodeMap.get(anchorKey) : null;

    items.push({
      animeId: localAnime?.id || null,
      externalKey: localAnime?.id ? null : key,
      title: pickDisplayTitle(node, localAnime),
      year: getNodeYear(node, localAnime),
      format: getNodeFormat(node, localAnime),
      bucket,
      relationType,
      isEntry,
      isInCatalog: Boolean(localAnime?.id),
      anchorAnimeId: anchorAnime?.id || null,
      anchorTitle: anchorNode ? pickDisplayTitle(anchorNode, anchorAnime) : '',
      mainOrder: Number.isInteger(mainOrderValue) ? mainOrderValue : null
    });
    added.add(key);
  };

  if (mainOrder.length > 0) {
    mainOrder.forEach((key, index) => {
      pushItem(key, {
        bucket: 'main',
        relationType: index === 0 ? 'ENTRY' : (mode === 'linear' ? 'SEQUEL' : 'RELATED'),
        isEntry: index === 0,
        mainOrderValue: index + 1
      });

      const attachments = attachmentsByAnchor.get(key) || [];
      attachments.forEach((attachment) => {
      const relationType = attachment.relationType;
      let bucket = 'related';
      if (relationType === 'SIDE_STORY') bucket = 'side_story';
        if (relationType === 'SPIN_OFF') bucket = 'spin_off';
        if (relationType === 'SUMMARY') bucket = 'summary';
        if (relationType === 'ALTERNATIVE') bucket = 'alternative';

        pushItem(attachment.key, {
          bucket,
          relationType,
          anchorKey: key,
          mainOrderValue: index + 1
        });
      });
    });
  }

  for (const key of sortedAllKeys) {
    if (added.has(key)) continue;
    const candidate = supplementaryCandidates.get(key);
    let bucket = 'related';
    if (candidate?.relationType === 'SIDE_STORY') bucket = 'side_story';
    if (candidate?.relationType === 'SPIN_OFF') bucket = 'spin_off';
    if (candidate?.relationType === 'SUMMARY') bucket = 'summary';
    if (candidate?.relationType === 'ALTERNATIVE') bucket = 'alternative';

    pushItem(key, {
      bucket,
      relationType: candidate?.relationType || 'RELATED',
      anchorKey: candidate?.anchorKey || null,
      mainOrderValue: candidate?.anchorKey ? (mainOrderIndex.get(candidate.anchorKey) ?? null) : null
    });
  }

  return items.map((item, index) => ({
    ...item,
    order: index + 1
  }));
};

const buildComponentFranchise = ({ componentKeys, nodeMap, localByKey }) => {
  if (componentKeys.length < 2) return null;

  const localMembers = [];
  for (const key of componentKeys) {
    const localAnime = localByKey.get(key);
    if (localAnime?.id) {
      localMembers.push(localAnime);
    }
  }

  if (localMembers.length === 0) return null;

  const supplementaryCandidates = buildSupplementaryCandidates(componentKeys, nodeMap, localByKey);
  const supplementaryKeys = new Set(supplementaryCandidates.keys());
  const mainline = buildMainlineGraph(componentKeys, nodeMap, supplementaryKeys);
  const graphMainOrder = mainline.nodeKeys.size > 0
    ? topoSortMainline(mainline, localByKey, nodeMap)
    : [];
  const adjustedSupplementaryCandidates = new Map(supplementaryCandidates);
  const sortedMainOrder = [...graphMainOrder].sort((a, b) => compareNodes(a, b, localByKey, nodeMap));
  const hasSerializedMainEntry = sortedMainOrder.some((key) => {
    const format = getNodeFormat(nodeMap.get(key), localByKey.get(key));
    return format === 'TV' || format === 'TV_SHORT' || format === 'ONA';
  });
  const mainOrder = [];

  for (const key of sortedMainOrder) {
    const format = getNodeFormat(nodeMap.get(key), localByKey.get(key));
    if (hasSerializedMainEntry && format === 'OVA') {
      const anchorKey = mainOrder[mainOrder.length - 1] || sortedMainOrder[0] || key;
      adjustedSupplementaryCandidates.set(key, {
        relationType: adjustedSupplementaryCandidates.get(key)?.relationType || 'SIDE_STORY',
        anchorKey,
        anchorOrder: Number.MAX_SAFE_INTEGER
      });
      continue;
    }
    mainOrder.push(key);
  }

  const sortedAllKeys = [...componentKeys].sort((a, b) => compareNodes(a, b, localByKey, nodeMap));
  const entryKey = mainOrder[0] || sortedAllKeys[0] || '';
  const mode = graphMainOrder.length > 0
    ? (isLinearMainline(mainline) ? 'linear' : 'branched')
    : 'related';

  const items = buildOrderedItems({
    componentKeys,
    mainline: { ...mainline, order: mainOrder },
    mode,
    entryKey,
    localByKey,
    nodeMap,
    supplementaryCandidates: adjustedSupplementaryCandidates
  });

  if (items.length < 2) return null;

  const entryLocalAnime = localByKey.get(entryKey);
  const entryNode = nodeMap.get(entryKey);
  const entryTitle = pickDisplayTitle(entryNode, entryLocalAnime);
  const franchiseId = `${slugify(entryTitle)}-${String(entryNode?.anilistId || entryNode?.malId || entryKey).replace(/[^a-z0-9-]/gi, '')}`;
  const mainCount = items.filter(item => item.bucket === 'main').length;
  const catalogCount = items.filter(item => item.isInCatalog).length;

  return {
    id: franchiseId,
    title: entryTitle,
    mode,
    entryAnimeId: entryLocalAnime?.id || null,
    entryTitle,
    totalCount: items.length,
    catalogCount,
    mainCount,
    items
  };
};

export const isFranchiseRelationType = (relationType) => SELECTED_RELATION_TYPES.has(String(relationType || '').trim());

export const buildFranchiseMap = (catalogAnime, rawNodes) => {
  const { byKey: localByKey } = createCatalogLookup(catalogAnime);
  const nodeMap = normalizeRelationNodes(rawNodes);
  const components = buildComponentKeys(nodeMap);
  const franchises = {};
  const byAnimeId = {};

  for (const componentKeys of components) {
    const franchise = buildComponentFranchise({
      componentKeys,
      nodeMap,
      localByKey
    });

    if (!franchise) continue;
    franchises[franchise.id] = franchise;

    for (const item of franchise.items) {
      if (!item.animeId) continue;
      byAnimeId[item.animeId] = franchise.id;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    franchises,
    byAnimeId
  };
};

export default {
  buildFranchiseMap,
  isFranchiseRelationType
};
