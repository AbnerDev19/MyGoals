/* MyGoals — aplicação: estado, renderização, eventos e integração com o Android.
 * A lógica de negócio está nos outros módulos; aqui só orquestramos a interface. */
(function (g) {
  'use strict';
  const MG = (g.MG = g.MG || {});
  MG.VERSION = '3.0.0';
  const D = MG.dates, ST = MG.storage, A = MG.actions, B = MG.backup, G = MG.gamification, V = MG.views, SH = MG.sheets;
  const { esc } = MG.util;
  const I = MG.icons.icon;
  const $ = (id) => document.getElementById(id);

  const adapter = ST.browserAdapter();
  const loaded = ST.load(adapter);
  let S = loaded.state;
  const ui = { tab: 'hoje', sel: D.todayKey(), asel: D.todayKey(), awk: D.weekStartKey(D.todayKey()), aview: g.innerWidth < 600 ? 'dia' : 'semana', jtab: 'miss', achf: 'all', histN: 30, rg: 'ano', q: '', tg: '', ov: null, day: D.todayKey(), banners: [] };
  let lastFocus = null, toastTimer = null, nameTimer = null, saveFailed = false;

  const ctx = () => ({ s: S, ui, today: D.todayKey(), now: D.now() });
  const TABS = [['hoje', 'Hoje', 'today'], ['prog', 'Jornada', 'journey'], ['agenda', 'Agenda', 'agenda'], ['dia', 'Diário', 'diary'], ['aju', 'Ajustes', 'settings']];

  /* ---------- tema e barras do sistema ---------- */
  function applyTheme() {
    const t = S.prefs.theme, root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    const dark = t === 'dark' || (t === 'auto' && g.matchMedia && g.matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#11111a' : '#f6f6fb');
    try { if (g.AndroidBridge && g.AndroidBridge.setSystemBars) g.AndroidBridge.setSystemBars(dark); } catch (e) { /* fora do app Android */ }
  }

  /* ---------- avisos ---------- */
  function toast(msg, ms) {
    if (!msg) return;
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }
  function banner(id, kind, text, dismissible) {
    ui.banners = ui.banners.filter((b) => b.id !== id);
    if (text) ui.banners.push({ id, kind, text, dismissible: dismissible !== false });
  }
  const bannersHtml = () => ui.banners.map((b) => '<div class="banner' + (b.kind === 'info' ? ' info' : '') + '" role="' + (b.kind === 'info' ? 'status' : 'alert') + '">' + I(b.kind === 'info' ? 'info' : 'alert') + '<div class="grow">' + esc(b.text) + (b.id === 'save' ? '<br><button class="btn sm" data-a="retrysave">Tentar salvar de novo</button> <button class="btn sm" data-a="export">Exportar backup</button>' : '') + '</div>' + (b.dismissible ? '<button class="icon-btn" style="width:36px;height:36px" data-a="dismiss" data-id="' + b.id + '" aria-label="Fechar aviso">' + I('x') + '</button>' : '') + '</div>').join('');

  /* ---------- persistência ---------- */
  function persist() {
    const r = ST.save(adapter, S);
    if (!r.ok) { saveFailed = true; banner('save', 'error', 'Não foi possível salvar suas alterações. ' + (ST.ERROR_TEXT[r.error] || ''), false); }
    else if (saveFailed) { saveFailed = false; banner('save', 'error', null); }
    return r.ok;
  }

  /* ---------- renderização ---------- */
  function render() {
    const c = ctx();
    const page = { hoje: V.hoje, prog: V.prog, agenda: V.agenda, dia: V.dia, aju: V.aju }[ui.tab](c);
    const focus = captureFocus();
    $('app').innerHTML = '<div class="page">' + bannersHtml() + page + '</div>';
    $('nv').innerHTML = '<div class="bar-in" role="group" aria-label="Navegação principal">' + TABS.map((t) => '<button data-a="tab" data-v="' + t[0] + '"' + (ui.tab === t[0] ? ' aria-current="page"' : '') + '>' + I(t[2]) + '<span>' + t[1] + '</span></button>').join('') + '</div>';
    const fab = ui.tab === 'hoje' || ui.tab === 'agenda' ? '<button class="fab" data-a="menu" aria-label="Adicionar hábito, tarefa ou nota">' + I('plus') + '<span>Novo</span></button>' : ui.tab === 'dia' ? '<button class="fab" data-a="nnew" aria-label="Nova nota">' + I('plus') + '<span>Nota</span></button>' : '';
    $('fabbox').innerHTML = fab;
    renderOverlay(c);
    restoreFocus(focus);
  }
  function renderOverlay(c) {
    const box = $('overlay'), open = !!ui.ov;
    const had = box.innerHTML !== '';
    box.innerHTML = open ? SH.render(c) : '';
    ['app', 'nv', 'fabbox'].forEach((id) => { const el = $(id); if (open) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); } else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); } });
    if (open && !had) {
      const first = box.querySelector('#cf-cancel, input:not([type=hidden]):not([disabled]), textarea, button.btn.primary, button');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    }
    if (!open && had && lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* elemento removido */ } }
  }
  function refocus(a, v) { const el = $('overlay').querySelector('[data-a="' + a + '"]' + (v != null ? '[data-v="' + v + '"]' : '')); if (el) el.focus({ preventScroll: true }); }
  const captureFocus = () => { const el = document.activeElement; return el && el.dataset && el.dataset.a && $('app').contains(el) ? { a: el.dataset.a, id: el.dataset.id, d: el.dataset.d, v: el.dataset.v } : null; };
  function restoreFocus(f) {
    if (!f) return;
    const sel = '[data-a="' + f.a + '"]' + (f.id ? '[data-id="' + CSS.escape(f.id) + '"]' : '') + (f.d ? '[data-d="' + f.d + '"]' : '') + (f.v != null ? '[data-v="' + CSS.escape(f.v) + '"]' : '');
    const el = $('app').querySelector(sel) || $('nv').querySelector(sel);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
  function openOv(ov) { lastFocus = lastFocus && ui.ov ? lastFocus : document.activeElement; ui.ov = ov; render(); }
  /** Fecha a camada atual; se for uma confirmação aberta sobre outra camada, volta para ela (sem perder o que foi digitado). */
  function closeOv() { ui.ov = ui.ov && ui.ov.k === 'confirm' && ui.ov.back ? ui.ov.back : null; render(); }

  /* ---------- mutações ---------- */
  function mutate(fn, after) {
    const r = fn();
    if (r && r.ok === false) { if (r.error) toast(r.error, 4000); return r; }
    persist();
    toast(A.describe(r));
    if (r && r.achievements && r.achievements.length) setTimeout(() => toast('Conquista desbloqueada: ' + r.achievements.map((a) => a.title).join(', '), 3200), 1400);
    if (after) after(r);
    render();
    return r;
  }
  function replaceState(next) { S = next; applyTheme(); ui.ov = null; ui.q = ''; ui.tg = ''; }

  function openConfirm(o) { openOv(Object.assign({ k: 'confirm', danger: true, label: 'Confirmar', back: ui.ov && ui.ov.k !== 'confirm' ? ui.ov : null }, o)); }
  const CONFIRM = {
    delHabit(id) { mutate(() => A.deleteHabit(S, id), () => { ui.ov = null; lastFocus = null; }); toast('Hábito excluído'); },
    delTask(id) { mutate(() => A.deleteTask(S, id), () => { ui.ov = null; }); toast('Tarefa excluída'); },
    delNote(id) { mutate(() => A.deleteNote(S, id), () => { ui.ov = null; }); toast('Nota excluída'); },
    clear() {
      const snap = ST.snapshot(adapter, S);
      if (!snap.ok) { toast('Não foi possível guardar a cópia de segurança. Exporte um backup antes.', 5000); return; }
      const n = MG.schema.emptyState(); n.p = S.p; n.prefs = S.prefs;
      replaceState(n); persist(); render(); toast('Dados apagados. Você pode restaurar a cópia anterior em Ajustes.', 4500);
    },
    sample() {
      const snap = ST.snapshot(adapter, S);
      if (!snap.ok) { toast('Não foi possível guardar a cópia de segurança. Exporte um backup antes.', 5000); return; }
      const n = A.sampleState(D.todayKey()); n.p = S.p.name ? S.p : n.p; n.prefs = S.prefs;
      G.syncAchievements(n, D.todayKey());
      replaceState(n); persist(); render(); toast('Dados de exemplo carregados. Sua cópia anterior foi guardada.', 4500);
    },
    restore() {
      const old = ST.readSnapshot(adapter);
      if (!old) { toast('Não há cópia anterior.', 3000); return; }
      ST.snapshot(adapter, S); // permite desfazer a restauração
      replaceState(old); persist(); render(); toast('Cópia anterior restaurada.');
    }
  };

  /* ---------- backup ---------- */
  function exportFile() {
    const json = B.toJson(S), name = B.fileName();
    try {
      if (g.AndroidBridge && g.AndroidBridge.saveFile) { g.AndroidBridge.saveFile(name, json); return; }
    } catch (e) { /* tenta o método do navegador */ }
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Backup exportado.');
    } catch (e) { toast('Não foi possível exportar. Use "Copiar backup".', 4000); }
  }
  function copyBackup() {
    const json = B.toJson(S);
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = json; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); toast(ok ? 'Backup copiado.' : 'Não foi possível copiar. Use "Exportar para arquivo".', ok ? 2600 : 4500); };
    if (g.navigator.clipboard && g.navigator.clipboard.writeText) g.navigator.clipboard.writeText(json).then(() => toast('Backup copiado.'), fallback); else fallback();
  }
  function analyzeImport(text) {
    ui.ov.text = text; ui.ov.analysis = B.analyze(text); ui.ov.error = ''; render();
  }
  function readTextFile(file) {
    if (!file) return;
    if (file.size > B.MAX_BYTES) { ui.ov.analysis = { ok: false, errors: ['O arquivo é grande demais (limite de 12 MB).'], warnings: [] }; render(); return; }
    const fr = new FileReader();
    fr.onload = () => analyzeImport(String(fr.result || ''));
    fr.onerror = () => { ui.ov.analysis = { ok: false, errors: ['Não foi possível ler o arquivo.'], warnings: [] }; render(); };
    fr.readAsText(file);
  }

  /* ---------- foto de perfil ---------- */
  function handlePhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('Escolha um arquivo de imagem.', 3500); return; }
    if (file.size > 15 * 1024 * 1024) { toast('A imagem é grande demais (máximo 15 MB).', 3500); return; }
    const fr = new FileReader();
    fr.onerror = () => toast('Não foi possível ler a imagem.', 3500);
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => toast('Essa imagem não pôde ser aberta. Tente outra.', 4000);
      img.onload = () => {
        try {
          const size = 192, cv = document.createElement('canvas'); cv.width = cv.height = size;
          const sc = Math.max(size / img.width, size / img.height), w = img.width * sc, h = img.height * sc;
          cv.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          let url = '';
          for (const q of [0.82, 0.65, 0.5]) { url = cv.toDataURL('image/jpeg', q); if (url.length <= MG.schema.LIMITS.photo) break; }
          if (!MG.schema.PHOTO_RE.test(url) || url.length > MG.schema.LIMITS.photo) { toast('Não foi possível usar essa imagem.', 4000); return; }
          S.p.photo = url; if (persist()) toast('Foto atualizada.'); render();
        } catch (e) { toast('Não foi possível processar a imagem.', 4000); }
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  }

  /* ---------- formulários ---------- */
  const val = (id) => { const el = $(id); return el ? el.value : ''; };
  function showFormError(msg) {
    if (ui.ov) ui.ov.error = msg;
    const el = $('f-err');
    if (el) { el.hidden = false; el.innerHTML = I('alert') + esc(msg); const f = el.closest('.sheet') && el.closest('.sheet').querySelector('[aria-invalid="true"]'); if (f) f.focus(); }
  }
  function syncNote() {
    if (!ui.ov || ui.ov.k !== 'note') return;
    const n = ui.ov.note;
    if ($('nt')) n.t = $('nt').value;
    if ($('nb')) n.b = $('nb').value;
    if ($('ntg')) n.tags = $('ntg').value.split(',').map((x) => x.trim()).filter(Boolean);
  }
  function saveNoteAndClose() {
    syncNote();
    const r = A.saveNote(S, ui.ov.note);
    if (r.empty) { ui.ov = null; render(); return; }
    persist(); toast(A.describe(r)); ui.ov = null; render();
  }

  /* ---------- ações (delegação de eventos) ---------- */
  const ACTIONS = {
    tab(el) { ui.tab = el.dataset.v; ui.ov = null; render(); g.scrollTo(0, 0); },
    sel(el) { ui.sel = el.dataset.d; render(); },
    selwk(el) { ui.sel = D.addKey(ui.sel, +el.dataset.v); render(); },
    seltoday() { ui.sel = D.todayKey(); render(); },
    htog(el) { mutate(() => A.toggleHabit(S, el.dataset.id, el.dataset.d)); },
    hinc(el) { mutate(() => A.adjustHabit(S, el.dataset.id, el.dataset.d, 1)); },
    hdec(el) { mutate(() => A.adjustHabit(S, el.dataset.id, el.dataset.d, -1)); },
    ttog(el) { mutate(() => A.toggleTask(S, el.dataset.id)); },
    hdet(el) { openOv({ k: 'det', id: el.dataset.id }); },
    menu() { openOv({ k: 'menu' }); },
    hnew() { openOv({ k: 'habit', id: null, draft: { name: '', emoji: '', color: MG.schema.COLORS[0], type: 'check', target: 1, unit: '' } }); },
    hedit(el) { const gl = S.goals.find((x) => x.id === el.dataset.id); if (gl) { ui.ov = null; openOv({ k: 'habit', id: gl.id, draft: { name: gl.name, emoji: gl.emoji, color: gl.color, type: gl.type, target: gl.target, unit: gl.unit } }); } },
    col(el) { ui.ov.draft.color = el.dataset.v; el.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); },
    hsave() {
      const ov = ui.ov, d = { name: val('f-name'), emoji: val('f-emoji'), color: ov.draft.color, type: $('f-type').value, target: val('f-target') || 1, unit: val('f-unit') };
      ov.draft = d;
      const r = ov.id ? A.updateHabit(S, ov.id, d) : A.createHabit(S, d);
      if (r.ok === false) { if ($('f-name')) $('f-name').setAttribute('aria-invalid', 'true'); showFormError(r.error); return; }
      persist(); toast(ov.id ? 'Hábito atualizado.' : 'Hábito criado. ' + A.describe(r)); ui.ov = null; render();
    },
    hdelask(el) { const gl = S.goals.find((x) => x.id === el.dataset.id); openConfirm({ title: 'Excluir "' + (gl ? gl.name : 'hábito') + '"?', body: 'Os registros deste hábito serão apagados. O XP já ganho continua no seu histórico.', label: 'Excluir hábito', what: 'delHabit', arg: el.dataset.id }); },
    tnew() { openOv({ k: 'task', id: null, draft: { t: '', date: ui.tab === 'agenda' ? ui.asel : ui.sel, time: '', prio: false } }); },
    tedit(el) { const t = S.tasks.find((x) => x.id === el.dataset.id); if (t) openOv({ k: 'task', id: t.id, draft: { t: t.t, date: t.date, time: t.time, prio: t.prio === 1 } }); },
    tsave() {
      const ov = ui.ov, d = { t: val('f-title'), date: val('f-date'), time: val('f-time'), prio: $('f-prio').checked ? 1 : 0 };
      ov.draft = { t: d.t, date: d.date, time: d.time, prio: d.prio === 1 };
      const r = ov.id ? A.updateTask(S, ov.id, d) : A.createTask(S, d);
      if (r.ok === false) { $('f-title').setAttribute('aria-invalid', String(/título/i.test(r.error))); showFormError(r.error); return; }
      persist(); toast(ov.id ? 'Tarefa atualizada.' : 'Tarefa criada.'); ui.ov = null; render();
    },
    tdelask(el) { const t = S.tasks.find((x) => x.id === el.dataset.id); openConfirm({ title: 'Excluir tarefa?', body: t && t.done ? 'A tarefa está concluída: o XP dela será estornado (o estorno fica no histórico).' : 'Esta ação não pode ser desfeita.', label: 'Excluir tarefa', what: 'delTask', arg: el.dataset.id }); },
    nnew() { openOv({ k: 'note', note: A.newNote(), isNew: true }); },
    nopen(el) { const n = S.notes.find((x) => x.id === el.dataset.id); if (n) openOv({ k: 'note', note: JSON.parse(JSON.stringify(n)) }); },
    nsave() { saveNoteAndClose(); },
    npin() { syncNote(); ui.ov.note.pin = !ui.ov.note.pin; renderOverlay(ctx()); refocus('npin'); },
    ncol(el) { syncNote(); ui.ov.note.c = +el.dataset.v; const v = el.dataset.v; renderOverlay(ctx()); refocus('ncol', v); },
    ndelask() { syncNote(); const id = ui.ov.note.id, exists = S.notes.some((n) => n.id === id); if (!exists) { ui.ov = null; render(); return; } openConfirm({ title: 'Excluir nota?', body: 'A nota será apagada. O XP da criação dela será estornado.', label: 'Excluir nota', what: 'delNote', arg: id }); },
    tagf(el) { ui.tg = el.dataset.v; render(); },
    claim(el) { mutate(() => A.claimMission(S, el.dataset.id)); },
    jtab(el) { ui.jtab = el.dataset.v; render(); },
    achf(el) { ui.achf = el.dataset.v; render(); },
    histmore() { ui.histN += 40; render(); },
    rg(el) { ui.rg = el.dataset.v; render(); },
    aview(el) { ui.aview = el.dataset.v; render(); },
    awk(el) { ui.awk = D.addKey(ui.awk, +el.dataset.v); ui.asel = D.weekKeys(ui.awk)[0]; render(); },
    atoday() { ui.awk = D.weekStartKey(D.todayKey()); ui.asel = D.todayKey(); render(); },
    aday(el) { ui.asel = el.dataset.d; render(); },
    theme(el) { A.setTheme(S, el.dataset.v); persist(); applyTheme(); render(); },
    photo() { $('pf').click(); },
    photorm() { S.p.photo = ''; persist(); render(); toast('Foto removida.'); },
    export() { exportFile(); },
    copy() { copyBackup(); },
    importopen() { openOv({ k: 'import', text: '', analysis: null, error: '' }); },
    pickfile() { $('bf').click(); },
    impanalyze() { analyzeImport(val('imp-text')); },
    impapply() {
      const a = ui.ov.analysis;
      const r = B.apply(adapter, S, a);
      if (!r.ok) { showFormError(r.error); return; }
      replaceState(r.state); G.syncAchievements(S, D.todayKey()); persist(); render(); toast('Backup importado. Seus dados anteriores foram guardados em Ajustes › Restaurar cópia anterior.', 5000);
    },
    clear() { openConfirm({ title: 'Começar do zero?', body: 'Hábitos, tarefas, notas, XP e histórico serão apagados. Seu nome, foto e tema são mantidos. Uma cópia automática permite restaurar.', label: 'Apagar tudo', what: 'clear' }); },
    sample() { openConfirm({ title: 'Carregar dados de exemplo?', body: 'Seus dados atuais serão substituídos por dados fictícios para teste. Uma cópia automática permite restaurar.', label: 'Substituir por exemplo', what: 'sample' }); },
    restoresnap() { openConfirm({ title: 'Restaurar cópia anterior?', body: 'Os dados atuais serão trocados pela última cópia automática. Os atuais ficam guardados para desfazer.', label: 'Restaurar', what: 'restore', danger: false }); },
    yes() { const o = ui.ov; if (o && CONFIRM[o.what]) { const f = CONFIRM[o.what]; f(o.arg); if (ui.ov && ui.ov.k === 'confirm') closeOv(); } },
    close() { closeOv(); },
    scrim(el, ev) { if (ev.target === el) { if (ui.ov && ui.ov.k === 'note') saveNoteAndClose(); else closeOv(); } },
    dismiss(el) { ui.banners = ui.banners.filter((b) => b.id !== el.dataset.id); render(); },
    retrysave() { if (persist()) { toast('Salvo.'); render(); } else render(); }
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-a]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = ACTIONS[el.dataset.a];
    if (!fn) return;
    if (ui.ov && ui.ov.k === 'note' && !['npin', 'ncol', 'nsave', 'ndelask', 'scrim'].includes(el.dataset.a)) syncNote();
    fn(el, ev);
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'q') { ui.q = t.value; const nl = $('nl'); if (nl) nl.innerHTML = V.noteList(ctx()); }
    else if (t.id === 'nm') { clearTimeout(nameTimer); nameTimer = setTimeout(() => { A.setName(S, t.value); persist(); }, 400); }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'f-type' && $('qty')) { $('qty').hidden = t.value === 'check'; ui.ov.draft.type = t.value; }
  });
  document.addEventListener('focusin', (ev) => { const t = ev.target; if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'auto' }), 250); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ui.ov) { ev.preventDefault(); MGApp.handleBack(); return; }
    if (ev.key === 'Tab' && ui.ov) {
      const f = [...$('overlay').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter((e) => e.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });
  $('pf').addEventListener('change', (ev) => { handlePhoto(ev.target.files[0]); ev.target.value = ''; });
  $('bf').addEventListener('change', (ev) => { readTextFile(ev.target.files[0]); ev.target.value = ''; });
  if (g.matchMedia) { const mq = g.matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => applyTheme()); }

  /* ---------- virada de dia e ciclo de vida ---------- */
  function checkDay() {
    const t = D.todayKey();
    if (t === ui.day) return;
    const wasToday = ui.sel === ui.day, aWas = ui.asel === ui.day;
    ui.day = t;
    if (wasToday) ui.sel = t;
    if (aWas) { ui.asel = t; ui.awk = D.weekStartKey(t); }
    const fresh = G.syncAchievements(S, t);
    persist(); render();
    if (fresh.length) toast('Conquista desbloqueada: ' + fresh.map((a) => a.title).join(', '), 3200);
  }
  const MGApp = {
    /** Chamado pelo botão Voltar do Android. Devolve 'exit' apenas quando o app pode fechar. */
    handleBack() {
      if (ui.ov) { if (ui.ov.k === 'note') saveNoteAndClose(); else closeOv(); return 'modal'; }
      if (ui.tab !== 'hoje') { ui.tab = 'hoje'; render(); return 'tab'; }
      return 'exit';
    },
    flush() { if (ui.ov && ui.ov.k === 'note') { syncNote(); } persist(); },
    onResume() { checkDay(); },
    onNativeSave(ok) { toast(ok ? 'Backup salvo no arquivo escolhido.' : 'O backup não foi salvo.', ok ? 3000 : 4500); }
  };
  g.MGApp = MGApp;
  document.addEventListener('visibilitychange', () => { if (document.hidden) MGApp.flush(); else checkDay(); });
  g.addEventListener('pagehide', () => MGApp.flush());
  setInterval(checkDay, 30000);

  /* ---------- inicialização ---------- */
  applyTheme();
  const today = D.todayKey();
  if (loaded.status === 'migrated') banner('mig', 'info', 'Seus dados foram atualizados para a versão 3 do MyGoals. Uma cópia dos dados antigos continua guardada no aparelho.');
  if (loaded.status === 'recovered') banner('rec', 'error', loaded.message);
  if (loaded.status === 'unavailable') banner('unav', 'error', loaded.message, false);
  if (loaded.warnings && loaded.warnings.length) banner('warn', 'info', loaded.warnings.join(' '));
  const fresh = G.syncAchievements(S, today);
  if (loaded.status !== 'unavailable') persist();
  render();
  if (fresh.length && loaded.status !== 'fresh') toast(fresh.length === 1 ? 'Conquista desbloqueada: ' + fresh[0].title : fresh.length + ' conquistas desbloqueadas', 3500);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})(window);
