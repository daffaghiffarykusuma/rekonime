import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardShortcuts } from '../../js/keyboardShortcuts.ts';
import { resetDomBody } from '../helpers/dom.js';
import { createAnime } from '../helpers/factories.js';

test('KeyboardShortcuts handleKeydown triggers actions', () => {
  resetDomBody('<input id="header-search" /><div id="detail-modal"></div>');

  let lastAction = null;
  const originalExecute = KeyboardShortcuts.executeAction;
  KeyboardShortcuts.executeAction = (action) => { lastAction = action; };

  const event = {
    key: '?',
    target: document.body,
    preventDefault: () => {}
  };

  KeyboardShortcuts.handleKeydown(event);
  assert.equal(lastAction, 'showHelp');

  const inputEvent = {
    key: 'f',
    target: document.getElementById('header-search'),
    preventDefault: () => {}
  };

  lastAction = null;
  KeyboardShortcuts.handleKeydown(inputEvent);
  assert.equal(lastAction, null);

  KeyboardShortcuts.executeAction = originalExecute;
});

test('KeyboardShortcuts modal navigation triggers modal shortcuts', () => {
  resetDomBody('<div id="detail-modal" class="visible"></div>');

  let lastAction = null;
  const originalExecute = KeyboardShortcuts.executeAction;
  KeyboardShortcuts.executeAction = (action) => { lastAction = action; };

  const event = {
    key: 'ArrowLeft',
    target: document.body,
    preventDefault: () => {}
  };

  KeyboardShortcuts.handleKeydown(event);
  assert.equal(lastAction, 'previousAnime');

  KeyboardShortcuts.executeAction = originalExecute;
});

test('KeyboardShortcuts show and close modal', async () => {
  resetDomBody('');
  KeyboardShortcuts.isModalOpen = false;
  KeyboardShortcuts.showShortcutsModal();

  const modal = document.getElementById('shortcuts-modal');
  assert.ok(modal);
  assert.equal(KeyboardShortcuts.isModalOpen, true);

  KeyboardShortcuts.closeShortcutsModal();
  await new Promise(resolve => setTimeout(resolve, 350));

  assert.equal(Boolean(document.getElementById('shortcuts-modal')), false);
  assert.equal(KeyboardShortcuts.isModalOpen, false);
});

test('KeyboardShortcuts uses explicit commands and navigation state', () => {
  const animeList = [createAnime({ id: 'a' }), createAnime({ id: 'b' })];
  const calls = [];
  KeyboardShortcuts.configure({
    commands: {
      openAnime: (id) => calls.push(['openAnime', id]),
      openFilters: () => calls.push(['openFilters'])
    },
    getNavigationState: () => ({
      currentAnimeId: 'a',
      animeIds: animeList.map(anime => anime.id)
    })
  });

  KeyboardShortcuts.openFilters();
  KeyboardShortcuts.navigateAnime(1);
  assert.deepEqual(calls, [['openFilters'], ['openAnime', 'b']]);
});
