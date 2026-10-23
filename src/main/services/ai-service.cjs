'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getCatalog } = require('../../../core/ai/catalog');
const { redactSensitiveText, buildMessages } = require('../../../core/ai/prompt');
const { recommendedContextTokens } = require('../../../core/ai/memory');

const HEALTH_TIMEOUT_MS = 120000;
const STARTUP_POLL_MS = 500;

/**
 * Manages an optional on-device assistant. Supports a locally-managed
 * llama.cpp server or an external Ollama endpoint. Inference is proxied through
 * the main process so the renderer never touches the network directly.
 */
class AiService {
  constructor({ settingsService, modelsDir, runtimeDir, runtimeService, modelService, logger, net, onStatus, onStream }) {
    this.settings = settingsService;
    this.modelsDir = modelsDir;
    this.runtimeDir = runtimeDir;
    this.runtimeService = runtimeService || null;
    this.modelService = modelService || null;
    this.logger = logger || { warn() {} };
    this.net = net;
    this.onStatus = onStatus || (() => {});
    this.onStream = onStream || (() => {});
    this.server = null;
    this.serverModelPath = null;
    this.state = 'stopped';
    this.lastError = null;
    this.activeRequest = null;
    this.unloadTimer = null;
    this.provisioning = false;
  }

  getConfig() {
    return this.settings.get().ai || {};
  }

  get status() {
    return {
      enabled: !!this.getConfig().enabled,
      provider: this.getConfig().provider || 'llamacpp',
      ready: this.state === 'ready',
      modelId: this.getConfig().modelId || null,
      installedModels: this.installedModels(),
      runtimeReady: !!this._findRuntime(),
      provisioning: this.provisioning,
      message: this.lastError || (this.state === 'ready' ? 'Ready' : this.state),
    };
  }

  _emitStatus() {
    this.onStatus(this.status);
  }

  installedModels() {
    try {
      return fs
        .readdirSync(this.modelsDir)
        .filter((f) => f.toLowerCase().endsWith('.gguf'))
        .map((f) => path.join(this.modelsDir, f));
    } catch {
      return [];
    }
  }

  resolvedModelPath() {
    const config = this.getConfig();
    if (config.modelPath && fs.existsSync(config.modelPath)) return config.modelPath;
    if (config.modelId) {
      const catalog = getCatalog();
      const entry = catalog.find((m) => m.id === config.modelId);
      if (entry) {
        const guess = path.join(this.modelsDir, path.basename(new URL(entry.url).pathname));
        if (fs.existsSync(guess)) return guess;
      }
    }
    const installed = this.installedModels();
    return installed.length ? installed[0] : null;
  }

  baseUrl() {
    const config = this.getConfig();
    if (config.provider === 'ollama') return config.endpoint.replace(/\/+$/, '');
    if (config.provider === 'openai-compatible') return config.endpoint.replace(/\/+$/, '');
    return `http://127.0.0.1:${config.port || 18080}`;
  }

  _findRuntime() {
    const config = this.getConfig();
    if (config.runtimePath && fs.existsSync(config.runtimePath)) return config.runtimePath;
    if (this.runtimeService) {
      const found = this.runtimeService.find();
      if (found) return found;
    }

    // Search in runtime directory
    const candidates = process.platform === 'win32'
      ? ['llama-server.exe', 'llama-server', 'llama-server.cmd', 'server.exe']
      : ['llama-server', 'server', 'llama-server-bin'];
    for (const name of candidates) {
      const full = path.join(this.runtimeDir, name);
      if (fs.existsSync(full)) return full;
    }

    // Also check common locations relative to app
    const appRoot = path.resolve(this.runtimeDir, '..', '..');
    for (const name of candidates) {
      const locations = [
        path.join(appRoot, 'resources', name),
        path.join(appRoot, name),
        path.join(process.resourcesPath || '', name),
      ];
      for (const loc of locations) {
        if (fs.existsSync(loc)) return loc;
      }
    }

    // Try to find in PATH
    try {
      const { spawnSync } = require('child_process');
      const which = process.platform === 'win32' ? 'where' : 'which';
      const cmd = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
      const result = spawnSync(which, [cmd], { timeout: 2000 });
      if (result.status === 0 && result.stdout) {
        const found = String(result.stdout).split(/\r?\n/)[0].trim();
        if (found && fs.existsSync(found)) return found;
      }
    } catch {}

    return null;
  }

