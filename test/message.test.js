const {
  buildMessage, firstName, firstAndLastName, fullNameTitleCase, getGreeting
} = require('../src/message');

let fails = 0;
function check(name, cond, details) {
  if (cond) console.log(`  OK  ${name}`);
  else { console.log(`  FAIL ${name}`); if (details) console.log('    ', details); fails++; }
}

console.log('\n== firstName ==');
check('bruno batista mendes -> Bruno', firstName('bruno batista mendes') === 'Bruno');
check('JOSE ANTONIO DE LIMA -> Jose', firstName('JOSE ANTONIO DE LIMA') === 'Jose');
check('thiago -> Thiago', firstName('thiago') === 'Thiago');
check('empty -> Motorista', firstName('') === 'Motorista');

console.log('\n== firstAndLastName ==');
check('Lucas Augusto Rape Jorge -> Lucas Jorge',
  firstAndLastName('Lucas Augusto Rape Jorge') === 'Lucas Jorge');
check('adilson silva -> Adilson Silva',
  firstAndLastName('adilson silva') === 'Adilson Silva');
check('JOSE ANTONIO DE LIMA -> Jose Lima (pula "DE")',
  firstAndLastName('JOSE ANTONIO DE LIMA') === 'Jose Lima');
check('Maria das Dores -> Maria Dores',
  firstAndLastName('Maria das Dores') === 'Maria Dores');
check('thiago (1 palavra) -> Thiago',
  firstAndLastName('thiago') === 'Thiago');
check('"" -> Motorista', firstAndLastName('') === 'Motorista');
check('null -> Motorista', firstAndLastName(null) === 'Motorista');
check('"   " -> Motorista', firstAndLastName('   ') === 'Motorista');
check('Richard Assis Ribeiro de Farias -> Richard Farias',
  firstAndLastName('Richard Assis Ribeiro de Farias') === 'Richard Farias');

console.log('\n== fullNameTitleCase (modo direto WhatsApp) ==');
check('JOSE ANTONIO DE LIMA -> Jose Antonio de Lima',
  fullNameTitleCase('JOSE ANTONIO DE LIMA') === 'Jose Antonio de Lima');
check('lucas augusto rape jorge -> Lucas Augusto Rape Jorge',
  fullNameTitleCase('lucas augusto rape jorge') === 'Lucas Augusto Rape Jorge');
check('"  Maria  das  Dores " -> Maria das Dores',
  fullNameTitleCase('  Maria  das  Dores ') === 'Maria das Dores');
check('vazio -> ""', fullNameTitleCase('') === '');

console.log('\n== getGreeting ==');
const morning = new Date('2026-04-22T08:00:00-03:00');
const afternoon = new Date('2026-04-22T14:00:00-03:00');
const night = new Date('2026-04-22T20:00:00-03:00');
check('08h -> Bom dia', getGreeting(morning) === 'Bom dia');
check('14h -> Boa tarde', getGreeting(afternoon) === 'Boa tarde');
check('20h -> Boa noite', getGreeting(night) === 'Boa noite');

console.log('\n== buildMessage: Adilson (negrito + sobrenome) ==');
const adilsonData = {
  sacas: ['24'], places: ['01', '02'],
  comerciais: ['47','48','49','50','51','52','56','57','58','59'],
  residenciais: [{ num: '53', pacotes: 7 }, { num: '55', pacotes: 8 }]
};
const adilsonMsg = buildMessage('adilson silva', adilsonData, night);
check('saudacao com sobrenome', adilsonMsg.startsWith('Boa noite Adilson Silva!'));
check('subtitulo sem negrito', adilsonMsg.includes('Segue as paradas para priorização:'));
check('Sacas com negrito (rotulo)', adilsonMsg.includes('*Sacas:*'));
check('Sacas com negrito (numeros)', adilsonMsg.includes('*24.*'));
check('Place com negrito', adilsonMsg.includes('*Place:*') && adilsonMsg.includes('*01, 02.*'));
check('Comercial com negrito',
  adilsonMsg.includes('*Comercial:*') && adilsonMsg.includes('*47, 48, 49, 50, 51, 52, 56, 57, 58, 59.*'));
check('Residencial com negrito',
  adilsonMsg.includes('*Residencial com grande quantidade de pacotes:*') &&
  adilsonMsg.includes('*53, 55.*'));
check('fechamento sem negrito',
  adilsonMsg.endsWith('Ótima rota ! E boas entregas 🚛🏁'));

console.log('\n== buildMessage: Bruno (residencial com anotacao) ==');
const brunoMsg = buildMessage('bruno batista mendes', {
  sacas: [], places: [],
  comerciais: ['03','04','05','10','18','22','24','25','35','52','53','55'],
  residenciais: [{num:'15',pacotes:5},{num:'19',pacotes:6},{num:'26',pacotes:21}]
}, afternoon);
check('greeting Bruno Mendes', brunoMsg.startsWith('Boa tarde Bruno Mendes!'));
check('Comercial em negrito',
  brunoMsg.includes('*03, 04, 05, 10, 18, 22, 24, 25, 35, 52, 53, 55.*'));
check('residencial com anotacao 26/21',
  brunoMsg.includes('*15, 19, 26(21 pacotes).*'));

console.log('\n== buildMessage: Lucas (caso real Itingucu) ==');
const lucasMsg = buildMessage('Lucas Augusto Rape Jorge', {
  sacas: [], places: ['20'], coletaBuyers: [],
  comerciais: ['25'], residenciais: []
}, afternoon);
check('greeting Lucas Jorge', lucasMsg.startsWith('Boa tarde Lucas Jorge!'));
check('Place 20 em negrito', lucasMsg.includes('*Place:*') && lucasMsg.includes('*20.*'));
check('Comercial 25 em negrito', lucasMsg.includes('*25.*'));

console.log('\n== buildMessage: Coleta Buyer ==');
const pedroMsg = buildMessage('pedro henrique', {
  sacas: [], places: ['01'], coletaBuyers: ['07','08'],
  comerciais: ['20','21'], residenciais: []
}, afternoon);
check('Place antes de Coleta Buyer', pedroMsg.indexOf('Place:') < pedroMsg.indexOf('Coleta Buyer:'));
check('Coleta Buyer antes de Comercial', pedroMsg.indexOf('Coleta Buyer:') < pedroMsg.indexOf('Comercial:'));
check('Coleta Buyer 07, 08 em negrito',
  pedroMsg.includes('*Coleta Buyer:*') && pedroMsg.includes('*07, 08.*'));

console.log(`\n${fails === 0 ? 'TODOS OS TESTES PASSARAM' : `FALHAS: ${fails}`}\n`);
process.exit(fails === 0 ? 0 : 1);
