import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BACKUP_ID_PATTERN,
  isPathInside,
  resolveBackupPath
} from '../../tools/deploy-data.js';

const backupRoot = path.join(process.cwd(), 'data', 'backups');

test('deploy-data only accepts safe backup identifiers', () => {
  assert.equal(BACKUP_ID_PATTERN.test('2026-04-16T12-30-45-123Z'), true);
  assert.equal(BACKUP_ID_PATTERN.test('..\\..\\plans'), false);
  assert.equal(BACKUP_ID_PATTERN.test('../plans'), false);
  assert.equal(BACKUP_ID_PATTERN.test('backup/name'), false);
});

test('deploy-data path containment rejects traversal candidates', () => {
  const base = path.resolve(backupRoot);
  const inside = path.resolve(base, '2026-04-16T12-30-45-123Z');
  const outside = path.resolve(base, '..', '..', 'plans');

  assert.equal(isPathInside(base, inside), true);
  assert.equal(isPathInside(base, outside), false);
});

test('deploy-data resolveBackupPath rejects traversal and resolves valid backup dirs', () => {
  fs.mkdirSync(backupRoot, { recursive: true });
  const backupId = `test-backup-${Date.now()}`;
  const backupPath = path.join(backupRoot, backupId);
  fs.mkdirSync(backupPath, { recursive: true });

  try {
    assert.throws(() => resolveBackupPath('..\\..\\plans'), /Invalid backup identifier/);

    const resolved = resolveBackupPath(backupId);
    assert.equal(resolved.id, backupId);
    assert.equal(resolved.path, path.resolve(backupPath));
  } finally {
    fs.rmSync(backupPath, { recursive: true, force: true });
  }
});
