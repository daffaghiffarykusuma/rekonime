import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../helpers/dom.js';
import { setHTML, toTrustedScriptURL, setScriptText } from '../../src/shared/security/trusted-types.js';

test('HTML sinks sanitize active markup while retaining app controls and SVG icons', () => {
  setupDom();
  const target = document.createElement('div');
  setHTML(target, '<img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">link</a><svg viewBox="0 0 24 24"><path d="M0 0"></path></svg><dialog id="review"><button data-action="apply">Apply</button></dialog>');
  assert.equal(target.querySelector('script'), null);
  assert.equal(target.querySelector('[onerror]'), null);
  assert.equal(target.querySelector('a').hasAttribute('href'), false);
  assert.ok(target.querySelector('svg path'));
  assert.ok(target.querySelector('dialog#review [data-action="apply"]'));
});

test('HTML sinks preserve trusted trailer placeholders and reject arbitrary frames', () => {
  setupDom();
  const target = document.createElement('div');
  setHTML(target, '<iframe src="about:blank" data-embed-src="https://www.youtube.com/embed/abc" srcdoc="<script>alert(1)</script>"></iframe><iframe src="https://evil.example/"></iframe><iframe src="javascript:alert(1)"></iframe>');
  assert.equal(target.querySelectorAll('iframe').length, 1);
  const frame = target.querySelector('iframe');
  assert.equal(frame.getAttribute('src'), 'about:blank');
  assert.equal(frame.getAttribute('data-embed-src'), 'https://www.youtube.com/embed/abc');
  assert.equal(frame.hasAttribute('srcdoc'), false);
  assert.equal(frame.getAttribute('sandbox'), 'allow-scripts allow-same-origin allow-presentation');
});

test('script URLs admit only the fixed fallback and worker resources', () => {
  setupDom();
  for (const value of ['/sw.js', '/js/data.js', 'js/data.js']) assert.equal(String(toTrustedScriptURL(value)), value);
  for (const value of ['https://evil.example/a.js', '//evil.example/a.js', '/js/data.js?x=1', '/js/../other.js', 'javascript:alert(1)', '/other.js']) {
    assert.throws(() => toTrustedScriptURL(value), /application asset/);
  }
});

test('script text accepts JSON-LD data only and cannot populate executable scripts', () => {
  setupDom();
  const script = document.createElement('script');
  const data = { '@context': 'https://schema.org', '@graph': [{ name: '</script><script>alert(1)</script>' }] };
  assert.throws(() => setScriptText(script, JSON.stringify(data)), /JSON-LD script element/);
  script.type = 'application/ld+json';
  assert.throws(() => setScriptText(script, 'alert(1)'), SyntaxError);
  setScriptText(script, JSON.stringify(data));
  assert.deepEqual(JSON.parse(script.textContent), data);
});

test('policy creation errors fail closed instead of returning unsanitized HTML', () => {
  setupDom();
  window.trustedTypes = { createPolicy: () => { throw new Error('blocked by CSP'); } };
  assert.throws(() => setHTML(document.createElement('div'), '<img onerror="alert(1)">'), /blocked by CSP/);
});
