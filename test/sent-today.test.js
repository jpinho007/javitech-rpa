const path = require('path');
const fs = require('fs');
const os = require('os');

// Aponta o storage pra um diretorio temporario
process.env.JAVITECH_USERDATA = fs.mkdtempSync(path.join(os.tmpdir(), 'javitech-sent-test-'));

const sentMod = require('../src/sent-today');

let fails = 0;
function check(name, cond, details) {
  if (cond) console.log(`  OK  ${name}`);
  else { console.log(`  FAIL ${name}`); if (details) console.log('    ', details); fails++; }
}

function cleanup() {
  try { fs.rmSync(process.env.JAVITECH_USERDATA, { recursive: true, force: true }); } catch (_) {}
}

try {
  sentMod.reset();

  console.log('\n== sent-today: estado inicial ==');
  {
    const s = sentMod.load();
    check('entries vazio', Array.isArray(s.entries) && s.entries.length === 0);
    check('ids vazio', s.ids.size === 0);
    check('date no formato yyyy-mm-dd', /^\d{4}-\d{2}-\d{2}$/.test(s.date));
  }

  console.log('\n== sent-today: marca e detecta ==');
  {
    sentMod.markSent('999111222', 'Teste Driver');
    check('wasSentToday true', sentMod.wasSentToday('999111222'));
    check('wasSentToday outro = false', !sentMod.wasSentToday('outro'));
    const s = sentMod.load();
    check('1 entry', s.entries.length === 1);
    check('driver salvo', s.entries[0].driver === 'Teste Driver');
  }

  console.log('\n== sent-today: nao duplica ==');
  {
    sentMod.markSent('999111222', 'A');
    sentMod.markSent('999111222', 'B');
    check('continua com 1 entry', sentMod.load().entries.length === 1);
  }

  console.log('\n== sent-today: vira o dia => zera ==');
  {
    const raw = JSON.parse(fs.readFileSync(sentMod.STORE_PATH, 'utf-8'));
    raw.date = '2020-01-01';
    fs.writeFileSync(sentMod.STORE_PATH, JSON.stringify(raw));
    const s = sentMod.load();
    check('estado novo (entries=0)', s.entries.length === 0);
    check('date != "2020-01-01"', s.date !== '2020-01-01');
  }

  console.log('\n== sent-today: todayKey BR ==');
  {
    const k = sentMod.todayKey();
    check('formato yyyy-mm-dd', /^\d{4}-\d{2}-\d{2}$/.test(k));
    const fixed = new Date('2026-04-24T03:00:00Z'); // 00:00 BRT
    check('2026-04-24 em BRT', sentMod.todayKey(fixed) === '2026-04-24');
  }

  console.log(`\n${fails === 0 ? 'TODOS OS TESTES PASSARAM' : `FALHAS: ${fails}`}\n`);
  cleanup();
  process.exit(fails === 0 ? 0 : 1);
} catch (e) {
  cleanup();
  console.error('ERRO no teste:', e);
  process.exit(2);
}
