import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractEmbeddedData, validateEmbeddedAnimeShape } from './lib/embedded-data.js';
import { buildTrailerUrls } from '../js/security/trailer-url-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'anime.full.json');
const DEFAULT_EMBEDDED_PATH = path.join(__dirname, '..', 'js', 'data.js');
const DEFAULT_INDEX_PATH = path.join(__dirname, '..', 'index.html');
const DEFAULT_BASELINE_PATH = path.join(__dirname, 'validation-baseline.json');
const NON_TOLERATED_BASELINE_ERRORS = new Set(['duplicateIds']);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const parseEmbeddedDataScript = (embeddedPath) => {
  const source = fs.readFileSync(embeddedPath, 'utf8');
  return extractEmbeddedData(source);
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

const normalizeLabel = (value) => String(value || '').replace(/\\/g, '/');

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
  return { hasErrors, label, errors, warnings };
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
  baselinePath = DEFAULT_BASELINE_PATH,
  enforceBaseline = false,
  skipEmbedded = false,
  skipIndexCheck = false
} = {}) => {
  const results = [];
  const data = readJson(dataPath);
  results.push(validateList(data.anime || [], normalizeLabel(path.relative(process.cwd(), dataPath))));

  if (!skipEmbedded) {
    try {
      const embedded = parseEmbeddedDataScript(embeddedPath);
      const shape = validateEmbeddedAnimeShape(embedded, { sampleSize: 50 });
      if (!shape.valid) {
        console.log(`Validation results (${normalizeLabel(path.relative(process.cwd(), embeddedPath))})`);
        console.log('Errors:');
        console.log(`  invalidEmbeddedShape: ${shape.errors.length}`);
        console.log('Warnings:');
        console.log('  none\n');
        results.push({
          hasErrors: true,
          label: normalizeLabel(path.relative(process.cwd(), embeddedPath)),
          errors: { invalidEmbeddedShape: shape.errors.map((_, index) => index) },
          warnings: {}
        });
      } else {
        results.push(validateList(embedded.anime || [], normalizeLabel(path.relative(process.cwd(), embeddedPath))));
      }
    } catch (error) {
      console.log(`Validation results (${normalizeLabel(path.relative(process.cwd(), embeddedPath))})`);
      console.log('Errors:');
      console.log('  invalidEmbeddedData: 1');
      console.log('Warnings:');
      console.log(`  detail: ${error.message}\n`);
      results.push({
        hasErrors: true,
        label: normalizeLabel(path.relative(process.cwd(), embeddedPath)),
        errors: { invalidEmbeddedData: [1] },
        warnings: {}
      });
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
    results.push({
      hasErrors: index.hasErrors,
      label: normalizeLabel(path.relative(process.cwd(), indexPath)),
      errors: index.errors.reduce((acc, entry, indexPos) => ({ ...acc, [`indexError${indexPos + 1}`]: [entry] }), {}),
      warnings: index.warnings.reduce((acc, entry, indexPos) => ({ ...acc, [`indexWarning${indexPos + 1}`]: [entry] }), {})
    });
  }

  let baselineFailures = [];
  const baselineLabels = new Set();
  if (enforceBaseline) {
    if (!fs.existsSync(baselinePath)) {
      baselineFailures.push(`Missing baseline file: ${baselinePath}`);
    } else {
      const baseline = readJson(baselinePath);
      Object.keys(baseline || {}).forEach((label) => baselineLabels.add(String(label)));
      results.forEach((result) => {
        if (!result?.label) return;
        const baselineEntry = baseline?.[result.label];
        if (!baselineEntry) return;

        const compareGroup = (groupName, values = {}, expected = {}) => {
          const observedKeys = new Set([
            ...Object.keys(values || {}),
            ...Object.keys(expected || {})
          ]);
          observedKeys.forEach((key) => {
            const observed = Array.isArray(values[key]) ? values[key].length : 0;
            const limit = Number.isFinite(expected[key]) ? expected[key] : 0;
            if (observed > limit) {
              baselineFailures.push(
                `${result.label} ${groupName}.${key} exceeded baseline: ${observed} > ${limit}`
              );
            }
          });
        };

        compareGroup('errors', result.errors, baselineEntry.errors || {});
        compareGroup('warnings', result.warnings, baselineEntry.warnings || {});

        NON_TOLERATED_BASELINE_ERRORS.forEach((key) => {
          const allowed = Number(baselineEntry?.errors?.[key] ?? 0);
          const observed = Array.isArray(result?.errors?.[key]) ? result.errors[key].length : 0;
          if (allowed > 0) {
            baselineFailures.push(`${result.label} errors.${key} baseline allowance must be 0`);
          }
          if (observed > 0) {
            baselineFailures.push(`${result.label} errors.${key} must be 0 (observed ${observed})`);
          }
        });
      });
    }
  }

  if (baselineFailures.length) {
    console.log('Baseline regression check failed:');
    baselineFailures.forEach((entry) => console.log(`  - ${entry}`));
    console.log('');
  }

  const rawErrors = results.some((result) => {
    if (!result?.hasErrors) return false;
    if (!enforceBaseline) return true;
    if (!result.label) return true;
    return !baselineLabels.has(result.label);
  });

  const hasErrors = rawErrors || baselineFailures.length > 0;
  return { hasErrors, baselineFailures };
};

const main = () => {
  const { values, flags } = parseArgs(process.argv.slice(2));
  const result = runValidation({
    dataPath: values.data || DEFAULT_DATA_PATH,
    embeddedPath: values.embedded || DEFAULT_EMBEDDED_PATH,
    indexPath: values.index || DEFAULT_INDEX_PATH,
    baselinePath: values.baseline || DEFAULT_BASELINE_PATH,
    enforceBaseline: flags.has('enforce-baseline'),
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
