const config = require('./config');

// ---------------------------------------------------------------------------
// Classificação das paradas (fonte de verdade)
// ---------------------------------------------------------------------------
// Prioridade (uma parada entra em UMA categoria):
//   1. Place        (hasPickupNode || placesAmount > 0)  coleta/place do ML
//   2. Coleta Buyer (hasPickupBuyer === true)   coleta direta com o comprador
//   3. Sacas        (hasBags         === true)   possui saca(s)
//   4. Comercial    (addressTypeBusiness)        endereço comercial
//   5. Residencial  (addressTypeResidential && pacotes >= resMin)
//
// Paradas já concluídas (status === 'complete' sem pendentes) são ignoradas.
//
// IMPORTANTE: nem todo Place é flagado com `hasPickupNode`. Algumas rotas
// trazem Place como `placesAmount > 0` mas com `hasPickupNode === false`
// (ex: rota 370138609, parada 20 / Itinguçu 639). Por isso checamos os dois.
// ---------------------------------------------------------------------------

function isPlaceStop(s) {
  if (s.hasPickupNode) return true;
  if (typeof s.placesAmount === 'number' && s.placesAmount > 0) return true;
  return false;
}

function pad2(n) {
  const s = String(n);
  return s.length < 2 ? '0' + s : s;
}

function packageCount(stop) {
  if (stop.transportUnitsAmount && typeof stop.transportUnitsAmount.shipments === 'number') {
    return stop.transportUnitsAmount.shipments;
  }
  if (typeof stop.shipmentsAmount === 'number') return stop.shipmentsAmount;
  if (typeof stop.ordersAmount === 'number') return stop.ordersAmount;
  return 0;
}

function stopSequence(stop, fallbackIndex) {
  if (stop.sequence != null) return pad2(stop.sequence);
  if (stop.stopNumber != null) return pad2(stop.stopNumber);
  if (stop.order != null) return pad2(stop.order);
  return pad2(fallbackIndex + 1);
}

function isStopCompleted(stop) {
  if (stop.status === 'complete') return true;
  const pending = !!stop.pendingShipments;
  const delivered = !!stop.deliveredShipments;
  const pickedUp = !!stop.pickedUpShipments;
  return !pending && (delivered || pickedUp);
}

function classifyNordicStops(stops, options) {
  options = options || {};
  const resMin = options.resMin != null ? options.resMin : config.residentialPackageThreshold;

  const places = [];
  const coletaBuyers = [];
  const sacasList = [];
  const comerciaisSet = new Set();
  const residenciaisArr = [];

  const active = (stops || []).filter(s => !isStopCompleted(s));

  active.forEach((s, idx) => {
    const seq = stopSequence(s, idx);
    const pkgs = packageCount(s);

    if (isPlaceStop(s)) {
      places.push(seq);
    } else if (s.hasPickupBuyer) {
      coletaBuyers.push(seq);
    } else if (s.hasBags) {
      sacasList.push(seq);
    } else if (s.addressTypeBusiness) {
      comerciaisSet.add(seq);
    } else if (s.addressTypeResidential && pkgs >= resMin) {
      residenciaisArr.push({ num: seq, pacotes: pkgs });
    }
  });

  return {
    sacas: [...new Set(sacasList)].sort(),
    places: [...new Set(places)].sort(),
    coletaBuyers: [...new Set(coletaBuyers)].sort(),
    comerciais: [...comerciaisSet].sort(),
    residenciais: residenciaisArr,
    totalParadas: (stops || []).length
  };
}

function driverNameFromNordic(routeData) {
  if (!routeData) return '';
  const d = routeData.driver;
  if (!d) return '';
  if (typeof d === 'string') return d.trim();
  const candidates = [
    d.driverName,
    d.fullName, d.displayName, d.name,
    [d.firstName, d.lastName].filter(Boolean).join(' ')
  ].filter(Boolean);
  return (candidates[0] || '').trim();
}

