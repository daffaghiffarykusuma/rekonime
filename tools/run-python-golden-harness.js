import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  contractManifest,
  placeholderTimestamp,
  representativeCatalogInput,
  validationPayload
} from './pipeline-parity-contract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fixtureDir = path.join(root, 'test', 'fixtures', 'python-golden');

const args = process.argv.slice(2);
const update = args.includes('--update');

const compactJson = (payload) => `${JSON.stringify(payload)}\n`;

const run = (command, commandArgs, { expectSuccess = true } = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (expectSuccess && result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${commandArgs.join(' ')}\n${output}`);
  }
  if (!expectSuccess && result.status === 0) {
    throw new Error(`Command unexpectedly passed: ${command} ${commandArgs.join(' ')}\n${output}`);
  }
  return { ...result, output };
};

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

const writeJson = (filePath, payload) => {
  fs.writeFileSync(filePath, compactJson(payload));
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const serializeEmbeddedData = (payload) => `const ANIME_DATA=${JSON.stringify(payload)};`;

const normalizeCatalogPayload = (payload) => ({
  ...payload,
  generatedAt: placeholderTimestamp
});

const normalizeQualityReport = (payload) => ({
  ...payload,
  buildId: placeholderTimestamp,
  duration: 0
});

const normalizeValidationOutput = (output, workdir) => output
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replaceAll(workdir, '<fixture-workdir>')
  .replaceAll(workdir.replace(/\\/g, '/'), '<fixture-workdir>')
  .replace(/\\/g, '/')
  .replace(/(?:\.\.\/)+\.\.\/tmp\/rekonime-golden-[^/\s)]+/g, '<fixture-workdir>')
  .replace(/(?:\.\.\/)+tmp\/rekonime-golden-[^/\s)]+/g, '<fixture-workdir>')
  .replace(/(?:\.\.\/)+AppData\/Local\/Temp\/rekonime-golden-[^/\s)]+/g, '<fixture-workdir>')
  .replace(/[A-Za-z]:\/[^)\n]*?rekonime-golden-[^/\s)]+/g, '<fixture-workdir>')
  .replace(/\/tmp\/rekonime-golden-[^/\s)]+/g, '<fixture-workdir>')
  .replace(/(?:\.\.\/)+\.\.<fixture-workdir>/g, '<fixture-workdir>')
  .trim()
  .concat('\n');

const buildActuals = (workdir) => {
  const bun = process.execPath;
  const inputPath = path.join(workdir, 'anime.json');
  const fullPath = path.join(workdir, 'anime.full.json');
  const previewPath = path.join(workdir, 'anime.preview.json');
  const reportPath = path.join(workdir, 'quality-report.json');
  const statePath = path.join(workdir, '.build-state.json');
  const validationDataPath = path.join(workdir, 'validation.full.json');
  const validationEmbeddedPath = path.join(workdir, 'validation-data.js');
  const validationIndexPath = path.join(workdir, 'index.html');
  const failureDataPath = path.join(workdir, 'validation-failure.full.json');
  const failureEmbeddedPath = path.join(workdir, 'validation-failure-data.js');

  writeJson(inputPath, representativeCatalogInput());
  run(bun, [
    'tools/build-catalogs.js',
    inputPath,
    fullPath,
    previewPath,
    '--no-strict',
    '--report',
    '--report-path',
    reportPath,
    '--state',
    statePath
  ]);

  const validPayload = validationPayload();
  writeJson(validationDataPath, validPayload);
  fs.writeFileSync(validationEmbeddedPath, serializeEmbeddedData(validPayload));
  fs.writeFileSync(
    validationIndexPath,
    '<!doctype html><html><body><script type="module" src="/js/main.ts"></script></body></html>'
  );

  const success = run(bun, [
    'tools/validate-data.js',
    '--data',
    validationDataPath,
    '--embedded',
    validationEmbeddedPath,
    '--index',
    validationIndexPath
  ]);

  const failurePayload = validationPayload();
  failurePayload.anime[0].trailer = {
    id: 'bad',
    url: 'https://youtube.com.evil.example/watch?v=bad',
    embedUrl: 'https://youtube.com.evil.example/embed/bad'
  };
  writeJson(failureDataPath, failurePayload);
  fs.writeFileSync(failureEmbeddedPath, serializeEmbeddedData(failurePayload));
  const failure = run(bun, [
    'tools/validate-data.js',
    '--data',
    failureDataPath,
    '--embedded',
    failureEmbeddedPath,
    '--index',
    validationIndexPath
  ], { expectSuccess: false });

  return {
    'catalog-input.json': compactJson(representativeCatalogInput()),
    'catalog-full.json': compactJson(normalizeCatalogPayload(readJson(fullPath))),
    'catalog-preview.json': compactJson(normalizeCatalogPayload(readJson(previewPath))),
    'embedded-data.js': serializeEmbeddedData(validPayload),
    'quality-report.json': compactJson(normalizeQualityReport(readJson(reportPath))),
    'validation-success.txt': normalizeValidationOutput(success.output, workdir),
    'validation-failure.txt': normalizeValidationOutput(failure.output, workdir),
    'manifest.json': compactJson(contractManifest())
  };
};

const diffLines = (expected, actual, name) => {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  return [
    `--- expected/${name}`,
    `+++ actual/${name}`,
    ...actualLines.map((line, index) => (
      expectedLines[index] === line ? ` ${line}` : `-${expectedLines[index] ?? ''}\n+${line}`
    ))
  ].join('\n');
};

const compareOrUpdate = (actuals) => {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const failures = [];
  for (const [name, actual] of Object.entries(actuals).sort(([a], [b]) => a.localeCompare(b))) {
    const expectedPath = path.join(fixtureDir, name);
    if (update || !fs.existsSync(expectedPath)) {
      fs.writeFileSync(expectedPath, actual);
      continue;
    }
    const expected = fs.readFileSync(expectedPath, 'utf8');
    if (expected !== actual) {
      failures.push(diffLines(expected, actual, name));
    }
  }
  if (failures.length) {
    console.error(failures.join('\n\n'));
    console.error('\nGolden fixture parity failed. Re-run with --update only for intentional, reviewed diffs.');
    process.exitCode = 1;
    return;
  }
  console.log(`Python golden fixtures ${update ? 'updated' : 'matched'}: ${Object.keys(actuals).length} files`);
};

const runFallback = () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-golden-'));
  try {
    compareOrUpdate(buildActuals(workdir));
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
};

if (!process.env.REKONIME_GOLDEN_FORCE_JS) {
  const python = findPython();
  if (python) {
    const result = spawnSync(python, ['tools/python_golden_harness.py', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'inherit',
      env: { ...process.env, PYTHONUTF8: '1' }
    });
    process.exit(result.status ?? 1);
  }
}

console.warn('Python interpreter not found; running Bun parity fallback against the Python harness fixtures.');
runFallback();
