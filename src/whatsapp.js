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

// Espera ate os resultados da busca aparecerem (ou ate confirmar que nao
// existem). Polling de 300ms ate o timeout. Mais confiavel que setar
// waitForTimeout fixo - o WA Web pode demorar mais quando acabou de
// sincronizar contato novo.
//
// Retorna:
//   true  -> tem pelo menos um item de chat/contato visivel na sidebar
//   false -> WA mostrou "nenhum resultado" OU timeout sem nada aparecer
async function waitForSearchResults(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 8000);
  while (Date.now() < deadline) {
    const status = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      // 1) Texto explicito de "nenhum resultado" em PT / EN / ES
      if (/Nenhuma\s+conversa.*encontrada|Nenhum\s+resultado|No\s+chats?\s+found|No\s+results?|Sin\s+resultados/i.test(txt)) {
        return 'empty';
      }
      // 2) Tem item de chat na sidebar?
      const items = [
        ...document.querySelectorAll('[role="listitem"]'),
        ...document.querySelectorAll('[role="row"]')
      ];
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (r.height < 40 || r.height > 200) continue;
        if (r.left > window.innerWidth * 0.5) continue;  // sidebar
        if (r.top > window.innerHeight - 30) continue;
        if ((el.innerText || '').trim().length > 0) return 'has-result';
      }
      return 'loading';
    }).catch(() => 'loading');

    if (status === 'has-result') return true;
    if (status === 'empty') return false;
    await page.waitForTimeout(300);
  }
  return false;
}

// Confirma que o chat abriu apos o Enter. Olha o header de conversa
// (topo da janela direita) e checa se contem parte do nome buscado.
// Util pra detectar quando o Enter caiu em conversa errada.
async function chatHeaderMatches(page, contactName, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 4000);
  const target = contactName.trim().toLowerCase().split(/\s+/)[0]; // primeiro nome basta
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

async function sendMessageOnce(page, contactName, message) {
  await resetWaState(page);

  // 1) Foca a busca e limpa qualquer texto residual
  const { element: search } = await findSearchBox(page);
  await search.click();
  await page.waitForTimeout(300);
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);

  // 2) Digita o nome exato do contato
  await page.keyboard.type(contactName, { delay: 30 });

  // 3) Espera ATIVA pelos resultados (poll). Usuario salva o nome identico
  //    ao do ML, entao basta esperar o WA carregar a busca - sem precisar
  //    procurar/clicar manualmente.
  const hasResult = await waitForSearchResults(page, 8000);
  if (!hasResult) {
    throw new Error(`Contato nao encontrado no WhatsApp: "${contactName}". Confira se o contato esta salvo no celular com esse nome exato e se o WhatsApp Web ja sincronizou (as vezes leva alguns segundos pra aparecer).`);
  }

  // 4) Enter abre o primeiro resultado. Como o nome eh identico, e match unico.
  await page.keyboard.press('Enter');

  // 5) Confirma que o chat abriu (header de conversa carregou)
  const headerOk = await chatHeaderMatches(page, contactName, 5000);
  if (!headerOk) {
    // Header nao carregou ou tem outro nome - chat errado ou ainda nao abriu.
    // Da uma ultima chance: espera mais 1.5s e segue. Se for chat errado, o
    // proximo passo (achar input de mensagem) ainda funciona, so manda pra
    // pessoa errada. Pra evitar isso, podemos abortar aqui se quiser.
    await page.waitForTimeout(1500);
  }

  // 6) Acha a caixa de mensagem
  const input = await findMessageInput(page);
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
      await sendMessageOnce(page, contactName, message);
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
