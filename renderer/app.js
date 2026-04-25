// Javitech RPA - renderer (UI). Vanilla JS, sem framework.
// Sidebar lista as aplicacoes (RPAs). Cada RPA tem sub-abas:
//   Executar / Configuracoes / Historico
//
// URL hash routing:
//   #/                              -> home (grade de RPAs)
//   #/rpa/<id>                      -> RPA, aba Executar (default)
//   #/rpa/<id>/configuracoes        -> RPA, aba Config
//   #/rpa/<id>/historico            -> RPA, aba Historico

const view = document.getElementById('view');

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
function tpl(id) { return document.getElementById(id).content.cloneNode(true); }
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============== Estado global do front ==============
let RPAS_CACHE = null;
let prioridadeStep = null;       // null | 'login' | 'modo' | 'extract' | 'preview' | 'progress' | 'done'
let prioridadeBound = false;
let okCount = 0, failCount = 0;

// ============== ROUTER ==============
function parseHash() {
  const raw = location.hash.slice(1) || '/';
  if (raw === '/') return { kind: 'home' };
  const m = raw.match(/^\/rpa\/([^/]+)(?:\/([^/]+))?$/);
  if (m) return { kind: 'rpa', rpaId: m[1], subtab: m[2] || 'executar' };
  return { kind: 'home' };
}

function go(path) {
  if (location.hash !== '#' + path) location.hash = '#' + path;
  else render();
}

function render() {
  const route = parseHash();
  view.innerHTML = '';
  if (route.kind === 'home') renderHome();
  else if (route.kind === 'rpa') renderRpaPage(route.rpaId, route.subtab);
  highlightSidebar(route);
}

window.addEventListener('hashchange', render);

// ============== Sidebar ==============
async function renderSidebar() {
  if (!RPAS_CACHE) RPAS_CACHE = await window.javitech.rpas.list();
  const nav = $('#apps-nav');
  nav.innerHTML = '';
  for (const rpa of RPAS_CACHE) {
    const a = document.createElement('a');
    a.dataset.rpaId = rpa.id;
    a.href = rpa.enabled ? `#/rpa/${rpa.id}` : '#';
    a.textContent = rpa.title;
    if (!rpa.enabled) a.classList.add('disabled');
    nav.appendChild(a);
  }
}

function highlightSidebar(route) {
  $$('.nav-item').forEach(a =>
    a.classList.toggle('active', route.kind === 'home' && a.dataset.route === '/')
  );
  $$('.apps-nav a').forEach(a =>
    a.classList.toggle('active', route.kind === 'rpa' && a.dataset.rpaId === route.rpaId)
  );
}

// ============== HOME ==============
async function renderHome() {
  view.appendChild(tpl('tpl-home'));
  const grid = $('#rpa-grid');
  if (!RPAS_CACHE) RPAS_CACHE = await window.javitech.rpas.list();
  for (const rpa of RPAS_CACHE) {
    const tile = document.createElement('button');
    tile.className = 'rpa-tile' + (rpa.enabled ? '' : ' disabled');
    tile.disabled = !rpa.enabled;
    tile.innerHTML = `
      <h3>${escapeHtml(rpa.title)}</h3>
      <p>${escapeHtml(rpa.description)}</p>
      <span class="badge">${rpa.enabled ? 'DISPONÍVEL' : 'EM BREVE'}</span>
    `;
    if (rpa.enabled) {
      tile.addEventListener('click', () => go(`/rpa/${rpa.id}`));
    }
    grid.appendChild(tile);
  }
}

// ============== RPA PAGE (com sub-abas) ==============
async function renderRpaPage(rpaId, subtab) {
  if (!RPAS_CACHE) RPAS_CACHE = await window.javitech.rpas.list();
  const rpa = RPAS_CACHE.find(r => r.id === rpaId);
  if (!rpa) { go('/'); return; }
  if (!rpa.enabled) { go('/'); return; }

  view.appendChild(tpl('tpl-rpa-page'));
  $('#rpa-title').textContent = rpa.title;
  $('#rpa-desc').textContent = rpa.description;

  // Sub-abas: aponta href correto e marca a ativa
  $$('.subtab').forEach(t => {
    t.href = `#/rpa/${rpaId}/${t.dataset.subtab === 'executar' ? '' : t.dataset.subtab}`
      .replace(/\/$/, '');
    if (t.dataset.subtab === 'executar' && !subtab) t.classList.add('active');
    if (t.dataset.subtab === subtab) t.classList.add('active');
  });

  const content = $('#rpa-content');
  // Por enquanto só temos uma RPA (enviar-prioridades). Quando criar outras,
  // expanda aqui.
  if (rpaId === 'enviar-prioridades') {
    if (subtab === 'configuracoes') return renderPrioridadesConfig(content);
    if (subtab === 'historico')      return renderPrioridadesHistorico(content);
    return renderPrioridadesExecutar(content);
  }
  content.innerHTML = '<div class="card muted">Esta RPA ainda não está implementada.</div>';
}

