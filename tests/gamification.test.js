const test = require('node:test'), assert = require('node:assert/strict');
const { MG, setToday, freshState, addHabit } = require('./helpers');
const H = MG.habits, A = MG.actions, G = MG.gamification, D = MG.dates;
const backdate = (goal, k) => { goal.start = k; goal.targets[0].from = k; };

test('XP e níveis: limites exatos da fórmula (50 × (nível−1)²)', () => {
  const cases = [[0, 1], [49, 1], [50, 2], [199, 2], [200, 3], [449, 3], [450, 4], [800, 5], [4050, 10]];
  cases.forEach(([xp, lvl]) => assert.equal(G.levelOf(xp), lvl, xp + ' XP'));
  const i = G.levelInfo(125);
  assert.deepEqual([i.level, i.floor, i.next, i.remaining, i.pct], [2, 50, 200, 75, 50]);
  assert.equal(G.levelInfo(-5).level, 1);
});
test('tarefa: concluir rende 15 + bônus do dia; desfazer estorna só os 15 com rastro no histórico', () => {
  setToday('2025-03-05'); const s = freshState();
  const t = A.createTask(s, { t: 'Relatório', date: '2025-03-05' }).task;
  const r = A.toggleTask(s, t.id);
  assert.equal(s.game.ledger.find((e) => e.key === 'task:' + t.id).amount, 15);
  assert.ok(s.game.ledger.some((e) => e.key === 'daily-bonus:2025-03-05'));
  const before = G.totalXp(s.game);
  A.toggleTask(s, t.id); // desfaz
  const rev = s.game.ledger.find((e) => e.kind === 'reversal');
  assert.equal(rev.amount, -15); assert.ok(rev.ref);
  assert.equal(s.game.ledger.find((e) => e.id === rev.ref).amount, 15); // original preservado
  assert.equal(G.totalXp(s.game), before - 15);
  A.toggleTask(s, t.id); // refaz: recompensa nova, líquido = 15
  assert.equal(G.activeAwards(s.game).filter((e) => e.key === 'task:' + t.id).length, 1);
  assert.equal(G.totalXp(s.game), before);
});
test('excluir tarefa concluída estorna o XP (não dá para farmar criando e apagando)', () => {
  setToday('2025-03-05'); const s = freshState();
  const t = A.createTask(s, { t: 'x', date: '2025-03-05' }).task; A.toggleTask(s, t.id);
  const withTask = G.totalXp(s.game);
  A.deleteTask(s, t.id);
  assert.equal(G.totalXp(s.game), withTask - 15);
  assert.equal(s.tasks.length, 0);
});
test('limite diário de recompensas de tarefas e de notas', () => {
  setToday('2025-03-05'); const s = freshState();
  for (let i = 0; i < 14; i++) { const t = A.createTask(s, { t: 't' + i, date: '2025-03-05' }).task; A.toggleTask(s, t.id); }
  assert.equal(G.activeAwards(s.game).filter((e) => e.src === 'task').length, G.RULES.caps.task);
  for (let i = 0; i < 6; i++) A.saveNote(s, { id: 'n' + i, t: 'nota ' + i, b: '', c: 0, tags: [], pin: false });
  assert.equal(G.activeAwards(s.game).filter((e) => e.src === 'note').length, G.RULES.caps.note);
});
test('criar e apagar notas em loop não gera XP líquido', () => {
  setToday('2025-03-05'); const s = freshState();
  A.saveNote(s, { id: 'a', t: 'x', b: '', c: 0, tags: [], pin: false }); A.deleteNote(s, 'a');
  const base = G.totalXp(s.game);
  for (let i = 0; i < 20; i++) { A.saveNote(s, { id: 'n' + i, t: 'x', b: '', c: 0, tags: [], pin: false }); A.deleteNote(s, 'n' + i); }
  assert.equal(G.totalXp(s.game), base);
  assert.equal(A.saveNote(s, { id: 'v', t: ' ', b: '', c: 0, tags: [], pin: false }).ok, false); // nota vazia
});
test('editar uma nota existente não dá XP de novo', () => {
  setToday('2025-03-05'); const s = freshState();
  A.saveNote(s, { id: 'n1', t: 'a', b: '', c: 0, tags: [], pin: false }); const x = G.totalXp(s.game);
  for (let i = 0; i < 5; i++) A.saveNote(s, { id: 'n1', t: 'a' + i, b: 'texto', c: 0, tags: [], pin: false });
  assert.equal(G.totalXp(s.game), x);
});
test('award é idempotente por chave e ignora cliques repetidos', () => {
  const game = MG.schema.emptyGame();
  const a = G.award(game, { key: 'k1', src: 'task', amount: 15, label: 'x', date: '2025-03-05' });
  const b = G.award(game, { key: 'k1', src: 'task', amount: 15, label: 'x', date: '2025-03-05' });
  assert.ok(a.entry); assert.equal(b.duplicate, true);
  assert.equal(game.ledger.length, 1);
  assert.equal(new Set(game.ledger.map((e) => e.id)).size, game.ledger.length);
});
test('conquistas: desbloquear duas vezes não duplica XP', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s); A.toggleHabit(s, g.id, '2025-03-05');
  const x = G.totalXp(s.game);
  assert.equal(G.syncAchievements(s, '2025-03-05').length, 0);
  assert.equal(G.totalXp(s.game), x);
  assert.ok(s.game.unlocked.first_habit);
  assert.equal(s.game.ledger.filter((e) => e.key === 'achievement:first_habit').length, 1);
});
test('conquistas desbloqueadas permanecem mesmo se o hábito for desfeito', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s);
  A.toggleHabit(s, g.id, '2025-03-05'); A.toggleHabit(s, g.id, '2025-03-05');
  assert.ok(s.game.unlocked.first_habit);
  assert.equal(G.achievements(s, '2025-03-05').find((a) => a.id === 'first_habit').unlocked, true);
});
test('missões: resgate só com progresso completo e uma única vez', () => {
  setToday('2025-03-05'); const s = freshState();
  const id = 'd_task_2025-03-05';
  assert.equal(A.claimMission(s, id).ok, false); // sem progresso
  const t = A.createTask(s, { t: 'x', date: '2025-03-05' }).task; A.toggleTask(s, t.id);
  const r = A.claimMission(s, id);
  assert.equal(r.ok, true);
  const xp = G.totalXp(s.game);
  assert.equal(A.claimMission(s, id).ok, false);
  assert.equal(A.claimMission(s, id).ok, false);
  assert.equal(G.totalXp(s.game), xp);
  assert.equal(G.missions(s, '2025-03-05').find((m) => m.id === id).state, 'claimed');
});
test('missões renovam por período: novo dia, nova semana; anteriores não resgatadas expiram', () => {
  setToday('2025-03-05'); const s = freshState();
  const t = A.createTask(s, { t: 'x', date: '2025-03-05' }).task; A.toggleTask(s, t.id); // missão pronta, não resgatada
  assert.equal(G.missions(s, '2025-03-05').find((m) => m.id === 'd_task_2025-03-05').state, 'ready');
  setToday('2025-03-06');
  const ms = G.missions(s, '2025-03-06');
  assert.equal(ms.find((m) => m.id === 'd_task_2025-03-06').state, 'available'); // renovada
  assert.equal(ms.find((m) => m.id === 'd_task_2025-03-05').state, 'expired');   // ontem expirou
  assert.equal(A.claimMission(s, 'd_task_2025-03-05').ok, false);                // não pode mais
  // semana: 2025-03-09 é domingo -> nova semana
  const wk = G.missions(s, '2025-03-09').filter((m) => m.type === 'weekly' && m.period === 'current');
  assert.ok(wk.every((m) => m.id.endsWith('2025-03-09') && m.state === 'available'));
  assert.ok(G.missions(s, '2025-03-09').some((m) => m.period === 'previous' && m.id.endsWith('2025-03-02')));
});
test('sequência: dias consecutivos, ontem ainda conta, falha zera, melhor histórico permanece', () => {
  const days = new Set(['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-04']);
  assert.equal(G.currentStreak(days, '2025-03-04'), 4);
  assert.equal(G.currentStreak(days, '2025-03-05'), 4); // hoje sem atividade ainda: ontem conta
  assert.equal(G.currentStreak(days, '2025-03-06'), 0); // dois dias sem atividade
  assert.equal(G.longestStreak(days), 4);
  assert.equal(G.currentStreak(new Set(['2024-12-30', '2024-12-31', '2025-01-01']), '2025-01-01'), 3); // vira o ano
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s); backdate(g, '2025-02-01');
  ['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-04', '2025-03-05'].forEach((k) => A.toggleHabit(s, g.id, k));
  assert.equal(G.refreshBest(s, '2025-03-05'), 5);
  setToday('2025-03-20');
  assert.equal(G.currentStreak(G.activityDays(s), '2025-03-20'), 0);
  assert.equal(G.refreshBest(s, '2025-03-20'), 5); // nunca diminui
});
test('sequência de hábito (habits.stats): pendente de hoje não quebra; semanal conta semanas', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s); backdate(g, '2025-03-01');
  H.setValue(s, g, '2025-03-01', 1); H.setValue(s, g, '2025-03-02', 1); H.setValue(s, g, '2025-03-03', 1); H.setValue(s, g, '2025-03-04', 1);
  assert.deepEqual(H.stats(s, g, '2025-03-05'), { current: 4, best: 4, pct: 80 });
  H.setValue(s, g, '2025-03-05', 1);
  assert.equal(H.stats(s, g, '2025-03-05').current, 5);
  const w = addHabit(s, { name: 'sem', type: 'weekly', target: 10 }); backdate(w, '2025-02-16');
  H.setValue(s, w, '2025-02-17', 10); H.setValue(s, w, '2025-02-24', 10); H.setValue(s, w, '2025-03-03', 10);
  assert.equal(H.stats(s, w, '2025-03-05').current, 3);
});
test('retomada após dias parados: bônus "bem-vindo de volta" uma vez', () => {
  setToday('2025-03-01'); const s = freshState(); const g = addHabit(s); backdate(g, '2025-02-01');
  A.toggleHabit(s, g.id, '2025-03-01');
  setToday('2025-03-10');
  A.toggleHabit(s, g.id, '2025-03-10');
  assert.equal(s.game.ledger.filter((e) => e.key === 'comeback:2025-03-10').length, 1);
  const t = A.createTask(s, { t: 'x', date: '2025-03-10' }).task; A.toggleTask(s, t.id);
  assert.equal(s.game.ledger.filter((e) => e.key === 'comeback:2025-03-10').length, 1);
});
test('histórico de XP: ordenado e auditável (soma do histórico = total)', () => {
  setToday('2025-03-05'); const s = freshState(); const g = addHabit(s);
  A.toggleHabit(s, g.id, '2025-03-05'); A.toggleHabit(s, g.id, '2025-03-05');
  const sum = G.history(s.game, 1000).reduce((a, e) => a + e.amount, 0);
  assert.equal(Math.max(0, sum), G.totalXp(s.game));
  assert.ok(G.history(s.game, 3).length <= 3);
});
