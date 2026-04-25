const {
  parseRouteDetailText,
  parseRoutesListText,
  classifyNordicStops,
  extractFromNordicData,
  isPlaceStop
} = require('../src/scraper');

let fails = 0;
function check(name, cond, details) {
  if (cond) console.log(`  OK  ${name}`);
  else { console.log(`  FAIL ${name}`); if (details) console.log('    ', details); fails++; }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function paradaBlock(num, pontos, pacotes, tipo, opts) {
  opts = opts || {};
  const sacas = opts.sacas || 0;
  const coletaKind = opts.coletaKind || null;
  const pendente = opts.pendente != null ? opts.pendente : pacotes;
  const entregue = opts.entregue || 0;
  const lines = [num, ''];
  let headerLine = `${pontos} pontos · ${pacotes} pacotes`;
  if (sacas > 0) headerLine += ` · ${sacas} saca${sacas > 1 ? 's' : ''}`;
  lines.push(headerLine, '');
  if (tipo === 'comercial') lines.push('1 comercial');
  else if (tipo === 'residencial') lines.push(`${pacotes} residencial`);
  else if (tipo === 'misto') { lines.push('1 comercial'); lines.push('2 residencial'); }
  else lines.push('Não especificado');
  if (coletaKind === 'no') lines.push('Coleta Nó');
  if (coletaKind === 'buyer') lines.push('Coleta Buyer');
  for (let i = 0; i < pendente; i++) lines.push('Pendente');
  for (let i = 0; i < entregue; i++) lines.push('Entregue');
  return lines;
}
function buildDetailText(driver, paradas) {
  const header = ['Rota 368744496', driver, 'ID da rota 368744496', '', ''];
  const body = [];
  for (const p of paradas) body.push(...paradaBlock(p.num, p.pontos, p.pacotes, p.tipo, p.opts));
  return [...header, ...body].join('\n');
}

console.log('\n== parseRouteDetailText: driver name ==');
{
  const text = buildDetailText('bruno batista mendes', [{ num: '01', pontos: 1, pacotes: 2, tipo: 'comercial' }]);
  check('extrai nome do motorista', parseRouteDetailText(text).driver === 'bruno batista mendes');
}

console.log('\n== parseRouteDetailText: comerciais simples ==');
{
  const text = buildDetailText('x', [
    { num: '01', pontos: 1, pacotes: 2, tipo: 'comercial' },
    { num: '02', pontos: 1, pacotes: 1, tipo: 'residencial' },
    { num: '06', pontos: 1, pacotes: 3, tipo: 'comercial' },
    { num: '17', pontos: 1, pacotes: 1, tipo: 'comercial' }
  ]);
  const r = parseRouteDetailText(text);
  check('3 comerciais', eq(r.comerciais, ['01', '06', '17']));
  check('nenhum residencial', r.residenciais.length === 0);
  check('nenhuma saca', r.sacas.length === 0);
  check('nenhum place', r.places.length === 0);
}

console.log('\n== parseRouteDetailText: residencial >= threshold ==');
{
  const text = buildDetailText('y', [
    { num: '18', pontos: 1, pacotes: 4, tipo: 'residencial' },
    { num: '23', pontos: 1, pacotes: 5, tipo: 'residencial' },
    { num: '28', pontos: 1, pacotes: 31, tipo: 'residencial' }
  ]);
  const r = parseRouteDetailText(text);
  check('exclui <5', !r.residenciais.some(p => p.num === '18'));
  check('inclui 5', r.residenciais.some(p => p.num === '23'));
  check('inclui 31', r.residenciais.some(p => p.num === '28' && p.pacotes === 31));
}

console.log('\n== parseRouteDetailText: exclui parada entregue ==');
{
  const text = buildDetailText('x', [
    { num: '01', pontos: 1, pacotes: 2, tipo: 'comercial' },
    { num: '44', pontos: 1, pacotes: 3, tipo: 'comercial', opts: { pendente: 0, entregue: 3 } },
    { num: '54', pontos: 1, pacotes: 1, tipo: 'comercial' }
  ]);
  const r = parseRouteDetailText(text);
  check('exclui 44', !r.comerciais.includes('44'));
  check('mantem 01 e 54', eq(r.comerciais, ['01', '54']));
}

console.log('\n== parseRouteDetailText: Sacas ==');
{
  const text = buildDetailText('y', [
    { num: '24', pontos: 1, pacotes: 5, tipo: 'residencial', opts: { sacas: 1 } },
    { num: '30', pontos: 1, pacotes: 2, tipo: 'comercial' }
  ]);
  const r = parseRouteDetailText(text);
  check('24 em sacas', r.sacas.includes('24'));
  check('24 NAO em residenciais', !r.residenciais.some(p => p.num === '24'));
  check('30 em comerciais', r.comerciais.includes('30'));
}

console.log('\n== parseRouteDetailText: Place (Coleta No) ==');
{
  const text = buildDetailText('z', [
    { num: '01', pontos: 2, pacotes: 10, tipo: 'vazio', opts: { coletaKind: 'no' } },
    { num: '02', pontos: 1, pacotes: 5, tipo: 'vazio', opts: { coletaKind: 'no' } },
    { num: '47', pontos: 1, pacotes: 2, tipo: 'comercial' }
  ]);
  const r = parseRouteDetailText(text);
  check('01, 02 em places', eq(r.places, ['01', '02']));
  check('places NAO em coletaBuyers', r.coletaBuyers.length === 0);
  check('47 em comerciais', r.comerciais.includes('47'));
}

console.log('\n== parseRouteDetailText: Coleta Buyer ==');
{
  const text = buildDetailText('w', [
    { num: '07', pontos: 1, pacotes: 3, tipo: 'vazio', opts: { coletaKind: 'buyer' } },
    { num: '08', pontos: 1, pacotes: 5, tipo: 'vazio', opts: { coletaKind: 'buyer' } },
    { num: '20', pontos: 1, pacotes: 2, tipo: 'comercial' }
  ]);
  const r = parseRouteDetailText(text);
  check('07, 08 em coletaBuyers', eq(r.coletaBuyers, ['07', '08']));
  check('NAO vazaram pra places', r.places.length === 0);
  check('20 normal em comerciais', r.comerciais.includes('20'));
}

console.log('\n== parseRoutesListText ==');
{
  const text = `
Monitoramento de rotas
Rota #368744496
bruno batista mendes
Em andamento
Rota #368744500
thiago matias de oliveira
Em andamento
Rota #368744501
jose antonio de lima
Em andamento
`;
  const r = parseRoutesListText(text);
  check('3 rotas', r.length === 3);
  check('primeiro id ok', r[0] && r[0].id === '368744496');
  check('sem duplicatas', new Set(r.map(x => x.id)).size === r.length);
}

// ===== Nordic =====

function nordicStop(sequence, opts) {
  opts = opts || {};
  return {
    id: 'stop-' + sequence,
    sequence,
    status: opts.status || 'incomplete',
    pendingShipments: opts.pending != null ? opts.pending : (opts.pkgs || 1),
    deliveredShipments: opts.delivered || 0,
    pickedUpShipments: opts.pickedUp || 0,
    notDeliveredShipments: 0,
    hasShipments: opts.pkgs > 0,
    hasBags: !!opts.bags,
    hasPickupNode: !!opts.pickupNode,
    hasPickupBuyer: !!opts.pickupBuyer,
    addressTypeResidential: !!opts.residential,
    addressTypeBusiness: !!opts.business,
    addressTypeNotCategorized: false,
    transportUnitsAmount: { shipments: opts.pkgs || 0, bags: opts.bags || 0 },
    ordersAmount: opts.pkgs || 0,
    placesAmount: opts.placesAmount != null ? opts.placesAmount : 0
  };
}

console.log('\n== isPlaceStop ==');
{
  check('hasPickupNode=true', isPlaceStop({ hasPickupNode: true }));
  check('placesAmount=1 (Itingucu - bug 370138609)',
    isPlaceStop({ hasPickupNode: false, placesAmount: 1 }));
  check('placesAmount=3', isPlaceStop({ placesAmount: 3 }));
  check('nada disso', !isPlaceStop({ hasPickupNode: false, placesAmount: 0 }));
  check('placesAmount ausente', !isPlaceStop({ hasPickupNode: false }));
}

console.log('\n== classifyNordicStops: prioridade ==');
{
  const stops = [
    nordicStop(1, { pickupNode: true, pkgs: 10 }),
    nordicStop(2, { pickupBuyer: true, pkgs: 3 }),
    nordicStop(3, { bags: 2, residential: true, pkgs: 5 }),
    nordicStop(4, { business: true, pkgs: 2 }),
    nordicStop(5, { residential: true, pkgs: 6 }),
    nordicStop(6, { pickupNode: true, business: true, pkgs: 1 })
  ];
  const r = classifyNordicStops(stops);
  check('Place inclui 01 e 06', eq(r.places, ['01', '06']));
  check('Coleta Buyer inclui 02', eq(r.coletaBuyers, ['02']));
  check('Sacas inclui 03', eq(r.sacas, ['03']));
  check('Comercial inclui 04', eq(r.comerciais, ['04']));
  check('Residencial inclui 05', r.residenciais.length === 1 && r.residenciais[0].num === '05');
}

console.log('\n== classifyNordicStops: exclui paradas concluidas ==');
{
  const stops = [
    nordicStop(1, { business: true, pkgs: 2, status: 'complete', pending: 0, delivered: 2 }),
    nordicStop(2, { business: true, pkgs: 3 }),
    nordicStop(3, { business: true, pkgs: 1, pending: 0, delivered: 1 })
  ];
  const r = classifyNordicStops(stops);
  check('exclui 01 (status complete)', !r.comerciais.includes('01'));
  check('exclui 03 (pending=0 + entregue)', !r.comerciais.includes('03'));
  check('mantem 02', r.comerciais.includes('02'));
}

console.log('\n== classifyNordicStops: bug Itingucu (Place via placesAmount) ==');
{
  const stops = [
    { ...nordicStop(20, { residential: true, pkgs: 64 }), placesAmount: 1 },
    nordicStop(25, { business: true, pkgs: 5 }),
    nordicStop(30, { pickupNode: true, pkgs: 8, placesAmount: 1 })
  ];
  const r = classifyNordicStops(stops);
  check('20 em Place (placesAmount=1)', r.places.includes('20'));
  check('30 em Place (hasPickupNode)', r.places.includes('30'));
  check('25 em comerciais', r.comerciais.includes('25'));
  check('20 NAO em residenciais', !r.residenciais.some(p => p.num === '20'));
}

console.log('\n== extractFromNordicData: variacoes de driver ==');
{
  const r1 = extractFromNordicData({
    driver: { driverName: 'Richard Assis Ribeiro de Farias' }, stops: []
  });
  check('driver.driverName real ML', r1.driver === 'Richard Assis Ribeiro de Farias');
  const r2 = extractFromNordicData({ driver: 'thiago matias', stops: [] });
  check('driver string', r2.driver === 'thiago matias');
  const r3 = extractFromNordicData({ driver: { fullName: 'Bruno' }, stops: [] });
  check('driver.fullName fallback', r3.driver === 'Bruno');
  const r4 = extractFromNordicData({ driver: null, stops: [] });
  check('driver null -> ""', r4.driver === '');
}

console.log(`\n${fails === 0 ? 'TODOS OS TESTES PASSARAM' : `FALHAS: ${fails}`}\n`);
process.exit(fails === 0 ? 0 : 1);
