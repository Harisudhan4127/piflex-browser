// ==================================
// PiFlex Tabs and Webview Manager
// ==================================

class TabManager {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.tabsListEl = document.getElementById('tabsList');
        this.pagesContainerEl = document.getElementById('pagesContainer');
        this.urlBar = document.getElementById('urlBar');

        this.setupGlobals();
    }

    setupGlobals() {
        // Expose helper functions globally
        window.createTab = (url) => this.createTab(url);
        window.closeTab = (id) => this.closeTab(id);
        window.switchTab = (id) => this.switchTab(id);
        window.performHomeSearch = () => this.performHomeSearch();
        window.navigateToHomeQuickLink = (url) => this.navigateToHomeQuickLink(url);
    }

    createTab(url = null) {
        const id = 'tab-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const tab = {
            id,
            title: 'New Tab',
            url: url,
            loading: false,
            webview: null
        };

        this.tabs.push(tab);
        this.createTabElement(tab);
        this.switchTab(id);
        this.renderTabsUI();

        if (url) {
            this.navigateTab(tab, url);
        }
        return tab;
    }

    createTabElement(tab) {
        // Create page view container
        const pageView = document.createElement('div');
        pageView.className = 'page-view';
        pageView.id = `view-${tab.id}`;
        
        // Render Homepage by default if no URL
        if (!tab.url) {
            pageView.innerHTML = this.renderHomepageHtml(tab.id);
        }
        
        this.pagesContainerEl.appendChild(pageView);
    }

    renderHomepageHtml(tabId) {
        const customBg = window.settingsMgr.getBackgroundImage();
        const styleAttr = customBg ? `style="background-image: url(${customBg})"` : '';
        
        return `
            <div class="homepage" ${styleAttr}>
                <div class="homepage-overlay"></div>
                <div class="homepage-content">
                    <div class="homepage-logo">🌐</div>
                    <h1>PiFlex Browser</h1>
                    <p style="color: var(--text-light); margin-bottom: 20px; font-size: 14px;">Lightweight browsing optimized for Raspberry Pi</p>
                    
                    <div class="home-search-box">
                        <input type="text" class="home-search-input" id="search-input-${tabId}" placeholder="Search the web with DuckDuckGo..." onkeydown="if(event.key === 'Enter') window.performHomeSearch()">
                        <button class="home-search-btn" onclick="window.performHomeSearch()">Search</button>
                    </div>

                    <div class="quick-links">
                        <a href="#" class="quick-link-item" onclick="window.navigateToHomeQuickLink('https://github.com'); return false;">
                            <div class="quick-link-icon-wrapper"><i class="fab fa-github"></i></div>
                            <span>GitHub</span>
                        </a>
                        <a href="#" class="quick-link-item" onclick="window.navigateToHomeQuickLink('https://reddit.com'); return false;">
                            <div class="quick-link-icon-wrapper"><i class="fab fa-reddit"></i></div>
                            <span>Reddit</span>
                        </a>
                        <a href="#" class="quick-link-item" onclick="window.navigateToHomeQuickLink('https://youtube.com'); return false;">
                            <div class="quick-link-icon-wrapper"><i class="fab fa-youtube"></i></div>
                            <span>YouTube</span>
                        </a>
                        <a href="#" class="quick-link-item" onclick="window.navigateToHomeQuickLink('https://wikipedia.org'); return false;">
                            <div class="quick-link-icon-wrapper"><i class="fas fa-book"></i></div>
                            <span>Wikipedia</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    switchTab(id) {
        const tab = this.tabs.find(t => t.id === id);
        if (!tab) return;

        this.activeTabId = id;

        // Toggle active page views
        document.querySelectorAll('.page-view').forEach(el => {
            el.classList.remove('active');
        });
        const activeView = document.getElementById(`view-${id}`);
        if (activeView) activeView.classList.add('active');

        // Update Address Bar & Navigation Buttons
        this.updateNavigationUI(tab);
        this.renderTabsUI();
    }

    closeTab(id) {
        // Don't close if it is the last tab; instead reset it to home
        if (this.tabs.length === 1) {
            const tab = this.tabs[0];
            this.goHome(tab);
            return;
        }

        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tabToClose = this.tabs[index];
        
        // Clean up webview and DOM
        if (tabToClose.webview) {
            tabToClose.webview.remove();
        }
        const viewEl = document.getElementById(`view-${id}`);
        if (viewEl) viewEl.remove();

        this.tabs.splice(index, 1);

        // Switch to adjacent tab if active tab was closed
        if (this.activeTabId === id) {
            const nextActiveIndex = Math.max(0, index - 1);
            this.switchTab(this.tabs[nextActiveIndex].id);
        } else {
            this.renderTabsUI();
        }
    }

    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }

    navigateActiveTab(url) {
        const tab = this.getActiveTab();
        if (tab) {
            const targetUrl = window.BrowserHelper.searchOrNavigate(url);
            this.navigateTab(tab, targetUrl);
        }
    }

    navigateTab(tab, url) {
        tab.url = url;
        const pageView = document.getElementById(`view-${tab.id}`);
        if (!pageView) return;

        // If no webview exists for this tab, create one
        if (!tab.webview) {
            pageView.innerHTML = ''; // Clear homepage layout
            
            const wv = document.createElement('webview');
            wv.setAttribute('src', url);
            wv.setAttribute('preload', 'preload.js');
            // Enable lightweight sandbox/isolation features
            wv.setAttribute('webpreferences', 'contextIsolation=true, nodeIntegration=false');
            
            tab.webview = wv;
            pageView.appendChild(wv);
            this.bindWebviewEvents(tab, wv);
        } else {
            tab.webview.loadURL(url);
        }

        this.urlBar.value = url;
    }

    goHome(tab = null) {
        if (!tab) tab = this.getActiveTab();
        if (!tab) return;

        tab.url = null;
        
        if (tab.webview) {
            tab.webview.remove();
            tab.webview = null;
        }

        const pageView = document.getElementById(`view-${tab.id}`);
        if (pageView) {
            pageView.innerHTML = this.renderHomepageHtml(tab.id);
            window.settingsMgr.applyBackground();
        }

        this.urlBar.value = '';
        this.updateNavigationUI(tab);
        this.renderTabsUI();
    }

    reloadTab(tab = null) {
        if (!tab) tab = this.getActiveTab();
        if (tab && tab.webview) {
            tab.webview.reload();
        }
    }

    goBack(tab = null) {
        if (!tab) tab = this.getActiveTab();
        if (tab && tab.webview && tab.webview.canGoBack()) {
            tab.webview.goBack();
        }
    }

    goForward(tab = null) {
        if (!tab) tab = this.getActiveTab();
        if (tab && tab.webview && tab.webview.canGoForward()) {
            tab.webview.goForward();
        }
    }

    bindWebviewEvents(tab, webview) {
        webview.addEventListener('did-start-loading', () => {
            tab.loading = true;
            this.updateLoadingIndicator(tab);
        });

        webview.addEventListener('did-stop-loading', () => {
            tab.loading = false;
            this.updateLoadingIndicator(tab);
            if (this.activeTabId === tab.id) {
                this.urlBar.value = webview.getURL();
                tab.url = webview.getURL();
            }
        });

        webview.addEventListener('page-title-updated', (e) => {
            tab.title = e.title;
            this.renderTabsUI();
        });

        // Set title and URL on successful navigation
        webview.addEventListener('did-navigate', (e) => {
            tab.url = e.url;
            if (this.activeTabId === tab.id) {
                this.urlBar.value = e.url;
                this.updateNavigationUI(tab);
            }
            this.renderTabsUI();
        });

        webview.addEventListener('did-navigate-in-page', (e) => {
            tab.url = e.url;
            if (this.activeTabId === tab.id) {
                this.urlBar.value = e.url;
            }
        });
    }

    updateLoadingIndicator(tab) {
        if (tab.id !== this.activeTabId) return;
        const reloadBtn = document.getElementById('reloadBtn');
        if (reloadBtn) {
            if (tab.loading) {
                reloadBtn.innerHTML = '<i class="fas fa-times"></i>';
                reloadBtn.title = 'Stop Loading';
            } else {
                reloadBtn.innerHTML = '<i class="fas fa-redo"></i>';
                reloadBtn.title = 'Reload Page';
            }
        }
    }

    updateNavigationUI(tab) {
        const backBtn = document.getElementById('backBtn');
        const forwardBtn = document.getElementById('forwardBtn');

        if (tab.webview) {
            // Webview state might take a split second to load, so poll/check safety
            try {
                backBtn.disabled = !tab.webview.canGoBack();
                forwardBtn.disabled = !tab.webview.canGoForward();
            } catch (e) {
                backBtn.disabled = true;
                forwardBtn.disabled = true;
            }
        } else {
            backBtn.disabled = true;
            forwardBtn.disabled = true;
        }

        this.urlBar.value = tab.url || '';
        this.updateLoadingIndicator(tab);
    }

    renderTabsUI() {
        this.tabsListEl.innerHTML = this.tabs.map(tab => {
            const isActive = tab.id === this.activeTabId;
            const title = tab.url ? tab.title : 'New Tab';
            return `
                <div class="tab ${isActive ? 'active' : ''}" onclick="window.switchTab('${tab.id}')">
                    <span class="tab-title">${title}</span>
                    <span class="tab-close" onclick="event.stopPropagation(); window.closeTab('${tab.id}')">
                        <i class="fas fa-times"></i>
                    </span>
                </div>
            `;
        }).join('');
    }

    performHomeSearch() {
        const tab = this.getActiveTab();
        if (!tab) return;
        const searchInput = document.getElementById(`search-input-${tab.id}`);
        if (searchInput && searchInput.value.trim()) {
            this.navigateActiveTab(searchInput.value.trim());
        }
    }

    navigateToHomeQuickLink(url) {
        this.navigateActiveTab(url);
    }
}

window.tabManager = new TabManager();
