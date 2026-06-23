// =========================
// PiFlex Browser Engine
// =========================

const webview = document.getElementById("browserView");

const urlBar = document.getElementById("urlBar");

const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const reloadBtn = document.getElementById("reloadBtn");
const homeBtn = document.getElementById("homeBtn");
const goBtn = document.getElementById("goBtn");

// Default homepage
const HOME_URL = "https://duckduckgo.com";

// =========================
// URL Helpers
// =========================

function isValidUrl(text) {
  try {
    new URL(text);

    return true;
  } catch {
    return false;
  }
}

function convertInputToURL(input) {
  input = input.trim();

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  // Domain detection
  if (input.includes(".") && !input.includes(" ")) {
    return "https://" + input;
  }

  // Search query
  return "https://duckduckgo.com/?q=" + encodeURIComponent(input);
}

// =========================
// Navigation
// =========================

function navigate(input) {
  const targetURL = convertInputToURL(input);

  webview.loadURL(targetURL);
}

function goHome() {
  webview.loadURL(HOME_URL);
}

function reloadPage() {
  webview.reload();
}

function goBack() {
  if (webview.canGoBack()) {
    webview.goBack();
  }
}

function goForward() {
  if (webview.canGoForward()) {
    webview.goForward();
  }
}

// =========================
// Events
// =========================

goBtn.addEventListener("click", () => {
  navigate(urlBar.value);
});

urlBar.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    navigate(urlBar.value);
  }
});

backBtn.addEventListener("click", goBack);

forwardBtn.addEventListener("click", goForward);

reloadBtn.addEventListener("click", reloadPage);

homeBtn.addEventListener("click", goHome);

// =========================
// WebView Events
// =========================

webview.addEventListener("did-start-loading", () => {
  reloadBtn.innerHTML = "⏳";
});

webview.addEventListener("did-stop-loading", () => {
  reloadBtn.innerHTML = "⟳";
});

webview.addEventListener("did-navigate", (event) => {
  urlBar.value = event.url;
});

webview.addEventListener("did-navigate-in-page", (event) => {
  urlBar.value = event.url;
});

webview.addEventListener("page-title-updated", (event) => {
  document.title = event.title + " - PiFlex";
});

webview.addEventListener("did-fail-load", (event) => {
  console.error("Load failed:", event.errorDescription);
});

function navigate(input) {
  const targetURL = convertInputToURL(input);

  console.log("Navigating:", targetURL);

  webview.loadURL(targetURL);
}

// =========================
// Startup
// =========================

// window.addEventListener(
//     "DOMContentLoaded",
//     () => {

//         goHome();
//     }
// );
