'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Official llama.cpp release channel. Runtime binaries are only downloaded on
// explicit user action (or the first AI request), over HTTPS, from the
// canonical repository. No third-party mirrors are used.
const RELEASES_API = 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest';
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const SERVER_NAMES = process.platform === 'win32'
  ? ['llama-server.exe', 'server.exe']
  : ['llama-server', 'llama-server-bin', 'server'];

const GPU_KEYWORDS = ['cuda', 'cublas', 'vulkan', 'sycl', 'hip', 'kompute', 'metal', 'opencl'];

function isExecutableName(name) {
  return SERVER_NAMES.includes(name.toLowerCase());
}

/**
 * Finds a `llama-server` binary inside a directory tree.
 */
function findServerBinary(root, maxDepth = 6) {
  let best = null;
  const walk = (dir, depth) => {
    if (depth > maxDepth || best) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && isExecutableName(entry.name)) {
        best = full;
        return;
      }
    }
  };
  walk(root, 0);
  return best;
}

function assetScore(asset, platform, arch) {
  const name = String(asset.name || '').toLowerCase();
  if (!/\.(zip|tar\.gz|tgz)$/.test(name)) return -1;
  let score = 0;

  if (platform === 'win32') {
    if (!name.includes('win')) return -1;
  } else if (platform === 'darwin') {
    if (!name.includes('macos') && !name.includes('osx')) return -1;
  } else {
    if (!name.includes('linux') && !name.includes('ubuntu')) return -1;
  }

  const targetArch = arch === 'arm64' ? 'arm64' : arch === 'ia32' ? 'x86' : 'x64';
  if (name.includes(targetArch)) score += 8;
  else if (targetArch === 'x64' && (name.includes('x86_64') || name.includes('amd64'))) score += 8;
  else return -1;

  if (GPU_KEYWORDS.some((keyword) => name.includes(keyword))) score -= 20;
  if (name.includes('cpu') || name.includes('avx2') || name.includes('noavx')) score += 4;
  if (name.endsWith('.zip')) score += 2;
  return score;
}

class RuntimeService {
  constructor({ runtimeDir, logger, net, onProgress }) {
    this.runtimeDir = runtimeDir;
    this.logger = logger || { warn() {} };
    this.net = net;
    this.onProgress = onProgress || (() => {});
    this.active = null;
    this.lastError = null;
  }

  find() {
    if (!this.runtimeDir || !fs.existsSync(this.runtimeDir)) return null;
    return findServerBinary(this.runtimeDir);
  }

  status() {
    const executable = this.find();
    return { ready: !!executable, path: executable, dir: this.runtimeDir };
  }

  _emit(payload) {
    this.onProgress({ kind: 'runtime', ...payload });
  }

  async ensure() {
    const existing = this.find();
    if (existing) return existing;
    if (this.active) return this.active;

    this.active = this._install().finally(() => {
      this.active = null;
    });
    return this.active;
  }

