#!/usr/bin/env node
// Verificações estáticas da interface web (sem dependências): sintaxe, referências e ações conectadas.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const www = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
const errors = [];
const fail = (m) => errors.push(m);
const read = (f) => fs.readFileSync(path.join(www, f), 'utf8');

// 1) Sintaxe de todos os .js
const jsFiles = fs.readdirSync(path.join(www, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f).concat('sw.js');
jsFiles.forEach((f) => { try { execFileSync(process.execPath, ['--check', path.join(www, f)], { stdio: 'pipe' }); } catch (e) { fail(`Erro de sintaxe em ${f}: ${String(e.stderr).split('\n').slice(0, 3).join(' ')}`); } });

// 2) index.html referencia arquivos que existem, e todo .js/.css da pasta é referenciado
const html = read('index.html');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|webmanifest))"/g)].map((m) => m[1]);
refs.forEach((r) => { if (!fs.existsSync(path.join(www, r))) fail(`index.html referencia arquivo inexistente: ${r}`); });
jsFiles.filter((f) => f !== 'sw.js').forEach((f) => { if (!refs.includes(f)) fail(`${f} existe mas não é carregado pelo index.html`); });
fs.readdirSync(path.join(www, 'css')).forEach((f) => { if (!refs.includes('css/' + f)) fail(`css/${f} não é carregado pelo index.html`); });

// 3) Todo data-a usado nas telas tem um manipulador em ACTIONS (evita botão decorativo)
const app = read('js/app.js');
const block = app.slice(app.indexOf('const ACTIONS = {'), app.indexOf('document.addEventListener(\'click\''));
const handlers = new Set([...block.matchAll(/^ {4}(\w+)\(/gm)].map((m) => m[1]));
['js/views.js', 'js/sheets.js', 'js/app.js'].forEach((f) => {
  new Set([...read(f).matchAll(/data-a="(\w+)"/g)].map((m) => m[1])).forEach((a) => { if (!handlers.has(a)) fail(`${f}: ação "${a}" não tem manipulador em ACTIONS`); });
});
const confirms = new Set([...app.matchAll(/what: '(\w+)'/g)].map((m) => m[1]));
const confBlock = app.slice(app.indexOf('const CONFIRM = {'), app.indexOf('/* ---------- backup'));
confirms.forEach((c) => { if (!new RegExp('^ {4}' + c + '\\(', 'm').test(confBlock)) fail(`confirmação "${c}" sem implementação em CONFIRM`); });

// 3b) ids usados em getElementById existem no index.html ou nas telas
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const allUi = read('js/views.js') + read('js/sheets.js') + app;
[...app.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]).forEach((id) => { if (!ids.has(id) && !allUi.includes(`id="${id}"`)) fail(`id "${id}" usado em app.js não existe em nenhum HTML gerado`); });

// 4) Service worker lista todos os arquivos do app
const sw = read('sw.js');
refs.filter((r) => /\.(js|css)$/.test(r)).forEach((r) => { if (!sw.includes('./' + r)) fail(`sw.js não inclui ${r} no cache`); });

// 5) Boas práticas: sem rede externa, sem eval/alert/confirm nativos
jsFiles.forEach((f) => {
  const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/\b(alert|confirm|prompt)\(/.test(src.replace(/openConfirm\(|function confirm\(|confirm\(c|confirm\b[^(]/g, ''))) { /* diálogos nativos não funcionam no WebView; usamos folhas próprias */ if (/(^|[^.\w])(alert|prompt)\(/.test(src)) fail(`${f}: uso de alert/prompt nativo`); }
  if (/https?:\/\/(?!localhost)/.test(src.replace(/https?:\/\/www\.w3\.org[^'"]*/g, '')) && f !== 'sw.js') fail(`${f}: referência a URL externa`);
  if (/\beval\(|new Function\(/.test(src)) fail(`${f}: uso de eval/new Function`);
});

if (errors.length) { errors.forEach((e) => console.error('::error::' + e)); console.error(`\n${errors.length} problema(s) encontrado(s).`); process.exit(1); }
console.log(`Verificações estáticas OK: ${jsFiles.length} scripts, ${refs.length} referências, ${handlers.size} ações.`);
