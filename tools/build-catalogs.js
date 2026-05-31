import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Stats, StatsCalculationError as StatsCoreError } from '../js/stats.ts';
import { validateCatalog } from './lib/schema-validator.js';
import { checkReferentialIntegrity } from './lib/integrity-checker.js';
import { BuildState } from './lib/build-state.js';
import { buildQualityReport, runQualityGates } from './lib/quality-reporter.js';
import {
  ValidationError,
  DataIntegrityError,
  StatsCalculationError,
  BuildError
} from './lib/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = path.join(__dirname, '..', 'data', 'anime.json');
const DEFAULT_FULL_OUTPUT = path.join(__dirname, '..', 'data', 'anime.full.json');
const DEFAULT_PREVIEW_OUTPUT = path.join(__dirname, '..', 'data', 'anime.preview.json');
const DEFAULT_REPORT_OUTPUT = path.join(__dirname, '..', 'data', 'build-report.json');
const DEFAULT_BUILD_STATE = path.join(__dirname, '..', '.build-state.json');
const DEFAULT_FRANCHISE_MAP = path.join(__dirname, '..', 'data', 'franchise-map.json');

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

const normalizeEpisodeCount = (anime) => {
  const candidates = [
    anime?.episodeCount,
    anime?.episodesCount,
    anime?.episodes_count,
    anime?.metadata?.episodeCount,
    anime?.metadata?.episodesCount,
    anime?.metadata?.episodes_count
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
};

const writeJsonAtomic = (filePath, payload) => {
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tempPath, JSON.stringify(payload));
  fs.renameSync(tempPath, filePath);
};

const resolveUniqueAnimeIds = (animeList) => {
  const seen = new Map();
  const collisions = [];

  const nextUniqueId = (baseId, anime, index) => {
    const malId = Number(anime?.malId);
    if (Number.isInteger(malId) && malId > 0) {
      const candidate = `${baseId}-${malId}`;
      if (!seen.has(candidate)) {
        return candidate;
      }
    }

    const year = Number(anime?.year);
    if (Number.isInteger(year) && year > 0) {
      const candidate = `${baseId}-${year}`;
      if (!seen.has(candidate)) {
        return candidate;
      }
    }

    let counter = Math.max(2, (seen.get(baseId) || 1) + 1);
    let candidate = `${baseId}-dup-${counter}`;
    while (seen.has(candidate)) {
      counter += 1;
      candidate = `${baseId}-dup-${counter}`;
    }
    return candidate;
  };

  const items = animeList.map((anime, index) => {
    const baseId = String(anime?.id || '').trim() || `anime-${index + 1}`;
    if (!seen.has(baseId)) {
      seen.set(baseId, 1);
      return { ...anime, id: baseId };
    }

    const uniqueId = nextUniqueId(baseId, anime, index);
    seen.set(baseId, (seen.get(baseId) || 1) + 1);
    seen.set(uniqueId, 1);
    collisions.push({
      previousId: baseId,
      nextId: uniqueId,
      animeId: anime?.id || baseId,
      title: anime?.title || `index-${index}`
    });
    return { ...anime, id: uniqueId };
  });

  return { items, collisions };
};

const normalizeAnime = (anime, resolveFranchise = () => null) => {
  const normalizedGenres = sanitizeTagList(anime?.metadata?.genres || anime?.genres || []);
  const normalizedThemes = sanitizeTagList(anime?.metadata?.themes || anime?.themes || []);
  const normalizedTrailer = anime?.metadata?.trailer || anime?.trailer || null;
  const normalizedSynopsis = anime?.metadata?.synopsis || anime?.synopsis || '';
  const candidateId = String(anime?.metadata?.id || anime?.id || '').trim();
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
  const episodeCount = normalizeEpisodeCount(anime);
  const franchise = candidateId ? resolveFranchise(candidateId) : null;

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
      ...(episodeCount ? { episodeCount } : {}),
      searchText: anime.searchText || buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
      episodes: Array.isArray(anime.episodes) ? anime.episodes : [],
      ...(franchise ? { franchise } : {})
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
    ...(episodeCount ? { episodeCount } : {}),
    searchText: anime.searchText || buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
    episodes: Array.isArray(anime.episodes) ? anime.episodes : [],
    ...(franchise ? { franchise } : {})
  };
};

