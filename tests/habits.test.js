const test = require('node:test'), assert = require('node:assert/strict');
const { MG, setToday, freshState, addHabit } = require('./helpers');
const H = MG.habits, A = MG.actions, G = MG.gamification;
const backdate = (goal, k) => { goal.start = k; goal.targets[0].from = k; };

test('hábito sim/não: concluir, desfazer e XP líquido', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s);
  const r1 = A.toggleHabit(s, g.id, '2025-03-05');
  assert.equal(r1.ok, true);
  assert.equal(G.totalXp(s.game) >= 15, true); // 10 do hábito + 5 do bônus diário (+ conquistas)
  const xpDone = G.totalXp(s.game);
  const r2 = A.toggleHabit(s, g.id, '2025-03-05');
  assert.equal(H.isComplete(s, g, '2025-03-05'), false);
  assert.equal(r2.delta, -10);
  assert.equal(G.totalXp(s.game), xpDone - 10);
});
test('marcar/desmarcar/marcar repetidamente NÃO acumula XP', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s);
  A.toggleHabit(s, g.id, '2025-03-05'); const base = G.totalXp(s.game);
  for (let i = 0; i < 10; i++) { A.toggleHabit(s, g.id, '2025-03-05'); A.toggleHabit(s, g.id, '2025-03-05'); }
  assert.equal(G.totalXp(s.game), base);
});
test('hábito por quantidade: completa ao atingir o alvo e estorna ao cair abaixo', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s, { type: 'daily', target: 8, unit: 'copos' });
  for (let i = 0; i < 7; i++) A.adjustHabit(s, g.id, '2025-03-05', 1);
  assert.equal(H.isComplete(s, g, '2025-03-05'), false); // passo = 1: 7 de 8
  A.adjustHabit(s, g.id, '2025-03-05', 1);
  assert.equal(H.isComplete(s, g, '2025-03-05'), true);
  A.adjustHabit(s, g.id, '2025-03-05', -1);
  assert.equal(H.isComplete(s, g, '2025-03-05'), false);
});
test('REGRESSÃO: desmarcar meta semanal remove só o registro do dia, não a semana inteira', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s, { type: 'weekly', target: 100, unit: 'páginas' });
  backdate(g, '2025-02-01');
  H.setValue(s, g, '2025-03-02', 30); H.setValue(s, g, '2025-03-03', 30); H.setValue(s, g, '2025-03-04', 20);
  const r = A.toggleHabit(s, g.id, '2025-03-05'); // completa: adiciona 20 neste dia
  assert.equal(H.valueOn(s, g, '2025-03-05'), 20);
  assert.equal(H.isComplete(s, g, '2025-03-05'), true);
  A.toggleHabit(s, g.id, '2025-03-05'); // desmarca
  assert.equal(H.valueOn(s, g, '2025-03-02'), 30);
  assert.equal(H.valueOn(s, g, '2025-03-03'), 30);
  assert.equal(H.valueOn(s, g, '2025-03-04'), 20);
  assert.equal(H.valueOn(s, g, '2025-03-05'), 0);
  assert.equal(H.weekTotal(s, g, '2025-03-05'), 80);
});
test('meta semanal concluída por vários dias rende 50 XP uma única vez', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s, { type: 'weekly', target: 10, unit: 'x' });
  backdate(g, '2025-02-01');
  A.adjustHabit(s, g.id, '2025-03-05', 1); // passo = max(1, round(10/20)) = 1
  for (let i = 0; i < 9; i++) A.adjustHabit(s, g.id, '2025-03-05', 1);
  const awards = G.activeAwards(s.game).filter((e) => e.key === G.habitKey(g, '2025-03-05'));
  assert.equal(awards.length, 1);
  assert.equal(awards[0].amount, 50);
  A.adjustHabit(s, g.id, '2025-03-05', 1); // acima do alvo: sem novo prêmio
  assert.equal(G.activeAwards(s.game).filter((e) => e.key === G.habitKey(g, '2025-03-05')).length, 1);
});
test('registro retroativo rende metade do XP e não gera bônus diário; futuro é recusado', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s); backdate(g, '2025-02-01');
  const r = A.toggleHabit(s, g.id, '2025-03-03');
  const e = s.game.ledger.find((x) => x.key === 'goalday:' + g.id + ':2025-03-03');
  assert.equal(e.amount, 5); assert.equal(e.retro, true); assert.equal(e.date, '2025-03-03');
  assert.equal(s.game.ledger.some((x) => x.key === 'daily-bonus:2025-03-05'), false);
  const f = A.toggleHabit(s, g.id, '2025-03-06');
  assert.equal(f.ok, false);
  assert.equal(H.valueOn(s, g, '2025-03-06'), 0);
  assert.equal(A.toggleHabit(s, g.id, '2025-01-01').ok, false); // antes do início
});
test('editar a meta preserva o significado dos dias passados', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s, { type: 'daily', target: 8, unit: 'copos' });
  backdate(g, '2025-03-01'); H.setValue(s, g, '2025-03-02', 8);
  assert.equal(H.isComplete(s, g, '2025-03-02'), true);
  A.updateHabit(s, g.id, { target: 12 });
  assert.equal(H.targetAt(g, '2025-03-02'), 8);   // passado intacto
  assert.equal(H.isComplete(s, g, '2025-03-02'), true);
  assert.equal(H.targetAt(g, '2025-03-05'), 12);  // novo alvo vale a partir de hoje
  assert.equal(g.target, 12);
});
test('validações de criação de hábito', () => {
  const s = freshState();
  assert.equal(H.create(s, { name: '  ', type: 'check' }, '2025-03-05').ok, false);
  assert.equal(H.create(s, { name: 'x', type: 'daily', target: 0 }, '2025-03-05').ok, false);
  assert.equal(H.create(s, { name: 'x', type: 'banana', target: 1 }, '2025-03-05').ok, false);
  assert.equal(s.goals.length, 0);
});
test('limite diário de XP de hábitos', () => {
  setToday('2025-03-05'); const s = freshState();
  for (let i = 0; i < 18; i++) { const g = addHabit(s, { name: 'h' + i }); A.toggleHabit(s, g.id, '2025-03-05'); }
  const habitAwards = G.activeAwards(s.game).filter((e) => e.src === 'habit' && e.date === '2025-03-05');
  assert.equal(habitAwards.length, G.RULES.caps.habit);
});
