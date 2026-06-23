// ==================================
// PiFlex Settings Manager
// ==================================

const DEFAULT_SETTINGS = {
    theme: 'light',
    searchEngine: 'duckduckgo',
    backgroundImage: null
};

// Search Engines
const SEARCH_ENGINES = {
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' }
};

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        try {
            const data = localStorage.getItem('piflex_settings');
            return data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };
        } catch (e) {
            console.error('Failed to load settings:', e);
            return { ...DEFAULT_SETTINGS };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('piflex_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    getTheme() {
        return this.settings.theme;
    }

    setTheme(theme) {
        this.settings.theme = theme;
        this.saveSettings();
        this.applyTheme();
    }

    applyTheme() {
        if (this.settings.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }

    getSearchEngine() {
        return this.settings.searchEngine;
    }

    setSearchEngine(engineKey) {
        if (SEARCH_ENGINES[engineKey]) {
            this.settings.searchEngine = engineKey;
            this.saveSettings();
        }
    }

    getSearchUrl(query) {
        const engine = SEARCH_ENGINES[this.settings.searchEngine] || SEARCH_ENGINES.duckduckgo;
        return engine.url + encodeURIComponent(query);
    }

    getBackgroundImage() {
        return this.settings.backgroundImage;
    }

    setBackgroundImage(base64Data) {
        this.settings.backgroundImage = base64Data;
        this.saveSettings();
        this.applyBackground();
    }

    applyBackground() {
        const bgImage = this.settings.backgroundImage;
        document.querySelectorAll('.homepage').forEach(el => {
            if (bgImage) {
                el.style.backgroundImage = `url(${bgImage})`;
            } else {
                el.style.backgroundImage = 'none';
            }
        });
    }

    resetBackground() {
        this.settings.backgroundImage = null;
        this.saveSettings();
        this.applyBackground();
    }
}

// Instantiate globally
window.settingsMgr = new SettingsManager();

document.addEventListener('DOMContentLoaded', () => {
    // Populate settings UI
    const themeSelect = document.getElementById('themeSelect');
    const bgImageInput = document.getElementById('bgImageInput');
    const bgUploadBtn = document.getElementById('bgUploadBtn');
    const resetBgBtn = document.getElementById('resetBgBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettings = document.getElementById('closeSettings');
    const settingsPanel = document.getElementById('settingsPanel');
    
    const ollamaHostInput = document.getElementById('ollamaHostInput');
    const saveOllamaSettingsBtn = document.getElementById('saveOllamaSettingsBtn');

    // Load initial configurations
    window.settingsMgr.applyTheme();
    
    if (themeSelect) {
        themeSelect.value = window.settingsMgr.getTheme();
        themeSelect.addEventListener('change', (e) => {
            window.settingsMgr.setTheme(e.target.value);
        });
    }

    if (ollamaHostInput) {
        ollamaHostInput.value = localStorage.getItem('piflex_ollama_host') || 'http://localhost:11434';
    }

    if (saveOllamaSettingsBtn && ollamaHostInput) {
        saveOllamaSettingsBtn.addEventListener('click', () => {
            const host = ollamaHostInput.value.trim() || 'http://localhost:11434';
            localStorage.setItem('piflex_ollama_host', host);
            alert('Ollama Host connection updated!');
            if (window.aiAssistant) {
                window.aiAssistant.ollamaHost = host;
                window.aiAssistant.loadAvailableModels();
            }
        });
    }

    // Toggle Settings Panel
    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.add('open');
        });
    }

    if (closeSettings && settingsPanel) {
        closeSettings.addEventListener('click', () => {
            settingsPanel.classList.remove('open');
        });
    }

    // Background uploading
    if (bgUploadBtn && bgImageInput) {
        bgUploadBtn.addEventListener('click', () => bgImageInput.click());
        bgImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    window.settingsMgr.setBackgroundImage(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', () => {
            window.settingsMgr.resetBackground();
        });
    }
});