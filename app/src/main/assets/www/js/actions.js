/* MyGoals — ações do usuário. Cada função altera o estado, aplica as regras de XP e devolve
 * { ok, delta, messages, ... } para a interface. Não gera HTML e não grava em disco.
 * É aqui que habits/tasks/gamification se encontram, o que torna o fluxo testável sem DOM. */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const D = MG.dates, H = MG.habits, T = MG.tasks, G = MG.gamification, { uid } = MG.util;

  /** Executa `fn`, depois sincroniza conquistas e calcula a variação de XP para o aviso. */
  function withXp(s, fn) {
    const x0 = G.totalXp(s.game), l0 = G.levelOf(x0), today = D.todayKey();
    const out = fn(today) || {};
    if (out.ok === false) return out;
    const fresh = G.syncAchievements(s, today);
    const x1 = G.totalXp(s.game), l1 = G.levelOf(x1);
    return { ok: true, ...out, delta: x1 - x0, levelUp: l1 > l0 ? l1 : 0, achievements: fresh, capped: !!out.capped };
  }

  const toggleHabit = (s, id, key) => withXp(s, (today) => {
    const goal = s.goals.find((x) => x.id === id);
    if (!goal) return { ok: false, error: 'Hábito não encontrado.' };
    const res = H.toggle(s, goal, key, today);
    if (!res.ok) return { ok: false, error: H.REASONS[res.reason] };
    const r = G.onHabitChange(s, goal, key, res, today);
    return { stillComplete: res.stillComplete, capped: r.capped, goal };
  });
  const adjustHabit = (s, id, key, dir) => withXp(s, (today) => {
    const goal = s.goals.find((x) => x.id === id);
    if (!goal) return { ok: false, error: 'Hábito não encontrado.' };
    const res = H.adjust(s, goal, key, dir, today);
    if (!res.ok) return { ok: false, error: H.REASONS[res.reason] };
    const r = G.onHabitChange(s, goal, key, res, today);
    return { capped: r.capped, goal };
  });
  const createHabit = (s, input) => withXp(s, (today) => H.create(s, input, today));
  const updateHabit = (s, id, patch) => withXp(s, (today) => H.update(s, id, patch, today));
  /** Excluir hábito: remove registros; XP já ganho permanece (histórico preservado). */
  const deleteHabit = (s, id) => withXp(s, () => ({ ok: H.remove(s, id) }));

  const createTask = (s, input) => withXp(s, () => T.create(s, input));
  const updateTask = (s, id, input) => withXp(s, () => T.update(s, id, input));
  const toggleTask = (s, id) => withXp(s, (today) => {
    const res = T.toggle(s, id, today);
    if (!res.ok) return { ok: false };
    const r = G.onTaskToggle(s, res.task, today);
    return { done: res.done, capped: r.capped };
  });
  const deleteTask = (s, id) => withXp(s, () => {
    const task = T.remove(s, id);
    if (!task) return { ok: false };
    if (task.done) G.onTaskDelete(s, task);
    return {};
  });

  /** Salva (cria ou edita) uma nota. Notas vazias não são gravadas. XP apenas na criação. */
  const saveNote = (s, note) => withXp(s, (today) => {
    if (!String(note.t || '').trim() && !String(note.b || '').trim()) return { ok: false, empty: true };
    const clean = { id: note.id, t: String(note.t || '').slice(0, 200), b: String(note.b || '').slice(0, MG.schema.LIMITS.noteBody), c: Math.max(0, Math.min(7, +note.c || 0)), tags: [...new Set((note.tags || []).map((x) => String(x).trim().slice(0, 30)).filter(Boolean))].slice(0, 20), pin: !!note.pin, ts: D.now().getTime() };
    const i = s.notes.findIndex((x) => x.id === clean.id);
    if (i >= 0) { s.notes[i] = clean; return {}; }
    s.notes.push(clean);
    const r = G.onNoteCreate(s, clean, today);
    return { created: true, capped: r.capped };
  });
  const deleteNote = (s, id) => withXp(s, () => {
    const i = s.notes.findIndex((x) => x.id === id);
    if (i < 0) return { ok: false };
    const [note] = s.notes.splice(i, 1);
    G.onNoteDelete(s, note);
    return {};
  });
  const newNote = () => ({ id: uid('n'), t: '', b: '', c: 0, tags: [], pin: false, ts: D.now().getTime() });

  const claimMission = (s, id) => withXp(s, (today) => {
    const r = G.claimMission(s, id, today);
    return r.ok ? { mission: r.mission } : { ok: false, error: 'Missão indisponível.' };
  });

  /** Perfil e preferências. */
  const setName = (s, name) => { s.p.name = String(name).slice(0, 40); return { ok: true }; };
  const setTheme = (s, theme) => { if (['auto', 'light', 'dark'].includes(theme)) s.prefs.theme = theme; return { ok: true }; };

  /** Texto curto para o aviso após uma ação. */
  function describe(r) {
    if (!r || r.ok === false) return r && r.error ? r.error : '';
    const parts = [];
    if (r.delta) parts.push((r.delta > 0 ? '+' : '') + r.delta + ' XP');
    if (r.levelUp) parts.push('Nível ' + r.levelUp);
    if (r.achievements && r.achievements.length) parts.push(r.achievements.length === 1 ? 'Conquista: ' + r.achievements[0].title : r.achievements.length + ' conquistas novas');
    if (r.capped) parts.push('limite diário de XP atingido');
    if (r.stillComplete) parts.push('a meta semanal continua concluída pelos outros dias');
    return parts.join(' · ');
  }

  /** Dados de exemplo (determinísticos). Só usados quando o usuário pede e confirma. */
  function sampleState(todayKey) {
    const S = MG.schema, s = S.emptyState();
    let a = 7;
    const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    s.p.name = 'Você';
    const C = S.COLORS;
    const defs = [['Beber água', '💧', C[0], 'daily', 8, 'copos', 0.8], ['Acordar cedo', '☀️', C[1], 'check', 1, '', 0.7], ['Ler', '📚', C[2], 'weekly', 200, 'páginas', 0.88], ['Caminhar', '👟', C[3], 'daily', 10000, 'passos', 0.75]];
    defs.forEach((d, i) => {
      const start = D.addKey(todayKey, -60 + i * 9), id = 'sample-g' + i;
      s.goals.push({ id, name: d[0], emoji: d[1], color: d[2], type: d[3], target: d[4], unit: d[5], start, targets: [{ from: start, target: d[4] }] });
      s.e[id] = {};
      D.dayKeysBetween(start, D.addKey(todayKey, -1)).forEach((k) => { if (rnd() < d[6]) s.e[id][k] = d[3] === 'check' ? 1 : d[3] === 'weekly' ? Math.round(20 + rnd() * 30) : Math.round(d[4] * (0.5 + rnd() * 0.5)); });
    });
    s.tasks.push({ id: 'sample-t1', t: 'Enviar relatório', emoji: '', date: todayKey, time: '10:00', done: false, doneAt: null, prio: 1 }, { id: 'sample-t2', t: 'Ligar para o cliente', emoji: '', date: todayKey, time: '', done: true, doneAt: todayKey, prio: 0 });
    s.notes.push({ id: 'sample-n1', t: 'Ideias do app', b: 'Gamificar com XP e níveis.', c: 3, tags: ['projetos'], pin: true, ts: D.now().getTime() });
    s.game.ledger.push({ id: 'sample-open', key: 'opening', kind: 'opening', src: 'legacy', amount: 120, label: 'Saldo inicial dos dados de exemplo', date: null, at: D.now().getTime() });
    return s;
  }

  MG.actions = { toggleHabit, adjustHabit, createHabit, updateHabit, deleteHabit, createTask, updateTask, toggleTask, deleteTask, saveNote, deleteNote, newNote, claimMission, setName, setTheme, describe, sampleState };
  if (typeof module !== 'undefined') module.exports = MG.actions;
})(typeof globalThis !== 'undefined' ? globalThis : window);
