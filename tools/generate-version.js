import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const versionPath = path.join(distDir, 'version.json');

const generateVersion = () => {
  try {
    const commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return `v${Date.now()}-${commit}`;
  } catch {
    return `v${Date.now()}`;
  }
};

const walkFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    return [fullPath];
  });
};

const hashBuildAssets = () => {
  const hash = crypto.createHash('md5');
  const files = walkFiles(distDir)
    .filter((filePath) => /\.(js|css)$/i.test(filePath))
    .sort();

  files.forEach((filePath) => {
    hash.update(path.relative(distDir, filePath));
    hash.update(fs.readFileSync(filePath));
  });

  return hash.digest('hex').slice(0, 8);
};

const ensureDist = () => {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ not found. Run vite build before generate-version.');
  }
};

const main = () => {
  ensureDist();
  const version = generateVersion();
  const assetHash = hashBuildAssets();
  const payload = {
    version,
    assetHash,
    buildTime: new Date().toISOString()
  };
  fs.writeFileSync(versionPath, JSON.stringify(payload, null, 2));
  console.log(`Generated version metadata: ${path.relative(rootDir, versionPath)}`);
  console.log(`Version: ${version}`);
  console.log(`Asset hash: ${assetHash}`);
};

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
