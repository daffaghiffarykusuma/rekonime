import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8');

const getCriticalCss = () => {
  const html = read('index.html');
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(match, 'index.html should include critical CSS');
  return match[1];
};

const assertStyleContract = (css, label) => {
  const required = [
    '.header-controls',
    '.header-search-wrapper',
    '.header-search-input',
    '.header-sort',
    '.sort-select',
    '-webkit-appearance: none',
    'appearance: none',
    'color-scheme: dark',
    'background-color: var(--bg-secondary)',
    'font-family: var(--font-body)',
    'min-height: 44px',
    '.select-wrapper::after',
    '.header-more',
    '.header-actions',
    '.surprise-btn',
    '.filter-btn'
  ];

  required.forEach((token) => {
    assert.ok(css.includes(token), `${label} missing ${token}`);
  });
};

test('critical and full CSS keep header control styling in sync', () => {
  assertStyleContract(getCriticalCss(), 'critical CSS');
  assertStyleContract(read('css/styles.css'), 'full stylesheet');
});
