# Javitech RPA

Plataforma desktop pra automações operacionais (Windows).

A primeira RPA disponível é **Enviar Prioridades**: lê as rotas do dia no painel do Mercado Livre (envios.adminml.com), classifica as paradas em Sacas / Place / Coleta Buyer / Comercial / Residencial e manda mensagem no WhatsApp Web — pode mandar tudo pra um contato fixo (ex: "MEU OI") **ou** uma mensagem por motorista, direto pro contato do motorista.

A arquitetura é **Electron + Node + Playwright**. O motor das RPAs roda no processo principal (Node), a UI roda num processo separado (HTML/CSS/JS) e os dois conversam por IPC.

---

## Documentação

- [`INSTALACAO.md`](./INSTALACAO.md) — instalação na máquina do cliente.
- [`COMO-PUBLICAR.md`](./COMO-PUBLICAR.md) — pra **você (Javitech)**: como publicar uma nova versão pra todas as máquinas instaladas.
- [`COMO-CRIAR-NOVA-RPA.md`](./COMO-CRIAR-NOVA-RPA.md) — quando quiser adicionar uma RPA nova (futuras automações).

---

## Estrutura

```
javitech-rpa/
├── package.json                <- versão, scripts, build config
├── config.json                 <- valores padrão (template). O config real fica em userData.
├── electron/
│   ├── main.js                 <- processo principal (BrowserWindow + IPC)
│   ├── preload.js              <- bridge segura main <-> renderer
│   └── updater.js              <- electron-updater (auto-update via GitHub Releases)
├── renderer/
│   ├── index.html              <- SPA com router em hash
│   ├── styles.css              <- estilos
│   └── app.js                  <- lógica das views (home, prioridade, settings, histórico)
├── src/
│   ├── config.js               <- carrega/salva config.json em userData
│   ├── scraper.js              <- extrai rotas do ML (Nordic state + fallback innerText)
│   ├── message.js              <- monta a mensagem (negrito + nome+sobrenome)
│   ├── whatsapp.js             <- automação do WhatsApp Web (Playwright)
│   ├── sent-today.js           <- estado diário de envios (zera ao virar dia)
│   ├── history.js              <- histórico de N dias (default 30)
│   └── runner.js               <- orquestrador da RPA "Enviar Prioridades" com EventEmitter
├── test/
│   ├── message.test.js
│   ├── scraper.test.js
│   ├── sent-today.test.js
│   └── history.test.js
├── build/
│   ├── icon.ico                <- (você adiciona) ícone Windows 256x256
│   ├── icon.png                <- (você adiciona) ícone runtime 512x512
│   └── installer.nsh           <- customização NSIS (vazio por padrão)
├── scripts/
│   └── bump-version.js         <- bump + commit + tag
└── .github/workflows/release.yml  <- CI: build + publish ao push de tag vX.Y.Z
```

---

## Modo desenvolvedor

```bash
npm install
npm test            # roda os 4 arquivos de teste (message, scraper, sent-today, history)
npm run dev         # abre o app em modo desenvolvimento
```

Em modo dev o auto-updater fica desligado e o `config.json` é lido da raiz do projeto.

## Empacotar localmente (gerar .exe sem publicar)

```bash
npm run pack        # gera dist/win-unpacked/ - app pronto pra rodar sem instalar
npm run build       # gera dist/Javitech-RPA-Setup-X.Y.Z.exe (instalador NSIS)
```

## Publicar nova versão

Veja [`COMO-PUBLICAR.md`](./COMO-PUBLICAR.md) — basicamente:

```bash
npm run release          # patch (default)
git push && git push --tags
```

O GitHub Actions faz o resto: build + publica no Releases. Os clientes recebem a atualização sozinha na próxima vez que abrirem o app.

---

## Onde ficam os arquivos do usuário

Em produção (app instalado), todo o estado do app fica em:

```
%APPDATA%\Javitech RPA\
├── config.json            <- configurações editadas via UI
├── .browser-profile\      <- sessão salva ML + WhatsApp
├── .sent-today.json       <- IDs enviados hoje
├── .history.json          <- histórico (até 30 dias)
└── javitech-rpa.log       <- log do dia
```

Botão **"Abrir pasta de dados"** na tela de Configurações abre essa pasta.

---

## Licença

Software proprietário. Uso interno Javitech / clientes contratados.