function extractFromNordicData(routeData, options) {
  const base = classifyNordicStops((routeData && routeData.stops) || [], options);
  return {
    driver: driverNameFromNordic(routeData),
    ...base
  };
}

// Fallback: parser de innerText (estratégia antiga)
function parseRouteDetailText(text, options) {
  options = options || {};
  const resMin = options.resMin != null ? options.resMin : config.residentialPackageThreshold;
  const lines = (text || '').split('\n').map(l => l.trim());

  const driverMatch = text.match(/Rota\s+\S+\s*\n\s*([^\n]+)\s+ID da rota/i);
  const driver = driverMatch ? driverMatch[1].trim() : '';

  const paradas = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d{2}$/.test(lines[i])) continue;
    const ppLine = (lines[i + 2] || '') + ' ' + (lines[i + 3] || '');
    const ppMatch = ppLine.match(/(\d+)\s*pontos?\s*·\s*(\d+)\s*pacotes?/);
    if (!ppMatch) continue;

    const pacotes = parseInt(ppMatch[2], 10);
    const sacaHeaderMatch = ppLine.match(/(\d+)\s*sacas?/i);

    let commercial = 0, residential = 0;
    let blockEnd = lines.length;
    for (let k = i + 5; k < lines.length; k++) {
      if (/^\d{2}$/.test(lines[k]) && (lines[k + 2] || '').match(/(\d+)\s*pontos?/)) {
        blockEnd = k; break;
      }
    }
    const blockText = lines.slice(i + 4, blockEnd).join(' ');
    const c = blockText.match(/(\d+)\s*comercial/);
    const r = blockText.match(/(\d+)\s*residencial/);
    if (c) commercial = parseInt(c[1], 10);
    if (r) residential = parseInt(r[1], 10);
    const pendentes = (blockText.match(/Pendente/g) || []).length;
    const entregues = (blockText.match(/Entregue/g) || []).length;

    const sacaBlockMatch = blockText.match(/(\d+)\s*sacas?/i);
    const sacas = sacaHeaderMatch
      ? parseInt(sacaHeaderMatch[1], 10)
      : (sacaBlockMatch ? parseInt(sacaBlockMatch[1], 10) : 0);

    const coletaBuyer =
      /Coleta[\s\-]*Buyer/i.test(blockText) ||
      /Coleta\s+do\s+Buyer/i.test(blockText) ||
      /Coleta\s+do\s+comprador/i.test(blockText) ||
      /Buyer\s+Coleta/i.test(blockText);
    const coleta = !coletaBuyer && /Coleta/i.test(blockText);

    const key = lines[i] + '|' + pacotes;
    if (seen.has(key)) continue;
    seen.add(key);

    paradas.push({ num: lines[i], pacotes, commercial, residential, pendentes, entregues, sacas, coleta, coletaBuyer });
  }

  const active = paradas.filter(p => !(p.pendentes === 0 && p.entregues > 0));

  const places = [];
  const coletaBuyers = [];
  const sacasList = [];
  const comerciaisSet = new Set();
  const residenciaisArr = [];

  for (const p of active) {
    if (p.coleta) places.push(p.num);
    else if (p.coletaBuyer) coletaBuyers.push(p.num);
    else if (p.sacas > 0) sacasList.push(p.num);
    else if (p.commercial > 0) comerciaisSet.add(p.num);
    else if (p.residential > 0 && p.pacotes >= resMin) residenciaisArr.push({ num: p.num, pacotes: p.pacotes });
  }

  return {
    driver,
    sacas: [...new Set(sacasList)].sort(),
    places: [...new Set(places)].sort(),
    coletaBuyers: [...new Set(coletaBuyers)].sort(),
    comerciais: [...comerciaisSet].sort(),
    residenciais: residenciaisArr,
    totalParadas: paradas.length
  };
}

