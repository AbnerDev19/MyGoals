/* MyGoals — mapa de progresso no estilo "contribuições do GitHub".
 *
 * Geometria (testada em tests/heatmap.test.js):
 *  - Colunas = semanas (domingo → sábado), linhas = dias da semana. A última coluna é a semana atual.
 *  - A célula de cada dia fica SEMPRE na linha do seu dia da semana e na coluna da sua semana;
 *    dias futuros ocupam o lugar mas ficam invisíveis, então nada "escorrega".
 *  - Rótulos de mês ficam acima da primeira semana de cada mês; rótulos de dia (Seg, Qua, Sex) à esquerda.
 *  - Níveis 0–4 (como o GitHub). Por hábito: nível pelo progresso do dia; geral: pela quantidade de atividades.
 */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const D = MG.dates, H = MG.habits;
  const { esc } = MG.util;

  const RANGES = { '12m': { cols: 53, label: 'nos últimos 12 meses' }, '6m': { cols: 27, label: 'nos últimos 6 meses' }, '3m': { cols: 14, label: 'nos últimos 3 meses' } };
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const MONTHS_LONG = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];
  const MIN_LABEL_GAP = 3; // colunas mínimas entre dois rótulos de mês (evita sobreposição)

  const tipDate = (key) => { const d = D.parse(key); return D.WEEKDAYS_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()]; };

  /** Nível 0–4 do dia para um hábito, pelo progresso em relação à meta (metas semanais: meta/7 por dia). */
  function habitLevel(s, goal, key) {
    const v = H.valueOn(s, goal, key);
    if (v <= 0) return 0;
    const t = goal.type === 'weekly' ? H.targetAt(goal, key) / 7 : H.targetAt(goal, key);
    const r = v / t;
    return r >= 1 ? 4 : r >= 0.67 ? 3 : r >= 0.34 ? 2 : 1;
  }

  /** Quantidade de atividades por dia (hábito registrado, tarefa concluída, nota) dentro do intervalo. */
  function activityCounts(s, from, to) {
    const m = {};
    const add = (k) => { if (k >= from && k <= to) m[k] = (m[k] || 0) + 1; };
    s.goals.forEach((gl) => { const e = s.e[gl.id] || {}; Object.keys(e).forEach((k) => { if (e[k] > 0) add(k); }); });
    s.tasks.forEach((t) => { if (t.done) add(t.doneAt || t.date); });
    s.notes.forEach((n) => { const k = D.dateFromTs(n.ts); if (k) add(k); });
    return m;
  }
  const levelFromCount = (n, max) => (n <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((4 * n) / max))));

  /** Constrói o modelo (sem HTML). goal = null → visão geral. */
  function build(s, goal, range, todayKey) {
    const cfg = RANGES[range] || RANGES['12m'];
    const cols = cfg.cols;
    const start = D.key(D.addDays(D.weekStart(D.parse(todayKey)), -(cols - 1) * 7));
    const lastKey = D.addKey(start, cols * 7 - 1);
    const counts = goal ? null : activityCounts(s, start, todayKey);
    const max = goal ? 0 : Math.max(1, ...Object.values(counts));
    const cells = [];
    let done = 0, avail = 0, activeDays = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 7; r++) {
        const key = D.addKey(start, c * 7 + r);
        const cell = { key, col: c, row: r, level: 0, state: 'ok', tip: '' };
        if (key > todayKey) { cell.state = 'future'; }
        else if (goal) {
          if (key < goal.start) { cell.state = 'before'; cell.tip = tipDate(key) + ' — antes do início do hábito'; }
          else {
            cell.level = habitLevel(s, goal, key); avail++;
            const complete = H.dayStatus(s, goal, key) === 1; if (complete) done++;
            const v = H.valueOn(s, goal, key);
            cell.tip = tipDate(key) + ' — ' + (goal.type === 'check' ? (v ? 'concluído' : 'não feito') : v ? v + ' ' + (goal.unit || '') + (complete ? ' (meta cumprida)' : '') : 'sem registro');
          }
        } else {
          const n = counts[key] || 0;
          cell.level = levelFromCount(n, max); if (n) activeDays++;
          cell.tip = tipDate(key) + ' — ' + (n === 0 ? 'nenhuma atividade' : n === 1 ? '1 atividade' : n + ' atividades');
        }
        cells.push(cell);
      }
    }
    // Rótulos de mês: na primeira coluna de cada mês; o primeiro só aparece se couber.
    const months = [];
    let prev = -1;
    for (let c = 0; c < cols; c++) {
      const m = D.addDays(D.parse(start), c * 7).getMonth();
      if (m !== prev) { months.push({ col: c, label: MONTHS[m] }); prev = m; }
    }
    const kept = months.filter((x, i) => { const next = months[i + 1]; return !(next && next.col - x.col < MIN_LABEL_GAP); });
    const summary = goal
      ? done + ' de ' + avail + ' dias com meta cumprida ' + cfg.label
      : activeDays + (activeDays === 1 ? ' dia com atividade ' : ' dias com atividade ') + cfg.label;
    return { cols, start, lastKey, cells, months: kept, summary, done, avail, activeDays };
  }

  /** HTML do mapa. goal = null → visão geral (verde). */
  function render(c, goal, range) {
    const m = build(c.s, goal, range, c.today);
    const cells = m.cells.map((x) => (x.state === 'future' ? '<i class="x" aria-hidden="true"></i>' : '<i data-l="' + x.level + '"' + (x.state === 'before' ? ' class="b"' : '') + ' data-tip="' + esc(x.tip) + '"></i>')).join('');
    const months = m.months.map((x) => '<span style="grid-column:' + (x.col + 1) + ' / span ' + Math.min(MIN_LABEL_GAP, m.cols - x.col) + '">' + x.label + '</span>').join('');
    const days = DAY_LABELS.map((d) => '<span>' + d + '</span>').join('');
    return '<div class="gh ' + (goal ? 'habit' : 'all') + '" style="--cols:' + m.cols + (goal ? ';--c:' + goal.color : '') + '">' +
      '<div class="gh-scroll" tabindex="0" role="group" aria-label="Mapa de progresso. Role para os lados para ver outros meses.">' +
      '<div class="gh-body" role="img" aria-label="' + esc((goal ? goal.name + ': ' : 'Visão geral: ') + m.summary) + '">' +
      '<div class="gh-days" aria-hidden="true">' + days + '</div><div class="gh-months" aria-hidden="true">' + months + '</div><div class="gh-cells" aria-hidden="true">' + cells + '</div></div></div>' +
      '<div class="gh-foot"><span class="gh-tip small muted" aria-live="polite" data-default="' + esc(m.summary) + '">' + esc(m.summary) + '</span>' +
      '<span class="gh-legend" aria-hidden="true"><span>Menos</span>' + [0, 1, 2, 3, 4].map((l) => '<i data-l="' + l + '"></i>').join('') + '<span>Mais</span></span></div></div>';
  }

  MG.heatmap = { RANGES, build, render, habitLevel, levelFromCount, activityCounts };
  if (typeof module !== 'undefined') module.exports = MG.heatmap;
})(typeof globalThis !== 'undefined' ? globalThis : window);