  async _install() {
    fs.mkdirSync(this.runtimeDir, { recursive: true });
    this._emit({ phase: 'resolving', received: 0, total: 0, done: false });
    const release = await this._getJson(RELEASES_API);
    const candidates = (release.assets || [])
      .map((asset) => ({ asset, score: assetScore(asset, process.platform, process.arch) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score);
    const choice = candidates[0];
    if (!choice) {
      throw new Error(
        `No llama.cpp build is available for ${process.platform}/${process.arch}. ` +
          'Install llama.cpp and add llama-server to PATH instead.',
      );
    }

    const tag = String(release.tag_name || 'latest').replace(/[^a-z0-9._-]/gi, '');
    const targetDir = path.join(this.runtimeDir, `llama-${tag}`);
    const assetName = path.basename(String(choice.asset.name)).replace(/[^a-z0-9._-]/gi, '');
    const archive = path.join(this.runtimeDir, assetName || `llama-${tag}.zip`);

    this.logger.info('Downloading llama-server runtime', choice.asset.name);
    await this._download(choice.asset.browser_download_url, archive);

    this._emit({ phase: 'extracting', received: 0, total: 0, done: false, asset: choice.asset.name });
    fs.mkdirSync(targetDir, { recursive: true });
    await this._extract(archive, targetDir);
    try {
      fs.rmSync(archive, { force: true });
    } catch {
      // best-effort cleanup
    }

    const found = this.find();
    if (!found) {
      throw new Error('The downloaded archive did not contain llama-server');
    }
    try {
      if (process.platform !== 'win32') fs.chmodSync(found, 0o755);
    } catch {
      // ignore permission errors
    }
    this.lastError = null;
    this._emit({ phase: 'ready', received: 0, total: 0, done: true, path: found, asset: choice.asset.name });
    this.logger.info('llama-server runtime ready', found);
    return found;
  }

  _getJson(url) {
    return new Promise((resolve, reject) => {
      const request = this.net.request({
        method: 'GET',
        url,
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PiFlex-Browser' },
      });
      const chunks = [];
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Runtime release lookup failed (HTTP ${response.statusCode})`));
          request.abort();
          return;
        }
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(new Error('Runtime release lookup returned invalid JSON'));
          }
        });
        response.on('error', reject);
      });
      request.on('error', reject);
      request.end();
    });
  }

  _download(url, target) {
    return new Promise((resolve, reject) => {
      const partial = target + '.part';
      const request = this.net.request({ method: 'GET', url });
      let received = 0;
      const out = fs.createWriteStream(partial);

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          out.close();
          reject(new Error(`Runtime download failed (HTTP ${response.statusCode})`));
          request.abort();
          return;
        }
        const total = Number(response.headers['content-length']) || 0;
        response.on('data', (chunk) => {
          received += chunk.length;
          if (received > MAX_ARCHIVE_BYTES) {
            request.abort();
            out.close();
            reject(new Error('Runtime archive exceeds the size limit'));
            return;
          }
          out.write(chunk);
          this._emit({ phase: 'downloading', received, total, done: false });
        });
        response.on('end', () => {
          out.end(() => {
            try {
              fs.renameSync(partial, target);
            } catch (error) {
              reject(error);
              return;
            }
            resolve(target);
          });
        });
        response.on('error', (error) => {
          out.close();
          reject(error);
        });
      });
      request.on('error', (error) => {
        out.close();
        reject(error);
      });
      request.end();
    });
  }

  _extract(archive, targetDir) {
    return new Promise((resolve, reject) => {
      const isGzip = archive.endsWith('.tar.gz');
      const args = isGzip ? ['-xzf', archive, '-C', targetDir] : ['-xf', archive, '-C', targetDir];
      const child = spawn('tar', args, { windowsHide: true });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', () => {
        // Windows ships bsdtar, but fall back to PowerShell if it is missing.
        if (process.platform === 'win32') {
          this._extractPowerShell(archive, targetDir).then(resolve).catch(reject);
        } else {
          reject(new Error('Could not extract the runtime archive (tar is unavailable)'));
        }
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else if (process.platform === 'win32' && !archive.endsWith('.tar.gz')) {
          this._extractPowerShell(archive, targetDir).then(resolve).catch(reject);
        } else {
          reject(new Error(`Could not extract the runtime archive: ${stderr.trim() || `exit ${code}`}`));
        }
      });
    });
  }

  _extractPowerShell(archive, targetDir) {
    return new Promise((resolve, reject) => {
      const script =
        `Expand-Archive -LiteralPath ${JSON.stringify(archive)} -DestinationPath ${JSON.stringify(targetDir)} -Force`;
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true },
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Could not extract the runtime archive: ${stderr.trim() || `exit ${code}`}`));
      });
    });
  }

  destroy() {
    this.active = null;
  }
}

module.exports = { RuntimeService, assetScore, findServerBinary };
