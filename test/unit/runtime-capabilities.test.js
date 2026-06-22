import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeCapabilities } from '../../js/runtime-capabilities.ts';
import { setupDom } from '../helpers/dom.js';

test('Runtime Capabilities uses requestIdleCallback and cancellation when available', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  let queued = null;
  let cancelled = null;
  window.requestIdleCallback = (callback, options) => {
    queued = { callback, options };
    return 42;
  };
  window.cancelIdleCallback = (handle) => {
    cancelled = handle;
  };

  const runtime = createRuntimeCapabilities();
  const handle = runtime.queueIdleTask(() => {}, { timeout: 2500 });
  runtime.cancelIdleTask(handle);

  assert.equal(handle, 42);
  assert.equal(queued.options.timeout, 2500);
  assert.equal(cancelled, 42);
});

test('Runtime Capabilities toggles modal visibility and body scroll lock', () => {
  setupDom(`
    <button id="before">Before</button>
    <dialog id="detail-modal" class="modal-overlay" hidden inert>
      <div class="modal-content">
        <button id="close-detail">Close</button>
      </div>
    </dialog>
  `, { url: 'https://example.com/' });

  const runtime = createRuntimeCapabilities();

  runtime.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });

  const modal = document.getElementById('detail-modal');
  assert.equal(modal.classList.contains('visible'), true);
  assert.equal(modal.hasAttribute('hidden'), false);
  assert.equal(modal.hasAttribute('inert'), false);
  assert.equal(document.body.classList.contains('is-scroll-locked'), true);
  assert.equal(modal.hasAttribute('open'), true);

  runtime.setModalVisibility('detail-modal', false);

  assert.equal(modal.classList.contains('visible'), false);
  assert.equal(modal.hasAttribute('hidden'), true);
  assert.equal(modal.hasAttribute('inert'), true);
  assert.equal(document.body.classList.contains('is-scroll-locked'), false);
  assert.equal(modal.hasAttribute('open'), false);
});

test('Runtime Capabilities routes Escape to the highest-priority open modal', () => {
  setupDom(`
    <dialog id="settings-modal" class="modal-overlay visible" open></dialog>
    <dialog id="filter-modal" class="modal-overlay visible" open></dialog>
    <dialog id="detail-modal" class="modal-overlay visible" open></dialog>
  `, { url: 'https://example.com/' });

  let closed = '';
  const runtime = createRuntimeCapabilities({
    closeModalById: (modalId) => {
      closed = modalId;
      return true;
    }
  });

  const handled = runtime.handleGlobalEscape({ key: 'Escape' });

  assert.equal(handled, true);
  assert.equal(closed, 'settings-modal');
});
