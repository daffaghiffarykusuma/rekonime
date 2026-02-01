import test from 'node:test';
import assert from 'node:assert/strict';
import { ThemeManager } from '../../js/themeManager.js';
import { resetDomBody } from '../helpers/dom.js';

test('ThemeManager applyTheme sets attribute and persists', () => {
  resetDomBody('<meta name="theme-color" content="#000" />');
  document.documentElement.removeAttribute('data-theme');

  let saved = null;
  const originalGetCache = ThemeManager.getCache;
  ThemeManager.getCache = () => ({
    setRaw: (key, value) => { saved = { key, value }; }
  });

  ThemeManager.applyTheme('light');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(saved.key, ThemeManager.STORAGE_KEY);
  assert.equal(saved.value, 'light');

  ThemeManager.getCache = originalGetCache;
});

test('ThemeManager detectOSPreference reads matchMedia', () => {
  ThemeManager.osPreferenceQuery = { matches: true };
  assert.equal(ThemeManager.detectOSPreference(), 'light');
  ThemeManager.osPreferenceQuery = { matches: false };
  assert.equal(ThemeManager.detectOSPreference(), 'dark');
});

test('ThemeManager toggleTheme switches between light and dark', () => {
  ThemeManager.currentTheme = 'dark';
  ThemeManager.osPreferenceQuery = { matches: false };
  ThemeManager.toggleTheme();
  assert.equal(ThemeManager.currentTheme, 'light');
});
