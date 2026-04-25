const { chromium } = require('playwright');
const path = require('path');
const EventEmitter = require('events');
const config = require('./config');
const { extractRoutesList, extractRouteDetail } = require('./scraper');
const { buildMessage, fullNameTitleCase } = require('./message');
const { sendMessage } = require('./whatsapp');
const sentToday = require('./sent-today');
const history = require('./history');

// Orquestrador da RPA "Enviar Prioridades".
// Eventos emitidos:
//   'log'              {level, message}
//   'browsers-opened'  -> as duas abas (ML + WA) estao prontas pra login
//   'login-required'   -> espera click do usuario apos login
//   'routes-found'     [{id, driver}]
//   'extract-progress' {index, total, route}
//   'extract-done'     [{id, driver, data, skip}]
//   'preview-ready'    [{id, driver, message}]
//   'send-progress'    {index, total, route, status, error?}
//   'send-done'        {ok, fail, total}
//   'state'            'idle'|'opening'|'login'|'ready'|'extracting'|'previewing'|'sending'|'done'|'error'

class PriorityRunner extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.mlPage = null;
    this.waPage = null;
    this.routes = [];
    this.results = [];
    this.toSend = [];
    this.state = 'idle';
    this.aborted = false;
  }

  setState(s) {
    this.state = s;
    this.emit('state', s);
  }

  log(message, level) {
    this.emit('log', { level: level || 'info', message });
  }

  async openBrowser(profileDir) {
    this.setState('opening');
    this.log('Abrindo navegador...');
    this.browser = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1366, height: 768 },
      args: ['--start-maximized']
    });
    this.mlPage = this.browser.pages()[0] || await this.browser.newPage();
    await this.mlPage.goto(config.ml.monitoringUrl, { waitUntil: 'domcontentloaded' });
    this.waPage = await this.browser.newPage();
    await this.waPage.goto(config.whatsapp.url, { waitUntil: 'domcontentloaded' });
    this.setState('login');
    this.emit('browsers-opened');
    this.log('Navegador aberto. Faca login no Mercado Livre e WhatsApp Web.');
  }

  /**
   * O usuario clicou "Ja fiz login, prosseguir".
   * Aqui descobrimos as rotas do dia e devolvemos a lista.
   */
  async findRoutes() {
    this.setState('ready');
    let routes;
    if (config.routeIds && config.routeIds.length > 0) {
      this.log(`Usando ${config.routeIds.length} routeIds do config.json`);
      routes = config.routeIds.map(id => ({ id: String(id), driver: '' }));
    } else {
      this.log('Procurando rotas ativas no painel...');
      routes = await extractRoutesList(this.mlPage);
      this.log(`Encontradas ${routes.length} rota(s).`);
    }
    this.routes = routes;
    this.emit('routes-found', routes);
    return routes;
  }

  /**
   * Extrai detalhe de cada rota.
   * @param {object} options
   * @param {boolean} options.onlyNew  - filtra rotas ja enviadas hoje
   */
  async extractDetails(options) {
    options = options || {};
    this.setState('extracting');
    if (this.aborted) return [];

    const todayState = sentToday.load();
    const list = options.onlyNew
      ? this.routes.filter(r => !todayState.ids.has(String(r.id)))
      : this.routes;

    if (options.onlyNew) {
      const skipped = this.routes.length - list.length;
      this.log(`Modo "novas": pulando ${skipped} rota(s) ja enviada(s) hoje.`);
    }

    this.results = [];
    for (let i = 0; i < list.length; i++) {
      if (this.aborted) break;
      const r = list[i];
      this.emit('extract-progress', { index: i + 1, total: list.length, route: r });
      try {
        const data = await extractRouteDetail(this.mlPage, r.id);
        const driverName = data.driver || r.driver || `Rota ${r.id}`;
        this.results.push({ id: r.id, driver: driverName, data, skip: false });
        const cb = (data.coletaBuyers || []).length;
        const total = data.sacas.length + data.places.length + cb + data.comerciais.length + data.residenciais.length;
        this.log(`[${r.id}] ${driverName}: ${data.sacas.length} sac / ${data.places.length} pla / ${cb} cb / ${data.comerciais.length} com / ${data.residenciais.length} res${total === 0 ? ' (nada pra enviar)' : ''}`);
      } catch (e) {
        this.log(`[${r.id}] ERRO: ${e.message}`, 'error');
        this.results.push({ id: r.id, driver: r.driver || `Rota ${r.id}`, data: null, skip: true, error: e.message });
      }
    }
    this.emit('extract-done', this.results);
    return this.results;
  }

  /**
   * Gera o preview (mensagens prontas) das rotas com conteudo. Tambem
   * decide o "contato" de cada uma (fixo ou nome do motorista).
   */
  buildPreview() {
    this.setState('previewing');
    const cfg = config.__load();
    const sendDirect = !!cfg.whatsapp.sendDirectToDriver;
    const fixedContact = cfg.whatsapp.contactName;

    this.toSend = [];
    for (const r of this.results) {
      if (r.skip || !r.data) continue;
      const d = r.data;
      const cb = (d.coletaBuyers || []).length;
      const total = d.sacas.length + d.places.length + cb + d.comerciais.length + d.residenciais.length;
      if (total === 0) continue;
      const message = buildMessage(r.driver, r.data);
      // No modo direto, busca pelo nome COMPLETO do motorista (titulizado).
      // No modo fixo, manda pra o contato configurado.
      const contact = sendDirect ? fullNameTitleCase(r.driver) : fixedContact;
      this.toSend.push({
        id: r.id,
        driver: r.driver,
        contact,
        message,
        sendDirect
      });
    }
    this.emit('preview-ready', this.toSend);
    return this.toSend;
  }

  async runSend() {
    this.setState('sending');
    let ok = 0, fail = 0;
    const total = this.toSend.length;
    for (let i = 0; i < total; i++) {
      if (this.aborted) break;
      const r = this.toSend[i];
      this.emit('send-progress', { index: i + 1, total, route: r, status: 'sending' });
      try {
        await sendMessage(this.waPage, r.contact, r.message, {
          maxAttempts: 3,
          onRetry: ({ attempt, error, waitMs }) =>
            this.log(`  (tentativa ${attempt} falhou: ${error.message.split('\n')[0]}, aguardando ${waitMs}ms)`, 'warn')
        });
        ok++;
        sentToday.markSent(r.id, r.driver);
        history.append({
          rpa: 'enviar-prioridades',
          routeId: r.id, driver: r.driver, contact: r.contact,
          status: 'success'
        }, config.historyRetentionDays);
        this.emit('send-progress', { index: i + 1, total, route: r, status: 'success' });
        await this.waPage.waitForTimeout(config.delayBetweenMessagesMs);
      } catch (e) {
        fail++;
        history.append({
          rpa: 'enviar-prioridades',
          routeId: r.id, driver: r.driver, contact: r.contact,
          status: 'failed', error: e.message
        }, config.historyRetentionDays);
        this.emit('send-progress', { index: i + 1, total, route: r, status: 'failed', error: e.message });
      }
    }
    this.setState('done');
    this.emit('send-done', { ok, fail, total });
    return { ok, fail, total };
  }

  abort() {
    this.aborted = true;
    this.log('Abortando...', 'warn');
  }

  async close() {
    if (this.browser) {
      try { await this.browser.close(); } catch (_) {}
      this.browser = null;
    }
  }
}

function createPriorityRunner() {
  return new PriorityRunner();
}

module.exports = { createPriorityRunner, PriorityRunner };
