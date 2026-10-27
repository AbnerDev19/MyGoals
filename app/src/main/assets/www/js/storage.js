/* MyGoals — persistência local (localStorage do WebView).
 *
 * Chaves:
 *  mygoals-v2            dados da versão anterior. NUNCA é apagada nem alterada pela migração
 *                        (serve de rede de segurança caso algo dê errado na v3).
 *  mygoals-v3            dados atuais.
 *  mygoals-v3-snapshot   cópia do estado imediatamente antes de operações destrutivas
 *                        (importar, carregar exemplo, começar do zero). Guarda 1 nível.
 *  mygoals-v3-corrupt    cópia do texto bruto de um registro que não pôde ser lido (para suporte).
 *
 * Limitações conhecidas: o limite de armazenamento do WebView é de alguns MB e a foto de perfil
 * (até ~400 KB) ocupa parte dele; os dados não são sincronizados entre aparelhos (use o backup).
 */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const S = MG.schema;

  const KEYS = { v3: 'mygoals-v3', v2: 'mygoals-v2', snapshot: 'mygoals-v3-snapshot', corrupt: 'mygoals-v3-corrupt' };

  function browserAdapter() {
    try { const ls = g.localStorage; ls.getItem('__t'); return ls; } catch (e) { return null; }
  }
  /** Adaptador em memória para testes ou quando o armazenamento está indisponível. */
  function memoryAdapter(initial) {
    const m = Object.assign({}, initial || {});
    return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _dump: () => m };
  }
  const isQuota = (e) => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message)));

  function read(adapter, key) {
    try { return { ok: true, value: adapter.getItem(key) }; } catch (e) { return { ok: false, error: e }; }
  }

  /**
   * Carrega o estado. Sempre devolve um estado utilizável e descreve o que aconteceu em `status`:
   * 'fresh' | 'loaded' | 'migrated' | 'recovered' | 'unavailable'.
   */
  function load(adapter) {
    if (!adapter) return { state: S.emptyState(), status: 'unavailable', warnings: [], message: 'O armazenamento do aparelho não está disponível. Nada será salvo.' };
    const r3 = read(adapter, KEYS.v3);
    if (r3.ok && r3.value) {
      let parsed = null;
      try { parsed = JSON.parse(r3.value); } catch (e) { parsed = null; }
      const n = parsed ? S.normalize(parsed) : { ok: false };
      if (n.ok) return { state: n.state, status: 'loaded', warnings: n.warnings };
      // Registro corrompido: guarda o bruto, tenta a cópia de segurança e depois a v2.
      try { adapter.setItem(KEYS.corrupt, r3.value); } catch (e) { /* sem espaço: segue */ }
      const snap = readSnapshot(adapter);
      if (snap) return { state: snap, status: 'recovered', warnings: [], message: 'Os dados principais estavam ilegíveis. Restauramos a última cópia de segurança automática.' };
    }
    const r2 = read(adapter, KEYS.v2);
    if (r2.ok && r2.value) {
      let parsed = null;
      try { parsed = JSON.parse(r2.value); } catch (e) { parsed = null; }
      const n = parsed ? S.normalize(parsed) : { ok: false };
      if (n.ok) return { state: n.state, status: 'migrated', warnings: n.warnings, migratedFrom: 2 };
    }
    if (r3.ok && r3.value) return { state: S.emptyState(), status: 'recovered', warnings: [], message: 'Não foi possível ler seus dados salvos. Eles foram preservados em uma cópia interna; importe um backup, se tiver.' };
    return { state: S.emptyState(), status: 'fresh', warnings: [] };
  }

  /** Grava o estado. Nunca lança; devolve {ok} ou {ok:false, error:'quota'|'unavailable'|'serialize'}. */
  function save(adapter, state) {
    if (!adapter) return { ok: false, error: 'unavailable' };
    let text;
    try { text = JSON.stringify(state); } catch (e) { return { ok: false, error: 'serialize' }; }
    try { adapter.setItem(KEYS.v3, text); return { ok: true, bytes: text.length }; } catch (e) { return { ok: false, error: isQuota(e) ? 'quota' : 'unavailable' }; }
  }

  /** Guarda uma cópia do estado ATUAL antes de uma operação destrutiva. */
  function snapshot(adapter, state) {
    if (!adapter) return { ok: false, error: 'unavailable' };
    try { adapter.setItem(KEYS.snapshot, JSON.stringify(state)); return { ok: true }; } catch (e) { return { ok: false, error: isQuota(e) ? 'quota' : 'unavailable' }; }
  }
  function readSnapshot(adapter) {
    const r = read(adapter, KEYS.snapshot);
    if (!r.ok || !r.value) return null;
    try { const n = S.normalize(JSON.parse(r.value)); return n.ok ? n.state : null; } catch (e) { return null; }
  }
  const hasSnapshot = (adapter) => !!(adapter && readSnapshot(adapter));

  const ERROR_TEXT = {
    quota: 'Sem espaço de armazenamento. Exporte um backup e remova itens ou a foto de perfil.',
    unavailable: 'O armazenamento do aparelho não respondeu. Suas últimas alterações podem não ter sido salvas.',
    serialize: 'Não foi possível converter os dados para salvar.'
  };

  MG.storage = { KEYS, browserAdapter, memoryAdapter, load, save, snapshot, readSnapshot, hasSnapshot, ERROR_TEXT };
  if (typeof module !== 'undefined') module.exports = MG.storage;
})(typeof globalThis !== 'undefined' ? globalThis : window);
