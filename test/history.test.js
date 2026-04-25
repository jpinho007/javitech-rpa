const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.JAVITECH_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), 'javitech-hist-test-'));

const history = require('../src/history');

let fails = 0;
function check(name, cond, details) {
  if (cond) console.log(`  OK  ${name}`);
  else { console.log(`  FAIL ${name}`); if (details) console.log('    ', details); fails++; }
}

function cleanup() {
  try { fs.rmSync(process.env.JAVITECH_USERDATA, { recursive: true, force: true }); } catch (_) {}
}

try {
  history.clear();

  console.log('\n== history: vazio ==');
  {
    const all = history.load();
    check('vazio', Array.isArray(all) && all.length === 0);
  }

  console.log('\n== history: append e load ==');
  {
    history.append({ rpa: 'enviar-prioridades', routeId: '111', driver: 'A', contact: 'MEU OI', status: 'success' });
    history.append({ rpa: 'enviar-prioridades', routeId: '222', driver: 'B', contact: 'MEU OI', status: 'failed', error: 'x' });
    const all = history.load();
    check('2 entradas', all.length === 2);
    check('mais recente primeiro', new Date(all[0].sentAt) >= new Date(all[1].sentAt));
  }

  console.log('\n== history: poda > N dias ==');
  {
    history.clear();
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    history.append({ routeId: '999', driver: 'velho', status: 'success', sentAt: old }, 30);
    history.append({ routeId: '111', driver: 'novo', status: 'success' }, 30);
    const all = history.load(30);
    check('apenas 1 (velho podado)', all.length === 1);
    check('o novo restou', all[0].routeId === '111');
  }

  console.log('\n== history: bucketize hoje/ontem/semana/mes ==');
  {
    history.clear();
    const now = new Date();
    const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const semanaPassada = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const mesPassado = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    history.append({ routeId: 'h', driver: 'h', status: 'success' });
    history.append({ routeId: 'o', driver: 'o', status: 'success', sentAt: ontem.toISOString() });
    history.append({ routeId: 's', driver: 's', status: 'success', sentAt: semanaPassada.toISOString() });
    history.append({ routeId: 'm', driver: 'm', status: 'success', sentAt: mesPassado.toISOString() });
    const all = history.load();
    const b = history.bucketize(all, now);
    check('hoje tem 1', b.hoje.length >= 1);
    check('total = 4', all.length === 4);
  }

  console.log('\n== history: filtro por rpa ==');
  {
    history.clear();
    history.append({ rpa: 'enviar-prioridades', routeId: 'a', driver: 'A', status: 'success' });
    history.append({ rpa: 'outra-rpa', routeId: 'b', driver: 'B', status: 'success' });
    history.append({ rpa: 'enviar-prioridades', routeId: 'c', driver: 'C', status: 'success' });
    check('total 3', history.load().length === 3);
    check('filter enviar-prioridades = 2', history.load(30, 'enviar-prioridades').length === 2);
    check('filter outra-rpa = 1', history.load(30, 'outra-rpa').length === 1);
    check('filter inexistente = 0', history.load(30, 'naoexiste').length === 0);
  }

  console.log('\n== history: clear por rpa ==');
  {
    history.clear();
    history.append({ rpa: 'A', routeId: '1', driver: 'x', status: 'success' });
    history.append({ rpa: 'B', routeId: '2', driver: 'y', status: 'success' });
    history.clear('A');
    const all = history.load();
    check('apenas B remanesceu', all.length === 1 && all[0].rpa === 'B');
  }

  console.log('\n== history: clear total ==');
  {
    history.clear();
    check('clear deixa vazio', history.load().length === 0);
  }

  console.log(`\n${fails === 0 ? 'TODOS OS TESTES PASSARAM' : `FALHAS: ${fails}`}\n`);
  cleanup();
  process.exit(fails === 0 ? 0 : 1);
} catch (e) {
  cleanup();
  console.error('ERRO no teste:', e);
  process.exit(2);
}
