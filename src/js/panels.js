// ==================================
// PiFlex Data Panels + Protection Indicator (v1.3.0)
// Bookmarks / History / Downloads + per-site adblock controls.
// ==================================

class DataPanels {
    constructor() {
        this.panel = document.getElementById('dataPanel');
        this.titleEl = document.getElementById('dataPanelTitle');
        this.contentEl = document.getElementById('dataPanelContent');
        this.toolbarEl = document.getElementById('dataToolbar');
        this.openBtn = document.getElementById('dataPanelBtn');
        this.closeBtn = document.getElementById('closeDataPanel');
        this.activeTab = 'bookmarks';

        this.init();
    }

    init() {
        if (!API_AVAILABLE()) return;
        if (this.openBtn) this.openBtn.addEventListener('click', () => this.open());
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        document.querySelectorAll('.data-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.data-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeTab = btn.dataset.tab;
                this.render();
            });
        });

        // Live download updates while panel or badge visible
        window.piflexApi.onDownloadEvent(() => {
            if (this.activeTab === 'downloads' && this.isOpen()) this.renderDownloads();
        });
        window.piflexApi.onAdblockStatus(() => this.renderAdblockSettings());
        this.renderAdblockSettings();
    }

    open() {
        this.panel.classList.add('open');
        this.render();
    }
    close() { this.panel.classList.remove('open'); }
    isOpen() { return this.panel.classList.contains('open'); }

    async render() {
        if (!this.panel) return;
        this.titleEl.textContent = this.activeTab[0].toUpperCase() + this.activeTab.slice(1);
        if (this.activeTab === 'bookmarks') await this.renderBookmarks();
        else if (this.activeTab === 'history') await this.renderHistory();
        else this.renderDownloads();
    }

    // ---- Bookmarks ----
    async renderBookmarks() {
        const items = await window.piflexApi.bookmarksList();
        this.setContent(`
            <div class="data-item head"><span>Folder</span></div>
            ${items.length === 0 ? '<div class="data-empty">No bookmarks yet. Use the star button.</div>' : ''}
            ${items.map(b => `
                <div class="data-item">
                    <a href="#" class="data-link" data-url="${escAttr(b.url)}" title="${escAttr(b.title)}">
                        <i class="fas fa-folder"></i> ${escText(b.title)}
                    </a>
                    <button class="icon-btn data-del" data-id="${escAttr(b.id)}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            `).join('')}
        `);
        this.bindLinks();
        this.contentEl.querySelectorAll('.data-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                await window.piflexApi.bookmarksRemove(btn.dataset.id);
                this.renderBookmarks();
            });
        });
    }

    // ---- History ----
    async renderHistory() {
        const items = await window.piflexApi.historySearch('');
        this.setToolbar(`
            <input type="text" id="historySearchBox" placeholder="Search history…">
            <button id="historyClearHour" class="secondary-btn">Clear last hour</button>
            <button id="historyClearAll" class="secondary-btn">Clear all</button>
        `);
        const box = document.getElementById('historySearchBox');
        box?.addEventListener('input', async () => {
            const q = await window.piflexApi.historySearch(box.value);
            this.renderHistoryList(q);
        });
        document.getElementById('historyClearHour')?.addEventListener('click', async () => {
            await window.piflexApi.historyClear(1); this.renderHistory();
        });
        document.getElementById('historyClearAll')?.addEventListener('click', async () => {
            await window.piflexApi.historyClear(null); this.renderHistory();
        });
        this.renderHistoryList(items);
    }

    renderHistoryList(items) {
        this.setContent(`
            ${items.length === 0 ? '<div class="data-empty">No history entries.</div>' : ''}
            ${items.map(h => `
                <div class="data-item">
                    <a href="#" class="data-link" data-url="${escAttr(h.url)}" title="${escAttr(h.url)}">
                        <i class="fas fa-clock"></i> ${escText(h.title || h.url)}
                        <span class="data-meta">${new Date(h.visited).toLocaleString()}</span>
                    </a>
                    <button class="icon-btn data-del" data-id="${escAttr(h.id)}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            `).join('')}
        `);
        this.bindLinks();
        this.contentEl.querySelectorAll('.data-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                await window.piflexApi.historyRemove(btn.dataset.id);
                this.renderHistoryList(await window.piflexApi.historySearch(boxValueSafe()));
            });
        });
    }

    // ---- Downloads ----
    renderDownloads() {
        window.piflexApi.downloadsList().then(items => {
            this.setContent(`
                ${items.length === 0 ? '<div class="data-empty">No downloads yet.</div>' : ''}
                ${items.map(d => `
                    <div class="data-item download-item">
                        <div class="download-info">
                            <div>${escText(d.filename)} ${d.risky ? '<span class="risky-tag">⚠ Risky</span>' : ''}</div>
                            <div class="data-meta">${fmtBytes(d.received)} ${d.total ? '/ ' + fmtBytes(d.total) : ''} · ${d.state}</div>
                        </div>
                        <div class="download-actions">
                            ${d.state === 'active' ? `<button class="icon-btn dl-act" data-id="${d.id}" data-act="pause" title="Pause"><i class="fas fa-pause"></i></button>` : ''}
                            ${['paused', 'failed'].includes(d.state) ? `<button class="icon-btn dl-act" data-id="${d.id}" data-act="resume" title="Resume"><i class="fas fa-play"></i></button>` : ''}
                            ${['active', 'paused'].includes(d.state) ? `<button class="icon-btn dl-act" data-id="${d.id}" data-act="cancel" title="Cancel"><i class="fas fa-ban"></i></button>` : ''}
                        </div>
                    </div>
                `).join('')}
            `);
            this.contentEl.querySelectorAll('.dl-act').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    const act = btn.dataset.act;
                    if (act === 'pause') window.piflexApi.downloadsPause(id);
                    if (act === 'resume') window.piflexApi.downloadsResume(id);
                    if (act === 'cancel') window.piflexApi.downloadsCancel(id);
                    setTimeout(() => this.renderDownloads(), 300);
                });
            });
        });
    }

    bindLinks() {
        this.contentEl.querySelectorAll('.data-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                window.tabManager.navigateActiveTab(a.dataset.url);
                this.close();
            });
        });
    }

    setContent(html) { this.contentEl.innerHTML = html; }
    setToolbar(html) { this.toolbarEl.innerHTML = html; }

    // ---- Adblock settings block ----
    renderAdblockSettings() {
        const chk = document.getElementById('adblockEnabledChk');
        if (!chk) return;
        window.piflexApi.adblockStatus().then(s => {
            chk.checked = s.enabled;
            const st = document.getElementById('adblockStats');
            if (st) {
                st.textContent = s.rules > 0
                    ? `${s.rules.toLocaleString()} rules compiled · ${s.blockedTotal.toLocaleString()} requests blocked`
                    : 'Downloading filter lists… (network blocking active with fallback list)';
            }
            const info = document.getElementById('adblockSiteInfo');
            if (info) {
                const cur = window.tabManager?.getActiveTab?.();
                const host = cur?.url ? safeHost(cur.url) : null;
                info.innerHTML = host ? `
                    Current site: <b>${escText(host)}</b>
                    <button id="siteExemptBtn" class="secondary-btn" style="margin-left:8px;">
                        ${s.exemptHosts.includes(host) ? 'Re-enable protection' : 'Disable protection for this site'}
                    </button>
                ` : '';
                document.getElementById('siteExemptBtn')?.addEventListener('click', () => {
                    if (!host) return;
                    window.piflexApi.adblockSetSite(host, !s.exemptHosts.includes(host));
                });
            }
        });
        chk.onchange = () => window.piflexApi.adblockSetEnabled(chk.checked);
    }
}

function API_AVAILABLE() { return typeof window !== 'undefined' && !!window.piflexApi; }
function boxValueSafe() { return document.getElementById('historySearchBox')?.value || ''; }
function escText(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(s) { return escText(s); }
function safeHost(u) { try { return new URL(u).hostname; } catch (e) { return null; } }
function fmtBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
}

window.dataPanels = new DataPanels();
