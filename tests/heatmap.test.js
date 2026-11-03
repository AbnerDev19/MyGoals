const test = require('node:test'), assert = require('node:assert/strict');
const { MG, setToday, freshState, addHabit } = require('./helpers');
const HM = MG.heatmap, D = MG.dates, A = MG.actions;
const backdate = (g, k) => { g.start = k; g.targets[0].from = k; };

test('geometria: 53 colunas × 7 linhas, cada dia na coluna da sua semana e na linha do seu dia da semana', () => {
  setToday('2025-03-05'); // quarta
  const m = HM.build(freshState(), null, '12m', '2025-03-05');
  assert.equal(m.cols, 53); assert.equal(m.cells.length, 53 * 7);
  m.cells.forEach((c) => {
    assert.equal(c.row, D.parse(c.key).getDay(), 'linha = dia da semana: ' + c.key);
    assert.equal(c.col, Math.floor(D.diffKeys(m.start, c.key) / 7), 'coluna = semana: ' + c.key);
  });
  assert.equal(D.parse(m.start).getDay(), 0, 'primeira coluna começa no domingo');
  const last = m.cells.filter((c) => c.col === 52);
  assert.deepEqual(last.filter((c) => c.state !== 'future').map((c) => c.key), ['2025-03-02', '2025-03-03', '2025-03-04', '2025-03-05']);
  assert.ok(last.filter((c) => c.state === 'future').every((c) => c.key > '2025-03-05'));
});
test('períodos 6 e 3 meses terminam na semana atual', () => {
  setToday('2025-03-05');
  assert.equal(HM.build(freshState(), null, '6m', '2025-03-05').cols, 27);
  assert.equal(HM.build(freshState(), null, '3m', '2025-03-05').cols, 14);
  assert.equal(HM.build(freshState(), null, 'xx', '2025-03-05').cols, 53); // valor desconhecido → 12 meses
});
test('rótulos de mês: um por mês, na coluna certa, sem sobreposição', () => {
  setToday('2025-03-05');
  const m = HM.build(freshState(), null, '12m', '2025-03-05');
  const labels = m.months.map((x) => x.label);
  assert.equal(new Set(labels.slice(1)).size, labels.slice(1).length);
  for (let i = 1; i < m.months.length; i++) assert.ok(m.months[i].col - m.months[i - 1].col >= 3, 'espaço mínimo');
  const mar = m.months.find((x) => x.label === 'Mar' && x.col > 40);
  assert.ok(mar, 'março aparece no fim');
  assert.equal(D.addDays(D.parse(m.start), mar.col * 7).getMonth(), 2);
  assert.ok(m.months.every((x) => x.col >= 0 && x.col < 53));
});
test('níveis por hábito: 0 sem registro, 1–3 parcial, 4 meta cumprida; metas semanais usam meta/7', () => {
  setToday('2025-03-05'); const s = freshState();
  const g = addHabit(s, { type: 'daily', target: 10, unit: 'x' }); backdate(g, '2025-02-01');
  [[0, 0], [2, 1], [4, 2], [8, 3], [10, 4], [15, 4]].forEach(([v, lvl]) => { MG.habits.setValue(s, g, '2025-03-01', v); assert.equal(HM.habitLevel(s, g, '2025-03-01'), lvl, v + ''); });
  const w = addHabit(s, { name: 'sem', type: 'weekly', target: 70 }); backdate(w, '2025-02-01');
  MG.habits.setValue(s, w, '2025-03-01', 10); assert.equal(HM.habitLevel(s, w, '2025-03-01'), 4); // 10 = 70/7
});
test('hábito: dias antes do início ficam marcados, futuros invisíveis, resumo conta dias cumpridos', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s); backdate(g, '2025-03-01');
  MG.habits.setValue(s, g, '2025-03-01', 1); MG.habits.setValue(s, g, '2025-03-03', 1);
  const m = HM.build(s, g, '3m', '2025-03-05');
  assert.equal(m.cells.find((c) => c.key === '2025-02-28').state, 'before');
  assert.equal(m.cells.find((c) => c.key === '2025-03-06').state, 'future');
  assert.equal(m.cells.find((c) => c.key === '2025-03-03').level, 4);
  assert.equal(m.done, 2); assert.equal(m.avail, 5);
  assert.match(m.summary, /2 de 5 dias com meta cumprida/);
});
test('visão geral: níveis proporcionais à atividade do dia', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s); backdate(g, '2025-02-01');
  const g2 = addHabit(s, { name: 'b' }); backdate(g2, '2025-02-01');
  MG.habits.setValue(s, g, '2025-03-02', 1);
  MG.habits.setValue(s, g, '2025-03-03', 1); MG.habits.setValue(s, g2, '2025-03-03', 1);
  const m = HM.build(s, null, '3m', '2025-03-05');
  const lv = (k) => m.cells.find((c) => c.key === k).level;
  assert.equal(lv('2025-03-01'), 0); assert.equal(lv('2025-03-03'), 4); assert.ok(lv('2025-03-02') >= 1 && lv('2025-03-02') < 4);
  assert.equal(m.activeDays, 2);
  assert.equal(HM.levelFromCount(0, 5), 0); assert.equal(HM.levelFromCount(5, 5), 4); assert.equal(HM.levelFromCount(1, 100), 1);
});
test('HTML: cada coluna tem 7 células, legenda e rótulos de Seg/Qua/Sex; textos do usuário são escapados', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s, { name: '<img src=x onerror=alert(1)>' }); 
  const html = HM.render({ s, today: '2025-03-05' }, g, '12m');
  assert.equal((html.match(/<i /g) || []).length + (html.match(/<i class="x"/g) || []).length, 53 * 7 + 5 + 0 + (html.match(/<i class="x"/g) || []).length, 'todas as 371 células + 5 da legenda');
  assert.ok(html.includes('>Seg<') && html.includes('>Qua<') && html.includes('>Sex<'));
  assert.ok(html.includes('Menos') && html.includes('Mais'));
  assert.ok(!html.includes('<img'), 'nome do hábito escapado');
  assert.ok(html.includes('--cols:53'));
});
