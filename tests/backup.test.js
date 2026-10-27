const test = require('node:test'), assert = require('node:assert/strict');
const { MG, setToday, freshState, addHabit } = require('./helpers');
const B = MG.backup, S = MG.schema, ST = MG.storage, A = MG.actions, G = MG.gamification;

function v2Fixture() {
  const ts = Date.UTC(2025, 2, 4, 15);
  return {
    p: { name: 'Abner', photo: '' },
    goals: [{ id: 'g0', name: 'Beber água', emoji: '💧', color: '#0A84FF', type: 'daily', target: 8, unit: 'copos', start: '2025-03-01' }],
    e: { g0: { '2025-03-01': 8, '2025-03-02': 8, '2025-03-03': 3 } },
    tasks: [{ id: 't1', t: 'Enviar', emoji: '📄', date: '2025-03-02', time: '10:00', done: true }],
    notes: [{ id: 'n1', t: '', b: 'oi', c: 0, tags: ['a'], pin: false, ts }],
    game: {
      baseXp: 40,
      awards: [{ key: 'daily-bonus:2025-03-04', amount: 5, label: 'Bônus', at: ts }, { key: 'achievement:first_habit', amount: 15, label: 'Conquista', at: ts }],
      unlocked: { first_habit: ts }, missionClaims: {},
      activeDays: { '2025-03-04': true },
      claimedKeys: { 'task:t1': true, 'note:n1': true, 'goalday:g0:2025-03-01': true, 'goalday:g0:2025-03-02': true, 'daily-bonus:2025-03-04': true, 'achievement:first_habit': true }
    }
  };
}

