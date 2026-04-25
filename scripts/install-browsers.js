#!/usr/bin/env node
// scripts/install-browsers.js
//
// Baixa o Chromium do Playwright pra dentro de build/playwright-browsers/.
// Esse diretorio depois e copiado pro pacote final via "extraResources" no
// electron-builder, ficando dentro de resources/playwright-browsers/ no app
// instalado.
//
// Roda automatico antes de "npm run build" / "pack" / "publish".
// O cliente final NAO precisa rodar isso - o .exe ja vem com tudo.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const target = path.join(root, 'build', 'playwright-browsers');

console.log('========================================');
console.log(' install-browsers');
console.log('========================================');
console.log(` Destino: ${target}`);
console.log('');

fs.mkdirSync(target, { recursive: true });

// Setando PLAYWRIGHT_BROWSERS_PATH antes de chamar `playwright install`
// faz o pacote baixar o Chromium pra esse diretorio especifico.
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: target };

try {
  execSync('npx playwright install chromium', {
    stdio: 'inherit',
    cwd: root,
    env
  });
  console.log('');
  console.log('Browsers prontos em:', target);
} catch (e) {
  console.error('Erro instalando browsers do Playwright:', e.message);
  process.exit(1);
}