  async ensureServer() {
    const config = this.getConfig();
    if (!config.enabled) throw new Error('AI features are disabled in Settings');
    if (config.provider !== 'llamacpp') return;
    if (this.server && this.state === 'ready') return;

    const modelPath = this.resolvedModelPath();
    if (!modelPath) throw new Error('No GGUF model is installed');
    let runtime = this._findRuntime();
    if (!runtime && this.runtimeService) {
      // Zero-config path: fetch the official llama.cpp server build on first use.
      try {
        runtime = await this.runtimeService.ensure();
      } catch (error) {
        this.lastError = `Could not set up the local AI runtime: ${error.message}`;
        this.state = 'error';
        this._emitStatus();
        throw new Error(this.lastError);
      }
    }
    if (!runtime) {
      throw new Error('llama-server runtime was not found. Install llama.cpp and add llama-server to PATH.');
    }

    if (this.server && this.serverModelPath !== modelPath) this.stopServer();

    this.state = 'starting';
    this._emitStatus();

    const args = [
      '-m', modelPath,
      '--port', String(config.port || 18080),
      '-c', String(this._contextTokens()),
      '--host', '127.0.0.1',
      '-t', String(config.threads === 'auto' ? Math.max(1, require('os').cpus().length - 1) : config.threads),
    ];
    if (config.gpuLayers !== 'auto') args.push('-ngl', String(config.gpuLayers));

    this.server = spawn(runtime, args, { cwd: path.dirname(runtime), windowsHide: true });
    this.serverModelPath = modelPath;
    this.server.stderr.on('data', (data) => this.logger.debug('llama-server:', String(data).trim()));
    this.server.on('exit', (code) => {
      if (this.server) {
        this.logger.warn('llama-server exited', code);
        this.server = null;
        this.state = 'stopped';
        this._emitStatus();
      }
    });

    await this._waitForHealth();
    this.state = 'ready';
    this.lastError = null;
    this._emitStatus();
  }

  _contextTokens() {
    const config = this.getConfig();
    const catalog = getCatalog();
    return recommendedContextTokens(this.settings.get(), catalog, require('os'));
  }

