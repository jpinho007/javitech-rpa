const fs = require('fs');
const path = require('path');

// Persistência diária. Reseta automaticamente quando vira o dia.
// Em modo Electron o caminho é resolvido via JAVITECH_USERDATA, em dev usa a raiz.

function resolveStorePath() {
  if (process.env.JAVITECH_USERDATA) {
    return path.join(process.env.JAVITECH_USERDATA, '.sent-today.json');
  }
  return path.join(__dirname, '..', '.sent-today.json');
}

function todayKey(date) {
  date = date || new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(date);
}

function readRaw(storePath) {
  if (!fs.existsSync(storePath)) return null;
  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function writeRaw(storePath, obj) {
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.warn('  (aviso: nao consegui salvar .sent-today.json:', e.message + ')');
  }
}

function load(now) {
  const today = todayKey(now);
  const storePath = resolveStorePath();
  const raw = readRaw(storePath);
  if (!raw || raw.date !== today) {
    return { date: today, ids: new Set(), entries: [] };
  }
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const ids = new Set(entries.map(e => String(e.routeId)));
  return { date: today, ids, entries };
}

function wasSentToday(routeId, now) {
  const state = load(now);
  return state.ids.has(String(routeId));
}

function markSent(routeId, driver, now) {
  const state = load(now);
  const id = String(routeId);
  if (state.ids.has(id)) return state;
  state.ids.add(id);
  state.entries.push({
    routeId: id,
    driver: driver || '',
    sentAt: (now || new Date()).toISOString()
  });
  writeRaw(resolveStorePath(), { date: state.date, entries: state.entries });
  return state;
}

function reset() {
  const storePath = resolveStorePath();
  if (fs.existsSync(storePath)) {
    try { fs.unlinkSync(storePath); } catch (_) {}
  }
}

module.exports = {
  load,
  wasSentToday,
  markSent,
  reset,
  todayKey,
  get STORE_PATH() { return resolveStorePath(); }
};
