// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { SidebarPreference } from '../../js/sidebar-preference.ts';
import { resetDomBody } from '../helpers/dom.js';

test('SidebarPreference applies and persists a valid mode', () => {
  resetDomBody('<button data-sidebar-option="compact"></button>');
  let saved = null;
  const originalGetCache = SidebarPreference.getCache;
  SidebarPreference.getCache = () => ({
    setRaw: (key, value) => { saved = { key, value }; }
  }) as never;

  SidebarPreference.applyMode('compact');

  assert.equal(document.documentElement.dataset.sidebarMode, 'compact');
  assert.deepEqual(saved, { key: SidebarPreference.STORAGE_KEY, value: 'compact' });
  assert.equal(document.querySelector('[data-sidebar-option]')?.getAttribute('aria-pressed'), 'true');
  SidebarPreference.getCache = originalGetCache;
});

test('SidebarPreference falls back to auto-hide and renders all choices', () => {
  resetDomBody('');
  const originalGetCache = SidebarPreference.getCache;
  SidebarPreference.getCache = () => ({ setRaw: () => {} }) as never;

  SidebarPreference.applyMode('unknown');
  const markup = SidebarPreference.renderSelector();

  assert.equal(SidebarPreference.currentMode, 'auto-hide');
  assert.match(markup, /Expanded/);
  assert.match(markup, /Compact/);
  assert.match(markup, /Auto-hide/);
  SidebarPreference.getCache = originalGetCache;
});
