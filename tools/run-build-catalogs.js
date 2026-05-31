import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);

const findPython = () => {
  const venvPython = process.platform === 'win32'
    ? path.join(root, '.venv', 'Scripts', 'python.exe')
    : path.join(root, '.venv', 'bin', 'python');
  const candidates = fs.existsSync(venvPython)
    ? [venvPython, 'python', 'python3', 'py']
    : ['python', 'python3', 'py'];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!result.error && result.status === 0) return candidate;
  }
  return '';
};

const runPassthrough = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    encoding: 'utf8'
  });
  process.exit(result.status ?? 1);
};

if (!process.env.REKONIME_FORCE_JS_BUILD_CATALOGS) {
  const python = findPython();
  if (python) {
    runPassthrough(python, ['tools/build_catalogs.py', ...args]);
  }
}

console.warn('Python interpreter not found; using existing Bun catalog-build fallback.');
runPassthrough(process.execPath, ['tools/build-catalogs.js', ...args]);
