#!/usr/bin/env node
// scripts/bump-version.js
//
// Uso: npm run release [-- patch|minor|major]
// Faz: bump da versao no package.json, commit "chore(release): vX.Y.Z" e
// cria a tag git vX.Y.Z. O caller (npm script) depois faz git push e
// git push --tags - o que dispara o workflow do GitHub.
//
// Sem argumento, faz bump de patch (X.Y.Z -> X.Y.Z+1).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const arg = (process.argv[2] || 'patch').toLowerCase();
const valid = ['major', 'minor', 'patch'];
if (!valid.includes(arg)) {
  console.error(`Uso: node scripts/bump-version.js [${valid.join('|')}]`);
  process.exit(1);
}

const [maj, min, pat] = pkg.version.split('.').map(Number);
let next;
if (arg === 'major') next = `${maj + 1}.0.0`;
else if (arg === 'minor') next = `${maj}.${min + 1}.0`;
else next = `${maj}.${min}.${pat + 1}`;

console.log(`Bump: ${pkg.version} -> ${next}`);
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

run(`git add package.json`);
run(`git commit -m "chore(release): v${next}"`);
run(`git tag v${next}`);

console.log(`\nFeito! Agora rode: git push && git push --tags`);
console.log(`O GitHub Actions vai construir e publicar o release automaticamente.`);
