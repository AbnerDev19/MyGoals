const test = require('node:test'), assert = require('node:assert/strict');
const { MG, setToday } = require('./helpers');
const D = MG.dates;

test('chaves de data: formato, parse estrito e datas inexistentes', () => {
  assert.equal(D.key(new Date(2025, 0, 5)), '2025-01-05');
  assert.ok(D.isKey('2024-02-29'));            // bissexto
  assert.equal(D.isKey('2025-02-29'), false);   // não bissexto
  assert.equal(D.isKey('2025-13-01'), false);
  assert.equal(D.isKey('2025-1-1'), false);
  assert.equal(D.isKey(null), false);
});
test('a semana começa no domingo e é a mesma regra em todo o app', () => {
  assert.equal(D.weekStartKey('2025-03-05'), '2025-03-02'); // quarta -> domingo
  assert.equal(D.weekStartKey('2025-03-02'), '2025-03-02'); // domingo
  assert.equal(D.weekStartKey('2025-03-08'), '2025-03-02'); // sábado
  assert.deepEqual(D.weekKeys('2025-03-05'), ['2025-03-02', '2025-03-03', '2025-03-04', '2025-03-05', '2025-03-06', '2025-03-07', '2025-03-08']);
});
test('virada de mês e de ano', () => {
  assert.equal(D.addKey('2025-01-31', 1), '2025-02-01');
  assert.equal(D.addKey('2024-12-31', 1), '2025-01-01');
  assert.equal(D.addKey('2025-01-01', -1), '2024-12-31');
  assert.equal(D.weekStartKey('2025-01-01'), '2024-12-29'); // a semana atravessa o ano
  assert.equal(D.diffKeys('2024-12-31', '2025-01-02'), 2);
});
test('diferença em dias não sofre com horário de verão', () => {
  assert.equal(D.diffKeys('2025-03-08', '2025-03-10'), 2);
  assert.equal(D.diffKeys('2025-10-31', '2025-11-03'), 3);
  assert.equal(D.diffKeys('2025-01-01', '2026-01-01'), 365);
});
test('hoje é recalculado a cada chamada (virada do dia com o app aberto)', () => {
  setToday('2025-03-05', 23, 59);
  assert.equal(D.todayKey(), '2025-03-05');
  setToday('2025-03-06', 0, 1);
  assert.equal(D.todayKey(), '2025-03-06');
});
