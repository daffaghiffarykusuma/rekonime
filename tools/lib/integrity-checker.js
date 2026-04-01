import { validateUniqueIds } from './schema-validator.js';

const getAnimeId = (anime, fallback) => {
  const meta = anime?.metadata || {};
  return meta.id || anime?.id || fallback;
};

const checkEpisodeCount = (anime, animeId) => {
  const meta = anime?.metadata || {};
  const expected = meta.episodes_count;
  if (!Number.isInteger(expected)) return null;
  const actual = Array.isArray(anime?.episodes) ? anime.episodes.length : 0;
  if (actual === expected) return null;
  return {
    animeId,
    field: 'metadata.episodes_count',
    message: 'Episode count does not match metadata',
    value: { expected, actual },
    severity: 'warning'
  };
};

const checkReferentialIntegrity = (animeList = [], options = {}) => {
  const issues = [];
  const uniqueIssues = validateUniqueIds(animeList, options);
  issues.push(...uniqueIssues);

  animeList.forEach((anime, index) => {
    const animeId = getAnimeId(anime, String(index + 1));
    const countIssue = checkEpisodeCount(anime, animeId);
    if (countIssue) issues.push(countIssue);
  });

  return issues;
};

export { checkReferentialIntegrity };
