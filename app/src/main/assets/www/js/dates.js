/* MyGoals — regras de datas centralizadas.
 *
 * Convenções (documentadas porque afetam histórico):
 *  - Datas são chaves locais 'AAAA-MM-DD' (sem fuso).
 *  - A semana começa no DOMINGO. Metas semanais, a faixa da tela Hoje e a Agenda usam a mesma regra.
 *  - "Hoje" é calculado a cada chamada (o app pode ficar aberto durante a virada do dia).
 *  - Diferenças entre dias usam UTC para não sofrer com horário de verão.
 */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});

  let nowFn = () => new Date();
  const setClock = (fn) => { nowFn = fn || (() => new Date()); };
  const now = () => nowFn();

  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  /** Converte 'AAAA-MM-DD' em Date local; devolve null se for inválida (ex.: 2025-02-30). */
  function parse(s) {
    const m = typeof s === 'string' && KEY_RE.exec(s);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
  }
  const isKey = (s) => parse(s) !== null;

  const today = () => { const d = new Date(now()); d.setHours(0, 0, 0, 0); return d; };
  const todayKey = () => key(today());
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const addKey = (k, n) => key(addDays(parse(k), n));
  /** Início da semana (domingo) como Date. */
  const weekStart = (d) => addDays(d, -d.getDay());
  const weekStartKey = (k) => key(weekStart(parse(k)));
  /** Número inteiro de dias de a até b (b - a). */
  const diffDays = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
  const diffKeys = (a, b) => diffDays(parse(a), parse(b));
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const monthKey = (k) => k.slice(0, 7);
  const dayKeysBetween = (from, to) => { const out = []; for (let d = parse(from); key(d) <= to; d = addDays(d, 1)) out.push(key(d)); return out; };
  const weekKeys = (k) => { const s = weekStart(parse(k)); return [0, 1, 2, 3, 4, 5, 6].map((i) => key(addDays(s, i))); };
  const dateFromTs = (ts) => { const d = new Date(ts); return Number.isFinite(d.getTime()) ? key(d) : null; };

  const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const longLabel = (d) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  MG.dates = { setClock, now, pad, key, parse, isKey, today, todayKey, addDays, addKey, weekStart, weekStartKey, diffDays, diffKeys, cmp, monthKey, dayKeysBetween, weekKeys, dateFromTs, WEEKDAYS_SHORT, WEEKDAYS_LONG, longLabel };
  if (typeof module !== 'undefined') module.exports = MG.dates;
})(typeof globalThis !== 'undefined' ? globalThis : window);