const byNumberDesc = (a, b) => (Number.isFinite(b) ? b : 0) - (Number.isFinite(a) ? a : 0);

const parseArgs = (args) => {
  const flags = new Set();
  const values = {};
  const positional = [];
  const valueFlags = new Set(['state', 'report-path', 'franchise-map']);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.replace(/^--/, '').split('=');
    if (valueFlags.has(rawKey)) {
      if (inlineValue !== undefined) {
        values[rawKey] = inlineValue;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        values[rawKey] = args[i + 1];
        i += 1;
      } else {
        values[rawKey] = '';
      }
      continue;
    }

    flags.add(rawKey);
  }

  return { flags, values, positional };
};

const formatIssue = (issue) => {
  const id = issue.animeId ? `(${issue.animeId})` : '';
  return `${issue.field || 'unknown'} ${id}: ${issue.message}`;
};

const logIssues = (label, issues, { warnOnly = false } = {}) => {
  if (!issues.length) return;
  const logger = warnOnly ? console.warn : console.error;
  logger(`${label}: ${issues.length}`);
  issues.slice(0, 15).forEach((issue) => {
    logger(`  - ${formatIssue(issue)}`);
  });
  if (issues.length > 15) {
    logger(`  ... ${issues.length - 15} more`);
  }
};

