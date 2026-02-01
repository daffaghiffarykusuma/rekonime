import test from 'node:test';
import assert from 'node:assert/strict';
import { MetricGlossary } from '../../js/metricGlossary.js';

test('MetricGlossary get returns definitions', () => {
  const def = MetricGlossary.get('retentionScore');
  assert.ok(def);
  assert.equal(def.title.includes('Retention'), true);
});

test('MetricGlossary formatValue formats key types', () => {
  assert.equal(MetricGlossary.formatValue('retentionScore', 88.8), '89%');
  assert.equal(MetricGlossary.formatValue('satisfactionScore', 8.25), '8.3/10');
  assert.equal(MetricGlossary.formatValue('momentum', 5), '+5');
});

test('MetricGlossary parseRange handles below and ranges', () => {
  assert.deepEqual(MetricGlossary.parseRange('90-100'), [90, 100]);
  assert.deepEqual(MetricGlossary.parseRange('Below 6'), [0, 6]);
});

test('MetricGlossary interpretValue returns scale match', () => {
  const interpretation = MetricGlossary.interpretValue('retentionScore', 80);
  assert.ok(interpretation);
  assert.equal(Boolean(interpretation.label), true);
});

test('MetricGlossary getTooltip builds content', () => {
  const html = MetricGlossary.getTooltip('retentionScore', 80);
  assert.equal(typeof html, 'string');
  assert.ok(html.includes('Retention'));
});
