/* MyGoals — regras de hábitos e metas (sem HTML, sem acesso a armazenamento).
 *
 * Tipos:
 *  check   sim/não por dia                    (alvo 1)
 *  daily   quantidade por dia                 (completo quando valor do dia >= alvo)
 *  weekly  quantidade acumulada na semana     (completo quando soma da semana >= alvo)
 *
 * O alvo pode mudar com o tempo: g.targets guarda o histórico [{from, target}] para que mudar a
 * meta hoje não reescreva o significado dos dias passados. Em metas semanais vale o alvo da
 * data em que a semana TERMINA (assim uma edição no meio da semana vale para a semana em curso).
 */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const D = MG.dates;
  const { uid } = MG.util;

  function targetAt(goal, key) {
    if (goal.type === 'check') return 1;
    const list = goal.targets && goal.targets.length ? goal.targets : [{ from: goal.start, target: goal.target }];
    let t = list[0].target;
    for (const x of list) if (x.from <= key) t = x.target;
    return t;
  }
  const valueOn = (s, goal, key) => (s.e[goal.id] && s.e[goal.id][key]) || 0;
  const weekEndKey = (key) => D.addKey(D.weekStartKey(key), 6);
  const weekTotal = (s, goal, key) => D.weekKeys(key).reduce((a, k) => a + valueOn(s, goal, k), 0);
  const periodTarget = (goal, key) => (goal.type === 'weekly' ? targetAt(goal, weekEndKey(key)) : targetAt(goal, key));
  const periodValue = (s, goal, key) => (goal.type === 'weekly' ? weekTotal(s, goal, key) : valueOn(s, goal, key));
  const isComplete = (s, goal, key) => periodValue(s, goal, key) >= periodTarget(goal, key);
  const ratio = (s, goal, key) => Math.min(1, periodValue(s, goal, key) / periodTarget(goal, key));
  /** 0 = nada, 0.5 = parcial, 1 = completo (usado no mapa de calor). */
  function dayStatus(s, goal, key) {
    const v = valueOn(s, goal, key);
    const t = goal.type === 'weekly' ? targetAt(goal, key) / 7 : targetAt(goal, key);
    return v >= t ? 1 : v > 0 ? 0.5 : 0;
  }
  const isActiveOn = (goal, key) => goal.start <= key;
  const step = (goal) => (goal.type === 'weekly' ? Math.max(1, Math.round(goal.target / 20)) : Math.max(1, Math.round(goal.target / 8)));

  /** Lista de períodos (dias ou semanas) desde o início até hoje: true = concluído. */
  function sequence(s, goal, todayKey) {
    const out = [];
    if (goal.type === 'weekly') for (let w = D.weekStartKey(goal.start); w <= todayKey; w = D.addKey(w, 7)) out.push(isComplete(s, goal, w));
    else for (const k of D.dayKeysBetween(goal.start, todayKey)) out.push(isComplete(s, goal, k));
    return out;
  }
  /** Sequência atual, melhor sequência histórica e taxa de conclusão. O período em curso ainda pendente não quebra a sequência. */
  function stats(s, goal, todayKey) {
    const a = sequence(s, goal, todayKey);
    const closed = a.length && a[a.length - 1] ? a : a.slice(0, -1);
    let current = 0;
    for (let i = closed.length - 1; i >= 0 && closed[i]; i--) current++;
    let best = 0, run = 0;
    a.forEach((x) => { run = x ? run + 1 : 0; best = Math.max(best, run); });
    return { current, best, pct: a.length ? Math.round((100 * a.filter(Boolean).length) / a.length) : 0 };
  }

  function validate(input) {
    const name = String(input.name == null ? '' : input.name).trim();
    if (!name) return { ok: false, error: 'Dê um nome ao hábito.' };
    if (name.length > 80) return { ok: false, error: 'O nome pode ter no máximo 80 caracteres.' };
    if (!['check', 'daily', 'weekly'].includes(input.type)) return { ok: false, error: 'Escolha o tipo do hábito.' };
    const target = input.type === 'check' ? 1 : Math.round(+input.target);
    if (!Number.isFinite(target) || target < 1 || target > 1e7) return { ok: false, error: 'A meta deve ser um número a partir de 1.' };
    return { ok: true, name, target };
  }

  function create(s, input, todayKey) {
    const v = validate(input);
    if (!v.ok) return v;
    if (s.goals.length >= MG.schema.LIMITS.goals) return { ok: false, error: 'Limite de hábitos atingido.' };
    const color = /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : MG.schema.COLORS[0];
    const goal = { id: uid('g'), name: v.name, emoji: String(input.emoji || '').trim().slice(0, 8), color, type: input.type, target: v.target, unit: String(input.unit || '').trim().slice(0, 20), start: todayKey, targets: [{ from: todayKey, target: v.target }] };
    s.goals.push(goal);
    s.e[goal.id] = {};
    return { ok: true, goal };
  }

  /** O tipo não pode ser mudado (mudaria o significado do histórico). Mudar a meta vale a partir de hoje. */
  function update(s, id, patch, todayKey) {
    const goal = s.goals.find((x) => x.id === id);
    if (!goal) return { ok: false, error: 'Hábito não encontrado.' };
    const v = validate({ name: patch.name == null ? goal.name : patch.name, type: goal.type, target: patch.target == null ? goal.target : patch.target });
    if (!v.ok) return v;
    goal.name = v.name;
    if (patch.emoji != null) goal.emoji = String(patch.emoji).trim().slice(0, 8);
    if (patch.unit != null) goal.unit = String(patch.unit).trim().slice(0, 20);
    if (/^#[0-9a-fA-F]{6}$/.test(patch.color)) goal.color = patch.color;
    if (goal.type !== 'check' && v.target !== goal.target) {
      const last = goal.targets[goal.targets.length - 1];
      if (last.from === todayKey) last.target = v.target; else goal.targets.push({ from: todayKey, target: v.target });
      goal.target = v.target;
    }
    return { ok: true, goal };
  }

  /** Remove o hábito e seus registros. O XP já ganho permanece no histórico (ver gamification.js). */
  function remove(s, id) {
    const i = s.goals.findIndex((x) => x.id === id);
    if (i < 0) return false;
    s.goals.splice(i, 1);
    delete s.e[id];
    return true;
  }

  function guard(goal, key, todayKey) {
    if (!D.isKey(key)) return 'invalid';
    if (key > todayKey) return 'future';
    if (key < goal.start) return 'before_start';
    return null;
  }
  const setValue = (s, goal, key, v) => {
    s.e[goal.id] = s.e[goal.id] || {};
    const n = Math.max(0, Math.round(v));
    if (n === 0) delete s.e[goal.id][key]; else s.e[goal.id][key] = n;
  };

  /**
   * Marca/desmarca o hábito em `key`.
   * - Datas futuras ou anteriores ao início do hábito são recusadas.
   * - Meta semanal: marcar completa a semana adicionando o que falta NESTE dia; desmarcar remove
   *   apenas o registro deste dia (nunca os demais dias da semana).
   * Devolve { ok, wasComplete, isComplete, stillComplete? } ou { ok:false, reason }.
   */
  function toggle(s, goal, key, todayKey) {
    const reason = guard(goal, key, todayKey);
    if (reason) return { ok: false, reason };
    const wasComplete = isComplete(s, goal, key);
    if (goal.type === 'check') setValue(s, goal, key, valueOn(s, goal, key) ? 0 : 1);
    else if (goal.type === 'daily') setValue(s, goal, key, wasComplete ? 0 : periodTarget(goal, key));
    else if (wasComplete) setValue(s, goal, key, 0);
    else setValue(s, goal, key, valueOn(s, goal, key) + (periodTarget(goal, key) - weekTotal(s, goal, key)));
    const now = isComplete(s, goal, key);
    return { ok: true, wasComplete, isComplete: now, stillComplete: wasComplete && now };
  }
  /** Soma/subtrai um passo (+/−). */
  function adjust(s, goal, key, direction, todayKey) {
    const reason = guard(goal, key, todayKey);
    if (reason) return { ok: false, reason };
    if (goal.type === 'check') return { ok: false, reason: 'invalid' };
    const wasComplete = isComplete(s, goal, key);
    setValue(s, goal, key, valueOn(s, goal, key) + direction * step(goal));
    const now = isComplete(s, goal, key);
    return { ok: true, wasComplete, isComplete: now, stillComplete: wasComplete && now };
  }

  const REASONS = { future: 'Não é possível registrar uma data futura.', before_start: 'Este hábito ainda não existia nessa data.', invalid: 'Ação inválida.' };

  MG.habits = { targetAt, valueOn, weekTotal, periodTarget, periodValue, isComplete, ratio, dayStatus, isActiveOn, step, sequence, stats, validate, create, update, remove, toggle, adjust, setValue, REASONS };
  if (typeof module !== 'undefined') module.exports = MG.habits;
})(typeof globalThis !== 'undefined' ? globalThis : window);
