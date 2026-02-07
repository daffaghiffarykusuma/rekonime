import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractEmbeddedData, validateEmbeddedAnimeShape } from './lib/embedded-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'anime.full.json');
const DEFAULT_EMBEDDED_PATH = path.join(__dirname, '..', 'js', 'data.js');
const DEFAULT_INDEX_PATH = path.join(__dirname, '..', 'index.html');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const parseEmbeddedDataScript = (embeddedPath) => {
  const source = fs.readFileSync(embeddedPath, 'utf8');
  return extractEmbeddedData(source);
};

const sanitizeTrailerUrl = (rawUrl) => {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('youtube.com') && !host.includes('youtu.be')) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const sanitizeTrailerEmbedUrl = (rawUrl) => {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('youtube.com') && !host.includes('youtube-nocookie.com')) return '';
    parsed.searchParams.delete('autoplay');
    return parsed.toString();
  } catch {
    return '';
  }
};

const buildTrailerUrls = (trailer) => {
  if (!trailer || typeof trailer !== 'object') {
    return { url: '', embedUrl: '' };
  }

  const id = trailer.id;
  let url = trailer.url || '';
  let embedUrl = trailer.embedUrl || trailer.embed_url || '';

  if (!url && id) {
    url = `https://www.youtube.com/watch?v=${id}`;
  }

  if (!embedUrl && id) {
    embedUrl = `https://www.youtube.com/embed/${id}`;
  }

  return {
    url: sanitizeTrailerUrl(url),
    embedUrl: sanitizeTrailerEmbedUrl(embedUrl)
  };
};

const normalizeId = (anime) => {
  const meta = anime.metadata || {};
  return meta.id || anime.id || '';
};

const normalizeTitle = (anime) => {
  const meta = anime.metadata || {};
  return meta.title || anime.title || '';
};

const normalizeScore = (anime) => {
  const meta = anime.metadata || {};
  if (Object.prototype.hasOwnProperty.call(meta, 'score')) return meta.score;
  return anime.score;
};

const normalizeAniListId = (anime) => {
  const meta = anime.metadata || {};
  if (Object.prototype.hasOwnProperty.call(meta, 'anilistId')) return meta.anilistId;
  return anime.anilistId;
};

const normalizeTrailer = (anime) => {
  const meta = anime.metadata || {};
  return meta.trailer || anime.trailer || null;
};

const summarize = (title, groups) => {
  const lines = [];
  Object.entries(groups).forEach(([key, values]) => {
    if (!values.length) return;
    lines.push(`  ${key}: ${values.length}`);
  });
  if (!lines.length) {
    lines.push('  none');
  }
  return [`${title}:`, ...lines].join('\n');
};

const validateList = (animeList, label) => {
  const errors = {
    missingId: [],
    missingTitle: [],
    missingCover: [],
    missingScore: [],
    missingTrailer: [],
    invalidTrailer: [],
    invalidEpisodeScore: [],
    missingEpisodeScore: [],
    missingEpisodeNumber: [],
    duplicateIds: []
  };

  const warnings = {
    missingYear: [],
    missingSeason: [],
    missingStudio: [],
    missingSource: [],
    missingAnilistId: [],
    missingEpisodes: []
  };

  const idMap = new Map();

  animeList.forEach((anime, index) => {
    const meta = anime.metadata || {};
    const id = normalizeId(anime);
    const title = normalizeTitle(anime);
    const cover = meta.cover || anime.cover;
    const year = meta.year || anime.year;
    const season = meta.season || anime.season;
    const studio = meta.studio || anime.studio;
    const source = meta.source || anime.source;
    const score = normalizeScore(anime);
    const anilistId = normalizeAniListId(anime);
    const trailer = normalizeTrailer(anime);
    const episodes = anime.episodes || [];

    if (!id) {
      errors.missingId.push(index + 1);
    } else if (idMap.has(id)) {
      errors.duplicateIds.push(id);
    } else {
      idMap.set(id, true);
    }

    if (!title) errors.missingTitle.push(id || index + 1);
    if (!cover) errors.missingCover.push(id || index + 1);
    if (!Number.isFinite(Number(score))) errors.missingScore.push(id || index + 1);

    if (!year) warnings.missingYear.push(id || index + 1);
    if (!season) warnings.missingSeason.push(id || index + 1);
    if (!studio) warnings.missingStudio.push(id || index + 1);
    if (!source) warnings.missingSource.push(id || index + 1);
    if (!anilistId) warnings.missingAnilistId.push(id || index + 1);

    if (!Array.isArray(episodes) || episodes.length === 0) {
      warnings.missingEpisodes.push(id || index + 1);
    } else {
      episodes.forEach((ep) => {
        if (!ep || typeof ep !== 'object') return;
        if (ep.episode === undefined || ep.episode === null) {
          errors.missingEpisodeNumber.push(id || index + 1);
        }
        if (ep.score === undefined || ep.score === null) {
          errors.missingEpisodeScore.push(id || index + 1);
        } else if (!Number.isFinite(Number(ep.score)) || ep.score < 1 || ep.score > 5) {
          errors.invalidEpisodeScore.push(id || index + 1);
        }
      });
    }

    if (!trailer) {
      errors.missingTrailer.push(id || index + 1);
    } else {
      const { url, embedUrl } = buildTrailerUrls(trailer);
      if (!url && !embedUrl) {
        errors.missingTrailer.push(id || index + 1);
      } else if (!url || !embedUrl) {
        errors.invalidTrailer.push(id || index + 1);
      }
    }
  });

  const hasErrors = Object.values(errors).some((values) => values.length > 0);
  console.log(`Validation results (${label})`);
  console.log(summarize('Errors', errors));
  console.log(summarize('Warnings', warnings));
  console.log('');
  return { hasErrors, errors, warnings };
};

