import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractEmbeddedData,
  serializeEmbeddedData,
  validateEmbeddedAnimeShape
} from './lib/embedded-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = path.join(__dirname, '..', 'data', 'anime.full.json');
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'js', 'data.js');

const parseArgs = (args) => {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.replace(/^--/, '');
    if (index + 1 < args.length && !args[index + 1].startsWith('--')) {
      values[key] = args[index + 1];
      index += 1;
    } else {
      values[key] = 'true';
    }
  }
  return values;
};

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input ? path.resolve(process.cwd(), args.input) : DEFAULT_INPUT;
  const outputPath = args.output ? path.resolve(process.cwd(), args.output) : DEFAULT_OUTPUT;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input JSON not found: ${inputPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const shape = validateEmbeddedAnimeShape(payload, { sampleSize: 50 });
  if (!shape.valid) {
    throw new Error(`Input payload shape invalid:\n- ${shape.errors.join('\n- ')}`);
  }

  const script = serializeEmbeddedData(payload);
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, script, 'utf8');

  // Re-parse written output to catch serialization regressions.
  const parsed = extractEmbeddedData(fs.readFileSync(outputPath, 'utf8'));
  const parsedShape = validateEmbeddedAnimeShape(parsed, { sampleSize: 50 });
  if (!parsedShape.valid) {
    throw new Error(`Generated output is invalid:\n- ${parsedShape.errors.join('\n- ')}`);
  }

  console.log(`Wrote embedded data to ${path.relative(process.cwd(), outputPath)}`);
};

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
