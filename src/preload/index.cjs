'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { IPC, SEND_CHANNELS, PUSH_CHANNELS } = require('../shared/ipc.cjs');

const sendSet = new Set(SEND_CHANNELS);
const pushSet = new Set(PUSH_CHANNELS);

/**
 * Invoke a privileged channel and unwrap the { ok, data } envelope. Rejects with
 * an Error carrying the main-process message so callers can try/catch normally.
 */
async function invoke(channel, payload) {
  if (typeof channel !== 'string' || !channel) throw new Error('Invalid IPC channel');
  const result = await ipcRenderer.invoke(channel, payload);
  if (result && typeof result === 'object' && 'ok' in result) {
    if (result.ok) return result.data;
    throw new Error(result.error || 'Operation failed');
  }
  return result;
}

/** Fire-and-forget for high-frequency signals (resize, find typing, etc). */
function send(channel, payload) {
  if (!sendSet.has(channel)) throw new Error(`Channel "${channel}" is not sendable`);
  ipcRenderer.send(channel, payload);
}

/** Subscribe to a main-process push channel; returns an unsubscribe function. */
function on(channel, listener) {
  if (!pushSet.has(channel)) throw new Error(`Channel "${channel}" is not a push channel`);
  const wrapped = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api = {
  // -- generic, allow-listed access used by typed wrappers in the renderer ----
  invoke,
  send,
  on,
  channels: IPC,

  // -- window controls --------------------------------------------------------
  window: {
    minimize: () => send(IPC.windowMinimize),
    toggleMaximize: () => send(IPC.windowMaximize),
    close: () => send(IPC.windowClose),
    isMaximized: () => invoke(IPC.windowIsMaximized),
    newWindow: () => send(IPC.windowNew),
    newPrivateWindow: () => send(IPC.windowNewPrivate),
    setToolbarHeight: (height) => send(IPC.layoutSetToolbarHeight, { height }),
    onMaximized: (fn) => on(IPC.windowMaximized, fn),
    onState: (fn) => on(IPC.windowState, fn),
  },

  platform: process.platform,

  setTheme: (theme) => send(IPC.setTheme, theme),
  openExternal: (url) => invoke(IPC.openExternal, { url }),
};

contextBridge.exposeInMainWorld('piflex', api);
