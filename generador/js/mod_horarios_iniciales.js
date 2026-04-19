/* ── mod_horarios_iniciales.js
   Visor de Horarios Iniciales dentro del Generador de Horarios.
   Lee HORARIOS_WEB desde el GAS de Horarios (HORARIOS_API_URL_).
   Es un visor de referencia/consulta — la carga se sigue haciendo por raw.
   ─────────────────────────────────────────────────────────────────────── */

// URL del GAS de Horarios (mismo que horarios/js/api_horarios.js)
var HORARIOS_VISOR_URL_ = 'https://script.google.com/macros/s/AKfycbyQUyTVSi3-IxFpHR_ySzjaW5AxmXEiI29bVve4IixeKyOwtohWO-kreg8ycl0jFphw/exec';

// ── CACHÉ ─────────────────────────────────────────────────────────────
var _hiVCache_ = null;
var _hiVCacheTs_ = 0;
var _HI_CACHE_TTL_ = 15 * 60 * 1000;  // 15 min

// ── ESTADO DEL MÓDULO ──────────────────────────────────────────────────
var _hiVData_      = [];   // HORARIOS_WEB completo
var _hiVTab_       = 'grupo';

// ── PALETA DE COLORES (misma que el visor original) ────────────────────
var _HI_PALETTE_ = [
  { bg:'#eff6ff', border:'#3b82f6', text:'#1e40af' },
  { bg:'#f0fdf4', border:'#22c55e', text:'#15803d' },
  { bg:'#fef9c3', border:'#ca8a04', text:'#713f12' },
  { bg:'#fdf4ff', border:'#a855f7', text:'#6b21a8' },
  { bg:'#fff7ed', border:'#ea580c', text:'#7c2d12' },
  { bg:'#f0fdfa', border:'#0d9488', text:'#115e59' },
  { bg:'#fef2f2', border:'#dc2626', text:'#7f1d1d' },
  { bg:'#fefce8', border:'#d97706', text:'#78350f' },
  { bg:'#f0f9ff', border:'#0284c7', text:'#0c4a6e' },
  { bg:'#fff1f2', border:'#e11d48', text:'#881337' },
  { bg:'#ecfdf5', border:'#059669', text:'#064e3b' },
  { bg:'#f5f3ff', border:'#7c3aed', text:'#4c1d95' }
];
var _hiColorMap_ = {};
var _hiColorCtr_ = 0;

function _hiColor_(label) {
  if (!label) return _HI_PALETTE_[0];
  if (_hiColorMap_[label] === undefined)
    _hiColorMap_[label] = _hiColorCtr_++ % _HI_PALETTE_.length;
  return _HI_PALETTE_[_hiColorMap_[label]];
}

var _HI_DIAS_ORDER_ = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
var _HI_DIAS_SHORT_ = { LUNES:'Lun', MARTES:'Mar', MIERCOLES:'Mié', JUEVES:'Jue', VIERNES:'Vie' };

// ── REGISTRO DEL MÓDULO ────────────────────────────────────────────────
genRegisterModule('horarios_iniciales', {
  async render(container) {
    container.innerHTML =
      '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando horarios iniciales…</span></div>';
    try {
      _hiVData_ = await _hiGetHorariosWeb_();
      _hiColorMap_ = {};
      _hiColorCtr_ = 0;
      container.innerHTML = _hiPageHTML_();
      _hiBind_(container);
    } catch (err) {
      container.innerHTML =
        '<div class="gen-empty-state">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40">' +
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
        '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<p>No se pudo cargar el visor de horarios iniciales.<br>' +
        '<small style="color:var(--gen-muted);">' + genEsc(err.message) + '</small></p>' +
        '<button class="gen-btn gen-btn-primary" onclick="genNavTo(\'horarios_iniciales\')">Reintentar</button>' +
        '</div>';
    }
  }
});

// ── API: obtener HORARIOS_WEB ──────────────────────────────────────────
async function _hiGetHorariosWeb_(force) {
  if (!force && _hiVCache_ && (Date.now() - _hiVCacheTs_) < _HI_CACHE_TTL_) {
    return _hiVCache_;
  }
  var url = HORARIOS_VISOR_URL_ + '?action=getHorariosWeb&_t=' + Date.now();
  var res  = await fetch(url, { method: 'GET', redirect: 'follow' });
  var json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  _hiVCache_   = json.data || [];
  _hiVCacheTs_ = Date.now();
  return _hiVCache_;
}

// ── HTML PRINCIPAL ─────────────────────────────────────────────────────
function _hiPageHTML_() {
  var ciclos   = _hiGetCiclos_();
  var ciclo0   = ciclos[0] || '';
  var grupos   = _hiGetGrupos_(ciclo0);
  var docentes = _hiGetDocentes_(ciclo0);

  var opCiclos = ciclos.map(function(c) {
    return '<option value="' + genEsc(c) + '"' + (c === ciclo0 ? ' selected' : '') + '>' + genEsc(c) + '</option>';
  }).join('');

  var opGrupos = grupos.map(function(g) {
    return '<option value="' + genEsc(g) + '">' + genEsc(g) + '</option>';
  }).join('') || '<option value="">Sin grupos</option>';

  var opDocentes = docentes.map(function(d) {
    return '<option value="' + genEsc(d) + '">' + genEsc(d) + '</option>';
  }).join('') || '<option value="">Sin docentes</option>';

  return '' +
'<div class="gen-page-header">' +
'  <div>' +
'    <h1 class="gen-page-title">Horarios Iniciales</h1>' +
'    <p class="gen-page-sub">Visor de referencia · datos cargados por RAW</p>' +
'  </div>' +
'  <div class="gen-header-actions">' +
'    <button class="gen-btn gen-btn-sm gen-btn-secondary" id="hi-btn-reload">&#8635; Actualizar</button>' +
'    <button class="gen-btn gen-btn-sm gen-btn-ghost" id="hi-btn-regen">Regenerar HORARIOS_WEB</button>' +
'  </div>' +
'</div>' +

'<div class="hi-info-banner">' +
'  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
'  Este visor muestra los datos de <strong>HORARIOS_WEB</strong> generados a partir de <strong>HORARIOS_RAW</strong> + <strong>DOCENTES_RAW</strong>. ' +
'  Para modificar datos, usa la <a href="../horarios/index.html" target="_blank" style="color:inherit;font-weight:600;">pestaña Captura</a> del módulo de Horarios o actualiza directamente el Sheets.' +
'</div>' +

'<div class="hi-view-tabs" id="hi-tabs" style="margin-bottom:20px;">' +
'  <button class="hi-view-tab active" data-hitab="grupo">Por Grupo</button>' +
'  <button class="hi-view-tab" data-hitab="docente">Por Docente</button>' +
'  <button class="hi-view-tab" data-hitab="general">Vista General</button>' +
'</div>' +

/* ── PANEL GRUPO ── */
'<div id="hi-pane-grupo" class="hi-pane">' +
'  <div class="hi-captura-top" style="margin-bottom:16px;">' +
'    <label style="font-size:13px;font-weight:600;">Ciclo</label>' +
'    <select id="hi-sel-ciclo-grupo" class="gen-input" style="max-width:160px;">' + opCiclos + '</select>' +
'    <label style="font-size:13px;font-weight:600;">Grupo</label>' +
'    <select id="hi-sel-grupo" class="gen-input" style="max-width:180px;">' + opGrupos + '</select>' +
'    <button class="gen-btn gen-btn-sm gen-btn-secondary" id="hi-btn-print-grupo" title="Imprimir horario del grupo seleccionado">' +
'      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="vertical-align:-2px;margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
'      Imprimir horario' +
'    </button>' +
'    <button class="gen-btn gen-btn-sm gen-btn-ghost" id="hi-btn-print-todos-grupos" title="Imprimir todos los grupos del ciclo seleccionado">' +
'      Imprimir todos los grupos' +
'    </button>' +
'  </div>' +
'  <div id="hi-view-grupo"><p class="gen-empty-state" style="padding:20px 0;">Selecciona un grupo para ver su horario.</p></div>' +
'</div>' +

/* ── PANEL DOCENTE ── */
'<div id="hi-pane-docente" class="hi-pane" style="display:none;">' +
'  <div class="hi-captura-top" style="margin-bottom:16px;">' +
'    <label style="font-size:13px;font-weight:600;">Ciclo</label>' +
'    <select id="hi-sel-ciclo-doc" class="gen-input" style="max-width:160px;">' + opCiclos + '</select>' +
'    <label style="font-size:13px;font-weight:600;">Docente</label>' +
'    <select id="hi-sel-docente" class="gen-input" style="max-width:280px;">' + opDocentes + '</select>' +
'    <button class="gen-btn gen-btn-sm gen-btn-secondary" id="hi-btn-print-docente" title="Imprimir carga horaria del docente seleccionado">' +
'      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="vertical-align:-2px;margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
'      Imprimir horario' +
'    </button>' +
'    <button class="gen-btn gen-btn-sm gen-btn-ghost" id="hi-btn-print-todos-docentes" title="Imprimir todos los docentes del ciclo seleccionado">' +
'      Imprimir todos los docentes' +
'    </button>' +
'  </div>' +
'  <div id="hi-view-docente"><p class="gen-empty-state" style="padding:20px 0;">Selecciona un docente para ver su horario.</p></div>' +
'</div>' +

/* ── PANEL GENERAL ── */
'<div id="hi-pane-general" class="hi-pane" style="display:none;">' +
'  <div class="hi-captura-top" style="margin-bottom:16px;">' +
'    <input type="text" id="hi-search-gen" class="gen-input" placeholder="Buscar grupo, materia, docente, ciclo…" style="max-width:320px;">' +
'    <select id="hi-filter-dia" class="gen-input" style="max-width:160px;">' +
'      <option value="">Todos los días</option>' +
'      <option value="LUNES">Lunes</option>' +
'      <option value="MARTES">Martes</option>' +
'      <option value="MIERCOLES">Miércoles</option>' +
'      <option value="JUEVES">Jueves</option>' +
'      <option value="VIERNES">Viernes</option>' +
'    </select>' +
'  </div>' +
'  <div id="hi-view-general"><p class="gen-empty-state" style="padding:20px 0;">Usa los filtros para buscar sesiones.</p></div>' +
'</div>';
}

