/* MyGoals — camadas sobre a tela: folhas inferiores (menu, formulários, confirmações, importação)
 * e telas cheias (detalhe do hábito, editor de nota). Só geram HTML a partir de `ov`. */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  const D = MG.dates, H = MG.habits, V = MG.views;
  const { esc, fmt } = MG.util;
  const I = MG.icons.icon;

  const sheet = (id, title, body, extra) => '<div class="scrim" data-a="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t"' + (extra || '') + '><div class="grab" aria-hidden="true"></div><h2 id="dlg-t">' + title + '</h2>' + body + '</div></div>';
  const errBox = (e) => (e ? '<p class="err" role="alert" id="f-err">' + I('alert') + esc(e) + '</p>' : '<p class="err" role="alert" id="f-err" hidden></p>');

  function menu() {
    return sheet('menu', 'Adicionar',
      '<button class="choice" data-a="hnew">' + I('repeat') + '<div><b>Hábito</b><span>Algo que você quer repetir: todo dia ou toda semana</span></div></button>' +
      '<button class="choice" data-a="tnew">' + I('clipboard') + '<div><b>Tarefa</b><span>Algo pontual, com data e horário opcional</span></div></button>' +
      '<button class="choice" data-a="nnew">' + I('diary') + '<div><b>Nota</b><span>Uma ideia ou reflexão no diário</span></div></button>' +
      '<div class="actions"><button class="btn" data-a="close">Cancelar</button></div>');
  }

  function habitForm(c, ov) {
    const s = c.s, editing = ov.id ? s.goals.find((x) => x.id === ov.id) : null;
    const d = ov.draft;
    const sw = '<div class="swatches" role="group" aria-label="Cor do hábito">' + MG.schema.COLORS.map((col, i) => '<button type="button" style="--c:' + col + '" data-a="col" data-v="' + col + '" aria-pressed="' + (col === d.color) + '" aria-label="Cor ' + (i + 1) + '">' + I('check') + '</button>').join('') + '</div>';
    return sheet('habit', editing ? 'Editar hábito' : 'Novo hábito',
      '<div class="field"><label for="f-name">Nome</label><input id="f-name" maxlength="80" value="' + esc(d.name) + '" placeholder="Ex.: Beber água" autocomplete="off"></div>' +
      '<div class="field"><label for="f-emoji">Emoji (opcional)</label><input id="f-emoji" maxlength="8" value="' + esc(d.emoji) + '" autocomplete="off"></div>' +
      '<div class="field"><span class="lbl">Cor</span>' + sw + '</div>' +
      '<div class="field"><label for="f-type">Como acompanhar</label><select id="f-type"' + (editing ? ' disabled' : '') + '><option value="check"' + (d.type === 'check' ? ' selected' : '') + '>Sim ou não, por dia</option><option value="daily"' + (d.type === 'daily' ? ' selected' : '') + '>Quantidade por dia</option><option value="weekly"' + (d.type === 'weekly' ? ' selected' : '') + '>Quantidade por semana</option></select>' + (editing ? '<span class="hint">O tipo não pode mudar depois de criado, para não alterar seu histórico.</span>' : '') + '</div>' +
      '<div id="qty"' + (d.type === 'check' ? ' hidden' : '') + '><div class="field"><label for="f-target">Meta</label><input id="f-target" type="number" inputmode="numeric" min="1" value="' + esc(d.target) + '">' + (editing ? '<span class="hint">A nova meta vale a partir de hoje; os dias anteriores continuam como estavam.</span>' : '') + '</div><div class="field"><label for="f-unit">Unidade</label><input id="f-unit" maxlength="20" value="' + esc(d.unit) + '" placeholder="Ex.: copos, páginas" autocomplete="off"></div></div>' +
      errBox(ov.error) + '<div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="hsave">Salvar</button></div>' +
      (editing ? '<div class="actions"><button class="btn danger" data-a="hdelask" data-id="' + esc(editing.id) + '">' + I('trash') + 'Excluir hábito</button></div>' : ''));
  }

  function taskForm(c, ov) {
    const d = ov.draft, editing = !!ov.id;
    return sheet('task', editing ? 'Editar tarefa' : 'Nova tarefa',
      '<div class="field"><label for="f-title">Título</label><input id="f-title" maxlength="200" value="' + esc(d.t) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="f-date">Data</label><input id="f-date" type="date" value="' + esc(d.date) + '"></div>' +
      '<div class="field"><label for="f-time">Horário (opcional)</label><input id="f-time" type="time" value="' + esc(d.time) + '"></div>' +
      '<div class="field"><label class="row-flex" style="gap:12px;min-height:44px;font-size:1rem;color:var(--tx)"><input id="f-prio" type="checkbox" style="width:24px;height:24px;min-height:0"' + (d.prio ? ' checked' : '') + '><span>' + I('flag') + ' Prioridade alta</span></label></div>' +
      errBox(ov.error) + '<div class="actions"><button class="btn" data-a="close">Cancelar</button><button class="btn primary" data-a="tsave">Salvar</button></div>' +
      (editing ? '<div class="actions"><button class="btn danger" data-a="tdelask" data-id="' + esc(ov.id) + '">' + I('trash') + 'Excluir tarefa</button></div>' : ''));
  }

  function confirm(c, ov) {
    return sheet('confirm', esc(ov.title), '<p style="margin:6px 0 14px">' + esc(ov.body) + '</p><div class="actions"><button class="btn" data-a="close" id="cf-cancel">Cancelar</button><button class="btn ' + (ov.danger ? 'danger solid' : 'primary') + '" data-a="yes">' + esc(ov.label) + '</button></div>', ' role="alertdialog"');
  }

  function importSheet(c, ov) {
    const a = ov.analysis;
    let body = '<p style="margin-bottom:12px">Escolha um arquivo de backup ou cole o conteúdo. Nada muda até você confirmar.</p><button class="btn block" data-a="pickfile">' + I('upload') + 'Escolher arquivo (.json)</button>' +
      '<div class="field" style="margin-top:12px"><label for="imp-text">Ou cole o backup aqui</label><textarea id="imp-text" rows="4" spellcheck="false">' + esc(ov.text || '') + '</textarea></div>' +
      (a && !a.ok ? '<div class="banner" role="alert">' + I('alert') + '<div><b>Backup recusado.</b> ' + a.errors.map(esc).join(' ') + '<br>Seus dados atuais não foram alterados.</div></div>' : '');
    if (a && a.ok) {
      const sm = a.summary;
      body += '<div class="preview"><b>Conteúdo do backup</b><div class="kv"><span>Hábitos</span><b>' + sm.goals + '</b></div><div class="kv"><span>Registros de hábitos</span><b>' + sm.logs + '</b></div><div class="kv"><span>Tarefas</span><b>' + sm.tasks + '</b></div><div class="kv"><span>Notas</span><b>' + sm.notes + '</b></div><div class="kv"><span>XP / nível</span><b>' + fmt(sm.xp) + ' / ' + sm.level + '</b></div>' +
        (a.migratedFrom ? '<p class="small">Formato antigo (v' + a.migratedFrom + ') será convertido sem perder XP.</p>' : '') + (a.warnings.length ? '<p class="small" style="color:var(--warn)">' + a.warnings.map(esc).join('<br>') + '</p>' : '') + '</div>' +
        '<p class="small">Importar <b>substitui</b> todos os dados atuais. Uma cópia dos dados atuais será guardada e poderá ser restaurada em Ajustes.</p>';
    }
    body += errBox(ov.error) + '<div class="actions"><button class="btn" data-a="close">Cancelar</button>' + (a && a.ok ? '<button class="btn danger solid" data-a="impapply">Substituir meus dados</button>' : '<button class="btn primary" data-a="impanalyze">Analisar backup</button>') + '</div>';
    return sheet('import', 'Importar backup', body);
  }

  function detail(c, ov) {
    const gl = c.s.goals.find((x) => x.id === ov.id);
    if (!gl) return '';
    const st = H.stats(c.s, gl, c.today), u = gl.type === 'weekly' ? 'sem.' : 'dias';
    const rule = gl.type === 'check' ? 'Sim ou não, por dia' : fmt(gl.target) + ' ' + esc(gl.unit) + (gl.type === 'weekly' ? ' por semana' : ' por dia');
    return '<div class="fullpage" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="page"><div class="topbar"><button class="icon-btn" data-a="close" aria-label="Voltar">' + I('chevron-left') + '</button><button class="btn sm" data-a="hedit" data-id="' + esc(gl.id) + '">' + I('edit') + 'Editar</button></div>' +
      '<div class="eyebrow">' + rule + '</div><h1 id="dlg-t" style="margin:4px 0 16px">' + (gl.emoji ? esc(gl.emoji) + ' ' : '') + esc(gl.name) + '</h1>' +
      '<div class="row-flex" style="gap:8px;margin-bottom:16px">' + [[st.current + ' ' + u, 'Sequência atual', 'flame'], [st.best + ' ' + u, 'Melhor sequência', 'trophy'], [st.pct + '%', 'Conclusão', 'target']].map((x) => '<div class="card flat grow" style="padding:12px;text-align:center"><div style="font-weight:800;font-size:1.125rem">' + x[0] + '</div><div class="small muted">' + x[1] + '</div></div>').join('') + '</div>' +
      '<h2 style="margin-bottom:6px">Ano atual</h2>' + V.heat(c, gl, 'ano') + '<p class="small muted" style="margin-top:8px">Início do hábito: ' + gl.start.split('-').reverse().join('/') + '.' + (gl.type === 'weekly' ? ' Em metas semanais, desmarcar remove só o registro do dia escolhido.' : '') + '</p></div></div>';
  }

  function noteEditor(c, ov) {
    const n = ov.note;
    return '<div class="fullpage editor" style="--nc:' + (n.c ? V.NOTE_COLORS[n.c] : 'transparent') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="page"><h2 id="dlg-t" class="sr">Editar nota</h2><div class="topbar"><button class="btn ghost" data-a="nsave">' + I('chevron-left') + 'Concluir</button><div class="row-flex"><button class="icon-btn" data-a="npin" aria-pressed="' + !!n.pin + '" aria-label="' + (n.pin ? 'Desafixar nota' : 'Fixar nota') + '">' + I('pin') + (n.pin ? '<span class="sr">Fixada</span>' : '') + '</button><button class="icon-btn" data-a="ndelask" aria-label="Excluir nota">' + I('trash') + '</button></div></div>' +
      '<label class="sr" for="nt">Título</label><input id="nt" class="title-in" placeholder="Título" maxlength="200" value="' + esc(n.t) + '"><label class="sr" for="nb">Texto da nota</label><textarea id="nb" class="body-in" placeholder="Escreva uma nota…">' + esc(n.b) + '</textarea>' +
      '<div class="field" style="margin-top:12px"><span class="lbl">Cor</span><div class="swatches" role="group" aria-label="Cor da nota">' + V.NOTE_COLORS.map((col, i) => '<button type="button" data-a="ncol" data-v="' + i + '" style="--c:' + (col || 'var(--sf)') + '" aria-pressed="' + (n.c === i) + '" aria-label="' + V.NOTE_COLOR_NAMES[i] + '">' + I('check') + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="ntg">Etiquetas (separadas por vírgula)</label><input id="ntg" value="' + esc(n.tags.join(', ')) + '" autocomplete="off"></div></div></div>';
  }

  function render(c) {
    const ov = c.ui.ov;
    if (!ov) return '';
    return { menu, habit: habitForm, task: taskForm, confirm, import: importSheet, det: detail, note: noteEditor }[ov.k](c, ov) || '';
  }
  MG.sheets = { render };
  if (typeof module !== 'undefined') module.exports = MG.sheets;
})(typeof globalThis !== 'undefined' ? globalThis : window);
