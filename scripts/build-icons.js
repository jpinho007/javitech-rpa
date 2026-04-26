#!/usr/bin/env node
// scripts/build-icons.js
//
// Le build/icon.svg e gera build/icon.png (512x512) + build/icon.ico (multi-size).
// Roda com: npm run icons
//
// Dependencias: sharp + png-to-ico (devDependencies). Os dois sao puro JS/native
// e funcionam em Windows sem precisar de ImageMagick/etc instalado.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'build', 'icon.svg');
const pngPath = path.join(root, 'build', 'icon.png');
const icoPath = path.join(root, 'build', 'icon.ico');

if (!fs.existsSync(svgPath)) {
  console.error(`Nao achei ${svgPath}. Crie o icone SVG primeiro.`);
  process.exit(1);
}

let sharp, pngToIco;
try {
  sharp = require('sharp');
  pngToIco = require('png-to-ico');
} catch (e) {
  console.error('Faltam dependencias. Roda: npm install');
  console.error(e.message);
  process.exit(1);
}

(async () => {
  const svg = fs.readFileSync(svgPath);

  // 1) Gera PNG 512x512 pro Electron usar em runtime (icone da janela)
  console.log('Gerando build/icon.png (512x512)...');
  await sharp(svg, { density: 384 })
    .resize(512, 512)
    .png()
    .toFile(pngPath);

  // 2) Gera multiplos PNGs e empacota em ICO (Windows tem que ter
  //    16, 32, 48, 64, 128, 256 pra renderizar bem em qualquer contexto)
  console.log('Gerando build/icon.ico (multi-size)...');
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = [];
  for (const s of sizes) {
    const buf = await sharp(svg, { density: 384 })
      .resize(s, s)
      .png()
      .toBuffer();
    buffers.push(buf);
  }
  const icoBuf = await pngToIco(buffers);
  fs.writeFileSync(icoPath, icoBuf);

  console.log('');
  console.log('Pronto:');
  console.log('  ' + pngPath);
  console.log('  ' + icoPath);
})().catch(e => {
  console.error('Erro gerando icones:', e.message);
  process.exit(1);
});
