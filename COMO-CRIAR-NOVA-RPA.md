# Como adicionar uma nova RPA

> Manual interno. Quando quiser plugar uma automação nova no Javitech RPA (que apareça na tela inicial junto com a "Enviar Prioridades").

A arquitetura foi pensada pra isso: você cria um módulo novo, registra no menu, monta a UI dela, e pronto. Não mexe nas RPAs existentes.

---

## Estrutura de uma RPA

Uma RPA tem 4 partes:

1. **Registro no menu** — `electron/main.js`, no array `RPAS`. Aparece como tile na tela inicial.
2. **Motor (lógica Node)** — em `src/sua-rpa/runner.js` (e o que mais precisar). Geralmente um `EventEmitter` que emite progresso pra UI ouvir.
3. **IPC handlers** — `electron/main.js`, expostos via `ipcMain.handle('sua-rpa:acao', ...)`.
4. **UI** — uma view em `renderer/app.js` (ou um arquivo novo) com tela e botões.

---

## Passo a passo

### 1) Registre a RPA no menu

Em `electron/main.js`, edite o array `RPAS`:

```js
const RPAS = [
  {
    id: 'enviar-prioridades',
    title: 'Enviar Prioridades',
    description: '...',
    enabled: true
  },
  {
    id: 'minha-nova-rpa',          // <-- adicione aqui
    title: 'Minha Nova RPA',
    description: 'O que ela faz, em uma linha.',
    enabled: true
  }
];
```

### 2) Crie o motor

```bash
mkdir src/minha-nova-rpa
```

Arquivo `src/minha-nova-rpa/runner.js`:

```js
const EventEmitter = require('events');

class MinhaNovaRunner extends EventEmitter {
  async exec(input) {
    this.emit('state', 'running');
    // ...sua lógica aqui...
    this.emit('progress', { done: 1, total: 5 });
    // ...
    this.emit('state', 'done');
  }
}

module.exports = { MinhaNovaRunner };
```

Reaproveite o que estiver disponível em `src/`: `whatsapp.js` pra mandar mensagem, `history.js` pra registrar resultado, `config.js` pra ler/salvar configurações.

### 3) Adicione handlers IPC em `electron/main.js`

```js
const { MinhaNovaRunner } = require('../src/minha-nova-rpa/runner');
let novaRunner = null;

function ensureNovaRunner() {
  if (!novaRunner) {
    novaRunner = new MinhaNovaRunner();
    novaRunner.on('state', s => mainWindow.webContents.send('nova:state', s));
    novaRunner.on('progress', p => mainWindow.webContents.send('nova:progress', p));
  }
  return novaRunner;
}

ipcMain.handle('nova:exec', async (_e, input) => ensureNovaRunner().exec(input));
```

### 4) Exponha no preload

Em `electron/preload.js`, dentro de `contextBridge.exposeInMainWorld('javitech', { ... })`:

```js
nova: {
  exec: input => ipcRenderer.invoke('nova:exec', input)
}
```

E adicione os canais novos no array `allowed` da função `on()`:

```js
const allowed = [
  /* ...existentes... */
  'nova:state',
  'nova:progress'
];
```

### 5) Crie a view no `renderer/app.js`

Adicione uma rota:

```js
const routes = {
  '/': renderHome,
  '/prioridades': renderPrioridades,
  '/minha-nova-rpa': renderMinhaNova,   // <-- nova
  '/configuracoes': renderConfiguracoes,
  '/historico': renderHistorico
};
```

Adicione um template `<template id="tpl-minha-nova-rpa">` em `index.html` com a tela.

Adicione a função `renderMinhaNova()` em `app.js`.

E faça o tile da RPA navegar pra rota nova. Em `renderHome`:

```js
if (rpa.id === 'enviar-prioridades') go('/prioridades');
else if (rpa.id === 'minha-nova-rpa') go('/minha-nova-rpa');
```

### 6) Teste local

```bash
npm run dev
```

Abre o app. Tela inicial mostra a RPA nova como tile clicável.

### 7) Adicione testes

```bash
touch test/minha-nova-rpa.test.js
```

E adicione no `package.json`:

```json
"test": "node test/message.test.js && node test/scraper.test.js && node test/sent-today.test.js && node test/history.test.js && node test/minha-nova-rpa.test.js"
```

### 8) Publica

Veja `COMO-PUBLICAR.md`. Provavelmente é `npm run release minor` (porque adicionou feature nova).

---

## Boas práticas

- **Cada RPA isolada.** Se a sua nova RPA quebrar, a "Enviar Prioridades" continua funcionando. Não compartilhe estado mutável entre runners.
- **Use o `EventEmitter`.** Permite a UI mostrar progresso em tempo real sem polling.
- **Reaproveite `history.js`.** Toda RPA deve gravar o resultado lá com `{ rpa: 'minha-nova-rpa', ... }`. A aba Histórico já filtra por RPA se você quiser.
- **Reaproveite `config.js`.** Configurações da RPA nova ficam num bloco próprio no mesmo `config.json`. A tela de Configurações pode crescer com fieldsets adicionais.
- **Não bloqueie o IPC handler.** Se a RPA demora minutos, o `ipcMain.handle` retorna logo e o progresso vai por eventos.

---

## Exemplo de RPAs futuras (ideias)

- **Relatório diário em PDF** — gera um resumo da operação do dia.
- **Cobrança de saldo** — manda mensagem automática pros motoristas devedores.
- **Conferência de saída** — checa se o motorista saiu com a quantidade correta de pacotes.
- **Aviso de atraso** — detecta rotas paradas há mais de N minutos e avisa o supervisor.

Cada uma vira um tile na tela inicial. Você só liga/desliga via flag `enabled`.
