import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hooksDir = path.join(root, '.githooks');

const ensureHooksDir = () => {
  if (!fs.existsSync(hooksDir)) {
    throw new Error('.githooks directory not found.');
  }
};

const setHooksPath = () => {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit'
  });
};

const makeExecutable = (fileName) => {
  const filePath = path.join(hooksDir, fileName);
  if (!fs.existsSync(filePath)) return;
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // Windows may ignore chmod; hook still works via git bash.
  }
};

try {
  ensureHooksDir();
  setHooksPath();
  makeExecutable('pre-commit');
  makeExecutable('pre-push');
  console.log('Git hooks installed: core.hooksPath=.githooks');
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