const validateIndexReferences = (indexPath) => {
  if (!fs.existsSync(indexPath)) {
    return { hasErrors: false, errors: [], warnings: [`Missing index file: ${indexPath}`] };
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  const errors = [];
  const warnings = [];

  if (/const\s+ANIME_DATA\s*=/.test(html)) {
    errors.push('index.html still contains inline ANIME_DATA payload');
  }
  if (!/src=["']\/js\/main\.js["']/.test(html)) {
    warnings.push('index.html does not reference /js/main.js');
  }

  return { hasErrors: errors.length > 0, errors, warnings };
};

const parseArgs = (args) => {
  const values = {};
  const flags = new Set();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.replace(/^--/, '').split('=');
    if (inlineValue !== undefined) {
      values[key] = inlineValue;
      continue;
    }
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      values[key] = next;
      index += 1;
    } else {
      flags.add(key);
    }
  }

  return { values, flags };
};

const runValidation = ({
  dataPath = DEFAULT_DATA_PATH,
  embeddedPath = DEFAULT_EMBEDDED_PATH,
  indexPath = DEFAULT_INDEX_PATH,
  skipEmbedded = false,
  skipIndexCheck = false
} = {}) => {
  const results = [];
  const data = readJson(dataPath);
  results.push(validateList(data.anime || [], path.relative(process.cwd(), dataPath)));

  if (!skipEmbedded) {
    try {
      const embedded = parseEmbeddedDataScript(embeddedPath);
      const shape = validateEmbeddedAnimeShape(embedded, { sampleSize: 50 });
      if (!shape.valid) {
        console.log(`Validation results (${path.relative(process.cwd(), embeddedPath)})`);
        console.log('Errors:');
        console.log(`  invalidEmbeddedShape: ${shape.errors.length}`);
        console.log('Warnings:');
        console.log('  none\n');
        results.push({ hasErrors: true });
      } else {
        results.push(validateList(embedded.anime || [], path.relative(process.cwd(), embeddedPath)));
      }
    } catch (error) {
      console.log(`Validation results (${path.relative(process.cwd(), embeddedPath)})`);
      console.log('Errors:');
      console.log('  invalidEmbeddedData: 1');
      console.log('Warnings:');
      console.log(`  detail: ${error.message}\n`);
      results.push({ hasErrors: true });
    }
  }

  if (!skipIndexCheck) {
    const index = validateIndexReferences(indexPath);
    console.log(`Index reference check (${path.relative(process.cwd(), indexPath)})`);
    if (index.errors.length) {
      console.log('Errors:');
      index.errors.forEach((error) => console.log(`  - ${error}`));
    } else {
      console.log('Errors:\n  none');
    }
    if (index.warnings.length) {
      console.log('Warnings:');
      index.warnings.forEach((warning) => console.log(`  - ${warning}`));
    } else {
      console.log('Warnings:\n  none');
    }
    console.log('');
    results.push({ hasErrors: index.hasErrors });
  }

  const hasErrors = results.some((result) => result.hasErrors);
  return { hasErrors };
};

const main = () => {
  const { values, flags } = parseArgs(process.argv.slice(2));
  const result = runValidation({
    dataPath: values.data || DEFAULT_DATA_PATH,
    embeddedPath: values.embedded || DEFAULT_EMBEDDED_PATH,
    indexPath: values.index || DEFAULT_INDEX_PATH,
    skipEmbedded: flags.has('skip-embedded'),
    skipIndexCheck: flags.has('skip-index-check')
  });
  if (result.hasErrors) {
    process.exitCode = 1;
  }
};

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main();
}

export {
  parseEmbeddedDataScript,
  runValidation,
  validateIndexReferences,
  validateList
};
