import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { setupDom } from '../helpers/dom.js';

test('App resolves trusted trailer origins for youtube hosts', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  const youtubeIframe = document.createElement('iframe');
  youtubeIframe.dataset.embedSrc = 'https://www.youtube.com/embed/abc123?enablejsapi=1';
  assert.equal(App.resolveTrailerMessageOrigin(youtubeIframe), 'https://www.youtube.com');

  const noCookieIframe = document.createElement('iframe');
  noCookieIframe.dataset.embedSrc = 'https://www.youtube-nocookie.com/embed/abc123?enablejsapi=1';
  assert.equal(App.resolveTrailerMessageOrigin(noCookieIframe), 'https://www.youtube-nocookie.com');
});

test('App refuses wildcard postMessage target for untrusted trailer origins', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  let called = false;
  const iframe = document.createElement('iframe');
  iframe.dataset.embedSrc = 'https://evil.example/embed/abc123';
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: {
      postMessage: () => {
        called = true;
      }
    }
  });

  App.sendTrailerCommand(iframe, 'pauseVideo');
  assert.equal(called, false);
});

test('App sends trailer command with resolved trusted origin', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  let origin = '';
  const iframe = document.createElement('iframe');
  iframe.dataset.embedSrc = 'https://www.youtube.com/embed/abc123?enablejsapi=1';
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: {
      postMessage: (_payload, targetOrigin) => {
        origin = targetOrigin;
      }
    }
  });

  App.sendTrailerCommand(iframe, 'pauseVideo');
  assert.equal(origin, 'https://www.youtube.com');
});
