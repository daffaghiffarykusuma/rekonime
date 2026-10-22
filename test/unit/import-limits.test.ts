import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMPORT_BYTES, readImportText } from '../../src/shared/security/import-limits.ts';

test('import rejects oversized File metadata without reading the file', async () => {
  let reads = 0;
  await assert.rejects(readImportText({ size: MAX_IMPORT_BYTES + 1, text: async () => { reads++; return ''; } }), /10 MiB/);
  assert.equal(reads, 0);
});

test('import verifies actual UTF-8 bytes even when size metadata is absent or misleading', async () => {
  const oversized = '🙂'.repeat(MAX_IMPORT_BYTES / 4 + 1);
  await assert.rejects(readImportText({ size: 1, text: async () => oversized }), /10 MiB/);
  assert.equal(await readImportText({ size: MAX_IMPORT_BYTES, text: async () => 'x'.repeat(MAX_IMPORT_BYTES) }).then(text => text.length), MAX_IMPORT_BYTES);
});