// ── BIND DE EVENTOS ────────────────────────────────────────────────────
function _hiBind_(container) {
  // Tabs
  container.querySelectorAll('.hi-view-tab').forEach(function(btn) {
    btn.addEventListener('click', function() { _hiSwitchTab_(btn.dataset.hitab); });
  });

  // Selects grupo
  var selCicloG = container.querySelector('#hi-sel-ciclo-grupo');
  var selGrupo  = container.querySelector('#hi-sel-grupo');
  if (selCicloG) selCicloG.addEventListener('change', function() {
    _hiRefreshGrupos_();
    _hiRenderGrupo_();
  });
  if (selGrupo) selGrupo.addEventListener('change', _hiRenderGrupo_);

  // Selects docente
  var selCicloD = container.querySelector('#hi-sel-ciclo-doc');
  var selDoc    = container.querySelector('#hi-sel-docente');
  if (selCicloD) selCicloD.addEventListener('change', function() {
    _hiRefreshDocentes_();
    _hiRenderDocente_();
  });
  if (selDoc) selDoc.addEventListener('change', _hiRenderDocente_);

  // General
  var search = container.querySelector('#hi-search-gen');
  var dia    = container.querySelector('#hi-filter-dia');
  if (search) search.addEventListener('input', _hiRenderGeneral_);
  if (dia)    dia.addEventListener('change', _hiRenderGeneral_);

  // Botones de impresión
  var btnPG  = container.querySelector('#hi-btn-print-grupo');
  var btnPTG = container.querySelector('#hi-btn-print-todos-grupos');
  var btnPD  = container.querySelector('#hi-btn-print-docente');
  var btnPTD = container.querySelector('#hi-btn-print-todos-docentes');
  if (btnPG)  btnPG.addEventListener('click',  _hiPrintGrupo_);
  if (btnPTG) btnPTG.addEventListener('click', _hiPrintTodosGrupos_);
  if (btnPD)  btnPD.addEventListener('click',  _hiPrintDocente_);
  if (btnPTD) btnPTD.addEventListener('click', _hiPrintTodosDocentes_);

  // Recargar
  var btnReload = container.querySelector('#hi-btn-reload');
  if (btnReload) btnReload.addEventListener('click', async function() {
    btnReload.disabled    = true;
    btnReload.textContent = 'Cargando…';
    try {
      _hiVCache_ = null;
      _hiVData_  = await _hiGetHorariosWeb_(true);
      _hiColorMap_ = {};
      _hiColorCtr_ = 0;
      container.innerHTML = _hiPageHTML_();
      _hiBind_(container);
    } catch (err) {
      genShowError('Error al recargar: ' + err.message);
      btnReload.disabled    = false;
      btnReload.textContent = '↺ Actualizar';
    }
  });

  // Regenerar
  var btnRegen = container.querySelector('#hi-btn-regen');
  if (btnRegen) btnRegen.addEventListener('click', _hiHandleRegen_);

  // Render inicial del tab activo
  _hiRenderGrupo_();
}

// ── TABS ───────────────────────────────────────────────────────────────
function _hiSwitchTab_(tab) {
  _hiVTab_ = tab;
  document.querySelectorAll('.hi-view-tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.hitab === tab);
  });
  document.querySelectorAll('.hi-pane').forEach(function(p) {
    p.style.display = (p.id === 'hi-pane-' + tab) ? '' : 'none';
  });
  if (tab === 'grupo')   _hiRenderGrupo_();
  if (tab === 'docente') _hiRenderDocente_();
  if (tab === 'general') _hiRenderGeneral_();
}

// ── HELPERS: POPULATE ─────────────────────────────────────────────────
function _hiGetCiclos_() {
  return Array.from(new Set(_hiVData_.map(function(r) { return r.ciclo; }).filter(Boolean)))
    .sort().reverse();
}

function _hiGetGrupos_(ciclo) {
  return Array.from(new Set(
    _hiVData_.filter(function(r) { return !ciclo || r.ciclo === ciclo; })
             .map(function(r) { return r.grupo; }).filter(Boolean)
  )).sort();
}

function _hiGetDocentes_(ciclo) {
  return Array.from(new Set(
    _hiVData_.filter(function(r) { return !ciclo || r.ciclo === ciclo; })
             .map(function(r) { return r.docente; }).filter(Boolean)
  )).sort();
}

