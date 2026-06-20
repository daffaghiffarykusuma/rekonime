import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('home entrypoint contains an early onboarding shell and gate', () => {
  const html = read('index.html');
  const gateIndex = html.indexOf('<script src="/js/onboarding-gate.js"></script>');
  const appIndex = html.indexOf('<script type="module" src="/js/main.ts"></script>');

  assert.ok(gateIndex > 0);
  assert.ok(appIndex > gateIndex);
  assert.match(html, /class="onboarding-overlay onboarding-shell"/);
  assert.match(html, /html\[data-onboarding-pending\] #app-container/);
  assert.match(html, /data-onboarding-step="welcome"/);
  assert.match(html, /data-action="onboarding-intent"/);
  assert.match(html, /data-shell-dismiss/);
});

test('onboarding shell visibility is storage-gated and controller-adopted', () => {
  const gate = read('public/js/onboarding-gate.js');
  const css = read('css/styles.css');
  const controller = read('js/onboarding.js');

  assert.match(gate, /rekonime\.onboarding/);
  assert.match(gate, /data-onboarding-pending/);
  assert.match(css, /html\[data-onboarding-pending\] \.onboarding-overlay\.onboarding-shell/);
  assert.match(controller, /classList\.remove\('onboarding-shell'\)/);
  assert.match(controller, /dataset\.onboardingStep !== stepName/);
  assert.match(controller, /button:disabled\[data-action\]/);
  assert.match(controller, /closeModal\(\)[\s\S]*removeAttribute\('data-onboarding-pending'\)/);
  assert.match(controller, /attachModalListeners\(\)/);
});