  async _waitForHealth() {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (!this.server) throw new Error('The local model process exited during startup');
      const ok = await this._ping(this.baseUrl() + '/health').catch(() => false);
      if (ok) return true;
      await new Promise((r) => setTimeout(r, STARTUP_POLL_MS));
    }
    throw new Error('The local model did not become ready in time');
  }

  _ping(url) {
    return new Promise((resolve) => {
      const request = this.net.request({ method: 'GET', url });
      request.on('response', (response) => {
        resolve(response.statusCode >= 200 && response.statusCode < 500);
        request.abort();
      });
      request.on('error', () => resolve(false));
      request.end();
    });
  }

  stopServer() {
    if (!this.server) {
      this.state = 'stopped';
      this._emitStatus();
      return;
    }
    const child = this.server;
    this.server = null;
    this.serverModelPath = null;
    try {
      child.kill();
    } catch (error) {
      this.logger.warn('Failed to stop llama-server', error.message);
    }
    this.state = 'stopped';
    this._emitStatus();
  }

  /**
   * First-run convenience: fetch the managed llama.cpp build and the smallest
   * curated GGUF model in the background so the assistant works without any
   * manual setup. Users can disable this with the `autoSetup` setting.
   */
  async autoProvision() {
    const config = this.getConfig();
    if (!config.enabled || config.autoSetup === false) return;
    if (this.provisioning) return;
    if (!this.runtimeService || !this.modelService) return;
    if (this._findRuntime() && this.resolvedModelPath()) return;

    this.provisioning = true;
    this.state = 'provisioning';
    this.lastError = null;
    this._emitStatus();
    try {
      if (!this._findRuntime()) await this.runtimeService.ensure();
      if (!this.resolvedModelPath()) {
        const choice = getCatalog()[0];
        if (!choice) throw new Error('No model is available in the catalog');
        // Use the same requestId convention as ModelService expects.
        const requestId = `autoprovision-${Date.now().toString(36)}`;
        const result = await this.modelService.download(choice.id, requestId);
        this.settings.update({ ai: { modelId: choice.id, modelPath: result.path } });
      }
      this.state = 'stopped';
    } catch (error) {
      this.lastError = `Automatic AI setup failed: ${error.message}`;
      this.state = 'error';
      this.logger.warn(this.lastError);
    } finally {
      this.provisioning = false;
      this._emitStatus();
    }
  }

  async restart() {
    this.stopServer();
    await this.ensureServer();
  }

  /**
   * Stream a chat completion. `requestId` correlates stream events back to the
   * renderer's conversation.
   *
   * `request` is a structured context assembled by the renderer:
   *   { history, userText, pageText, pageTitle, selectionText }
   * Page text and selection are treated as untrusted input and are sanitized and
   * redacted inside buildMessages before they ever reach the model.
   */
  async chat(requestId, request, { allowPageContext = true } = {}) {
    const config = this.getConfig();
    if (!config.enabled) throw new Error('AI features are disabled in Settings');

    const input = request && typeof request === 'object' ? request : {};
    const userText = String(input.userText || '').trim();
    // Page/selection context is gated by a main-process setting; the renderer
    // cannot opt itself in.
    const pageAllowed = allowPageContext && config.allowPageContext !== false;
    const pageText = pageAllowed ? input.pageText : '';
    const selectionText = pageAllowed ? input.selectionText : '';
    if (!userText && !pageText && !selectionText) {
      throw new Error('No prompt or page context was supplied');
    }

    const payload = buildMessages({
      history: input.history,
      userText: userText || (selectionText ? 'Explain the selected text.' : 'Summarize this page.'),
      pageText,
      pageTitle: pageAllowed ? input.pageTitle : '',
      selectionText,
      contextTokens: this._contextTokens(),
    }).map((message) => ({
      ...message,
      content: redactSensitiveText(message.content || ''),
    }));

    if (config.provider === 'llamacpp') {
      await this.ensureServer();
      if (!this.server) throw new Error(this.lastError || 'The local model is not ready');
      return this._streamOpenAi(requestId, this.baseUrl() + '/v1/chat/completions', payload, config, false);
    }
    const base = this.baseUrl();
    if (!/^https?:\/\//i.test(base)) throw new Error('No valid AI endpoint is configured');
    if (config.provider === 'ollama') {
      return this._streamOllama(requestId, base + '/api/chat', payload, config);
    }
    return this._streamOpenAi(requestId, base + '/v1/chat/completions', payload, config, true);
  }

  cancel() {
    if (this.activeRequest) {
      try {
        this.activeRequest.abort();
      } catch {
        // ignore
      }
      this.activeRequest = null;
    }
  }

  _streamOpenAi(requestId, url, messages, config, needsKey) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: config.modelId || 'local',
        messages,
        stream: true,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      });
      const request = this.net.request({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
      });
      this.activeRequest = request;
      let buffer = '';
      let full = '';
      request.on('response', (response) => {
        if (response.statusCode >= 400) {
          reject(new Error(`AI endpoint returned HTTP ${response.statusCode}`));
          request.abort();
          return;
        }
        response.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
              if (delta && delta.content) {
                full += delta.content;
                this.onStream({ requestId, token: delta.content, done: false });
              }
            } catch {
              // ignore malformed SSE fragment
            }
          }
        });
        response.on('end', () => {
          this.activeRequest = null;
          this.onStream({ requestId, token: '', done: true });
          resolve(full);
        });
        response.on('error', reject);
      });
      request.on('error', (error) => {
        this.activeRequest = null;
        reject(error);
      });
      request.write(body);
      request.end();
    });
  }

  _streamOllama(requestId, url, messages, config) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: config.modelId || 'llama3.2',
        messages,
        stream: true,
        options: { temperature: config.temperature, num_predict: config.maxTokens, num_ctx: config.contextTokens },
      });
      const request = this.net.request({ method: 'POST', url, headers: { 'Content-Type': 'application/json' } });
      this.activeRequest = request;
      let buffer = '';
      let full = '';
      request.on('response', (response) => {
        if (response.statusCode >= 400) {
          reject(new Error(`Ollama returned HTTP ${response.statusCode}`));
          request.abort();
          return;
        }
        response.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              const token = parsed.message && parsed.message.content;
              if (token) {
                full += token;
                this.onStream({ requestId, token, done: false });
              }
            } catch {
              // ignore
            }
          }
        });
        response.on('end', () => {
          this.activeRequest = null;
          this.onStream({ requestId, token: '', done: true });
          resolve(full);
        });
        response.on('error', reject);
      });
      request.on('error', (error) => {
        this.activeRequest = null;
        reject(error);
      });
      request.write(body);
      request.end();
    });
  }

  _scheduleUnload() {
    const config = this.getConfig();
    if (!config.autoUnloadMinutes) return;
    if (this.unloadTimer) clearTimeout(this.unloadTimer);
    this.unloadTimer = setTimeout(() => this.stopServer(), config.autoUnloadMinutes * 60000);
    if (this.unloadTimer.unref) this.unloadTimer.unref();
  }

  destroy() {
    if (this.unloadTimer) clearTimeout(this.unloadTimer);
    this.stopServer();
  }
}

module.exports = { AiService };
