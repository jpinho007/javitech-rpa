# Como instalar o Javitech RPA

> Manual pro cliente final. Sem termo técnico.

---

## 1) Baixar

Acesse a página de releases e baixe o arquivo `Javitech-RPA-Setup-X.Y.Z.exe` mais recente:

**https://github.com/jpinho007/javitech-rpa/releases/latest**

## 2) Instalar

Dê dois cliques no arquivo baixado.

> **Aviso do Windows:** como o instalador ainda não tem certificado digital, o Windows SmartScreen pode mostrar uma tela azul com a mensagem **"O Windows protegeu seu PC"**. Isso é normal e não significa que o app é malicioso. Para continuar:
>
> 1. Clique em **"Mais informações"**.
> 2. Clique em **"Executar mesmo assim"**.

Siga o assistente: **Avançar → Avançar → Concluir**. Por padrão, o app é instalado em:

```
%LocalAppData%\Programs\javitech-rpa\
```

E cria atalho na área de trabalho e no menu Iniciar.

## 3) Primeira execução

1. Abra o **Javitech RPA** pelo atalho.
2. Na tela inicial, clique em **"Enviar Prioridades"**.
3. Clique em **"Abrir navegador e fazer login"**. Vai abrir uma janela do Chromium com duas abas:
   - **Mercado Livre** — faça login com sua conta de operação.
   - **WhatsApp Web** — escaneie o QR Code com o celular.
4. Quando estiver logado nas duas abas, **volte pro Javitech** e clique em **"Já fiz login, prosseguir"**.

A partir daí o login fica salvo. Nas próximas vezes só clicar e seguir.

## 4) Configurações

Antes de mandar a primeira mensagem, abra a aba **Configurações** e ajuste:

- **Nome do contato fixo:** o contato no seu WhatsApp pra onde TODAS as mensagens serão enviadas (ex: `MEU OI`). Tem que ser o nome **exato** como aparece na sua agenda.
- **Enviar direto para o motorista (opcional):** se ligar, em vez de mandar tudo pro contato fixo, o app procura um contato com o nome COMPLETO do motorista da rota e envia uma mensagem por motorista. Cada motorista precisa estar salvo na sua agenda do WhatsApp pelo nome exato.

Outras opções:

- **Mínimo de pacotes residencial:** quantos pacotes uma parada residencial precisa ter pra entrar na mensagem (padrão 5).
- **Anotação "(N pacotes)":** a partir desse número aparece a anotação ao lado, ex: `26(21 pacotes)` (padrão 20).
- **Delay entre envios:** tempo de espera entre cada mensagem em milissegundos (padrão 3000 = 3 segundos). Reduzir aumenta risco de bloqueio do WhatsApp.
- **Dias de histórico:** quantos dias de histórico manter (padrão 30, máximo 90).

## 5) Como usar no dia-a-dia

1. Abra o **Javitech RPA**.
2. Clique em **Enviar Prioridades**.
3. **Abrir navegador e fazer login** → **Já fiz login, prosseguir** (na primeira vez você precisa logar; nas próximas a sessão fica salva).
4. Escolha o modo:
   - **Todas:** envia pra todas as rotas, incluindo as já enviadas hoje.
   - **Não enviadas:** pula as que já enviou hoje. **Reseta automático no virar do dia.**
   - **Cancelar:** fecha o navegador e volta.
5. **Confira o preview** das mensagens. Cada card mostra o motorista, o contato pra onde vai e o texto da mensagem.
6. Clique em **Enviar mensagens**. Acompanhe a barra de progresso.
7. Final: vê resumo "Enviadas X • Falhas Y".

## 6) Histórico

Aba **Histórico** mostra o que foi enviado dividido em **Hoje / Ontem / Esta semana / Este mês**. Mantém até 30 dias (configurável). Botão "Limpar histórico" apaga tudo.

## 7) Atualizações

O app **só abre depois de verificar atualizações**. É uma trava de segurança: ninguém usa versão velha por engano.

Toda vez que você abre o Javitech RPA, aparece uma tela escura **"Verificando atualizações..."**. Aí:

1. **Se está na versão mais nova** → libera e abre normal (uns 2-5 segundos).
2. **Se tem versão nova** → tela vira **"Baixando atualização vX.Y.Z..."** com barra de progresso. Em seguida **"Aplicando atualização, reiniciando..."**. O app fecha sozinho, instala, e abre na versão nova. Você não faz nada.
3. **Se não conseguir verificar** (sem internet, GitHub fora do ar) → aparece "Não consegui verificar atualizações" com dois botões: **Tentar novamente** ou **Continuar mesmo assim**.

## 8) Onde ficam os dados

Configurações, histórico e sessão de login ficam em:

```
%APPDATA%\Javitech RPA\
```

Pra abrir essa pasta direto, vá em **Configurações → Abrir pasta de dados**.

## 9) Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Windows mostra "Editor desconhecido" ao instalar | É normal sem certificado. Clique "Mais informações → Executar mesmo assim". |
| App não abre depois de instalar | Veja o log em `%APPDATA%\Javitech RPA\javitech-rpa.log` e mande pra suporte. |
| Antivírus apaga sessão de login | Adicione a pasta `%APPDATA%\Javitech RPA\.browser-profile` como exceção. |
| WhatsApp pede QR Code toda vez | O `.browser-profile` foi apagado. Reinstale ou pode logar de novo. |
| Não acha contato no WhatsApp (modo direto) | O contato precisa estar salvo com o **nome exato** do motorista, igual aparece no painel do ML. |
| "Nao encontrei a caixa de busca do WhatsApp" | WA Web atualizou o layout. Aguarde a próxima versão do Javitech. |

---

Suporte: jardel.dta@gmail.com
