import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const backupDir = path.join(dataDir, 'backups');
const dataFiles = ['anime.json', 'anime.full.json', 'anime.preview.json'];
const BACKUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const normalizeBackupId = (value) => String(value || '').trim();

const isPathInside = (basePath, candidatePath) => {
  const relative = path.relative(basePath, candidatePath);
  if (!relative) return true;
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};

const resolveBackupPath = (backupId) => {
  const normalizedId = normalizeBackupId(backupId);
  if (!normalizedId) {
    throw new Error('Backup identifier is required');
  }
  if (!BACKUP_ID_PATTERN.test(normalizedId)) {
    throw new Error('Invalid backup identifier');
  }

  const basePath = path.resolve(backupDir);
  const candidatePath = path.resolve(basePath, normalizedId);
  if (!isPathInside(basePath, candidatePath)) {
    throw new Error('Backup path escapes backup directory');
  }

  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Backup not found: ${normalizedId}`);
  }
  if (!fs.statSync(candidatePath).isDirectory()) {
    throw new Error(`Backup is not a directory: ${normalizedId}`);
  }

  return {
    id: normalizedId,
    path: candidatePath
  };
};

const backupCurrentData = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, timestamp);
  ensureDir(backupDir);
  ensureDir(backupPath);

  dataFiles.forEach((file) => {
    const src = path.join(dataDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backupPath, file));
    }
  });

  console.log(`Backed up data to ${backupPath}`);
  return backupPath;
};

const rollback = (backupId) => {
  const { id, path: backupPath } = resolveBackupPath(backupId);

  dataFiles.forEach((file) => {
    const src = path.join(backupPath, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dataDir, file));
    }
  });

  console.log(`Rolled back to ${id}`);
};

const main = (argv = process.argv.slice(2)) => {
  const [command, arg] = argv;

  if (command === 'backup') {
    backupCurrentData();
    return;
  }

  if (command === 'rollback') {
    if (!arg) {
      throw new Error('Usage: node tools/deploy-data.js rollback <timestamp>');
    }
    rollback(arg);
    return;
  }

  console.log('Usage: node tools/deploy-data.js [backup|rollback <timestamp>]');
};

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

export {
  BACKUP_ID_PATTERN,
  normalizeBackupId,
  isPathInside,
  resolveBackupPath,
  backupCurrentData,
  rollback,
  main
};
