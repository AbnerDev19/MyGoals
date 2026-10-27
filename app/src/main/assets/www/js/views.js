/* MyGoals — telas (geração de HTML). Só lê o estado; nunca altera dados.
 * Todo texto vindo do usuário passa por esc(). Ícones funcionais são SVG, não emoji.
 * ctx = { s: estado, ui: estado da interface, today: 'AAAA-MM-DD', now: Date } */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const D = MG.dates, H = MG.habits, G = MG.gamification, C = MG.calendar;
  const { esc, fmt } = MG.util;
  const I = MG.icons.icon;

  const NOTE_COLORS = ['', '#f28b82', '#fbbc04', '#fff475', '#ccff90', '#a7ffeb', '#aecbfa', '#d7aefb'];
  const NOTE_COLOR_NAMES = ['Sem cor', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Turquesa', 'Azul', 'Roxo'];

  const ring = (ratio) => {
    const c = 2 * Math.PI * 15;
    return '<svg class="ringsvg" viewBox="0 0 36 36" aria-hidden="true"><circle class="trk" cx="18" cy="18" r="15"/>' + (ratio > 0 ? '<circle class="prg" cx="18" cy="18" r="15" stroke-dasharray="' + (c * Math.min(1, ratio)).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 18 18)"/>' : '') + '</svg>';
  };
  const bar = (pct, cls) => '<div class="bar ' + (cls || '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>';
  const head = (eyebrow, title, right) => '<header class="page-head"><div>' + (eyebrow ? '<div class="eyebrow cap">' + eyebrow + '</div>' : '') + '<h1>' + title + '</h1></div>' + (right || '') + '</header>';
  const sectionH = (icon, title, count) => '<div class="section-h"><h2>' + (icon ? I(icon) : '') + title + '</h2>' + (count != null ? '<span class="count">' + count + '</span>' : '') + '</div>';
  const nameOf = (s) => (s.p.name || '').trim();
  const labelDate = (key) => D.longLabel(D.parse(key));

  /* ---------- itens ---------- */
  function habitItem(c, it, key) {
    const gl = it.goal, s = c.s, future = key > c.today;
    const val = H.periodValue(s, gl, key), tg = H.periodTarget(gl, key), st = H.stats(s, gl, c.today);
    const freq = gl.type === 'weekly' ? 'Semanal' : 'Diário';
    const prog = gl.type === 'check' ? (it.done ? 'Concluído' : 'Pendente') : fmt(val) + ' / ' + fmt(tg) + ' ' + esc(gl.unit) + (gl.type === 'weekly' ? ' na semana' : '');
    const streak = st.current > 0 ? '<span>' + I('flame') + st.current + (gl.type === 'weekly' ? ' sem.' : st.current === 1 ? ' dia' : ' dias') + '</span>' : '';
    const label = (it.done ? 'Desmarcar ' : 'Concluir ') + gl.name + (gl.type === 'weekly' ? ' neste dia' : '');
    const steppers = gl.type === 'check' ? '' :
      '<button class="step" data-a="hdec" data-id="' + esc(gl.id) + '" data-d="' + key + '" aria-label="Diminuir ' + esc(gl.name) + '"' + (future ? ' disabled' : '') + '>' + I('minus') + '</button>' +
      '<button class="step" data-a="hinc" data-id="' + esc(gl.id) + '" data-d="' + key + '" aria-label="Aumentar ' + esc(gl.name) + '"' + (future ? ' disabled' : '') + '>' + I('plus') + '</button>';
    return '<div class="item habit' + (it.done ? ' done' : '') + '" style="--c:' + gl.color + '">' +
      '<button class="check' + (it.done ? ' done' : '') + '" data-a="htog" data-id="' + esc(gl.id) + '" data-d="' + key + '" aria-pressed="' + it.done + '" aria-label="' + esc(label) + '"' + (future ? ' disabled' : '') + '>' + ring(it.ratio) + (it.done ? I('check', 'mark') : '') + '</button>' +
      '<button class="main" data-a="hdet" data-id="' + esc(gl.id) + '"><span class="title">' + (gl.emoji ? esc(gl.emoji) + ' ' : '') + esc(gl.name) + '</span>' +
      '<span class="meta"><span>' + I('repeat') + freq + '</span><span>' + prog + '</span>' + streak + (future ? '<span>Data futura</span>' : '') + '</span></button>' + steppers + '</div>';
  }
  function taskItem(c, it, key) {
    const t = it.task, overdue = it.state === 'overdue';
    return '<div class="item task' + (it.done ? ' done' : '') + (t.prio ? ' prio' : '') + '">' +
      '<button class="check sq' + (it.done ? ' done' : '') + '" data-a="ttog" data-id="' + esc(t.id) + '" aria-pressed="' + it.done + '" aria-label="' + (it.done ? 'Reabrir tarefa ' : 'Concluir tarefa ') + esc(t.t) + '"><span class="box">' + (it.done ? I('check') : '') + '</span></button>' +
      '<button class="main" data-a="tedit" data-id="' + esc(t.id) + '"><span class="title">' + esc(t.t) + '</span><span class="meta"><span>' + I('clipboard') + 'Tarefa</span>' +
      (t.time ? '<span>' + I('clock') + t.time + '</span>' : '') + (t.prio ? '<span class="badge warn">' + I('flag') + 'Prioridade alta</span>' : '') + (overdue ? '<span class="badge bad">' + I('alert') + 'Atrasada</span>' : '') + '</span></button></div>';
  }
  const item = (c, it, key) => (it.kind === 'habit' ? habitItem(c, it, key) : taskItem(c, it, key));

  function message(c, sum) {
    const h = c.now.getHours();
    if (!sum.total) return 'Adicione um hábito ou uma tarefa para planejar o dia.';
    if (sum.allDone) return 'Você fez o que planejou. Aproveite o resto do dia.';
    const streak = G.currentStreak(G.activityDays(c.s), c.today);
    if (streak === 0 && G.activityDays(c.s).size > 0) return 'Retomar também conta. Um registro hoje recomeça a sequência.';
    if (sum.pct >= 50) return 'Mais da metade feita. Siga no seu ritmo.';
    if (sum.pct > 0) return 'Bom começo. Um passo de cada vez.';
    return h < 12 ? 'Comece pelo que for mais simples.' : 'Ainda dá tempo de fazer algo pequeno hoje.';
  }
  const NEXT_LABEL = { upcoming: 'Próxima tarefa', priority: 'Prioridade alta', late: 'Atrasada hoje', task: 'Tarefa pendente', habit: 'Hábito pendente' };
  function nextCard(c) {
    const n = C.nextAction(c.s, c.today, D.pad(c.now.getHours()) + ':' + D.pad(c.now.getMinutes()));
    if (!n) return '';
    const isTask = n.kind === 'task';
    const btn = isTask ? '<button class="btn primary sm" data-a="ttog" data-id="' + esc(n.id) + '">' + I('check') + 'Concluir</button>'
      : n.goal.type === 'check' ? '<button class="btn primary sm" data-a="htog" data-id="' + esc(n.id) + '" data-d="' + c.today + '">' + I('check') + 'Registrar</button>'
        : '<button class="btn primary sm" data-a="hinc" data-id="' + esc(n.id) + '" data-d="' + c.today + '">' + I('plus') + 'Adicionar</button>';
    return '<section class="card next-card" aria-labelledby="nx"><div class="icon-wrap">' + I(isTask ? 'clipboard' : 'repeat') + '</div><div class="grow"><div class="eyebrow" id="nx">Próxima ação · ' + NEXT_LABEL[n.reason] + '</div><div class="title" style="font-weight:700">' + esc(n.title) + '</div>' + (n.time ? '<div class="small muted">' + I('clock') + ' ' + n.time + '</div>' : '') + '</div>' + btn + '</section>';
  }

  /* ---------- HOJE ---------- */
  function hoje(c) {
    const { s, ui, today } = c, sel = ui.sel, isToday = sel === today;
    const sum = C.summary(s, sel, today), xp = G.totalXp(s.game), lv = G.levelInfo(xp);
    const h = c.now.getHours(), greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite', nm = nameOf(s);
    const avatar = '<button class="avatar" data-a="tab" data-v="aju" aria-label="Abrir ajustes e perfil"' + (s.p.photo ? ' style="background-image:url(\'' + s.p.photo + '\')"' : '') + '>' + (s.p.photo ? '' : esc((nm || '?')[0].toUpperCase())) + '</button>';
    const mon = D.weekKeys(sel);
    const circ = 2 * Math.PI * 34;
    let out = head(esc(labelDate(sel)), isToday ? esc(greet + (nm ? ', ' + nm : '')) : esc(D.WEEKDAYS_LONG[D.parse(sel).getDay()].replace(/^./, (x) => x.toUpperCase())), avatar);
    out += '<div class="weeknav"><button class="icon-btn" data-a="selwk" data-v="-7" aria-label="Semana anterior">' + I('chevron-left') + '</button>' + (isToday ? '<span class="small muted">Esta semana</span>' : '<button class="btn ghost sm" data-a="seltoday">Voltar para hoje</button>') + '<button class="icon-btn" data-a="selwk" data-v="7" aria-label="Próxima semana">' + I('chevron-right') + '</button></div>';
    out += '<div class="weekstrip" role="group" aria-label="Dias da semana">' + mon.map((k, i) => '<button data-a="sel" data-d="' + k + '" aria-pressed="' + (k === sel) + '"' + (k === today ? ' class="is-today" aria-label="Hoje, ' + esc(labelDate(k)) + '"' : ' aria-label="' + esc(labelDate(k)) + '"') + '><small>' + D.WEEKDAYS_SHORT[i] + '</small><b>' + D.parse(k).getDate() + '</b></button>').join('') + '</div>';
    out += '<section class="card progress-card' + (sum.allDone ? ' complete' : '') + '" style="margin-top:12px;flex-wrap:wrap" aria-label="Progresso do dia"><div class="ringbig"><svg viewBox="0 0 84 84" aria-hidden="true"><circle class="trk" cx="42" cy="42" r="34"/><circle class="prg" cx="42" cy="42" r="34" stroke-dasharray="' + (circ * sum.pct / 100).toFixed(1) + ' ' + circ.toFixed(1) + '"/></svg><div class="pct">' + (sum.total ? sum.pct + '%' : '—') + '</div></div>' +
      '<div class="grow"><h2>' + (sum.allDone ? 'Tudo em dia' : sum.total ? sum.done + ' de ' + sum.total + ' concluídos' : 'Dia livre') + '</h2><p class="small" style="margin-top:4px">' + esc(message(c, sum)) + '</p></div>' +
      '<button class="level-line" data-a="tab" data-v="prog" aria-label="Nível ' + lv.level + ', ' + fmt(xp) + ' XP. Abrir jornada"><span class="badge">' + I('star') + 'Nv ' + lv.level + '</span><span class="grow">' + bar(lv.pct) + '</span><span class="small muted">' + fmt(xp) + ' XP</span><span class="badge">' + I('flame') + G.currentStreak(G.activityDays(s), today) + '</span></button></section>';

    if (!s.goals.length && !s.tasks.length) {
      return out + '<div class="empty"><div>' + I('sprout') + '</div><h2>Comece com um passo pequeno</h2><p>Crie um hábito para acompanhar todos os dias ou uma tarefa para algo pontual.</p><div class="row-flex" style="justify-content:center;flex-wrap:wrap;margin-top:14px"><button class="btn primary" data-a="hnew">' + I('repeat') + 'Criar hábito</button><button class="btn" data-a="tnew">' + I('clipboard') + 'Criar tarefa</button></div></div>';
    }
    out += '<div style="margin-top:12px" class="stack">';
    if (isToday && !sum.allDone) out += nextCard(c);
    if (sum.allDone) out += '<div class="card soft empty done" style="padding:20px"><div>' + I('check-circle') + '</div><h2>Dia concluído</h2><p>Nada pendente por hoje. Descansar também faz parte do progresso.</p></div>';
    out += '</div>';
    if (sum.pendingTasks.length) out += sectionH('clipboard', 'Tarefas', sum.pendingTasks.length) + '<div class="list">' + sum.pendingTasks.map((it) => item(c, it, sel)).join('') + '</div>';
    if (sum.pendingHabits.length) out += sectionH('repeat', 'Hábitos', sum.pendingHabits.length) + '<div class="list">' + sum.pendingHabits.map((it) => item(c, it, sel)).join('') + '</div>';
    if (sum.weekly.length) out += sectionH('calendar-check', 'Metas da semana', sum.weekly.filter((i) => i.done).length + '/' + sum.weekly.length) + '<div class="list">' + sum.weekly.map((it) => item(c, it, sel)).join('') + '</div>';
    if (sum.doneItems.length) out += '<details class="fold" style="margin-top:20px"><summary><span>Concluídos (' + sum.doneItems.length + ')</span>' + I('chevron-down') + '</summary><div class="list">' + sum.doneItems.map((it) => item(c, it, sel)).join('') + '</div></details>';
    return out;
  }

  /* ---------- JORNADA ---------- */
  function heat(c, gl, range) {
    const today = c.today, y = D.parse(today).getFullYear();
    const from = range === 'ano' ? D.key(new Date(y, 0, 1)) : D.addKey(today, -89), to = range === 'ano' ? D.key(new Date(y, 11, 31)) : today;
    const off = D.parse(from).getDay(), keys = D.dayKeysBetween(from, to), cols = Math.ceil((off + keys.length) / 7);
    let done = 0, avail = 0;
    let cells = '<i style="visibility:hidden"></i>'.repeat(off);
    keys.forEach((k) => {
      let bg;
      if (k > today) bg = 'var(--fut)'; else if (k < gl.start) bg = 'var(--off)';
      else { const x = H.dayStatus(c.s, gl, k); avail++; if (x === 1) done++; bg = x === 1 ? 'var(--c)' : x ? 'color-mix(in srgb,var(--c) 45%,var(--off))' : 'var(--off)'; }
      cells += '<i style="background:' + bg + '"></i>';
    });
    return '<div class="heat-wrap"><div class="heat" role="img" aria-label="Mapa de consistência de ' + esc(gl.name) + ': ' + done + ' de ' + avail + ' dias com meta diária cumprida" style="--c:' + gl.color + ';grid-template-columns:repeat(' + cols + ',minmax(6px,1fr))">' + cells + '</div></div>';
  }
  function missionCard(m) {
    const st = { available: ['Em andamento', ''], ready: ['Pronta para resgatar', 'ok'], claimed: ['Resgatada', 'ok'], expired: ['Expirada', 'bad'] }[m.state];
    return '<article class="card mission ' + m.state + '"><div class="top"><div class="ico">' + I(m.icon) + '</div><div class="grow"><h3>' + esc(m.title) + '</h3><p class="small">' + esc(m.desc) + '</p></div><span class="badge ' + st[1] + '">' + (m.state === 'claimed' ? I('check') : '') + st[0] + '</span></div>' +
      '<div class="row-flex"><div class="grow">' + bar(m.pct, m.state === 'claimed' ? 'ok' : '') + '</div><span class="small muted">' + fmt(m.progress) + '/' + fmt(m.target) + '</span><span class="badge">+' + m.reward + ' XP</span></div>' +
      (m.state === 'ready' ? '<button class="btn primary" data-a="claim" data-id="' + esc(m.id) + '">' + I('sparkles') + 'Resgatar +' + m.reward + ' XP</button>' : '') +
      (m.state === 'expired' ? '<p class="small">O período terminou e esta recompensa não pode mais ser resgatada.</p>' : '') + '</article>';
  }
  function badgeCard(a) {
    return '<article class="card badge-card ' + (a.unlocked ? 'unlocked' : 'locked') + '"><div class="ico">' + I(a.icon) + '</div><h3>' + esc(a.title) + '</h3><p>' + esc(a.desc) + '</p><div style="margin-top:auto">' + bar(a.pct) + '<div class="row-flex between small muted" style="margin-top:6px"><span>' + (a.unlocked ? 'Desbloqueada' : 'Bloqueada · ' + fmt(a.progress) + '/' + fmt(a.target)) + '</span><b>' + (a.unlocked ? '' : '+' + a.reward + ' XP') + '</b></div></div></article>';
  }
  function histRow(e) {
    const tag = e.kind === 'reversal' ? '<span class="badge bad">Estorno</span>' : e.kind === 'opening' ? '<span class="badge">Saldo migrado</span>' : e.retro ? '<span class="badge warn">Retroativo</span>' : '';
    return '<div class="ledger"><div class="grow"><div style="font-weight:600;overflow-wrap:anywhere">' + esc(e.label) + '</div><div class="small muted">' + (e.at ? new Date(e.at).toLocaleDateString('pt-BR') : 'Data não registrada') + (e.date && e.date !== D.dateFromTs(e.at) ? ' · referente a ' + e.date.split('-').reverse().join('/') : '') + '</div></div>' + tag + '<div class="amt ' + (e.amount >= 0 ? 'pos' : 'neg') + '">' + (e.amount > 0 ? '+' : '') + e.amount + ' XP</div></div>';
  }
  function prog(c) {
    const { s, ui, today } = c, xp = G.totalXp(s.game), lv = G.levelInfo(xp), days = G.activityDays(s);
    const ach = G.achievements(s, today), got = ach.filter((a) => a.unlocked).length, best = Math.max(s.game.bestStreak || 0, G.longestStreak(days));
    let out = head('Seu progresso, no seu ritmo', 'Jornada');
    out += '<section class="hero" aria-label="Nível e XP"><div class="row-flex between"><span class="eyebrow">Nível ' + lv.level + '</span><span class="badge" style="background:rgba(255,255,255,.2);color:#fff">' + fmt(xp) + ' XP</span></div><h2 style="margin:8px 0 14px">' + esc(lv.title) + '</h2><div class="row-flex between small" style="margin-bottom:8px"><span>Próximo nível</span><b>' + fmt(lv.remaining) + ' XP restantes</b></div>' + bar(lv.pct) +
      '<div class="stats"><div><b>' + I('flame') + G.currentStreak(days, today) + '</b><span>dias seguidos</span></div><div><b>' + I('trophy') + best + '</b><span>melhor sequência</span></div><div><b>' + I('medal') + got + '/' + ach.length + '</b><span>conquistas</span></div></div></section>';
    out += '<div class="seg" role="tablist" aria-label="Seções da jornada" style="margin:16px 0">' + [['miss', 'Missões', 'target'], ['conq', 'Conquistas', 'medal'], ['hist', 'Histórico', 'history'], ['evo', 'Evolução', 'trend']].map((x) => '<button role="tab" data-a="jtab" data-v="' + x[0] + '" aria-selected="' + (ui.jtab === x[0]) + '">' + I(x[2]) + '<span class="sr-sm">' + x[1] + '</span></button>').join('') + '</div>';
    if (ui.jtab === 'miss') {
      const ms = G.missions(s, today), by = (t, p) => ms.filter((m) => m.type === t && m.period === p);
      out += sectionH(null, 'Missões de hoje', by('daily', 'current').filter((m) => m.state === 'claimed').length + '/' + by('daily', 'current').length) + '<div class="list">' + by('daily', 'current').map(missionCard).join('') + '</div>';
      out += sectionH(null, 'Desafios da semana', by('weekly', 'current').filter((m) => m.state === 'claimed').length + '/' + by('weekly', 'current').length) + '<div class="list">' + by('weekly', 'current').map(missionCard).join('') + '</div>';
      const exp = ms.filter((m) => m.period === 'previous');
      if (exp.length) out += '<details class="fold" style="margin-top:20px"><summary><span>Expiradas (' + exp.length + ')</span>' + I('chevron-down') + '</summary><div class="list" style="padding-top:8px">' + exp.map(missionCard).join('') + '</div></details>';
    } else if (ui.jtab === 'conq') {
      const f = ui.achf, list = ach.filter((a) => f === 'all' || (f === 'got' ? a.unlocked : !a.unlocked));
      out += '<div class="chips" role="group" aria-label="Filtrar conquistas">' + [['all', 'Todas'], ['got', 'Desbloqueadas'], ['lock', 'Bloqueadas']].map((x) => '<button class="chip" data-a="achf" data-v="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>').join('') + '</div><div class="badges" style="margin-top:8px">' + list.map(badgeCard).join('') + '</div>';
    } else if (ui.jtab === 'hist') {
      const all = G.history(s.game, 1000), shown = all.slice(0, ui.histN);
      out += '<p class="small" style="margin-bottom:8px">Cada ganho e cada estorno fica registrado. Desfazer uma ação cria um lançamento negativo; nada é apagado.</p>' + (all.length ? '<div class="card">' + shown.map(histRow).join('') + '</div>' + (all.length > shown.length ? '<button class="btn block" style="margin-top:12px" data-a="histmore">Ver mais</button>' : '') : '<div class="empty"><div>' + I('history') + '</div><h2>Nenhum XP ainda</h2><p>Conclua um hábito ou tarefa para ver o histórico aqui.</p></div>');
    } else {
      out += '<div class="seg" style="margin-bottom:12px" role="group" aria-label="Período">' + [['ano', 'Ano'], ['90', '90 dias']].map((x) => '<button data-a="rg" data-v="' + x[0] + '" aria-pressed="' + (ui.rg === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
      out += s.goals.length ? '<div class="list">' + s.goals.map((gl) => { const st = H.stats(s, gl, today); return '<button class="card" style="text-align:left" data-a="hdet" data-id="' + esc(gl.id) + '"><div class="row-flex between"><h3>' + (gl.emoji ? esc(gl.emoji) + ' ' : '') + esc(gl.name) + '</h3><span class="badge">' + st.pct + '%</span></div>' + heat(c, gl, ui.rg) + '</button>'; }).join('') + '</div>' : '<div class="empty"><div>' + I('trend') + '</div><h2>Sua evolução começa aqui</h2><p>Crie um hábito e registre o primeiro progresso.</p></div>';
    }
    return out;
  }

  /* ---------- AGENDA ---------- */
  function agendaItem(c, it, key) {
    return '<div class="timeline-item">' + '<span class="time">' + (it.time || '') + '</span>' + item(c, it, key) + '</div>';
  }
  function agenda(c) {
    const { s, ui, today } = c, wk = ui.awk, days = D.weekKeys(wk), mid = D.parse(days[3]);
    let out = head(null, 'Agenda');
    out += '<div class="row-flex between" style="margin-bottom:8px"><button class="icon-btn bordered" data-a="awk" data-v="-7" aria-label="Semana anterior">' + I('chevron-left') + '</button><div style="text-align:center"><div style="font-weight:700" class="cap">' + mid.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) + '</div><button class="btn ghost sm" data-a="atoday">Ir para hoje</button></div><button class="icon-btn bordered" data-a="awk" data-v="7" aria-label="Próxima semana">' + I('chevron-right') + '</button></div>';
    out += '<div class="seg" role="group" aria-label="Modo de visualização" style="margin-bottom:12px"><button data-a="aview" data-v="dia" aria-pressed="' + (ui.aview === 'dia') + '">' + I('list') + 'Dia</button><button data-a="aview" data-v="semana" aria-pressed="' + (ui.aview === 'semana') + '">' + I('grid') + 'Semana</button></div>';
    if (ui.aview === 'dia') {
      out += '<div class="weekstrip" role="group" aria-label="Dias da semana">' + days.map((k, i) => '<button data-a="aday" data-d="' + k + '" aria-pressed="' + (k === ui.asel) + '"' + (k === today ? ' class="is-today"' : '') + ' aria-label="' + esc(labelDate(k)) + '"><small>' + D.WEEKDAYS_SHORT[i] + '</small><b>' + D.parse(k).getDate() + '</b></button>').join('') + '</div>';
      const ad = C.agendaDay(s, ui.asel, today);
      out += '<h2 style="margin:16px 0 8px" class="cap">' + esc(labelDate(ui.asel)) + '</h2>';
      if (!ad.count) return out + '<div class="empty"><div>' + I('calendar') + '</div><h2>Dia sem compromissos</h2><p>Use + para adicionar uma tarefa com horário ou um hábito.</p></div>';
      if (ad.timed.length) out += sectionH('clock', 'Com horário', ad.timed.length) + '<div class="list">' + ad.timed.map((it) => agendaItem(c, it, ui.asel)).join('') + '</div>';
      if (ad.untimed.length) out += sectionH('clipboard', 'Sem horário', ad.untimed.length) + '<div class="list">' + ad.untimed.map((it) => agendaItem(c, it, ui.asel)).join('') + '</div>';
      if (ad.habits.length) out += sectionH('repeat', 'Hábitos', ad.habits.length) + '<div class="list">' + ad.habits.map((it) => agendaItem(c, it, ui.asel)).join('') + '</div>';
      return out;
    }
    // Semana: grade com rolagem horizontal; mostra TODAS as horas em que há tarefas (não só 6–22).
    const tasks = s.tasks.filter((t) => t.time && days.includes(t.date));
    const hours = tasks.map((t) => +t.time.slice(0, 2));
    const h0 = Math.min(6, ...hours), h1 = Math.max(22, ...hours);
    let grid = '<div class="agenda-grid"><div class="dh"></div>' + days.map((k, i) => '<div class="dh' + (k === today ? ' today' : '') + '">' + D.WEEKDAYS_SHORT[i] + '<br>' + D.parse(k).getDate() + '</div>').join('') + '<div class="hh">dia</div>';
    days.forEach((k) => {
      const it = C.dayItems(s, k, today);
      grid += '<div>' + it.filter((x) => x.kind === 'habit').map((x) => '<button class="ev habit' + (x.done ? ' done' : '') + '" style="--c:' + x.goal.color + '" data-a="hdet" data-id="' + esc(x.id) + '">' + (x.done ? '✓ ' : '') + esc(x.title) + '</button>').join('') + it.filter((x) => x.kind === 'task' && !x.time).map((x) => '<button class="ev' + (x.done ? ' done' : '') + (x.state === 'overdue' ? ' overdue' : '') + '" data-a="tedit" data-id="' + esc(x.id) + '">' + (x.done ? '✓ ' : '') + esc(x.title) + '</button>').join('') + '</div>';
    });
    for (let hr = h0; hr <= h1; hr++) {
      grid += '<div class="hh">' + D.pad(hr) + 'h</div>';
      days.forEach((k) => { grid += '<div>' + tasks.filter((t) => t.date === k && +t.time.slice(0, 2) === hr).sort((a, b) => D.cmp(a.time, b.time)).map((t) => '<button class="ev' + (t.done ? ' done' : '') + (!t.done && k < today ? ' overdue' : '') + '" data-a="tedit" data-id="' + esc(t.id) + '">' + (t.done ? '✓ ' : '') + t.time + ' ' + esc(t.t) + '</button>').join('') + '</div>'; });
    }
    return out + '<p class="small muted" style="margin-bottom:8px">Deslize para os lados para ver todos os dias. Tarefas concluídas aparecem riscadas e com ✓.</p><div class="agenda-week" tabindex="0" role="region" aria-label="Grade semanal">' + grid + '</div></div>';
  }

  /* ---------- DIÁRIO ---------- */
  function noteList(c) {
    const { s, ui } = c, q = ui.q.toLowerCase();
    const list = s.notes.filter((n) => (!ui.tg || n.tags.includes(ui.tg)) && (!q || (n.t + ' ' + n.b + ' ' + n.tags.join(' ')).toLowerCase().includes(q))).sort((a, b) => b.ts - a.ts);
    const card = (n) => '<button class="note" data-a="nopen" data-id="' + esc(n.id) + '" style="--nc:' + (n.c ? NOTE_COLORS[n.c] : 'transparent') + '" aria-label="Abrir nota ' + esc(n.t || n.b.slice(0, 40)) + '">' + (n.t ? '<b>' + esc(n.t) + '</b>' : '') + '<p>' + esc(n.b) + '</p>' + (n.tags.length ? '<div class="tags">' + n.tags.map((t) => '<span class="tag">' + esc(t) + '</span>').join('') + '</div>' : '') + '</button>';
    const pn = list.filter((n) => n.pin), ot = list.filter((n) => !n.pin);
    if (!list.length) return s.notes.length ? '<div class="empty"><div>' + I('search') + '</div><h2>Nada encontrado</h2><p>Tente outra palavra ou limpe o filtro.</p></div>' : '<div class="empty"><div>' + I('diary') + '</div><h2>Seu diário está vazio</h2><p>Registre ideias, listas e reflexões do dia.</p><button class="btn primary" data-a="nnew">' + I('plus') + 'Escrever primeira nota</button></div>';
    return (pn.length ? sectionH('pin', 'Fixadas', pn.length) + '<div class="notes">' + pn.map(card).join('') + '</div>' : '') + (ot.length ? (pn.length ? sectionH(null, 'Outras', ot.length) : '') + '<div class="notes">' + ot.map(card).join('') + '</div>' : '');
  }
  function dia(c) {
    const { s, ui } = c, tags = [...new Set(s.notes.flatMap((n) => n.tags))].sort();
    return head(null, 'Diário') + '<div class="field" style="margin-bottom:6px"><label class="sr" for="q">Pesquisar notas</label><input id="q" type="search" placeholder="Pesquisar notas" value="' + esc(ui.q) + '" autocomplete="off"></div>' +
      (tags.length ? '<div class="chips" role="group" aria-label="Filtrar por etiqueta"><button class="chip" data-a="tagf" data-v="" aria-pressed="' + !ui.tg + '">Todas</button>' + tags.map((t) => '<button class="chip" data-a="tagf" data-v="' + esc(t) + '" aria-pressed="' + (ui.tg === t) + '">' + I('tag') + esc(t) + '</button>').join('') + '</div>' : '') + '<div id="nl">' + noteList(c) + '</div>';
  }

  /* ---------- AJUSTES ---------- */
  function aju(c) {
    const { s, ui } = c, R = G.RULES, xp = G.totalXp(s.game), theme = s.prefs.theme, snap = MG.storage.hasSnapshot(MG.storage.browserAdapter());
    const themeBtn = (v, label, ic) => '<button data-a="theme" data-v="' + v + '" aria-pressed="' + (theme === v) + '">' + I(ic) + label + '</button>';
    let out = head(null, 'Ajustes');
    out += '<section class="card setting"><h2>Perfil</h2><div class="row-flex" style="margin:8px 0 14px"><div class="avatar" style="width:64px;height:64px;border-radius:20px' + (s.p.photo ? ';background-image:url(\'' + s.p.photo + '\')' : '') + '" aria-hidden="true">' + (s.p.photo ? '' : esc(((s.p.name || '?')[0]).toUpperCase())) + '</div><div class="stack" style="gap:8px"><button class="btn sm" data-a="photo">' + I('camera') + 'Trocar foto</button>' + (s.p.photo ? '<button class="btn sm ghost" data-a="photorm">Remover foto</button>' : '') + '</div></div><div class="field" style="margin-bottom:0"><label for="nm">Nome</label><input id="nm" value="' + esc(s.p.name) + '" maxlength="40" autocomplete="off" placeholder="Como devemos te chamar?"></div></section>';
    out += '<section class="card setting"><h2>Aparência</h2><p>O tema automático segue o modo escuro do aparelho.</p><div class="seg" role="group" aria-label="Tema">' + themeBtn('auto', 'Auto', 'moonsun') + themeBtn('light', 'Claro', 'sun') + themeBtn('dark', 'Escuro', 'moon') + '</div></section>';
    out += '<section class="card setting"><h2>Como funciona o XP</h2><p>Nível = ⌊√(XP ÷ 50)⌋ + 1. Você tem ' + fmt(xp) + ' XP.</p>' +
      [['Hábito diário concluído', '+' + R.habitDay], ['Meta semanal concluída', '+' + R.habitWeek], ['Tarefa concluída', '+' + R.task], ['Nova nota', '+' + R.note], ['Primeira atividade do dia', '+' + R.dailyBonus], ['Retomada após 3+ dias parado', '+' + R.comeback]].map((x) => '<div class="kv"><span>' + x[0] + '</span><b>' + x[1] + ' XP</b></div>').join('') +
      '<p class="small" style="margin-top:10px">Registros de dias anteriores rendem metade. Desfazer uma ação estorna o XP dela (fica no histórico). Limites diários: ' + R.caps.habit + ' hábitos, ' + R.caps.task + ' tarefas e ' + R.caps.note + ' notas. Missões e conquistas já resgatadas não são desfeitas.</p></section>';
    out += '<section class="card setting"><h2>Backup</h2><p>Seus dados ficam só neste aparelho. Exporte um backup para guardar ou levar para outro aparelho.</p><div class="stack"><button class="btn block" data-a="export">' + I('download') + 'Exportar para arquivo</button><button class="btn block" data-a="copy">' + I('copy') + 'Copiar backup</button><button class="btn block" data-a="importopen">' + I('upload') + 'Importar backup</button></div></section>';
    out += '<section class="card setting"><h2>Dados</h2><div class="kv"><span>Hábitos</span><b>' + s.goals.length + '</b></div><div class="kv"><span>Tarefas</span><b>' + s.tasks.length + '</b></div><div class="kv"><span>Notas</span><b>' + s.notes.length + '</b></div><div class="stack" style="margin-top:14px">' + (snap ? '<button class="btn block" data-a="restoresnap">' + I('undo') + 'Restaurar cópia anterior</button>' : '') + '<button class="btn block danger" data-a="sample">Carregar dados de exemplo</button><button class="btn block danger" data-a="clear">' + I('trash') + 'Começar do zero</button></div><p class="small" style="margin-top:10px">Antes de substituir ou apagar, o app guarda uma cópia automática do que existia (uma única, a mais recente).</p></section>';
    out += '<section class="card setting"><h2>Privacidade</h2><p>' + I('lock') + ' O MyGoals funciona offline, sem conta e sem enviar nada pela internet. Ficam armazenados neste aparelho: perfil (nome e foto), hábitos e registros, tarefas, notas e histórico de XP. Limpar os dados do app ou desinstalá-lo apaga tudo, a menos que você tenha um backup.</p><p class="small" style="margin-top:8px">Versão ' + esc(MG.VERSION || '') + ' · formato de dados ' + MG.schema.SCHEMA_VERSION + '</p></section>';
    return out;
  }

  MG.views = { hoje, prog, agenda, dia, aju, noteList, habitItem, taskItem, heat, bar, head, sectionH, NOTE_COLORS, NOTE_COLOR_NAMES, labelDate };
  if (typeof module !== 'undefined') module.exports = MG.views;
})(typeof globalThis !== 'undefined' ? globalThis : window);
