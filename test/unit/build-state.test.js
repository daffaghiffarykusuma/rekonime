import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BuildState } from '../../tools/lib/build-state.js';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-build-state-'));

test('BuildState tracks file changes', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'sample.txt');
  const statePath = path.join(dir, '.build-state.json');

  fs.writeFileSync(filePath, 'first');
  const state = new BuildState({ stateFile: statePath });

  assert.equal(state.hasChanged(filePath), true);
  state.updateFile(filePath);
  state.markBuildComplete();
  assert.equal(state.hasChanged(filePath), false);

  fs.writeFileSync(filePath, 'second');
  assert.equal(state.hasChanged(filePath), true);
});