const main = () => {
  const startedAt = Date.now();
  const { flags, values, positional } = parseArgs(process.argv.slice(2));
  const strict = !flags.has('no-strict');
  const incremental = flags.has('incremental');
  const force = flags.has('force');
  const emitReport = flags.has('report');

  if (!strict) {
    console.warn('Running catalog build in non-strict mode (--no-strict). Use only for local experimentation.');
  }

  const inputPath = positional[0] || DEFAULT_INPUT;
  const fullOutputPath = positional[1] || DEFAULT_FULL_OUTPUT;
  const previewOutputPath = positional[2] || DEFAULT_PREVIEW_OUTPUT;
  const reportOutputPath = values['report-path'] || DEFAULT_REPORT_OUTPUT;
  const stateFile = values.state || DEFAULT_BUILD_STATE;
  const franchiseMapPath = values['franchise-map'] || DEFAULT_FRANCHISE_MAP;

  const buildState = new BuildState({ stateFile });
  const dependencies = [
    inputPath,
    __filename,
    path.join(__dirname, '..', 'js', 'stats.js'),
    path.join(__dirname, 'lib', 'schema-validator.js'),
    path.join(__dirname, 'lib', 'integrity-checker.js'),
    path.join(__dirname, 'lib', 'quality-reporter.js'),
    franchiseMapPath
  ];

  const outputsMissing = [fullOutputPath, previewOutputPath].some((filePath) => !fs.existsSync(filePath));
  const depsChanged = dependencies.some((dep) => buildState.hasChanged(dep));

  if (incremental && !force && !outputsMissing && !depsChanged) {
    console.log('No changes detected, skipping build.');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const animeList = Array.isArray(raw.anime) ? raw.anime : [];
  const franchisePayload = fs.existsSync(franchiseMapPath)
    ? JSON.parse(fs.readFileSync(franchiseMapPath, 'utf8'))
    : {};
  const franchiseByAnimeId = franchisePayload?.byAnimeId && typeof franchisePayload.byAnimeId === 'object'
    ? franchisePayload.byAnimeId
    : {};
  const franchises = franchisePayload?.franchises && typeof franchisePayload.franchises === 'object'
    ? franchisePayload.franchises
    : {};
  const resolveFranchise = (animeId) => {
    const direct = franchiseByAnimeId[animeId];
    if (!direct) return null;
    if (typeof direct === 'string') {
      return franchises[direct] || null;
    }
    if (typeof direct === 'object') {
      return direct;
    }
    return null;
  };

  const validation = validateCatalog(animeList, { strict, allowDuplicateIds: true });
  logIssues('Validation errors', validation.errors);
  logIssues('Validation warnings', validation.warnings, { warnOnly: true });

  if (validation.errors.length && strict) {
    throw new ValidationError('Build failed due to validation errors', {
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length
    });
  }

  const normalized = animeList.map(anime => normalizeAnime(anime, resolveFranchise));
  const { items: normalizedWithUniqueIds, collisions: idCollisions } = resolveUniqueAnimeIds(normalized);
  logIssues('Resolved duplicate ids', idCollisions.map((entry) => ({
    field: 'id',
    animeId: entry.previousId,
    message: `${entry.title} -> ${entry.nextId}`
  })), { warnOnly: true });

  const integrityIssues = checkReferentialIntegrity(normalizedWithUniqueIds);
  const integrityErrors = integrityIssues.filter(issue => issue.severity === 'error');
  const integrityWarnings = integrityIssues.filter(issue => issue.severity !== 'error');

  logIssues('Integrity errors', integrityErrors);
  logIssues('Integrity warnings', integrityWarnings, { warnOnly: true });

  if (integrityErrors.length && strict) {
    throw new DataIntegrityError('Build failed due to integrity errors', {
      errorCount: integrityErrors.length
    });
  }

  const scoreProfile = Stats.buildScoreProfile(normalizedWithUniqueIds);

  const fullCatalog = normalizedWithUniqueIds.map((anime, index) => {
    try {
      return {
        ...anime,
        stats: Stats.calculateAllStats(anime, scoreProfile, { strict }),
        colorIndex: index
      };
    } catch (error) {
      if (error instanceof StatsCoreError || error?.name === 'StatsCalculationError') {
        throw new StatsCalculationError('Stats calculation failed', {
          animeId: anime?.id || anime?.metadata?.id || `index-${index}`
        }, { cause: error });
      }
      throw error;
    }
  });

  const withEpisodes = fullCatalog.filter(anime => Array.isArray(anime.episodes) && anime.episodes.length > 0);
  const byRetention = [...withEpisodes]
    .sort((a, b) => byNumberDesc(a.stats?.retentionScore, b.stats?.retentionScore))
    .slice(0, PREVIEW_BUCKET);
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

  writeJsonAtomic(fullOutputPath, fullPayload);
  writeJsonAtomic(previewOutputPath, previewPayload);

  const durationMs = Date.now() - startedAt;
  const report = buildQualityReport({
    anime: fullCatalog,
    validation,
    integrityIssues,
    scoreProfile,
    durationMs
  });

  const gateResults = runQualityGates(report, { strict });
  if (gateResults.length) {
    gateResults.forEach((gate) => {
      const logger = gate.severity === 'error' ? console.error : console.warn;
      logger(`Quality gate ${gate.name}: ${gate.message}`);
    });
  }

  const failingGates = gateResults.filter(gate => gate.severity === 'error');
  if (failingGates.length) {
    throw new BuildError('Build failed due to quality gates', { gates: failingGates });
  }

  if (emitReport) {
    writeJsonAtomic(reportOutputPath, report);
    console.log(`Wrote quality report to ${reportOutputPath}`);
  }

  buildState.updateFile(inputPath);
  dependencies
    .filter(dep => dep !== inputPath)
    .forEach(dep => buildState.updateFile(dep));
  buildState.updateFile(fullOutputPath);
  buildState.updateFile(previewOutputPath);
  buildState.markBuildComplete();

  console.log(`Wrote ${fullCatalog.length} entries to ${fullOutputPath}`);
  console.log(`Wrote ${previewCatalog.length} entries to ${previewOutputPath}`);
};

try {
  main();
} catch (error) {
  if (error instanceof BuildError || error instanceof ValidationError || error instanceof DataIntegrityError) {
    console.error(error.message);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  } else {
    console.error('Build failed unexpectedly:', error);
  }
  process.exitCode = 1;
}
