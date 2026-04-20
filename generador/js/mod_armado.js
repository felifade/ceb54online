/* ── mod_armado.js — Horarios (visualizador desde Estructura) ──────── */

genRegisterModule('armado', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state"><p>Selecciona un ciclo escolar primero.</p></div>';
      return;
    }
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando estructura…</span></div>';
    try {
      var results = await Promise.all([
        genAPI.getDocentes(),
        genAPI.getGrupos(),
        genAPI.getMaterias(),
        genAPI.getEstructura(_genApp.ciclo, true)
      ]);
      _genApp.docentes = results[0];
      _genApp.grupos   = results[1];
      _genApp.materias = results[2];
      _armEst_         = results[3];
      _armMode_        = 'grupo';
      _armGrupoSel_    = '';
      _armDocSel_      = '';
      _armConflictos_  = _armValidar(_armEst_);
      container.innerHTML = _armPageHTML();
      _armBind();
    } catch(err) {
      genShowError('Error al cargar: ' + err.message);
    }
  }
});

// ── ESTADO DEL VISUALIZADOR ──────────────────────────────────────────
var _armEst_        = [];
var _armMode_       = 'grupo';
var _armGrupoSel_   = '';
var _armDocSel_     = '';
var _armConflictos_ = { errores: [], advertencias: [] };