function _hiRefreshGrupos_() {
  var ciclo  = (document.getElementById('hi-sel-ciclo-grupo') || {}).value || '';
  var sel    = document.getElementById('hi-sel-grupo');
  if (!sel) return;
  var grupos = _hiGetGrupos_(ciclo);
  sel.innerHTML = grupos.map(function(g) {
    return '<option value="' + genEsc(g) + '">' + genEsc(g) + '</option>';
  }).join('') || '<option value="">Sin grupos</option>';
}

function _hiRefreshDocentes_() {
  var ciclo    = (document.getElementById('hi-sel-ciclo-doc') || {}).value || '';
  var sel      = document.getElementById('hi-sel-docente');
  if (!sel) return;
  var docentes = _hiGetDocentes_(ciclo);
  sel.innerHTML = docentes.map(function(d) {
    return '<option value="' + genEsc(d) + '">' + genEsc(d) + '</option>';
  }).join('') || '<option value="">Sin docentes</option>';
}

// ── VISTA: POR GRUPO ───────────────────────────────────────────────────
function _hiRenderGrupo_() {
  var ciclo = (document.getElementById('hi-sel-ciclo-grupo') || {}).value || '';
  var grupo = (document.getElementById('hi-sel-grupo')       || {}).value || '';
  var out   = document.getElementById('hi-view-grupo');
  if (!out) return;

  if (!grupo) {
    out.innerHTML = '<p style="color:var(--gen-muted);padding:20px 0;">Selecciona un grupo para ver su horario.</p>';
    return;
  }

  var sessions = _hiVData_.filter(function(r) {
    return (!ciclo || r.ciclo === ciclo) && r.grupo === grupo;
  });

  if (!sessions.length) {
    out.innerHTML = '<p style="color:var(--gen-muted);padding:20px 0;">Sin sesiones registradas para este grupo. Verifica que <code>HORARIOS_WEB</code> tenga datos.</p>';
    return;
  }

  var materias = Array.from(new Set(sessions.map(function(r) { return r.materia; }).filter(Boolean))).sort();
  var docentes = Array.from(new Set(sessions.map(function(r) { return r.docente; }).filter(Boolean))).sort();
  var totalHrs = sessions.reduce(function(a, r) { return a + (parseFloat(r.horas_bloque) || 0); }, 0);
  var turno    = sessions[0] ? (sessions[0].turno || '') : '';

  out.innerHTML =
    '<div class="hor-summary-bar" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">' +
      _hiSumChip_(grupo, 'Grupo') +
      (turno ? _hiSumChip_(turno, 'Turno') : '') +
      _hiSumChip_(String(materias.length), 'Materias') +
      _hiSumChip_(String(docentes.length), 'Docentes') +
      _hiSumChip_(String(Math.round(totalHrs * 10) / 10), 'Hrs/sem') +
    '</div>' +
    '<h3 style="font-size:13px;font-weight:700;color:var(--gen-muted);text-transform:uppercase;letter-spacing:.5px;margin:0 0 12px;">Horario Semanal</h3>' +
    _hiRenderGrid_(sessions, 'grupo') +
    '<h3 style="font-size:13px;font-weight:700;color:var(--gen-muted);text-transform:uppercase;letter-spacing:.5px;margin:24px 0 12px;">Materias del Grupo</h3>' +
    _hiRenderMateriasList_(sessions);
}

