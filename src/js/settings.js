// =========================
// PiFlex Settings Manager
// =========================

const settingsPanel =
    document.getElementById(
        "settingsPanel"
    );

const settingsBtn =
    document.getElementById(
        "settingsBtn"
    );

const closeSettingsBtn =
    document.getElementById(
        "closeSettings"
    );

const homepageInput =
    document.getElementById(
        "homepageInput"
    );

const searchEngineSelect =
    document.getElementById(
        "searchEngine"
    );

// =========================
// Default Settings
// =========================

const DEFAULT_SETTINGS = {

    homepage:
        "https://duckduckgo.com",

    searchEngine:
        "duckduckgo",

    theme:
        "light"
};

// =========================
// Load Settings
// =========================

function loadSettings() {

    const saved =
        localStorage.getItem(
            "piflex-settings"
        );

    if (!saved) {

        saveSettings(
            DEFAULT_SETTINGS
        );

        return DEFAULT_SETTINGS;
    }

    try {

        return JSON.parse(saved);

    } catch {

        return DEFAULT_SETTINGS;
    }
}

// =========================
// Save Settings
// =========================

function saveSettings(settings) {

    localStorage.setItem(
        "piflex-settings",
        JSON.stringify(settings)
    );
}

// =========================
// Get Settings
// =========================

function getSettings() {

    return loadSettings();
}

// =========================
// Homepage
// =========================

function getHomepage() {

    const settings =
        getSettings();

    return settings.homepage;
}

function setHomepage(url) {

    const settings =
        getSettings();

    settings.homepage = url;

    saveSettings(settings);
}

// =========================
// Search Engine
// =========================

function getSearchEngine() {

    const settings =
        getSettings();

    return settings.searchEngine;
}

function setSearchEngine(engine) {

    const settings =
        getSettings();

    settings.searchEngine =
        engine;

    saveSettings(settings);
}

// =========================
// Theme
// =========================

function getTheme() {

    const settings =
        getSettings();

    return settings.theme;
}

function setTheme(theme) {

    const settings =
        getSettings();

    settings.theme = theme;

    saveSettings(settings);

    applyTheme(theme);
}

function applyTheme(theme) {

    document.body.classList.remove(
        "dark-theme"
    );

    if (
        theme === "dark"
    ) {

        document.body.classList.add(
            "dark-theme"
        );
    }
}

// =========================
// UI Sync
// =========================

function updateSettingsUI() {

    const settings =
        getSettings();

    homepageInput.value =
        settings.homepage;

    searchEngineSelect.value =
        settings.searchEngine;
}

// =========================
// Open / Close Panel
// =========================

function openSettings() {

    settingsPanel.classList.add(
        "open"
    );
}

function closeSettings() {

    settingsPanel.classList.remove(
        "open"
    );
}

// =========================
// Events
// =========================

settingsBtn.addEventListener(
    "click",
    () => {

        updateSettingsUI();

        openSettings();
    }
);

closeSettingsBtn.addEventListener(
    "click",
    () => {

        closeSettings();
    }
);

homepageInput.addEventListener(
    "change",
    () => {

        setHomepage(
            homepageInput.value
        );
    }
);

searchEngineSelect.addEventListener(
    "change",
    () => {

        setSearchEngine(
            searchEngineSelect.value
        );
    }
);

// =========================
// Startup
// =========================

window.addEventListener(
    "DOMContentLoaded",
    () => {

        updateSettingsUI();

        applyTheme(
            getTheme()
        );
    }
);