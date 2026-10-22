'use strict';

// Shared, side-effect-free URL helpers (usable in renderer and Node tests).

function isValidUrl(input) {
    input = String(input || '').trim();
    if (!input) return false;
    if (/^(https?|file):\/\//i.test(input) || /^[a-zA-Z][\w+.-]*:/i.test(input)) {
        try {
            new URL(input);
            return true;
        } catch (e) {
            return false;
        }
    }
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
    const localhostRegex = /^localhost(:\d+)?(\/.*)?$/;
    return domainRegex.test(input) || ipRegex.test(input) || localhostRegex.test(input);
}

function formatUrl(input) {
    input = String(input || '').trim();
    if (/^[a-zA-Z][\w+.-]*:\/\//i.test(input)) return input;
    return 'https://' + input;
}

function hostnameOf(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
}

module.exports = { isValidUrl, formatUrl, hostnameOf };
