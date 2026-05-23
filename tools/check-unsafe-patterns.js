import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DEFAULT_ALLOWLIST_PATH = path.join(process.cwd(), 'tools', 'security-pattern-allowlist.json');

const PATTERNS = [
  {
    id: 'no-eval',
    regex: /\beval\s*\(/,
    message: 'Disallow eval()'
  },
  {
    id: 'no-new-function',
    regex: /\bnew\s+Function\s*\(/,
    message: 'Disallow new Function()'
  },
  {
    id: 'no-string-timeout',
    regex: /\bsetTimeout\s*\(\s*['"`]/,
    message: 'Disallow string-based setTimeout()'
  },
  {
    id: 'no-string-interval',
    regex: /\bsetInterval\s*\(\s*['"`]/,
    message: 'Disallow string-based setInterval()'
  },
  {
    id: 'no-wildcard-postmessage',
    regex: /\bpostMessage\s*\([^,\n]+,\s*['"`]\*['"`]\s*\)/,
    message: 'Disallow wildcard postMessage target origin'
  },
  {
    id: 'no-hostname-includes',
    regex: /\bhostname\s*\.\s*includes\s*\(/,
    message: 'Disallow hostname.includes() checks for trust decisions'
  },
  {
    id: 'no-direct-html-assignment',
    regex: /\.\s*(?:innerHTML|outerHTML)\s*=/,
    message: 'Disallow direct HTML assignment outside the Trusted Types helper'
  },
  {
    id: 'no-direct-insert-adjacent-html',
    regex: /\.\s*insertAdjacentHTML\s*\(/,
    message: 'Disallow direct insertAdjacentHTML outside the Trusted Types helper'
  }
];

const parseArgs = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--allowlist' && argv[index + 1]) {
      options.allowlist = argv[index + 1];
      index += 1;
    }
  }
  return options;
};

const readAllowlist = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return { allow: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : { allow: {} };
  } catch (error) {
    throw new Error(`Invalid allowlist JSON at ${filePath}: ${error.message || error}`);
  }
};

const listTrackedFiles = () => {
  const output = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => filePath.replace(/\\/g, '/'));
};

const shouldScan = (filePath) => {
  if (filePath.startsWith('test/')) return false;
  if (filePath.startsWith('plans/')) return false;
  if (filePath.startsWith('coverage/')) return false;
  if (filePath.startsWith('dist/')) return false;
  return /\.(js|mjs|cjs|ts|tsx|html)$/i.test(filePath);
};

const isAllowedFinding = (allowlist, ruleId, filePath) => {
  const allowedPaths = allowlist?.allow?.[ruleId];
  if (!Array.isArray(allowedPaths)) return false;
  return allowedPaths.some((entry) => String(entry || '').replace(/\\/g, '/') === filePath);
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const allowlistPath = args.allowlist ? path.resolve(args.allowlist) : DEFAULT_ALLOWLIST_PATH;
  const allowlist = readAllowlist(allowlistPath);

  const findings = [];
  const files = listTrackedFiles().filter(shouldScan);

  files.forEach((filePath) => {
    const absolutePath = path.join(process.cwd(), filePath);
    let content;
    try {
      content = fs.readFileSync(absolutePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split(/\r?\n/);

    lines.forEach((line, idx) => {
      PATTERNS.forEach((pattern) => {
        if (!pattern.regex.test(line)) return;
        if (isAllowedFinding(allowlist, pattern.id, filePath)) return;
        findings.push({
          ruleId: pattern.id,
          filePath,
          line: idx + 1,
          message: pattern.message,
          code: line.trim().slice(0, 200)
        });
      });
    });
  });

  if (!findings.length) {
    console.log('Unsafe pattern scan passed.');
    return;
  }

  console.log('Unsafe pattern scan failed:');
  findings.slice(0, 100).forEach((finding) => {
    console.log(`- [${finding.ruleId}] ${finding.filePath}:${finding.line} ${finding.message}`);
    console.log(`  ${finding.code}`);
  });
  if (findings.length > 100) {
    console.log(`... ${findings.length - 100} more findings`);
  }
  process.exitCode = 1;
};

main();
