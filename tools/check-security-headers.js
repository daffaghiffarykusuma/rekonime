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
  "frame-ancestors 'none'",
  "trusted-types rekonime-html",
  "require-trusted-types-for 'script'"
];

const findCatchAllRule = (headers) => headers.find((rule) => {
  const source = String(rule?.source || '').trim();
  return source === '/(.*)';
});

const buildHeaderIndex = (rule) => {
  const index = new Map();
  const entries = Array.isArray(rule?.headers) ? rule.headers : [];
  entries
    .filter((entry) => entry && typeof entry === 'object')
    .forEach((entry) => {
      const key = String(entry.key || '').trim().toLowerCase();
      if (!key) return;
      index.set(key, String(entry.value || ''));
    });
  return index;
};

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
  const failures = [];
  const catchAllRule = findCatchAllRule(headers);

  if (!catchAllRule) {
    failures.push('Missing catch-all security header rule for source "/(.*)".');
  }

  const index = buildHeaderIndex(catchAllRule);
  const missing = REQUIRED_HEADERS.filter((key) => !index.has(key));

  if (missing.length) {
    failures.push(`Catch-all rule is missing required headers: ${missing.join(', ')}`);
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
