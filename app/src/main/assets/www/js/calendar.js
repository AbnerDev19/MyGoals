/* MyGoals — agenda e resumo do dia (somente cálculo; a interface está em views.js). */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const D = MG.dates, H = MG.habits, T = MG.tasks;

  /** Estado visual de um item em `key`: done | overdue | future | pending. Nunca depende só de cor na UI. */
  function itemState(done, key, todayKey) {
    if (done) return 'done';
    if (key > todayKey) return 'future';
    if (key < todayKey) return 'overdue';
    return 'pending';
  }

  /** Todos os itens do dia: hábitos diários, metas semanais e tarefas. */
  function dayItems(s, key, todayKey) {
    const items = [];
    s.goals.filter((gl) => H.isActiveOn(gl, key)).forEach((gl) => {
      const done = H.isComplete(s, gl, key);
      items.push({ kind: 'habit', id: gl.id, goal: gl, weekly: gl.type === 'weekly', title: gl.name, time: '', done, state: itemState(done, key, todayKey), ratio: H.ratio(s, gl, key) });
    });
    T.forDay(s, key).forEach((t) => items.push({ kind: 'task', id: t.id, task: t, title: t.t, time: t.time, done: t.done, prio: t.prio, state: itemState(t.done, key, todayKey) }));
    return items;
  }

  /** Resumo do dia para a tela Hoje. Metas semanais ficam à parte do progresso diário. */
  function summary(s, key, todayKey) {
    const items = dayItems(s, key, todayKey);
    const daily = items.filter((i) => !i.weekly);
    const done = daily.filter((i) => i.done).length;
    return {
      items, total: daily.length, done, pct: daily.length ? Math.round((done / daily.length) * 100) : 0,
      allDone: daily.length > 0 && done === daily.length,
      pendingTasks: items.filter((i) => i.kind === 'task' && !i.done),
      pendingHabits: items.filter((i) => i.kind === 'habit' && !i.weekly && !i.done),
      weekly: items.filter((i) => i.weekly),
      doneItems: daily.filter((i) => i.done)
    };
  }

  /** Próxima ação recomendada: tarefa com horário mais próximo > tarefa prioritária > tarefa sem horário > hábito pendente. */
  function nextAction(s, todayKey, hhmm) {
    const sum = summary(s, todayKey, todayKey);
    const tasks = sum.pendingTasks;
    const upcoming = tasks.filter((t) => t.time && t.time >= hhmm).sort((a, b) => D.cmp(a.time, b.time))[0];
    if (upcoming) return { ...upcoming, reason: 'upcoming' };
    const prio = tasks.find((t) => t.prio === 1);
    if (prio) return { ...prio, reason: 'priority' };
    const late = tasks.filter((t) => t.time && t.time < hhmm).sort((a, b) => D.cmp(a.time, b.time))[0];
    if (late) return { ...late, reason: 'late' };
    if (tasks[0]) return { ...tasks[0], reason: 'task' };
    const habit = sum.pendingHabits.slice().sort((a, b) => a.ratio - b.ratio).reverse()[0];
    if (habit) return { ...habit, reason: 'habit' };
    return null;
  }

  /** Itens da Agenda em um dia: tarefas com horário ordenadas, sem horário, e hábitos. */
  function agendaDay(s, key, todayKey) {
    const items = dayItems(s, key, todayKey);
    const timed = items.filter((i) => i.kind === 'task' && i.time).sort((a, b) => D.cmp(a.time, b.time));
    const untimed = items.filter((i) => i.kind === 'task' && !i.time);
    const habits = items.filter((i) => i.kind === 'habit');
    return { timed, untimed, habits, count: items.length };
  }

  const weekDays = (weekStartKey) => D.weekKeys(weekStartKey);

  MG.calendar = { itemState, dayItems, summary, nextAction, agendaDay, weekDays };
  if (typeof module !== 'undefined') module.exports = MG.calendar;
})(typeof globalThis !== 'undefined' ? globalThis : window);
