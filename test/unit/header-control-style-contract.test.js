import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

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

test('home header keeps primary actions simple and accessible', () => {
  const html = read('index.html');
  const document = new JSDOM(html).window.document;
  const filter = document.getElementById('filter-toggle');
  const menu = document.querySelector('.header-more-toggle');
  const navigation = document.querySelector('.header-actions');

  assert.equal(document.getElementById('surprise-toggle'), null);
  assert.equal(filter.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(filter.getAttribute('aria-controls'), 'filter-modal');
  assert.equal(menu.textContent.trim(), 'Menu');
  assert.equal(menu.hasAttribute('aria-label'), false);
  assert.equal(navigation.tagName, 'NAV');
  assert.equal(navigation.getAttribute('aria-label'), 'Secondary navigation');
  assert.match(html, /<nav class="header-actions"[\s\S]*?<\/nav>\s*<\/details>/);
  assert.equal(document.querySelector('.discovery-actions').getAttribute('role'), 'group');
  assert.equal(document.getElementById('viewing-intent-options').getAttribute('role'), 'group');
  assert.equal(document.getElementById('active-filters').getAttribute('aria-label'), 'Active filters');
});