// ============== ENVIAR PRIORIDADES - EXECUTAR ==============
function renderPrioridadesExecutar(container) {
  container.appendChild(tpl('tpl-prioridades-executar'));
  prioridadeStep = 'login';
  bindPrioridadeEvents();
  showStep('login');
}

function showStep(step) {
  prioridadeStep = step;
  const container = $('#prioridade-step');
  if (!container) return;
  container.innerHTML = '';
  const map = {
    login: 'tpl-step-login',
    modo: 'tpl-step-modo',
    extract: 'tpl-step-extract',
    preview: 'tpl-step-preview',
    progress: 'tpl-step-progress',
    done: 'tpl-step-done'
  };
  container.appendChild(tpl(map[step]));
  if (step === 'login') initLoginStep();
  if (step === 'modo') initModoStep();
  if (step === 'preview') initPreviewStep();
  if (step === 'progress') initProgressStep();
  if (step === 'done') initDoneStep();
}

function initLoginStep() {
  const btnOpen = $('#btn-open-browser');
  const btnDone = $('#btn-login-done');
  const logEl = $('#login-log');
  appendLog(logEl, 'Aguardando você abrir o navegador.');

  btnOpen.addEventListener('click', async () => {
    btnOpen.disabled = true;
    btnOpen.textContent = 'Abrindo...';
    appendLog(logEl, 'Abrindo navegador (Mercado Livre + WhatsApp Web)...');
    try {
      await window.javitech.prioridade.openBrowsers();
    } catch (e) {
      appendLog(logEl, 'Erro: ' + e.message, 'error');
      btnOpen.disabled = false;
      btnOpen.textContent = 'Abrir navegador e fazer login';
    }
  });

  btnDone.addEventListener('click', async () => {
    btnDone.disabled = true;
    appendLog(logEl, 'Procurando rotas do dia...');
    try {
      const list = await window.javitech.prioridade.findRoutes();
      window.__routesFound = list;
      showStep('modo');
    } catch (e) {
      appendLog(logEl, 'Erro: ' + e.message, 'error');
      btnDone.disabled = false;
    }
  });
}

function initModoStep() {
  const summary = $('#modo-summary');
  const list = window.__routesFound || [];
  window.javitech.sentToday.load().then(st => {
    summary.textContent = `Encontradas ${list.length} rota(s). ${st.entries.length} já enviada(s) hoje.`;
  });

  $$('.modo-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const modo = btn.dataset.modo;
      if (modo === 'cancelar') {
        await window.javitech.prioridade.close();
        go('/');
        return;
      }
      showStep('extract');
      try {
        await window.javitech.prioridade.extract({ onlyNew: modo === 'novas' });
        await window.javitech.prioridade.preview();
        showStep('preview');
      } catch (e) {
        const log = $('#extract-log') || $('#login-log');
        if (log) appendLog(log, 'Erro: ' + e.message, 'error');
      }
    });
  });
}

function initPreviewStep() {
  const list = $('#preview-list');
  const summary = $('#preview-summary');
  const messages = window.__previewList || [];
  summary.textContent = `${messages.length} mensagem(ns) prontas pra envio.`;
  for (const m of messages) {
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.innerHTML = `
      <h4>${escapeHtml(m.driver)}</h4>
      <div class="meta">Rota ${escapeHtml(m.id)} → ${m.sendDirect ? '🧑 ' : '📞 '}${escapeHtml(m.contact)}</div>
      <pre>${escapeHtml(m.message)}</pre>
    `;
    list.appendChild(card);
  }
  $('#btn-back-modo').addEventListener('click', () => showStep('modo'));
  $('#btn-send').addEventListener('click', async () => {
    showStep('progress');
    okCount = 0; failCount = 0;
    try { await window.javitech.prioridade.send(); }
    catch (e) { console.error(e); }
  });
}

function initProgressStep() {
  $('#btn-abort').addEventListener('click', async () => {
    await window.javitech.prioridade.abort();
  });
}

