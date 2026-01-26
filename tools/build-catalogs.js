const fs = require('fs');
const path = require('path');
const Stats = require('../js/stats.js');

const inputPath = process.argv[2] || path.join(__dirname, '..', 'data', 'anime.json');
const fullOutputPath = process.argv[3] || path.join(__dirname, '..', 'data', 'anime.full.json');
const previewOutputPath = process.argv[4] || path.join(__dirname, '..', 'data', 'anime.preview.json');

const PREVIEW_LIMIT = 200;
const PREVIEW_BUCKET = 80;

const normalizeSearchQuery = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim();

const buildSearchText = (title, titleEnglish, titleJapanese) => {
  const parts = [title, titleEnglish, titleJapanese]
    .map(value => normalizeSearchQuery(value))
    .filter(Boolean);
  return parts.join(' ');
};

const sanitizeTagList = (tags) => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const cleaned = [];

  for (const tag of tags) {
    const label = String(tag ?? '').trim();
    const normalized = label.toLowerCase();
    if (!label || normalized === 'undefined' || normalized === 'null') continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(label);
  }

  return cleaned;
};

const normalizeAnime = (anime) => {
  const normalizedGenres = sanitizeTagList(anime?.metadata?.genres || anime?.genres || []);
  const normalizedThemes = sanitizeTagList(anime?.metadata?.themes || anime?.themes || []);
  const normalizedTrailer = anime?.metadata?.trailer || anime?.trailer || null;
  const normalizedSynopsis = anime?.metadata?.synopsis || anime?.synopsis || '';
  const normalizedTitleEnglish =
    anime?.metadata?.title_english ||
    anime?.metadata?.titleEnglish ||
    anime?.title_english ||
    anime?.titleEnglish ||
    '';
  const normalizedTitleJapanese =
    anime?.metadata?.title_japanese ||
    anime?.metadata?.titleJapanese ||
    anime?.title_japanese ||
    anime?.titleJapanese ||
    '';
  const normalizedType = anime?.metadata?.type || anime?.type || '';
  const rawCommunityScore = anime?.communityScore ?? anime?.metadata?.score ?? anime?.score;
  const communityScore = Number.isFinite(Number(rawCommunityScore)) ? Number(rawCommunityScore) : null;

  if (anime?.metadata) {
    const resolvedTitle = anime.metadata.title || anime.title;
    return {
      id: anime.metadata.id || anime.id,
      title: resolvedTitle,
      titleEnglish: normalizedTitleEnglish,
      titleJapanese: normalizedTitleJapanese,
      malId: anime.metadata.malId || anime.mal_id || anime.malId,
      anilistId: anime.metadata.anilistId || anime.anilistId,
      cover: anime.metadata.cover || anime.cover,
      type: normalizedType,
      year: anime.metadata.year || anime.year,
      season: anime.metadata.season || anime.season,
      studio: anime.metadata.studio || anime.studio,
      source: anime.metadata.source || anime.source,
      genres: normalizedGenres,
      themes: normalizedThemes,
      demographic: anime.metadata.demographic || anime.demographic,
      trailer: normalizedTrailer,
      synopsis: normalizedSynopsis,
      communityScore: communityScore,
      searchText: anime.searchText || buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
      episodes: Array.isArray(anime.episodes) ? anime.episodes : []
    };
  }

  const resolvedTitle = anime.title;
  return {
    id: anime.id,
    title: resolvedTitle,
    titleEnglish: normalizedTitleEnglish,
    titleJapanese: normalizedTitleJapanese,
    malId: anime.malId,
    anilistId: anime.anilistId,
    cover: anime.cover,
    type: normalizedType,
    year: anime.year,
    season: anime.season,
    studio: anime.studio,
    source: anime.source,
    genres: normalizedGenres,
    themes: normalizedThemes,
    demographic: anime.demographic,
    trailer: normalizedTrailer,
    synopsis: normalizedSynopsis,
    communityScore: communityScore,
    searchText: anime.searchText || buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
    episodes: Array.isArray(anime.episodes) ? anime.episodes : []
  };
};

const byNumberDesc = (a, b) => (Number.isFinite(b) ? b : 0) - (Number.isFinite(a) ? a : 0);

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const normalized = (raw.anime || []).map(normalizeAnime);
const scoreProfile = Stats.buildScoreProfile(normalized);

const fullCatalog = normalized.map((anime, index) => ({
  ...anime,
  stats: Stats.calculateAllStats(anime, scoreProfile),
  colorIndex: index
}));

const withEpisodes = fullCatalog.filter(anime => Array.isArray(anime.episodes) && anime.episodes.length > 0);
const byRetention = [...withEpisodes].sort((a, b) => byNumberDesc(a.stats?.retentionScore, b.stats?.retentionScore)).slice(0, PREVIEW_BUCKET);
const bySatisfaction = [...fullCatalog]
  .filter(anime => Number.isFinite(anime.communityScore))
  .sort((a, b) => byNumberDesc(a.communityScore, b.communityScore))
  .slice(0, PREVIEW_BUCKET);
const byRecent = [...fullCatalog]
  .sort((a, b) => byNumberDesc(a.year, b.year))
  .slice(0, PREVIEW_BUCKET);

const previewMap = new Map();
[...byRetention, ...bySatisfaction, ...byRecent].forEach(anime => {
  if (anime?.id && !previewMap.has(anime.id)) {
    previewMap.set(anime.id, anime);
  }
});

const previewCatalog = [...previewMap.values()]
  .sort((a, b) => byNumberDesc(a.stats?.retentionScore, b.stats?.retentionScore))
  .slice(0, PREVIEW_LIMIT);

const fullPayload = {
  generatedAt: new Date().toISOString(),
  scoreProfile,
  anime: fullCatalog
};

const previewPayload = {
  generatedAt: fullPayload.generatedAt,
  scoreProfile,
  anime: previewCatalog
};

fs.writeFileSync(fullOutputPath, JSON.stringify(fullPayload));
fs.writeFileSync(previewOutputPath, JSON.stringify(previewPayload));

console.log(`Wrote ${fullCatalog.length} entries to ${fullOutputPath}`);
console.log(`Wrote ${previewCatalog.length} entries to ${previewOutputPath}`);
