const {
  app,
  BrowserWindow,
  session,
  ipcMain,
  shell,
  net,
} = require("electron");
const path = require("path");
const fs = require("fs");

const { AdBlockManager } = require("./main/adblock");
const { DownloadManager } = require("./main/downloads");
const { BookmarkStore, HistoryStore } = require("./main/stores");

const appVersion = require("./package.json").version;

const isLowRamDevice = () => {
  try {
    return require("os").totalmem() <= 2 * 1024 * 1024 * 1024;
  } catch (e) {
    return false;
  }
};

const lowRam = isLowRamDevice();

app.commandLine.appendSwitch(
  "js-flags",
  `--max-old-space-size=${lowRam ? 256 : 512}`,
);
app.commandLine.appendSwitch("disable-dev-shm-usage");
app.commandLine.appendSwitch(
  "disk-cache-size",
  String(lowRam ? 25 : 50) * 1024 * 1024,
);
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-default-apps");
app.commandLine.appendSwitch("disable-sync");
app.commandLine.appendSwitch("disable-translate");
app.commandLine.appendSwitch(
  "disable-features",
  "Translate,LanguageDetection,BackgroundFetch",
);
if (lowRam) {
  // Only sacrifice GPU compositing on genuinely low-RAM devices.
  app.disableHardwareAcceleration();
}

let mainWindow = null;
let adblock = null;
let downloads = null;
let bookmarks = null;
let history = null;
let userDataDir;

const loadDataDir = () => path.join(app.getPath("userData"), "data");
const downloadDir = () => {
  try {
    return app.getPath("downloads");
  } catch (e) {
    return app.getPath("home");
  }
};

const isSafeNavScheme = (url) => /^(https?|file|about|data):/i.test(url);

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "PiFlex Browser",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // required by webview tag usage in ui
      webviewTag: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  // Guard top-level navigation of the shell window itself.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isSafeNavScheme(url)) {
      event.preventDefault();
    }
  });
  // Open target=_blank of shell safely in system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Keep webviews from attaching with a foreign preload or rogue partition.
  mainWindow.webContents.on(
    "will-attach-webview",
    (event, webPreferences, params) => {
      webPreferences.preload = path.join(__dirname, "preload.js");
      webPreferences.contextIsolation = true;
      webPreferences.nodeIntegration = false;
    },
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("piflex:getInfo", () => ({
    version: appVersion,
    platform: process.platform,
    arch: process.arch,
    lowRam,
  }));

  // ---- Bookmarks ----
  ipcMain.handle("piflex:bookmarks:list", () => bookmarks.list());
  ipcMain.handle("piflex:bookmarks:add", (_e, { title, url, folder }) => {
    if (!/^(https?|file):/i.test(String(url))) return null;
    return bookmarks.add({ title, url, folder });
  });
  ipcMain.handle("piflex:bookmarks:remove", (_e, id) => bookmarks.remove(id));

  // sniff of whether current URL is bookmarked
  ipcMain.handle("piflex:bookmarks:has", (_e, url) =>
    bookmarks.list().some((b) => b.url === url),
  );

  // ---- History ----
  ipcMain.handle("piflex:history:add", (_e, { url, title }) => {
    if (!/^(https?|file):/i.test(String(url))) return;
    history.add({ url, title });
  });
  ipcMain.handle("piflex:history:search", (_e, q) => history.search(q));
  ipcMain.handle("piflex:history:remove", (_e, id) => history.remove(id));
  ipcMain.handle("piflex:history:clear", (_e, hours) =>
    history.clearRange(hours),
  );

  // ---- Downloads ----
  ipcMain.handle("piflex:downloads:list", () => downloads.list());
  ipcMain.handle("piflex:downloads:pause", (_e, id) => downloads.pause(id));
  ipcMain.handle("piflex:downloads:resume", (_e, id) => downloads.resume(id));
  ipcMain.handle("piflex:downloads:cancel", (_e, id) => downloads.cancel(id));

  // ---- Adblock ----
  ipcMain.handle("piflex:adblock:status", () => adblock.status());
  ipcMain.handle("piflex:adblock:setEnabled", (_e, v) => {
    adblock.setEnabled(v);
    return adblock.status();
  });
  ipcMain.handle("piflex:adblock:setSite", (_e, { host, exempt }) => {
    const clean = String(host || "").toLowerCase();
    if (clean && /^[a-z0-9.-]+$/.test(clean))
      adblock.setSiteExempt(clean, exempt);
    return adblock.status();
  });
  ipcMain.handle("piflex:adblock:update", async () => adblock.updateLists());
  ipcMain.handle("piflex:adblock:clearStats", () => {
    adblock.clearStats();
    return adblock.status();
  });

  // ---- Misc util ----
  ipcMain.handle("piflex:checkReachableOllama", async (_e, host) => {
    const clean = String(host || "");
    if (!/^https?:\/\//i.test(clean)) return { ok: false };
    return new Promise((resolve) => {
      const req = net.request(clean.replace(/\/+$/, "") + "/api/tags");
      req.setTimeout(4000, () => {
        req.abort();
        resolve({ ok: false });
      });
      req.on("response", (res) => resolve({ ok: res.statusCode === 200 }));
      req.on("error", () => resolve({ ok: false }));
      req.end();
    });
  });
}

function initServices() {
  const dataDir = loadDataDir();
  bookmarks = new BookmarkStore(path.join(dataDir, "bookmarks.json"));
  history = new HistoryStore(path.join(dataDir, "history.json"), {
    maxItems: 5000,
  });
  downloads = new DownloadManager(downloadDir(), (p) =>
    send("piflex:download-event", p),
  );
  adblock = new AdBlockManager(
    session.defaultSession,
    path.join(dataDir, "filter-cache"),
    (s) => send("piflex:adblock-status", s),
  );
  downloads.attach(session.defaultSession);
  // Don't block app startup on filter list download; run it post-launch.
  adblock
    .start()
    .catch((e) => console.error("Adblock init failed:", e.message));
}

app.whenReady().then(() => {
  userDataDir = app.getPath("userData");
  try {
    fs.mkdirSync(path.join(userDataDir, "data", "filter-cache"), {
      recursive: true,
    });
  } catch (e) {}

  const extensionsPath = path.join(__dirname, "extensions");
  if (!fs.existsSync(extensionsPath)) fs.mkdirSync(extensionsPath);
  try {
    for (const dir of fs.readdirSync(extensionsPath)) {
      const extDir = path.join(extensionsPath, dir);
      if (fs.statSync(extDir).isDirectory()) {
        session.defaultSession
          .loadExtension(extDir)
          .then(({ id }) => console.log("Loaded extension:", id))
          .catch((err) =>
            console.error("Failed to load extension:", err.message),
          );
      }
    }
  } catch (e) {
    console.error("Error loading extensions:", e.message);
  }

  registerIpc();
  initServices();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  if (adblock) adblock.stop();
});
