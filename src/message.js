const config = require('./config');

function getGreeting(date) {
  date = date || new Date();
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false
    }).format(date)
  );
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function capitalize(word) {
  if (!word) return '';
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

const STOPWORDS_SOBRENOME = new Set([
  'de', 'da', 'do', 'das', 'dos', 'di', 'du', 'del', 'dela', 'dele',
  'e', 'y', 'la', 'le', 'lo', 'mc', 'mac', 'van', 'von', 'der', 'den'
]);

function firstName(fullName) {
  if (!fullName) return 'Motorista';
  return capitalize(fullName.trim().split(/\s+/)[0]);
}

function firstAndLastName(fullName) {
  if (!fullName) return 'Motorista';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Motorista';
  if (parts.length === 1) return capitalize(parts[0]);
  const first = capitalize(parts[0]);
  let last = '';
  for (let i = parts.length - 1; i >= 1; i--) {
    const p = parts[i].toLowerCase();
    if (!STOPWORDS_SOBRENOME.has(p)) { last = capitalize(parts[i]); break; }
  }
  if (!last) last = capitalize(parts[parts.length - 1]);
  return `${first} ${last}`;
}

function fullNameTitleCase(fullName) {
  // Capitaliza cada parte preservando preposições em minúsculas.
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.map(p => {
    const lower = p.toLowerCase();
    if (STOPWORDS_SOBRENOME.has(lower)) return lower;
    return capitalize(p);
  }).join(' ');
}

function bold(text) { return `*${text}*`; }

function buildMessage(driverFullName, data, date) {
  date = date || new Date();
  const greeting = getGreeting(date);
  const name = firstAndLastName(driverFullName);

  const sacas = data.sacas || [];
  const places = data.places || [];
  const coletaBuyers = data.coletaBuyers || [];
  const comerciais = data.comerciais || [];
  const residenciais = data.residenciais || [];

  const residStrs = residenciais.map(r =>
    r.pacotes >= config.residentialAnnotationThreshold
      ? `${r.num}(${r.pacotes} pacotes)`
      : r.num
  );

  let msg = `${greeting} ${name}!\n`;
  msg += `Segue as paradas para priorização:\n`;

  if (sacas.length > 0)        msg += `${bold('Sacas:')}\n${bold(sacas.join(', ') + '.')}\n`;
  if (places.length > 0)       msg += `${bold('Place:')}\n${bold(places.join(', ') + '.')}\n`;
  if (coletaBuyers.length > 0) msg += `${bold('Coleta Buyer:')}\n${bold(coletaBuyers.join(', ') + '.')}\n`;
  if (comerciais.length > 0)   msg += `${bold('Comercial:')}\n${bold(comerciais.join(', ') + '.')}\n`;
  if (residStrs.length > 0)    msg += `${bold('Residencial com grande quantidade de pacotes:')}\n${bold(residStrs.join(', ') + '.')}\n`;

  msg += `Ótima rota ! E boas entregas 🚛🏁`;
  return msg;
}

module.exports = {
  buildMessage,
  getGreeting,
  firstName,
  firstAndLastName,
  fullNameTitleCase
};
