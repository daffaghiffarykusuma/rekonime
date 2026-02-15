import { execFileSync } from 'node:child_process';

const BLOCKED_PREFIXES = [
  'node_modules/',
  'dist/',
  'coverage/',
  'test-results/',
  'tools/scraper/__pycache__/'
];

const BLOCKED_SUBSTRINGS = [
  '.pyc',
  'data/anime.json.bak-'
];

const BLOCKED_EXACT = new Set([
  '.build-state.json'
]);

const runGitLsFiles = () => {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Unable to inspect tracked files:', error.message || error);
    process.exitCode = 1;
    return [];
  }
};

const isBlockedPath = (filePath) => {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (!normalized) return false;
  if (BLOCKED_EXACT.has(normalized)) {
    return true;
  }
  if (BLOCKED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  if (BLOCKED_SUBSTRINGS.some((marker) => normalized.includes(marker))) {
    return true;
  }
  return false;
};

const main = () => {
  const trackedFiles = runGitLsFiles();
  const blocked = trackedFiles.filter(isBlockedPath);
  if (!blocked.length) {
    console.log('Repository hygiene check passed.');
    return;
  }

  console.error('Repository hygiene check failed. Blocked tracked files found:');
  blocked.slice(0, 50).forEach((entry) => console.error(`- ${entry}`));
  if (blocked.length > 50) {
    console.error(`... ${blocked.length - 50} more`);
  }
  console.error('');
  console.error('Suggested fix:');
  console.error('1) Remove from tracking: git rm -r --cached node_modules dist coverage test-results tools/scraper/__pycache__');
  console.error('2) Remove tracked one-off artifacts: git rm --cached .build-state.json');
  console.error('3) Re-run: npm run -s check:repo-hygiene');
  process.exitCode = 1;
};

main();