function initDoneStep() {
  const summary = window.__sendSummary || { ok: 0, fail: 0, total: 0 };
  $('#done-summary').innerHTML = `
    Enviadas: <strong class="success">${summary.ok}</strong>
    &middot; Falhas: <strong class="error">${summary.fail}</strong>
    &middot; Total: <strong>${summary.total}</strong>
  `;
  $('#btn-new-run').addEventListener('click', async () => {
    await window.javitech.prioridade.close();
    go('/');
  });
  $('#btn-go-history').addEventListener('click', () =>
    go('/rpa/enviar-prioridades/historico'));
}

function bindPrioridadeEvents() {
  if (prioridadeBound) return;
  prioridadeBound = true;

  window.javitech.on('runner:browsers-opened', () => {
    if (prioridadeStep !== 'login') return;
    const btnOpen = $('#btn-open-browser');
    const btnDone = $('#btn-login-done');
    const logEl = $('#login-log');
    if (btnOpen) btnOpen.classList.add('hidden');
    if (btnDone) btnDone.classList.remove('hidden');
    if (logEl) appendLog(logEl, 'Navegador aberto! Faça login nas duas abas e clique em "Já fiz login, prosseguir".');
  });

  window.javitech.on('runner:log', e => {
    const target = $('#login-log') || $('#extract-log') || $('#send-log');
    if (target) appendLog(target, e.message, e.level);
  });

  window.javitech.on('runner:routes-found', list => { window.__routesFound = list; });

  window.javitech.on('runner:extract-progress', e => {
    const bar = $('#extract-bar'), counter = $('#extract-counter'), log = $('#extract-log');
    const pct = (e.index / e.total) * 100;
    if (bar) bar.style.width = pct + '%';
    if (counter) counter.textContent = `${e.index} / ${e.total}`;
    if (log) appendLog(log, `Extraindo rota ${e.route.id}...`);
  });

  window.javitech.on('runner:preview-ready', list => { window.__previewList = list; });

  window.javitech.on('runner:send-progress', e => {
    if (prioridadeStep !== 'progress') return;
    const bar = $('#send-bar'), counter = $('#send-counter'), log = $('#send-log');
    const pct = (e.index / e.total) * 100;
    if (bar) bar.style.width = pct + '%';
    if (counter) counter.textContent = `${e.index} / ${e.total}`;
    if (e.status === 'success') {
      okCount++;
      const stat = $('#stat-ok'); if (stat) stat.textContent = `✓ ${okCount}`;
      if (log) appendLog(log, `[${e.route.id}] ✓ ${e.route.driver} → ${e.route.contact}`);
    } else if (e.status === 'failed') {
      failCount++;
      const stat = $('#stat-fail'); if (stat) stat.textContent = `✗ ${failCount}`;
      if (log) appendLog(log, `[${e.route.id}] ✗ ${e.route.driver}: ${e.error}`, 'error');
    } else if (e.status === 'sending') {
      if (log) appendLog(log, `Enviando ${e.route.driver}...`);
    }
  });

  window.javitech.on('runner:send-done', e => {
    window.__sendSummary = e;
    showStep('done');
  });
}

// ============== ENVIAR PRIORIDADES - CONFIGURAÇÕES ==============
async function renderPrioridadesConfig(container) {
  container.appendChild(tpl('tpl-prioridades-configuracoes'));
  const cfg = await window.javitech.settings.get();
  const f = $('#settings-form');
  f.contactName.value = cfg.whatsapp.contactName || '';
  f.sendDirectToDriver.checked = !!cfg.whatsapp.sendDirectToDriver;
  f.residentialPackageThreshold.value = cfg.residentialPackageThreshold;
  f.residentialAnnotationThreshold.value = cfg.residentialAnnotationThreshold;
  f.delayBetweenMessagesMs.value = cfg.delayBetweenMessagesMs;
  f.historyRetentionDays.value = cfg.historyRetentionDays;

  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const partial = {
      whatsapp: {
        contactName: f.contactName.value.trim(),
        sendDirectToDriver: f.sendDirectToDriver.checked
      },
      residentialPackageThreshold: parseInt(f.residentialPackageThreshold.value, 10) || 5,
      residentialAnnotationThreshold: parseInt(f.residentialAnnotationThreshold.value, 10) || 20,
      delayBetweenMessagesMs: parseInt(f.delayBetweenMessagesMs.value, 10) || 3000,
      historyRetentionDays: parseInt(f.historyRetentionDays.value, 10) || 30
    };
    await window.javitech.settings.save(partial);
    const status = $('#settings-status');
    status.textContent = '✓ Configurações salvas.';
    status.className = 'status ok';
    setTimeout(() => { status.textContent = ''; }, 3000);
  });

  $('#btn-open-userdata').addEventListener('click', () =>
    window.javitech.app.openUserData());
}

