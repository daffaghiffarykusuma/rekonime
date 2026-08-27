import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { setupDom } from '../helpers/dom.js';

test('App Shell keeps Runtime Capabilities as one stable instance', () => {
  setupDom(`
    <button id="before">Before</button>
    <dialog id="detail-modal" class="modal-overlay" hidden inert>
      <div class="modal-content">
        <button id="close-detail">Close</button>
      </div>
    </dialog>
  `, { url: 'https://example.com/' });
  App.runtimeCapabilities = null;

  const first = App.getRuntimeCapabilities();
  const second = App.getRuntimeCapabilities();

  assert.equal(first, second);

  first.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });

  assert.equal(first.isModalVisible('detail-modal'), true);
  assert.equal(first.getOpenModalId(), 'detail-modal');

  first.setModalVisibility('detail-modal', false);
  App.runtimeCapabilities = null;
});
