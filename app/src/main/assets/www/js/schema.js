/* MyGoals — modelo de dados, validação e migrações.
 *
 * Formato atual: schemaVersion 3. Chaves curtas herdadas da v2 foram mantidas de propósito
 * (p, goals, e, tasks, notes, game) para facilitar a migração e a leitura de backups antigos.
 *
 *  state = {
 *    schemaVersion: 3,
 *    p:      { name, photo },                       perfil
 *    goals:  [{ id, name, emoji, color, type:'check'|'daily'|'weekly', target, unit, start, targets:[{from,target}] }]
 *    e:      { [goalId]: { 'AAAA-MM-DD': quantidade } }   registros dos hábitos
 *    tasks:  [{ id, t, emoji, date, time, done, doneAt, prio:0|1 }]
 *    notes:  [{ id, t, b, c, tags, pin, ts }]
 *    game:   { ledger:[entrada], unlocked:{id:ts}, missionClaims:{id:ts}, legacyActiveDays:{data:true}, bestStreak }
 *    prefs:  { theme:'auto'|'light'|'dark' }
 *    meta:   { createdAt, migratedFrom }
 *  }
 *
 * Entrada do livro-razão de XP (game.ledger), imutável após gravada:
 *  { id, key, kind:'award'|'reversal'|'opening', src, amount, label, date, at, ref? }
 */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const { isObj, isId, uid } = MG.util;
  const D = MG.dates;

  const SCHEMA_VERSION = 3;
  const COLORS = ['#0A84FF', '#FF9F0A', '#FF375F', '#30D158', '#BF5AF2', '#64D2FF'];
  const TYPES = ['check', 'daily', 'weekly'];
  const SRCS = ['habit', 'task', 'note', 'mission', 'achievement', 'bonus', 'legacy'];
  const KINDS = ['award', 'reversal', 'opening'];
  const LIMITS = { goals: 300, tasks: 20000, notes: 10000, ledger: 200000, photo: 400000, noteBody: 100000, tags: 20 };
  const LEGACY_AMOUNTS = { goalday: 10, goalweek: 50, task: 15, note: 5 };
  const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
  const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v, lo, hi, dflt) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);

  function emptyGame() {
    return { ledger: [], unlocked: {}, missionClaims: {}, legacyActiveDays: {}, bestStreak: 0 };
  }
  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, p: { name: '', photo: '' }, goals: [], e: {}, tasks: [], notes: [], game: emptyGame(), prefs: { theme: 'auto' }, meta: { createdAt: Date.now(), migratedFrom: null } };
  }

  /** Mantém só itens com id válido e único. Devolve a lista limpa e quantos foram descartados. */
  function cleanList(list, max, build, label, warnings) {
    const out = [], seen = new Set();
    let dropped = 0;
    (Array.isArray(list) ? list : []).slice(0, max).forEach((raw) => {
      const item = isObj(raw) && isId(raw.id) && !seen.has(raw.id) ? build(raw) : null;
      if (item) { seen.add(item.id); out.push(item); } else dropped++;
    });
    if (Array.isArray(list) && list.length > max) dropped += list.length - max;
    if (dropped) warnings.push(dropped + ' ' + label + ' inválido(s) foram ignorados.');
    return out;
  }

  function buildGoal(r) {
    const type = TYPES.includes(r.type) ? r.type : null;
    const name = str(r.name, 80).trim();
    const start = D.isKey(r.start) ? r.start : null;
    if (!type || !name || !start) return null;
    const target = type === 'check' ? 1 : Math.round(num(r.target, 1, 1e7, 1));
    let targets = Array.isArray(r.targets) ? r.targets.filter((t) => isObj(t) && D.isKey(t.from) && typeof t.target === 'number' && t.target >= 1).map((t) => ({ from: t.from, target: Math.round(Math.min(1e7, t.target)) })) : [];
    targets.sort((a, b) => D.cmp(a.from, b.from));
    if (!targets.length) targets = [{ from: start, target }];
    else if (type !== 'check') { /* mantém histórico; o alvo atual é o último */ }
    return { id: r.id, name, emoji: str(r.emoji, 8), color: COLOR_RE.test(r.color) ? r.color : COLORS[0], type, target: type === 'check' ? 1 : targets[targets.length - 1].target, unit: str(r.unit, 20), start, targets: type === 'check' ? [{ from: start, target: 1 }] : targets };
  }
  function buildTask(r) {
    const t = str(r.t, 200).trim();
    if (!t || !D.isKey(r.date)) return null;
    const done = r.done === true;
    return { id: r.id, t, emoji: str(r.emoji, 8), date: r.date, time: TIME_RE.test(r.time) ? r.time : '', done, doneAt: done ? (D.isKey(r.doneAt) ? r.doneAt : r.date) : null, prio: r.prio === 1 ? 1 : 0 };
  }
  function buildNote(r) {
    const tags = (Array.isArray(r.tags) ? r.tags : []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 30)).slice(0, LIMITS.tags);
    const ts = num(r.ts, 0, 8.64e15, Date.now());
    return { id: r.id, t: str(r.t, 200), b: str(r.b, LIMITS.noteBody), c: Math.round(num(r.c, 0, 7, 0)), tags: [...new Set(tags)], pin: r.pin === true, ts };
  }
  function buildLedgerEntry(r) {
    if (!KINDS.includes(r.kind) || !SRCS.includes(r.src) || typeof r.key !== 'string' || !r.key || r.key.length > 160) return null;
    if (typeof r.amount !== 'number' || !Number.isFinite(r.amount) || Math.abs(r.amount) > 1e6) return null;
    const e = { id: r.id, key: r.key, kind: r.kind, src: r.src, amount: Math.round(r.amount), label: str(r.label, 200), date: D.isKey(r.date) ? r.date : null, at: num(r.at, 0, 8.64e15, 0) };
    if (typeof r.ref === 'string') e.ref = r.ref.slice(0, 80);
    if (r.retro === true) e.retro = true;
    return e;
  }

  const srcFromKey = (k) => ({ goalday: 'habit', goalweek: 'habit', task: 'task', note: 'note', mission: 'mission', achievement: 'achievement', 'daily-bonus': 'bonus', comeback: 'bonus' }[k.split(':')[0]] || 'legacy');

  /** Chaves de recompensa que a v2 reconhecia como "já recebidas" a partir dos dados existentes. */
  function deriveLegacyKeys(s) {
    const keys = {};
    s.tasks.filter((t) => t.done).forEach((t) => { keys['task:' + t.id] = true; });
    s.notes.forEach((n) => { keys['note:' + n.id] = true; });
    const today = D.todayKey();
    s.goals.forEach((gl) => {
      const val = (k) => (s.e[gl.id] && s.e[gl.id][k]) || 0;
      if (gl.type === 'weekly') {
        for (let w = D.weekStartKey(gl.start); w <= today; w = D.addKey(w, 7)) {
          if (D.weekKeys(w).reduce((a, k) => a + val(k), 0) >= gl.target) keys['goalweek:' + gl.id + ':' + w] = true;
        }
      } else {
        D.dayKeysBetween(gl.start, today).forEach((k) => { if (val(k) >= gl.target) keys['goalday:' + gl.id + ':' + k] = true; });
      }
    });
    return keys;
  }

  /** Converte o estado de gamificação da v2 em livro-razão, preservando o XP total exatamente. */
  function migrateLegacyGame(rawGame, s, warnings) {
    const game = emptyGame();
    const lg = isObj(rawGame) ? rawGame : null;
    const awards = lg && Array.isArray(lg.awards) ? lg.awards : [];
    const migratedAt = Date.now();
    const awardedKeys = new Set();
    let sumAwards = 0;
    awards.forEach((a, i) => {
      if (!isObj(a) || typeof a.key !== 'string' || typeof a.amount !== 'number' || !Number.isFinite(a.amount)) return;
      awardedKeys.add(a.key);
      sumAwards += Math.round(a.amount);
      game.ledger.push({ id: 'mig-a' + i, key: a.key.slice(0, 160), kind: 'award', src: srcFromKey(a.key), amount: Math.round(a.amount), label: str(a.label, 200), date: D.dateFromTs(a.at), at: num(a.at, 0, 8.64e15, migratedAt) });
    });
    const claimed = lg && isObj(lg.claimedKeys) ? lg.claimedKeys : deriveLegacyKeys(s);
    const taskById = new Map(s.tasks.map((t) => [t.id, t])), noteById = new Map(s.notes.map((n) => [n.id, n]));
    let sumConverted = 0, n = 0;
    Object.keys(claimed).forEach((k) => {
      if (!claimed[k] || awardedKeys.has(k) || k.length > 160) return;
      const [prefix, a, b] = k.split(':');
      const amount = LEGACY_AMOUNTS[prefix];
      if (!amount) return; // chaves de bônus/missão/conquista sem registro de valor não carregavam XP
      let date = null;
      if (prefix === 'goalday' || prefix === 'goalweek') date = D.isKey(b) ? b : null;
      else if (prefix === 'task' && taskById.has(a)) date = taskById.get(a).doneAt || taskById.get(a).date;
      else if (prefix === 'note' && noteById.has(a)) date = D.dateFromTs(noteById.get(a).ts);
      sumConverted += amount;
      game.ledger.push({ id: 'mig-k' + n++, key: k, kind: 'award', src: srcFromKey(k), amount, label: 'Recompensa anterior à versão 3', date, at: migratedAt });
    });
    const baseXp = lg && Number.isFinite(+lg.baseXp) ? Math.round(+lg.baseXp) : null;
    // Opening = resíduo que faz o total continuar idêntico ao que o usuário via na v2.
    const opening = baseXp === null ? 0 : baseXp - sumConverted;
    if (opening !== 0) game.ledger.unshift({ id: 'mig-open', key: 'opening', kind: 'opening', src: 'legacy', amount: opening, label: 'Saldo inicial migrado da versão anterior', date: null, at: migratedAt });
    if (lg) {
      Object.keys(isObj(lg.unlocked) ? lg.unlocked : {}).forEach((id) => { if (lg.unlocked[id] && /^[a-z0-9_]{1,40}$/.test(id)) game.unlocked[id] = num(+lg.unlocked[id], 1, 8.64e15, migratedAt); });
      Object.keys(isObj(lg.missionClaims) ? lg.missionClaims : {}).forEach((id) => { if (lg.missionClaims[id] && /^[dw]_[a-z]+_\d{4}-\d{2}-\d{2}$/.test(id)) game.missionClaims[id] = num(+lg.missionClaims[id], 1, 8.64e15, migratedAt); });
      Object.keys(isObj(lg.activeDays) ? lg.activeDays : {}).forEach((k) => { if (lg.activeDays[k] && D.isKey(k)) game.legacyActiveDays[k] = true; });
    }
    if (baseXp === null && !awards.length && !Object.keys(claimed).length && lg) warnings.push('Dados de gamificação antigos não puderam ser interpretados; o XP recomeça do zero.');
    return game;
  }

  function normalizeGame(rawGame, s, warnings) {
    if (!isObj(rawGame) || !Array.isArray(rawGame.ledger)) return null;
    const game = emptyGame();
    game.ledger = cleanList(rawGame.ledger, LIMITS.ledger, buildLedgerEntry, 'lançamentos de XP', warnings);
    Object.keys(isObj(rawGame.unlocked) ? rawGame.unlocked : {}).forEach((id) => { if (rawGame.unlocked[id] && /^[a-z0-9_]{1,40}$/.test(id)) game.unlocked[id] = num(+rawGame.unlocked[id], 1, 8.64e15, Date.now()); });
    Object.keys(isObj(rawGame.missionClaims) ? rawGame.missionClaims : {}).forEach((id) => { if (rawGame.missionClaims[id] && /^[dw]_[a-z]+_\d{4}-\d{2}-\d{2}$/.test(id)) game.missionClaims[id] = num(+rawGame.missionClaims[id], 1, 8.64e15, Date.now()); });
    Object.keys(isObj(rawGame.legacyActiveDays) ? rawGame.legacyActiveDays : {}).forEach((k) => { if (rawGame.legacyActiveDays[k] && D.isKey(k)) game.legacyActiveDays[k] = true; });
    game.bestStreak = Math.round(num(rawGame.bestStreak, 0, 100000, 0));
    return game;
  }

  /**
   * Valida e normaliza qualquer estado (v2 antigo, v3 ou backup importado).
   * NUNCA lança e NUNCA altera o argumento. Em caso de erro estrutural devolve ok:false e state:null.
   */
  function normalize(raw) {
    const errors = [], warnings = [];
    const fail = (m) => ({ ok: false, state: null, errors: [m], warnings, migratedFrom: null });
    if (!isObj(raw)) return fail('O conteúdo não é um backup do MyGoals.');
    const version = raw.schemaVersion === undefined ? 2 : raw.schemaVersion;
    if (!Number.isInteger(version) || version < 2) return fail('Versão de dados desconhecida.');
    if (version > SCHEMA_VERSION) return fail('Este backup foi criado por uma versão mais nova do MyGoals (formato ' + version + '). Atualize o aplicativo para importá-lo.');
    if (!Array.isArray(raw.goals) || !isObj(raw.e)) return fail('O arquivo não contém hábitos e registros no formato esperado.');

    const s = emptyState();
    s.meta = { createdAt: num(isObj(raw.meta) ? raw.meta.createdAt : NaN, 0, 8.64e15, Date.now()), migratedFrom: version < SCHEMA_VERSION ? version : (isObj(raw.meta) && Number.isInteger(raw.meta.migratedFrom) ? raw.meta.migratedFrom : null) };
    const p = isObj(raw.p) ? raw.p : {};
    s.p = { name: str(p.name, 40), photo: typeof p.photo === 'string' && p.photo.length <= LIMITS.photo && PHOTO_RE.test(p.photo) ? p.photo : '' };
    if (typeof p.photo === 'string' && p.photo && !s.p.photo) warnings.push('A foto de perfil era inválida ou grande demais e foi ignorada.');
    s.goals = cleanList(raw.goals, LIMITS.goals, buildGoal, 'hábito(s)', warnings);
    const ids = new Set(s.goals.map((x) => x.id));
    let badEntries = 0;
    ids.forEach((id) => {
      const src = isObj(raw.e[id]) ? raw.e[id] : {};
      const out = {};
      Object.keys(src).forEach((k) => {
        if (D.isKey(k) && typeof src[k] === 'number' && Number.isFinite(src[k]) && src[k] >= 0 && src[k] <= 1e7) { if (src[k] > 0) out[k] = src[k]; } else badEntries++;
      });
      s.e[id] = out;
    });
    if (badEntries) warnings.push(badEntries + ' registro(s) de hábito inválido(s) foram ignorados.');
    s.tasks = cleanList(raw.tasks, LIMITS.tasks, buildTask, 'tarefa(s)', warnings);
    s.notes = cleanList(raw.notes, LIMITS.notes, buildNote, 'nota(s)', warnings);
    s.prefs = { theme: isObj(raw.prefs) && ['auto', 'light', 'dark'].includes(raw.prefs.theme) ? raw.prefs.theme : 'auto' };
    const game = version >= 3 ? normalizeGame(raw.game, s, warnings) : null;
    s.game = game || migrateLegacyGame(raw.game, s, warnings);
    return { ok: true, state: s, errors, warnings, migratedFrom: version < SCHEMA_VERSION ? version : null };
  }

  MG.schema = { SCHEMA_VERSION, COLORS, LIMITS, LEGACY_AMOUNTS, PHOTO_RE, TIME_RE, emptyState, emptyGame, normalize, deriveLegacyKeys };
  if (typeof module !== 'undefined') module.exports = MG.schema;
})(typeof globalThis !== 'undefined' ? globalThis : window);
