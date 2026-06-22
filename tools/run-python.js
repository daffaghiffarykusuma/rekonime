import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('Usage: bun tools/run-python.js <script.py> [...args]');
  process.exit(1);
}

const venv = process.platform === 'win32'
  ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
  : path.join(process.cwd(), '.venv', 'bin', 'python');
const candidates = [
  ...(fs.existsSync(venv) ? [[venv]] : []),
  ['python'],
  ['python3'],
  ...(process.platform === 'win32' ? [['py', '-3']] : [])
];

for (const [command, ...prefix] of candidates) {
  const result = spawnSync(command, [...prefix, script, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  if (!result.error) process.exit(result.status ?? 1);
}

console.error('Python 3 is required. Tried the local .venv, python, python3, and py -3.');
process.exit(1);
