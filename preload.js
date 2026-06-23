const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('piflex', {

    version: '1.0.0',

    getVersion() {
        return this.version;
    }

});