/* MyGoals — regras de tarefas. `doneAt` guarda o dia em que a tarefa foi de fato concluída
 * (usado por missões e sequências); `date` é o dia planejado. */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const { uid } = MG.util;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  function validate(input) {
    const t = String(input.t == null ? '' : input.t).trim();
    if (!t) return { ok: false, error: 'Escreva o título da tarefa.' };
    if (t.length > 200) return { ok: false, error: 'O título pode ter no máximo 200 caracteres.' };
    if (!MG.dates.isKey(input.date)) return { ok: false, error: 'Escolha uma data válida.' };
    const time = input.time ? String(input.time) : '';
    if (time && !TIME_RE.test(time)) return { ok: false, error: 'Horário inválido.' };
    return { ok: true, t, time };
  }
  function create(s, input) {
    const v = validate(input);
    if (!v.ok) return v;
    if (s.tasks.length >= MG.schema.LIMITS.tasks) return { ok: false, error: 'Limite de tarefas atingido.' };
    const task = { id: uid('t'), t: v.t, emoji: '', date: input.date, time: v.time, done: false, doneAt: null, prio: input.prio === 1 ? 1 : 0 };
    s.tasks.push(task);
    return { ok: true, task };
  }
  function update(s, id, input) {
    const task = s.tasks.find((x) => x.id === id);
    if (!task) return { ok: false, error: 'Tarefa não encontrada.' };
    const v = validate({ t: input.t == null ? task.t : input.t, date: input.date == null ? task.date : input.date, time: input.time == null ? task.time : input.time });
    if (!v.ok) return v;
    task.t = v.t; task.time = v.time;
    if (input.date != null) task.date = input.date;
    if (input.prio != null) task.prio = input.prio === 1 ? 1 : 0;
    return { ok: true, task };
  }
  /** Alterna a conclusão. Ao concluir registra o dia real da conclusão; ao desfazer limpa. */
  function toggle(s, id, todayKey) {
    const task = s.tasks.find((x) => x.id === id);
    if (!task) return { ok: false };
    task.done = !task.done;
    task.doneAt = task.done ? todayKey : null;
    return { ok: true, task, done: task.done };
  }
  function remove(s, id) {
    const i = s.tasks.findIndex((x) => x.id === id);
    if (i < 0) return null;
    return s.tasks.splice(i, 1)[0];
  }
  /** Ordem: pendentes antes de concluídas, prioridade alta primeiro, com horário por hora, sem horário por último. */
  function sortForDay(list) {
    return list.slice().sort((a, b) => (a.done - b.done) || (b.prio - a.prio) || ((a.time || '99:99') < (b.time || '99:99') ? -1 : (a.time || '99:99') > (b.time || '99:99') ? 1 : 0));
  }
  const forDay = (s, key) => sortForDay(s.tasks.filter((t) => t.date === key));

  MG.tasks = { validate, create, update, toggle, remove, sortForDay, forDay };
  if (typeof module !== 'undefined') module.exports = MG.tasks;
})(typeof globalThis !== 'undefined' ? globalThis : window);
