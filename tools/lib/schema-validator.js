import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sanitizeTrailerUrl,
  sanitizeTrailerEmbedUrl
} from '../../js/security/trailer-url-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_ROOT = path.join(__dirname, '..', 'schemas');
const schemaCache = new Map();

const defaultOptions = {
  strict: false,
  allowMissingEpisodes: true,
  allowMissingTrailer: true,
  allowNonHttpsCover: true
};

const normalizePath = (base, key) => (base ? `${base}.${key}` : key);

const resolveSchemaPath = (ref) => {
  if (!ref) return null;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
  if (ref.startsWith('#')) return ref;
  const cleanRef = ref.replace(/^.\//, '');
  return path.join(SCHEMA_ROOT, cleanRef);
};

const loadSchema = (ref) => {
  if (!ref) return null;
  const refPath = resolveSchemaPath(ref);
  if (!refPath || refPath.startsWith('#')) return null;
  if (schemaCache.has(refPath)) return schemaCache.get(refPath);
  const raw = fs.readFileSync(refPath, 'utf8');
  const parsed = JSON.parse(raw);
  schemaCache.set(refPath, parsed);
  return parsed;
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const matchesType = (value, type) => {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return Number.isFinite(value);
    case 'integer':
      return Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
};

const validateSchema = (value, schema, ctx) => {
  if (!schema || typeof schema !== 'object') return;
  if (schema.$ref) {
    const refSchema = loadSchema(schema.$ref);
    if (refSchema) validateSchema(value, refSchema, ctx);
    return;
  }

  if (Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf.some(option => {
      const temp = { ...ctx, issues: [] };
      validateSchema(value, option, temp);
      return temp.issues.length === 0;
    });
    if (!matches) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: 'Value does not match any allowed schema',
        value,
        severity: 'error'
      });
    }
    return;
  }

  const types = Array.isArray(schema.type) ? schema.type : (schema.type ? [schema.type] : []);
  if (types.length) {
    const typeMatches = types.some(type => matchesType(value, type));
    if (!typeMatches) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: `Expected type ${types.join(' | ')}`,
        value,
        severity: 'error'
      });
      return;
    }
    if (value === null) return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    ctx.issues.push({
      animeId: ctx.animeId,
      field: ctx.path,
      message: 'Value not in enum',
      value,
      severity: 'error'
    });
    return;
  }

  if (schema.type === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: `String shorter than ${schema.minLength}`,
        value,
        severity: 'error'
      });
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: `String longer than ${schema.maxLength}`,
        value,
        severity: 'error'
      });
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        ctx.issues.push({
          animeId: ctx.animeId,
          field: ctx.path,
          message: 'String does not match pattern',
          value,
          severity: 'error'
        });
      }
    }
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (Number.isFinite(schema.minimum) && value < schema.minimum) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: `Value below minimum ${schema.minimum}`,
        value,
        severity: 'error'
      });
    }
    if (Number.isFinite(schema.maximum) && value > schema.maximum) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: `Value above maximum ${schema.maximum}`,
        value,
        severity: 'error'
      });
    }
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) return;
    if (Number.isFinite(schema.minItems) && value.length < schema.minItems) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: `Array has fewer than ${schema.minItems} items`,
        value,
        severity: 'error'
      });
    }
    if (Number.isFinite(schema.maxItems) && value.length > schema.maxItems) {
      ctx.issues.push({
        animeId: ctx.animeId,
        field: ctx.path,
        message: `Array has more than ${schema.maxItems} items`,
        value,
        severity: 'error'
      });
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateSchema(item, schema.items, {
          ...ctx,
          path: `${ctx.path}[${index}]`
        });
      });
    }
  }

  if (schema.type === 'object') {
    if (!isPlainObject(value)) return;
    const required = Array.isArray(schema.required) ? schema.required : [];
    required.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        ctx.issues.push({
          animeId: ctx.animeId,
          field: normalizePath(ctx.path, key),
          message: 'Missing required field',
          value: undefined,
          severity: 'error'
        });
      }
    });

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propertySchema]) => {
        if (!Object.prototype.hasOwnProperty.call(value, key)) return;
        validateSchema(value[key], propertySchema, {
          ...ctx,
          path: normalizePath(ctx.path, key)
        });
      });
    }
  }
};

const getAnimeId = (anime) => {
  const meta = anime?.metadata || {};
  return meta.id || anime?.id || '';
};

const getAnimeIdForReport = (anime, fallback) => {
  const rawId = getAnimeId(anime);
  return rawId || fallback;
};

