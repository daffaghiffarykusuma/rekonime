import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const copyRecursive = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
};

const detailFileName = (animeId) => `${encodeURIComponent(String(animeId))}.json`;

const toRuntimeStatsSummary = (stats = {}) => ({
  average: stats.average,
  stdDev: stats.stdDev,
  scoreClass: stats.scoreClass,
  episodeCount: stats.episodeCount,
  retentionScore: stats.retentionScore,
  threeEpisodeHook: stats.threeEpisodeHook,
  worthFinishing: stats.worthFinishing,
  flowState: stats.flowState,
  comfortScore: stats.comfortScore,
  controversyPotential: stats.controversyPotential,
  reliabilityScore: stats.reliabilityScore,
  sessionSafety: stats.sessionSafety,
  churnRisk: stats.churnRisk && Number.isFinite(stats.churnRisk.score)
    ? { score: stats.churnRisk.score, label: stats.churnRisk.label }
    : stats.churnRisk,
  slowBurn: stats.slowBurn && Number.isFinite(stats.slowBurn.signal)
    ? { signal: stats.slowBurn.signal, isActive: Boolean(stats.slowBurn.isActive) }
    : stats.slowBurn
});

const toFullIndexAnime = (anime) => ({
  id: anime.id,
  title: anime.title,
  titleEnglish: anime.titleEnglish,
  titleJapanese: anime.titleJapanese,
  malId: anime.malId,
  anilistId: anime.anilistId,
  cover: anime.cover,
  type: anime.type,
  year: anime.year,
  season: anime.season,
  studio: anime.studio,
  source: anime.source,
  genres: Array.isArray(anime.genres) ? anime.genres : [],
  themes: Array.isArray(anime.themes) ? anime.themes : [],
  demographic: anime.demographic,
  communityScore: anime.communityScore,
  episodeCount: anime.episodeCount,
  searchText: anime.searchText,
  stats: toRuntimeStatsSummary(anime.stats),
  colorIndex: anime.colorIndex,
  detailPath: `data/anime.detail/${detailFileName(anime.id)}`
});

const toAnimeDetailChunk = (anime) => ({
  id: anime.id,
  title: anime.title,
  trailer: anime.trailer,
  synopsis: anime.synopsis,
  episodes: Array.isArray(anime.episodes) ? anime.episodes : [],
  stats: anime.stats,
  franchise: anime.franchise || null
});

const copyChunkedFullData = () => {
  const sourcePath = path.join(root, 'data', 'anime.full.json');
  const detailDir = path.join(dist, 'data', 'anime.detail');
  const indexPath = path.join(dist, 'data', 'anime.full.index.json');
  if (!fs.existsSync(sourcePath)) return;

  const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const animeList = Array.isArray(payload.anime) ? payload.anime : [];
  fs.rmSync(detailDir, { recursive: true, force: true });
  fs.mkdirSync(detailDir, { recursive: true });

  animeList.forEach((anime) => {
    if (!anime?.id) return;
    const outputPath = path.join(detailDir, detailFileName(anime.id));
    fs.writeFileSync(outputPath, JSON.stringify({
      generatedAt: payload.generatedAt,
      scoreProfile: payload.scoreProfile,
      anime: [toAnimeDetailChunk(anime)]
    }), 'utf8');
  });

  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify({
    generatedAt: payload.generatedAt,
    scoreProfile: payload.scoreProfile,
    anime: animeList.map(toFullIndexAnime)
  }), 'utf8');
};

const copyRuntimeData = () => {
  const runtimeDataFiles = [
    'franchise-map.json'
  ];

  runtimeDataFiles.forEach((fileName) => {
    copyRecursive(path.join(root, 'data', fileName), path.join(dist, 'data', fileName));
  });
  copyChunkedFullData();
};

