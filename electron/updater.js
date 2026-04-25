const { autoUpdater } = require('electron-updater');

// Auto-update via electron-updater + GitHub Releases.
// Pra que funcione em producao:
//   1. O package.json.build.publish ja esta apontando pro repo do GitHub
//      (ajuste owner/repo).
//   2. O CI (.github/workflows/release.yml) gera os binarios e publica.
//   3. O usuario, ao abrir o app, recebe a atualizacao em background.

function setupAutoUpdater(mainWindow, log) {
  // Em modo dev (npm run dev) electron-updater nao funciona - skipa.
  if (!require('electron').app.isPackaged) {
    log.info('updater: app nao empacotado, pulando auto-update');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = log;

  const send = (status, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { status, ...(payload || {}) });
    }
  };

  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (info) =>
    send('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => send('up-to-date'));
  autoUpdater.on('error', (err) =>
    send('error', { message: err && err.message }));
  autoUpdater.on('download-progress', (p) =>
    send('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) =>
    send('downloaded', { version: info.version }));

  // Checa a cada 30min e tambem 5s apos abrir.
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(e =>
    log.warn('updater: erro ao checar:', e.message)), 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}),
    30 * 60 * 1000);
}

module.exports = { setupAutoUpdater };
