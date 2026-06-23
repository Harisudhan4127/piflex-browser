// =========================
// PiFlex Application Core
// =========================

window.PIFLEX = {
  version: "1.0.0",

  initialized: false,
};

// =========================
// Search Engine URLs
// =========================

const SEARCH_ENGINES = {
  duckduckgo: "https://duckduckgo.com/?q=",

  bing: "https://www.bing.com/search?q=",

  google: "https://www.google.com/search?q=",
};

// =========================
// Browser Startup
// =========================

function initializeBrowser() {
  if (window.PIFLEX.initialized) return;

  window.PIFLEX.initialized = true;

  registerShortcuts();

  showWelcomeMessage();
}
// =========================
// Homepage Loader
// =========================

function loadHomepage() {
  const homepage = getHomepage();

  const webview = document.getElementById("browserView");

  if (!webview) return;

  webview.loadURL(homepage);
}

// =========================
// Search Helper
// =========================

function performSearch(query) {
  const engine = getSearchEngine();

  const searchURL = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;

  navigate(searchURL + encodeURIComponent(query));
}

// =========================
// Keyboard Shortcuts
// =========================

function registerShortcuts() {
  document.addEventListener("keydown", (event) => {
    const ctrl = event.ctrlKey;

    // Ctrl + L
    if (ctrl && event.key === "l") {
      event.preventDefault();

      document.getElementById("urlBar").focus();
    }

    // Ctrl + T
    if (ctrl && event.key === "t") {
      event.preventDefault();

      createTab();
    }

    // Ctrl + W
    if (ctrl && event.key === "w") {
      event.preventDefault();

      if (activeTabId) {
        closeTab(activeTabId);
      }
    }

    // Ctrl + R
    if (ctrl && event.key === "r") {
      event.preventDefault();

      document.getElementById("browserView").reload();
    }

    // F5
    if (event.key === "F5") {
      event.preventDefault();

      document.getElementById("browserView").reload();
    }

    // ESC
    if (event.key === "Escape") {
      closeSettings();
    }
  });
}

// =========================
// Welcome Message
// =========================

function showWelcomeMessage() {
  console.log(
    `
==================================
 PiFlex Browser
 Version 1.0.0
 Raspberry Pi Edition
==================================
`,
  );
}

// =========================
// Status Monitor
// =========================

function startSystemMonitor() {
  setInterval(() => {
    const webview = document.getElementById("browserView");

    if (!webview) return;

    console.log("Current URL:", webview.getURL());
  }, 30000);
}

// =========================
// Browser Events
// =========================

window.addEventListener("DOMContentLoaded", () => {
  initializeBrowser();
});

// =========================
// Global Helpers
// =========================

window.performSearch = performSearch;

window.loadHomepage = loadHomepage;
