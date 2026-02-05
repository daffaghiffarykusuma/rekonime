import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const plansDir = path.join(cwd, 'plans');

const REPORT_REGEX = /\.json$/i;
const DEFAULT_PREFIX = 'rekonime.vercel.app-';

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const round = (value, digits = 2) => Number(value.toFixed(digits));

const formatSeconds = (ms) => `${round(ms / 1000, 3)}s`;
const formatMs = (ms) => `${round(ms, 1)}ms`;
const formatDelta = (value, digits = 2, unit = '') => {
  const n = round(value, digits);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}${unit}`;
};

const args = process.argv.slice(2);
let files = [];

if (args.length) {
  files = args.map((arg) => path.resolve(cwd, arg)).filter((file) => fs.existsSync(file));
} else if (fs.existsSync(plansDir)) {
  files = fs
    .readdirSync(plansDir)
    .filter((name) => name.startsWith(DEFAULT_PREFIX) && REPORT_REGEX.test(name))
    .map((name) => path.join(plansDir, name));
}

if (!files.length) {
  console.log('No Lighthouse JSON reports found.');
  process.exit(0);
}

const reports = files
  .map((file) => {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const json = JSON.parse(raw);
      return {
        file: path.relative(cwd, file),
        url: json.finalDisplayedUrl || '',
        performance: toNumber(json?.categories?.performance?.score),
        accessibility: toNumber(json?.categories?.accessibility?.score),
        bestPractices: toNumber(json?.categories?.['best-practices']?.score),
        seo: toNumber(json?.categories?.seo?.score),
        fcpMs: toNumber(json?.audits?.['first-contentful-paint']?.numericValue),
        lcpMs: toNumber(json?.audits?.['largest-contentful-paint']?.numericValue),
        speedIndexMs: toNumber(json?.audits?.['speed-index']?.numericValue),
        tbtMs: toNumber(json?.audits?.['total-blocking-time']?.numericValue),
        cls: toNumber(json?.audits?.['cumulative-layout-shift']?.numericValue)
      };
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.file.localeCompare(b.file));

if (!reports.length) {
  console.log('No valid Lighthouse reports parsed.');
  process.exit(0);
}

console.log('Reports');
for (const r of reports) {
  console.log(
    `- ${r.file}: Perf ${round(r.performance, 2)}, A11y ${round(r.accessibility, 2)}, BP ${round(r.bestPractices, 2)}, SEO ${round(r.seo, 2)}, FCP ${formatSeconds(r.fcpMs)}, LCP ${formatSeconds(r.lcpMs)}, SI ${formatSeconds(r.speedIndexMs)}, TBT ${formatMs(r.tbtMs)}, CLS ${round(r.cls, 3)}`
  );
}

const summary = {
  performance: reports.map((r) => r.performance),
  accessibility: reports.map((r) => r.accessibility),
  bestPractices: reports.map((r) => r.bestPractices),
  seo: reports.map((r) => r.seo),
  fcpMs: reports.map((r) => r.fcpMs),
  lcpMs: reports.map((r) => r.lcpMs),
  speedIndexMs: reports.map((r) => r.speedIndexMs),
  tbtMs: reports.map((r) => r.tbtMs),
  cls: reports.map((r) => r.cls)
};

const statLine = (label, arr, formatter) => {
  const med = formatter(median(arr));
  const min = formatter(Math.min(...arr));
  const max = formatter(Math.max(...arr));
  console.log(`- ${label}: median ${med}, min ${min}, max ${max}`);
};

console.log('\nAggregate');
statLine('Performance', summary.performance, (v) => round(v, 2));
statLine('Accessibility', summary.accessibility, (v) => round(v, 2));
statLine('Best Practices', summary.bestPractices, (v) => round(v, 2));
statLine('SEO', summary.seo, (v) => round(v, 2));
statLine('FCP', summary.fcpMs, (v) => formatSeconds(v));
statLine('LCP', summary.lcpMs, (v) => formatSeconds(v));
statLine('Speed Index', summary.speedIndexMs, (v) => formatSeconds(v));
statLine('TBT', summary.tbtMs, (v) => formatMs(v));
statLine('CLS', summary.cls, (v) => round(v, 3));

if (reports.length >= 2) {
  const latest = reports[reports.length - 1];
  const prev = reports[reports.length - 2];
  console.log('\nLatest vs Previous');
  console.log(`- Latest: ${latest.file}`);
  console.log(`- Previous: ${prev.file}`);
  console.log(`- Performance: ${formatDelta(latest.performance - prev.performance, 2)}`);
  console.log(`- Accessibility: ${formatDelta(latest.accessibility - prev.accessibility, 2)}`);
  console.log(`- Best Practices: ${formatDelta(latest.bestPractices - prev.bestPractices, 2)}`);
  console.log(`- SEO: ${formatDelta(latest.seo - prev.seo, 2)}`);
  console.log(`- FCP: ${formatDelta(latest.fcpMs - prev.fcpMs, 1, 'ms')}`);
  console.log(`- LCP: ${formatDelta(latest.lcpMs - prev.lcpMs, 1, 'ms')}`);
  console.log(`- Speed Index: ${formatDelta(latest.speedIndexMs - prev.speedIndexMs, 1, 'ms')}`);
  console.log(`- TBT: ${formatDelta(latest.tbtMs - prev.tbtMs, 1, 'ms')}`);
  console.log(`- CLS: ${formatDelta(latest.cls - prev.cls, 3)}`);
}

if (reports.length < 3) {
  console.log('\nNote: Fewer than 3 reports available. Add more runs for stable median trends.');
}