function parseRoutesListText(text) {
  const routes = [];
  const seen = new Set();
  const idRegex = /#(\d{9})/g;
  let m;
  while ((m = idRegex.exec(text)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const slice = text.slice(m.index, m.index + 200);
    const nameMatch = slice.match(/#\d{9}[^a-zA-Zá-úÁ-Ú]*([a-záéíóúâêôãõçà ]{5,80})/i);
    routes.push({ id, driver: nameMatch ? nameMatch[1].trim() : '' });
  }
  return routes;
}

async function extractRoutesList(page) {
  await page.goto(config.ml.monitoringUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const text = await page.evaluate(() => document.body.innerText || '');
  return parseRoutesListText(text);
}

async function waitForParadas(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  while (Date.now() < deadline) {
    const hasParadas = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      return /\d+\s*pontos?\s*·\s*\d+\s*pacotes?/i.test(txt);
    });
    if (hasParadas) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function scrollToBottom(page) {
  try {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        const scrollable = document.scrollingElement || document.documentElement;
        let last = -1;
        const timer = setInterval(() => {
          const cur = scrollable.scrollTop;
          scrollable.scrollTop = scrollable.scrollHeight;
          if (cur === last) { clearInterval(timer); resolve(); }
          last = cur;
        }, 400);
        setTimeout(() => { clearInterval(timer); resolve(); }, 4000);
      });
    });
  } catch (_) {}
}

async function extractNordicRouteData(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 12000);
  while (Date.now() < deadline) {
    const data = await page.evaluate(() => {
      try {
        const n = (typeof window !== 'undefined') ? window._n : null;
        const rd = n && n.ctx && n.ctx.r && n.ctx.r.appProps
          && n.ctx.r.appProps.pageProps
          && n.ctx.r.appProps.pageProps.monitoringRouteData;
        if (!rd) return null;
        return {
          id: rd.id,
          driver: rd.driver || null,
          stops: (rd.stops || []).map(s => ({
            id: s.id, sequence: s.sequence, status: s.status,
            pendingShipments: s.pendingShipments,
            deliveredShipments: s.deliveredShipments,
            pickedUpShipments: s.pickedUpShipments,
            notDeliveredShipments: s.notDeliveredShipments,
            hasShipments: s.hasShipments, hasBags: s.hasBags,
            hasPickupNode: s.hasPickupNode, hasPickupBuyer: s.hasPickupBuyer,
            addressTypeResidential: s.addressTypeResidential,
            addressTypeBusiness: s.addressTypeBusiness,
            addressTypeNotCategorized: s.addressTypeNotCategorized,
            transportUnitsAmount: s.transportUnitsAmount,
            ordersAmount: s.ordersAmount,
            placesAmount: s.placesAmount
          }))
        };
      } catch (_) { return null; }
    });
    if (data && Array.isArray(data.stops) && data.stops.length > 0) return data;
    await page.waitForTimeout(500);
  }
  return null;
}

async function extractRouteDetail(page, routeId) {
  const url = config.ml.detailUrlTemplate.replace('{id}', routeId);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const nordic = await extractNordicRouteData(page, 12000);
  if (nordic) {
    const result = extractFromNordicData(nordic, { resMin: config.residentialPackageThreshold });
    if (result.totalParadas > 0) return result;
  }

  await waitForParadas(page, 10000);
  await scrollToBottom(page);
  await page.waitForTimeout(1000);

  let text = await page.evaluate(() => document.body.innerText || '');
  let result = parseRouteDetailText(text, { resMin: config.residentialPackageThreshold });

  if (result.totalParadas === 0) {
    await page.waitForTimeout(3000);
    await scrollToBottom(page);
    await page.waitForTimeout(1000);
    text = await page.evaluate(() => document.body.innerText || '');
    result = parseRouteDetailText(text, { resMin: config.residentialPackageThreshold });
  }
  return result;
}

module.exports = {
  extractRoutesList,
  extractRouteDetail,
  extractNordicRouteData,
  classifyNordicStops,
  extractFromNordicData,
  isPlaceStop,
  parseRouteDetailText,
  parseRoutesListText,
  waitForParadas,
  scrollToBottom
};
