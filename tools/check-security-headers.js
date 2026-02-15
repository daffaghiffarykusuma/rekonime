import fs from 'node:fs';
import path from 'node:path';

const VERCEL_CONFIG_PATH = path.join(process.cwd(), 'vercel.json');
const REQUIRED_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy'
];

const REQUIRED_CSP_TOKENS = [
  "default-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'"
];

const main = () => {
  if (!fs.existsSync(VERCEL_CONFIG_PATH)) {
    console.error(`Missing vercel config: ${VERCEL_CONFIG_PATH}`);
    process.exitCode = 1;
    return;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(VERCEL_CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error(`Invalid JSON in ${VERCEL_CONFIG_PATH}: ${error.message || error}`);
    process.exitCode = 1;
    return;
  }

  const headers = Array.isArray(config?.headers) ? config.headers : [];
  const allHeaderEntries = headers
    .flatMap((rule) => Array.isArray(rule?.headers) ? rule.headers : [])
    .filter((entry) => entry && typeof entry === 'object');

  const index = new Map();
  allHeaderEntries.forEach((entry) => {
    const key = String(entry.key || '').trim().toLowerCase();
    if (!key) return;
    index.set(key, String(entry.value || ''));
  });

  const missing = REQUIRED_HEADERS.filter((key) => !index.has(key));
  const failures = [];

  if (missing.length) {
    failures.push(`Missing required headers: ${missing.join(', ')}`);
  }

  const csp = index.get('content-security-policy') || '';
  if (!csp) {
    failures.push('Content-Security-Policy header is missing or empty.');
  } else {
    REQUIRED_CSP_TOKENS.forEach((token) => {
      if (!csp.includes(token)) {
        failures.push(`CSP missing token: ${token}`);
      }
    });
  }

  const nosniff = index.get('x-content-type-options') || '';
  if (nosniff.toLowerCase() !== 'nosniff') {
    failures.push('X-Content-Type-Options must equal "nosniff".');
  }

  const xfo = index.get('x-frame-options') || '';
  if (!['deny', 'sameorigin'].includes(xfo.toLowerCase())) {
    failures.push('X-Frame-Options should be DENY or SAMEORIGIN.');
  }

  if (failures.length) {
    console.error('Security header check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log('Security header check passed.');
};

main();