const readBuildVersion = () => {
  const versionPath = path.join(dist, 'version.json');
  if (!fs.existsSync(versionPath)) return 'dev';
  try {
    const payload = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    return String(payload?.version || 'dev');
  } catch {
    return 'dev';
  }
};

const copyServiceWorker = () => {
  const swSourcePath = path.join(root, 'sw.js');
  if (!fs.existsSync(swSourcePath)) return;
  const cacheVersion = readBuildVersion();
  const source = fs.readFileSync(swSourcePath, 'utf8');
  const stamped = source.replace(/__REKONIME_CACHE_VERSION__/g, cacheVersion);
  const outputPath = path.join(dist, 'sw.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, stamped, 'utf8');
};

const stripInjectedStylesheetLinks = () => {
  const htmlFiles = ['index.html', 'watchlist.html'];
  const injectedStylesheetPattern = /\s*<link\s+rel="stylesheet"\s+crossorigin\s+href="\/css\/watchlist2\.css">\r?\n?/g;

  htmlFiles.forEach((fileName) => {
    const filePath = path.join(dist, fileName);
    if (!fs.existsSync(filePath)) return;
    const source = fs.readFileSync(filePath, 'utf8');
    const next = source.replace(injectedStylesheetPattern, '\n');
    if (next !== source) {
      fs.writeFileSync(filePath, next, 'utf8');
    }
  });
};

const inlineWatchlistStyles = () => {
  const filePath = path.join(dist, 'watchlist.html');
  if (!fs.existsSync(filePath)) return;

  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes('id="watchlist-critical-styles"')) return;

  const styleAssets = [
    { href: '/css/preload-helper.css', filePath: path.join(dist, 'css', 'preload-helper.css') },
    { href: '/css/watchlist.css', filePath: path.join(dist, 'css', 'watchlist.css') }
  ];
  if (styleAssets.some((asset) => !fs.existsSync(asset.filePath))) return;

  let next = source;
  styleAssets.forEach((asset) => {
    const escapedHref = asset.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkPattern = new RegExp(`\\s*<link\\s+rel="stylesheet"\\s+crossorigin\\s+href="${escapedHref}">\\r?\\n?`, 'g');
    next = next.replace(linkPattern, '\n');
  });

  const css = styleAssets
    .map((asset) => fs.readFileSync(asset.filePath, 'utf8'))
    .join('\n');
  next = next.replace(
    '</head>',
    `  <style id="watchlist-critical-styles">${css}</style>\n</head>`
  );
  fs.writeFileSync(filePath, next, 'utf8');
};

const injectCatalogStartupHints = () => {
  const filePath = path.join(dist, 'index.html');
  if (!fs.existsSync(filePath)) return;
  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes('href="/js/app.js"') && source.includes('href="/data/anime.full.index.json"')) return;

  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const hints = [
    source.includes('href="/js/app.js"') ? '' : `${newline}  <link rel="modulepreload" href="/js/app.js">`,
    source.includes('href="/data/anime.full.index.json"') ? '' : `${newline}  <link rel="preload" href="/data/anime.full.index.json" as="fetch" crossorigin>`
  ].join('');
  const next = source.replace(
    '  <link rel="dns-prefetch" href="https://graphql.anilist.co">',
    `  <link rel="dns-prefetch" href="https://graphql.anilist.co">${hints}`
  );
  if (next !== source) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
};

copyRuntimeData();
copyRecursive(path.join(root, 'js', 'data.js'), path.join(dist, 'js', 'data.js'));
copyRecursive(path.join(root, 'js', 'sw-cache-policy.js'), path.join(dist, 'js', 'sw-cache-policy.js'));
copyRecursive(path.join(root, 'js', 'bootstrap'), path.join(dist, 'js', 'bootstrap'));
copyRecursive(path.join(root, 'health.html'), path.join(dist, 'health.html'));
copyServiceWorker();
stripInjectedStylesheetLinks();
inlineWatchlistStyles();
injectCatalogStartupHints();
