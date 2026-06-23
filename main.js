const { app, BrowserWindow } = require('electron');
const path = require('path');

// Raspberry Pi optimization
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disk-cache-size', '52428800'); // 50MB max cache
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-translate');
app.commandLine.appendSwitch('disable-features', 'Translate,LanguageDetection,BackgroundFetch');

let mainWindow;

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,

        title: "PiFlex Browser",

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),

            contextIsolation: true,
            nodeIntegration: false,

            sandbox: false,

            webviewTag: true
        }
    });

    mainWindow.loadFile(
        path.join(__dirname, 'src', 'index.html')
    );

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {

    createWindow();

    app.on('activate', () => {

        if (
            BrowserWindow.getAllWindows().length === 0
        ) {
            createWindow();
        }

    });

});

app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {
        app.quit();
    }

});