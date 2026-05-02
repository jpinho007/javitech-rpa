// WhatsApp Web automation. Suporta dois modos de envio:
//   - "fixo":  manda toda mensagem para um contato fixo (ex: "MEU OI")
//   - "direto": busca contato pelo nome do motorista de cada rota
//
// O modo eh decidido pelo orquestrador (runner.js). Aqui exportamos so
// `sendMessage(page, contactName, message)` - quem chama eh que sabe o que
// passar como contactName.

async function findSearchBox(page) {
  const selectors = [
    // Novo (input - WhatsApp Web 2026)
    'input[data-tab="3"]',
    'input[type="text"][role="textbox"][aria-label^="Pesquisar" i]',
    'input[type="text"][role="textbox"][aria-label^="Search" i]',
    'input[type="text"][role="textbox"][aria-label^="Buscar" i]',
    'input[type="text"][placeholder^="Pesquisar" i]',
    'input[type="text"][placeholder^="Search" i]',
    'input[type="text"][placeholder^="Buscar" i]',
    // Antigo (contenteditable)
    'div[contenteditable="true"][data-tab="3"]',
    'div[role="textbox"][title*="Pesquisa" i]',
    'div[role="textbox"][title*="Search" i]',
    'div[contenteditable="true"][aria-label*="Pesquisa" i]',
    'div[contenteditable="true"][aria-label*="Search" i]',
    'div[role="search"] div[contenteditable="true"]',
    '#side div[contenteditable="true"]'
  ];
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) return { element: el, selector: sel };
      }
    }
    const handle = await page.evaluateHandle(() => {
      const all = [...document.querySelectorAll(
        'input[type="text"], input[role="textbox"], input[role="searchbox"], div[contenteditable="true"]'
      )];
      const cand = [];
      for (const d of all) {
        const r = d.getBoundingClientRect();
        if (r.width < 50 || r.height < 15) continue;
        if (r.top > window.innerHeight * 0.5) continue;
        if (r.left > window.innerWidth * 0.45) continue;
        cand.push({ d, r });
      }
      cand.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
      return cand[0] ? cand[0].d : null;
    }).catch(() => null);
    if (handle) {
      const element = handle.asElement();
      if (element) {
        const visible = await element.isVisible().catch(() => false);
        if (visible) return { element, selector: 'heuristic-top-left' };
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Nao encontrei a caixa de busca do WhatsApp (layout pode ter mudado).');
}

async function findMessageInput(page) {
  const selectors = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="1"]',
    'footer div[contenteditable="true"][role="textbox"]',
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="mensagem" i]',
    'div[contenteditable="true"][aria-label*="message" i]',
    'div[contenteditable="true"][aria-label*="Digite" i]',
    'div[contenteditable="true"][aria-label*="Type" i]'
  ];
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) return el;
      }
    }
    const handle = await page.evaluateHandle(() => {
      const all = [...document.querySelectorAll('div[contenteditable="true"]')];
      const cand = [];
      for (const d of all) {
        const r = d.getBoundingClientRect();
        if (r.width < 100 || r.height < 15) continue;
        if (r.top < window.innerHeight * 0.5) continue;
        cand.push({ d, r });
      }
      cand.sort((a, b) => b.r.top - a.r.top);
      return cand[0] ? cand[0].d : null;
    }).catch(() => null);
    if (handle) {
      const element = handle.asElement();
      if (element) {
        const visible = await element.isVisible().catch(() => false);
        if (visible) return element;
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error('Nao encontrei o campo de mensagem do WhatsApp.');
}

async function resetWaState(page) {
  await page.bringToFront().catch(() => {});
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
}

// Espera ate aparecer um resultado de busca QUE CONTEM o nome buscado
// (case-insensitive). Polling ate timeout. Mais robusto que so checar
// "tem algum item" - assim nao confunde com chats recentes da sidebar.
//
// Tambem da o tempo necessario pro WA Web debouncar a busca depois que
// o ultimo caractere foi digitado.
//
// Retorna:
//   true  -> tem item visivel na sidebar cujo texto contem o nome buscado
//   false -> WA mostrou "nenhum resultado" OU timeout sem match
async function waitForSearchResults(page, contactName, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 12000);
  // EXIGE match pelo NOME COMPLETO (idential ao que foi digitado).
  // Premissa: usuario salva o contato no WhatsApp com nome identico ao do
  // ML. Isso evita o pior bug: tem varios "Lucas" salvos -> a busca por
  // primeiro nome retorna varios resultados -> Enter abre o errado.
  const target = contactName.trim().toLowerCase();

  while (Date.now() < deadline) {
    const status = await page.evaluate((targetName) => {
      const txt = document.body.innerText || '';
      // 1) Texto explicito de "nenhum resultado" (PT-BR / ES).
      //    NAO incluir o ingles "No results" porque ele bate falsamente
      //    em frases PT como "no resultado da rota" (substring de palavras
      //    maiores). Bug detectado nos motoristas Claudio Vitale e Ricardo
      //    Almeida em runs reais - bypassed busca quando nao deveria.
      if (/Nenhuma\s+conversa.*encontrada|Nenhum\s+resultado|Sin\s+resultados/i.test(txt)) {
        return 'empty';
      }
      // 2) Procura na sidebar UM item cujo texto contem o nome COMPLETO.
      //    Itens normais de chat tem role=row no WA Web atual.
      const items = [
        ...document.querySelectorAll('[role="listitem"]'),
        ...document.querySelectorAll('[role="row"]')
      ];
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (r.height < 40 || r.height > 200) continue;
        if (r.left > window.innerWidth * 0.5) continue;  // so sidebar
        if (r.top > window.innerHeight - 30) continue;
        const itemText = (el.innerText || '').toLowerCase();
        if (!itemText) continue;
        // Match estrito: nome inteiro tem que aparecer no item
        if (itemText.includes(targetName)) return 'has-result';
      }
      return 'loading';
    }, target).catch(() => 'loading');

    if (status === 'has-result') return true;
    if (status === 'empty') return false;
    await page.waitForTimeout(400);
  }
  return false;
}