const getAnimeTitle = (anime) => {
  const meta = anime?.metadata || {};
  return meta.title || anime?.title || '';
};

const getAnimeCover = (anime) => {
  const meta = anime?.metadata || {};
  return meta.cover || anime?.cover || '';
};

const getTrailer = (anime) => {
  const meta = anime?.metadata || {};
  return meta.trailer || anime?.trailer || null;
};

const isHttpsUrl = (rawUrl) => {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidTrailerUrl = (rawUrl, { allowNoCookie = false } = {}) => {
  if (allowNoCookie) {
    return Boolean(sanitizeTrailerEmbedUrl(rawUrl));
  }
  return Boolean(sanitizeTrailerUrl(rawUrl));
};

const validateEpisodeSequence = (episodes, animeId, issues, options) => {
  if (!Array.isArray(episodes) || episodes.length === 0) return;
  const numbers = [];
  episodes.forEach((ep, index) => {
    if (!ep || typeof ep !== 'object') return;
    if (!Number.isInteger(ep.episode)) return;
    numbers.push({ number: ep.episode, index });
  });
  if (numbers.length === 0) return;
  const seen = new Set();
  const sorted = numbers.map(item => item.number).sort((a, b) => a - b);
  let hasDuplicate = false;
  sorted.forEach((num) => {
    if (seen.has(num)) {
      hasDuplicate = true;
    } else {
      seen.add(num);
    }
  });
  if (hasDuplicate) {
    issues.push({
      animeId,
      field: 'episodes',
      message: 'Duplicate episode numbers detected',
      value: null,
      severity: 'error'
    });
  }
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min !== 1) {
    issues.push({
      animeId,
      field: 'episodes',
      message: 'Episode sequence does not start at 1',
      value: min,
      severity: options.strict ? 'error' : 'warning'
    });
  }
  const expectedCount = max - min + 1;
  if (expectedCount !== sorted.length) {
    issues.push({
      animeId,
      field: 'episodes',
      message: 'Episode sequence has gaps',
      value: { min, max, count: sorted.length },
      severity: options.strict ? 'error' : 'warning'
    });
  }
};

const validateUniqueIds = (animeList) => {
  const issues = [];
  const idMap = new Map();
  const malMap = new Map();
  const aniMap = new Map();

  animeList.forEach((anime, index) => {
    const animeId = getAnimeIdForReport(anime, String(index + 1));
    const meta = anime?.metadata || {};
    const id = getAnimeId(anime);
    const malId = meta.malId || anime?.mal_id || anime?.malId || null;
    const anilistId = meta.anilistId || anime?.anilistId || null;

    if (id) {
      if (idMap.has(id)) {
        issues.push({
          animeId,
          field: 'id',
          message: 'Duplicate id detected',
          value: id,
          severity: 'error'
        });
      } else {
        idMap.set(id, true);
      }
    }

    if (Number.isInteger(malId)) {
      if (malMap.has(malId)) {
        issues.push({
          animeId,
          field: 'malId',
          message: 'Duplicate malId detected',
          value: malId,
          severity: 'error'
        });
      } else {
        malMap.set(malId, true);
      }
    }

    if (Number.isInteger(anilistId)) {
      if (aniMap.has(anilistId)) {
        issues.push({
          animeId,
          field: 'anilistId',
          message: 'Duplicate anilistId detected',
          value: anilistId,
          severity: 'error'
        });
      } else {
        aniMap.set(anilistId, true);
      }
    }
  });

  return issues;
};

