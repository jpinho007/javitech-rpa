const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

// userData fica em %APPDATA%/Javitech RPA - todos os arquivos de estado
// (config.json, .sent-today.json, .history.json, .browser-profile/) ficam la.
function bootstrapUserData() {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  process.env.JAVITECH_USERDATA = dir;
  process.env.JAVITECH_CONFIG_PATH = path.join(dir, 'config.json');

  // Se nao tem config.json no userData, copia o template do bundle.
  if (!fs.existsSync(process.env.JAVITECH_CONFIG_PATH)) {
    const template = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(template)) {
      fs.copyFileSync(template, process.env.JAVITECH_CONFIG_PATH);
    }
  }
  return dir;
}

const USER_DATA_DIR = bootstrapUserData();
log.transports.file.resolvePathFn = () => path.join(USER_DATA_DIR, 'javitech-rpa.log');
log.info('Javitech RPA iniciando. userData:', USER_DATA_DIR);

const config = require('../src/config');
const history = require('../src/history');
const sentToday = require('../src/sent-today');
const { createPriorityRunner } = require('../src/runner');
const { setupAutoUpdater } = require('./updater');

let mainWindow = null;
let runner = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Javitech RPA',
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  createWindow();
  setupAutoUpdater(mainWindow, log);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (runner) { try { await runner.close(); } catch (_) {} runner = null; }
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC =====

// Lista de RPAs disponíveis. Adicionar novas RPAs aqui.
const RPAS = [
  {
    id: 'enviar-prioridades',
    title: 'Enviar Prioridades',
    description: 'Le rotas do Mercado Livre e envia mensagem de prioridades pra cada motorista no WhatsApp Web.',
    enabled: true
  },
  {
    id: 'em-breve-1',
    title: 'Em breve',
    description: 'Nova RPA disponivel em uma proxima versao.',
    enabled: false
  }
];

ipcMain.handle('list-rpas', () => RPAS);

ipcMain.handle('app-info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  userData: USER_DATA_DIR
}));

ipcMain.handle('open-userdata', () => shell.openPath(USER_DATA_DIR));

// === Configuracoes ===
ipcMain.handle('settings-get', () => config.__load());
ipcMain.handle('settings-save', (_e, partial) => {
  const updated = config.__save(partial);
  config.__reload();
  return updated;
});

// === Historico ===
ipcMain.handle('history-load', (_e, rpaId) => {
  const cfg = config.__load();
  const all = history.load(cfg.historyRetentionDays, rpaId || null);
  return { all, buckets: history.bucketize(all) };
});
ipcMain.handle('history-clear', (_e, rpaId) => { history.clear(rpaId || null); return true; });

// === Estado do dia (sent-today) ===
ipcMain.handle('sent-today-load', () => {
  const s = sentToday.load();
  return { date: s.date, ids: [...s.ids], entries: s.entries };
});

// === RPA: Enviar Prioridades ===
function ensureRunner() {
  if (!runner) {
    runner = createPriorityRunner();
    const broadcast = (channel, payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
      }
    };
    runner.on('state', s => broadcast('runner:state', s));
    runner.on('log', e => broadcast('runner:log', e));
    runner.on('browsers-opened', () => broadcast('runner:browsers-opened'));
    runner.on('routes-found', list => broadcast('runner:routes-found', list));
    runner.on('extract-progress', e => broadcast('runner:extract-progress', e));
    runner.on('extract-done', list => broadcast('runner:extract-done', list));
    runner.on('preview-ready', list => broadcast('runner:preview-ready', list));
    runner.on('send-progress', e => broadcast('runner:send-progress', e));
    runner.on('send-done', e => broadcast('runner:send-done', e));
  }
  return runner;
}

ipcMain.handle('rpa:open-browsers', async () => {
  const r = ensureRunner();
  const profileDir = path.join(USER_DATA_DIR, '.browser-profile');
  await r.openBrowser(profileDir);
  return true;
});

ipcMain.handle('rpa:find-routes', async () => {
  const r = ensureRunner();
  return await r.findRoutes();
});

ipcMain.handle('rpa:extract', async (_e, options) => {
  const r = ensureRunner();
  return await r.extractDetails(options || {});
});

ipcMain.handle('rpa:preview', () => {
  const r = ensureRunner();
  return r.buildPreview();
});

ipcMain.handle('rpa:send', async () => {
  const r = ensureRunner();
  return await r.runSend();
});

ipcMain.handle('rpa:abort', () => {
  if (runner) runner.abort();
  return true;
});

ipcMain.handle('rpa:close', async () => {
  if (runner) {
    try { await runner.close(); } catch (_) {}
    runner = null;
  }
  return true;
});

ipcMain.handle('confirm-dialog', async (_e, opts) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: opts.type || 'question',
    buttons: opts.buttons || ['Cancelar', 'Confirmar'],
    defaultId: opts.defaultId || 0,
    title: opts.title || 'Javitech RPA',
    message: opts.message || '',
    detail: opts.detail || ''
  });
  return result.response;
});
