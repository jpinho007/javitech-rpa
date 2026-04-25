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

// Verifica se a busca encontrou algum contato. Se nao houver resultado,
// o modo "direto" precisa abortar pra esse motorista (contato nao salvo).
async function searchHasResult(page) {
  return await page.evaluate(() => {
    const txt = document.body.innerText || '';
    if (/Nenhuma\s+conversa.*encontrada|Nenhum\s+resultado|No\s+chats?\s+found|No\s+results?/i.test(txt)) {
      return false;
    }
    return true;
  }).catch(() => true);
}

async function sendMessageOnce(page, contactName, message) {
  await resetWaState(page);

  const { element: search } = await findSearchBox(page);
  await search.click();
  await page.waitForTimeout(300);
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);
  await page.keyboard.type(contactName, { delay: 30 });
  await page.waitForTimeout(1800);

  const hasResult = await searchHasResult(page);
  if (!hasResult) {
    throw new Error(`Contato nao encontrado no WhatsApp: "${contactName}"`);
  }

  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

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

module.exports = { sendMessage, findSearchBox, findMessageInput, searchHasResult };