// ── COLOR POR MATERIA ─────────────────────────────────────────────────
/** Devuelve {bg, border, text} derivado del nombre de la UAC (hash estable). */
function _armColorUAC(uac) {
  var s = String(uac || ''), h = 0;
  for (var i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  var hue = ((h % 360) + 360) % 360;
  return {
    bg:     'hsl(' + hue + ',55%,92%)',
    border: 'hsl(' + hue + ',55%,52%)',
    text:   'hsl(' + hue + ',55%,22%)'
  };
}

// ── PANEL DE ESTADÍSTICAS ─────────────────────────────────────────────
function _armStatsHTML() {
  var grupos = {}, docentes = {}, totalHoras = 0, gruposConHor = {};
  var dias = ['lunes','martes','miercoles','jueves','viernes'];
  _armEst_.forEach(function(row) {
    var g = String(row.grupo || '').trim();
    if (g) grupos[g] = true;
    var tipo = String(row.tipo_asignacion_docente || '').trim();
    var d = String(row.docente || '').trim();
    if (d && tipo !== 'Vacante') docentes[d] = true;
    totalHoras += Number(row.horas) || 0;
    if (g && dias.some(function(dia) { return !!row[dia]; })) gruposConHor[g] = true;
  });
  var nG = Object.keys(grupos).length;
  var nGH = Object.keys(gruposConHor).length;
  var nD = Object.keys(docentes).length;
  var nErr = _armConflictos_.errores.length;

  function card(val, lbl, cls) {
    return '<div class="arm-stat-card' + (cls ? ' ' + cls : '') + '">' +
      '<span class="arm-stat-val">' + val + '</span>' +
      '<span class="arm-stat-lbl">' + lbl + '</span>' +
      '</div>';
  }

  return '<div class="arm-stats-bar">' +
    card(nG,  'Grupos totales') +
    card(nGH + '/' + nG, 'Con horario', nGH < nG ? 'arm-stat-card--warn' : 'arm-stat-card--ok') +
    card(nD,  'Docentes asignados') +
    card(totalHoras, 'Horas en estructura') +
    card(nErr, 'Conflictos', nErr > 0 ? 'arm-stat-card--err' : 'arm-stat-card--ok') +
    '</div>';
}

// ── VALIDACIÓN LOCAL ─────────────────────────────────────────────────
function _armValidar(data) {
  var errores = [], advertencias = [];
  var dias = ['lunes','martes','miercoles','jueves','viernes'];

  // Traslapes por grupo
  var gMap = {};
  data.forEach(function(row, i) {
    var g = String(row.grupo || '').trim();
    if (!g || !String(row.uac || '').trim()) return;
    dias.forEach(function(dia) {
      var r = _estRangoHora(row[dia]);
      if (!r) return;
      var k = g + '|' + dia;
      if (!gMap[k]) gMap[k] = [];
      gMap[k].push({ ini: r.ini, fin: r.fin, uac: row.uac, grupo: g, fila: i + 1 });
    });
  });
  Object.keys(gMap).forEach(function(k) {
    var list = gMap[k], parts = k.split('|');
    for (var a = 0; a < list.length; a++) {
      for (var b = a + 1; b < list.length; b++) {
        if (_estRangosTrasladan(list[a], list[b])) {
          errores.push({ tipo: 'TRASLAPE_GRUPO', fila: list[a].fila, grupo: parts[0],
            mensaje: 'Grupo ' + parts[0] + ' — ' + parts[1] + ': traslape entre "' +
              list[a].uac + '" y "' + list[b].uac + '"' });
        }
      }
    }
  });

  // Traslapes por docente
  var dMap = {};
  data.forEach(function(row, i) {
    var tipo = String(row.tipo_asignacion_docente || '').trim();
    if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return;
    var d = String(row.docente || '').trim();
    if (!d || !String(row.uac || '').trim()) return;
    dias.forEach(function(dia) {
      var r = _estRangoHora(row[dia]);
      if (!r) return;
      var k = d + '|' + dia;
      if (!dMap[k]) dMap[k] = [];
      dMap[k].push({ ini: r.ini, fin: r.fin, uac: row.uac, grupo: row.grupo, fila: i + 1 });
    });
  });
  Object.keys(dMap).forEach(function(k) {
    var list = dMap[k], parts = k.split('|');
    for (var a = 0; a < list.length; a++) {
      for (var b = a + 1; b < list.length; b++) {
        if (_estRangosTrasladan(list[a], list[b])) {
          errores.push({ tipo: 'TRASLAPE_DOCENTE', fila: list[a].fila, docente: parts[0],
            mensaje: '"' + parts[0] + '" — ' + parts[1] + ': grupo ' + list[a].grupo +
              ' y grupo ' + list[b].grupo });
        }
      }
    }
  });

  return { errores: errores, advertencias: advertencias };
}

// ── HTML PRINCIPAL ────────────────────────────────────────────────────
function _armPageHTML() {
  var nErr  = _armConflictos_.errores.length;
  var nWarn = _armConflictos_.advertencias.length;
  var cfBadge = nErr > 0
    ? '<span class="arm-conflict-badge arm-conflict-badge--err">' + nErr + '</span>'
    : (nWarn > 0 ? '<span class="arm-conflict-badge arm-conflict-badge--warn">' + nWarn + '</span>' : '');

  return '<div class="gen-page-header">' +
    '<div><h1 class="gen-page-title">Horarios</h1>' +
    '<p class="gen-page-sub">Ciclo: <strong>' + genEsc(_genApp.ciclo) + '</strong>' +
    ' &nbsp;·&nbsp; Vista derivada de Estructura Educativa</p></div>' +
    '<div class="gen-header-actions">' +
    '<button class="gen-btn gen-btn-sm gen-btn-ghost" id="arm-btn-refresh">↻ Actualizar</button>' +
    '<button class="gen-btn gen-btn-sm gen-btn-secondary" onclick="genNavTo(\'estructura\')">← Estructura Educativa</button>' +
    '</div></div>' +

    '<div class="arm-vis-tabs">' +
    '<button class="arm-vis-tab' + (_armMode_ === 'grupo' ? ' active' : '') + '" data-mode="grupo">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' +
    ' Por grupo</button>' +
    '<button class="arm-vis-tab' + (_armMode_ === 'docente' ? ' active' : '') + '" data-mode="docente">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
    ' Por docente</button>' +
    '<button class="arm-vis-tab' + (_armMode_ === 'conflictos' ? ' active' : '') + '" data-mode="conflictos">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
    ' Conflictos ' + cfBadge + '</button>' +
    '</div>' +

    _armStatsHTML() +
    '<div id="arm-vis-content">' + _armTabHTML() + '</div>';
}

function _armTabHTML() {
  if (_armMode_ === 'grupo')      return _armGrupoHTML();
  if (_armMode_ === 'docente')    return _armDocenteHTML();
  if (_armMode_ === 'conflictos') return _armConflictosViewHTML();
  return '';
}

// ── VISTA POR GRUPO ───────────────────────────────────────────────────
function _armLabelGrupo(row, e) {
  var slot = e && e.isFirst ? (row[e.dia] || '') : '';
  var clr = _armColorUAC(row.uac);
  return '<span class="arm-tt-uac" style="color:' + clr.text + '">' + genEsc(row.uac || '?') + '</span>' +
         '<span class="arm-tt-meta">' + genEsc(row.docente || '—') + '</span>' +
         (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
}

function _armGrupoHTML() {
  var grupos = [], seen = {};
  _armEst_.forEach(function(r) {
    var g = String(r.grupo || '').trim();
    if (g && !seen[g]) { seen[g] = true; grupos.push(g); }
  });
  grupos.sort();
  var errFilas = {};
  _armConflictos_.errores.forEach(function(e) { if (e.fila) errFilas[e.fila] = true; });
  var selOpts = '<option value="">— Selecciona un grupo —</option>' +
    '<option value="__todos__"' + (_armGrupoSel_ === '__todos__' ? ' selected' : '') + '>📋 Todos los grupos</option>' +
    grupos.map(function(g) {
      return '<option value="' + genEsc(g) + '"' + (g === _armGrupoSel_ ? ' selected' : '') + '>' + genEsc(g) + '</option>';
    }).join('');

  var grid;
  if (_armGrupoSel_ === '__todos__') {
    var sections = grupos.map(function(g) {
      var filas = _armEst_.map(function(r, i) { r._fila_ = i + 1; return r; })
        .filter(function(r) { return String(r.grupo || '').trim() === g; });
      var tieneHor = filas.some(function(r) {
        return ['lunes','martes','miercoles','jueves','viernes'].some(function(d) { return !!r[d]; });
      });
      if (!tieneHor) return '';
      return '<div class="arm-grupo-section">' +
        '<div class="arm-grupo-section-title">' + genEsc(g) + '</div>' +
        _estTimetableGridHTML(filas, _armLabelGrupo, errFilas, _armColorUAC) +
        '</div>';
    }).filter(Boolean).join('');
    grid = sections || '<div class="gen-empty-state" style="margin-top:32px"><p>Ningún grupo tiene horario capturado todavía.</p></div>';
  } else if (_armGrupoSel_) {
    var filas = _armEst_.map(function(r, i) { r._fila_ = i + 1; return r; })
      .filter(function(r) { return String(r.grupo || '').trim() === _armGrupoSel_; });
    grid = _estTimetableGridHTML(filas, _armLabelGrupo, errFilas, _armColorUAC);
  } else {
    grid = '<div class="gen-empty-state" style="margin-top:32px"><p>Selecciona un grupo para ver su horario semanal.</p></div>';
  }

  return '<div class="arm-tt-page"><div class="arm-tt-sel-bar"><label class="gen-label">Grupo:</label>' +
    '<select id="arm-grupo-sel" class="gen-select" style="min-width:180px">' + selOpts + '</select></div>' +
    '<div id="arm-main-grid">' + grid + '</div></div>';
}

// ── VISTA POR DOCENTE ─────────────────────────────────────────────────
function _armDocenteHTML() {
  var docentes = [], seen = {};
  _armEst_.forEach(function(r) {
    var tipo = String(r.tipo_asignacion_docente || '').trim();
    if (tipo === 'Vacante') return;
    var d = String(r.docente || '').trim();
    if (d && !seen[d]) { seen[d] = true; docentes.push(d); }
  });
  docentes.sort();
  var errFilas = {};
  _armConflictos_.errores.forEach(function(e) { if (e.fila) errFilas[e.fila] = true; });
  var selOpts = '<option value="">— Selecciona un docente —</option>' +
    docentes.map(function(d) {
      return '<option value="' + genEsc(d) + '"' + (d === _armDocSel_ ? ' selected' : '') + '>' + genEsc(d) + '</option>';
    }).join('');
  var grid = _armDocSel_
    ? _estTimetableGridHTML(
        _armEst_.map(function(r, i) { r._fila_ = i + 1; return r; })
          .filter(function(r) {
            var tipo = String(r.tipo_asignacion_docente || '').trim();
            if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return false;
            return String(r.docente || '').trim() === _armDocSel_;
          }),
        function(row, e) {
          var slot = e && e.isFirst ? (row[e.dia] || '') : '';
          var clr = _armColorUAC(row.uac);
          return '<span class="arm-tt-uac" style="color:' + clr.text + '">' + genEsc(row.uac || '?') + '</span>' +
                 '<span class="arm-tt-meta">' + genEsc(row.grupo || '—') + '</span>' +
                 (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
        }, errFilas, _armColorUAC)
    : '<div class="gen-empty-state" style="margin-top:32px"><p>Selecciona un docente para ver su horario semanal.</p></div>';
  return '<div class="arm-tt-page"><div class="arm-tt-sel-bar"><label class="gen-label">Docente:</label>' +
    '<select id="arm-doc-sel" class="gen-select" style="min-width:230px">' + selOpts + '</select></div>' +
    '<div id="arm-main-grid">' + grid + '</div></div>';
}

// ── VISTA CONFLICTOS ──────────────────────────────────────────────────
function _armConflictosViewHTML() {
  var cf = _armConflictos_;
  if (!cf.errores.length && !cf.advertencias.length) {
    return '<div class="gen-empty-state" style="margin-top:64px">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" width="56" height="56"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<p style="color:#15803d;font-weight:700;font-size:17px;margin:12px 0 4px">Sin conflictos detectados</p>' +
      '<p class="gen-hint">Los horarios están bien. Edita en Estructura Educativa si necesitas ajustes.</p>' +
      '</div>';
  }
  var out = '<div style="padding:4px 0">';
  if (cf.errores.length) {
    out += '<div class="est-conflict-section"><h3 class="est-conflict-title est-err-title">Errores (' + cf.errores.length + ')</h3>' +
      '<ul class="est-conflict-list">' +
      cf.errores.map(function(e) {
        return '<li class="est-conflict-item est-item-err"><span class="est-cf-tipo">' + genEsc(e.tipo) + '</span> ' + genEsc(e.mensaje) + '</li>';
      }).join('') + '</ul></div>';
  }
  if (cf.advertencias.length) {
    out += '<div class="est-conflict-section"><h3 class="est-conflict-title est-warn-title">Advertencias (' + cf.advertencias.length + ')</h3>' +
      '<ul class="est-conflict-list">' +
      cf.advertencias.map(function(w) {
        return '<li class="est-conflict-item est-item-warn"><span class="est-cf-tipo">' + genEsc(w.tipo) + '</span> ' + genEsc(w.mensaje) + '</li>';
      }).join('') + '</ul></div>';
  }
  return out + '</div>';
}

// ── BIND ──────────────────────────────────────────────────────────────
function _armBind() {
  // Tabs de vista
  document.querySelectorAll('.arm-vis-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _armMode_ = btn.dataset.mode;
      document.querySelectorAll('.arm-vis-tab').forEach(function(b) {
        b.classList.toggle('active', b === btn);
      });
      var cont = document.getElementById('arm-vis-content');
      if (cont) cont.innerHTML = _armTabHTML();
      _armBindTab();
    });
  });

  // Botón actualizar
  var btnR = document.getElementById('arm-btn-refresh');
  if (btnR) btnR.addEventListener('click', function() { genNavTo('armado'); });

  _armBindTab();
}

