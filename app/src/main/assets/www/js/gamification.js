/* MyGoals — gamificação. ÚNICA fonte de verdade de XP, níveis, sequências, missões e conquistas.
 *
 * Princípios (ver docs/GAMIFICACAO.md):
 *  1. XP = soma do livro-razão (game.ledger). Nada é recalculado "por fora".
 *  2. Cada recompensa tem uma CHAVE estável (ex.: 'task:t1', 'goalday:g1:2025-03-02').
 *     Uma chave só rende XP uma vez enquanto estiver "ativa" => cliques repetidos não duplicam.
 *  3. Desfazer uma ação NÃO apaga o lançamento original: grava um lançamento de estorno
 *     (kind:'reversal', ref = id do original) e a chave volta a ficar livre. Refazer gera nova recompensa.
 *     Resultado líquido: marcar/desmarcar/marcar rende o XP uma única vez.
 *  4. Não são estornados: bônus diários, missões resgatadas e conquistas já desbloqueadas
 *     (são marcos históricos; cada um só ocorre uma vez por período/ID).
 *  5. Atividade retroativa (data anterior a hoje) rende metade do XP (mín. 1) e não gera bônus diário.
 *  6. Limites diários anti-abuso: hábitos 15, tarefas 10, notas 3 recompensas por dia.
 *  7. Retomada: o primeiro registro após 3+ dias sem atividade rende +10 XP ("bem-vindo de volta").
 *     A melhor sequência histórica nunca diminui.
 */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const D = MG.dates, H = MG.habits;
  const { uid } = MG.util;

  const RULES = {
    habitDay: 10, habitWeek: 50, task: 15, note: 5, dailyBonus: 5, comeback: 10,
    caps: { habit: 15, task: 10, note: 3 },
    retroFactor: 0.5,
    comebackGapDays: 3
  };
  const TITLES = ['Iniciante', 'Aprendiz', 'Constante', 'Disciplinado', 'Veterano', 'Mestre', 'Lenda'];

  /* ---------- níveis ---------- */
  const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
  const xpForLevel = (l) => 50 * (l - 1) * (l - 1);
  const titleOf = (l) => TITLES[Math.min(TITLES.length - 1, Math.floor((l - 1) / 2))];
  function levelInfo(xp) {
    const level = levelOf(xp), floor = xpForLevel(level), next = xpForLevel(level + 1);
    return { level, floor, next, remaining: Math.max(0, next - xp), pct: Math.max(0, Math.min(100, Math.round(((xp - floor) / (next - floor)) * 100))), title: titleOf(level) };
  }

  /* ---------- livro-razão ---------- */
  const totalXp = (game) => Math.max(0, game.ledger.reduce((a, e) => a + e.amount, 0));

  /** Awards atualmente ativos (descontados os estornados), por chave. */
  function activeAwards(game) {
    const by = new Map();
    for (const e of game.ledger) {
      if (e.kind === 'opening') continue;
      const slot = by.get(e.key) || { awards: [], rev: 0 };
      if (e.kind === 'award') slot.awards.push(e); else slot.rev++;
      by.set(e.key, slot);
    }
    const out = [];
    by.forEach((slot) => { out.push(...slot.awards.slice(slot.rev)); });
    return out;
  }
  const isActive = (game, key) => activeAwards(game).some((e) => e.key === key);
  const countActive = (game, src, date) => activeAwards(game).filter((e) => e.src === src && e.date === date).length;

  /**
   * Concede uma recompensa de forma idempotente.
   * Devolve { entry } | { duplicate:true } | { capped:true }.
   */
  function award(game, o) {
    if (isActive(game, o.key)) return { duplicate: true };
    const cap = RULES.caps[o.src];
    if (cap && o.date && countActive(game, o.src, o.date) >= cap) return { capped: true };
    const entry = { id: uid('x'), key: o.key, kind: 'award', src: o.src, amount: Math.round(o.amount), label: o.label, date: o.date || null, at: o.at || D.now().getTime() };
    if (o.retro) entry.retro = true;
    game.ledger.push(entry);
    return { entry };
  }
  /** Estorna a recompensa ativa de `key` (se houver) com um lançamento negativo rastreável. */
  function reverse(game, key, label) {
    const active = activeAwards(game).filter((e) => e.key === key);
    if (!active.length) return null;
    const orig = active[active.length - 1];
    const entry = { id: uid('x'), key, kind: 'reversal', src: orig.src, amount: -orig.amount, label: label || 'Desfeito: ' + orig.label, date: orig.date, at: D.now().getTime(), ref: orig.id };
    game.ledger.push(entry);
    return entry;
  }
  /** Lançamentos mais recentes primeiro, para a tela de histórico de XP. */
  const history = (game, limit) => game.ledger.slice().sort((a, b) => b.at - a.at || 0).slice(0, limit || 50);

  /* ---------- atividade e sequências ---------- */
  /** Dias com qualquer atividade real: registro de hábito, tarefa concluída ou nota. Derivado dos dados. */
  function activityDays(s) {
    const days = new Set(Object.keys(s.game.legacyActiveDays));
    s.goals.forEach((gl) => { const m = s.e[gl.id] || {}; Object.keys(m).forEach((k) => { if (m[k] > 0) days.add(k); }); });
    s.tasks.forEach((t) => { if (t.done) days.add(t.doneAt || t.date); });
    s.notes.forEach((n) => { const k = D.dateFromTs(n.ts); if (k) days.add(k); });
    return days;
  }
  /** Sequência atual: dias consecutivos terminando hoje (ou ontem, se hoje ainda não teve atividade). */
  function currentStreak(days, todayKey) {
    let k = days.has(todayKey) ? todayKey : D.addKey(todayKey, -1);
    let n = 0;
    while (days.has(k) && n < 100000) { n++; k = D.addKey(k, -1); }
    return n;
  }
  function longestStreak(days) {
    const list = [...days].filter(D.isKey).sort();
    let best = 0, run = 0, prev = null;
    list.forEach((k) => { run = prev && D.diffKeys(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return best;
  }
  /** Atualiza (e persiste) a melhor sequência histórica; nunca diminui. */
  function refreshBest(s, todayKey) {
    const days = activityDays(s);
    const best = Math.max(s.game.bestStreak || 0, longestStreak(days), currentStreak(days, todayKey));
    s.game.bestStreak = best;
    return best;
  }

  /* ---------- aplicação de regras às ações do usuário ---------- */
  const habitKey = (goal, key) => (goal.type === 'weekly' ? 'goalweek:' + goal.id + ':' + D.weekStartKey(key) : 'goalday:' + goal.id + ':' + key);
  const isRetro = (key, todayKey, weekly) => (weekly ? D.weekStartKey(key) < D.weekStartKey(todayKey) : key < todayKey);
  const retroAmount = (base) => Math.max(1, Math.floor(base * RULES.retroFactor));

  /** Bônus do dia e retomada, concedidos no máximo uma vez por dia, só para atividade de HOJE. */
  function dailyBonuses(s, todayKey) {
    const out = [];
    const prior = [...activityDays(s)].filter((k) => k < todayKey).sort().pop();
    const b = award(s.game, { key: 'daily-bonus:' + todayKey, src: 'bonus', amount: RULES.dailyBonus, label: 'Bônus da primeira atividade do dia', date: todayKey });
    if (b.entry) out.push(b.entry);
    if (prior && D.diffKeys(prior, todayKey) >= RULES.comebackGapDays) {
      const c = award(s.game, { key: 'comeback:' + todayKey, src: 'bonus', amount: RULES.comeback, label: 'Bem-vindo de volta', date: todayKey });
      if (c.entry) out.push(c.entry);
    }
    return out;
  }

  function grant(s, o, todayKey) {
    const r = award(s.game, o);
    const entries = [];
    if (r.entry) { entries.push(r.entry); if (!o.retro) entries.push(...dailyBonuses(s, todayKey)); }
    return { entries, capped: !!r.capped, duplicate: !!r.duplicate };
  }

  /** Chame após alterar um hábito. res = retorno de habits.toggle/adjust. */
  function onHabitChange(s, goal, key, res, todayKey) {
    if (!res.ok) return { entries: [] };
    if (!res.wasComplete && res.isComplete) {
      const weekly = goal.type === 'weekly', retro = isRetro(key, todayKey, weekly);
      const base = weekly ? RULES.habitWeek : RULES.habitDay;
      return grant(s, { key: habitKey(goal, key), src: 'habit', amount: retro ? retroAmount(base) : base, label: (weekly ? 'Meta semanal: ' : 'Hábito: ') + goal.name + (retro ? ' (retroativo)' : ''), date: key, retro }, todayKey);
    }
    if (res.wasComplete && !res.isComplete) {
      const e = reverse(s.game, habitKey(goal, key), 'Desfeito: ' + goal.name);
      return { entries: e ? [e] : [] };
    }
    return { entries: [] };
  }
  /** Chame após alternar uma tarefa. */
  function onTaskToggle(s, task, todayKey) {
    if (task.done) return grant(s, { key: 'task:' + task.id, src: 'task', amount: RULES.task, label: 'Tarefa: ' + task.t, date: todayKey }, todayKey);
    const e = reverse(s.game, 'task:' + task.id, 'Desfeito: tarefa ' + task.t);
    return { entries: e ? [e] : [] };
  }
  /** Regra de exclusão: apagar uma tarefa concluída ou uma nota estorna a recompensa, para não permitir farmar criando e apagando. */
  function onTaskDelete(s, task) { const e = reverse(s.game, 'task:' + task.id, 'Tarefa excluída: ' + task.t); return { entries: e ? [e] : [] }; }
  function onNoteCreate(s, note, todayKey) { return grant(s, { key: 'note:' + note.id, src: 'note', amount: RULES.note, label: 'Nova nota' + (note.t ? ': ' + note.t : ''), date: todayKey }, todayKey); }
  function onNoteDelete(s, note) { const e = reverse(s.game, 'note:' + note.id, 'Nota excluída'); return { entries: e ? [e] : [] }; }

  /* ---------- missões ---------- */
  const habitDaysDone = (s, key) => s.goals.filter((gl) => gl.type !== 'weekly' && gl.start <= key && H.isComplete(s, gl, key)).length;
  function habitWinsInWeek(s, weekKey, limitKey) {
    let n = 0;
    s.goals.forEach((gl) => {
      if (gl.type === 'weekly') { if (weekKey >= D.weekStartKey(gl.start) && weekKey <= limitKey && H.isComplete(s, gl, weekKey)) n++; }
      else D.weekKeys(weekKey).forEach((k) => { if (k <= limitKey && k >= gl.start && H.isComplete(s, gl, k)) n++; });
    });
    return n;
  }
  const tasksDoneBetween = (s, from, to) => s.tasks.filter((t) => t.done && (t.doneAt || t.date) >= from && (t.doneAt || t.date) <= to).length;
  const notesBetween = (s, from, to) => s.notes.filter((n) => { const k = D.dateFromTs(n.ts); return k && k >= from && k <= to; }).length;

  function missionsFor(s, dayKey, weekKey, period, todayKey) {
    const weekEnd = D.addKey(weekKey, 6);
    const limit = weekEnd < todayKey ? weekEnd : todayKey;
    const defs = [
      { id: 'd_habits_' + dayKey, type: 'daily', icon: 'sprout', title: 'Comece com foco', desc: 'Conclua 2 hábitos no dia.', progress: habitDaysDone(s, dayKey), target: 2, reward: 25 },
      { id: 'd_task_' + dayKey, type: 'daily', icon: 'check-circle', title: 'Tire algo da lista', desc: 'Finalize uma tarefa no dia.', progress: tasksDoneBetween(s, dayKey, dayKey), target: 1, reward: 20 },
      { id: 'd_note_' + dayKey, type: 'daily', icon: 'pencil', title: 'Registre uma ideia', desc: 'Escreva ou atualize uma nota no dia.', progress: notesBetween(s, dayKey, dayKey), target: 1, reward: 15 },
      { id: 'w_habits_' + weekKey, type: 'weekly', icon: 'flame', title: 'Semana consistente', desc: 'Conclua 10 hábitos/períodos na semana.', progress: habitWinsInWeek(s, weekKey, limit), target: 10, reward: 80 },
      { id: 'w_tasks_' + weekKey, type: 'weekly', icon: 'clipboard', title: 'Zere a fila', desc: 'Finalize 5 tarefas na semana.', progress: tasksDoneBetween(s, weekKey, weekEnd), target: 5, reward: 60 },
      { id: 'w_notes_' + weekKey, type: 'weekly', icon: 'book', title: 'Organize as ideias', desc: 'Registre 3 notas na semana.', progress: notesBetween(s, weekKey, weekEnd), target: 3, reward: 45 }
    ];
    return defs.map((m) => {
      const claimed = !!s.game.missionClaims[m.id], done = m.progress >= m.target;
      const state = claimed ? 'claimed' : period === 'previous' ? 'expired' : done ? 'ready' : 'available';
      return Object.assign({}, m, { period, claimed, state, rawProgress: m.progress, progress: Math.min(m.progress, m.target), pct: Math.min(100, Math.round((m.progress / m.target) * 100)) });
    });
  }
  /** Missões do período atual e as do período anterior ainda não resgatadas (expiradas). */
  function missions(s, todayKey) {
    const wk = D.weekStartKey(todayKey);
    const cur = missionsFor(s, todayKey, wk, 'current', todayKey);
    const prevDay = D.addKey(todayKey, -1), prevWeek = D.addKey(wk, -7);
    const prev = missionsFor(s, prevDay, prevWeek, 'previous', todayKey).filter((m) => (m.type === 'daily' ? m.id.endsWith(prevDay) : m.id.endsWith(prevWeek)) && !m.claimed);
    return cur.concat(prev);
  }
  /** Resgata a recompensa de uma missão do período atual. Idempotente. */
  function claimMission(s, id, todayKey) {
    const m = missions(s, todayKey).find((x) => x.id === id && x.period === 'current');
    if (!m) return { ok: false, reason: 'unavailable' };
    if (m.claimed) return { ok: false, reason: 'claimed' };
    if (m.rawProgress < m.target) return { ok: false, reason: 'incomplete' };
    const r = award(s.game, { key: 'mission:' + id, src: 'mission', amount: m.reward, label: 'Missão: ' + m.title, date: todayKey });
    if (!r.entry) return { ok: false, reason: 'duplicate' };
    s.game.missionClaims[id] = D.now().getTime();
    return { ok: true, mission: m, entry: r.entry };
  }

  /* ---------- conquistas ---------- */
  function achievementDefs(s, todayKey) {
    const xp = totalXp(s.game), days = activityDays(s);
    const wins = s.goals.reduce((a, gl) => a + H.sequence(s, gl, todayKey).filter(Boolean).length, 0);
    const tasks = s.tasks.filter((t) => t.done).length, notes = s.notes.length;
    const claims = Object.keys(s.game.missionClaims);
    const dailyClaims = claims.filter((k) => k.startsWith('d_')).length, weeklyClaims = claims.filter((k) => k.startsWith('w_')).length;
    const maxGoalStreak = Math.max(0, ...s.goals.map((gl) => H.stats(s, gl, todayKey).best));
    const dailyGoals = s.goals.filter((gl) => gl.type !== 'weekly' && gl.start <= todayKey);
    const perfect = dailyGoals.length > 0 && dailyGoals.every((gl) => H.isComplete(s, gl, todayKey));
    const balanced = (wins > 0 ? 1 : 0) + (tasks > 0 ? 1 : 0) + (notes > 0 ? 1 : 0);
    const streak = currentStreak(days, todayKey), lvl = levelOf(xp);
    const weekWins = habitWinsInWeek(s, D.weekStartKey(todayKey), todayKey);
    const weeklyDone = s.goals.some((gl) => gl.type === 'weekly' && H.sequence(s, gl, todayKey).some(Boolean)) ? 1 : 0;
    return [
      ['first_habit', 'sprout', 'Primeiro passo', 'Conclua seu primeiro hábito.', wins, 1, 15],
      ['habit_10', 'leaf', 'Criando raízes', 'Conclua 10 metas de hábito.', wins, 10, 30],
      ['habit_100', 'tree', 'Imparável', 'Acumule 100 conclusões de hábitos.', wins, 100, 100],
      ['task_1', 'check-circle', 'Feito é melhor', 'Finalize sua primeira tarefa.', tasks, 1, 15],
      ['task_10', 'pin', 'Mão na massa', 'Finalize 10 tarefas.', tasks, 10, 35],
      ['task_50', 'hammer', 'Executor', 'Finalize 50 tarefas.', tasks, 50, 100],
      ['note_1', 'pencil', 'Uma ideia no papel', 'Crie sua primeira nota.', notes, 1, 10],
      ['note_10', 'book', 'Diário ativo', 'Guarde 10 notas.', notes, 10, 35],
      ['note_30', 'brain', 'Mente organizada', 'Guarde 30 notas.', notes, 30, 100],
      ['streak_3', 'flame', 'Três dias de foco', 'Mantenha uma sequência de 3 dias ativos.', streak, 3, 25],
      ['streak_7', 'bolt', 'Uma semana forte', 'Mantenha 7 dias ativos seguidos.', streak, 7, 60],
      ['streak_14', 'shield', 'Disciplina em construção', 'Mantenha 14 dias ativos seguidos.', streak, 14, 120],
      ['streak_30', 'crown', 'Hábito de vencer', 'Mantenha 30 dias ativos seguidos.', streak, 30, 300],
      ['xp_100', 'sparkles', 'XP inicial', 'Ganhe 100 XP.', xp, 100, 10],
      ['xp_500', 'heart', 'Em evolução', 'Ganhe 500 XP.', xp, 500, 35],
      ['xp_1000', 'gem', 'Mil motivos', 'Ganhe 1.000 XP.', xp, 1000, 75],
      ['xp_5000', 'star', 'Lenda viva', 'Ganhe 5.000 XP.', xp, 5000, 250],
      ['level_5', 'medal', 'Nível 5', 'Alcance o nível 5.', lvl, 5, 50],
      ['level_10', 'trophy', 'Nível 10', 'Alcance o nível 10.', lvl, 10, 200],
      ['daily_quests_3', 'target', 'Missão cumprida', 'Resgate 3 missões diárias.', dailyClaims, 3, 30],
      ['daily_quests_10', 'compass', 'Caçador de missões', 'Resgate 10 missões diárias.', dailyClaims, 10, 100],
      ['weekly_quests_5', 'map', 'Estratégia semanal', 'Resgate 5 missões semanais.', weeklyClaims, 5, 120],
      ['weekly_goal', 'trend', 'Visão de longo prazo', 'Complete sua primeira meta semanal.', weeklyDone, 1, 50],
      ['planner', 'puzzle', 'Planejador', 'Crie 5 metas ou hábitos.', s.goals.length, 5, 30],
      ['perfect_day', 'sun', 'Dia redondo', 'Conclua todos os hábitos diários ativos em um dia.', perfect ? 1 : 0, 1, 30],
      ['balanced', 'scale', 'Equilíbrio', 'Tenha hábitos concluídos, tarefas finalizadas e notas.', balanced, 3, 30],
      ['active_7', 'calendar-check', 'Presença constante', 'Tenha atividade registrada em 7 dias diferentes.', days.size, 7, 60],
      ['active_30', 'sparkles', 'Um mês construindo', 'Tenha atividade registrada em 30 dias diferentes.', days.size, 30, 200],
      ['goal_streak_7', 'bolt', 'Ritmo consistente', 'Mantenha uma meta por 7 períodos consecutivos.', maxGoalStreak, 7, 60],
      ['weekly_habits_10', 'rocket', 'Semana produtiva', 'Conclua 10 hábitos/períodos nesta semana.', weekWins, 10, 50]
    ].map(([id, icon, title, desc, value, target, reward]) => ({ id, icon, title, desc, value, target, reward }));
  }
  function achievements(s, todayKey) {
    return achievementDefs(s, todayKey).map((a) => ({ ...a, unlocked: !!s.game.unlocked[a.id], unlockedAt: s.game.unlocked[a.id] || null, ready: a.value >= a.target, progress: Math.min(a.value, a.target), pct: Math.min(100, Math.round((a.value / a.target) * 100)) }));
  }
  /** Desbloqueia o que foi alcançado e concede o XP (uma vez). Repete porque XP pode destravar outras conquistas. */
  function syncAchievements(s, todayKey) {
    const fresh = [];
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      achievementDefs(s, todayKey).forEach((a) => {
        if (a.value >= a.target && !s.game.unlocked[a.id]) {
          s.game.unlocked[a.id] = D.now().getTime();
          award(s.game, { key: 'achievement:' + a.id, src: 'achievement', amount: a.reward, label: 'Conquista: ' + a.title, date: todayKey });
          fresh.push(a); changed = true;
        }
      });
      if (!changed) break;
    }
    refreshBest(s, todayKey);
    return fresh;
  }

  MG.gamification = { RULES, TITLES, levelOf, xpForLevel, titleOf, levelInfo, totalXp, activeAwards, isActive, award, reverse, history, activityDays, currentStreak, longestStreak, refreshBest, habitKey, retroAmount, onHabitChange, onTaskToggle, onTaskDelete, onNoteCreate, onNoteDelete, missions, claimMission, achievements, syncAchievements };
  if (typeof module !== 'undefined') module.exports = MG.gamification;
})(typeof globalThis !== 'undefined' ? globalThis : window);
