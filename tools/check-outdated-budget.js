import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'tools', 'outdated-exceptions.json');
const DIFF_RANK = { patch: 1, minor: 2, major: 3 };

const parseArgs = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config' && argv[index + 1]) {
      options.config = argv[index + 1];
      index += 1;
    }
  }
  return options;
};

const parseVersion = (raw) => {
  const value = String(raw || '').trim();
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
};

const getDiffLevel = (currentRaw, latestRaw) => {
  const current = parseVersion(currentRaw);
  const latest = parseVersion(latestRaw);
  if (!current || !latest) return 'major';
  if (latest.major > current.major) return 'major';
  if (latest.minor > current.minor) return 'minor';
  if (latest.patch > current.patch) return 'patch';
  return null;
};

const readConfig = (configPath) => {
  if (!fs.existsSync(configPath)) {
    return {
      budget: { major: 0, minor: 5, patch: 10 },
      allow: {}
    };
  }
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return {
    budget: parsed?.budget || { major: 0, minor: 5, patch: 10 },
    allow: parsed?.allow || {}
  };
};

const runOutdated = () => {
  const runCommand = () => {
    if (process.platform === 'win32') {
      return execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd outdated --json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    }
    return execFileSync('npm', ['outdated', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  };

  try {
    const output = runCommand();
    return output.trim() ? JSON.parse(output) : {};
  } catch (error) {
    const stdout = String(error?.stdout || '').trim();
    if (!stdout) {
      throw new Error(error?.message || 'Failed to run npm outdated');
    }
    try {
      return JSON.parse(stdout);
    } catch {
      throw new Error(`npm outdated returned non-JSON output:\n${stdout}`);
    }
  }
};

const entryAllowsDiff = (entry, diffLevel) => {
  if (!entry || !diffLevel) return false;
  const maxLevel = String(entry.maxLevel || '').toLowerCase();
  if (!DIFF_RANK[maxLevel]) return false;
  return DIFF_RANK[diffLevel] <= DIFF_RANK[maxLevel];
};

const isEntryExpired = (entry) => {
  const until = String(entry?.until || '').trim();
  if (!until) return false;
  const parsed = new Date(until);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return parsed.getTime() < now.getTime();
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config ? path.resolve(args.config) : DEFAULT_CONFIG_PATH;
  const config = readConfig(configPath);
  const outdated = runOutdated();

  const counts = { major: 0, minor: 0, patch: 0 };
  const violations = [];
  const expiredAllowances = [];

  Object.entries(outdated || {}).forEach(([pkgName, info]) => {
    const diff = getDiffLevel(info?.current, info?.latest);
    if (!diff) return;
    const allowEntry = config.allow?.[pkgName];
    if (allowEntry && isEntryExpired(allowEntry)) {
      expiredAllowances.push(`${pkgName} allowance expired on ${allowEntry.until}`);
    }
    if (entryAllowsDiff(allowEntry, diff)) {
      return;
    }
    counts[diff] += 1;
    violations.push(`${pkgName}: ${info?.current} -> ${info?.latest} (${diff})`);
  });

  const budget = {
    major: Number(config.budget?.major ?? 0),
    minor: Number(config.budget?.minor ?? 5),
    patch: Number(config.budget?.patch ?? 10)
  };

  const budgetFailures = Object.keys(counts)
    .filter((level) => counts[level] > budget[level])
    .map((level) => `${level} outdated count ${counts[level]} exceeds budget ${budget[level]}`);

  if (violations.length === 0 && expiredAllowances.length === 0) {
    console.log('Outdated dependency budget check passed.');
    return;
  }

  console.log('Outdated dependency summary:');
  console.log(`- major: ${counts.major}`);
  console.log(`- minor: ${counts.minor}`);
  console.log(`- patch: ${counts.patch}`);

  if (violations.length) {
    console.log('Outdated packages outside allowlist:');
    violations.forEach((entry) => console.log(`- ${entry}`));
  }
  if (expiredAllowances.length) {
    console.log('Expired outdated exceptions:');
    expiredAllowances.forEach((entry) => console.log(`- ${entry}`));
  }
  if (budgetFailures.length) {
    console.log('Budget failures:');
    budgetFailures.forEach((entry) => console.log(`- ${entry}`));
  }

  if (budgetFailures.length || expiredAllowances.length) {
    process.exitCode = 1;
    return;
  }

  console.log('Outdated dependency budget check passed (within configured budget).');
};

main();
