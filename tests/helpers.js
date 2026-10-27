// Carrega os módulos do app (scripts clássicos) no Node, na mesma ordem do index.html.
const path = require('path');
const www = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www', 'js');
['util', 'dates', 'schema', 'storage', 'habits', 'tasks', 'gamification', 'calendar', 'backup', 'actions'].forEach((m) => require(path.join(www, m + '.js')));
const MG = globalThis.MG;

/** Fixa "agora" (data local) para testes determinísticos. */
function setToday(key, hh = 12, mm = 0) {
  const [y, m, d] = key.split('-').map(Number);
  MG.dates.setClock(() => new Date(y, m - 1, d, hh, mm, 0));
}
function freshState() { return MG.schema.emptyState(); }
function addHabit(s, over) {
  const r = MG.habits.create(s, Object.assign({ name: 'Ler', type: 'check', target: 1 }, over), MG.dates.todayKey());
  if (!r.ok) throw new Error(r.error);
  return r.goal;
}
module.exports = { MG, setToday, freshState, addHabit };
