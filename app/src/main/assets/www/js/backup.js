/* MyGoals — exportação e importação de backups.
 *
 * Garantias:
 *  - Importar é uma operação em duas fases: (1) ANALISAR/validar sem tocar no estado atual;
 *    (2) APLICAR somente após confirmação, depois de gravar uma cópia de segurança do estado atual.
 *  - Se qualquer fase falhar, o estado atual permanece intacto.
 *  - Aceita o backup novo (envelope v3) e o formato antigo (o JSON cru da v2).
 */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const S = MG.schema;

  const APP_ID = 'MyGoals';
  const MAX_BYTES = 12 * 1024 * 1024; // 12 MB de texto: acima disso o WebView tende a falhar
  const toJson = (state) => JSON.stringify({ app: APP_ID, schemaVersion: S.SCHEMA_VERSION, exportedAt: new Date(MG.dates.now()).toISOString(), data: state }, null, 1);
  const fileName = () => 'mygoals-backup-' + MG.dates.todayKey() + '.json';

  function summarize(state) {
    return { goals: state.goals.length, tasks: state.tasks.length, notes: state.notes.length, xp: MG.gamification.totalXp(state.game), level: MG.gamification.levelOf(MG.gamification.totalXp(state.game)), logs: Object.values(state.e).reduce((a, m) => a + Object.keys(m).length, 0) };
  }

  /** Fase 1: valida o texto. Nunca lança e nunca altera nada. */
  function analyze(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['Nenhum conteúdo para importar.'], warnings: [] };
    if (text.length > MAX_BYTES) return { ok: false, errors: ['O arquivo é grande demais (limite de 12 MB).'], warnings: [] };
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: ['O conteúdo não é um JSON válido.'], warnings: [] }; }
    const payload = parsed && parsed.app === APP_ID && parsed.data !== undefined ? parsed.data : parsed;
    const n = S.normalize(payload);
    if (!n.ok) return { ok: false, errors: n.errors, warnings: n.warnings };
    return { ok: true, state: n.state, warnings: n.warnings, migratedFrom: n.migratedFrom, summary: summarize(n.state), errors: [] };
  }

  /**
   * Fase 2: grava a cópia de segurança e substitui o estado. `storage`/`adapter` injetados.
   * Devolve { ok, state } ou { ok:false, error }. Se falhar, `current` não é modificado.
   */
  function apply(adapter, current, analysis) {
    if (!analysis || !analysis.ok) return { ok: false, error: 'Backup inválido.' };
    const snap = MG.storage.snapshot(adapter, current);
    if (!snap.ok) return { ok: false, error: 'Não foi possível criar a cópia de segurança dos dados atuais. ' + (MG.storage.ERROR_TEXT[snap.error] || '') };
    const saved = MG.storage.save(adapter, analysis.state);
    if (!saved.ok) {
      MG.storage.save(adapter, current); // tenta manter o que havia
      return { ok: false, error: MG.storage.ERROR_TEXT[saved.error] || 'Falha ao salvar.' };
    }
    return { ok: true, state: analysis.state };
  }

  MG.backup = { APP_ID, MAX_BYTES, toJson, fileName, analyze, apply, summarize };
  if (typeof module !== 'undefined') module.exports = MG.backup;
})(typeof globalThis !== 'undefined' ? globalThis : window);
