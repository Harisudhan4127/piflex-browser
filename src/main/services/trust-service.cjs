'use strict';

/**
 * Coordinates "clear browsing data" across history, downloads, cookies, cache
 * and credentials. Each destructive action is opt-in and reported back with
 * what actually happened.
 */
class TrustService {
  constructor({ historyService, downloadService, credentialService, autofillService, sessions, logger }) {
    this.history = historyService;
    this.downloads = downloadService;
    this.credentials = credentialService;
    this.autofill = autofillService;
    this.sessions = sessions; // array of Electron sessions to clear
    this.logger = logger || { warn() {} };
  }

  async clear(options = {}) {
    const result = {
      history: 0,
      downloads: 0,
      cookies: false,
      cache: false,
      credentials: 0,
    };

    if (options.history) {
      result.history = this.history.clear({ since: options.since || 0 });
    }
    if (options.downloads) {
      this.downloads.clear();
      result.downloads = 1;
    }
    if (options.credentials) {
      this.credentials.clear();
      this.autofill.clear();
      result.credentials = 1;
    }
    if (options.cookies) {
      for (const session of this.sessions || []) {
        try {
          await session.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage'] });
          result.cookies = true;
        } catch (error) {
          this.logger.warn('Cookie clear failed', error.message);
        }
      }
    }
    if (options.cache) {
      for (const session of this.sessions || []) {
        try {
          await session.clearCache();
          result.cache = true;
        } catch (error) {
          this.logger.warn('Cache clear failed', error.message);
        }
      }
    }
    return result;
  }
}

module.exports = { TrustService };
