import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const DEFAULT_DATA_PATH = path.join(PROJECT_ROOT, 'data', 'anime.json');

const SEASONS = [
  { name: 'Winter', startMonth: 1 },
  { name: 'Spring', startMonth: 4 },
  { name: 'Summer', startMonth: 7 },
  { name: 'Fall', startMonth: 10 }
];

const REFRESH_PASS_THROUGH_ARGS = new Set([
  '--save-interval',
  '--mal-delay-ms',
  '--jikan-delay-ms',
  '--concurrency',
  '--limit',
  '--start-index'
]);

const parseArgs = (argv) => {
  const options = {
    dataPath: DEFAULT_DATA_PATH,
    date: new Date(),
    dryRun: false,
    skipBuild: false,
    refreshArgs: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    const hasValue = next && !next.startsWith('--');

    if (arg === '--data' && hasValue) {
      options.dataPath = path.resolve(process.cwd(), next);
      i += 1;
    } else if (arg === '--date' && hasValue) {
      const parsed = new Date(`${next}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        options.date = parsed;
      }
      i += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-build') {
      options.skipBuild = true;
    } else if (REFRESH_PASS_THROUGH_ARGS.has(arg) && hasValue) {
      options.refreshArgs.push(arg, next);
      i += 1;
    }
  }

  return options;
};

const getSeasonForDate = (date) => {
  const month = date.getMonth() + 1;
  let seasonIndex = 0;

  for (let index = 0; index < SEASONS.length; index += 1) {
    if (month >= SEASONS[index].startMonth) {
      seasonIndex = index;
    }
  }

  return {
    season: SEASONS[seasonIndex].name,
    year: date.getFullYear(),
    index: seasonIndex
  };
};

const getPreviousSeason = ({ index, year }) => {
  const previousIndex = index === 0 ? SEASONS.length - 1 : index - 1;
  return {
    season: SEASONS[previousIndex].name,
    year: index === 0 ? year - 1 : year
  };
};

const getMalId = (anime) => (
  anime?.mal_id ??
  anime?.malId ??
  anime?.metadata?.malId ??
  anime?.metadata?.mal_id
);

const getSeason = (anime) => anime?.metadata?.season ?? anime?.season;
const getYear = (anime) => anime?.metadata?.year ?? anime?.year;
const getTitle = (anime) => anime?.metadata?.title ?? anime?.title ?? anime?.id ?? 'Untitled';

const seasonKey = ({ season, year }) => `${season} ${year}`;

const collectTargets = (animeList, seasons) => {
  const seasonKeys = new Set(seasons.map(seasonKey));
  const seenMalIds = new Set();
  const targets = [];
  const skippedWithoutMal = [];

  for (const anime of animeList) {
    const currentKey = `${getSeason(anime)} ${Number(getYear(anime))}`;
    if (!seasonKeys.has(currentKey)) continue;

    const malId = Number(getMalId(anime));
    if (!Number.isInteger(malId) || malId <= 0) {
      skippedWithoutMal.push({
        title: getTitle(anime),
        seasonYear: currentKey
      });
      continue;
    }

    if (seenMalIds.has(malId)) continue;
    seenMalIds.add(malId);
    targets.push({
      malId,
      title: getTitle(anime),
      seasonYear: currentKey
    });
  }

  return { targets, skippedWithoutMal };
};

const runCommand = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
  });
});

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.dataPath)) {
    throw new Error(`Data file not found: ${options.dataPath}`);
  }

  const root = JSON.parse(fs.readFileSync(options.dataPath, 'utf8'));
  const animeList = Array.isArray(root?.anime) ? root.anime : [];
  const currentSeason = getSeasonForDate(options.date);
  const previousSeason = getPreviousSeason(currentSeason);
  const seasons = [
    { season: currentSeason.season, year: currentSeason.year },
    previousSeason
  ];

  const { targets, skippedWithoutMal } = collectTargets(animeList, seasons);
  const malIds = targets.map((target) => target.malId);

  console.log('Season score refresh');
  console.log('====================');
  console.log(`Data: ${path.relative(PROJECT_ROOT, options.dataPath)}`);
  console.log(`Seasons: ${seasons.map(seasonKey).join(', ')}`);
  console.log(`Targets with MAL IDs: ${targets.length}`);

  const bySeason = new Map();
  for (const target of targets) {
    bySeason.set(target.seasonYear, (bySeason.get(target.seasonYear) || 0) + 1);
  }
  for (const targetSeason of seasons.map(seasonKey)) {
    console.log(`  ${targetSeason}: ${bySeason.get(targetSeason) || 0}`);
  }

  if (skippedWithoutMal.length > 0) {
    console.log(`Skipped without MAL ID: ${skippedWithoutMal.length}`);
    for (const item of skippedWithoutMal.slice(0, 10)) {
      console.log(`  - ${item.title} (${item.seasonYear})`);
    }
    if (skippedWithoutMal.length > 10) {
      console.log(`  ...and ${skippedWithoutMal.length - 10} more`);
    }
  }

  if (options.dryRun) {
    console.log('\nDry run only. No scores refreshed.');
    return;
  }

  if (malIds.length === 0) {
    console.log('\nNo matching seasonal anime with MAL IDs found.');
    return;
  }

  await runCommand('node', [
    path.join('tools', 'refresh-scores.js'),
    '--data',
    path.relative(PROJECT_ROOT, options.dataPath),
    '--mal-ids',
    malIds.join(','),
    ...options.refreshArgs
  ]);

  if (!options.skipBuild) {
    console.log('\nRebuilding catalog outputs so finish-rate stats reflect refreshed episodes...');
    await runCommand('bun', [path.join('tools', 'run-python.js'), path.join('tools', 'build_catalogs.py')]);
  }
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
