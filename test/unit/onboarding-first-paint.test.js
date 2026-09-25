import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('home entrypoint contains an early onboarding shell and gate', () => {
  const html = read('index.html');
  const gateIndex = html.indexOf('<script src="/js/onboarding-gate.js"></script>');
  const appIndex = html.indexOf('<script type="module" src="/src/app/main.ts"></script>');

  assert.ok(gateIndex > 0);
  assert.ok(appIndex > gateIndex);
  assert.match(html, /class="onboarding-overlay onboarding-shell"/);
  assert.match(html, /html\[data-onboarding-pending\] #app-container/);
  assert.match(html, /data-onboarding-step="welcome"/);
  assert.match(html, /data-action="onboarding-intent"/);
  assert.match(html, /data-shell-dismiss/);
  assert.match(read('src/styles/styles.css'), /html\[data-onboarding-pending\] \.onboarding-overlay\.onboarding-shell/);

  const gate = read('public/js/onboarding-gate.js');
  for (const status of [null, 'completed', 'skipped']) {
    const dom = new JSDOM(html, { url: 'https://example.test/' });
    const { document, localStorage, Event } = dom.window;
    if (status) localStorage.setItem('rekonime.onboarding', status);
    runInNewContext(gate, { document, localStorage });
    document.dispatchEvent(new Event('DOMContentLoaded'));
    assert.equal(document.documentElement.hasAttribute('data-onboarding-pending'), status === null);
    assert.equal(document.getElementById('onboarding-modal').getAttribute('aria-hidden'), String(status !== null));
    dom.window.close();
  }
});