function _armBindTab() {
  if (_armMode_ === 'grupo') {
    var sel = document.getElementById('arm-grupo-sel');
    if (!sel) return;
    sel.addEventListener('change', function() {
      _armGrupoSel_ = this.value;
      // "Todos los grupos" — re-render completo del tab
      if (_armGrupoSel_ === '__todos__') {
        var cont = document.getElementById('arm-vis-content');
        if (cont) { cont.innerHTML = _armGrupoHTML(); _armBindTab(); }
        return;
      }
      var grid = document.getElementById('arm-main-grid');
      if (!grid) return;
      var errFilas = {};
      _armConflictos_.errores.forEach(function(e) { if (e.fila) errFilas[e.fila] = true; });
      grid.innerHTML = _armGrupoSel_
        ? _estTimetableGridHTML(
            _armEst_.map(function(r, i) { r._fila_ = i + 1; return r; })
              .filter(function(r) { return String(r.grupo || '').trim() === _armGrupoSel_; }),
            _armLabelGrupo, errFilas, _armColorUAC)
        : '<div class="gen-empty-state" style="margin-top:32px"><p>Selecciona un grupo.</p></div>';
    });
  }
  if (_armMode_ === 'docente') {
    var selD = document.getElementById('arm-doc-sel');
    if (!selD) return;
    selD.addEventListener('change', function() {
      _armDocSel_ = this.value;
      var grid = document.getElementById('arm-main-grid');
      if (!grid) return;
      var errFilas = {};
      _armConflictos_.errores.forEach(function(e) { if (e.fila) errFilas[e.fila] = true; });
      grid.innerHTML = _armDocSel_
        ? _estTimetableGridHTML(
            _armEst_.map(function(r, i) { r._fila_ = i + 1; return r; })
              .filter(function(r) {
                var tipo = String(r.tipo_asignacion_docente || '').trim();
                if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return false;
                return String(r.docente || '').trim() === _armDocSel_;
              }),
            function(row, e) {
              var slot = e && e.isFirst ? (row[e.dia] || '') : '';
              var clr = _armColorUAC(row.uac);
              return '<span class="arm-tt-uac" style="color:' + clr.text + '">' + genEsc(row.uac || '?') + '</span>' +
                     '<span class="arm-tt-meta">' + genEsc(row.grupo || '—') + '</span>' +
                     (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
            }, errFilas, _armColorUAC)
        : '<div class="gen-empty-state" style="margin-top:32px"><p>Selecciona un docente.</p></div>';
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════
   CÓDIGO ORIGINAL DE ASIGNACIÓN INTERACTIVA (conservado como respaldo)
   ═════════════════════════════════════════════════════════════════════�� */

var _armadoCurrentGrupo_   = null;
var _armadoCurrentDocente_ = null;
var _armadoViewMode_       = 'grupo';   // 'grupo' | 'docente'
var _armadoCfg_            = null;      // {nBloques, horaIni, duracion, dias}

function _armadoHTML(grupos, nBloques, horaIni, duracion, dias) {
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Armado de Horarios</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong> &nbsp;·&nbsp; Versión: <strong>${genEsc(_genApp.version)}</strong></p>
  </div>
  <div class="gen-header-actions">
    <div class="gen-mat-view-toggle">
      <button class="gen-mat-vtab ${_armadoViewMode_==='grupo'?'active':''}" id="gen-arm-vtab-grupo">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Por grupo
      </button>
      <button class="gen-mat-vtab ${_armadoViewMode_==='docente'?'active':''}" id="gen-arm-vtab-docente">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Por docente
      </button>
    </div>
    <select id="gen-arm-version" class="gen-select" style="min-width:100px" title="Versión del horario">
      <option value="v1" ${_genApp.version==='v1'?'selected':''}>v1</option>
      <option value="v2" ${_genApp.version==='v2'?'selected':''}>v2</option>
      <option value="v3" ${_genApp.version==='v3'?'selected':''}>v3</option>
    </select>
    <button class="gen-btn gen-btn-sm gen-btn-secondary" id="gen-arm-precargar-btn" title="Genera la carga horaria a partir de la Estructura Educativa validada">⚡ Precargar desde Estructura</button>
    <button class="gen-btn gen-btn-secondary" id="gen-arm-conflictos-btn">Ver conflictos</button>
  </div>
</div>

<div class="gen-armado-layout">
  <aside class="gen-arm-sidebar" id="gen-arm-sidebar">
    ${_armadoSidebarGrupoHTML(grupos)}
  </aside>
  <main class="gen-arm-main">
    <div id="gen-arm-grid-wrapper" class="gen-arm-grid-placeholder">
      <p class="gen-muted">Selecciona un grupo para ver su horario.</p>
    </div>
  </main>
</div>`;
}

/* ── HTML de la barra lateral según modo ─────────────────────────── */
function _armadoSidebarGrupoHTML(grupos) {
  var list = grupos || (_genApp.grupos || []).filter(function(g) {
    return String(g.activo) !== 'false' && (!g.ciclo || g.ciclo === _genApp.ciclo);
  });
  return '<div class="gen-arm-sidebar-section">' +
    '<label class="gen-label">Grupo</label>' +
    '<select id="gen-arm-grupo" class="gen-select">' +
    '<option value="">-- Selecciona un grupo --</option>' +
    list.map(function(g) {
      return '<option value="' + genEsc(g.id) + '">' + genEsc(genLabelGrupo(g)) + '</option>';
    }).join('') +
    '</select></div>' +
    '<div class="gen-arm-sidebar-section" id="gen-arm-pool-wrapper" style="display:none">' +
    '<p class="gen-hint" style="margin-bottom:8px">Selecciona una materia y luego haz clic en un bloque del horario:</p>' +
    '<div id="gen-arm-pool" class="gen-arm-pool"></div>' +
    '</div>';
}

function _armadoSidebarDocenteHTML() {
  var docentes = (_genApp.docentes || [])
    .filter(function(d) { return String(d.activo) !== 'false'; })
    .sort(function(a, b) { return genNombreDocente(a).localeCompare(genNombreDocente(b)); });
  return '<div class="gen-arm-sidebar-section">' +
    '<label class="gen-label">Docente</label>' +
    '<select id="gen-arm-docente" class="gen-select">' +
    '<option value="">-- Selecciona un docente --</option>' +
    docentes.map(function(d) {
      return '<option value="' + genEsc(d.id) + '">' + genEsc(genNombreDocente(d)) + '</option>';
    }).join('') +
    '</select></div>' +
    '<div class="gen-arm-sidebar-section" id="gen-arm-pool-wrapper" style="display:none">' +
    '<p class="gen-hint" style="margin-bottom:8px">Selecciona una materia+grupo y luego haz clic en un bloque vacío:</p>' +
    '<div id="gen-arm-pool" class="gen-arm-pool"></div>' +
    '</div>';
}

function _armadoBind(nBloques, horaIni, duracion, dias) {
  document.getElementById('gen-arm-version').addEventListener('change', function() {
    _genApp.version = this.value;
    if (_armadoViewMode_ === 'grupo' && _armadoCurrentGrupo_) {
      _armadoCargarGrupo(_armadoCurrentGrupo_, nBloques, horaIni, duracion, dias);
    } else if (_armadoViewMode_ === 'docente' && _armadoCurrentDocente_) {
      _armadoCargarDocente(_armadoCurrentDocente_);
    }
  });

  document.getElementById('gen-arm-vtab-grupo').addEventListener('click', function() {
    if (_armadoViewMode_ !== 'grupo') _armadoSwitchMode('grupo');
  });
  document.getElementById('gen-arm-vtab-docente').addEventListener('click', function() {
    if (_armadoViewMode_ !== 'docente') _armadoSwitchMode('docente');
  });

  document.getElementById('gen-arm-conflictos-btn').addEventListener('click', function() {
    genNavTo('conflictos');
  });

  var btnPrecargar = document.getElementById('gen-arm-precargar-btn');
  if (btnPrecargar) btnPrecargar.addEventListener('click', _armadoPrecargarDesdeEstructura);

  _armadoBindGrupoSidebar(nBloques, horaIni, duracion, dias);
}

function _armadoSwitchMode(newMode) {
  _armadoViewMode_       = newMode;
  _armadoCurrentGrupo_   = null;
  _armadoCurrentDocente_ = null;

  var tabGrupo   = document.getElementById('gen-arm-vtab-grupo');
  var tabDocente = document.getElementById('gen-arm-vtab-docente');
  if (tabGrupo)   tabGrupo.classList.toggle('active', newMode === 'grupo');
  if (tabDocente) tabDocente.classList.toggle('active', newMode === 'docente');

  var sidebar = document.getElementById('gen-arm-sidebar');
  if (sidebar) {
    if (newMode === 'grupo') {
      var gruposCiclo = (_genApp.grupos || []).filter(function(g) {
        return String(g.activo) !== 'false' && (!g.ciclo || g.ciclo === _genApp.ciclo);
      });
      sidebar.innerHTML = _armadoSidebarGrupoHTML(gruposCiclo);
      var cfg = _armadoCfg_ || {};
      _armadoBindGrupoSidebar(cfg.nBloques, cfg.horaIni, cfg.duracion, cfg.dias);
    } else {
      sidebar.innerHTML = _armadoSidebarDocenteHTML();
      _armadoBindDocenteSidebar();
    }
  }

  var gw = document.getElementById('gen-arm-grid-wrapper');
  if (gw) {
    var msg = newMode === 'grupo'
      ? 'Selecciona un grupo para ver su horario.'
      : 'Selecciona un docente para ver su horario.';
    gw.className = 'gen-arm-grid-placeholder';
    gw.innerHTML = '<p class="gen-muted">' + msg + '</p>';
  }
}

function _armadoBindGrupoSidebar(nBloques, horaIni, duracion, dias) {
  var sel = document.getElementById('gen-arm-grupo');
  if (!sel) return;
  sel.addEventListener('change', function() {
    _armadoCurrentGrupo_ = this.value || null;
    if (_armadoCurrentGrupo_) {
      _armadoCargarGrupo(_armadoCurrentGrupo_, nBloques, horaIni, duracion, dias);
    } else {
      document.getElementById('gen-arm-grid-wrapper').innerHTML = '<p class="gen-muted">Selecciona un grupo para ver su horario.</p>';
      document.getElementById('gen-arm-pool-wrapper').style.display = 'none';
    }
  });
}

function _armadoBindDocenteSidebar() {
  var sel = document.getElementById('gen-arm-docente');
  if (!sel) return;
  sel.addEventListener('change', function() {
    _armadoCurrentDocente_ = this.value || null;
    if (_armadoCurrentDocente_) {
      _armadoCargarDocente(_armadoCurrentDocente_);
    } else {
      document.getElementById('gen-arm-grid-wrapper').innerHTML = '<p class="gen-muted">Selecciona un docente para ver su horario.</p>';
      document.getElementById('gen-arm-pool-wrapper').style.display = 'none';
    }
  });
}

function _armadoCargarGrupo(grupoId, nBloques, horaIni, duracion, dias) {
  var diasLabels = { LU:'Lunes', MA:'Martes', MI:'Miércoles', JU:'Jueves', VI:'Viernes', SA:'Sábado' };

  // Materias asignadas a este grupo via carga horaria
  var cargaGrupo = _genApp.carga.filter(function(c) { return String(c.grupo_id) === String(grupoId); });

  // Pool de materias disponibles
  var poolHtml = cargaGrupo.length === 0
    ? '<p class="gen-muted" style="font-size:12px">Sin carga horaria asignada. Ve a "Carga Horaria" primero.</p>'
    : cargaGrupo.map(function(c) {
        var m     = genById(_genApp.materias, c.materia_id);
        var d     = genById(_genApp.docentes, c.docente_id);
        var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
        return '<div class="gen-arm-pool-item" data-carga-id="'+genEsc(c.id)+'" data-materia-id="'+genEsc(c.materia_id)+'" data-docente-id="'+genEsc(c.docente_id||'')+'" style="border-left:4px solid '+color+'">'+
          '<strong style="color:'+color+'">'+(m ? genEsc(m.nombre) : '?')+'</strong>'+
          '<span>'+(d ? genEsc(genNombreDocente(d)) : 'Sin docente')+'</span>'+
          '</div>';
      }).join('');

  document.getElementById('gen-arm-pool').innerHTML = poolHtml;
  document.getElementById('gen-arm-pool-wrapper').style.display = '';

  // Construir grid
  var horariosGrupo = _genApp.horarios.filter(function(h) {
    return String(h.grupo_id) === String(grupoId) && h.version === _genApp.version;
  });

  // Índice: dia|bloque → horario entry
  var gridMap = {};
  horariosGrupo.forEach(function(h) { gridMap[h.dia + '|' + h.bloque] = h; });

  var thead = '<tr><th class="gen-arm-th-bloque">Bloque</th>' +
    dias.map(function(d) { return '<th>'+genEsc(diasLabels[d]||d)+'</th>'; }).join('') + '</tr>';

  // Calcular minuto de inicio una sola vez (parseo robusto)
  var _timeParts = String(horaIni || '07:00').split(':');
  var _startMin  = (parseInt(_timeParts[0], 10) || 7) * 60 + (parseInt(_timeParts[1], 10) || 0);
  var _dur       = parseInt(duracion, 10) || 50;

  var tbody = '';
  for (var b = 1; b <= nBloques; b++) {
    var bMin = _startMin + (b - 1) * _dur;
    var bH   = Math.floor(bMin / 60) % 24;
    var bM   = bMin % 60;
    var bloqueLabel = 'B' + b + ' ' + String(bH).padStart(2,'0') + ':' + String(bM).padStart(2,'0');
    tbody += '<tr><td class="gen-arm-bloque-label">'+bloqueLabel+'</td>';
    dias.forEach(function(dia) {
      var key    = dia + '|' + String(b);
      var entry  = gridMap[key];
      var cellContent = '';
      var cellClass = 'gen-arm-cell';
      if (entry) {
        var m = genById(_genApp.materias, entry.materia_id);
        var d = genById(_genApp.docentes, entry.docente_id);
        var a = genById(_genApp.aulas, entry.aula_id);
        var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
        cellContent = '<div class="gen-arm-cell-content" style="background:'+color+'20;border-left:3px solid '+color+'">'+
          '<span class="gen-arm-cell-mat">'+(m ? genEsc(m.nombre) : '?')+'</span>'+
          '<span class="gen-arm-cell-doc">'+(d ? genEsc(d.apellido_paterno||d.nombre) : '')+'</span>'+
          (a ? '<span class="gen-arm-cell-aula">'+genEsc(a.clave||a.nombre)+'</span>' : '')+
          '<button class="gen-arm-cell-del" onclick="genArmadoLimpiarBloque(\''+dia+'\','+b+',\''+grupoId+'\')" title="Quitar">×</button>'+
          '</div>';
        cellClass += ' gen-arm-cell-filled';
      } else {
        cellContent = '<span class="gen-arm-cell-empty">+</span>';
      }
      tbody += '<td class="'+cellClass+'" data-dia="'+dia+'" data-bloque="'+b+'" data-grupo="'+grupoId+'" onclick="genArmadoClickCell(this,\''+dia+'\','+b+',\''+grupoId+'\')">'+cellContent+'</td>';
    });
    tbody += '</tr>';
  }

  var gw = document.getElementById('gen-arm-grid-wrapper');
  gw.className = '';
  gw.innerHTML = `
<div class="gen-table-wrapper gen-arm-table-wrapper">
  <table class="gen-table gen-arm-table">
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
</div>`;

  // Bind pool items
  document.querySelectorAll('.gen-arm-pool-item').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('.gen-arm-pool-item').forEach(function(x) { x.classList.remove('selected'); });
      this.classList.add('selected');
    });
  });
}

// Clic en celda del grid → asignar materia seleccionada del pool
function genArmadoClickCell(cell, dia, bloque, grupoId) {
  var selectedPool = document.querySelector('.gen-arm-pool-item.selected');
  if (!selectedPool) {
    if (cell.classList.contains('gen-arm-cell-filled')) return; // ya tiene contenido, ignora
    genToast('Selecciona primero una materia del panel izquierdo.', 'info');
    return;
  }

  var materiaId  = selectedPool.dataset.materiaId;
  var docenteId  = selectedPool.dataset.docenteId || '';

  _armadoAbrirAsignacion(dia, bloque, grupoId, materiaId, docenteId);
}

function _armadoAbrirAsignacion(dia, bloque, grupoId, materiaId, docenteId) {
  var m     = genById(_genApp.materias, materiaId);
  var color = m ? genGetMateriaColor(m.id) : '#94a3b8';

  var aulaOpts = '<option value="">Sin aula</option>' + _genApp.aulas
    .filter(function(a) { return String(a.activo) !== 'false'; })
    .map(function(a) { return '<option value="'+genEsc(a.id)+'">'+genEsc(a.clave||a.nombre)+'</option>'; }).join('');

  var docenteOpts = '<option value="">Sin docente</option>' + _genApp.docentes
    .filter(function(d) { return String(d.activo) !== 'false'; })
    .map(function(d) { return '<option value="'+genEsc(d.id)+'" '+(String(d.id)===String(docenteId)?'selected':'')+'>'+genEsc(genNombreDocente(d))+'</option>'; }).join('');

  _genModal.open(
    'Asignar bloque',
    `<div style="padding:8px 0">
      <div class="gen-arm-preview-chip" style="background:${color}20;border-left:4px solid ${color};padding:8px 12px;border-radius:6px;margin-bottom:16px">
        <strong style="color:${color}">${m ? genEsc(m.nombre) : '?'}</strong>
        &nbsp;·&nbsp; Bloque ${bloque} &nbsp;·&nbsp; ${dia}
      </div>
      <div class="gen-form-grid-2">
        <div class="gen-form-group gen-span-2">
          <label class="gen-label">Docente</label>
          <select id="ga-docente" class="gen-select">${docenteOpts}</select>
        </div>
        <div class="gen-form-group gen-span-2">
          <label class="gen-label">Aula</label>
          <select id="ga-aula" class="gen-select">${aulaOpts}</select>
        </div>
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="ga-asignar">Asignar</button>`
  );

  document.getElementById('ga-asignar').addEventListener('click', async function() {
    var record = {
      ciclo:      _genApp.ciclo,
      version:    _genApp.version,
      grupo_id:   grupoId,
      dia:        dia,
      bloque:     String(bloque),
      materia_id: materiaId,
      docente_id: document.getElementById('ga-docente').value,
      aula_id:    document.getElementById('ga-aula').value
    };
    genRequireAdmin(async function() {
      var btn = document.getElementById('ga-asignar');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await genAPI.saveHorarioFila(_genApp.adminKey, record);
        _genModal.close();
        genToast('Bloque asignado.', 'ok');
        // Refrescar horarios y reconstruir grid
        _genApp.horarios = await genAPI.getHorarios(_genApp.ciclo, _genApp.version, true);
        var cfg = await genAPI.getConfig();
        var nBloques = parseInt(cfg.num_bloques || '8');
        var dias     = (cfg.dias_semana || 'LU,MA,MI,JU,VI').split(',').map(function(d){ return d.trim(); });
        var duracion = parseInt(cfg.duracion_bloque || '50');
        _armadoCargarGrupo(grupoId, nBloques, _cfgCleanTime(cfg.hora_inicio, '07:00'), duracion, dias);
      } catch(err) {
        genToast('Error: ' + err.message, 'error');
        if (err.message.includes('administrador')) _genApp.adminKey = null;
        btn.disabled = false; btn.textContent = 'Asignar';
      }
    });
  });
}

/**
 * Resuelve coincidencias UAC→materia, docente→id y grupo→id usando los
 * catálogos locales con normalización. Devuelve hints + listas sin-match.
 *
 * Estrategias de matching por tipo:
 *  UAC     → nombre normalizado, luego clave, luego subconjunto de palabras
 *  Docente → nombre completo normalizado, luego solo apellido paterno
 *  Grupo   → clave del catálogo (g.clave), genLabelGrupo ("1°A"),
 *             g.grupo solo ("A"), compuesto grado+grupo ("1A", "101"),
 *             prefijo de turno + compuesto ("M1A", "M101"), etc.
 */
function _armadoResolverMatchHints_() {
  var materias = _genApp.materias || [];
  var docentes = _genApp.docentes || [];
  var grupos   = _genApp.grupos   || [];
  // _estData sólo existe en mod_estructura.js; aquí usamos el caché del API.
  // Nota: Array vacío [] también es válido — no usar !estData como guard.
  var estData  = (Array.isArray(_GEN_CACHE_.estructura) ? _GEN_CACHE_.estructura : []);

  /* ── índice de materias ─────────────────────────────────────────── */
  var matPorNombre = {};
  var matPorClave  = {};
  materias.forEach(function(m) {
    var n = genNormStr(m.nombre || '');
    var c = genNormStr(m.clave  || '');
    if (n) matPorNombre[n] = m.id;
    if (c) matPorClave[c]  = m.id;
  });

  /* ── índice de docentes ─────────────────────────────────────────── */
  var docPorNombre = {};
  docentes.forEach(function(d) {
    docPorNombre[genNormStr(genNombreDocente(d))] = d.id;
    // también por apellido paterno solo (nombres cortos en estructura)
    if (d.apellido_paterno) {
      var ape = genNormStr(d.apellido_paterno);
      if (ape && !docPorNombre[ape]) docPorNombre[ape] = d.id;
    }
  });

  /* ── índice de grupos (múltiples estrategias) ───────────────────── */
  // Un solo mapa "clave normalizada → grupo_id" con todas las formas posibles.
  var grpIdx = {};
  grupos.forEach(function(g) {
    function addGrp(k) {
      var nk = genNormStr(String(k || ''));
      if (nk && !grpIdx[nk]) grpIdx[nk] = g.id;
    }
    addGrp(genLabelGrupo(g));                             // "1°a"
    if (g.clave)  addGrp(g.clave);                       // "m101", "1a", etc.
    if (g.grupo) {
      addGrp(g.grupo);                                    // "a"
      addGrp(String(g.grado || '') + g.grupo);            // "1a"
      addGrp(String(g.grado || '') + '0' + g.grupo);     // "101"
      // con iniciales de turno: "m"=matutino, "v"=vespertino
      var tp = g.turno ? genNormStr(g.turno).charAt(0) : '';
      if (tp) {
        addGrp(tp + String(g.grado || '') + g.grupo);          // "m1a"
        addGrp(tp + String(g.grado || '') + '0' + g.grupo);   // "m101"
      }
    }
  });

  /* ── sets únicos desde estructura ──────────────────────────────── */
  var uacSet   = {};
  var docSet   = {};
  var grupoSet = {};
  estData.forEach(function(row) {
    var uac = String(row.uac     || '').trim();
    var doc = String(row.docente || '').trim();
    var grp = String(row.grupo   || '').trim();
    if (uac) uacSet[uac]   = true;
    if (doc) docSet[doc]   = true;
    if (grp) grupoSet[grp] = true;
  });

  var matchHints   = {};
  var docenteHints = {};
  var grupoHints   = {};
  var sinMaterias  = [];
  var sinDocentes  = [];
  var sinGrupos    = [];

  /* resolver UAC → materia_id */
  Object.keys(uacSet).forEach(function(uac) {
    var n  = genNormStr(uac);
    var id = matPorNombre[n] || matPorClave[n];
    // fuzzy: la materia está contenida en el UAC o viceversa (mín 5 chars)
    if (!id) {
      for (var k in matPorNombre) {
        if (k.length >= 5 && (n === k || n.indexOf(k) !== -1 || k.indexOf(n) !== -1)) {
          id = matPorNombre[k]; break;
        }
      }
    }
    if (id) matchHints[uac] = id;
    else    sinMaterias.push(uac);
  });

  /* resolver docente → docente_id */
  Object.keys(docSet).forEach(function(doc) {
    var n  = genNormStr(doc);
    var id = docPorNombre[n];
    // intenta primer token (apellido paterno)
    if (!id) {
      var tok = n.split(/\s+/)[0];
      if (tok && tok.length >= 3) id = docPorNombre[tok];
    }
    if (id) docenteHints[doc] = id;
    else    sinDocentes.push(doc);
  });

  /* resolver grupo → grupo_id */
  Object.keys(grupoSet).forEach(function(gStr) {
    var n  = genNormStr(gStr);
    var id = grpIdx[n];
    // quitar prefijo de turno si no hubo match directo
    if (!id) {
      var sinPref = n.replace(/^[mvts]/, '').trim();
      id = grpIdx[sinPref];
    }
    if (id) grupoHints[gStr] = id;
    else    sinGrupos.push(gStr);
  });

  /* ── diagnóstico en consola ─────────────────────────────────────── */
  console.group('[Precargar desde Estructura] diagnóstico');
  console.log('Filas en estData:', estData.length);
  console.log('UACs únicas:', Object.keys(uacSet).length,
    '| resueltas:', Object.keys(matchHints).length, '| sin match:', sinMaterias);
  console.log('Docentes únicos:', Object.keys(docSet).length,
    '| resueltos:', Object.keys(docenteHints).length, '| sin match:', sinDocentes);
  console.log('Grupos únicos:', Object.keys(grupoSet).length,
    '| resueltos:', Object.keys(grupoHints).length, '| sin match:', sinGrupos);
  console.log('Claves de grupo en catálogo:', Object.keys(grpIdx));
  console.log('grupoHints enviados:', grupoHints);
  console.log('matchHints (UAC→id):', matchHints);
  if (estData.length > 0) console.log('Muestra fila estructura[0]:', estData[0]);
  console.groupEnd();

  return {
    matchHints:   matchHints,
    docenteHints: docenteHints,
    grupoHints:   grupoHints,
    sinMaterias:  sinMaterias,
    sinDocentes:  sinDocentes,
    sinGrupos:    sinGrupos,
    _totalRows:   estData.length,
    _estSample:   estData.slice(0, 3),
    _nUac:        Object.keys(uacSet).length,
    _nDoc:        Object.keys(docSet).length,
    _nGrp:        Object.keys(grupoSet).length
  };
}

/**
 * Genera la carga horaria desde la Estructura Educativa validada del ciclo actual.
 * Muestra un panel de progreso en tiempo real dentro de un modal dedicado.
 */
async function _armadoPrecargarDesdeEstructura() {
  genRequireAdmin(async function() {

    /* ── Abrir modal de progreso inmediatamente ─────────────────────── */
    _genModal.open(
      '⚡ Precargar desde Estructura',
      '<div style="min-width:480px;max-width:620px">' +
        '<p class="gen-prec-subtitle">Ciclo: <strong>' + genEsc(_genApp.ciclo) + '</strong>' +
        (_genApp.periodo ? ' &nbsp;·&nbsp; Periodo <strong>' + genEsc(_genApp.periodo) + '</strong>' : '') +
        '</p>' +
        '<div class="gen-prec-log" id="gen-prec-log"></div>' +
        '<div id="gen-prec-actions"></div>' +
      '</div>',
      '<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cerrar</button>'
    );

    /* ── PASO 1: Cargar estructura ──────────────────────────────────── */
    var s1 = _precLog('Cargando Estructura Educativa…', 'pending');
    var periodoOriginal = _genApp.periodo;
    _genApp.periodo = '';
    var cargaOk = false;
    try {
      await genAPI.getEstructura(_genApp.ciclo, true);
      var nFilas = Array.isArray(_GEN_CACHE_.estructura) ? _GEN_CACHE_.estructura.length : 0;
      _precUpdate(s1, nFilas + ' filas cargadas desde Estructura Educativa', 'ok');
      cargaOk = true;
    } catch(e) {
      _precUpdate(s1, 'Error al cargar la estructura: ' + e.message, 'error');
    } finally {
      _genApp.periodo = periodoOriginal;
    }
    if (!cargaOk) return;

    /* ── PASO 2: Verificar datos ────────────────────────────────────── */
    var nFilas = Array.isArray(_GEN_CACHE_.estructura) ? _GEN_CACHE_.estructura.length : 0;
    if (nFilas === 0) {
      _precLog('No hay filas en la Estructura para el ciclo ' + genEsc(_genApp.ciclo) + '.', 'error');
      _precLog('Ve a Estructura Educativa y verifica que haya datos para este ciclo.', 'info');
      return;
    }

    /* ── PASO 3: Resolver coincidencias (sync, yield antes para pintar) */
    var s2 = _precLog('Resolviendo coincidencias con catálogos…', 'pending');
    await new Promise(function(r) { setTimeout(r, 40); });
    var hints = _armadoResolverMatchHints_();
    _precUpdate(s2, 'Coincidencias procesadas', 'ok');

    /* ── PASO 4: Mostrar resumen por categoría ──────────────────────── */
    var nMatR = Object.keys(hints.matchHints).length;
    var nDocR = Object.keys(hints.docenteHints).length;
    var nGrpR = Object.keys(hints.grupoHints).length;

    _precLog(
      'UACs: <strong>' + nMatR + ' resueltas</strong> de ' + hints._nUac + ' únicas' +
      (hints.sinMaterias.length ? ' — <span class="gen-prec-warn">' + hints.sinMaterias.length + ' sin coincidencia</span>' : ''),
      hints.sinMaterias.length ? 'warn' : 'ok'
    );
    if (hints.sinMaterias.length) _precLogItems(hints.sinMaterias, '#d97706');

    _precLog(
      'Docentes: <strong>' + nDocR + ' resueltos</strong> de ' + hints._nDoc + ' únicos' +
      (hints.sinDocentes.length ? ' — <span class="gen-prec-warn">' + hints.sinDocentes.length + ' sin coincidencia</span>' : ''),
      hints.sinDocentes.length ? 'warn' : 'ok'
    );
    if (hints.sinDocentes.length) _precLogItems(hints.sinDocentes, '#7c3aed');

    _precLog(
      'Grupos: <strong>' + nGrpR + ' resueltos</strong> de ' + hints._nGrp + ' únicos' +
      (hints.sinGrupos.length ? ' — <span class="gen-prec-warn">' + hints.sinGrupos.length + ' sin coincidencia</span>' : ''),
      hints.sinGrupos.length ? 'warn' : 'ok'
    );
    if (hints.sinGrupos.length) {
      _precLogItems(hints.sinGrupos, '#dc2626');
      /* Mostrar referencia del catálogo para ayudar a corregir */
      var catRef = _genApp.grupos.slice(0, 15).map(function(g) {
        return genLabelGrupo(g) + (g.clave ? '[' + g.clave + ']' : '');
      }).join('  ');
      _precLog('Grupos en catálogo: ' + genEsc(catRef), 'info');
    }

    /* ── PASO 5: Botones de confirmación ────────────────────────────── */
    var actDiv = document.getElementById('gen-prec-actions');
    if (!actDiv) return;
    actDiv.className = 'gen-prec-confirm-row';
    actDiv.innerHTML =
      '<span style="font-size:0.8rem;color:#64748b">Las asignaciones existentes <em>no</em> se eliminan.</span>' +
      '<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>' +
      '<button class="gen-btn gen-btn-primary" id="gen-prec-btn-gen">Generar asignaciones</button>';

    document.getElementById('gen-prec-btn-gen').addEventListener('click', async function() {
      actDiv.innerHTML = '';   // quitar botones durante la operación

      /* ── PASO 6: Llamar al backend ──────────────────────────────── */
      var s3 = _precLog('Enviando datos al servidor…', 'pending');
      try {
        var res = await genAPI.estructuraACarga(_genApp.adminKey, _genApp.ciclo, hints);
        _precUpdate(s3, (res.message || 'Proceso completado') + '.', 'ok');

        /* Omitidos del backend */
        if (res.sin_match && res.sin_match.length) {
          _precLog(res.sin_match.length + ' registro(s) omitidos por el servidor:', 'warn');
          _precLogItems(res.sin_match.slice(0, 40).map(String), '#64748b');
        }

        /* ── PASO 7: Refrescar carga ──────────────────────────────── */
        var s4 = _precLog('Actualizando carga horaria…', 'pending');
        _genApp.carga = await genAPI.getCarga(_genApp.ciclo, true);
        _precUpdate(s4, _genApp.carga.length + ' asignaciones en total para el ciclo.', 'ok');

        /* Refrescar pool si hay grupo activo */
        if (_armadoCurrentGrupo_) _armadoRefreshPool();

        _precLog('Proceso finalizado correctamente.', 'ok');

      } catch(err) {
        _precLog('Error: ' + err.message, 'error');
      }
    });
  });
}

/* ── Helpers del panel de progreso ─────────────────────────────────── */

/** Añade una línea al log y devuelve el elemento para actualizarlo después. */
function _precLog(msg, state) {
  var log = document.getElementById('gen-prec-log');
  if (!log) return null;
  var el = document.createElement('div');
  el.className = 'gen-prec-step gen-prec-s-' + state;
  el.innerHTML = _precStepHTML(msg, state);
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

/** Actualiza un elemento de log ya existente. */
function _precUpdate(el, msg, state) {
  if (!el) return;
  el.className = 'gen-prec-step gen-prec-s-' + state;
  el.innerHTML = _precStepHTML(msg, state);
  var log = document.getElementById('gen-prec-log');
  if (log) log.scrollTop = log.scrollHeight;
}

/** HTML interno de un paso del log. */
function _precStepHTML(msg, state) {
  var icons = {
    pending: '<span class="gen-prec-spinner"></span>',
    ok:      '✓',
    error:   '✗',
    warn:    '⚠',
    info:    '·'
  };
  return '<span class="gen-prec-icon">' + (icons[state] || '·') + '</span>' +
         '<span class="gen-prec-msg">' + msg + '</span>';
}

/** Añade una fila compacta con lista de ítems (para sin-match). */
function _precLogItems(items, color) {
  var log = document.getElementById('gen-prec-log');
  if (!log || !items.length) return;
  var uniq = items.filter(function(v, i, a) { return a.indexOf(v) === i; });
  var shown = uniq.slice(0, 20).map(function(x) {
    return '<span class="gen-prec-tag">' + genEsc(String(x)) + '</span>';
  }).join('');
  var more  = uniq.length > 20
    ? '<span style="color:#94a3b8;font-size:0.74rem"> y ' + (uniq.length - 20) + ' más…</span>'
    : '';
  var el = document.createElement('div');
  el.className = 'gen-prec-step gen-prec-s-detail';
  el.innerHTML = '<span class="gen-prec-icon" style="color:' + color + '">↳</span>' +
    '<span class="gen-prec-msg" style="flex-wrap:wrap;display:flex;gap:3px;align-items:center">' +
    shown + more + '</span>';
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

/** Refresca el pool de materias del grupo activo en el armado. */
function _armadoRefreshPool() {
  var poolWrap = document.getElementById('gen-arm-pool-wrapper');
  if (!poolWrap || !_armadoCurrentGrupo_) return;
  var cargaGrupo = _genApp.carga.filter(function(c) {
    return String(c.grupo_id) === String(_armadoCurrentGrupo_);
  });
  document.getElementById('gen-arm-pool').innerHTML = cargaGrupo.length === 0
    ? '<p class="gen-muted" style="font-size:12px">Sin carga horaria asignada para este grupo.</p>'
    : cargaGrupo.map(function(c) {
        var m     = genById(_genApp.materias, c.materia_id);
        var d     = genById(_genApp.docentes, c.docente_id);
        var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
        return '<div class="gen-arm-pool-item" data-carga-id="'+genEsc(c.id)+'" ' +
          'data-materia-id="'+genEsc(c.materia_id)+'" data-docente-id="'+genEsc(c.docente_id||'')+'" ' +
          'style="border-left:4px solid '+color+'">' +
          '<strong style="color:'+color+'">'+(m ? genEsc(m.nombre) : '?')+'</strong>' +
          '<span>'+(d ? genEsc(genNombreDocente(d)) : 'Sin docente')+'</span>' +
          '</div>';
      }).join('');
  document.querySelectorAll('.gen-arm-pool-item').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('.gen-arm-pool-item').forEach(function(x) { x.classList.remove('selected'); });
      this.classList.add('selected');
    });
  });
  poolWrap.style.display = '';
}

/* ── Modo Por Docente ───────────────────────────────────────────────── */

function _armadoCargarDocente(docenteId) {
  var cfg      = _armadoCfg_ || {};
  var nBloques = cfg.nBloques || 8;
  var horaIni  = cfg.horaIni  || '07:00';
  var duracion = cfg.duracion || 50;
  var dias     = cfg.dias     || ['LU','MA','MI','JU','VI'];
  var diasLabels = { LU:'Lunes', MA:'Martes', MI:'Miércoles', JU:'Jueves', VI:'Viernes', SA:'Sábado' };

  // Pool: todas las asignaciones de carga del docente (materia + grupo)
  var cargaDocente = _genApp.carga.filter(function(c) {
    return String(c.docente_id) === String(docenteId);
  });

  var poolHtml = cargaDocente.length === 0
    ? '<p class="gen-muted" style="font-size:12px">Sin carga horaria asignada para este docente.</p>'
    : cargaDocente.map(function(c) {
        var m     = genById(_genApp.materias, c.materia_id);
        var g     = genById(_genApp.grupos,   c.grupo_id);
        var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
        return '<div class="gen-arm-pool-item" ' +
          'data-carga-id="' + genEsc(c.id) + '" ' +
          'data-materia-id="' + genEsc(c.materia_id) + '" ' +
          'data-grupo-id="' + genEsc(c.grupo_id || '') + '" ' +
          'style="border-left:4px solid ' + color + '">' +
          '<strong style="color:' + color + '">' + (m ? genEsc(m.nombre) : '?') + '</strong>' +
          '<span>' + (g ? genEsc(genLabelGrupo(g)) : 'Sin grupo') + '</span>' +
          '</div>';
      }).join('');

  document.getElementById('gen-arm-pool').innerHTML = poolHtml;
  document.getElementById('gen-arm-pool-wrapper').style.display = '';

  // Grid: horarios donde aparece este docente
  var horariosDocente = _genApp.horarios.filter(function(h) {
    return String(h.docente_id) === String(docenteId) && h.version === _genApp.version;
  });

  var gridMap = {};
  horariosDocente.forEach(function(h) { gridMap[h.dia + '|' + h.bloque] = h; });

  var thead = '<tr><th class="gen-arm-th-bloque">Bloque</th>' +
    dias.map(function(d) { return '<th>' + genEsc(diasLabels[d] || d) + '</th>'; }).join('') + '</tr>';

  var _timeParts = String(horaIni || '07:00').split(':');
  var _startMin  = (parseInt(_timeParts[0], 10) || 7) * 60 + (parseInt(_timeParts[1], 10) || 0);
  var _dur       = parseInt(duracion, 10) || 50;

  var tbody = '';
  for (var b = 1; b <= nBloques; b++) {
    var bMin = _startMin + (b - 1) * _dur;
    var bH   = Math.floor(bMin / 60) % 24;
    var bM   = bMin % 60;
    var bloqueLabel = 'B' + b + ' ' + String(bH).padStart(2, '0') + ':' + String(bM).padStart(2, '0');
    tbody += '<tr><td class="gen-arm-bloque-label">' + bloqueLabel + '</td>';
    dias.forEach(function(dia) {
      var key   = dia + '|' + String(b);
      var entry = gridMap[key];
      var cellContent = '';
      var cellClass   = 'gen-arm-cell';
      if (entry) {
        var m = genById(_genApp.materias, entry.materia_id);
        var g = genById(_genApp.grupos,   entry.grupo_id);
        var a = genById(_genApp.aulas,    entry.aula_id);
        var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
        cellContent =
          '<div class="gen-arm-cell-content" style="background:' + color + '20;border-left:3px solid ' + color + '">' +
          '<span class="gen-arm-cell-mat">' + (m ? genEsc(m.nombre) : '?') + '</span>' +
          '<span class="gen-arm-cell-doc">' + (g ? genEsc(genLabelGrupo(g)) : '') + '</span>' +
          (a ? '<span class="gen-arm-cell-aula">' + genEsc(a.clave || a.nombre) + '</span>' : '') +
          '<button class="gen-arm-cell-del" onclick="genArmadoLimpiarBloqueDocente(\'' + dia + '\',' + b + ',\'' + docenteId + '\')" title="Quitar">×</button>' +
          '</div>';
        cellClass += ' gen-arm-cell-filled';
      } else {
        cellContent = '<span class="gen-arm-cell-empty">+</span>';
      }
      tbody += '<td class="' + cellClass + '" data-dia="' + dia + '" data-bloque="' + b + '" data-docente="' + docenteId + '" onclick="genArmadoClickCellDocente(this,\'' + dia + '\',' + b + ',\'' + docenteId + '\')">' + cellContent + '</td>';
    });
    tbody += '</tr>';
  }

  var gw = document.getElementById('gen-arm-grid-wrapper');
  gw.className = '';
  gw.innerHTML =
    '<div class="gen-table-wrapper gen-arm-table-wrapper">' +
    '<table class="gen-table gen-arm-table">' +
    '<thead>' + thead + '</thead>' +
    '<tbody>' + tbody + '</tbody>' +
    '</table></div>';

  document.querySelectorAll('.gen-arm-pool-item').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('.gen-arm-pool-item').forEach(function(x) { x.classList.remove('selected'); });
      this.classList.add('selected');
    });
  });
}

function genArmadoClickCellDocente(cell, dia, bloque, docenteId) {
  var selectedPool = document.querySelector('.gen-arm-pool-item.selected');
  if (!selectedPool) {
    if (cell.classList.contains('gen-arm-cell-filled')) return;
    genToast('Selecciona primero una materia+grupo del panel izquierdo.', 'info');
    return;
  }
  var materiaId = selectedPool.dataset.materiaId;
  var grupoId   = selectedPool.dataset.grupoId || '';
  _armadoAbrirAsignacionDocente(dia, bloque, docenteId, grupoId, materiaId);
}

function _armadoAbrirAsignacionDocente(dia, bloque, docenteId, grupoId, materiaId) {
  var m     = genById(_genApp.materias, materiaId);
  var d     = genById(_genApp.docentes, docenteId);
  var g     = genById(_genApp.grupos,   grupoId);
  var color = m ? genGetMateriaColor(m.id) : '#94a3b8';

  var aulaOpts = '<option value="">Sin aula</option>' + _genApp.aulas
    .filter(function(a) { return String(a.activo) !== 'false'; })
    .map(function(a) {
      return '<option value="' + genEsc(a.id) + '">' + genEsc(a.clave || a.nombre) + '</option>';
    }).join('');

  _genModal.open(
    'Asignar bloque',
    '<div style="padding:8px 0">' +
      '<div class="gen-arm-preview-chip" style="background:' + color + '20;border-left:4px solid ' + color + ';padding:8px 12px;border-radius:6px;margin-bottom:16px">' +
        '<strong style="color:' + color + '">' + (m ? genEsc(m.nombre) : '?') + '</strong>' +
        ' &nbsp;·&nbsp; ' + (g ? genEsc(genLabelGrupo(g)) : '?') +
        ' &nbsp;·&nbsp; Bloque ' + bloque + ' &nbsp;·&nbsp; ' + dia +
      '</div>' +
      '<div class="gen-form-grid-2">' +
        '<div class="gen-form-group gen-span-2" style="background:#f8fafc;border-radius:6px;padding:8px 12px">' +
          '<span class="gen-label" style="display:block;margin-bottom:2px">Docente</span>' +
          '<span style="font-weight:600">' + (d ? genEsc(genNombreDocente(d)) : '?') + '</span>' +
        '</div>' +
        '<div class="gen-form-group gen-span-2">' +
          '<label class="gen-label">Aula</label>' +
          '<select id="ga-aula" class="gen-select">' + aulaOpts + '</select>' +
        '</div>' +
      '</div>' +
    '</div>',
    '<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>' +
    '<button class="gen-btn gen-btn-primary" id="ga-asignar">Asignar</button>'
  );

  document.getElementById('ga-asignar').addEventListener('click', async function() {
    var record = {
      ciclo:      _genApp.ciclo,
      version:    _genApp.version,
      grupo_id:   grupoId,
      dia:        dia,
      bloque:     String(bloque),
      materia_id: materiaId,
      docente_id: docenteId,
      aula_id:    document.getElementById('ga-aula').value
    };
    genRequireAdmin(async function() {
      var btn = document.getElementById('ga-asignar');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await genAPI.saveHorarioFila(_genApp.adminKey, record);
        _genModal.close();
        genToast('Bloque asignado.', 'ok');
        _genApp.horarios = await genAPI.getHorarios(_genApp.ciclo, _genApp.version, true);
        _armadoCargarDocente(docenteId);
      } catch(err) {
        genToast('Error: ' + err.message, 'error');
        if (err.message.includes('administrador')) _genApp.adminKey = null;
        btn.disabled = false; btn.textContent = 'Asignar';
      }
    });
  });
}

async function genArmadoLimpiarBloqueDocente(dia, bloque, docenteId) {
  var entry = _genApp.horarios.find(function(h) {
    return String(h.docente_id) === String(docenteId) &&
           h.dia === dia &&
           String(h.bloque) === String(bloque) &&
           h.version === _genApp.version;
  });
  if (!entry) return;

  genRequireAdmin(async function() {
    try {
      await genAPI.deleteHorarioFila(_genApp.adminKey, entry.id);
      genToast('Bloque liberado.', 'ok');
      _genApp.horarios = await genAPI.getHorarios(_genApp.ciclo, _genApp.version, true);
      _armadoCargarDocente(docenteId);
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
    }
  });
}

async function genArmadoLimpiarBloque(dia, bloque, grupoId) {
  // Buscar el registro de horario
  var entry = _genApp.horarios.find(function(h) {
    return String(h.grupo_id) === String(grupoId) &&
           h.dia === dia &&
           String(h.bloque) === String(bloque) &&
           h.version === _genApp.version;
  });
  if (!entry) return;

  genRequireAdmin(async function() {
    try {
      await genAPI.deleteHorarioFila(_genApp.adminKey, entry.id);
      genToast('Bloque liberado.', 'ok');
      _genApp.horarios = await genAPI.getHorarios(_genApp.ciclo, _genApp.version, true);
      var cfg = await genAPI.getConfig();
      var nBloques = parseInt(cfg.num_bloques || '8');
      var dias     = (cfg.dias_semana || 'LU,MA,MI,JU,VI').split(',').map(function(d){ return d.trim(); });
      var duracion = parseInt(cfg.duracion_bloque || '50');
      _armadoCargarGrupo(grupoId, nBloques, _cfgCleanTime(cfg.hora_inicio, '07:00'), duracion, dias);
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
    }
  });
}