test('migração v2→v3 preserva o XP total exatamente e mantém rastreabilidade', () => {
  setToday('2025-03-05');
  const n = S.normalize(v2Fixture());
  assert.equal(n.ok, true); assert.equal(n.migratedFrom, 2);
  assert.equal(n.state.schemaVersion, 3);
  assert.equal(G.totalXp(n.state.game), 40 + 5 + 15);       // baseXp + prêmios
  assert.ok(n.state.game.unlocked.first_habit);
  assert.equal(n.state.game.legacyActiveDays['2025-03-04'], true);
  assert.equal(n.state.goals[0].targets[0].target, 8);
  assert.equal(n.state.tasks[0].doneAt, '2025-03-02');
  // as recompensas antigas passam a ser reversíveis individualmente
  assert.ok(G.isActive(n.state.game, 'task:t1'));
});
test('migração: dado v2 não é alterado e v2 permanece no armazenamento', () => {
  setToday('2025-03-05');
  const raw = v2Fixture(); const copy = JSON.stringify(raw);
  const ad = ST.memoryAdapter({ 'mygoals-v2': JSON.stringify(raw) });
  const r = ST.load(ad);
  assert.equal(r.status, 'migrated');
  assert.equal(JSON.stringify(raw), copy);
  assert.equal(ad.getItem('mygoals-v2'), JSON.stringify(raw)); // intacto
  assert.equal(ST.save(ad, r.state).ok, true);
  assert.equal(ST.load(ad).status, 'loaded');
  assert.equal(G.totalXp(ST.load(ad).state.game), 60);
});
test('migração de v2 sem bloco de gamificação deriva XP do histórico', () => {
  setToday('2025-03-05');
  const raw = v2Fixture(); delete raw.game;
  const n = S.normalize(raw);
  assert.equal(n.ok, true);
  assert.equal(G.totalXp(n.state.game), 10 + 10 + 15 + 5); // 2 dias + 1 tarefa + 1 nota
});
test('normalização é idempotente', () => {
  setToday('2025-03-05');
  const a = S.normalize(v2Fixture()).state;
  const b = S.normalize(JSON.parse(JSON.stringify(a))).state;
  assert.deepEqual(b.goals, a.goals); assert.deepEqual(b.game.ledger, a.game.ledger); assert.deepEqual(b.tasks, a.tasks);
});
test('backups inválidos são recusados sem tocar no estado atual', () => {
  setToday('2025-03-05');
  const ad = ST.memoryAdapter(); const s = freshState(); addHabit(s); ST.save(ad, s);
  const before = ad.getItem('mygoals-v3');
  const bad = ['', '   ', 'não é json', '[]', '"texto"', '{"goals":1}', '{"goals":[],"e":[]}', JSON.stringify({ schemaVersion: 99, goals: [], e: {} }), JSON.stringify({ schemaVersion: 1, goals: [], e: {} }), 'x'.repeat(B.MAX_BYTES + 1)];
  bad.forEach((txt) => { const a = B.analyze(txt); assert.equal(a.ok, false, txt.slice(0, 20)); assert.ok(a.errors.length); assert.equal(B.apply(ad, s, a).ok, false); });
  assert.equal(ad.getItem('mygoals-v3'), before);
});
test('backup válido: exporta, analisa, mostra resumo e restaura', () => {
  setToday('2025-03-05');
  const ad = ST.memoryAdapter(); const s = freshState(); const g = addHabit(s); A.toggleHabit(s, g.id, '2025-03-05');
  A.saveNote(s, { id: 'n1', t: 'nota', b: 'corpo', c: 2, tags: ['x'], pin: true });
  const json = B.toJson(s);
  const a = B.analyze(json);
  assert.equal(a.ok, true); assert.equal(a.summary.goals, 1); assert.equal(a.summary.notes, 1);
  const other = freshState(); ST.save(ad, other);
  const r = B.apply(ad, other, a);
  assert.equal(r.ok, true);
  assert.deepEqual(ST.load(ad).state.goals, s.goals);
  assert.equal(G.totalXp(ST.load(ad).state.game), G.totalXp(s.game));
  assert.ok(ST.hasSnapshot(ad)); // cópia de segurança do estado anterior
});
test('importar também aceita o JSON cru da versão anterior', () => {
  setToday('2025-03-05');
  const a = B.analyze(JSON.stringify(v2Fixture()));
  assert.equal(a.ok, true); assert.equal(a.migratedFrom, 2);
});
test('backup parcialmente inválido: itens ruins viram avisos, dados bons são mantidos', () => {
  setToday('2025-03-05');
  const raw = v2Fixture();
  raw.goals.push({ id: 'bad', name: '', type: 'daily', start: 'ontem' }, { id: 'g0', name: 'dup', type: 'check', start: '2025-03-01' });
  raw.e.g0['2025-99-99'] = 5; raw.e.g0['2025-03-04'] = -3;
  const a = B.analyze(JSON.stringify(raw));
  assert.equal(a.ok, true);
  assert.equal(a.state.goals.length, 1);
  assert.ok(a.warnings.length >= 2);
});
test('segurança: cor e foto maliciosas são neutralizadas', () => {
  setToday('2025-03-05');
  const raw = v2Fixture(); raw.goals[0].color = 'red;background:url(//evil)'; raw.p.photo = "x');alert(1);//";
  const a = B.analyze(JSON.stringify(raw));
  assert.equal(a.state.goals[0].color, '#0A84FF'); assert.equal(a.state.p.photo, '');
});
test('falha ao salvar (sem espaço) não perde o estado em memória e informa o erro', () => {
  const full = { getItem: () => null, setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }, removeItem() {} };
  const r = ST.save(full, freshState());
  assert.deepEqual([r.ok, r.error], [false, 'quota']);
  assert.ok(ST.ERROR_TEXT.quota);
  // importação aborta se não der para criar a cópia de segurança
  const a = B.analyze(B.toJson(freshState()));
  assert.equal(B.apply(full, freshState(), a).ok, false);
  assert.equal(ST.save(null, freshState()).error, 'unavailable');
});
test('registro principal corrompido: preserva o bruto e recupera da cópia de segurança', () => {
  setToday('2025-03-05');
  const ad = ST.memoryAdapter(); const s = freshState(); addHabit(s, { name: 'Salvo' });
  ST.snapshot(ad, s); ad.setItem('mygoals-v3', '{corrompido');
  const r = ST.load(ad);
  assert.equal(r.status, 'recovered'); assert.equal(r.state.goals[0].name, 'Salvo');
  assert.equal(ad.getItem('mygoals-v3-corrupt'), '{corrompido');
});
test('primeiro uso: estado vazio; armazenamento indisponível é sinalizado', () => {
  assert.equal(ST.load(ST.memoryAdapter()).status, 'fresh');
  assert.equal(ST.load(null).status, 'unavailable');
});
test('sem uso de dados de exemplo no estado inicial (nada de dados falsos)', () => {
  const s = ST.load(ST.memoryAdapter()).state;
  assert.equal(s.goals.length + s.tasks.length + s.notes.length, 0);
  assert.equal(G.totalXp(s.game), 0);
});
test('dados de exemplo são válidos para o esquema', () => {
  setToday('2025-03-05');
  const a = B.analyze(B.toJson(A.sampleState('2025-03-05')));
  assert.equal(a.ok, true); assert.equal(a.warnings.length, 0); assert.equal(a.summary.goals, 4);
});
