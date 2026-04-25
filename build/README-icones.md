# Ícones

Esta pasta espera dois ícones:

- `icon.ico` — usado pelo `electron-builder` no Windows. **256x256, formato ICO.**
- `icon.png` — usado pelo Electron como ícone da janela em runtime. **512x512, PNG.**

## Como gerar rápido

1. Faça uma imagem 512x512 PNG do logo Javitech (pode ser online: https://www.canva.com).
2. Salve como `build/icon.png`.
3. Converta pra ICO em https://convertio.co/png-ico/ ou similar e salve como `build/icon.ico`.

Sem esses arquivos o build ainda funciona, mas o app vai aparecer com o ícone padrão do Electron (cinza).
