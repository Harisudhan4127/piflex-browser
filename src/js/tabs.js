// =========================
// PiFlex Tab Manager
// =========================

let tabs = [];

let activeTabId = null;

const tabsContainer = document.getElementById("tabsContainer");

const newTabBtn = document.getElementById("newTabBtn");

const webview = document.getElementById("browserView");

// =========================
// Create Tab
// =========================

function createTab(title = "New Tab", url = "https://duckduckgo.com") {
  const id = Date.now().toString();

  const tab = {
    id,
    title,
    url,
  };

  tabs.push(tab);

  activeTabId = id;

  renderTabs();

  loadTab(tab);

  return tab;
}

// =========================
// Switch Tab
// =========================

function switchTab(id) {
  const tab = tabs.find((t) => t.id === id);

  if (!tab) return;

  activeTabId = id;

  renderTabs();

  loadTab(tab);
}

// =========================
// Close Tab
// =========================

function closeTab(id) {
  if (tabs.length === 1) {
    return;
  }

  const index = tabs.findIndex((t) => t.id === id);

  tabs = tabs.filter((t) => t.id !== id);

  if (activeTabId === id) {
    const nextTab = tabs[Math.max(0, index - 1)];

    activeTabId = nextTab.id;

    loadTab(nextTab);
  }

  renderTabs();
}

// =========================
// Load Tab
// =========================

function loadTab(tab) {
  if (!tab) return;

  urlBar.value = tab.url;

  navigate(tab.url);
}

// =========================
// Update Current Tab
// =========================

function updateCurrentTab(title, url) {
  const tab = tabs.find((t) => t.id === activeTabId);

  if (!tab) return;

  if (title) tab.title = title;

  if (url) tab.url = url;

  renderTabs();
}

// =========================
// Render Tabs
// =========================

function renderTabs() {
  const html = tabs
    .map((tab) => {
      return `
            <div
                class="tab ${tab.id === activeTabId ? "active" : ""}"
                data-id="${tab.id}"
            >

                <span class="tab-title">
                    ${tab.title}
                </span>

                <span
                    class="tab-close"
                    data-close="${tab.id}"
                >
                    ×
                </span>

            </div>
            `;
    })
    .join("");

  tabsContainer.innerHTML = html;

  document.querySelectorAll(".tab").forEach((tabEl) => {
    tabEl.addEventListener("click", () => {
      switchTab(tabEl.dataset.id);
    });
  });

  document.querySelectorAll(".tab-close").forEach((closeBtn) => {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      closeTab(closeBtn.dataset.close);
    });
  });
}

// =========================
// New Tab Button
// =========================

newTabBtn.addEventListener("click", () => {
  createTab();
});

// =========================
// Sync with Browser
// =========================

webview.addEventListener("did-navigate", (event) => {
  updateCurrentTab(null, event.url);
});

webview.addEventListener("page-title-updated", (event) => {
  updateCurrentTab(event.title, null);
});

// =========================
// Initial Tab
// =========================

// window.addEventListener("DOMContentLoaded", () => {
//   createTab();
// });

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    createTab("Home", "https://example.com");
  }, 300);
});
