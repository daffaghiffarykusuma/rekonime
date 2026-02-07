const EMBEDDED_DATA_IDENTIFIER = 'ANIME_DATA';

const extractEmbeddedData = (scriptContent, { identifier = EMBEDDED_DATA_IDENTIFIER } = {}) => {
  const source = String(scriptContent || '').trim();
  if (!source) {
    throw new Error('Embedded data script is empty');
  }

  const pattern = new RegExp(`(?:const|let|var)\\s+${identifier}\\s*=\\s*([\\s\\S]+?);\\s*$`);
  const match = source.match(pattern);
  if (!match || !match[1]) {
    throw new Error(`Unable to locate ${identifier} payload`);
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Failed to parse ${identifier} JSON payload: ${error.message}`);
  }
};

const serializeEmbeddedData = (payload, { identifier = EMBEDDED_DATA_IDENTIFIER } = {}) => {
  return `const ${identifier}=${JSON.stringify(payload)};`;
};

const isPlainObject = (value) => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

const validateEmbeddedAnimeShape = (payload, { sampleSize = 25 } = {}) => {
  const errors = [];
  const animeList = Array.isArray(payload?.anime) ? payload.anime : null;

  if (!animeList) {
    errors.push('payload.anime must be an array');
    return { valid: false, errors };
  }

  if (animeList.length === 0) {
    return { valid: true, errors };
  }

  const limit = Math.min(animeList.length, Math.max(1, sampleSize));
  for (let index = 0; index < limit; index += 1) {
    const anime = animeList[index];
    if (!isPlainObject(anime)) {
      errors.push(`anime[${index}] must be an object`);
      continue;
    }
    if (!Array.isArray(anime.genres)) {
      errors.push(`anime[${index}].genres must be an array`);
    }
    if (!Array.isArray(anime.themes)) {
      errors.push(`anime[${index}].themes must be an array`);
    }
    if (!Array.isArray(anime.episodes)) {
      errors.push(`anime[${index}].episodes must be an array`);
    }
    if (!(anime.trailer === null || isPlainObject(anime.trailer))) {
      errors.push(`anime[${index}].trailer must be an object or null`);
    }
    if (!isPlainObject(anime.stats)) {
      errors.push(`anime[${index}].stats must be an object`);
    }
  }

  return { valid: errors.length === 0, errors };
};

export {
  EMBEDDED_DATA_IDENTIFIER,
  extractEmbeddedData,
  serializeEmbeddedData,
  validateEmbeddedAnimeShape
};
