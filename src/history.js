const fs = require('fs');
const path = require('path');

// Historico rolante de N dias (default 30). Cada registro guarda:
//   { rpa, routeId, driver, contact, sentAt, status, error? }
//
// Status: 'success' | 'failed' | 'skipped'
//
// Cada chamada a `append()` poda automaticamente entradas mais antigas
// que o threshold de retenção.

function resolveStorePath() {
  if (process.env.JAVITECH_USERDATA) {
    return path.join(process.env.JAVITECH_USERDATA, '.history.json');
  }
  return path.join(__dirname, '..', '.history.json');
}

function readRaw() {
  const p = resolveStorePath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.entries)) return parsed.entries;
    return [];
  } catch (_) { return []; }
}

function writeRaw(entries) {
  const p = resolveStorePath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ entries }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('  (aviso: nao consegui salvar .history.json:', e.message + ')');
  }
}

function pruneOlder(entries, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter(e => {
    const t = new Date(e.sentAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
}

function load(retentionDays, rpaFilter) {
  const days = retentionDays || 30;
  const all = readRaw();
  const fresh = pruneOlder(all, days);
  if (fresh.length !== all.length) writeRaw(fresh);
  let filtered = fresh;
  if (rpaFilter) filtered = fresh.filter(e => e.rpa === rpaFilter);
  return filtered.slice().sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
}

function append(entry, retentionDays) {
  const days = retentionDays || 30;
  const all = readRaw();
  const sentAt = entry.sentAt || new Date().toISOString();
  all.push({ ...entry, sentAt });
  const fresh = pruneOlder(all, days);
  writeRaw(fresh);
  return fresh.length;
}

// Helpers de filtragem para a UI: hoje, ontem, esta semana, mês.
function bucketize(entries, nowDate) {
  const now = nowDate || new Date();
  const todayStr = toBRTDateKey(now);
  const yesterdayStr = toBRTDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const weekStartMs = startOfWeekBR(now).getTime();
  const monthStartMs = startOfMonthBR(now).getTime();

  const buckets = { hoje: [], ontem: [], semana: [], mes: [], antigos: [] };
  for (const e of entries) {
    const t = new Date(e.sentAt).getTime();
    const dStr = toBRTDateKey(new Date(t));
    if (dStr === todayStr) buckets.hoje.push(e);
    else if (dStr === yesterdayStr) buckets.ontem.push(e);
    else if (t >= weekStartMs) buckets.semana.push(e);
    else if (t >= monthStartMs) buckets.mes.push(e);
    else buckets.antigos.push(e);
  }
  return buckets;
}

function toBRTDateKey(d) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(d);
}

function startOfWeekBR(d) {
  // Domingo como 1o dia da semana (padrão BR informal)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = fmt.formatToParts(d);
  const wd = parts.find(p => p.type === 'weekday').value; // Sun, Mon...
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayIdx = map[wd];
  const start = new Date(d.getTime() - dayIdx * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonthBR(d) {
  const dateKey = toBRTDateKey(d); // yyyy-mm-dd
  const ym = dateKey.slice(0, 7);
  return new Date(`${ym}-01T00:00:00-03:00`);
}

function clear(rpaFilter) {
  if (!rpaFilter) {
    // limpa tudo
    const p = resolveStorePath();
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (_) {}
    return;
  }
  // limpa so as entradas de uma RPA especifica
  const all = readRaw();
  const remaining = all.filter(e => e.rpa !== rpaFilter);
  writeRaw(remaining);
}

module.exports = {
  load,
  append,
  bucketize,
  clear,
  toBRTDateKey,
  get STORE_PATH() { return resolveStorePath(); }
};
