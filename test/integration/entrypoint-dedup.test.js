import test from 'node:test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

test('entrypoint deduplication check passes', () => {
  const scriptPath = path.join(process.cwd(), 'tools', 'check-entrypoint-dedup.js');
  execFileSync(process.execPath, [scriptPath]);
});
