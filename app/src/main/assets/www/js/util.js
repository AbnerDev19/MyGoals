/* MyGoals — utilitários gerais. Sem dependências. Funciona no WebView e no Node (testes). */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const fmt = (n) => Number(n).toLocaleString('pt-BR');
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

  let counter = 0;
  /** Id único e estável: prefixo + tempo + contador + sufixo aleatório. */
  function uid(prefix) {
    counter = (counter + 1) % 1e6;
    return (prefix || 'x') + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const isId = (s) => typeof s === 'string' && ID_RE.test(s);

  MG.util = { esc, fmt, clamp, clone, isObj, uid, isId };
  if (typeof module !== 'undefined') module.exports = MG.util;
})(typeof globalThis !== 'undefined' ? globalThis : window);
