# Ícones

Esta pasta tem o **`icon.svg`** — fonte de verdade do logo Javitech RPA. A partir dele a gente gera:

- `icon.ico` — usado pelo `electron-builder` no Windows (multi-tamanho 16-256px).
- `icon.png` — usado pelo Electron como ícone da janela em runtime (512x512).

## Como gerar/atualizar

Sempre que mexer no `icon.svg`, roda:

```bash
npm install   # uma vez (instala sharp + png-to-ico)
npm run icons
```

Pronto. O script `scripts/build-icons.js` lê o SVG e cospe `icon.png` + `icon.ico` na hora.

## Editando o ícone

`icon.svg` é texto puro — abre em qualquer editor (Notepad, VS Code) ou no Inkscape, edita à vontade, salva, roda `npm run icons` de novo.

A versão atual usa:
- Quadrado arredondado (radius 96/512) com gradiente azul→roxo (`#3b82f6` → `#8b5cf6`).
- Letra "J" branca, peso 900, centralizada.
- Pontinho branco no canto superior direito (sugere automação).
