// Teste de fumaça da interface em jsdom: carrega index.html + scripts como o WebView e navega pelas telas.
// Não substitui testes em aparelho real (layout/toque/teclado virtual não são verificados aqui).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const www = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');

const opened = [];
test.after(() => opened.forEach((w) => { try { w.close(); } catch (e) { /* já fechada */ } }));
function boot(initialStorage) {
  const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8').replace(/<script src="[^"]*"><\/script>/g, '');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.stack || e)));
  vc.on('error', (e) => errors.push(String(e)));
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; opened.push(w);
  Object.entries(initialStorage || {}).forEach(([k, v]) => w.localStorage.setItem(k, v));
  w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  w.CSS = { escape: (s) => String(s) };
  w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
  w.addEventListener('error', (e) => errors.push(String(e.error && e.error.stack || e.message)));
  const order = [...fs.readFileSync(path.join(www, 'index.html'), 'utf8').matchAll(/<script src="([^"]*)"><\/script>/g)].map((m) => m[1]);
  order.forEach((f) => { w.eval(fs.readFileSync(path.join(www, f), 'utf8') + '\n//# sourceURL=' + f); });
  const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
  const click = (el) => { assert.ok(el, 'elemento para clicar não encontrado'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); };
  const clickA = (a, extra) => click($(`[data-a="${a}"]${extra || ''}`));
  const type = (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  return { w, dom, errors, $, $$, click, clickA, type, tab: (t) => clickA('tab', `[data-v="${t}"]`), text: () => w.document.body.textContent };
}

test('primeiro uso: estado vazio acolhedor, sem erros e sem dados de exemplo', () => {
  const a = boot();
  assert.match(a.text(), /Comece com um passo pequeno/);
  assert.equal(a.$$('.item').length, 0);
  assert.deepEqual(a.errors, []);
});
test('todas as abas renderizam sem erro (vazias)', () => {
  const a = boot();
  ['prog', 'agenda', 'dia', 'aju', 'hoje'].forEach((t) => { a.tab(t); assert.ok(a.$('#app .page'), t); });
  assert.deepEqual(a.errors, []);
});
test('criar hábito, concluir, desfazer e ver XP no histórico', () => {
  const a = boot();
  a.clickA('menu'); a.clickA('hnew');
  a.type('#f-name', 'Meditar'); a.clickA('hsave');
  assert.equal(a.$('.scrim'), null);
  const chk = a.$('.item [data-a="htog"]');
  assert.equal(chk.getAttribute('aria-pressed'), 'false');
  a.click(chk);
  assert.equal(a.$('.item [data-a="htog"]').getAttribute('aria-pressed'), 'true');
  assert.match(a.$('#toast').textContent, /\+\d+ XP/);
  a.click(a.$('.item [data-a="htog"]'));
  assert.equal(a.$('.item [data-a="htog"]').getAttribute('aria-pressed'), 'false');
  a.tab('prog'); a.clickA('jtab', '[data-v="hist"]');
  assert.match(a.text(), /Estorno/);
  assert.deepEqual(a.errors, []);
});
test('validação de formulário mostra erro acessível e não cria hábito vazio', () => {
  const a = boot();
  a.clickA('menu'); a.clickA('hnew'); a.clickA('hsave');
  assert.equal(a.$('#f-err').hidden, false);
  assert.equal(a.$('#f-err').getAttribute('role'), 'alert');
  assert.equal(JSON.parse(a.w.localStorage.getItem('mygoals-v3')).goals.length, 0);
});
test('tarefa com horário aparece em Hoje, na Agenda (dia e semana) e pode ser editada e excluída com confirmação', () => {
  const a = boot();
  a.clickA('menu'); a.clickA('tnew');
  a.type('#f-title', 'Reunião'); a.type('#f-time', '05:30'); a.$('#f-prio').checked = true; a.clickA('tsave');
  assert.match(a.text(), /Reunião/); assert.match(a.text(), /Prioridade alta/);
  a.tab('agenda'); assert.match(a.text(), /05:30/);
  a.clickA('aview', '[data-v="semana"]'); assert.match(a.$('.agenda-grid').textContent, /Reunião/); // hora 05h agora visível
  a.clickA('tedit'); a.type('#f-title', 'Reunião 2'); a.clickA('tsave'); assert.match(a.text(), /Reunião 2/);
  a.clickA('tedit'); a.clickA('tdelask');
  assert.match(a.text(), /Excluir tarefa\?/);
  a.clickA('close'); assert.ok(a.$('#f-title'), 'cancelar volta ao formulário');
  a.clickA('tdelask'); a.clickA('yes');
  assert.doesNotMatch(a.$('#app').textContent, /Reunião 2/);
  assert.deepEqual(a.errors, []);
});
test('notas: criar, buscar e excluir com confirmação', () => {
  const a = boot();
  a.tab('dia'); a.clickA('nnew'); a.type('#nt', 'Ideia'); a.type('#nb', 'conteúdo importante'); a.type('#ntg', 'x, y'); a.clickA('nsave');
  assert.match(a.$('#nl').textContent, /Ideia/);
  a.type('#q', 'inexistente'); assert.match(a.$('#nl').textContent, /Nada encontrado/);
  a.type('#q', 'importante'); assert.match(a.$('#nl').textContent, /Ideia/);
  a.clickA('nopen'); a.clickA('ndelask'); a.clickA('close'); assert.ok(a.$('#nt'), 'cancelar volta à nota');
  a.clickA('ndelask'); a.clickA('yes'); assert.equal(a.$('.note'), null);
  assert.deepEqual(a.errors, []);
});
test('botão Voltar: fecha camadas, volta para Hoje e só então permite sair', () => {
  const a = boot();
  assert.equal(a.w.MGApp.handleBack(), 'exit');
  a.tab('aju'); assert.equal(a.w.MGApp.handleBack(), 'tab'); assert.ok(a.$('[data-a="tab"][data-v="hoje"][aria-current="page"]'));
  a.clickA('menu'); assert.equal(a.w.MGApp.handleBack(), 'modal'); assert.equal(a.$('.scrim'), null);
  assert.equal(a.w.MGApp.handleBack(), 'exit');
});
test('importar backup inválido mostra erro e não altera os dados', () => {
  const a = boot();
  a.clickA('menu'); a.clickA('hnew'); a.type('#f-name', 'Salvar'); a.clickA('hsave');
  const before = a.w.localStorage.getItem('mygoals-v3');
  a.tab('aju'); a.clickA('importopen'); a.type('#imp-text', '{"isso":"não é backup"}'); a.clickA('impanalyze');
  assert.match(a.text(), /Backup recusado/);
  assert.equal(a.$('[data-a="impapply"]'), null);
  assert.equal(a.w.localStorage.getItem('mygoals-v3'), before);
});
test('importar backup válido: pré-visualiza, confirma, substitui e guarda cópia', () => {
  const src = boot(); src.clickA('menu'); src.clickA('hnew'); src.type('#f-name', 'Do backup'); src.clickA('hsave');
  const json = src.w.MG.backup.toJson(src.w.MG.storage.load(src.w.localStorage).state);
  const a = boot();
  a.tab('aju'); a.clickA('importopen'); a.type('#imp-text', json); a.clickA('impanalyze');
  assert.match(a.text(), /Conteúdo do backup/);
  a.clickA('impapply');
  a.tab('hoje'); assert.match(a.text(), /Do backup/);
  assert.ok(a.w.localStorage.getItem('mygoals-v3-snapshot'));
  assert.deepEqual(a.errors, []);
});
test('migração: dados v2 no localStorage aparecem na v3 e a chave v2 permanece', () => {
  const v2 = { p: { name: 'Abner', photo: '' }, goals: [{ id: 'g0', name: 'Beber água', emoji: '', color: '#0A84FF', type: 'daily', target: 8, unit: 'copos', start: '2025-03-01' }], e: { g0: { '2025-03-01': 8 } }, tasks: [], notes: [], game: { baseXp: 10, awards: [], unlocked: {}, missionClaims: {}, activeDays: {}, claimedKeys: { 'goalday:g0:2025-03-01': true } } };
  const a = boot({ 'mygoals-v2': JSON.stringify(v2) });
  assert.match(a.text(), /Beber água/); assert.match(a.text(), /versão 3/);
  assert.equal(a.w.localStorage.getItem('mygoals-v2'), JSON.stringify(v2));
  assert.ok(a.w.localStorage.getItem('mygoals-v3'));
  assert.deepEqual(a.errors, []);
});
test('dados de exemplo: exige confirmação, guarda cópia e pode ser desfeito', () => {
  const a = boot();
  a.tab('aju'); a.clickA('sample'); assert.match(a.text(), /Carregar dados de exemplo\?/);
  a.clickA('yes'); a.tab('hoje'); assert.ok(a.$$('.item').length > 0);
  a.tab('aju'); a.clickA('restoresnap'); a.clickA('yes'); a.tab('hoje');
  assert.equal(a.$$('.item').length, 0);
  assert.deepEqual(a.errors, []);
});
test('tela Jornada com dados de exemplo: missões, conquistas bloqueadas com critério, evolução', () => {
  const a = boot();
  a.tab('aju'); a.clickA('sample'); a.clickA('yes'); a.tab('prog');
  assert.match(a.text(), /XP restantes/);
  assert.ok(a.$$('.mission').length >= 6);
  a.clickA('jtab', '[data-v="conq"]'); assert.ok(a.$$('.badge-card.locked').length > 0); assert.match(a.$('.badge-card.locked').textContent, /Bloqueada/);
  a.clickA('jtab', '[data-v="evo"]'); assert.ok(a.$('.heat'));
  assert.deepEqual(a.errors, []);
});
test('acessibilidade básica: botões de ícone têm nome, abas têm aria-current, HTML sem ids duplicados', () => {
  const a = boot(); a.tab('aju'); a.clickA('sample'); a.clickA('yes'); a.tab('hoje');
  const nameless = a.$$('button').filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label'));
  assert.deepEqual(nameless.map((b) => b.outerHTML.slice(0, 80)), []);
  const ids = a.$$('[id]').map((e) => e.id); assert.equal(new Set(ids).size, ids.length);
  assert.equal(a.$$('#nv [aria-current="page"]').length, 1);
});
test('tema: preferência é persistida e aplicada', () => {
  const a = boot(); a.tab('aju'); a.clickA('theme', '[data-v="dark"]');
  assert.equal(a.w.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(JSON.parse(a.w.localStorage.getItem('mygoals-v3')).prefs.theme, 'dark');
});
