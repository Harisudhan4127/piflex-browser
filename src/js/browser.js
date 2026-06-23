// ==================================
// PiFlex Browser Helper Actions
// ==================================

const Browser = {
    isValidUrl(input) {
        input = input.trim();
        // Match simple protocol-less domains e.g. google.com, localhost:3000, 192.168.1.1
        const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
        const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
        const localhostRegex = /^localhost(:\d+)?(\/.*)?$/;

        if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('file://')) {
            try {
                new URL(input);
                return true;
            } catch (e) {
                return false;
            }
        }
        
        return domainRegex.test(input) || ipRegex.test(input) || localhostRegex.test(input);
    },

    formatUrl(input) {
        input = input.trim();
        if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('file://')) {
            return input;
        }
        return 'https://' + input;
    },

    searchOrNavigate(input) {
        if (this.isValidUrl(input)) {
            return this.formatUrl(input);
        } else {
            return window.settingsMgr.getSearchUrl(input);
        }
    }
};

window.BrowserHelper = Browser;
