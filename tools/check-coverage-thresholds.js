import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SUMMARY_PATH = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

const THRESHOLDS = {
  'js/app.js': { lines: 20, branches: 30 },
  'js/reviews.js': { lines: 45, branches: 35 },
  'tools/lib/schema-validator.js': { lines: 55, branches: 50 }
};

const ensureCoverageSummary = () => {
  if (fs.existsSync(SUMMARY_PATH)) {
    return;
  }

  const command = process.platform === 'win32'
    ? { file: 'cmd.exe', args: ['/d', '/s', '/c', 'npm.cmd run test:coverage'] }
    : { file: 'npm', args: ['run', 'test:coverage'] };

  const result = spawnSync(command.file, command.args, {
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  if (result.status !== 0 || !fs.existsSync(SUMMARY_PATH)) {
    throw new Error(`Missing coverage summary at ${SUMMARY_PATH}. Failed to generate it via test:coverage.`);
  }
};

const readSummary = () => {
  ensureCoverageSummary();
  return JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
};

const value = (entry, key) => Number(entry?.[key]?.pct || 0);

const normalizePath = (filePath) => {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const cwdNormalized = process.cwd().replace(/\\/g, '/');
  if (normalized.startsWith(`${cwdNormalized}/`)) {
    return normalized.slice(cwdNormalized.length + 1);
  }
  return normalized.replace(/^\.\/+/, '');
};

const main = () => {
  let summary;
  try {
    summary = readSummary();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
    return;
  }

  const index = new Map();
  Object.entries(summary).forEach(([rawKey, entry]) => {
    if (rawKey === 'total') return;
    index.set(normalizePath(rawKey), entry);
  });

  const failures = [];
  Object.entries(THRESHOLDS).forEach(([filePath, threshold]) => {
    const entry = index.get(normalizePath(filePath));
    if (!entry) {
      failures.push(`${filePath}: missing from coverage summary`);
      return;
    }
    const lines = value(entry, 'lines');
    const branches = value(entry, 'branches');
    if (lines < threshold.lines) {
      failures.push(`${filePath}: lines ${lines.toFixed(2)} < ${threshold.lines}`);
    }
    if (branches < threshold.branches) {
      failures.push(`${filePath}: branches ${branches.toFixed(2)} < ${threshold.branches}`);
    }
  });

  if (failures.length) {
    console.error('Coverage threshold check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log('Coverage threshold check passed.');
};

main();