// Confirma que o chat abriu apos o Enter. Olha o header da conversa (topo
// da janela direita) e exige que contenha o NOME COMPLETO buscado.
// Pega chat errado: header nao bate -> retorna false -> abortamos.
async function chatHeaderMatches(page, contactName, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 4000);
  const target = contactName.trim().toLowerCase();
  while (Date.now() < deadline) {
    const ok = await page.evaluate((targ) => {
      const headers = [
        ...document.querySelectorAll('header'),
        ...document.querySelectorAll('div[role="region"] header'),
        ...document.querySelectorAll('div[data-testid="conversation-header"]')
      ];
      for (const h of headers) {
        const r = h.getBoundingClientRect();
        if (r.top > 100) continue;
        if (r.left < window.innerWidth * 0.3) continue;
        const txt = (h.innerText || '').toLowerCase();
        if (txt.includes(targ)) return true;
      }
      return false;
    }, target).catch(() => false);
    if (ok) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function sendMessageOnce(page, contactName, message, hooks) {
  hooks = hooks || {};
  const log = (msg, level) => {
    if (typeof hooks.onStep === 'function') hooks.onStep({ step: msg, level: level || 'info' });
  };

  await resetWaState(page);

  // 1) Foca a busca e limpa qualquer texto residual
  log('Procurando caixa de busca...');
  const sb = await findSearchBox(page);
  log(`Caixa de busca encontrada (seletor: ${sb.selector})`);
  await sb.element.click();
  await page.waitForTimeout(300);
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);

  // 2) Digita o nome do contato com delay maior pra WA Web debouncar a busca
  log(`Digitando "${contactName}"...`);
  await page.keyboard.type(contactName, { delay: 60 });

  // 3) Aguarda o debounce inicial do WA Web
  await page.waitForTimeout(900);

  // 4) Espera ATIVA por um resultado QUE CONTEM o nome buscado
  log('Aguardando resultado da busca (poll ate 12s)...');
  const t0 = Date.now();
  const hasResult = await waitForSearchResults(page, contactName, 12000);
  const elapsed = Date.now() - t0;
  if (!hasResult) {
    throw new Error(`Contato nao encontrado no WhatsApp: "${contactName}" (${elapsed}ms). Confira se o contato esta salvo no celular com esse nome exato (ou primeiro nome).`);
  }
  log(`Resultado encontrado em ${elapsed}ms`);

  // 5) Enter abre o primeiro resultado
  log('Apertando Enter pra abrir o chat...');
  await page.keyboard.press('Enter');

  // 6) Confirma que o chat abriu via header. SE NAO BATER, ABORTA - melhor
  //    falhar do que mandar mensagem pra contato errado.
  log('Aguardando chat abrir e confirmar header...');
  const headerOk = await chatHeaderMatches(page, contactName, 5000);
  if (!headerOk) {
    throw new Error(`Chat aberto NAO bate com "${contactName}". Provavelmente tem outro contato com nome parecido e o WhatsApp abriu o errado. Confira o nome exato no celular.`);
  }
  log('Chat aberto - header OK');

  // 7) Acha a caixa de mensagem
  log('Procurando caixa de mensagem...');
  const input = await findMessageInput(page);
  log('Caixa de mensagem encontrada');
  await input.click();

  const lines = message.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
    }
    await page.keyboard.type(lines[i], { delay: 15 });
  }
  await page.waitForTimeout(500);

  const sent = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button, [role="button"]')];
    const btn = candidates.find(b => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const tab = (b.getAttribute('data-tab') || '');
      const title = (b.getAttribute('title') || '').toLowerCase();
      return aria === 'enviar' || aria === 'send' ||
             aria.includes('enviar mensagem') || aria.includes('send message') ||
             tab === '11' ||
             title === 'enviar' || title === 'send';
    });
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!sent) await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
}

async function sendMessage(page, contactName, message, options) {
  options = options || {};
  const maxAttempts = options.maxAttempts || 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendMessageOnce(page, contactName, message, { onStep: options.onStep });
      return;
    } catch (e) {
      lastErr = e;
      // Se o erro foi "contato nao encontrado", nao adianta tentar de novo
      if (/Contato nao encontrado/i.test(e.message)) throw e;
      if (attempt < maxAttempts) {
        const wait = 1500 * attempt;
        if (typeof options.onRetry === 'function') {
          options.onRetry({ attempt, error: e, waitMs: wait });
        }
        await page.waitForTimeout(wait);
      }
    }
  }
  throw lastErr;
}

module.exports = { sendMessage, findSearchBox, findMessageInput, waitForSearchResults, chatHeaderMatches };