// ── VISTA: POR DOCENTE ─────────────────────────────────────────────────
function _hiRenderDocente_() {
  var ciclo   = (document.getElementById('hi-sel-ciclo-doc') || {}).value || '';
  var docente = (document.getElementById('hi-sel-docente')   || {}).value || '';
  var out     = document.getElementById('hi-view-docente');
  if (!out) return;

  if (!docente) {
    out.innerHTML = '<p style="color:var(--gen-muted);padding:20px 0;">Selecciona un docente para ver su horario.</p>';
    return;
  }

  var sessions = _hiVData_.filter(function(r) {
    return (!ciclo || r.ciclo === ciclo) && r.docente === docente;
  });

  if (!sessions.length) {
    out.innerHTML = '<p style="color:var(--gen-muted);padding:20px 0;">Sin sesiones registradas para este docente.</p>';
    return;
  }

  var grupos   = Array.from(new Set(
    sessions.filter(function(r) { return r.componente !== 'EXTRAESCOLAR'; })
            .map(function(r) { return r.grupo; }).filter(Boolean)
  )).sort();
  var materias  = Array.from(new Set(sessions.map(function(r) { return r.materia; }).filter(Boolean))).sort();
  var totalHrs  = sessions.reduce(function(a, r) { return a + (parseFloat(r.horas_bloque) || 0); }, 0);
  var extSessions = sessions.filter(function(r) { return r.componente === 'EXTRAESCOLAR'; });
  var formacion   = sessions[0] ? (sessions[0].formacion_academica || '') : '';

  var initials = String(docente).split(/\s+/).slice(0, 2)
    .map(function(w) { return w[0] || ''; }).join('').toUpperCase();

  out.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
      '<div style="width:44px;height:44px;border-radius:50%;background:var(--gen-primary);color:#fff;' +
           'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0;">' +
        genEsc(initials) +
      '</div>' +
      '<div>' +
        '<div style="font-weight:700;font-size:15px;">' + genEsc(docente) + '</div>' +
        (formacion ? '<div style="font-size:12px;color:var(--gen-muted);">' + genEsc(formacion) + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">' +
      _hiSumChip_(String(grupos.length), 'Grupos') +
      _hiSumChip_(String(materias.length), 'Materias') +
      _hiSumChip_(String(Math.round(totalHrs * 10) / 10), 'Hrs/sem') +
      (extSessions.length ? _hiSumChip_(String(extSessions.length), 'Extraesc.') : '') +
    '</div>' +
    '<h3 style="font-size:13px;font-weight:700;color:var(--gen-muted);text-transform:uppercase;letter-spacing:.5px;margin:0 0 12px;">Horario Semanal</h3>' +
    _hiRenderGrid_(sessions, 'docente') +
    '<h3 style="font-size:13px;font-weight:700;color:var(--gen-muted);text-transform:uppercase;letter-spacing:.5px;margin:24px 0 12px;">Grupos y Materias</h3>' +
    _hiRenderGruposMatList_(sessions);
}

// ── VISTA: GENERAL ─────────────────────────────────────────────────────
function _hiRenderGeneral_() {
  var search = ((document.getElementById('hi-search-gen') || {}).value || '').toLowerCase().trim();
  var dia    = (document.getElementById('hi-filter-dia')  || {}).value || '';
  var out    = document.getElementById('hi-view-general');
  if (!out) return;

  var rows = _hiVData_.slice();
  if (dia)    rows = rows.filter(function(r) { return r.dia === dia; });
  if (search) rows = rows.filter(function(r) {
    return [r.grupo, r.materia, r.docente, r.dia, r.hora_inicio, r.ciclo, r.turno]
      .some(function(v) { return String(v).toLowerCase().indexOf(search) >= 0; });
  });

  rows = rows.sort(function(a, b) {
    if (a.ciclo !== b.ciclo) return String(b.ciclo).localeCompare(String(a.ciclo));
    if (a.grupo !== b.grupo) return String(a.grupo).localeCompare(String(b.grupo));
    var di = _HI_DIAS_ORDER_.indexOf(a.dia) - _HI_DIAS_ORDER_.indexOf(b.dia);
    if (di !== 0) return di;
    return String(a.hora_inicio).localeCompare(String(b.hora_inicio));
  });

  if (!rows.length) {
    out.innerHTML = '<p style="color:var(--gen-muted);padding:20px 0;">No se encontraron sesiones con los filtros aplicados.</p>';
    return;
  }

  var tbody = rows.map(function(r) {
    var dc = _hiColor_(r.dia);
    return '<tr>' +
      '<td>' + genEsc(r.ciclo) + '</td>' +
      '<td><span style="background:#eff6ff;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">' + genEsc(r.grupo) + '</span></td>' +
      '<td>' + genEsc(r.turno) + '</td>' +
      '<td>' + genEsc(r.materia) + '</td>' +
      '<td>' + genEsc(r.docente) + '</td>' +
      '<td><span style="background:' + dc.bg + ';color:' + dc.text + ';padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">' + genEsc(r.dia) + '</span></td>' +
      '<td style="font-family:monospace;">' + genEsc(_hiFormatTime_(r.hora_inicio)) + '</td>' +
      '<td style="font-family:monospace;">' + genEsc(_hiFormatTime_(r.hora_fin)) + '</td>' +
      '<td style="font-family:monospace;">' + genEsc(r.horas_bloque) + '</td>' +
    '</tr>';
  }).join('');

  out.innerHTML =
    '<div style="font-size:12px;color:var(--gen-muted);margin-bottom:10px;">' + rows.length + ' sesión' + (rows.length !== 1 ? 'es' : '') + ' encontrada' + (rows.length !== 1 ? 's' : '') + '</div>' +
    '<div style="overflow-x:auto;">' +
    '<table class="hi-general-table">' +
    '<thead><tr><th>Ciclo</th><th>Grupo</th><th>Turno</th><th>Materia</th><th>Docente</th><th>Día</th><th>Inicio</th><th>Fin</th><th>Hrs</th></tr></thead>' +
    '<tbody>' + tbody + '</tbody>' +
    '</table></div>';
}

// ── GRID SEMANAL (misma lógica que el visor original) ──────────────────
function _hiRenderGrid_(sessions, viewType) {
  if (!sessions.length)
    return '<p style="color:var(--gen-muted);">Sin sesiones para mostrar.</p>';

  sessions = sessions.map(function(s) {
    return Object.assign({}, s, {
      hora_inicio: _hiFormatTime_(s.hora_inicio),
      hora_fin:    _hiFormatTime_(s.hora_fin)
    });
  });

  var times = Array.from(new Set(
    sessions.map(function(r) { return r.hora_inicio; }).filter(Boolean)
  )).sort(function(a, b) { return a.localeCompare(b); });

  if (!times.length)
    return '<p style="color:var(--gen-muted);">Sin horarios definidos.</p>';

  var lookup = {};
  sessions.forEach(function(s) {
    if (!lookup[s.dia]) lookup[s.dia] = {};
    if (!lookup[s.dia][s.hora_inicio]) lookup[s.dia][s.hora_inicio] = s;
  });

  var occ = {};
  var html =
    '<div style="overflow-x:auto;">' +
    '<table class="sched-table" style="border-collapse:collapse;min-width:500px;">' +
    '<thead><tr>' +
      '<th style="padding:6px 10px;background:var(--gen-bg);border:1px solid var(--gen-border);font-size:12px;font-weight:600;"></th>' +
      _HI_DIAS_ORDER_.map(function(d) {
        return '<th style="padding:6px 14px;background:var(--gen-bg);border:1px solid var(--gen-border);font-size:12px;font-weight:600;text-align:center;">' + _HI_DIAS_SHORT_[d] + '</th>';
      }).join('') +
    '</tr></thead><tbody>';

  times.forEach(function(time, timeIdx) {
    html += '<tr>';
    html += '<td style="padding:4px 10px;border:1px solid var(--gen-border);font-size:11px;font-family:monospace;color:var(--gen-muted);white-space:nowrap;">' + genEsc(time) + '</td>';

    _HI_DIAS_ORDER_.forEach(function(day) {
      var occKey = day + '_' + timeIdx;
      if (occ[occKey]) return;

      var s = lookup[day] && lookup[day][time];
      if (s) {
        var span = 1;
        for (var k = timeIdx + 1; k < times.length; k++) {
          if (times[k] < s.hora_fin) span++;
          else break;
        }
        for (var j = 1; j < span; j++) {
          occ[day + '_' + (timeIdx + j)] = true;
        }

        var label, sub;
        if (viewType === 'grupo') {
          label = s.materia;
          sub   = s.docente;
        } else if (s.componente === 'EXTRAESCOLAR') {
          label = s.materia;
          sub   = 'Extraescolar';
        } else {
          label = s.grupo;
          sub   = s.materia;
        }

        var c      = _hiColor_(label);
        var hrsNum = parseFloat(s.horas_bloque) || 0;
        var hrsStr = (hrsNum % 1 === 0 ? String(Math.round(hrsNum)) : String(hrsNum)) + 'h';
        var tip    = genEsc(label) + ' · ' + genEsc(sub) + ' · ' + genEsc(s.hora_inicio) + '–' + genEsc(s.hora_fin) + ' (' + hrsStr + ')';

        html +=
          '<td rowspan="' + span + '" title="' + tip + '" ' +
          'style="padding:6px 8px;border:1px solid var(--gen-border);background:' + c.bg + ';' +
          'border-top:3px solid ' + c.border + ';vertical-align:top;cursor:default;">' +
            '<div style="font-size:11px;font-weight:700;color:' + c.text + ';line-height:1.3;">' + genEsc(label) + '</div>' +
            '<div style="font-size:10px;color:var(--gen-muted);margin-top:2px;">' + genEsc(sub) + '</div>' +
            '<div style="font-size:10px;color:var(--gen-muted);margin-top:3px;">' +
              genEsc(s.hora_inicio) + '–' + genEsc(s.hora_fin) +
              '<span style="margin-left:4px;background:' + c.border + ';color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;">' + hrsStr + '</span>' +
            '</div>' +
          '</td>';
      } else {
        html += '<td style="padding:6px 8px;border:1px solid var(--gen-border);background:var(--gen-bg);"></td>';
      }
    });

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// ── LISTAS DE RESUMEN ──────────────────────────────────────────────────
function _hiRenderMateriasList_(sessions) {
  var byMat = {};
  sessions.forEach(function(r) {
    if (!byMat[r.materia]) byMat[r.materia] = {
      docente:    r.docente,
      componente: r.componente,
      total:      r.total_horas_materia,
      sesiones:   0
    };
    byMat[r.materia].sesiones++;
  });

  var cards = Object.keys(byMat).sort().map(function(mat) {
    var info = byMat[mat];
    var c    = _hiColor_(mat);
    return '<div style="border-left:4px solid ' + c.border + ';background:' + c.bg + ';' +
           'padding:10px 14px;border-radius:6px;">' +
      '<div style="font-weight:700;font-size:13px;color:' + c.text + ';">' + genEsc(mat) + '</div>' +
      '<div style="font-size:12px;color:var(--gen-muted);margin-top:2px;">' + genEsc(info.docente) + '</div>' +
      (info.componente ? '<div style="font-size:11px;color:var(--gen-muted);">' + genEsc(info.componente) + '</div>' : '') +
      (info.total ? '<div style="font-size:11px;color:var(--gen-muted);">' + genEsc(info.total) + ' hrs totales</div>' : '') +
    '</div>';
  }).join('');

  return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">' + cards + '</div>';
}

function _hiRenderGruposMatList_(sessions) {
  var byGrupo = {};
  var extActs = {};

  sessions.forEach(function(r) {
    if (r.componente === 'EXTRAESCOLAR') {
      var key = r.materia || '(sin nombre)';
      if (!extActs[key]) extActs[key] = { hrs: 0 };
      extActs[key].hrs += parseFloat(r.horas_bloque) || 0;
      return;
    }
    if (!byGrupo[r.grupo]) byGrupo[r.grupo] = { materias: [], turno: r.turno, hrs: 0 };
    if (byGrupo[r.grupo].materias.indexOf(r.materia) < 0)
      byGrupo[r.grupo].materias.push(r.materia);
    byGrupo[r.grupo].hrs += parseFloat(r.horas_bloque) || 0;
  });

  var cards = Object.keys(byGrupo).sort().map(function(grupo) {
    var info = byGrupo[grupo];
    var c    = _hiColor_(grupo);
    return '<div style="border-left:4px solid ' + c.border + ';background:' + c.bg + ';' +
           'padding:10px 14px;border-radius:6px;">' +
      '<div style="font-weight:700;font-size:13px;color:' + c.text + ';">' + genEsc(grupo) + '</div>' +
      (info.turno ? '<div style="font-size:11px;color:var(--gen-muted);">' + genEsc(info.turno) + '</div>' : '') +
      '<div style="font-size:11px;color:var(--gen-muted);margin-top:2px;">' + info.materias.sort().map(genEsc).join(' · ') + '</div>' +
      '<div style="font-size:11px;color:var(--gen-muted);">' + Math.round(info.hrs * 10) / 10 + ' hrs / semana</div>' +
    '</div>';
  }).join('');

  var extCards = Object.keys(extActs).sort().map(function(act) {
    var info = extActs[act];
    return '<div style="border-left:4px solid #94a3b8;background:#f8fafc;padding:10px 14px;border-radius:6px;">' +
      '<div style="font-weight:700;font-size:13px;color:#475569;">' + genEsc(act) + '</div>' +
      '<div style="font-size:11px;color:#94a3b8;">Extraescolar / Fortalecimiento</div>' +
      '<div style="font-size:11px;color:#94a3b8;">' + Math.round(info.hrs * 10) / 10 + ' hrs / semana</div>' +
    '</div>';
  }).join('');

  var extSection = extCards
    ? '<h3 style="font-size:13px;font-weight:700;color:var(--gen-muted);text-transform:uppercase;margin:20px 0 10px;">Extraescolares</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">' + extCards + '</div>'
    : '';

  return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">' + cards + '</div>' + extSection;
}

// ── REGENERAR ──────────────────────────────────────────────────────────
async function _hiHandleRegen_() {
  var key = window.prompt('Clave de administrador del GAS de Horarios:');
  if (!key) return;

  var btn = document.getElementById('hi-btn-regen');
  if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; }

  try {
    var url    = HORARIOS_VISOR_URL_ + '?action=regenerar&adminKey=' + encodeURIComponent(key) + '&_t=' + Date.now();
    var res    = await fetch(url, { method: 'GET', redirect: 'follow' });
    var result = await res.json();
    if (result.status === 'ok') {
      genToast('Horarios regenerados correctamente.', 'ok');
      _hiVCache_ = null;
      _hiVData_  = await _hiGetHorariosWeb_(true);
      _hiColorMap_ = {};
      _hiColorCtr_ = 0;
      var cont = document.getElementById('gen-main-content');
      if (cont) { cont.innerHTML = _hiPageHTML_(); _hiBind_(cont); }
    } else {
      genShowError('Error al regenerar: ' + (result.message || 'respuesta inesperada'));
    }
  } catch (err) {
    genShowError('Error al regenerar: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Regenerar HORARIOS_WEB'; }
  }
}

// ── HELPERS ────────────────────────────────────────────────────────────
function _hiFormatTime_(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date)
    return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  var s = String(v).trim();
  if (s.indexOf('T') !== -1) {
    var d = new Date(s);
    if (!isNaN(d.getTime()))
      return ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
  }
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    var parts = s.split(':');
    return ('0' + parseInt(parts[0], 10)).slice(-2) + ':' + parts[1];
  }
  return s;
}

function _hiSumChip_(val, lbl) {
  return '<div style="background:var(--gen-bg);border:1px solid var(--gen-border);border-radius:8px;' +
         'padding:6px 12px;text-align:center;min-width:60px;">' +
    '<div style="font-size:16px;font-weight:800;color:var(--gen-text);">' + genEsc(val) + '</div>' +
    '<div style="font-size:10px;color:var(--gen-muted);text-transform:uppercase;letter-spacing:.5px;">' + genEsc(lbl) + '</div>' +
  '</div>';
}

// ══════════════════════════════════════════════════════════════════════
// IMPRESIÓN / PDF
// Portado de horarios/js/print_horarios.js — adaptado para _hiVData_
// ══════════════════════════════════════════════════════════════════════

var _HI_PRINT_CFG_ = {
  sep:          'Secretaría de Educación Pública',
  subsep:       'Subsecretaría de Educación Media Superior',
  dgb:          'Dirección General del Bachillerato',
  plantel:      'Centro de Estudios de Bachillerato 5/4',
  nombrePlantel:'"Profr. Rafael Ramírez"',
  cct:          'CCT: 13DBP0001Z',
  logoSrc:      '../assets/logo.png'
};

// ── Imprimir grupo individual ──────────────────────────────────────────
function _hiPrintGrupo_() {
  var ciclo = (document.getElementById('hi-sel-ciclo-grupo') || {}).value || '';
  var grupo = (document.getElementById('hi-sel-grupo')       || {}).value || '';
  if (!grupo) { alert('Selecciona un grupo antes de imprimir.'); return; }

  var sessions = _hiVData_.filter(function(r) {
    return (!ciclo || r.ciclo === ciclo) && r.grupo === grupo;
  });
  if (!sessions.length) { alert('No hay sesiones para este grupo.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horario Grupo ' + _hiPe_(grupo) + '</title>' +
    _hiPrintCss_('landscape') +
    '</head><body>' +
    _hiHeaderHtml_('Horario de Actividades', ciclo) +
    _hiGrupoBody_(sessions, grupo, ciclo) +
    '</body></html>';

  _hiOpenPrint_(html);
}

// ── Imprimir docente individual ────────────────────────────────────────
function _hiPrintDocente_() {
  var ciclo   = (document.getElementById('hi-sel-ciclo-doc') || {}).value || '';
  var docente = (document.getElementById('hi-sel-docente')   || {}).value || '';
  if (!docente) { alert('Selecciona un docente antes de imprimir.'); return; }

  var sessions = _hiVData_.filter(function(r) {
    return (!ciclo || r.ciclo === ciclo) && r.docente === docente;
  });
  if (!sessions.length) { alert('No hay sesiones para este docente.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horario ' + _hiPe_(docente) + '</title>' +
    _hiPrintCss_('landscape') +
    '</head><body>' +
    _hiHeaderHtml_('Carga Horaria Frente a Grupo', ciclo) +
    _hiDocenteBody_(sessions, docente, ciclo) +
    '</body></html>';

  _hiOpenPrint_(html);
}

// ── Imprimir todos los grupos ──────────────────────────────────────────
function _hiPrintTodosGrupos_() {
  var ciclo = (document.getElementById('hi-sel-ciclo-grupo') || {}).value || '';
  var base  = ciclo ? _hiVData_.filter(function(r) { return r.ciclo === ciclo; }) : _hiVData_;

  var grupos = Array.from(new Set(base.map(function(r) { return r.grupo; }).filter(Boolean))).sort();
  if (!grupos.length) { alert('No hay grupos disponibles para el ciclo seleccionado.'); return; }

  var pages = [];
  grupos.forEach(function(grupo) {
    var sessions = base.filter(function(r) { return r.grupo === grupo; });
    if (!sessions.length) return;
    pages.push(
      '<div class="report-page">' +
        _hiHeaderHtml_('Horario de Actividades', ciclo) +
        _hiGrupoBody_(sessions, grupo, ciclo) +
      '</div>'
    );
  });
  if (!pages.length) { alert('No se encontraron datos para generar.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horarios por Grupo' + (ciclo ? ' — ' + ciclo : '') + '</title>' +
    _hiPrintCss_('landscape') +
    '</head><body>' + pages.join('') + '</body></html>';

  _hiOpenPrint_(html);
}

// ── Imprimir todos los docentes ────────────────────────────────────────
function _hiPrintTodosDocentes_() {
  var ciclo = (document.getElementById('hi-sel-ciclo-doc') || {}).value || '';
  var base  = ciclo ? _hiVData_.filter(function(r) { return r.ciclo === ciclo; }) : _hiVData_;

  var docentes = Array.from(new Set(base.map(function(r) { return r.docente; }).filter(Boolean))).sort();
  if (!docentes.length) { alert('No hay docentes disponibles para el ciclo seleccionado.'); return; }

  var pages = [];
  docentes.forEach(function(docente) {
    var sessions = base.filter(function(r) { return r.docente === docente; });
    if (!sessions.length) return;
    pages.push(
      '<div class="report-page">' +
        _hiHeaderHtml_('Carga Horaria Frente a Grupo', ciclo) +
        _hiDocenteBody_(sessions, docente, ciclo) +
      '</div>'
    );
  });
  if (!pages.length) { alert('No se encontraron datos para generar.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horarios por Docente' + (ciclo ? ' — ' + ciclo : '') + '</title>' +
    _hiPrintCss_('landscape') +
    '</head><body>' + pages.join('') + '</body></html>';

  _hiOpenPrint_(html);
}

// ── Abrir ventana de impresión ─────────────────────────────────────────
function _hiOpenPrint_(html) {
  var win = window.open('', '_blank', 'width=1000,height=720,scrollbars=yes,resizable=yes');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente.\nPermite ventanas emergentes para este sitio e intenta de nuevo.');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(function() { win.focus(); win.print(); }, 1000);
}

// ── Contenido: grupo ──────────────────────────────────────────────────
function _hiGrupoBody_(sessions, grupo, ciclo) {
  var turno    = sessions[0] ? (sessions[0].turno || '') : '';
  var totalHrs = sessions.reduce(function(a, r) { return a + (parseFloat(r.horas_bloque) || 0); }, 0);
  var semestre = _hiInferSemestre_(grupo);
  var hrsStr   = (Math.round(totalHrs * 10) / 10) + ' hrs';

  var metaHtml =
    '<table class="meta-table"><tbody>' +
    '<tr>' +
      '<th class="meta-lbl">Grupo</th><td class="meta-val">' + _hiPe_(grupo) + '</td>' +
      '<th class="meta-lbl">Turno</th><td class="meta-val">' + _hiPe_(turno) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Semestre</th><td class="meta-val">' + _hiPe_(semestre) + '</td>' +
      '<th class="meta-lbl">Ciclo escolar</th><td class="meta-val">' + _hiPe_(ciclo) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Total horas / semana</th>' +
      '<td class="meta-val" colspan="3"><strong>' + hrsStr + '</strong></td>' +
    '</tr></tbody></table>';

  return metaHtml +
    '<h2 class="section-title">Distribución Semanal de Actividades</h2>' +
    _hiPrintGrid_(sessions, 'grupo') +
    '<h2 class="section-title">Materias Asignadas al Grupo</h2>' +
    _hiMateriasTableHtml_(sessions, 'grupo') +
    _hiFirmasGrupoHtml_();
}

// ── Contenido: docente ─────────────────────────────────────────────────
function _hiDocenteBody_(sessions, docente, ciclo) {
  var formacion = sessions[0] ? (sessions[0].formacion_academica || '') : '';
  var clave     = sessions[0] ? (sessions[0].clave_docente || '') : '';
  var grupos    = Array.from(new Set(
    sessions.filter(function(r) { return r.componente !== 'EXTRAESCOLAR'; })
            .map(function(r) { return r.grupo; }).filter(Boolean)
  )).sort();
  var totalHrs = sessions.reduce(function(a, r) { return a + (parseFloat(r.horas_bloque) || 0); }, 0);
  var hrsStr   = (Math.round(totalHrs * 10) / 10) + ' hrs';

  var metaHtml =
    '<table class="meta-table"><tbody>' +
    '<tr>' +
      '<th class="meta-lbl">Docente</th>' +
      '<td class="meta-val" colspan="3">' + _hiPe_(docente) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Clave / CURP</th><td class="meta-val">' + _hiPe_(clave) + '</td>' +
      '<th class="meta-lbl">Ciclo escolar</th><td class="meta-val">' + _hiPe_(ciclo) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Formación académica</th><td class="meta-val">' + _hiPe_(formacion) + '</td>' +
      '<th class="meta-lbl">Grupos atendidos</th><td class="meta-val">' + _hiPe_(grupos.join(', ')) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Total horas / semana</th>' +
      '<td class="meta-val" colspan="3"><strong>' + hrsStr + '</strong></td>' +
    '</tr></tbody></table>';

  return metaHtml +
    '<h2 class="section-title">Distribución Semanal</h2>' +
    _hiPrintGrid_(sessions, 'docente') +
    '<h2 class="section-title">Detalle de Carga Horaria</h2>' +
    _hiMateriasTableHtml_(sessions, 'docente') +
    _hiFirmasDocenteHtml_(docente);
}

// ── Tabla de horario para impresión (rowspan, índice-seguro) ───────────
function _hiPrintGrid_(sessions, viewType) {
  var norm = sessions.map(function(s) {
    return Object.assign({}, s, {
      hora_inicio: _hiFormatTime_(s.hora_inicio),
      hora_fin:    _hiFormatTime_(s.hora_fin)
    });
  });

  var times = Array.from(new Set(
    norm.map(function(r) { return r.hora_inicio; }).filter(Boolean)
  )).sort(function(a, b) { return a.localeCompare(b); });

  if (!times.length) return '<p class="no-data">Sin horarios definidos.</p>';

  var lookup = {};
  norm.forEach(function(s) {
    if (!lookup[s.dia]) lookup[s.dia] = {};
    if (!lookup[s.dia][s.hora_inicio]) lookup[s.dia][s.hora_inicio] = s;
  });

  var occ    = {};
  var dias   = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
  var labels = { LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles', JUEVES:'Jueves', VIERNES:'Viernes' };

  var html = '<div class="sched-wrap"><table class="sched-print">' +
    '<thead><tr><th class="th-hora">Hora</th>' +
    dias.map(function(d) { return '<th class="th-dia">' + labels[d] + '</th>'; }).join('') +
    '</tr></thead><tbody>';

  times.forEach(function(time, timeIdx) {
    html += '<tr><td class="td-hora">' + _hiPe_(time) + '</td>';
    dias.forEach(function(day) {
      var occKey = day + '_' + timeIdx;
      if (occ[occKey]) return;
      var s = lookup[day] && lookup[day][time];
      if (s) {
        var span = 1;
        for (var k = timeIdx + 1; k < times.length; k++) {
          if (times[k] < s.hora_fin) span++;
          else break;
        }
        for (var j = 1; j < span; j++) occ[day + '_' + (timeIdx + j)] = true;

        var label, sub;
        if (viewType === 'grupo') {
          label = s.materia; sub = s.docente;
        } else if (s.componente === 'EXTRAESCOLAR') {
          label = s.materia; sub = 'Extrac.';
        } else {
          label = s.grupo; sub = s.materia;
        }
        var hrsNum = parseFloat(s.horas_bloque) || 0;
        var hrsStr = (hrsNum % 1 === 0 ? String(Math.round(hrsNum)) : String(hrsNum)) + ' hr';

        html += '<td rowspan="' + span + '" class="td-session">' +
          '<div class="cell-label">' + _hiPe_(label) + '</div>' +
          '<div class="cell-sub">' + _hiPe_(sub) + '</div>' +
          '<div class="cell-time">' + _hiPe_(s.hora_inicio) + '–' + _hiPe_(s.hora_fin) +
            ' <span class="cell-hrs">(' + hrsStr + ')</span></div>' +
        '</td>';
      } else {
        html += '<td class="td-empty"></td>';
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// ── Tabla de materias / carga ──────────────────────────────────────────
function _hiMateriasTableHtml_(sessions, viewType) {
  var grouped = {};
  sessions.forEach(function(r) {
    var key = viewType === 'grupo'
      ? (r.materia + '|' + r.docente)
      : (r.grupo   + '|' + r.materia);
    if (!grouped[key]) grouped[key] = {
      materia: r.materia, docente: r.docente,
      grupo: r.grupo, turno: r.turno,
      componente: r.componente, hrs: 0
    };
    grouped[key].hrs += parseFloat(r.horas_bloque) || 0;
  });

  var keys        = Object.keys(grouped).sort();
  var regularKeys = keys.filter(function(k) { return grouped[k].componente !== 'EXTRAESCOLAR'; });
  var extraKeys   = keys.filter(function(k) { return grouped[k].componente === 'EXTRAESCOLAR'; });

  var rows = (viewType === 'docente' ? regularKeys : keys).map(function(k) {
    var d   = grouped[k];
    var hrs = Math.round(d.hrs * 10) / 10;
    return viewType === 'grupo'
      ? '<tr><td>' + _hiPe_(d.materia) + '</td><td>' + _hiPe_(d.componente) + '</td>' +
        '<td>' + _hiPe_(d.docente) + '</td><td class="hrs-cell">' + hrs + '</td></tr>'
      : '<tr><td>' + _hiPe_(d.grupo) + '</td><td>' + _hiPe_(d.turno) + '</td>' +
        '<td>' + _hiPe_(d.materia) + '</td><td class="hrs-cell">' + hrs + '</td></tr>';
  });

  var totalHrs = Math.round(
    (viewType === 'docente' ? regularKeys : keys)
      .reduce(function(a, k) { return a + grouped[k].hrs; }, 0) * 10
  ) / 10;

  var header = viewType === 'grupo'
    ? '<tr><th>Materia / UAC</th><th>Comp.</th><th>Docente</th><th>Hrs</th></tr>'
    : '<tr><th>Grupo</th><th>Turno</th><th>Materia / UAC</th><th>Hrs</th></tr>';

  var mainTable;
  if (rows.length >= 4) {
    var half  = Math.ceil(rows.length / 2);
    mainTable =
      '<table class="two-col-wrap"><tr>' +
        '<td class="two-col-cell"><table class="mat-table"><thead>' + header + '</thead>' +
          '<tbody>' + rows.slice(0, half).join('') + '</tbody></table></td>' +
        '<td class="two-col-cell"><table class="mat-table"><thead>' + header + '</thead>' +
          '<tbody>' + rows.slice(half).join('') + '</tbody></table></td>' +
      '</tr></table>' +
      '<p class="mat-total-bar">Total horas / semana: <strong>' + totalHrs + '</strong></p>';
  } else {
    mainTable =
      '<table class="mat-table"><thead>' + header + '</thead><tbody>' +
        rows.join('') +
        '<tr class="total-row"><td colspan="3"><strong>Total horas / semana</strong></td>' +
          '<td class="hrs-cell"><strong>' + totalHrs + '</strong></td></tr>' +
      '</tbody></table>';
  }

  if (viewType === 'docente' && extraKeys.length > 0) {
    var extRows  = extraKeys.map(function(k) {
      var d = grouped[k];
      return '<tr><td colspan="3">' + _hiPe_(d.materia) + '</td>' +
             '<td class="hrs-cell">' + Math.round(d.hrs * 10) / 10 + '</td></tr>';
    });
    var extTotal = Math.round(
      extraKeys.reduce(function(a, k) { return a + grouped[k].hrs; }, 0) * 10
    ) / 10;
    mainTable +=
      '<p class="mat-ext-title">Extraescolares / Fortalecimiento</p>' +
      '<table class="mat-table"><thead><tr><th colspan="3">Actividad</th><th>Hrs</th></tr></thead>' +
      '<tbody>' + extRows.join('') +
        '<tr class="total-row"><td colspan="3"><strong>Total extraescolar / semana</strong></td>' +
          '<td class="hrs-cell"><strong>' + extTotal + '</strong></td></tr>' +
      '</tbody></table>';
  }
  return mainTable;
}

// ── Encabezado institucional ───────────────────────────────────────────
function _hiHeaderHtml_(docTitle, ciclo) {
  var c = _HI_PRINT_CFG_;
  return '<div class="inst-header">' +
    '<div class="inst-logo-wrap">' +
      '<img src="' + _hiPe_(c.logoSrc) + '" alt="Logo CEB" style="width:62px;height:auto;" onerror="this.style.display=\'none\'">' +
    '</div>' +
    '<div class="inst-text">' +
      '<div class="inst-sep">'    + _hiPe_(c.sep)    + '</div>' +
      '<div class="inst-subsep">' + _hiPe_(c.subsep) + '</div>' +
      '<div class="inst-dgb">'    + _hiPe_(c.dgb)    + '</div>' +
      '<div class="inst-plantel">' + _hiPe_(c.plantel) + ' ' + _hiPe_(c.nombrePlantel) + '</div>' +
      '<div class="inst-cct">'    + _hiPe_(c.cct)    + '</div>' +
    '</div>' +
  '</div>' +
  '<div class="doc-title-bar">' +
    '<span class="doc-title">' + _hiPe_(docTitle) + '</span>' +
    (ciclo ? '<span class="doc-ciclo">Ciclo Escolar ' + _hiPe_(ciclo) + '</span>' : '') +
    '<span class="doc-date">Fecha: ' + _hiFmtDate_() + '</span>' +
  '</div>';
}

// ── Firmas ─────────────────────────────────────────────────────────────
function _hiFirmasGrupoHtml_() {
  return '<div class="firmas-section">' +
    '<div class="firma-col"><div class="firma-line"></div>' +
      '<div class="firma-label">Director(a) del Plantel</div>' +
      '<div class="firma-cargo">Vo. Bo.</div></div>' +
    '<div class="firma-col firma-col-sello"><div class="sello-circle">SELLO</div></div>' +
    '<div class="firma-col"><div class="firma-line"></div>' +
      '<div class="firma-label">Subdirector(a) Académico(a)</div>' +
      '<div class="firma-cargo">Elaboró</div></div>' +
  '</div>';
}

function _hiFirmasDocenteHtml_(docente) {
  return '<div class="firmas-section">' +
    '<div class="firma-col"><div class="firma-line"></div>' +
      '<div class="firma-label">Director(a) del Plantel</div>' +
      '<div class="firma-cargo">Vo. Bo.</div></div>' +
    '<div class="firma-col firma-col-sello"><div class="sello-circle">SELLO</div></div>' +
    '<div class="firma-col"><div class="firma-line"></div>' +
      '<div class="firma-label">' + _hiPe_(docente) + '</div>' +
      '<div class="firma-cargo">Docente — Enterado(a)</div></div>' +
  '</div>';
}

// ── CSS de impresión ───────────────────────────────────────────────────
function _hiPrintCss_(orientation) {
  return '<style>' +
    '@page { size: letter ' + orientation + '; margin: 6mm 8mm 8mm; }' +
    '*, *::before, *::after { box-sizing: border-box; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; margin: 0; padding: 0; background: white; }' +
    '.report-page { page-break-after: always; break-after: page; }' +
    '.report-page:last-child { page-break-after: auto; break-after: auto; }' +
    '.inst-header { display: flex; align-items: center; gap: 8pt; border-bottom: 2pt solid #000; padding-bottom: 4pt; margin-bottom: 3pt; }' +
    '.inst-logo-wrap { flex-shrink: 0; }' +
    '.inst-text { flex: 1; }' +
    '.inst-sep    { font-size: 6.5pt; color: #555; }' +
    '.inst-subsep { font-size: 6.5pt; color: #555; }' +
    '.inst-dgb    { font-size: 7pt; color: #333; margin-top: 1pt; }' +
    '.inst-plantel{ font-size: 9.5pt; font-weight: bold; color: #000; margin-top: 2pt; line-height: 1.2; }' +
    '.inst-cct    { font-size: 6.5pt; color: #555; margin-top: 1pt; }' +
    '.doc-title-bar { display: flex; align-items: baseline; gap: 12pt; border-bottom: 1pt solid #888; padding: 3pt 0; margin-bottom: 3pt; }' +
    '.doc-title  { font-size: 10pt; font-weight: bold; flex: 1; }' +
    '.doc-ciclo  { font-size: 7.5pt; color: #333; }' +
    '.doc-date   { font-size: 7pt; color: #555; white-space: nowrap; }' +
    '.meta-table { width: 100%; border-collapse: collapse; margin-bottom: 4pt; font-size: 7.5pt; }' +
    '.meta-lbl { text-align: left; padding: 1.5pt 5pt 1.5pt 2pt; width: 20%; color: #555; font-weight: normal; border-bottom: 0.5pt solid #e0e0e0; white-space: nowrap; }' +
    '.meta-val { padding: 1.5pt 8pt 1.5pt 2pt; font-weight: bold; border-bottom: 0.5pt solid #e0e0e0; width: 30%; }' +
    '.section-title { font-size: 8.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; border-bottom: 1pt solid #000; padding-bottom: 2pt; margin: 3pt 0 2pt; }' +
    '.sched-wrap { width: 100%; overflow: visible; }' +
    '.sched-print { width: 100%; border-collapse: collapse; font-size: 7pt; }' +
    '.th-hora { width: 38pt; background: #e8e8e8; font-size: 6.5pt; text-align: center; padding: 2pt; border: 0.75pt solid #999; }' +
    '.th-dia  { background: #e8e8e8; font-size: 7.5pt; font-weight: bold; text-align: center; padding: 2pt; border: 0.75pt solid #999; }' +
    '.td-hora { background: #f4f4f4; font-size: 6.5pt; font-weight: bold; text-align: center; padding: 1pt; border: 0.75pt solid #bbb; white-space: nowrap; vertical-align: middle; height: 24pt; }' +
    '.td-session { border: 0.75pt solid #999; padding: 2pt 3pt; vertical-align: top; border-top: 2pt solid #333; height: 24pt; overflow: hidden; }' +
    '.td-empty   { border: 0.75pt solid #ddd; background: #fafafa; height: 24pt; }' +
    '.cell-label { font-weight: bold; font-size: 7pt; line-height: 1.25; margin-bottom: 1pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }' +
    '.cell-sub   { font-size: 6pt; color: #444; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }' +
    '.cell-time  { font-size: 5.5pt; color: #666; white-space: nowrap; }' +
    '.cell-hrs   { color: #888; }' +
    '.mat-table { width: 100%; border-collapse: collapse; font-size: 7pt; margin-top: 2pt; }' +
    '.mat-table thead th { background: #e8e8e8; border: 0.75pt solid #999; padding: 2pt 4pt; text-align: left; font-size: 6.5pt; }' +
    '.mat-table tbody td { border: 0.75pt solid #ccc; padding: 2pt 4pt; vertical-align: top; }' +
    '.mat-table .total-row td { background: #f0f0f0; border-top: 1pt solid #666; }' +
    '.hrs-cell { text-align: center; white-space: nowrap; }' +
    '.no-data  { color: #888; font-style: italic; padding: 4pt 0; font-size: 7.5pt; }' +
    '.two-col-wrap { width: 100%; border-collapse: collapse; margin-top: 2pt; }' +
    '.two-col-cell { vertical-align: top; width: 50%; }' +
    '.two-col-cell:first-child { padding-right: 4pt; }' +
    '.two-col-cell + .two-col-cell { padding-left: 4pt; }' +
    '.mat-total-bar { font-size: 7pt; text-align: right; border-top: 1pt solid #444; padding-top: 2pt; margin: 2pt 0 0; }' +
    '.mat-ext-title { font-size: 7.5pt; font-weight: bold; color: #475569; border-top: 0.75pt solid #94a3b8; margin: 6pt 0 2pt; padding-top: 4pt; text-transform: uppercase; letter-spacing: 0.4pt; }' +
    '.firmas-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8pt; gap: 8pt; page-break-inside: avoid; break-inside: avoid; }' +
    '.firma-col { flex: 1; text-align: center; }' +
    '.firma-col-sello { flex: 0 0 auto; width: 50pt; }' +
    '.firma-line { border-bottom: 1pt solid #000; height: 16pt; margin-bottom: 3pt; }' +
    '.firma-label { font-size: 7.5pt; font-weight: bold; }' +
    '.firma-cargo { font-size: 6.5pt; color: #555; margin-top: 1pt; }' +
    '.sello-circle { width: 38pt; height: 38pt; border: 1.5pt dashed #999; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 6pt; color: #bbb; letter-spacing: 1pt; }' +
    '@media print {' +
      'body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      '.td-session { border-top-color: #555 !important; }' +
      'h2.section-title, .firmas-section { page-break-inside: avoid; break-inside: avoid; }' +
      'h2.section-title { page-break-after: avoid; break-after: avoid; }' +
    '}' +
  '</style>';
}

// ── Helpers de impresión ───────────────────────────────────────────────
function _hiPe_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _hiFmtDate_() {
  var d  = new Date();
  var dd = ('0' + d.getDate()).slice(-2);
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  return dd + '/' + mm + '/' + d.getFullYear();
}

function _hiInferSemestre_(grupo) {
  var m = String(grupo).match(/[A-Z](\d)(\d{2})/i);
  if (!m) return '';
  var num = parseInt(m[1], 10);
  if (!num || num < 1 || num > 6) return '';
  return num + '\u00b0 Semestre';
}
