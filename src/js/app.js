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

    // Create Initial Tab
    window.tabManager.createTab();
    
    // Apply background theme if stored
    window.settingsMgr.applyBackground();
});
