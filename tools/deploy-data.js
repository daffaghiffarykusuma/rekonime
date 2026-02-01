import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const backupDir = path.join(dataDir, 'backups');
const dataFiles = ['anime.json', 'anime.full.json', 'anime.preview.json'];

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

const rollback = (timestamp) => {
  const backupPath = path.join(backupDir, timestamp);
  if (!fs.existsSync(backupPath)) {
    console.error(`Backup not found: ${timestamp}`);
    process.exit(1);
  }

  dataFiles.forEach((file) => {
    const src = path.join(backupPath, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dataDir, file));
    }
  });

  console.log(`Rolled back to ${timestamp}`);
};

const [command, arg] = process.argv.slice(2);

if (command === 'backup') {
  backupCurrentData();
} else if (command === 'rollback') {
  if (!arg) {
    console.error('Usage: node tools/deploy-data.js rollback <timestamp>');
    process.exit(1);
  }
  rollback(arg);
} else {
  console.log('Usage: node tools/deploy-data.js [backup|rollback <timestamp>]');
}
