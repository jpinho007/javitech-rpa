# Como publicar uma nova versão (Javitech)

> Manual interno. Pra **você**, pra liberar atualizações pra todas as máquinas instaladas.

A ideia é: você muda o código localmente, roda um comando, **pronto** — todas as máquinas que tem o Javitech RPA instalado vão receber a atualização sozinhas na próxima vez que o cliente abrir o app.

---

## Setup inicial (uma vez só)

### 1) Criar o repositório no GitHub

1. Crie um repositório chamado `javitech-rpa` em https://github.com/new — pode ser **privado**.
2. No `package.json`, o `owner` já está apontando pra `jpinho007`:

   ```json
   "publish": [{
     "provider": "github",
     "owner": "jpinho007",
     "repo": "javitech-rpa",
     "releaseType": "release"
   }]
   ```

   E no arquivo `INSTALACAO.md` (link de download).

### 2) Subir o código

```bash
cd javitech-rpa
git init
git add .
git commit -m "feat: versão inicial Javitech RPA"
git branch -M main
git remote add origin https://github.com/jpinho007/javitech-rpa.git
git push -u origin main
```

### 3) Adicionar ícones (opcional mas recomendado)

Coloque dois arquivos em `build/`:

- `build/icon.ico` — 256x256, formato ICO (instalador e atalho).
- `build/icon.png` — 512x512, PNG (ícone da janela em runtime).

Se não colocar, o build funciona com o ícone padrão cinza do Electron.

### 4) Permissões do GitHub Actions

Em **Settings → Actions → General → Workflow permissions**, marque **"Read and write permissions"**. Isso permite o workflow publicar releases automaticamente.

---

## O fluxo de release (toda vez que quiser publicar)

### 1) Mude o código

Faça as alterações que quer no projeto. Teste localmente:

```bash
npm test       # roda os testes
npm run dev    # abre o app pra você ver
```

### 2) Bump da versão e commit

Tem um script pronto:

```bash
npm run release           # bump patch (X.Y.Z -> X.Y.Z+1)
npm run release minor     # bump minor (X.Y.Z -> X.Y+1.0)
npm run release major     # bump major (X.Y.Z -> X+1.0.0)
```

O script:
- atualiza a versão no `package.json`,
- faz `git commit -m "chore(release): vX.Y.Z"`,
- cria a tag `vX.Y.Z`.

> Use **patch** pra correções pequenas (bug fix, ajuste fino), **minor** quando adicionar uma feature ou RPA nova, **major** quando mudar comportamento que quebra o uso anterior.

### 3) Push

```bash
git push && git push --tags
```

A tag dispara o workflow do GitHub Actions automaticamente.

### 4) GitHub Actions faz o resto

Acesse a aba **Actions** do seu repositório. Você vai ver o workflow rodando:

1. Faz checkout do código.
2. Instala dependências.
3. Roda os testes (se algum falhar, o release é abortado).
4. Roda `electron-builder --win --publish always`:
   - Empacota o app pra Windows.
   - Gera o `.exe` instalador (NSIS).
   - Gera os arquivos de auto-update (`latest.yml`, blockmap).
   - Faz upload tudo pro GitHub Releases na tag `vX.Y.Z`.

Demora uns 5-10 minutos. Quando termina, em **Releases** aparece a nova versão com os arquivos.

### 5) Atualização nas máquinas dos clientes

Cada Javitech RPA aberto pelos clientes verifica `https://github.com/.../releases/latest` ao iniciar e a cada 30 minutos. Quando enxerga uma versão nova:

1. Mostra **"Atualização X.Y.Z disponível, baixando..."** na lateral.
2. Baixa em background.
3. Mostra **"Atualização X.Y.Z pronta. Reinicie o app."**.
4. No próximo restart do cliente, o app já abre na versão nova.

Você **não precisa** mandar arquivo, mensagem nem instrução pro cliente. Tudo silencioso.

---

## Versão hotfix (correção urgente)

Mesmo fluxo do "release patch", só que mais rápido. Se você publicar `1.0.5` numa quinta-feira de manhã, todas as máquinas que abrirem o app durante o dia vão pegar a atualização.

## Rollback

Se publicou uma versão com bug grave:

1. Vá em **GitHub → Releases**.
2. Edite a release problemática (ex: `v1.0.5`) e marque como "pre-release" ou apague o release inteiro.
3. Publique uma nova versão de hotfix (ex: `v1.0.6`) com a correção.

> Você **não pode** voltar o cliente pra uma versão anterior automaticamente — o `electron-updater` só anda pra frente. Se realmente precisar, corrija via hotfix novo.

---

## Logs do GitHub Actions

Cada run gera log completo do build. Útil pra debugar quando o build falha.

**Actions → último workflow → click no job → expand cada step.**

Erros comuns:

| Erro | Causa | Fix |
|---|---|---|
| `npm test` falhou | Algum teste quebrou | Rode `npm test` local antes de push |
| `Resource not accessible by integration` | Permissões do workflow | Settings → Actions → "Read and write permissions" |
| `Cannot find module 'X'` | Faltou no package.json | Adiciona dep, faz commit, push |
| `Code signing failed` | Tentou assinar sem cert | `CSC_IDENTITY_AUTO_DISCOVERY=false` (já tá no workflow) |

---

## Resumo prático

```
mudou código
↓
npm run release
↓
git push && git push --tags
↓
[espera 5-10min]
↓
clientes recebem update sozinhos
```

É isso. Sem servidor, sem cobrança mensal, sem TI.
