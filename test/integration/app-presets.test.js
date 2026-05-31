import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { setupDom } from '../helpers/dom.js';
import { createAnime, createStats } from '../helpers/factories.js';

test('App applyFilterPreset updates filtered data and sort', () => {
  setupDom('<select id="sort-select"><option value="retention">Retention</option></select><section id="catalog-section"></section>', { url: 'http://localhost/' });

  const good = createAnime({ stats: createStats({ flowState: 80, stressSpikes: 1 }) });
  const bad = createAnime({ id: 'bad', stats: createStats({ flowState: 30, stressSpikes: 5 }) });

  App.animeData = [good, bad];
  App.filteredData = [good, bad];
  App.currentSort = 'retention';

  let resetCalled = false;
  let renderCalled = false;
  const originalReset = App.resetGridPagination;
  const originalRender = App.render;
  App.resetGridPagination = () => { resetCalled = true; };
  App.render = () => { renderCalled = true; };

  App.applyFilterPreset('binge-worthy');

  assert.equal(App.filteredData.length, 1);
  assert.equal(App.filteredData[0].id, good.id);
  assert.equal(App.currentSort, 'retention');
  assert.equal(document.getElementById('sort-select').value, 'retention');
  assert.equal(resetCalled, true);
  assert.equal(renderCalled, true);

  App.resetGridPagination = originalReset;
  App.render = originalRender;
});