// ============== ENVIAR PRIORIDADES - HISTÓRICO ==============
async function renderPrioridadesHistorico(container) {
  container.appendChild(tpl('tpl-prioridades-historico'));
  const cfg = await window.javitech.settings.get();
  $('#hist-retention').textContent = cfg.historyRetentionDays;

  const { all, buckets } = await window.javitech.history.load('enviar-prioridades');
  const target = $('#historico-buckets');

  if (all.length === 0) {
    target.innerHTML = '<div class="card muted">Sem registros ainda.</div>';
  } else {
    renderBucket(target, 'Hoje', buckets.hoje);
    renderBucket(target, 'Ontem', buckets.ontem);
    renderBucket(target, 'Esta semana', buckets.semana);
    renderBucket(target, 'Este mês', buckets.mes);
    if (buckets.antigos.length) renderBucket(target, 'Mais antigos', buckets.antigos);
  }

  $('#btn-clear-history').addEventListener('click', async () => {
    const ok = await window.javitech.dialog.confirm({
      title: 'Limpar histórico',
      message: 'Apagar TODO o histórico desta RPA?',
      buttons: ['Cancelar', 'Apagar']
    });
    if (ok === 1) {
      await window.javitech.history.clear('enviar-prioridades');
      go('/rpa/enviar-prioridades/historico');
    }
  });
}

function renderBucket(target, label, entries) {
  if (!entries || entries.length === 0) return;
  const div = document.createElement('div');
  div.className = 'bucket card';
  div.innerHTML = `<h3>${escapeHtml(label)} (${entries.length})</h3>`;
  for (const e of entries) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const t = new Date(e.sentAt);
    const time = t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = t.toLocaleDateString('pt-BR');
    row.innerHTML = `
      <div class="time">${date} ${time}</div>
      <div class="driver">${escapeHtml(e.driver || '—')}</div>
      <div class="contact">→ ${escapeHtml(e.contact || '—')} (rota ${escapeHtml(e.routeId)})</div>
      <div class="status ${e.status}">${e.status === 'success' ? '✓' : '✗'} ${e.status}</div>
    `;
    div.appendChild(row);
  }
  target.appendChild(div);
}

// ============== UTILS ==============
function appendLog(el, message, level) {
  if (!el) return;
  const line = document.createElement('div');
  line.className = level || 'info';
  line.textContent = message;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

// === Boot Gate (atualizacao obrigatoria no boot) ===
function bootGateInit() {
  const gate = document.getElementById('boot-gate');
  if (!gate) return;
  const status = document.getElementById('boot-gate-status');
  const bar = document.getElementById('boot-gate-bar');
  const actions = document.getElementById('boot-gate-actions');
  const hint = document.getElementById('boot-gate-hint');
  const btnRetry = document.getElementById('boot-gate-retry');
  const btnContinue = document.getElementById('boot-gate-continue');

  function setStatus(msg, pct) {
    if (status) status.textContent = msg;
    if (bar && typeof pct === 'number') bar.style.width = Math.min(100, pct) + '%';
  }
  function showActions() {
    if (actions) actions.classList.remove('hidden');
    if (hint) hint.classList.remove('hidden');
  }
  function hideActions() {
    if (actions) actions.classList.add('hidden');
    if (hint) hint.classList.add('hidden');
  }
  function unlock() {
    gate.classList.add('hidden');
    setTimeout(() => { gate.style.display = 'none'; }, 400);
  }

  btnRetry.addEventListener('click', async () => {
    hideActions();
    setStatus('Verificando novamente...', 0);
    await window.javitech.updater.recheck();
  });
  btnContinue.addEventListener('click', async () => {
    await window.javitech.updater.bypass();
    unlock();
  });

  window.javitech.on('updater:gate', s => {
    if (s.state === 'checking') {
      hideActions();
      setStatus('Verificando atualizações...', 0);
    } else if (s.state === 'downloading') {
      hideActions();
      const v = s.version ? `v${s.version}` : '';
      setStatus(`Baixando atualização ${v}... ${s.percent || 0}%`, s.percent || 0);
    } else if (s.state === 'applying') {
      hideActions();
      setStatus(`Aplicando atualização v${s.version}, reiniciando...`, 100);
    } else if (s.state === 'up-to-date') {
      unlock();
    } else if (s.state === 'error') {
      setStatus(`Não consegui verificar: ${s.message || 'erro desconhecido'}`);
      showActions();
    }
  });
}
bootGateInit();

// === Boot ===
(async function boot() {
  const info = await window.javitech.app.info();
  $('#version-tag').textContent = `v${info.version}`;
  await renderSidebar();
  render();
})();
