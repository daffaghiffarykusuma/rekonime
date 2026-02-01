import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const generateVersion = () => {
  try {
    const commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return `v${Date.now()}-${commit}`;
  } catch (error) {
    return `v${Date.now()}`;
  }
};

const hashAssets = () => {
  const assetsDir = path.join(__dirname, '..', 'js');
  const hash = crypto.createHash('md5');
  const files = fs.readdirSync(assetsDir).filter(file => file.endsWith('.js')).sort();
  files.forEach((file) => {
    const content = fs.readFileSync(path.join(assetsDir, file));
    hash.update(content);
  });
  return hash.digest('hex').slice(0, 8);
};

const version = generateVersion();
const assetHash = hashAssets();

const swPath = path.join(__dirname, '..', 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');
const updatedSw = swContent.replace(/const CACHE_VERSION = 'v[^']+'/, `const CACHE_VERSION = '${version}'`);

if (swContent === updatedSw) {
  throw new Error('CACHE_VERSION not found in sw.js');
}

fs.writeFileSync(swPath, updatedSw);

const versionPath = path.join(__dirname, '..', 'version.json');
fs.writeFileSync(
  versionPath,
  JSON.stringify(
    {
      version,
      assetHash,
      buildTime: new Date().toISOString()
    },
    null,
    2
  )
);

console.log(`Generated version: ${version}`);
console.log(`Asset hash: ${assetHash}`);
