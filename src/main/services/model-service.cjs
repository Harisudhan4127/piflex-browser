'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getCatalog } = require('../../../core/ai/catalog');

/**
 * Downloads curated GGUF models on explicit user request. Computes and reports
 * the SHA-256 of each finished file so users can verify it against the upstream
 * source. Never downloads without a user action.
 */
class ModelService {
  constructor({ modelsDir, logger, net, onProgress }) {
    this.modelsDir = modelsDir;
    this.logger = logger || { warn() {} };
    this.net = net;
    this.onProgress = onProgress || (() => {});
    this.active = null;
  }

  catalog() {
    return getCatalog();
  }

  installed() {
    try {
      return fs
        .readdirSync(this.modelsDir)
        .filter((f) => f.toLowerCase().endsWith('.gguf'))
        .map((file) => {
          const full = path.join(this.modelsDir, file);
          const stat = fs.statSync(full);
          return { path: full, file, sizeBytes: stat.size };
        });
    } catch {
      return [];
    }
  }

  async download(modelId, requestId) {
    const entry = this.catalog().find((m) => m.id === modelId);
    if (!entry) throw new Error('Unknown model');
    if (this.active) throw new Error('A model download is already in progress');
    fs.mkdirSync(this.modelsDir, { recursive: true });
    const target = path.join(this.modelsDir, path.basename(new URL(entry.url).pathname));
    const partial = target + '.part';

    return new Promise((resolve, reject) => {
      const request = this.net.request({ method: 'GET', url: entry.url });
      this.active = { request, target };
      const hash = crypto.createHash('sha256');
      let received = 0;
      const out = fs.createWriteStream(partial);

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          this.active = null;
          out.close();
          reject(new Error(`HTTP ${response.statusCode}`));
          request.abort();
          return;
        }
        const total = Number(response.headers['content-length']) || 0;
        response.on('data', (chunk) => {
          received += chunk.length;
          hash.update(chunk);
          out.write(chunk);
          this.onProgress({ requestId, modelId, received, total, done: false });
        });
        response.on('end', () => {
          out.end(() => {
            try {
              fs.renameSync(partial, target);
            } catch (error) {
              reject(error);
              return;
            }
            const sha256 = hash.digest('hex');
            this.active = null;
            this.onProgress({ requestId, modelId, received, total, done: true, sha256, path: target });
            resolve({ path: target, sha256, sizeBytes: received });
          });
        });
        response.on('error', (error) => {
          this.active = null;
          out.close();
          reject(error);
        });
      });
      request.on('error', (error) => {
        this.active = null;
        out.close();
        reject(error);
      });
      request.end();
    });
  }

  cancel() {
    if (this.active) {
      try {
        this.active.request.abort();
      } catch {
        // ignore
      }
      this.active = null;
    }
  }

  remove(filePath) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(this.modelsDir))) throw new Error('Refusing to remove a file outside the models directory');
    fs.rmSync(resolved, { force: true });
    return true;
  }
}

module.exports = { ModelService };
