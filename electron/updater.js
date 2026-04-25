const { autoUpdater } = require('electron-updater');
const { app } = require('electron');

// Auto-update FORCADO no boot.
// Estados emitidos pro renderer (canal 'updater:gate'):
//   checking      -> verificando atualizacoes
//   downloading   -> versao nova encontrada, baixando ({ version, percent })
//   applying      -> download terminou, aplicando ({ version })
//   up-to-date    -> ja na versao mais nova, libera o app
//   error         -> deu erro ({ message }), o renderer mostra retry/continuar
//
// O renderer mantem uma "boot gate" (overlay fullscreen) ate receber
// 'up-to-date' OU o usuario clicar "Continuar mesmo assim" depois de erro.

const TIMEOUT_MS = 30000; // 30s pra verificacao terminar antes de mostrar erro

function setupAutoUpdater(mainWindow, log) {
  const send = (state, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:gate', { state, ...(payload || {}) });
    }
  };

  // Em dev (npm run dev) nao tenta atualizar - libera direto.
  if (!app.isPackaged) {
    log.info('updater: app nao empacotado, liberando gate em dev');
    setTimeout(() => send('up-to-date'), 200);
    return { recheck: () => {} };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // queremos instalar logo, nao no quit
  autoUpdater.logger = log;

  let timeoutHandle = null;
  function startTimeout() {
    clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      send('error', { message: 'Tempo esgotado verificando atualização' });
    }, TIMEOUT_MS);
  }
  function clearGuardTimeout() { clearTimeout(timeoutHandle); }

  autoUpdater.on('checking-for-update', () => send('checking'));

  autoUpdater.on('update-available', (info) => {
    clearGuardTimeout();
    send('downloading', { version: info.version, percent: 0 });
  });

  autoUpdater.on('update-not-available', () => {
    clearGuardTimeout();
    send('up-to-date');
  });

  autoUpdater.on('error', (err) => {
    clearGuardTimeout();
    send('error', { message: (err && err.message) || 'Erro desconhecido' });
  });

  autoUpdater.on('download-progress', (p) => {
    send('downloading', { percent: Math.round(p.percent || 0) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('applying', { version: info.version });
    // Aguarda 2s pra mostrar a mensagem e chama quitAndInstall (silent=false,
    // forceRunAfter=true).
    setTimeout(() => {
      try { autoUpdater.quitAndInstall(false, true); }
      catch (e) { send('error', { message: 'Falha ao aplicar: ' + e.message }); }
    }, 2000);
  });

  function recheck() {
    startTimeout();
    autoUpdater.checkForUpdates().catch(e => {
      log.warn('updater: erro ao checar:', e.message);
      clearGuardTimeout();
      send('error', { message: e.message });
    });
  }

  // Primeira checagem assim que o renderer carregar
  recheck();

  return { recheck };
}

module.exports = { setupAutoUpdater };
