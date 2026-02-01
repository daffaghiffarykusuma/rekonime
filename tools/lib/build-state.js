import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

class BuildState {
  constructor({ stateFile } = {}) {
    this.stateFile = stateFile || path.join(process.cwd(), '.build-state.json');
    this.state = this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { version: 1, files: {}, lastBuild: null };
    }
  }

  save() {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  getKey(filePath) {
    if (!filePath) return '';
    return path.relative(process.cwd(), filePath);
  }

  getFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha1').update(content).digest('hex');
    } catch {
      return null;
    }
  }

  hasChanged(filePath) {
    const key = this.getKey(filePath);
    const currentHash = this.getFileHash(filePath);
    const previousHash = this.state.files[key]?.hash || null;
    return currentHash !== previousHash;
  }

  updateFile(filePath) {
    const key = this.getKey(filePath);
    const hash = this.getFileHash(filePath);
    if (!key) return;
    this.state.files[key] = {
      hash,
      timestamp: Date.now()
    };
  }

  markBuildComplete() {
    this.state.lastBuild = Date.now();
    this.save();
  }
}

export { BuildState };