const validateAnimeObject = (anime, options = {}) => {
  const resolved = { ...defaultOptions, ...options };
  const issues = [];
  const rawId = getAnimeId(anime);
  const animeId = rawId || 'unknown';
  const title = getAnimeTitle(anime);
  const cover = getAnimeCover(anime);

  if (!rawId) {
    issues.push({
      animeId,
      field: 'id',
      message: 'Missing id',
      value: rawId,
      severity: 'error'
    });
  }

  if (!title) {
    issues.push({
      animeId,
      field: 'title',
      message: 'Missing title',
      value: title,
      severity: 'error'
    });
  }

  if (!cover) {
    issues.push({
      animeId,
      field: 'cover',
      message: 'Missing cover',
      value: cover,
      severity: 'error'
    });
  } else if (!resolved.allowNonHttpsCover && !isHttpsUrl(cover)) {
    issues.push({
      animeId,
      field: 'cover',
      message: 'Cover URL must be HTTPS',
      value: cover,
      severity: resolved.strict ? 'error' : 'warning'
    });
  }

  const trailer = getTrailer(anime);
  if (!trailer) {
    if (!resolved.allowMissingTrailer) {
      issues.push({
        animeId,
        field: 'trailer',
        message: 'Missing trailer',
        value: null,
        severity: resolved.strict ? 'error' : 'warning'
      });
    }
  } else {
    const url = trailer.url || '';
    const embedUrl = trailer.embedUrl || trailer.embed_url || '';
    const hasUrl = isValidTrailerUrl(url);
    const hasEmbed = isValidTrailerUrl(embedUrl, { allowNoCookie: true });
    if (!hasUrl && !hasEmbed) {
      issues.push({
        animeId,
        field: 'trailer',
        message: 'Trailer URLs are invalid',
        value: { url, embedUrl },
        severity: resolved.strict ? 'error' : 'warning'
      });
    }
  }

  const episodes = anime?.episodes;
  if (!Array.isArray(episodes)) {
    if (!resolved.allowMissingEpisodes) {
      issues.push({
        animeId,
        field: 'episodes',
        message: 'Episodes must be an array',
        value: episodes,
        severity: 'error'
      });
    } else {
      issues.push({
        animeId,
        field: 'episodes',
        message: 'Episodes missing',
        value: episodes,
        severity: resolved.strict ? 'error' : 'warning'
      });
    }
  } else if (episodes.length === 0) {
    issues.push({
      animeId,
      field: 'episodes',
      message: 'No episode data present',
      value: episodes,
      severity: resolved.strict ? 'error' : 'warning'
    });
  } else {
    episodes.forEach((ep, index) => {
      if (!ep || typeof ep !== 'object') {
        issues.push({
          animeId,
          field: `episodes[${index}]`,
          message: 'Episode entry is not an object',
          value: ep,
          severity: 'error'
        });
        return;
      }
      if (!Number.isInteger(ep.episode)) {
        issues.push({
          animeId,
          field: `episodes[${index}].episode`,
          message: 'Episode number must be an integer',
          value: ep.episode,
          severity: 'error'
        });
      }
      if (!Number.isFinite(ep.score)) {
        issues.push({
          animeId,
          field: `episodes[${index}].score`,
          message: 'Episode score must be a number',
          value: ep.score,
          severity: 'error'
        });
      } else if (ep.score < 1 || ep.score > 5) {
        issues.push({
          animeId,
          field: `episodes[${index}].score`,
          message: 'Episode score must be between 1 and 5',
          value: ep.score,
          severity: 'error'
        });
      }
    });
    validateEpisodeSequence(episodes, animeId, issues, resolved);
  }

  const malId = anime?.metadata?.malId || anime?.mal_id || anime?.malId;
  if (malId !== undefined && malId !== null && !Number.isInteger(malId)) {
    issues.push({
      animeId,
      field: 'malId',
      message: 'malId should be an integer',
      value: malId,
      severity: resolved.strict ? 'error' : 'warning'
    });
  }

  const anilistId = anime?.metadata?.anilistId || anime?.anilistId;
  if (anilistId !== undefined && anilistId !== null && !Number.isInteger(anilistId)) {
    issues.push({
      animeId,
      field: 'anilistId',
      message: 'anilistId should be an integer',
      value: anilistId,
      severity: resolved.strict ? 'error' : 'warning'
    });
  }

  const schemaIssues = [];
  const animeSchema = loadSchema('anime.schema.json');
  if (animeSchema) {
    validateSchema(anime, animeSchema, {
      animeId,
      path: 'anime',
      issues: schemaIssues
    });
  }

  return [...issues, ...schemaIssues];
};

const validateCatalog = (animeList, options = {}) => {
  const resolved = { ...defaultOptions, ...options };
  const errors = [];
  const warnings = [];

  if (!Array.isArray(animeList)) {
    errors.push({
      animeId: 'catalog',
      field: 'anime',
      message: 'Anime list is not an array',
      value: typeof animeList,
      severity: 'error'
    });
    return { valid: false, errors, warnings };
  }

  animeList.forEach((anime, index) => {
    const issues = validateAnimeObject(anime, resolved);
    issues.forEach((issue) => {
      if (issue.severity === 'warning') warnings.push(issue);
      else errors.push(issue);
    });
  });

  const uniqueIssues = validateUniqueIds(animeList);
  uniqueIssues.forEach((issue) => errors.push(issue));

  const valid = errors.length === 0 && (!resolved.strict || warnings.length === 0);
  return { valid, errors, warnings };
};

export {
  validateSchema,
  validateAnimeObject,
  validateCatalog,
  validateEpisodeSequence,
  validateUniqueIds
};
