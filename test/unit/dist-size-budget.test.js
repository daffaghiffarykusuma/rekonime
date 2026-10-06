import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('distribution budgets reject missing assets, oversized emitted JS, and every matching CSS file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-budget-'));
  const writeAsset = (name, bytes = 1) => {
    const target = path.join(root, 'dist', name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.alloc(bytes));
  };
  const run = () => spawnSync(process.execPath, [path.join(root, 'tools/check-dist-size-budget.js')], { encoding: 'utf8' });
  try {
    fs.mkdirSync(path.join(root, 'tools'));
    fs.copyFileSync('tools/check-dist-size-budget.js', path.join(root, 'tools/check-dist-size-budget.js'));
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    for (const name of ['js/data.js', 'data/anime.full.index.json', 'data/franchise-map.json',
      'js/app.js', 'fonts/phosphor-icons.woff2', 'css/main-test.css', 'css/watchlist.css']) writeAsset(name);
    assert.equal(run().status, 0);
    fs.unlinkSync(path.join(root, 'dist/js/app.js'));
    const missing = run();
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Required budgeted asset is missing: js\/app.js/);
    writeAsset('js/app.js', 200 * 1024);
    const oversized = run();
    assert.equal(oversized.status, 1);
    assert.match(oversized.stderr, /js\/app.js.*above budget/);
    writeAsset('js/app.js');
    writeAsset('css/main-z-second.css', 130 * 1024);
    const secondMatch = run();
    assert.equal(secondMatch.status, 1);
    assert.match(secondMatch.stderr, /main-z-second.css.*above budget/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
