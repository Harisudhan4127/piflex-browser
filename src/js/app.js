// ==================================
// PiFlex Browser Application Controller (Version 1.2.0)
// ==================================

document.addEventListener('DOMContentLoaded', () => {
    const urlBar = document.getElementById('urlBar');
    const backBtn = document.getElementById('backBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const homeBtn = document.getElementById('homeBtn');
    const newTabBtn = document.getElementById('newTabBtn');

    // Register Button Events
    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => {
            window.tabManager.createTab();
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.tabManager.goBack();
        });
    }

    if (forwardBtn) {
        forwardBtn.addEventListener('click', () => {
            window.tabManager.goForward();
        });
    }

    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            const tab = window.tabManager.getActiveTab();
            if (tab) {
                if (tab.loading && tab.webview) {
                    tab.webview.stop();
                } else {
                    window.tabManager.reloadTab();
                }
            }
        });
    }

    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.tabManager.goHome();
        });
    }

    // Address Bar Navigation
    if (urlBar) {
        urlBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && urlBar.value.trim()) {
                window.tabManager.navigateActiveTab(urlBar.value.trim());
                urlBar.blur();
            }
        });

        urlBar.addEventListener('click', () => {
            urlBar.select();
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        // Ctrl + T: New Tab
        if (ctrl && e.key.toLowerCase() === 't') {
            e.preventDefault();
            window.tabManager.createTab();
        }

        // Ctrl + W: Close Tab
        if (ctrl && e.key.toLowerCase() === 'w') {
            e.preventDefault();
            const activeTab = window.tabManager.getActiveTab();
            if (activeTab) {
                window.tabManager.closeTab(activeTab.id);
            }
        }

        // Ctrl + R / F5: Reload Page
        if ((ctrl && e.key.toLowerCase() === 'r') || e.key === 'F5') {
            e.preventDefault();
            window.tabManager.reloadTab();
        }

        // Ctrl + L: Focus Address Bar
        if (ctrl && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            if (urlBar) {
                urlBar.focus();
                urlBar.select();
            }
        }

        // Ctrl + Shift + A: Toggle AI Sidebar
        if (ctrl && shift && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            if (window.aiAssistant) {
                window.aiAssistant.toggleSidebar();
            }
        }

        // Escape: Close Settings Panel
        if (e.key === 'Escape') {
            const settingsPanel = document.getElementById('settingsPanel');
            if (settingsPanel && settingsPanel.classList.contains('open')) {
                settingsPanel.classList.remove('open');
            }
        }
    });

    // Bookmark star: toggles bookmark of the current page
    const starBtn = document.getElementById('bookmarkStarBtn');
    if (starBtn && window.piflexApi) {
        const refreshStar = async () => {
            const tab = window.tabManager.getActiveTab();
            if (!tab || !tab.url || !/^https?:/i.test(tab.url)) {
                starBtn.innerHTML = '<i class="far fa-star"></i>';
                return;
            }
            const has = await window.piflexApi.bookmarksHas(tab.url);
            starBtn.innerHTML = has ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
            starBtn.title = has ? 'Remove bookmark' : 'Bookmark this page';
            starBtn.dataset.hasBookmark = has ? '1' : '';
        };
        starBtn.addEventListener('click', async () => {
            const tab = window.tabManager.getActiveTab();
            if (!tab || !tab.url || !/^https?:/i.test(tab.url)) return;
            if (starBtn.dataset.hasBookmark) {
                const items = await window.piflexApi.bookmarksList();
                const target = items.find(b => b.url === tab.url);
                if (target) await window.piflexApi.bookmarksRemove(target.id);
            } else {
                await window.piflexApi.bookmarksAdd({ title: tab.title || tab.url, url: tab.url });
            }
            refreshStar();
            window.dataPanels?.render();
        });
        // Re-check star state on navigation
        document.addEventListener('piflex:urlChanged', refreshStar);
        const origUpdateNav = window.tabManager.updateNavigationUI.bind(window.tabManager);
        window.tabManager.updateNavigationUI = (tab) => {
            origUpdateNav(tab);
            refreshStar();
        };
        refreshStar();
    }

    // Data panels shortcut: Ctrl+B toggles bookmarks panel, Escape closes it
    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            if (window.dataPanels) {
                window.dataPanels.isOpen() ? window.dataPanels.close() : window.dataPanels.open();
            }
        }
        if (e.key === 'Escape' && window.dataPanels?.isOpen()) {
            window.dataPanels.close();
        }
    });

    // Create Initial Tab
    window.tabManager.createTab();
    
    // Apply background theme if stored
    window.settingsMgr.applyBackground();
});
