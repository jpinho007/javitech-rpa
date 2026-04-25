const fs = require('fs');
const path = require('path');

// Config padrao do Javitech RPA. O arquivo .json fica na raiz do projeto
// (durante desenvolvimento) ou na pasta de userData (em producao).
//
// Em producao (app empacotado) o arquivo de config eh resolvido por
// electron/paths.js via process.env.JAVITECH_USERDATA. Em modo dev (sem
// Electron) caimos em path.join(__dirname, '..', 'config.json').

function resolveConfigPath() {
  if (process.env.JAVITECH_CONFIG_PATH) return process.env.JAVITECH_CONFIG_PATH;
  return path.join(__dirname, '..', 'config.json');
}

const defaults = {
  ml: {
    monitoringUrl: 'https://envios.adminml.com/logistics/monitoring-distribution?site=MLB',
    detailUrlTemplate: 'https://envios.adminml.com/logistics/monitoring-distribution/detail/{id}?site=MLB'
  },
  whatsapp: {
    url: 'https://web.whatsapp.com',
    contactName: 'MEU OI',
    sendDirectToDriver: false
  },
  routeIds: [],
  residentialPackageThreshold: 5,
  residentialAnnotationThreshold: 20,
  delayBetweenMessagesMs: 3000,
  historyRetentionDays: 30
};

function load() {
  const configPath = resolveConfigPath();
  let user = {};
  if (fs.existsSync(configPath)) {
    try {
      user = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (_) {
      user = {};
    }
  }
  return {
    ...defaults,
    ...user,
    ml: { ...defaults.ml, ...(user.ml || {}) },
    whatsapp: { ...defaults.whatsapp, ...(user.whatsapp || {}) }
  };
}

function save(partial) {
  const configPath = resolveConfigPath();
  const current = load();
  const merged = {
    ...current,
    ...partial,
    ml: { ...current.ml, ...(partial.ml || {}) },
    whatsapp: { ...current.whatsapp, ...(partial.whatsapp || {}) }
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

// Mantem retrocompatibilidade: muitos modulos requerem o objeto direto.
// O proxy chama load() na primeira leitura e cacheia. Uso save() pra mudar.
let cached = null;
function get() {
  if (cached === null) cached = load();
  return cached;
}
function reload() { cached = null; return get(); }

const handler = {
  get(_t, prop) {
    if (prop === '__load') return load;
    if (prop === '__save') return save;
    if (prop === '__reload') return reload;
    if (prop === '__path') return resolveConfigPath;
    return get()[prop];
  }
};

module.exports = new Proxy({}, handler);
