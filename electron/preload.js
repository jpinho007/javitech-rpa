const { contextBridge, ipcRenderer } = require('electron');

// Bridge segura entre renderer (UI) e main (Node). Tudo que a UI consome
// passa por aqui — nada de require('electron') no renderer.
contextBridge.exposeInMainWorld('javitech', {
  app: {
    info: () => ipcRenderer.invoke('app-info'),
    openUserData: () => ipcRenderer.invoke('open-userdata')
  },
  updater: {
    recheck: () => ipcRenderer.invoke('updater-recheck'),
    bypass: () => ipcRenderer.invoke('updater-bypass')
  },
  rpas: {
    list: () => ipcRenderer.invoke('list-rpas')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings-get'),
    save: partial => ipcRenderer.invoke('settings-save', partial)
  },
  history: {
    load: (rpaId) => ipcRenderer.invoke('history-load', rpaId),
    clear: (rpaId) => ipcRenderer.invoke('history-clear', rpaId)
  },
  sentToday: {
    load: () => ipcRenderer.invoke('sent-today-load')
  },
  prioridade: {
    openBrowsers: () => ipcRenderer.invoke('rpa:open-browsers'),
    findRoutes: () => ipcRenderer.invoke('rpa:find-routes'),
    extract: opts => ipcRenderer.invoke('rpa:extract', opts),
    preview: () => ipcRenderer.invoke('rpa:preview'),
    send: () => ipcRenderer.invoke('rpa:send'),
    abort: () => ipcRenderer.invoke('rpa:abort'),
    close: () => ipcRenderer.invoke('rpa:close')
  },
  on: (channel, handler) => {
    const allowed = [
      'runner:state', 'runner:log',
      'runner:browsers-opened', 'runner:routes-found',
      'runner:extract-progress', 'runner:extract-done',
      'runner:preview-ready',
      'runner:send-progress', 'runner:send-done',
      'updater:gate'
    ];
    if (!allowed.includes(channel)) return () => {};
    const wrapped = (_e, payload) => handler(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  dialog: {
    confirm: opts => ipcRenderer.invoke('confirm-dialog', opts)
  }
});
