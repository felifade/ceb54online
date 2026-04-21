/* ── mod_estructura.js — Estructura Educativa ────────────────────── */

genRegisterModule('estructura', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '<p>Selecciona un ciclo escolar para gestionar la estructura educativa.</p>' +
        '<button class="gen-btn gen-btn-primary" onclick="document.getElementById(\'gen-ciclo-btn\').click()">Seleccionar ciclo</button>' +
        '</div>';
      return;
    }
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando estructura educativa…</span></div>';
    try {
      var results = await Promise.all([
        genAPI.getGrupos(),
        genAPI.getMaterias(),
        genAPI.getDocentes(),
        genAPI.getEstructura(_genApp.ciclo, true),
        genAPI.getEstadoEstructura(_genApp.ciclo, true)
      ]);
      _genApp.grupos   = results[0];
      _genApp.materias = results[1];
      _genApp.docentes = results[2];
      _estData    = results[3].slice();
      // El estado es independiente por periodo (la clave incluye el periodo)
      _estEstado         = results[4].estado || 'EN_CAPTURA';
      _estPeriodo        = _genApp.periodo || '';
      _estDirty          = false;
      _estView           = 'grid';
      _estConflictos     = { errores: [], advertencias: [] };
      _estGrupoFiltroSem   = '';
      _estGrupoFiltroTurno = '';
      _estDocFiltro        = '';
      _estColFilters_      = {};
      _estQuickGrupo       = '';
      _estQuickTipo        = '';
      _estQuickStatus      = '';
      _estSelRow           = -1;
      _estDirtySet         = new Set();
      _estDeleteIds        = [];
      _estHorGrupoSem    = '';
      _estHorGrupoTurno  = '';
      _estHorDocTurno    = '';

      container.innerHTML = _estPageHTML();
      _estBind();
      _estValidarLocal();
    } catch(err) {
      genShowError('Error al cargar estructura educativa: ' + err.message);
    }
  }
});

// ── CONSTANTES ───────────────────────────────────────────────────────

var _EST_ESTADO_INFO_ = {
  'EN_CAPTURA':  { label: 'En captura',  cls: 'est-estado-captura',  next: 'EN_REVISION', nextLabel: 'Enviar a revisión' },
  'EN_REVISION': { label: 'En revisión', cls: 'est-estado-revision', next: 'VALIDADA',    nextLabel: 'Marcar como validada' },
  'VALIDADA':    { label: 'Validada',    cls: 'est-estado-validada', next: 'CERRADA',     nextLabel: 'Cerrar ciclo' },
  'CERRADA':     { label: 'Cerrada',     cls: 'est-estado-cerrada',  next: null,          nextLabel: null }
};

var _EST_COLS_ = [
  { key: 'plantel',            label: 'PLANTEL',         w: 85,  t: 'text'   },
  { key: 'grupo',              label: 'GRUPO',           w: 65,  t: 'grupo'  },
  { key: 'turno',              label: 'TURNO',           w: 88,  t: 'turno'  },
  { key: 'semestre',           label: 'SEM',             w: 55,  t: 'sem'    },
  { key: 'campo_disciplinar',  label: 'CAMPO DISCIP.',   w: 128, t: 'text'   },
  { key: 'uac',                label: 'UAC',             w: 185, t: 'uac'    },
  { key: 'num_componente',     label: '#COMP',           w: 58,  t: 'text'   },
  { key: 'curriculum_ampliado',label: 'CURR. AMPL.',     w: 108, t: 'text'   },
  { key: 'componente',         label: 'COMPONENTE',      w: 150, t: 'comp'   },
  { key: 'tot_horas',          label: 'TOT_H',           w: 55,  t: 'num'    },
  { key: 'propiedad_uac',      label: 'PROP. UAC',       w: 88,  t: 'text'   },
  { key: 'laboral',            label: 'LAB.',            w: 55,  t: 'text'   },
  { key: 'docente',                label: 'DOCENTE',         w: 170, t: 'docente'    },
  { key: 'tipo_asignacion_docente', label: 'TIPO ASIG.',      w: 115, t: 'tipo_asig'  },
  { key: 'docente_tiempo_fijo',     label: 'DOC. T.FIJO',     w: 165, t: 'docente'    },
  { key: 'estatus_cobertura',       label: 'ESTATUS COB.',    w: 145, t: 'estatus_cob'},
  { key: 'formacion_docente',  label: 'FORMACIÓN',       w: 145, t: 'text'     },
  { key: 'lunes',              label: 'LUN',             w: 105, t: 'time_slot' },
  { key: 'martes',             label: 'MAR',             w: 105, t: 'time_slot' },
  { key: 'miercoles',          label: 'MIÉ',             w: 105, t: 'time_slot' },
  { key: 'jueves',             label: 'JUE',             w: 105, t: 'time_slot' },
  { key: 'viernes',            label: 'VIE',             w: 105, t: 'time_slot' },
  { key: 'horas',              label: 'HRS',             w: 45,  t: 'readonly' }
];

// ── ESTADO DEL MÓDULO ────────────────────────────────────────────────

var _estData           = [];
var _estEstado         = 'EN_CAPTURA';
var _estPeriodo        = '';   // snapshot del periodo al renderizar
var _estDirty          = false;
var _estView           = 'grid';
var _estConflictos     = { errores: [], advertencias: [] };
var _estGrupoFiltroSem   = '';  // '' = todos | '1'–'6' = solo ese | '135'|'246' = conjunto
var _estGrupoFiltroTurno = '';  // '' = todos | 'Matutino' | 'Vespertino'
var _estDocFiltro        = '';  // '' = todos | 'base' | 'tiempo_fijo' | 'vacante'
var _estColWidths_       = {};  // colKey → px (persiste durante la sesión)
var _estColFilters_      = {};  // colKey → [] (vacío=todos) | [val1, val2, ...]
var _estHorGrupoSel      = '';  // grupo seleccionado en vista horario-grupo
var _estHorDocSel        = '';  // docente seleccionado en vista horario-docente
var _estQuickGrupo       = '';  // filtro rápido: texto de grupo
var _estQuickTipo        = '';  // filtro rápido: '' | 'base' | 'tiempo_fijo' | 'vacante'
var _estQuickStatus      = '';  // filtro rápido: '' | 'completo' | 'pendiente' | 'conflicto'
var _estSelRow           = -1;  // índice de fila resaltada (por clic)
var _estDirtySet         = new Set(); // referencias a filas modificadas (guardado inteligente)
var _estDeleteIds        = [];        // ids de filas eliminadas del servidor
var _estHorGrupoSem    = '';  // filtro semestre en vista horario-grupo
var _estHorGrupoTurno  = '';  // filtro turno en vista horario-grupo
var _estHorDocTurno    = '';  // filtro turno en vista horario-docente

// ── PALETAS VISUALES ─────────────────────────────────────────────────

var _EST_SEM_COLORS_ = {
  '1': { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', light: '#dbeafe' },
  '2': { bg: '#eef2ff', border: '#6366f1', text: '#3730a3', light: '#e0e7ff' },
  '3': { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce', light: '#f3e8ff' },
  '4': { bg: '#f0fdfa', border: '#14b8a6', text: '#0f766e', light: '#ccfbf1' },
  '5': { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', light: '#dcfce7' },
  '6': { bg: '#fff7ed', border: '#f97316', text: '#c2410c', light: '#ffedd5' }
};

var _EST_TURNO_COLORS_ = {
  'Matutino':   { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  'Vespertino': { bg: '#f0f9ff', text: '#0369a1', border: '#7dd3fc' },
  'Mixto':      { bg: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' }
};

// ── CONSTANTES DE DÍAS ────────────────────────────────────────────────

var _EST_DIAS_ = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

// ── DATALISTS (para autocompletado en celdas) ────────────────────────

function _estDatalistsHTML() {
  var gruposOpts = (_genApp.grupos||[]).map(function(g) {
    return '<option value="'+genEsc(genLabelGrupo(g))+'"></option>';
  }).join('');
  var docentesOpts = (_genApp.docentes||[]).filter(function(d){ return String(d.activo)!=='false'; }).map(function(d) {
    return '<option value="'+genEsc(genNombreDocente(d))+'"></option>';
  }).join('');
  var uacOpts = (_genApp.materias||[]).filter(function(m){ return String(m.activo)!=='false'; }).map(function(m) {
    return '<option value="'+genEsc(m.nombre)+'"></option>';
  }).join('');
  var compOpts = (_MAT_COMPONENTES_||[]).map(function(c) {
    return '<option value="'+genEsc(c)+'"></option>';
  }).join('');
  var turnoOpts = ['Matutino','Vespertino','Mixto'].map(function(t) {
    return '<option value="'+t+'"></option>';
  }).join('');
  return '<datalist id="estdl-grupos">'+gruposOpts+'</datalist>' +
         '<datalist id="estdl-docentes">'+docentesOpts+'</datalist>' +
         '<datalist id="estdl-uac">'+uacOpts+'</datalist>' +
         '<datalist id="estdl-comp">'+compOpts+'</datalist>' +
         '<datalist id="estdl-turno">'+turnoOpts+'</datalist>';
}

function _estDatalistAttr(t) {
  var map = { grupo:'estdl-grupos', docente:'estdl-docentes', uac:'estdl-uac', comp:'estdl-comp', turno:'estdl-turno' };
  return map[t] ? ' list="'+map[t]+'"' : '';
}

// ── DASHBOARD DE INDICADORES ─────────────────────────────────────────

function _estDashboardHTML() {
  if (!_estData.length) return '';
  var grupos = {}, nVac = 0, nTF = 0, nComp = 0, nSinDoc = 0;
  _estData.forEach(function(r) {
    var g = String(r.grupo || '').trim(); if (g) grupos[g] = true;
    var t = String(r.tipo_asignacion_docente || '').trim();
    if (t === 'Vacante') { nVac++; return; }
    if (t === 'Tiempo fijo') { nTF++; }
    var tot = Number(r.tot_horas) || 0;
    if (tot > 0) {
      var suma = _EST_DIAS_.reduce(function(s, d) { return s + _estParseHorasDia(r[d]); }, 0);
      if (suma === tot) nComp++;
    }
    if (!String(r.docente || '').trim() && t !== 'Tiempo fijo') nSinDoc++;
  });
  var nGrupos = Object.keys(grupos).length;
  var nTotal  = _estData.length;
  var nErr    = _estConflictos.errores.length;
  var nIncomp = nTotal - nComp;

  function stat(val, lbl, cls) {
    return '<button class="est-dash-stat' + (cls ? ' est-dash-stat--' + cls : '') +
      '" onclick="_estSetQuickStatus(\'' + (cls==='completo'?'completo':cls==='pendiente'?'pendiente':cls==='conflicto'?'conflicto':'') + '\')">' +
      '<span class="est-dash-val">' + val + '</span>' +
      '<span class="est-dash-lbl">' + lbl + '</span>' +
      '</button>';
  }

  return '<div class="est-dashboard-bar">' +
    stat(nGrupos, 'grupos', '') +
    stat(nTotal,  'materias', '') +
    stat(nComp,   'completas', nComp === nTotal ? 'ok' : 'completo') +
    stat(nIncomp, 'pendientes', nIncomp > 0 ? 'pendiente' : 'ok') +
    stat(nVac,    'vacantes', nVac > 0 ? 'vac' : '') +
    stat(nTF,     'tiempo fijo', nTF > 0 ? 'tf' : '') +
    stat(nErr,    'conflictos', nErr > 0 ? 'conflicto' : 'ok') +
  '</div>';
}

function _estUpdateDashboard() {
  var el = document.getElementById('est-dashboard');
  if (el) el.innerHTML = _estDashboardHTML();
}

// ── FILTRO RÁPIDO ────────────────────────────────────────────────────

function _estQuickFilterBarHTML() {
  var tipoChips = [
    { val: '',            lbl: 'Todos' },
    { val: 'base',        lbl: 'Base' },
    { val: 'tiempo_fijo', lbl: 'Tiempo fijo' },
    { val: 'vacante',     lbl: 'Vacante' }
  ];
  var statusChips = [
    { val: '',          lbl: 'Todos' },
    { val: 'completo',  lbl: '✓ Completo' },
    { val: 'pendiente', lbl: '⚠ Pendiente' },
    { val: 'conflicto', lbl: '❌ Conflicto' }
  ];

  return '<div class="est-qf-bar">' +
    '<div class="est-qf-group">' +
      '<span class="est-qf-label">Tipo:</span>' +
      tipoChips.map(function(c) {
        return '<button class="est-qf-chip' + (c.val === _estQuickTipo ? ' active' : '') +
          '" data-qf-tipo="' + c.val + '" onclick="_estSetQuickTipo(\'' + c.val + '\')">' + c.lbl + '</button>';
      }).join('') +
    '</div>' +
    '<div class="est-qf-group">' +
      '<span class="est-qf-label">Estado:</span>' +
      statusChips.map(function(c) {
        return '<button class="est-qf-chip' + (c.val === _estQuickStatus ? ' active' : '') +
          '" data-qf-status="' + c.val + '" onclick="_estSetQuickStatus(\'' + c.val + '\')">' + c.lbl + '</button>';
      }).join('') +
    '</div>' +
    '<div class="est-qf-group est-qf-grupo-wrap">' +
      '<span class="est-qf-label">Grupo:</span>' +
      '<input type="text" id="est-qf-grupo-inp" class="est-qf-grupo-inp" value="' + genEsc(_estQuickGrupo) + '"' +
        ' placeholder="Filtrar grupo…" oninput="_estSetQuickGrupo(this.value)">' +
    '</div>' +
    (_estQuickGrupo || _estQuickTipo || _estQuickStatus ?
      '<button class="est-qf-chip est-qf-clear" onclick="_estClearQuickFilters()" title="Limpiar filtros">✕ Limpiar</button>' : '') +
  '</div>';
}

function _estSetQuickTipo(tipo) {
  _estQuickTipo = tipo;
  document.querySelectorAll('[data-qf-tipo]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-qf-tipo') === tipo);
  });
  _estToggleClearBtn();
  _estApplyFilters();
}

function _estSetQuickStatus(status) {
  _estQuickStatus = status;
  document.querySelectorAll('[data-qf-status]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-qf-status') === status);
  });
  _estToggleClearBtn();
  _estApplyFilters();
}

function _estSetQuickGrupo(val) {
  _estQuickGrupo = String(val || '').trim();
  _estToggleClearBtn();
  _estApplyFilters();
}

function _estClearQuickFilters() {
  _estQuickGrupo = ''; _estQuickTipo = ''; _estQuickStatus = '';
  var inp = document.getElementById('est-qf-grupo-inp');
  if (inp) inp.value = '';
  document.querySelectorAll('[data-qf-tipo]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-qf-tipo') === '');
  });
  document.querySelectorAll('[data-qf-status]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-qf-status') === '');
  });
  _estToggleClearBtn();
  _estApplyFilters();
}

function _estToggleClearBtn() {
  var hasAny = !!(  _estQuickGrupo || _estQuickTipo || _estQuickStatus);
  var btn = document.querySelector('.est-qf-clear');
  if (btn) {
    btn.style.display = hasAny ? '' : 'none';
  } else if (hasAny) {
    // Inject clear button if not present yet
    var bar = document.querySelector('.est-qf-bar');
    if (bar) {
      var clearBtn = document.createElement('button');
      clearBtn.className = 'est-qf-chip est-qf-clear';
      clearBtn.setAttribute('onclick', '_estClearQuickFilters()');
      clearBtn.title = 'Limpiar filtros rápidos';
      clearBtn.textContent = '✕ Limpiar';
      bar.appendChild(clearBtn);
    }
  }
}

// ── HTML PRINCIPAL ───────────────────────────────────────────────────

function _estPageHTML() {
  var info = _EST_ESTADO_INFO_[_estEstado] || _EST_ESTADO_INFO_['EN_CAPTURA'];
  var esCerrada = _estEstado === 'CERRADA';

  var estadoBadge = '<span class="est-estado-badge '+info.cls+'">'+info.label+'</span>';

  var periodoBadge = _genApp.periodo
    ? '<span class="gen-periodo-badge gen-periodo-badge-'+_genApp.periodo+'" style="margin-left:8px">Periodo '+_genApp.periodo+
      ' · Sems '+(GEN_PERIODO_SEMESTRES_[_genApp.periodo]||[]).join(', ')+'°</span>'
    : '<span class="gen-periodo-badge" style="margin-left:8px;background:#f1f5f9;color:#64748b;border-color:#cbd5e1">Ambos periodos</span>';

  var btnAvanzar = info.next
    ? '<button class="gen-btn gen-btn-sm gen-btn-secondary" id="est-btn-avanzar">'+info.nextLabel+' →</button>'
    : '';

  var btnHorario = _estEstado === 'VALIDADA'
    ? '<button class="gen-btn gen-btn-sm est-btn-horario" id="est-btn-horario">⚡ Generar carga horaria</button>'
    : '';

  var workflowGroup = (btnAvanzar || btnHorario)
    ? '<div class="est-action-sep"></div><div class="est-action-group">' + btnAvanzar + btnHorario + '</div>'
    : '';

  var guardarStyle = _estDirty ? ' style="background:#f59e0b;border-color:#f59e0b;"' : '';

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Estructura Educativa</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong>
      &nbsp;&nbsp;${estadoBadge}${periodoBadge}</p>
  </div>
  <div class="gen-header-actions est-header-actions">
    <div class="est-action-group">
      <button class="gen-btn gen-btn-sm gen-btn-ghost" id="est-btn-exportar">↓ CSV</button>
      <button class="gen-btn gen-btn-sm gen-btn-secondary" id="est-btn-validar">✓ Validar</button>
    </div>
    ${workflowGroup}
    <div class="est-action-sep"></div>
    <button class="gen-btn gen-btn-sm gen-btn-primary" id="est-btn-guardar"${guardarStyle}>
      ${_estDirty ? '<span style="opacity:.7;margin-right:2px;">●</span>' : ''}Guardar todo
    </button>
  </div>
</div>

<div id="est-conflict-bar" class="est-conflict-bar" style="display:none"></div>

<div id="est-dashboard">${_estDashboardHTML()}</div>

<div class="est-view-tabs">
  <button class="est-view-tab${_estView==='grid'?' active':''}" data-view="grid">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
    Grilla
  </button>
  <button class="est-view-tab${_estView==='capv'?' active':''}" data-view="capv">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>
    Captura visual
  </button>
  <button class="est-view-tab${_estView==='grupo'?' active':''}" data-view="grupo">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
    Por grupo
  </button>
  <button class="est-view-tab${_estView==='docente'?' active':''}" data-view="docente">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    Por docente
  </button>
  <button class="est-view-tab${_estView==='materia'?' active':''}" data-view="materia">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    Por materia
  </button>
  <button class="est-view-tab${_estView==='conflictos'?' active':''}" data-view="conflictos">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    Conflictos
    <span id="est-conflict-count" class="est-conf-count" style="display:none"></span>
  </button>
  <button class="est-view-tab${_estView==='horario_grupo'?' active':''}" data-view="horario_grupo">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    Horario grupo
  </button>
  <button class="est-view-tab${_estView==='horario_docente'?' active':''}" data-view="horario_docente">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    Horario docente
  </button>
</div>

<div id="est-view-content">
  ${_estViewHTML()}
</div>
${_estDatalistsHTML()}`;
}

function _estViewHTML() {
  if (_estView === 'grid')           return _estGridHTML();
  if (_estView === 'grupo')          return _estPorGrupoHTML();
  if (_estView === 'docente')        return _estPorDocenteHTML();
  if (_estView === 'materia')        return _estPorMateriaHTML();
  if (_estView === 'conflictos')     return _estConflictosHTML();
  if (_estView === 'horario_grupo')  return _estHorarioGrupoHTML();
  if (_estView === 'horario_docente')return _estHorarioDocenteHTML();
  if (_estView === 'capv')           return _estCapvHTML();
  return '';
}

// ── VISTA GRILLA ─────────────────────────────────────────────────────

function _estGridHTML() {
  var cerrada = _estEstado === 'CERRADA';

  /* ── colgroup: control de anchos ─────────────────────────────── */
  var colgroup = '<colgroup>' +
    '<col style="width:35px;min-width:35px">' +
    _EST_COLS_.map(function(c) {
      var w = _estColWidths_[c.key] || c.w;
      return '<col data-col="' + c.key + '" style="width:' + w + 'px;min-width:40px">';
    }).join('') +
    '<col style="width:38px;min-width:38px">' +
    '<col style="width:36px;min-width:36px">' +
    '</colgroup>';

  /* ── thead con botón de filtro + manejador de resize ─────────── */
  var thead = '<tr><th class="est-th-num">#</th>' +
    _EST_COLS_.map(function(c) {
      var hasFilter = _estColFilters_[c.key] && _estColFilters_[c.key].length;
      return '<th class="est-th-col" data-col="' + c.key + '">' +
        '<div class="est-th-inner">' +
          '<span class="est-th-label">' + c.label + '</span>' +
          '<button class="est-col-filter-btn' + (hasFilter ? ' active' : '') +
            '" data-col="' + genEsc(c.key) + '" title="Filtrar" tabindex="-1">▾</button>' +
        '</div>' +
        '<div class="est-col-resizer" data-col="' + genEsc(c.key) + '"></div>' +
      '</th>';
    }).join('') +
    '<th class="est-th-ind" title="Completitud de horas">✓</th>' +
    '<th class="est-th-del"></th></tr>';

  var rows = _estData.length === 0
    ? '<tr><td colspan="' + (_EST_COLS_.length + 3) + '" class="gen-td-empty">Sin filas. Usa "+ Agregar fila" o pega desde Excel.</td></tr>'
    : _estData.map(function(row, i) { return _estGridRow(row, i, cerrada); }).join('');

  var addBtn = cerrada ? '' :
    '<div style="padding:10px 0"><button class="gen-btn gen-btn-secondary gen-btn-sm" id="est-add-row">+ Agregar fila</button>' +
    '<span class="gen-hint" style="margin-left:12px">Pega desde Excel con Ctrl+V en cualquier celda</span></div>';

  return _estQuickFilterBarHTML() +
    '<div class="est-grid-wrap"><table class="est-grid est-grid--fixed" id="est-grid-table">' +
    colgroup +
    '<thead>' + thead + '</thead>' +
    '<tbody id="est-grid-tbody">' + rows + '</tbody>' +
    '</table></div>' + addBtn + _estInlineHorariosHTML();
}

function _estInlineHorariosHTML() {
  var grupos = [], seenG = {};
  _estData.forEach(function(r) {
    var g = String(r.grupo || '').trim();
    if (g && !seenG[g]) { seenG[g] = true; grupos.push(g); }
  });
  grupos.sort();

  var docentes = [], seenD = {};
  _estData.forEach(function(r) {
    var tipo = String(r.tipo_asignacion_docente || '').trim();
    if (tipo === 'Vacante') return;
    var d = String(r.docente || '').trim();
    if (d && !seenD[d]) { seenD[d] = true; docentes.push(d); }
  });
  docentes.sort();

  var cfFilas = {};
  _estConflictos.errores.forEach(function(e) { if (e.fila) cfFilas[e.fila] = true; });

  // ── Sección grupo ──────────────────────────────────────
  var grupoOpts = '<option value="">— Selecciona grupo —</option>' +
    grupos.map(function(g) {
      return '<option value="' + genEsc(g) + '"' + (g === _estHorGrupoSel ? ' selected' : '') + '>' + genEsc(g) + '</option>';
    }).join('');

  var grupoGrid = _estHorGrupoSel
    ? _estTimetableGridHTML(
        _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
          .filter(function(r) { return String(r.grupo || '').trim() === _estHorGrupoSel; }),
        function(row, e) {
          var slot = e && e.isFirst ? (row[e.dia] || '') : '';
          return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
                 '<span class="arm-tt-meta">' + genEsc(row.docente || '—') + '</span>' +
                 (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
        }, cfFilas)
    : '<p class="gen-hint" style="margin:8px 0">Selecciona un grupo para ver su horario.</p>';

  // ── Sección docente ─────────────────────────────────────
  var docOpts = '<option value="">— Selecciona docente —</option>' +
    docentes.map(function(d) {
      return '<option value="' + genEsc(d) + '"' + (d === _estHorDocSel ? ' selected' : '') + '>' + genEsc(d) + '</option>';
    }).join('');

  var docGrid = _estHorDocSel
    ? _estTimetableGridHTML(
        _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
          .filter(function(r) {
            var tipo = String(r.tipo_asignacion_docente || '').trim();
            if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return false;
            return String(r.docente || '').trim() === _estHorDocSel;
          }),
        function(row, e) {
          var slot = e && e.isFirst ? (row[e.dia] || '') : '';
          return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
                 '<span class="arm-tt-meta">' + genEsc(row.grupo || '—') + '</span>' +
                 (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
        }, cfFilas)
    : '<p class="gen-hint" style="margin:8px 0">Selecciona un docente para ver su horario.</p>';

  return '<div class="est-inline-hor">' +

    '<div class="est-inline-hor-panel">' +
    '<div class="est-inline-hor-hdr">' +
    '<span class="est-inline-hor-title">Horario semanal — Grupo</span>' +
    '<select id="est-hor-grupo-sel-inline" class="gen-select" style="min-width:130px">' + grupoOpts + '</select>' +
    '</div>' +
    '<div id="est-hor-grupo-grid-inline">' + grupoGrid + '</div>' +
    '</div>' +

    '<div class="est-inline-hor-panel">' +
    '<div class="est-inline-hor-hdr">' +
    '<span class="est-inline-hor-title">Horario semanal — Docente</span>' +
    '<select id="est-hor-doc-sel-inline" class="gen-select" style="min-width:220px">' + docOpts + '</select>' +
    '</div>' +
    '<div id="est-hor-doc-grid-inline">' + docGrid + '</div>' +
    '</div>' +

    '</div>';
}

// Genera rangos de hora (inicio 07:00–20:00, duración 1 o 2h — máximo operativo del plantel)
var _EST_TIME_SLOTS_ = (function() {
  var list = [];
  for (var h = 7; h <= 20; h++) {
    for (var dur = 1; dur <= 2; dur++) {
      if (h + dur > 22) break;
      var hs = (h < 10 ? '0' : '') + h + ':00';
      var he = (h + dur < 10 ? '0' : '') + (h + dur) + ':00';
      list.push({ label: hs + '-' + he, hours: dur });
    }
  }
  return list;
})();

/** Convierte un valor de campo de día a horas numéricas.
 *  Acepta "HH:MM-HH:MM" o número directo. */
function _estParseHorasDia(val) {
  if (!val) return 0;
  var s = String(val).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (m) {
    var ini = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var fin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
    return fin > ini ? Math.round((fin - ini) / 60) : 0;
  }
  return Number(s) || 0;
}

function _estHorasIndicador(row) {
  var tot  = Number(row.tot_horas) || 0;
  var suma = _EST_DIAS_.reduce(function(s, d) { return s + _estParseHorasDia(row[d]); }, 0);
  if (tot === 0 && suma === 0) {
    return '<td class="est-td-ind"></td>';
  }
  if (tot === 0) {
    // hay horas en días pero no hay tot_horas definido
    return '<td class="est-td-ind"><span class="est-ind-info" title="Define TOT_H para validar">?</span></td>';
  }
  if (suma === 0) {
    // tot_horas definido pero sin horas en días todavía
    return '<td class="est-td-ind"><span class="est-ind-info" title="Sin horas asignadas por día">–</span></td>';
  }
  if (suma === tot) {
    return '<td class="est-td-ind"><span class="est-ind-ok" title="' + suma + '/' + tot + ' hrs — completo">✓</span></td>';
  }
  return '<td class="est-td-ind"><span class="est-ind-err" title="' + suma + '/' + tot + ' hrs — faltan ' + (tot - suma) + '">✗</span></td>';
}

function _estTipoCls(row) {
  var t = String(row.tipo_asignacion_docente || '').trim();
  if (t === 'Vacante')     return ' est-row-vacante';
  if (t === 'Tiempo fijo') return ' est-row-tf';
  return '';
}

function _estGridRow(row, idx, cerrada) {
  var errFila = _estConflictos.errores.filter(function(e) { return e.fila === idx + 1; }).length;
  var wrnFila = _estConflictos.advertencias.filter(function(e) { return e.fila === idx + 1; }).length;
  var rowCls  = (errFila ? ' est-row-error' : (wrnFila ? ' est-row-warn' : '')) + _estTipoCls(row);
  if (idx === _estSelRow) rowCls += ' est-row-selected';

  var cells = _EST_COLS_.map(function(col) {
    var val  = row[col.key] !== undefined ? String(row[col.key]) : '';
    var tipo = col.t;
    var disabled = cerrada ? ' disabled' : '';

    if (tipo === 'readonly') {
      return '<td><input type="text" class="est-cell est-cell-readonly" data-row="' + idx +
        '" data-col="' + genEsc(col.key) + '" value="' + genEsc(val) +
        '" readonly tabindex="-1" style="width:100%"></td>';
    }
    if (tipo === 'time_slot') {
      var tsOpts = '<option value="">—</option>' +
        _EST_TIME_SLOTS_.map(function(slot) {
          return '<option value="' + slot.label + '"' + (val === slot.label ? ' selected' : '') + '>' +
            slot.label + ' (' + slot.hours + 'h)</option>';
        }).join('');
      return '<td><select class="est-cell est-cell-sel est-cell-sel-hora" data-row="' + idx +
        '" data-col="' + genEsc(col.key) + '"' + disabled + '>' + tsOpts + '</select></td>';
    }
    if (tipo === 'tipo_asig') {
      var opts = ['', 'Base', 'Tiempo fijo', 'Vacante'].map(function(o) {
        return '<option value="' + genEsc(o) + '"' + (val === o ? ' selected' : '') + '>' + (o || '— tipo —') + '</option>';
      }).join('');
      return '<td><select class="est-cell est-cell-sel est-cell-sel-tipo" data-row="' + idx + '" data-col="' + genEsc(col.key) + '"' + disabled + '>' + opts + '</select></td>';
    }
    if (tipo === 'estatus_cob') {
      var opts2 = ['', 'Autorizado', 'Pendiente de autorización', 'Vacante'].map(function(o) {
        return '<option value="' + genEsc(o) + '"' + (val === o ? ' selected' : '') + '>' + (o || '— estatus —') + '</option>';
      }).join('');
      return '<td><select class="est-cell est-cell-sel est-cell-sel-estatus" data-row="' + idx + '" data-col="' + genEsc(col.key) + '"' + disabled + '>' + opts2 + '</select></td>';
    }

    var dlAttr = _estDatalistAttr(tipo);
    var inputType = tipo === 'num' ? 'number' : 'text';
    return '<td><input type="'+inputType+'" class="est-cell" ' +
           'data-row="'+idx+'" data-col="'+genEsc(col.key)+'"' +
           dlAttr + disabled +
           ' value="'+genEsc(val)+'" style="width:100%"></td>';
  }).join('');

  var delBtn = cerrada ? '<td></td>' :
    '<td class="est-td-actions">' +
    '<button class="gen-btn-icon est-dup-row" data-row="'+idx+'" title="Duplicar fila">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
    '</button>' +
    '<button class="gen-btn-icon gen-btn-delete est-del-row" data-row="'+idx+'" title="Eliminar fila">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
    '</button></td>';

  return '<tr class="est-grid-row'+rowCls+'" data-row="'+idx+'">' +
         '<td class="est-td-num">'+(idx+1)+'</td>' +
         cells + _estHorasIndicador(row) + delBtn + '</tr>';
}

// ── VISTA POR GRUPO ──────────────────────────────────────────────────

// Chips de semestre según el periodo activo
function _estGetSemChips() {
  var per = _genApp.periodo || '';
  if (per === 'A') {
    return [
      { val: '',    label: 'Todos' },
      { val: '1',   label: '1°' },
      { val: '3',   label: '3°' },
      { val: '5',   label: '5°' },
      { val: '135', label: '1°, 3° y 5°' }
    ];
  }
  if (per === 'B') {
    return [
      { val: '',    label: 'Todos' },
      { val: '2',   label: '2°' },
      { val: '4',   label: '4°' },
      { val: '6',   label: '6°' },
      { val: '246', label: '2°, 4° y 6°' }
    ];
  }
  // Ambos periodos
  return [
    { val: '',  label: 'Todos' },
    { val: '1', label: '1°' },
    { val: '2', label: '2°' },
    { val: '3', label: '3°' },
    { val: '4', label: '4°' },
    { val: '5', label: '5°' },
    { val: '6', label: '6°' }
  ];
}

function _estPorGrupoHTML() {
  if (!_estData.length) {
    return '<div class="gen-empty-state" style="margin-top:32px"><p>No hay datos en la estructura todavía.</p></div>';
  }

  // ── Fila 1: Semestre (dinámico según periodo)
  var semChips = _estGetSemChips();
  var semBar = '<div class="est-filtro-bar">' +
    '<span class="est-filtro-label">Semestre:</span>' +
    semChips.map(function(c) {
      var active = _estGrupoFiltroSem === c.val ? ' active' : '';
      return '<button class="est-filtro-chip' + active + '" data-filtrosem="' + genEsc(c.val) + '" onclick="_estSetGrupoFiltro(\'' + c.val + '\')">' + genEsc(c.label) + '</button>';
    }).join('') +
  '</div>';

  // ── Fila 2: Turno
  var turnoChips = [
    { val: '',           label: 'Todos' },
    { val: 'Matutino',   label: 'Matutino' },
    { val: 'Vespertino', label: 'Vespertino' }
  ];
  var turnoBar = '<div class="est-filtro-bar">' +
    '<span class="est-filtro-label">Turno:</span>' +
    turnoChips.map(function(c) {
      var active = _estGrupoFiltroTurno === c.val ? ' active' : '';
      return '<button class="est-filtro-chip est-filtro-chip-turno' + active + '" data-filtroturno="' + genEsc(c.val) + '" onclick="_estSetGrupoFiltroTurno(\'' + c.val + '\')">' + genEsc(c.label) + '</button>';
    }).join('') +
  '</div>';

  return (
    '<div class="est-filtro-wrapper">' + semBar + turnoBar + '</div>' +
    '<div id="est-grupo-cards" class="est-cards-grid">' + _estGrupoCardsHTML() + '</div>'
  );
}

var _EST_CONJUNTOS_SEM_ = { '135': ['1','3','5'], '246': ['2','4','6'] };

function _estGrupoCardsHTML() {
  var filtroSem   = _estGrupoFiltroSem;
  var filtroTurno = _estGrupoFiltroTurno;
  var conjSem     = _EST_CONJUNTOS_SEM_[filtroSem] || null;

  var porGrupo = {};
  _estData.forEach(function(row) {
    var sem   = String(row.semestre || '').trim();
    var turno = String(row.turno    || '').trim();

    // Filtro semestre
    if (filtroSem) {
      if (conjSem) {
        if (conjSem.indexOf(sem) === -1) return;
      } else if (sem !== filtroSem) {
        return;
      }
    }
    // Filtro turno (normalizado: ignora mayúsculas y acentos)
    if (filtroTurno) {
      var turnoNorm   = turno.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      var filtroNorm  = filtroTurno.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      if (turnoNorm !== filtroNorm) return;
    }

    var g = row.grupo || '(sin grupo)';
    if (!porGrupo[g]) porGrupo[g] = [];
    porGrupo[g].push(row);
  });

  var grupos = Object.keys(porGrupo).sort();
  if (!grupos.length) {
    return '<div class="gen-empty-state" style="grid-column:1/-1;padding:32px 0;"><p>No hay grupos para el filtro seleccionado.</p></div>';
  }

  return grupos.map(function(g) {
    var filas    = porGrupo[g];
    var totalHrs = filas.reduce(function(s, f) { return s + (Number(f.tot_horas) || 0); }, 0);
    var sem      = String(filas[0] ? filas[0].semestre : '').trim();
    var turno    = filas[0] ? (filas[0].turno || '') : '';
    var sc       = _EST_SEM_COLORS_[sem] || { bg: '#f8fafc', border: '#cbd5e1', text: '#475569', light: '#f1f5f9' };
    var tc       = _EST_TURNO_COLORS_[turno] || null;

    var semBadge = sem
      ? '<span class="est-v2-badge" style="background:'+sc.light+';color:'+sc.text+';border-color:'+sc.border+'">Sem '+genEsc(sem)+'°</span>'
      : '';
    var turnoBadge = tc
      ? '<span class="est-v2-badge" style="background:'+tc.bg+';color:'+tc.text+';border-color:'+tc.border+'">'+genEsc(turno)+'</span>'
      : (turno ? '<span class="est-v2-badge est-v2-badge-gray">'+genEsc(turno)+'</span>' : '');

    var rows = filas.map(function(f) {
      var cap    = genGetCap(f.componente);
      var cs     = cap ? _GEN_CAP_STYLE_[cap] : null;
      var capTag = cap && cs
        ? '<span class="gen-mat-cap-badge" style="background:'+cs.bg+';color:'+cs.text+';border-color:'+cs.border+';font-size:10px">'+genEsc(cap)+'</span>'
        : '<span style="color:var(--gen-muted);font-size:10px">'+genEsc(f.componente||'—')+'</span>';
      var tipoAsig = String(f.tipo_asignacion_docente || '').trim();
      var docenteTag;
      if (tipoAsig === 'Vacante') {
        docenteTag = _estEstatusBadge('Vacante');
      } else if (tipoAsig === 'Tiempo fijo') {
        var tfNom = String(f.docente_tiempo_fijo || '').trim();
        docenteTag = '<span class="est-cob-badge est-cob-tf" style="font-size:10px">' + (tfNom ? genEsc(tfNom) : '⏱ TF') + '</span>';
      } else if (f.docente) {
        var estatusExtra = f.estatus_cobertura ? ' ' + _estEstatusBadge(String(f.estatus_cobertura).trim()) : '';
        docenteTag = '<span style="font-size:11px;color:var(--gen-muted);">'+genEsc(f.docente)+'</span>' + estatusExtra;
      } else {
        docenteTag = '<span style="color:#ef4444;font-size:11px;">Sin asignar</span>';
      }
      return '<tr>' +
        '<td>' +
          '<div class="est-v2-uac" style="margin-bottom:2px;">'+genEsc(f.uac||'—')+'</div>' +
          '<div>'+capTag+'</div>' +
        '</td>' +
        '<td>'+docenteTag+'</td>' +
        '<td class="est-v2-hrs">'+genEsc(String(f.tot_horas||'—'))+'</td>' +
        '</tr>';
    }).join('');

    return '<div class="est-card-v2" style="border-top:3px solid '+sc.border+';">' +
      '<div class="est-v2-head" style="background:'+sc.bg+';">' +
        '<div class="est-v2-grupo">'+genEsc(g)+'</div>' +
        '<div class="est-v2-badges">'+semBadge+turnoBadge+'</div>' +
      '</div>' +
      '<table class="est-card-table est-v2-table">' +
        '<thead><tr><th>UAC / Componente</th><th>Docente</th><th>H</th></tr></thead>' +
        '<tbody>'+rows+'</tbody>' +
      '</table>' +
      '<div class="est-v2-foot">' +
        '<span style="color:var(--gen-muted);font-size:11px;">'+filas.length+' materia'+(filas.length!==1?'s':'')+'</span>' +
        '<span class="est-v2-total-badge" style="background:'+sc.light+';color:'+sc.text+';border-color:'+sc.border+'">'+totalHrs+' hrs / sem</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _estSetGrupoFiltro(sem) {
  _estGrupoFiltroSem = sem;
  document.querySelectorAll('.est-filtro-chip[data-filtrosem]').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-filtrosem') === sem);
  });
  var cards = document.getElementById('est-grupo-cards');
  if (cards) cards.innerHTML = _estGrupoCardsHTML();
  var matCards = document.getElementById('est-materia-cards');
  if (matCards) matCards.innerHTML = _estMateriaCardsHTML();
}

function _estSetGrupoFiltroTurno(turno) {
  _estGrupoFiltroTurno = turno;
  document.querySelectorAll('.est-filtro-chip[data-filtroturno]').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-filtroturno') === turno);
  });
  var cards = document.getElementById('est-grupo-cards');
  if (cards) cards.innerHTML = _estGrupoCardsHTML();
}

// ── VISTA POR DOCENTE ────────────────────────────────────────────────

function _estSetDocFiltro(filtro) {
  _estDocFiltro = filtro;
  var content = document.getElementById('est-view-content');
  if (content) content.innerHTML = _estViewHTML();
}

function _estPorDocenteHTML() {
  if (!_estData.length) {
    return '<div class="gen-empty-state" style="margin-top:32px"><p>No hay datos en la estructura todavía.</p></div>';
  }

  /* ── Separar filas por tipo de asignación ──────────────────────── */
  var porBase = {};   // docente → filas (tipo Base o vacío)
  var porTF   = {};   // docente_tiempo_fijo → filas (tipo Tiempo fijo)
  var vacantes = [];  // filas con tipo Vacante

  _estData.forEach(function(row) {
    var tipo = String(row.tipo_asignacion_docente || '').trim();
    if (tipo === 'Vacante') {
      vacantes.push(row);
    } else if (tipo === 'Tiempo fijo') {
      var tf = String(row.docente_tiempo_fijo || '').trim() || '(sin nombre)';
      if (!porTF[tf]) porTF[tf] = [];
      porTF[tf].push(row);
    } else {
      var d = String(row.docente || '').trim() || '(sin docente)';
      if (!porBase[d]) porBase[d] = [];
      porBase[d].push(row);
    }
  });

  /* ── Barra de filtro ───────────────────────────────────────────── */
  var nBase = Object.keys(porBase).length;
  var nTF   = Object.keys(porTF).length;
  var nVac  = vacantes.length;

  var filterChips = [
    { val: '',           label: 'Todos' },
    { val: 'base',       label: 'Base (' + nBase + ')' },
    { val: 'tiempo_fijo',label: 'Tiempo fijo (' + nTF + ')' },
    { val: 'vacante',    label: 'Vacantes (' + nVac + ')' }
  ].map(function(c) {
    var active = _estDocFiltro === c.val ? ' active' : '';
    return '<button class="est-filtro-chip' + active + '" onclick="_estSetDocFiltro(\'' + c.val + '\')">' + genEsc(c.label) + '</button>';
  }).join('');

  var filterBar = '<div class="est-filtro-wrapper"><div class="est-filtro-bar">' +
    '<span class="est-filtro-label">Mostrar:</span>' + filterChips + '</div></div>';

  /* ── Aplicar filtro ─────────────────────────────────────────────── */
  var showBase = _estDocFiltro === '' || _estDocFiltro === 'base';
  var showTF   = _estDocFiltro === '' || _estDocFiltro === 'tiempo_fijo';
  var showVac  = _estDocFiltro === '' || _estDocFiltro === 'vacante';

  var sectionsHtml = '';

  /* ── Sección BASE ─────────────────────────────────────────────── */
  if (showBase && Object.keys(porBase).length) {
    var baseCards = Object.keys(porBase).sort(function(a, b) {
      if (a === '(sin docente)') return 1;
      if (b === '(sin docente)') return -1;
      return a.localeCompare(b);
    }).map(function(d) {
      return _estDocenteCard(d, porBase[d], 'base');
    }).join('');
    sectionsHtml += (_estDocFiltro === '' ? '<div class="est-doc-section-head">Docentes base</div>' : '') +
      '<div class="est-cards-grid">' + baseCards + '</div>';
  }

  /* ── Sección TIEMPO FIJO ──────────────────────────────────────── */
  if (showTF && Object.keys(porTF).length) {
    var tfCards = Object.keys(porTF).sort().map(function(d) {
      return _estDocenteCard(d, porTF[d], 'tf');
    }).join('');
    sectionsHtml += '<div class="est-doc-section-head est-doc-section-head--tf">Docentes tiempo fijo</div>' +
      '<div class="est-cards-grid">' + tfCards + '</div>';
  }

  /* ── Sección VACANTES ─────────────────────────────────────────── */
  if (showVac && vacantes.length) {
    var vacRows = vacantes.map(function(f) {
      var sc2 = _EST_SEM_COLORS_[String(f.semestre||'').trim()] || { light:'#fee2e2', text:'#991b1b', border:'#fca5a5' };
      var estatusBadge = String(f.estatus_cobertura || '').trim()
        ? _estEstatusBadge(String(f.estatus_cobertura).trim())
        : '';
      return '<div class="est-vac-row">' +
        '<span class="est-vac-sem" style="background:' + sc2.light + ';color:' + sc2.text + ';border-color:' + sc2.border + '">Sem ' + genEsc(String(f.semestre||'?')) + '°</span>' +
        '<span class="est-vac-uac">' + genEsc(f.uac || '—') + '</span>' +
        '<span class="est-vac-grp">' + genEsc(f.grupo || '—') + '</span>' +
        (estatusBadge ? '<span>' + estatusBadge + '</span>' : '') +
      '</div>';
    }).join('');
    sectionsHtml += '<div class="est-doc-section-head est-doc-section-head--vac">Materias vacantes (' + vacantes.length + ')</div>' +
      '<div class="est-vac-list">' + vacRows + '</div>';
  }

  if (!sectionsHtml) {
    sectionsHtml = '<div class="gen-empty-state" style="padding:32px 0"><p>No hay registros para el filtro seleccionado.</p></div>';
  }

  return filterBar + sectionsHtml;
}

/* ── Tarjeta individual de docente (base o TF) ─────────────────────── */
function _estDocenteCard(nombre, filas, modo) {
  var esTF  = modo === 'tf';
  var esSin = nombre === '(sin docente)' || nombre === '(sin nombre)';

  /* Horas totales */
  var totalHrs = filas.reduce(function(s, f) { return s + (Number(f.tot_horas) || 0); }, 0);

  /* Formación */
  var formacion = '';
  for (var i = 0; i < filas.length; i++) {
    if (filas[i].formacion_docente) { formacion = filas[i].formacion_docente; break; }
  }

  var grupos = Array.from(new Set(filas.map(function(f) { return f.grupo || ''; }).filter(Boolean))).sort();

  /* Color del badge de horas — TF usa paleta ámbar sin importar carga */
  var hrsColor, hrsBg, hrsBorder;
  if (esTF) {
    hrsColor = '#92400e'; hrsBg = '#fef3c7'; hrsBorder = '#fcd34d';
  } else if (totalHrs === 0)      { hrsColor='#64748b'; hrsBg='#f1f5f9'; hrsBorder='#cbd5e1'; }
  else if (totalHrs <= 25)        { hrsColor='#0369a1'; hrsBg='#e0f2fe'; hrsBorder='#7dd3fc'; }
  else if (totalHrs <= 35)        { hrsColor='#15803d'; hrsBg='#dcfce7'; hrsBorder='#86efac'; }
  else if (totalHrs <= 40)        { hrsColor='#92400e'; hrsBg='#fef3c7'; hrsBorder='#fcd34d'; }
  else                            { hrsColor='#991b1b'; hrsBg='#fee2e2'; hrsBorder='#fca5a5'; }

  var hrsIcon  = (!esTF && totalHrs > 35) ? '⚠ ' : (esTF ? '⏱ ' : '');
  var hrsBadge = '<span class="est-v2-hrs-badge" style="background:'+hrsBg+';color:'+hrsColor+';border-color:'+hrsBorder+'">' + hrsIcon + totalHrs + ' hrs</span>';

  /* Avatar */
  var initials = esSin ? '?' :
    nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(function(w) { return w[0] || ''; }).join('').toUpperCase();
  var avatarBg = esSin ? '#ef4444' : (esTF ? '#d97706' : '#3b82f6');

  /* Tipo badge en la cabecera */
  var tipoBadge = esTF
    ? '<span class="est-cob-badge est-cob-tf" style="margin-left:6px">Tiempo fijo</span>'
    : '';

  /* Filas de la tabla */
  var rows = filas.map(function(f) {
    var sc2 = _EST_SEM_COLORS_[String(f.semestre||'').trim()] || null;
    var grupoTag = f.grupo
      ? '<span class="est-v2-badge" style="' + (sc2 ? 'background:'+sc2.light+';color:'+sc2.text+';border-color:'+sc2.border+';' : '') + 'font-size:10px;">' + genEsc(f.grupo) + '</span>'
      : '<span style="color:var(--gen-muted);">—</span>';
    var estatusTd = f.estatus_cobertura && f.estatus_cobertura.trim()
      ? '<td>' + _estEstatusBadge(f.estatus_cobertura.trim()) + '</td>'
      : (esTF ? '<td><span class="est-cob-badge est-cob-pend">Pendiente</span></td>' : '<td></td>');
    return '<tr>' +
      '<td>' + grupoTag + '</td>' +
      '<td class="est-v2-uac">' + genEsc(f.uac||'—') + '</td>' +
      '<td class="est-v2-hrs">' + genEsc(String(f.tot_horas||'—')) + '</td>' +
      estatusTd +
      '</tr>';
  }).join('');

  var cardBorder = esTF
    ? 'border-top:3px solid #d97706;'
    : ((!esSin && totalHrs > 35) ? 'border-top:3px solid #f97316;' : 'border-top:3px solid #3b82f6;');
  var headBg = esTF ? '#fffbeb' : ((!esSin && totalHrs > 35) ? '#fff7ed' : '#f0f9ff');

  return '<div class="est-card-v2" style="' + cardBorder + '">' +
    '<div class="est-v2-head" style="background:' + headBg + ';">' +
      '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">' +
        '<div class="est-v2-avatar" style="background:' + avatarBg + ';">' + genEsc(initials) + '</div>' +
        '<div style="min-width:0;">' +
          '<div class="est-v2-grupo" style="font-size:13px;display:flex;align-items:center;flex-wrap:wrap;gap:4px;">' +
            genEsc(nombre) + tipoBadge +
          '</div>' +
          (formacion ? '<div style="font-size:11px;color:var(--gen-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + genEsc(formacion) + '</div>' : '') +
        '</div>' +
      '</div>' +
      hrsBadge +
    '</div>' +
    '<table class="est-card-table est-v2-table">' +
      '<thead><tr><th>Grupo</th><th>UAC</th><th>H</th><th>Estatus</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '<div class="est-v2-foot">' +
      '<span style="color:var(--gen-muted);font-size:12px;">' + filas.length + ' materia' + (filas.length!==1?'s':'') + '</span>' +
      '<span style="font-size:12px;color:var(--gen-muted);">' + grupos.length + ' grupo' + (grupos.length!==1?'s':'') + '</span>' +
    '</div>' +
  '</div>';
}

/* ── Helper: badge de estatus de cobertura ─────────────────────────── */
function _estEstatusBadge(estatus) {
  if (!estatus) return '';
  var cls = estatus === 'Autorizado'               ? 'est-cob-ok'
           : estatus === 'Pendiente de autorización' ? 'est-cob-pend'
           : estatus === 'Vacante'                   ? 'est-cob-vacante'
           : 'est-cob-badge';
  return '<span class="est-cob-badge ' + cls + '">' + genEsc(estatus) + '</span>';
}

function _estGrupoSemFromGrupo_(grupo) {
  // Intenta inferir semestre desde el nombre del grupo (ej. "201" → sem 2)
  var m = String(grupo).match(/^[A-Z]?(\d)/i);
  return m ? m[1] : '';
}

// ── VISTA POR MATERIA ────────────────────────────────────────────────

function _estPorMateriaHTML() {
  if (!_estData.length) {
    return '<div class="gen-empty-state" style="margin-top:32px"><p>No hay datos en la estructura todavía.</p></div>';
  }

  var semChips = _estGetSemChips();
  var semBar = '<div class="est-filtro-bar">' +
    '<span class="est-filtro-label">Semestre:</span>' +
    semChips.map(function(c) {
      var active = _estGrupoFiltroSem === c.val ? ' active' : '';
      return '<button class="est-filtro-chip' + active + '" data-filtrosem="' + genEsc(c.val) + '" onclick="_estSetGrupoFiltro(\'' + c.val + '\')">' + genEsc(c.label) + '</button>';
    }).join('') + '</div>';

  return '<div class="est-filtro-wrapper">' + semBar + '</div>' +
    '<div id="est-materia-cards">' + _estMateriaCardsHTML() + '</div>';
}

function _estMateriaCardsHTML() {
  var filtroSem = _estGrupoFiltroSem;
  var conjSem   = _EST_CONJUNTOS_SEM_[filtroSem] || null;

  /* ── 1. Agrupar filas por UAC, aplicando filtro de semestre ──── */
  var porUAC = {};
  _estData.forEach(function(row) {
    var sem = String(row.semestre || '').trim();
    if (filtroSem) {
      if (conjSem) { if (conjSem.indexOf(sem) === -1) return; }
      else if (sem !== filtroSem) return;
    }
    var uac = String(row.uac || '').trim() || '(sin UAC)';
    if (!porUAC[uac]) porUAC[uac] = [];
    porUAC[uac].push(row);
  });

  var uacKeys = Object.keys(porUAC).sort();
  if (!uacKeys.length) {
    return '<div class="gen-empty-state" style="padding:40px 0"><p>No hay materias para el filtro seleccionado.</p></div>';
  }

  /* ── 2. Agrupar UACs por componente ─────────────────────────── */
  var porComp = {};
  uacKeys.forEach(function(uac) {
    var comp = String(porUAC[uac][0].componente || '').trim() || '(sin componente)';
    if (!porComp[comp]) porComp[comp] = [];
    porComp[comp].push(uac);
  });

  /* Ordenar componentes: sin componente al final, el resto alfabético */
  var compKeys = Object.keys(porComp).sort(function(a, b) {
    if (a === '(sin componente)') return 1;
    if (b === '(sin componente)') return -1;
    return a.localeCompare(b);
  });

  /* ── 3. Construir una sección por componente ─────────────────── */
  return compKeys.map(function(comp, compIdx) {
    var uacsDeComp = porComp[comp];
    var totalMats  = uacsDeComp.length;

    /* Color del encabezado: si el componente tiene estilo de capacitación úsalo,
       si no, usa un tono neutro basado en posición */
    var capInfo  = genGetCap(comp);
    var capStyle = capInfo ? _GEN_CAP_STYLE_[capInfo] : null;
    var hdrBg    = capStyle ? capStyle.bg    : '#1e293b';
    var hdrText  = capStyle ? capStyle.text  : '#f1f5f9';
    var hdrBorder= capStyle ? capStyle.border: '#334155';

    /* Encabezado de sección estilo gen-mat-grp-head */
    var secHeader =
      '<div class="est-mat-comp-header' + (compIdx === 0 ? ' est-mat-comp-header--first' : '') +
      '" style="background:' + hdrBg + ';border-left:4px solid ' + hdrBorder + '">' +
        '<span class="est-mat-comp-title" style="color:' + hdrText + '">' + genEsc(comp) + '</span>' +
        '<span class="est-mat-comp-count" style="background:rgba(255,255,255,.15);color:' + hdrText + '">' +
          totalMats + ' materia' + (totalMats !== 1 ? 's' : '') +
        '</span>' +
      '</div>';

    /* Tarjetas del componente */
    var cards = uacsDeComp.map(function(uac) {
      return _estMateriaCard(uac, porUAC[uac]);
    }).join('');

    return '<div class="est-mat-comp-section">' +
      secHeader +
      '<div class="est-cards-grid est-mat-grid">' + cards + '</div>' +
    '</div>';
  }).join('');
}

/* ── Tarjeta individual de una materia ─────────────────────────────── */
function _estMateriaCard(uac, filas) {
  var f0    = filas[0];
  var sem   = String(f0.semestre          || '').trim();
  var campo = String(f0.campo_disciplinar || '').trim();
  var horas = Number(f0.tot_horas)        || 0;
  var sc    = _EST_SEM_COLORS_[sem] || { bg: '#f8fafc', border: '#cbd5e1', text: '#475569', light: '#f1f5f9' };

  /* Enriquecer desde catálogo */
  var uacNorm = genNormStr(uac);
  var catMat  = null;
  (_genApp.materias || []).some(function(m) {
    if (genNormStr(m.nombre || '') === uacNorm) { catMat = m; return true; }
  });
  var capInfo  = catMat ? genGetCap(catMat.componente) : null;
  var capStyle = capInfo ? _GEN_CAP_STYLE_[capInfo] : null;

  /* Grupos únicos */
  var grupos = [], grupoSeen = {};
  filas.forEach(function(f) {
    if (f.grupo && !grupoSeen[f.grupo]) { grupoSeen[f.grupo] = true; grupos.push(f.grupo); }
  });
  grupos.sort();

  /* Docente → grupos que cubre, con tipo y estatus */
  var docenteMap = {};  // key → { grupos:[], tipo, estatus, tfNombre }
  filas.forEach(function(f) {
    var tipo = String(f.tipo_asignacion_docente || '').trim();
    var key;
    if (tipo === 'Vacante') {
      key = '\x00vacante';
    } else if (tipo === 'Tiempo fijo') {
      key = '\x01tf:' + (String(f.docente_tiempo_fijo || '').trim() || '(sin nombre)');
    } else {
      key = String(f.docente || '').trim() || '(sin docente)';
    }
    if (!docenteMap[key]) docenteMap[key] = { grupos: [], tipo: tipo, estatus: String(f.estatus_cobertura || '').trim() };
    if (f.grupo && docenteMap[key].grupos.indexOf(f.grupo) === -1) docenteMap[key].grupos.push(f.grupo);
  });
  var docenteKeys = Object.keys(docenteMap).sort(function(a, b) {
    if (a.charAt(0) === '\x00') return 1;
    if (b.charAt(0) === '\x00') return -1;
    if (a.charAt(0) === '\x01') return 1;
    if (b.charAt(0) === '\x01') return -1;
    return a.localeCompare(b);
  });

  /* Badges */
  var semBadge = sem
    ? '<span class="est-v2-badge" style="background:' + sc.light + ';color:' + sc.text + ';border-color:' + sc.border + '">Sem ' + genEsc(sem) + '°</span>'
    : '';
  var capBadge = capStyle
    ? '<span class="est-v2-badge" style="background:' + capStyle.bg + ';color:' + capStyle.text + ';border-color:' + capStyle.border + ';font-size:10px">' + genEsc(capInfo) + '</span>'
    : '';

  /* Filas de docentes */
  var docenteRows = docenteKeys.map(function(key) {
    var entry    = docenteMap[key];
    var isVac    = entry.tipo === 'Vacante'      || key.charAt(0) === '\x00';
    var isTF     = entry.tipo === 'Tiempo fijo'  || key.charAt(0) === '\x01';
    var displayName = isVac ? 'Vacante' :
      (isTF ? (key.slice(4) || '(sin nombre)') : key);
    var sinDoc   = displayName === '(sin docente)';
    var initials = isVac ? '!' : (isTF ? 'TF' :
      (sinDoc ? '?' : displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(function(w) { return w.charAt(0); }).join('').toUpperCase()));
    var avatarBg = isVac ? '#ef4444' : (isTF ? '#d97706' : (sinDoc ? '#ef4444' : '#3b82f6'));
    var chips = entry.grupos.map(function(g) {
      return '<span class="est-mat-chip-grp est-mat-chip-sm" style="background:' + sc.light + ';color:' + sc.text + ';border-color:' + sc.border + '">' + genEsc(g) + '</span>';
    }).join('');
    var tipoBadge = isTF    ? '<span class="est-cob-badge est-cob-tf" style="font-size:9px;padding:1px 5px">TF</span>'
                 : (isVac   ? '<span class="est-cob-badge est-cob-vacante" style="font-size:9px;padding:1px 5px">Vacante</span>' : '');
    var estatusBadge = entry.estatus ? ' ' + _estEstatusBadge(entry.estatus) : '';
    return '<div class="est-mat-docente-row">' +
      '<span class="est-mat-doc-avatar" style="background:' + avatarBg + '">' + genEsc(initials) + '</span>' +
      '<span class="est-mat-doc-name' + (sinDoc || isVac ? ' est-mat-sin-doc' : '') + '">' +
        genEsc(displayName) + ' ' + tipoBadge + estatusBadge +
      '</span>' +
      '<span class="est-mat-doc-chips">' + chips + '</span>' +
    '</div>';
  }).join('');

  /* Chips de grupos */
  var grupoChips = grupos.map(function(g) {
    return '<span class="est-mat-chip-grp" style="background:' + sc.light + ';color:' + sc.text + ';border-color:' + sc.border + '">' + genEsc(g) + '</span>';
  }).join('');

  return '<div class="est-card-v2 est-mat-card" style="border-top:3px solid ' + sc.border + '">' +

    /* Ficha */
    '<div class="est-mat-ficha" style="background:' + sc.bg + '">' +
      '<div class="est-mat-ficha-top">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="est-mat-uac-name">' + genEsc(uac) + '</div>' +
          (campo ? '<div class="est-mat-campo">' + genEsc(campo) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">' +
          semBadge + capBadge +
        '</div>' +
      '</div>' +
      (horas ? '<div class="est-mat-ficha-meta">' +
        '<span class="est-v2-total-badge" style="background:' + sc.light + ';color:' + sc.text + ';border-color:' + sc.border + '">' + horas + ' hrs/sem</span>' +
      '</div>' : '') +
    '</div>' +

    /* Docentes */
    '<div class="est-mat-section">' +
      '<div class="est-mat-section-label">Docentes / cobertura (' + docenteKeys.length + ')</div>' +
      docenteRows +
    '</div>' +

    /* Grupos */
    '<div class="est-mat-section est-mat-grupos">' +
      '<div class="est-mat-section-label">Grupos (' + grupos.length + ')</div>' +
      '<div class="est-mat-chips">' + grupoChips + '</div>' +
    '</div>' +

  '</div>';
}

// ── HELPERS DE HORARIO VISUAL ────────────────────────────────────────

/** Parsea "HH:MM-HH:MM" → {ini, fin} en minutos. Devuelve null si no aplica. */
function _estRangoHora(val) {
  if (!val) return null;
  var m = String(val).match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  var ini = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  var fin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  return ini < fin ? { ini: ini, fin: fin } : null;
}

/** ¿Dos rangos se traslapan? */
function _estRangosTrasladan(a, b) {
  return a.ini < b.fin && b.ini < a.fin;
}

/** Construye la cuadrícula semanal a partir de un arreglo de filas.
 *  labelFn(row, entry) → HTML del bloque (entry tiene .dia, .iniH, .finH, .isFirst).
 *  conflictFilas → {fila: true} de filas con error.
 *  colorFn(uac) → {bg, border} para colorear por materia (opcional). */
function _estTimetableGridHTML(filas, labelFn, conflictFilas, colorFn) {
  var _CF_ = conflictFilas || {};
  var diasLabels = { lunes:'Lunes', martes:'Martes', miercoles:'Miércoles', jueves:'Jueves', viernes:'Viernes' };

  var minH = Infinity, maxH = -Infinity;
  filas.forEach(function(row) {
    _EST_DIAS_.forEach(function(dia) {
      var r = _estRangoHora(row[dia]);
      if (!r) return;
      var h1 = Math.floor(r.ini / 60), h2 = Math.ceil(r.fin / 60);
      if (h1 < minH) minH = h1;
      if (h2 > maxH) maxH = h2;
    });
  });

  if (minH === Infinity) {
    return '<div class="gen-empty-state" style="margin-top:24px"><p>Sin horario capturado para esta selección.</p></div>';
  }

  // Mapa: dia → hora_entera → [{row, iniH, finH, isFirst, dia}]
  var cellMap = {};
  _EST_DIAS_.forEach(function(dia) { cellMap[dia] = {}; });
  filas.forEach(function(row) {
    _EST_DIAS_.forEach(function(dia) {
      var r = _estRangoHora(row[dia]);
      if (!r) return;
      var iniH = Math.floor(r.ini / 60);
      var finH = Math.ceil(r.fin / 60);
      for (var h = iniH; h < finH; h++) {
        if (!cellMap[dia][h]) cellMap[dia][h] = [];
        cellMap[dia][h].push({ row: row, iniH: iniH, finH: finH, isFirst: h === iniH, dia: dia });
      }
    });
  });

  var thead = '<tr><th class="arm-tt-th-hora">Hora</th>' +
    _EST_DIAS_.map(function(d) { return '<th class="arm-tt-th-dia">' + diasLabels[d] + '</th>'; }).join('') +
    '</tr>';

  var tbody = '';
  for (var h = minH; h < maxH; h++) {
    var hLabel = (h < 10 ? '0' : '') + h + ':00';
    var hNext  = (h + 1 < 10 ? '0' : '') + (h + 1) + ':00';
    var cells = _EST_DIAS_.map(function(dia) {
      var entries = cellMap[dia][h] || [];
      if (!entries.length) return '<td class="arm-tt-cell"></td>';

      var hasConflict = entries.length > 1;
      var content = entries.map(function(e) {
        var rowConflict = _CF_[e.row._fila_];
        var isErr = hasConflict || rowConflict;
        var clr    = (!isErr && colorFn) ? colorFn(e.row.uac) : null;
        var bg     = isErr ? '#fee2e2' : (clr ? clr.bg     : (e.isFirst ? '#eff6ff' : '#f0f9ff'));
        var border = isErr ? '#ef4444' : (clr ? clr.border : '#3b82f6');
        var top    = e.isFirst ? 'border-top:2px solid ' + border + ';' : 'border-top:1px dashed ' + border + '44;';
        return '<div class="arm-tt-item" style="background:' + bg + ';border-left:3px solid ' + border + ';' + top + '">' +
          labelFn(e.row, e) + '</div>';
      }).join('');

      return '<td class="arm-tt-cell arm-tt-filled' + (hasConflict ? ' arm-tt-conflict' : '') + '">' + content + '</td>';
    }).join('');

    tbody += '<tr><td class="arm-tt-hora">' + hLabel + '<span class="arm-tt-hora-sep">–</span>' + hNext + '</td>' + cells + '</tr>';
  }

  return '<div class="arm-tt-wrap"><table class="arm-tt-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table></div>';
}

// ── VISTA HORARIO GRUPO ───────────────────────────────────────────────

function _estGetGruposVisibles_() {
  // Paso 1: reunir semestre y turno de TODAS las filas del grupo
  // (usa el primer valor no vacío que encuentre para cada campo)
  var grupoInfo = {};
  _estData.forEach(function(row) {
    var g = String(row.grupo || '').trim();
    if (!g) return;
    if (!grupoInfo[g]) grupoInfo[g] = { semestre: '', turno: '' };
    if (!grupoInfo[g].semestre && row.semestre) grupoInfo[g].semestre = String(row.semestre).trim();
    if (!grupoInfo[g].turno    && row.turno)    grupoInfo[g].turno    = String(row.turno).trim();
  });
  // Paso 2: filtrar por los chips activos
  return Object.keys(grupoInfo).filter(function(g) {
    var info = grupoInfo[g];
    if (_estHorGrupoSem   && info.semestre !== _estHorGrupoSem)   return false;
    if (_estHorGrupoTurno && info.turno    !== _estHorGrupoTurno) return false;
    return true;
  }).sort();
}

function _estGrupoTimetableBlock_(g, cfFilas) {
  var filas = _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
    .filter(function(r) { return String(r.grupo || '').trim() === g; });
  var sem   = filas[0] ? String(filas[0].semestre || '').trim() : '';
  var turno = filas[0] ? String(filas[0].turno    || '').trim() : '';
  var c     = _EST_SEM_COLORS_[sem] || { bg: '#f8fafc', border: '#94a3b8', text: '#475569', light: '#f1f5f9' };
  var timetable = _estTimetableGridHTML(filas, function(row, e) {
    var slot = e && e.isFirst ? (row[e.dia] || '') : '';
    return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
           '<span class="arm-tt-meta">' + genEsc(row.docente || '—') + '</span>' +
           (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
  }, cfFilas);
  return '<div class="est-todos-section">' +
    '<div class="est-todos-header" style="border-left:4px solid ' + c.border + ';background:' + c.light + ';">' +
      '<span class="est-todos-name" style="color:' + c.text + ';">' + genEsc(g) + '</span>' +
      (turno ? '<span class="est-todos-badge">' + genEsc(turno) + '</span>' : '') +
      (sem   ? '<span class="est-todos-badge est-todos-badge--sem">' + sem + '° sem.</span>' : '') +
      '<span class="est-todos-badge est-todos-badge--cnt">' + filas.length + ' UAC</span>' +
    '</div>' +
    timetable +
  '</div>';
}

function _estHorarioGrupoHTML() {
  var grupos = _estGetGruposVisibles_();

  var semChips = ['', '1', '2', '3', '4', '5', '6'].map(function(s) {
    return '<button class="est-qf-chip' + (s === _estHorGrupoSem ? ' active' : '') +
      '" onclick="_estHorGrupoSetSem(\'' + s + '\')">' + (s ? s + '°' : 'Todos') + '</button>';
  }).join('');

  var turnoChips = ['', 'Matutino', 'Vespertino'].map(function(t) {
    return '<button class="est-qf-chip' + (t === _estHorGrupoTurno ? ' active' : '') +
      '" onclick="_estHorGrupoSetTurno(\'' + t + '\')">' + (t || 'Todos') + '</button>';
  }).join('');

  var selOpts = '<option value="">— Selecciona un grupo —</option>' +
    '<option value="*"' + (_estHorGrupoSel === '*' ? ' selected' : '') + '>☰ Todos (' + grupos.length + ')</option>' +
    grupos.map(function(g) {
      return '<option value="' + genEsc(g) + '"' + (g === _estHorGrupoSel ? ' selected' : '') + '>' + genEsc(g) + '</option>';
    }).join('');

  var showPrint = _estHorGrupoSel && _estHorGrupoSel !== '*';
  var printIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="vertical-align:-2px;margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

  var cfFilas = {};
  _estConflictos.errores.forEach(function(e) { if (e.fila) cfFilas[e.fila] = true; });

  var grid;
  if (_estHorGrupoSel === '*') {
    grid = !grupos.length
      ? '<div class="gen-empty-state" style="margin-top:24px"><p>Sin grupos para los filtros seleccionados.</p></div>'
      : grupos.map(function(g) { return _estGrupoTimetableBlock_(g, cfFilas); }).join('');
  } else if (_estHorGrupoSel) {
    var filas = _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
      .filter(function(r) { return String(r.grupo || '').trim() === _estHorGrupoSel; });
    grid = _estTimetableGridHTML(filas, function(row, e) {
      var slot = e && e.isFirst ? (row[e.dia] || '') : '';
      return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
             '<span class="arm-tt-meta">' + genEsc(row.docente || '—') + '</span>' +
             (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
    }, cfFilas);
  } else {
    grid = '<div class="gen-empty-state" style="margin-top:24px"><p>Selecciona un grupo o "Todos" para ver el horario.</p></div>';
  }

  return '<div class="arm-tt-page">' +
    '<div class="est-hor-filter-bar">' +
      '<div class="est-qf-group"><span class="est-qf-label">Semestre:</span>' + semChips + '</div>' +
      '<div class="est-qf-group"><span class="est-qf-label">Turno:</span>' + turnoChips + '</div>' +
    '</div>' +
    '<div class="arm-tt-sel-bar" style="flex-wrap:wrap;gap:8px;">' +
      '<label class="gen-label">Grupo:</label>' +
      '<select id="est-hor-grupo-sel" class="gen-select" style="min-width:220px">' + selOpts + '</select>' +
      '<button class="gen-btn gen-btn-sm gen-btn-secondary" id="est-btn-print-grupo" onclick="_estPrintGrupo_()"' +
        (showPrint ? '' : ' style="display:none"') + '>' + printIcon + 'Imprimir grupo</button>' +
      '<button class="gen-btn gen-btn-sm gen-btn-ghost" onclick="_estPrintTodosGrupos_()">Imprimir todos</button>' +
    '</div>' +
    '<div id="est-hor-grupo-grid">' + grid + '</div>' +
  '</div>';
}

function _estBindHorarioGrupo() {
  var sel = document.getElementById('est-hor-grupo-sel');
  if (!sel) return;
  sel.addEventListener('change', function() {
    _estHorGrupoSel = this.value;
    _estRefreshHorGrupoGrid_();
  });
}

function _estRefreshHorGrupoGrid_() {
  var grid = document.getElementById('est-hor-grupo-grid');
  var btnP = document.getElementById('est-btn-print-grupo');
  if (btnP) btnP.style.display = (_estHorGrupoSel && _estHorGrupoSel !== '*') ? '' : 'none';
  if (!grid) return;
  var cfFilas = {};
  _estConflictos.errores.forEach(function(e) { if (e.fila) cfFilas[e.fila] = true; });
  if (_estHorGrupoSel === '*') {
    var grupos = _estGetGruposVisibles_();
    grid.innerHTML = !grupos.length
      ? '<div class="gen-empty-state" style="margin-top:24px"><p>Sin grupos para los filtros seleccionados.</p></div>'
      : grupos.map(function(g) { return _estGrupoTimetableBlock_(g, cfFilas); }).join('');
  } else if (_estHorGrupoSel) {
    var filas = _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
      .filter(function(r) { return String(r.grupo || '').trim() === _estHorGrupoSel; });
    grid.innerHTML = _estTimetableGridHTML(filas, function(row, e) {
      var slot = e && e.isFirst ? (row[e.dia] || '') : '';
      return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
             '<span class="arm-tt-meta">' + genEsc(row.docente || '—') + '</span>' +
             (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
    }, cfFilas);
  } else {
    grid.innerHTML = '<div class="gen-empty-state" style="margin-top:24px"><p>Selecciona un grupo o "Todos" para ver el horario.</p></div>';
  }
}

function _estHorGrupoSetSem(sem) {
  _estHorGrupoSem = sem;
  var grupos = _estGetGruposVisibles_();
  if (_estHorGrupoSel && _estHorGrupoSel !== '*' && grupos.indexOf(_estHorGrupoSel) === -1) _estHorGrupoSel = '*';
  var vc = document.getElementById('est-view-content');
  if (vc) { vc.innerHTML = _estViewHTML(); _estBindHorarioGrupo(); }
}

function _estHorGrupoSetTurno(turno) {
  _estHorGrupoTurno = turno;
  var grupos = _estGetGruposVisibles_();
  if (_estHorGrupoSel && _estHorGrupoSel !== '*' && grupos.indexOf(_estHorGrupoSel) === -1) _estHorGrupoSel = '*';
  var vc = document.getElementById('est-view-content');
  if (vc) { vc.innerHTML = _estViewHTML(); _estBindHorarioGrupo(); }
}

// ── VISTA HORARIO DOCENTE ─────────────────────────────────────────────

function _estGetDocentesVisibles_() {
  var result = [], seen = {};
  _estData.forEach(function(row) {
    var tipo = String(row.tipo_asignacion_docente || '').trim();
    if (tipo === 'Vacante') return;
    var d   = String(row.docente || '').trim();
    var trn = String(row.turno   || '').trim();
    if (!d || seen[d]) return;
    if (_estHorDocTurno && trn !== _estHorDocTurno) return;
    seen[d] = true;
    result.push(d);
  });
  return result.sort();
}

function _estDocenteTimetableBlock_(d, cfFilas) {
  var filas = _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
    .filter(function(r) {
      var tipo = String(r.tipo_asignacion_docente || '').trim();
      if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return false;
      return String(r.docente || '').trim() === d;
    });
  var formacion = filas[0] ? String(filas[0].formacion_docente || '').trim() : '';
  var initials  = d.split(/\s+/).slice(0, 2).map(function(w) { return w[0] || ''; }).join('').toUpperCase();
  var timetable = _estTimetableGridHTML(filas, function(row, e) {
    var slot = e && e.isFirst ? (row[e.dia] || '') : '';
    return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
           '<span class="arm-tt-meta">' + genEsc(row.grupo || '—') + '</span>' +
           (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
  }, cfFilas);
  return '<div class="est-todos-section">' +
    '<div class="est-todos-header est-todos-header--doc">' +
      '<div class="est-todos-doc-avatar">' + genEsc(initials) + '</div>' +
      '<div class="est-todos-doc-info">' +
        '<span class="est-todos-name">' + genEsc(d) + '</span>' +
        (formacion ? '<span class="est-todos-doc-form">' + genEsc(formacion) + '</span>' : '') +
      '</div>' +
      '<span class="est-todos-badge est-todos-badge--cnt">' + filas.length + ' grupos</span>' +
    '</div>' +
    timetable +
  '</div>';
}

function _estHorarioDocenteHTML() {
  var docentes = _estGetDocentesVisibles_();

  var turnoChips = ['', 'Matutino', 'Vespertino'].map(function(t) {
    return '<button class="est-qf-chip' + (t === _estHorDocTurno ? ' active' : '') +
      '" onclick="_estHorDocSetTurno(\'' + t + '\')">' + (t || 'Todos') + '</button>';
  }).join('');

  var selOpts = '<option value="">— Selecciona un docente —</option>' +
    '<option value="*"' + (_estHorDocSel === '*' ? ' selected' : '') + '>☰ Todos (' + docentes.length + ')</option>' +
    docentes.map(function(d) {
      return '<option value="' + genEsc(d) + '"' + (d === _estHorDocSel ? ' selected' : '') + '>' + genEsc(d) + '</option>';
    }).join('');

  var showPrint = _estHorDocSel && _estHorDocSel !== '*';
  var printIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="vertical-align:-2px;margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

  var cfFilas = {};
  _estConflictos.errores.forEach(function(e) { if (e.fila) cfFilas[e.fila] = true; });

  var grid;
  if (_estHorDocSel === '*') {
    grid = !docentes.length
      ? '<div class="gen-empty-state" style="margin-top:24px"><p>Sin docentes para los filtros seleccionados.</p></div>'
      : docentes.map(function(d) { return _estDocenteTimetableBlock_(d, cfFilas); }).join('');
  } else if (_estHorDocSel) {
    var filas = _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
      .filter(function(r) {
        var tipo = String(r.tipo_asignacion_docente || '').trim();
        if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return false;
        return String(r.docente || '').trim() === _estHorDocSel;
      });
    grid = _estTimetableGridHTML(filas, function(row, e) {
      var slot = e && e.isFirst ? (row[e.dia] || '') : '';
      return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
             '<span class="arm-tt-meta">' + genEsc(row.grupo || '—') + '</span>' +
             (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
    }, cfFilas);
  } else {
    grid = '<div class="gen-empty-state" style="margin-top:24px"><p>Selecciona un docente o "Todos" para ver el horario.</p></div>';
  }

  return '<div class="arm-tt-page">' +
    '<div class="est-hor-filter-bar">' +
      '<div class="est-qf-group"><span class="est-qf-label">Turno:</span>' + turnoChips + '</div>' +
    '</div>' +
    '<div class="arm-tt-sel-bar" style="flex-wrap:wrap;gap:8px;">' +
      '<label class="gen-label">Docente:</label>' +
      '<select id="est-hor-doc-sel" class="gen-select" style="min-width:280px">' + selOpts + '</select>' +
      '<button class="gen-btn gen-btn-sm gen-btn-secondary" id="est-btn-print-docente" onclick="_estPrintDocente_()"' +
        (showPrint ? '' : ' style="display:none"') + '>' + printIcon + 'Imprimir docente</button>' +
      '<button class="gen-btn gen-btn-sm gen-btn-ghost" onclick="_estPrintTodosDocentes_()">Imprimir todos</button>' +
    '</div>' +
    '<div id="est-hor-doc-grid">' + grid + '</div>' +
  '</div>';
}

function _estBindHorarioDocente() {
  var sel = document.getElementById('est-hor-doc-sel');
  if (!sel) return;
  sel.addEventListener('change', function() {
    _estHorDocSel = this.value;
    _estRefreshHorDocGrid_();
  });
}

function _estRefreshHorDocGrid_() {
  var grid = document.getElementById('est-hor-doc-grid');
  var btnP = document.getElementById('est-btn-print-docente');
  if (btnP) btnP.style.display = (_estHorDocSel && _estHorDocSel !== '*') ? '' : 'none';
  if (!grid) return;
  var cfFilas = {};
  _estConflictos.errores.forEach(function(e) { if (e.fila) cfFilas[e.fila] = true; });
  if (_estHorDocSel === '*') {
    var docentes = _estGetDocentesVisibles_();
    grid.innerHTML = !docentes.length
      ? '<div class="gen-empty-state" style="margin-top:24px"><p>Sin docentes para los filtros seleccionados.</p></div>'
      : docentes.map(function(d) { return _estDocenteTimetableBlock_(d, cfFilas); }).join('');
  } else if (_estHorDocSel) {
    var filas = _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
      .filter(function(r) {
        var tipo = String(r.tipo_asignacion_docente || '').trim();
        if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return false;
        return String(r.docente || '').trim() === _estHorDocSel;
      });
    grid.innerHTML = _estTimetableGridHTML(filas, function(row, e) {
      var slot = e && e.isFirst ? (row[e.dia] || '') : '';
      return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
             '<span class="arm-tt-meta">' + genEsc(row.grupo || '—') + '</span>' +
             (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
    }, cfFilas);
  } else {
    grid.innerHTML = '<div class="gen-empty-state" style="margin-top:24px"><p>Selecciona un docente o "Todos" para ver el horario.</p></div>';
  }
}

function _estHorDocSetTurno(turno) {
  _estHorDocTurno = turno;
  var docs = _estGetDocentesVisibles_();
  if (_estHorDocSel && _estHorDocSel !== '*' && docs.indexOf(_estHorDocSel) === -1) _estHorDocSel = '*';
  var vc = document.getElementById('est-view-content');
  if (vc) { vc.innerHTML = _estViewHTML(); _estBindHorarioDocente(); }
}

// ── IMPRESIÓN / EXPORTACIÓN DESDE ESTRUCTURA ─────────────────────────

/** Convierte filas de _estData al formato "sessions" que usa _hiPrintGrid_ */
function _estToSessions(filas) {
  var diaMap = { lunes:'LUNES', martes:'MARTES', miercoles:'MIERCOLES', jueves:'JUEVES', viernes:'VIERNES' };
  var sessions = [];
  filas.forEach(function(row) {
    var tipo = String(row.tipo_asignacion_docente || '').trim();
    if (tipo === 'Vacante') return;
    var docNombre = tipo === 'Tiempo fijo'
      ? String(row.docente_tiempo_fijo || row.docente || '').trim()
      : String(row.docente || '').trim();
    _EST_DIAS_.forEach(function(diaKey) {
      var val = String(row[diaKey] || '').trim();
      if (!val) return;
      var m = val.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
      if (!m) return;
      var iniMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      var finMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
      var horas  = finMin > iniMin ? Math.round((finMin - iniMin) / 60 * 10) / 10 : 0;
      sessions.push({
        dia:                 diaMap[diaKey],
        hora_inicio:         ('0' + m[1]).slice(-2) + ':' + m[2],
        hora_fin:            ('0' + m[3]).slice(-2) + ':' + m[4],
        horas_bloque:        horas,
        materia:             String(row.uac    || '').trim(),
        docente:             docNombre,
        grupo:               String(row.grupo  || '').trim(),
        turno:               String(row.turno  || '').trim(),
        componente:          String(row.componente || '').trim(),
        formacion_academica: String(row.formacion_docente || '').trim(),
        clave_docente:       String(row.docente_id || '').trim(),
        total_horas_materia: String(row.tot_horas   || '').trim()
      });
    });
  });
  return sessions;
}

/** Cuerpo de impresión para un grupo */
function _estGrupoBodyPrint_(sessions, grupo) {
  var turno   = (sessions[0] || {}).turno || '';
  var estRow  = _estData.filter(function(r) { return String(r.grupo || '').trim() === grupo; })[0];
  var semestre = estRow ? (String(estRow.semestre || '') + '° Semestre') : '';
  var totalHrs = Math.round(sessions.reduce(function(a, r) { return a + (parseFloat(r.horas_bloque) || 0); }, 0) * 10) / 10;
  var metaHtml =
    '<table class="meta-table"><tbody>' +
    '<tr><th class="meta-lbl">Grupo</th><td class="meta-val">' + _hiPe_(grupo) + '</td>' +
         '<th class="meta-lbl">Turno</th><td class="meta-val">' + _hiPe_(turno) + '</td></tr>' +
    '<tr><th class="meta-lbl">Semestre</th><td class="meta-val">' + _hiPe_(semestre) + '</td>' +
         '<th class="meta-lbl">Ciclo escolar</th><td class="meta-val">' + _hiPe_(_genApp.ciclo || '') + '</td></tr>' +
    '<tr><th class="meta-lbl">Total horas / semana</th><td class="meta-val" colspan="3"><strong>' + totalHrs + ' hrs</strong></td></tr>' +
    '</tbody></table>';
  return metaHtml +
    '<h2 class="section-title">Distribución Semanal de Actividades</h2>' +
    _hiPrintGrid_(sessions, 'grupo') +
    '<h2 class="section-title">Materias Asignadas al Grupo</h2>' +
    _hiMateriasTableHtml_(sessions, 'grupo') +
    _hiFirmasGrupoHtml_();
}

/** Cuerpo de impresión para un docente */
function _estDocenteBodyPrint_(sessions, docente) {
  var grupos   = Array.from(new Set(sessions.map(function(r) { return r.grupo; }).filter(Boolean))).sort();
  var estRow   = _estData.filter(function(r) {
    var tipo = String(r.tipo_asignacion_docente || '').trim();
    return tipo !== 'Vacante' && String(r.docente || '').trim() === docente;
  })[0];
  var formacion = estRow ? String(estRow.formacion_docente || '').trim() : '';
  var clave     = estRow ? String(estRow.docente_id || '').trim() : '';
  var totalHrs  = Math.round(sessions.reduce(function(a, r) { return a + (parseFloat(r.horas_bloque) || 0); }, 0) * 10) / 10;
  var metaHtml =
    '<table class="meta-table"><tbody>' +
    '<tr><th class="meta-lbl">Docente</th><td class="meta-val" colspan="3">' + _hiPe_(docente) + '</td></tr>' +
    '<tr><th class="meta-lbl">Clave / CURP</th><td class="meta-val">' + _hiPe_(clave) + '</td>' +
         '<th class="meta-lbl">Ciclo escolar</th><td class="meta-val">' + _hiPe_(_genApp.ciclo || '') + '</td></tr>' +
    '<tr><th class="meta-lbl">Formación académica</th><td class="meta-val">' + _hiPe_(formacion) + '</td>' +
         '<th class="meta-lbl">Grupos atendidos</th><td class="meta-val">' + _hiPe_(grupos.join(', ')) + '</td></tr>' +
    '<tr><th class="meta-lbl">Total horas / semana</th><td class="meta-val" colspan="3"><strong>' + totalHrs + ' hrs</strong></td></tr>' +
    '</tbody></table>';
  return metaHtml +
    '<h2 class="section-title">Distribución Semanal</h2>' +
    _hiPrintGrid_(sessions, 'docente') +
    '<h2 class="section-title">Detalle de Carga Horaria</h2>' +
    _hiMateriasTableHtml_(sessions, 'docente') +
    _hiFirmasDocenteHtml_(docente);
}

function _estPrintGrupo_() {
  if (!_estHorGrupoSel || _estHorGrupoSel === '*') { alert('Selecciona un grupo individual antes de imprimir.'); return; }
  var sessions = _estToSessions(_estData.filter(function(r) { return String(r.grupo || '').trim() === _estHorGrupoSel; }));
  if (!sessions.length) { alert('Sin horario capturado para este grupo.'); return; }
  _hiOpenPrint_('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Horario ' + _hiPe_(_estHorGrupoSel) + '</title>' +
    _hiPrintCss_('landscape') + '</head><body>' +
    _hiHeaderHtml_('Horario de Actividades', _genApp.ciclo || '') +
    _estGrupoBodyPrint_(sessions, _estHorGrupoSel) + '</body></html>');
}

function _estPrintTodosGrupos_() {
  var grupos = _estGetGruposVisibles_();
  if (!grupos.length) { alert('Sin grupos disponibles para los filtros seleccionados.'); return; }
  var pages = [];
  grupos.forEach(function(g) {
    var sessions = _estToSessions(_estData.filter(function(r) { return String(r.grupo || '').trim() === g; }));
    if (sessions.length) pages.push('<div class="report-page">' +
      _hiHeaderHtml_('Horario de Actividades', _genApp.ciclo || '') +
      _estGrupoBodyPrint_(sessions, g) + '</div>');
  });
  if (!pages.length) { alert('Sin horarios capturados para los grupos seleccionados.'); return; }
  _hiOpenPrint_('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Horarios por Grupo — ' + _hiPe_(_genApp.ciclo || '') + '</title>' +
    _hiPrintCss_('landscape') + '</head><body>' + pages.join('') + '</body></html>');
}

function _estPrintDocente_() {
  if (!_estHorDocSel || _estHorDocSel === '*') { alert('Selecciona un docente individual antes de imprimir.'); return; }
  var sessions = _estToSessions(_estData.filter(function(r) {
    var tipo = String(r.tipo_asignacion_docente || '').trim();
    return tipo !== 'Vacante' && tipo !== 'Tiempo fijo' && String(r.docente || '').trim() === _estHorDocSel;
  }));
  if (!sessions.length) { alert('Sin horario capturado para este docente.'); return; }
  _hiOpenPrint_('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Carga ' + _hiPe_(_estHorDocSel) + '</title>' +
    _hiPrintCss_('landscape') + '</head><body>' +
    _hiHeaderHtml_('Carga Horaria Frente a Grupo', _genApp.ciclo || '') +
    _estDocenteBodyPrint_(sessions, _estHorDocSel) + '</body></html>');
}

function _estPrintTodosDocentes_() {
  var docentes = _estGetDocentesVisibles_();
  if (!docentes.length) { alert('Sin docentes disponibles para los filtros seleccionados.'); return; }
  var pages = [];
  docentes.forEach(function(d) {
    var sessions = _estToSessions(_estData.filter(function(r) {
      var tipo = String(r.tipo_asignacion_docente || '').trim();
      return tipo !== 'Vacante' && tipo !== 'Tiempo fijo' && String(r.docente || '').trim() === d;
    }));
    if (sessions.length) pages.push('<div class="report-page">' +
      _hiHeaderHtml_('Carga Horaria Frente a Grupo', _genApp.ciclo || '') +
      _estDocenteBodyPrint_(sessions, d) + '</div>');
  });
  if (!pages.length) { alert('Sin horarios capturados para los docentes seleccionados.'); return; }
  _hiOpenPrint_('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Horarios por Docente — ' + _hiPe_(_genApp.ciclo || '') + '</title>' +
    _hiPrintCss_('landscape') + '</head><body>' + pages.join('') + '</body></html>');
}

// ── VISTA CONFLICTOS ─────────────────────────────────────────────────

function _estConflictosHTML() {
  var cf = _estConflictos;
  if (!cf.errores.length && !cf.advertencias.length) {
    return '<div class="gen-empty-state" style="margin-top:32px">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" width="40" height="40"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<p style="color:#15803d;font-weight:600">Sin conflictos. La estructura está lista.</p>' +
      '<p class="gen-hint">Haz clic en "Validar" para ejecutar la validación completa en el servidor.</p>' +
      '</div>';
  }

  var errHtml = '';
  if (cf.errores.length) {
    errHtml = '<div class="est-conflict-section">' +
      '<h3 class="est-conflict-title est-err-title">Errores críticos ('+cf.errores.length+')</h3>' +
      '<ul class="est-conflict-list">' +
      cf.errores.map(function(e) {
        return '<li class="est-conflict-item est-item-err"><span class="est-cf-tipo">'+genEsc(e.tipo)+'</span> '+genEsc(e.mensaje)+'</li>';
      }).join('') +
      '</ul></div>';
  }

  var wrnHtml = '';
  if (cf.advertencias.length) {
    wrnHtml = '<div class="est-conflict-section">' +
      '<h3 class="est-conflict-title est-warn-title">Advertencias ('+cf.advertencias.length+')</h3>' +
      '<ul class="est-conflict-list">' +
      cf.advertencias.map(function(w) {
        return '<li class="est-conflict-item est-item-warn"><span class="est-cf-tipo">'+genEsc(w.tipo)+'</span> '+genEsc(w.mensaje)+'</li>';
      }).join('') +
      '</ul></div>';
  }

  return '<div style="padding:4px 0">'+errHtml+wrnHtml+'</div>';
}

// ── VALIDACIÓN LOCAL (cliente) ───────────────────────────────────────

function _estValidarLocal() {
  var errores = [], advert = [];

  _estData.forEach(function(row, i) {
    if (!row.uac || !String(row.uac).trim()) return;
    var tipoAsig = String(row.tipo_asignacion_docente || '').trim();
    var sinDocente = !row.docente || !String(row.docente).trim();
    if (sinDocente) {
      if (tipoAsig === 'Vacante') {
        // explícitamente vacante — no error
      } else if (tipoAsig === 'Tiempo fijo') {
        // cubierta por TF — advertir solo si falta el nombre del TF
        var tfNombre = String(row.docente_tiempo_fijo || '').trim();
        if (!tfNombre) {
          advert.push({ tipo: 'TF_SIN_NOMBRE', fila: i + 1, grupo: row.grupo,
            mensaje: 'Fila '+(i+1)+': "'+row.uac+'" marcada como Tiempo fijo pero sin nombre de docente TF.' });
        }
      } else {
        errores.push({ tipo: 'SIN_DOCENTE', fila: i + 1, grupo: row.grupo,
          mensaje: 'Fila '+(i+1)+': "'+row.uac+'" sin docente asignado.' });
      }
    }
    var dias = ['lunes','martes','miercoles','jueves','viernes'];
    var suma = dias.reduce(function(s,d) { return s + _estParseHorasDia(row[d]); }, 0);
    var tot  = Number(row.tot_horas) || 0;
    if (tot > 0 && suma > 0 && suma !== tot) {
      advert.push({ tipo: 'HORAS_INCONSISTENTES', fila: i + 1, grupo: row.grupo,
        mensaje: 'Fila '+(i+1)+' ('+row.uac+'): días='+suma+' ≠ TOT_HORAS='+tot+'.' });
    }
  });

  // Exceso por día — solo horas base (Tiempo fijo y Vacante se excluyen del conteo contractual)
  var docenteDia = {};
  _estData.forEach(function(row) {
    var tipoAsig = String(row.tipo_asignacion_docente || '').trim();
    if (tipoAsig === 'Tiempo fijo' || tipoAsig === 'Vacante') return;
    if (!row.docente) return;
    ['lunes','martes','miercoles','jueves','viernes'].forEach(function(dia) {
      var h = _estParseHorasDia(row[dia]);
      if (!h) return;
      var k = String(row.docente).trim() + '|' + dia;
      docenteDia[k] = (docenteDia[k] || 0) + h;
    });
  });
  Object.keys(docenteDia).forEach(function(k) {
    if (docenteDia[k] > 6) {
      var p = k.split('|');
      errores.push({ tipo: 'DOCENTE_EXCEDE_DIA',
        mensaje: '"'+p[0]+'" tiene '+docenteDia[k]+' hrs el '+p[1]+' (máx 6).', docente: p[0], dia: p[1] });
    }
  });

  // ── Traslapes de grupo (mismo grupo, mismo día, rangos superpuestos) ──
  var _grupoDiaMap = {};
  _estData.forEach(function(row, i) {
    var grupo = String(row.grupo || '').trim();
    if (!grupo || !String(row.uac || '').trim()) return;
    _EST_DIAS_.forEach(function(dia) {
      var r = _estRangoHora(row[dia]);
      if (!r) return;
      var k = grupo + '|' + dia;
      if (!_grupoDiaMap[k]) _grupoDiaMap[k] = [];
      _grupoDiaMap[k].push({ ini: r.ini, fin: r.fin, uac: row.uac, fila: i + 1 });
    });
  });
  Object.keys(_grupoDiaMap).forEach(function(k) {
    var list = _grupoDiaMap[k];
    var parts = k.split('|');
    for (var a = 0; a < list.length; a++) {
      for (var b = a + 1; b < list.length; b++) {
        if (_estRangosTrasladan(list[a], list[b])) {
          var msg = 'Grupo ' + parts[0] + ' — ' + parts[1] + ': traslape entre "' +
            list[a].uac + '" (f.' + list[a].fila + ') y "' + list[b].uac + '" (f.' + list[b].fila + ').';
          errores.push({ tipo: 'TRASLAPE_GRUPO', fila: list[a].fila, grupo: parts[0], mensaje: msg });
          errores.push({ tipo: 'TRASLAPE_GRUPO', fila: list[b].fila, grupo: parts[0], mensaje: msg });
        }
      }
    }
  });

  // ── Traslapes de docente (mismo docente, mismo día, rangos superpuestos) ──
  var _docenteTrasMap = {};
  _estData.forEach(function(row, i) {
    var tipoAsig = String(row.tipo_asignacion_docente || '').trim();
    if (tipoAsig === 'Tiempo fijo' || tipoAsig === 'Vacante') return;
    var docente = String(row.docente || '').trim();
    if (!docente || !String(row.uac || '').trim()) return;
    _EST_DIAS_.forEach(function(dia) {
      var r = _estRangoHora(row[dia]);
      if (!r) return;
      var k = docente + '|' + dia;
      if (!_docenteTrasMap[k]) _docenteTrasMap[k] = [];
      _docenteTrasMap[k].push({ ini: r.ini, fin: r.fin, uac: row.uac, grupo: row.grupo, fila: i + 1 });
    });
  });
  Object.keys(_docenteTrasMap).forEach(function(k) {
    var list = _docenteTrasMap[k];
    var parts = k.split('|');
    for (var a = 0; a < list.length; a++) {
      for (var b = a + 1; b < list.length; b++) {
        if (_estRangosTrasladan(list[a], list[b])) {
          var msg2 = '"' + parts[0] + '" — ' + parts[1] + ': traslape entre grupo ' +
            list[a].grupo + ' (f.' + list[a].fila + ') y grupo ' + list[b].grupo + ' (f.' + list[b].fila + ').';
          errores.push({ tipo: 'TRASLAPE_DOCENTE', fila: list[a].fila, grupo: list[a].grupo, docente: parts[0], mensaje: msg2 });
          errores.push({ tipo: 'TRASLAPE_DOCENTE', fila: list[b].fila, grupo: list[b].grupo, docente: parts[0], mensaje: msg2 });
        }
      }
    }
  });

  // Validación de periodo vs semestre
  if (_genApp.periodo) {
    var semsPeriodo = GEN_PERIODO_SEMESTRES_[_genApp.periodo] || [];
    var semsIncorrectos = _genApp.periodo === 'A' ? ['2','4','6'] : ['1','3','5'];
    _estData.forEach(function(row, i) {
      var rowSem = String(row.semestre || '').trim();
      if (rowSem && semsIncorrectos.indexOf(rowSem) !== -1) {
        errores.push({
          tipo: 'SEMESTRE_PERIODO_INCORRECTO',
          fila: i + 1,
          grupo: row.grupo,
          mensaje: 'Fila '+(i+1)+' ('+( row.grupo||'sin grupo')+'): semestre '+rowSem+
            '° no corresponde al Periodo '+_genApp.periodo+
            '. Se esperan semestres '+semsPeriodo.join(', ')+'°.'
        });
      }
    });
  }

  _estConflictos = { errores: errores, advertencias: advert };
  _estActualizarBarraConflictos();
  _estUpdateDashboard();
}

function _estActualizarBarraConflictos() {
  var cf  = _estConflictos;
  var bar = document.getElementById('est-conflict-bar');
  var cnt = document.getElementById('est-conflict-count');

  var total = cf.errores.length + cf.advertencias.length;

  if (cnt) {
    cnt.textContent = total;
    cnt.style.display = total ? '' : 'none';
    cnt.className = 'est-conf-count ' + (cf.errores.length ? 'est-conf-err' : 'est-conf-warn');
  }

  if (!bar) return;
  if (!total) { bar.style.display = 'none'; return; }

  var parts = [];
  if (cf.errores.length)  parts.push('<span class="est-bar-err">⛔ '+cf.errores.length+' error'+(cf.errores.length>1?'es':'')+'</span>');
  if (cf.advertencias && cf.advertencias.length)
    parts.push('<span class="est-bar-warn">⚠ '+cf.advertencias.length+' advertencia'+(cf.advertencias.length>1?'s':'')+'</span>');
  bar.innerHTML = parts.join(' &nbsp;·&nbsp; ') +
    ' <button class="gen-btn gen-btn-sm gen-btn-secondary" style="margin-left:12px" onclick="_estSwitchView(\'conflictos\')">Ver detalle</button>';
  bar.style.display = '';
}

// ── EVENTOS ──────────────────────────────────────────────────────────

function _estBind() {
  // Botones de cabecera
  var btnGuardar = document.getElementById('est-btn-guardar');
  if (btnGuardar) btnGuardar.addEventListener('click', _estGuardarTodo);

  var btnValidar = document.getElementById('est-btn-validar');
  if (btnValidar) btnValidar.addEventListener('click', _estValidarServidor);

  var btnExportar = document.getElementById('est-btn-exportar');
  if (btnExportar) btnExportar.addEventListener('click', _estExportarCSV);

  var btnAvanzar = document.getElementById('est-btn-avanzar');
  if (btnAvanzar) btnAvanzar.addEventListener('click', function() {
    var info = _EST_ESTADO_INFO_[_estEstado];
    if (info && info.next) _estCambiarEstado(info.next);
  });

  var btnHorario = document.getElementById('est-btn-horario');
  if (btnHorario) btnHorario.addEventListener('click', _estGenerarCarga);

  // Tabs de vista
  document.querySelectorAll('.est-view-tab').forEach(function(btn) {
    btn.addEventListener('click', function() { _estSwitchView(btn.dataset.view); });
  });

  // Agregar fila
  _estBindGrid();
}

function _estBindGrid() {
  var addBtn = document.getElementById('est-add-row');
  if (addBtn) addBtn.addEventListener('click', _estAddRow);

  var tbody = document.getElementById('est-grid-tbody');
  if (!tbody) return;

  // Delegación de eventos: cambio de celda
  tbody.addEventListener('change', function(e) {
    var inp = e.target;
    if (!inp.classList.contains('est-cell')) return;
    var rowIdx = parseInt(inp.dataset.row, 10);
    var colKey = inp.dataset.col;
    if (isNaN(rowIdx) || !colKey) return;
    if (!_estData[rowIdx]) _estData[rowIdx] = {};
    _estData[rowIdx][colKey] = inp.value;
    _estDirtySet.add(_estData[rowIdx]); // marcar fila como modificada

    // Auto-rellenar formación docente al seleccionar docente base o tiempo fijo
    if (colKey === 'docente' || colKey === 'docente_tiempo_fijo') {
      var docNombre = inp.value.trim();
      var docMatch = (_genApp.docentes || []).find(function(d) {
        return genNombreDocente(d) === docNombre;
      });
      var formacion = docMatch ? String(docMatch.especialidad || '').trim() : '';
      _estData[rowIdx]['formacion_docente'] = formacion;
      var formInp = tbody.querySelector('input[data-row="' + rowIdx + '"][data-col="formacion_docente"]');
      if (formInp) formInp.value = formacion;
    }

    // Si cambió un día, recalcular HRS automáticamente
    if (_EST_DIAS_.indexOf(colKey) !== -1) {
      var totalDias = _EST_DIAS_.reduce(function(s, d) {
        return s + _estParseHorasDia(_estData[rowIdx][d]);
      }, 0);
      _estData[rowIdx]['horas'] = totalDias || '';
      var horasInp = tbody.querySelector('input[data-row="' + rowIdx + '"][data-col="horas"]');
      if (horasInp) horasInp.value = totalDias || '';
    }

    // Actualizar indicador de completitud si cambió un día o tot_horas
    if (_EST_DIAS_.indexOf(colKey) !== -1 || colKey === 'tot_horas' || colKey === 'horas') {
      var tr2 = tbody.querySelector('tr[data-row="' + rowIdx + '"]');
      if (tr2) {
        var indTd = tr2.querySelector('.est-td-ind');
        if (indTd) indTd.outerHTML = _estHorasIndicador(_estData[rowIdx]);
      }
    }

    _estDirty = true;
    _estUpdateSaveBtn();
    _estValidarLocal();
    _estRefreshInlineHorario(null);
    // Actualizar color de la fila (preservando tipo y selección)
    var tr = inp.closest('tr');
    if (tr) {
      var errFila = _estConflictos.errores.filter(function(e) { return e.fila === rowIdx + 1; }).length;
      var wrnFila = _estConflictos.advertencias.filter(function(e) { return e.fila === rowIdx + 1; }).length;
      var selCls  = rowIdx === _estSelRow ? ' est-row-selected' : '';
      tr.className = 'est-grid-row' +
        (errFila ? ' est-row-error' : wrnFila ? ' est-row-warn' : '') +
        _estTipoCls(_estData[rowIdx]) + selCls;
    }
    // Actualizar botón guardar
    var btnG = document.getElementById('est-btn-guardar');
    if (btnG) { btnG.textContent = '● Guardar todo'; btnG.style.background = '#f59e0b'; btnG.style.borderColor = '#f59e0b'; }
  });

  // Eliminar fila
  tbody.addEventListener('click', function(e) {
    if (e.target.closest('.est-del-row')) {
      var btn = e.target.closest('.est-del-row');
      var rowIdx = parseInt(btn.dataset.row, 10);
      if (isNaN(rowIdx)) return;
      var delRow = _estData[rowIdx];
      if (delRow && delRow.id) _estDeleteIds.push(delRow.id); // registrar para borrar del servidor
      _estDirtySet.delete(delRow); // ya no necesita guardarse
      _estData.splice(rowIdx, 1);
      if (_estSelRow >= rowIdx) _estSelRow = -1;
      _estDirty = true;
      _estRebuildGrid();
      _estValidarLocal();
      _estUpdateSaveBtn();
      return;
    }

    // Duplicar fila
    if (e.target.closest('.est-dup-row')) {
      var dupBtn = e.target.closest('.est-dup-row');
      var dupIdx = parseInt(dupBtn.dataset.row, 10);
      if (isNaN(dupIdx)) return;
      var copy = Object.assign({}, _estData[dupIdx]);
      // Limpiar id y horario en la copia (es una fila nueva)
      delete copy.id;
      _EST_DIAS_.forEach(function(d) { copy[d] = ''; });
      copy.horas = '';
      _estData.splice(dupIdx + 1, 0, copy);
      _estDirtySet.add(copy);
      _estDirty = true;
      _estRebuildGrid();
      _estValidarLocal();
      _estUpdateSaveBtn();
      return;
    }

    // Clic en fila → resaltar + auto-actualizar horario inline
    var tr = e.target.closest('tr.est-grid-row');
    if (!tr || e.target.closest('.est-cell')) return;
    var clickedIdx = parseInt(tr.dataset.row, 10);
    if (isNaN(clickedIdx) || !_estData[clickedIdx]) return;

    // Deseleccionar anterior
    if (_estSelRow !== -1) {
      var prevTr = tbody.querySelector('tr[data-row="' + _estSelRow + '"]');
      if (prevTr) prevTr.classList.remove('est-row-selected');
    }
    _estSelRow = clickedIdx;
    tr.classList.add('est-row-selected');

    // Actualizar timetables inline
    var clickedRow = _estData[clickedIdx];
    var grupo   = String(clickedRow.grupo   || '').trim();
    var docente = String(clickedRow.docente || '').trim();
    var tipo    = String(clickedRow.tipo_asignacion_docente || '').trim();

    if (grupo && grupo !== _estHorGrupoSel) {
      _estHorGrupoSel = grupo;
      var selG = document.getElementById('est-hor-grupo-sel-inline');
      if (selG) selG.value = grupo;
      _estRefreshInlineHorario('grupo');
    }
    if (docente && tipo !== 'Vacante' && tipo !== 'Tiempo fijo' && docente !== _estHorDocSel) {
      _estHorDocSel = docente;
      var selD = document.getElementById('est-hor-doc-sel-inline');
      if (selD) selD.value = docente;
      _estRefreshInlineHorario('docente');
    }
  });

  // Copy-paste desde Excel (TSV)
  tbody.addEventListener('paste', function(e) {
    var inp = e.target;
    if (!inp.classList.contains('est-cell')) return;
    var rowIdx = parseInt(inp.dataset.row, 10);
    var colKey = inp.dataset.col;
    if (isNaN(rowIdx) || !colKey) return;

    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;

    var colIdx = _EST_COLS_.findIndex(function(c) { return c.key === colKey; });
    if (colIdx < 0) return;

    var pasteRows = text.split(/\r?\n/).filter(function(r) { return r !== ''; });
    pasteRows.forEach(function(rowTxt, ri) {
      var cols = rowTxt.split('\t');
      var tgtRowIdx = rowIdx + ri;
      while (_estData.length <= tgtRowIdx) {
        var nr = {};
        _estData.push(nr);
      }
      cols.forEach(function(val, ci) {
        var tgtColIdx = colIdx + ci;
        if (tgtColIdx >= _EST_COLS_.length) return;
        _estData[tgtRowIdx][_EST_COLS_[tgtColIdx].key] = val.replace(/\r/g, '').trim();
      });
      _estDirtySet.add(_estData[tgtRowIdx]); // marcar cada fila pegada como modificada
    });

    _estDirty = true;
    _estUpdateSaveBtn();
    _estRebuildGrid();
    _estValidarLocal();
  });

  _estBindResizers();
  _estBindFilters();
  _estApplyFilters();
  _estBindInlineHorarios();
}

function _estBindInlineHorarios() {
  var selG = document.getElementById('est-hor-grupo-sel-inline');
  if (selG) {
    selG.addEventListener('change', function() {
      _estHorGrupoSel = this.value;
      _estRefreshInlineHorario('grupo');
    });
  }
  var selD = document.getElementById('est-hor-doc-sel-inline');
  if (selD) {
    selD.addEventListener('change', function() {
      _estHorDocSel = this.value;
      _estRefreshInlineHorario('docente');
    });
  }
}

function _estRefreshInlineHorario(which) {
  var cfFilas = {};
  _estConflictos.errores.forEach(function(e) { if (e.fila) cfFilas[e.fila] = true; });

  if (!which || which === 'grupo') {
    var gridG = document.getElementById('est-hor-grupo-grid-inline');
    if (gridG) {
      gridG.innerHTML = _estHorGrupoSel
        ? _estTimetableGridHTML(
            _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
              .filter(function(r) { return String(r.grupo || '').trim() === _estHorGrupoSel; }),
            function(row, e) {
              var slot = e && e.isFirst ? (row[e.dia] || '') : '';
              return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
                     '<span class="arm-tt-meta">' + genEsc(row.docente || '—') + '</span>' +
                     (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
            }, cfFilas)
        : '<p class="gen-hint" style="margin:8px 0">Selecciona un grupo para ver su horario.</p>';
    }
  }

  if (!which || which === 'docente') {
    var gridD = document.getElementById('est-hor-doc-grid-inline');
    if (gridD) {
      gridD.innerHTML = _estHorDocSel
        ? _estTimetableGridHTML(
            _estData.map(function(r, i) { r._fila_ = i + 1; return r; })
              .filter(function(r) {
                var tipo = String(r.tipo_asignacion_docente || '').trim();
                if (tipo === 'Vacante' || tipo === 'Tiempo fijo') return false;
                return String(r.docente || '').trim() === _estHorDocSel;
              }),
            function(row, e) {
              var slot = e && e.isFirst ? (row[e.dia] || '') : '';
              return '<span class="arm-tt-uac">' + genEsc(row.uac || '?') + '</span>' +
                     '<span class="arm-tt-meta">' + genEsc(row.grupo || '—') + '</span>' +
                     (slot ? '<span class="arm-tt-time">' + genEsc(slot) + '</span>' : '');
            }, cfFilas)
        : '<p class="gen-hint" style="margin:8px 0">Selecciona un docente para ver su horario.</p>';
    }
  }
}

// ── REBUILD GRID (sin re-render total) ──────────────────────────────

function _estRebuildGrid() {
  var tbody = document.getElementById('est-grid-tbody');
  if (!tbody) return;
  var cerrada = _estEstado === 'CERRADA';
  if (_estData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="'+(_EST_COLS_.length + 3)+'" class="gen-td-empty">Sin filas. Usa "+ Agregar fila" o pega desde Excel.</td></tr>';
  } else {
    tbody.innerHTML = _estData.map(function(row, i) { return _estGridRow(row, i, cerrada); }).join('');
  }
  _estApplyFilters();
}

// ── RESIZE DE COLUMNAS ───────────────────────────────────────────────

function _estBindResizers() {
  document.querySelectorAll('.est-col-resizer').forEach(function(handle) {
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var colKey  = handle.dataset.col;
      var col     = document.querySelector('col[data-col="' + colKey + '"]');
      var th      = handle.closest('th');
      var startX  = e.clientX;
      var startW  = th.offsetWidth;

      document.body.style.cursor    = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(ev) {
        var w = Math.max(40, startW + ev.clientX - startX);
        if (col) col.style.width = w + 'px';
        _estColWidths_[colKey] = w;
      }
      function onUp() {
        document.body.style.cursor    = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  });
}

// ── FILTROS DE COLUMNA ───────────────────────────────────────────────

function _estBindFilters() {
  document.querySelectorAll('.est-col-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var colKey   = btn.dataset.col;
      var existing = document.getElementById('est-filter-panel');
      if (existing && existing.dataset.col === colKey) {
        _estCloseFilterDropdown();
        return;
      }
      _estShowFilterDropdown(colKey, btn);
    });
  });
}

function _estShowFilterDropdown(colKey, btn) {
  _estCloseFilterDropdown();

  /* Valores únicos de la columna */
  var valCount = {};
  _estData.forEach(function(row) {
    var v = String(row[colKey] !== undefined ? row[colKey] : '');
    valCount[v] = (valCount[v] || 0) + 1;
  });
  var uniqVals = Object.keys(valCount).sort();
  var active   = _estColFilters_[colKey] || [];
  var allOn    = active.length === 0;

  var col      = _EST_COLS_.find(function(c) { return c.key === colKey; });
  var colLabel = col ? col.label : colKey;

  var checksHtml = uniqVals.map(function(v) {
    var chk = allOn || active.indexOf(v) !== -1 ? ' checked' : '';
    return '<label class="est-filter-check">' +
      '<input type="checkbox" class="est-fval" value="' + genEsc(v) + '"' + chk + '>' +
      '<span>' + genEsc(v || '(vacío)') + '</span>' +
      '<small class="est-filter-count">(' + valCount[v] + ')</small>' +
      '</label>';
  }).join('');

  var panel = document.createElement('div');
  panel.className = 'est-filter-panel';
  panel.id        = 'est-filter-panel';
  panel.dataset.col = colKey;
  panel.innerHTML =
    '<div class="est-filter-hdr">' + genEsc(colLabel) + '</div>' +
    '<div class="est-filter-srch-wrap"><input type="text" class="est-filter-srch" id="est-flt-srch" placeholder="Buscar…"></div>' +
    '<div class="est-filter-selall">' +
      '<label class="est-filter-check"><input type="checkbox" id="est-flt-all"' + (allOn ? ' checked' : '') + '><span>Seleccionar todo</span></label>' +
    '</div>' +
    '<div class="est-filter-list" id="est-filter-list">' + checksHtml + '</div>' +
    '<div class="est-filter-foot">' +
      '<button class="gen-btn gen-btn-sm gen-btn-ghost" id="est-flt-clear">Limpiar</button>' +
      '<button class="gen-btn gen-btn-sm gen-btn-primary" id="est-flt-apply">Aplicar</button>' +
    '</div>';

  document.body.appendChild(panel);

  /* Posición fija relativa al botón */
  var rect  = btn.getBoundingClientRect();
  var pw    = 250;
  var left  = Math.min(rect.left, window.innerWidth - pw - 8);
  panel.style.cssText += ';position:fixed;top:' + (rect.bottom + 4) + 'px;left:' + left + 'px;width:' + pw + 'px;z-index:9999';

  /* Focus en búsqueda */
  var srch = document.getElementById('est-flt-srch');
  if (srch) setTimeout(function() { srch.focus(); }, 0);

  /* Buscar */
  srch && srch.addEventListener('input', function() {
    var q = this.value.toLowerCase();
    document.querySelectorAll('#est-filter-list .est-filter-check').forEach(function(lbl) {
      var cb = lbl.querySelector('.est-fval');
      lbl.style.display = (!q || (cb && cb.value.toLowerCase().indexOf(q) !== -1)) ? '' : 'none';
    });
  });

  /* Seleccionar todo */
  var allCb = document.getElementById('est-flt-all');
  allCb && allCb.addEventListener('change', function() {
    document.querySelectorAll('.est-fval').forEach(function(cb) { cb.checked = allCb.checked; });
  });

  /* Sincronizar "seleccionar todo" al marcar individuales */
  document.getElementById('est-filter-list').addEventListener('change', function() {
    var total = document.querySelectorAll('.est-fval').length;
    var chkd  = document.querySelectorAll('.est-fval:checked').length;
    if (allCb) allCb.checked = total === chkd;
  });

  /* Limpiar */
  document.getElementById('est-flt-clear').addEventListener('click', function() {
    delete _estColFilters_[colKey];
    _estCloseFilterDropdown();
    _estApplyFilters();
  });

  /* Aplicar */
  document.getElementById('est-flt-apply').addEventListener('click', function() {
    var all  = document.querySelectorAll('.est-fval');
    var chkd = Array.from(document.querySelectorAll('.est-fval:checked')).map(function(cb) { return cb.value; });
    if (chkd.length === all.length) {
      delete _estColFilters_[colKey];
    } else {
      _estColFilters_[colKey] = chkd;
    }
    _estCloseFilterDropdown();
    _estApplyFilters();
  });

  /* Cerrar al hacer clic fuera */
  setTimeout(function() {
    document.addEventListener('mousedown', _estFilterOutside);
  }, 0);
}

function _estFilterOutside(e) {
  var panel = document.getElementById('est-filter-panel');
  if (!panel) { document.removeEventListener('mousedown', _estFilterOutside); return; }
  if (!panel.contains(e.target) && !e.target.classList.contains('est-col-filter-btn')) {
    _estCloseFilterDropdown();
  }
}

function _estCloseFilterDropdown() {
  var panel = document.getElementById('est-filter-panel');
  if (panel) panel.remove();
  document.removeEventListener('mousedown', _estFilterOutside);
}

function _estApplyFilters() {
  /* Actualizar indicadores de botones de filtro de columna */
  document.querySelectorAll('.est-col-filter-btn').forEach(function(btn) {
    var key = btn.dataset.col;
    btn.classList.toggle('active', !!(  _estColFilters_[key] && _estColFilters_[key].length));
  });

  var tbody = document.getElementById('est-grid-tbody');
  if (!tbody) return;

  var hasColFilter = Object.keys(_estColFilters_).some(function(k) {
    return _estColFilters_[k] && _estColFilters_[k].length;
  });

  tbody.querySelectorAll('.est-grid-row').forEach(function(tr) {
    var rowIdx = parseInt(tr.dataset.row, 10);
    if (isNaN(rowIdx) || !_estData[rowIdx]) { tr.style.display = ''; return; }
    var row = _estData[rowIdx];
    var visible = true;

    /* ── Filtros de columna ─────────────────────── */
    if (hasColFilter) {
      Object.keys(_estColFilters_).forEach(function(key) {
        var allowed = _estColFilters_[key];
        if (!allowed || !allowed.length) return;
        var val = String(row[key] !== undefined ? row[key] : '');
        if (allowed.indexOf(val) === -1) visible = false;
      });
    }

    /* ── Filtro rápido: tipo ────────────────────── */
    if (visible && _estQuickTipo) {
      var rawTipo  = String(row.tipo_asignacion_docente || '').trim();
      var normTipo = rawTipo.toLowerCase() === 'tiempo fijo' ? 'tiempo_fijo' : rawTipo.toLowerCase();
      if (!normTipo) normTipo = 'base';
      if (normTipo !== _estQuickTipo) visible = false;
    }

    /* ── Filtro rápido: estado ──────────────────── */
    if (visible && _estQuickStatus) {
      var tot  = Number(row.tot_horas) || 0;
      var suma = _EST_DIAS_.reduce(function(s, d) { return s + _estParseHorasDia(row[d]); }, 0);
      if (_estQuickStatus === 'completo') {
        if (!(tot > 0 && suma === tot)) visible = false;
      } else if (_estQuickStatus === 'pendiente') {
        if (!(tot > 0 && suma !== tot)) visible = false;
      } else if (_estQuickStatus === 'conflicto') {
        if (!_estConflictos.errores.some(function(e) { return e.fila === rowIdx + 1; })) visible = false;
      }
    }

    /* ── Filtro rápido: grupo (texto) ───────────── */
    if (visible && _estQuickGrupo) {
      var grupoVal = String(row.grupo || '').toLowerCase();
      if (grupoVal.indexOf(_estQuickGrupo.toLowerCase()) === -1) visible = false;
    }

    tr.style.display = visible ? '' : 'none';
  });
}

// ── SWITCH VIEW ──────────────────────────────────────────────────────

function _estSwitchView(view) {
  if (view !== 'capv') _estCapvBrush = -1;
  _estView = view;
  document.querySelectorAll('.est-view-tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === view);
  });
  var content = document.getElementById('est-view-content');
  if (content) content.innerHTML = _estViewHTML();
  if (view === 'grid') _estBindGrid();
  if (view === 'horario_grupo')   _estBindHorarioGrupo();
  if (view === 'horario_docente') _estBindHorarioDocente();
}

// ── ACCIONES ─────────────────────────────────────────────────────────

function _estAddRow() {
  var nr = {};
  _estData.push(nr);
  _estDirtySet.add(nr);
  _estDirty = true;
  _estRebuildGrid();
  _estUpdateSaveBtn();
}

// ── PROGRESO DE GUARDADO ─────────────────────────────────────────────

function _estShowSaveProgress(done, total, msg) {
  var el = document.getElementById('est-save-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'est-save-progress';
    el.className = 'est-save-progress';
    var ref = document.getElementById('est-conflict-bar');
    if (ref && ref.parentNode) ref.parentNode.insertBefore(el, ref.nextSibling);
    else document.querySelector('.gen-content, #gen-content, body').prepend(el);
  }
  var pct = total > 0 ? Math.round(done / total * 100) : 20;
  el.innerHTML =
    '<span class="est-save-spin"></span>' +
    '<span class="est-save-msg">' + genEsc(msg || 'Guardando…') + '</span>' +
    '<div class="est-save-bar-wrap"><div class="est-save-bar-fill" style="width:' + pct + '%"></div></div>' +
    (total > 1 ? '<span class="est-save-counter">' + done + ' / ' + total + '</span>' : '');
}

function _estHideSaveProgress() {
  var el = document.getElementById('est-save-progress');
  if (el) el.remove();
}

function _estUpdateSaveBtn() {
  var btn = document.getElementById('est-btn-guardar');
  if (!btn) return;
  var nChanges = _estDirtySet.size + _estDeleteIds.length;
  if (nChanges > 0) {
    btn.innerHTML = '<span style="opacity:.7;margin-right:3px">●</span> Guardar ' +
      nChanges + ' cambio' + (nChanges !== 1 ? 's' : '');
    btn.style.background  = '#f59e0b';
    btn.style.borderColor = '#f59e0b';
  } else if (!_estDirty) {
    btn.innerHTML = 'Guardar';
    btn.style.background  = '';
    btn.style.borderColor = '';
  }
}

// ── GUARDADO INTELIGENTE ──────────────────────────────────────────────

var _EST_SAVE_THRESHOLD_ = 15; // filas ≤ este número → guardado por fila; > este número → reemplazo total

async function _estGuardarTodo() {
  var nDirty  = _estDirtySet.size;
  var nDelete = _estDeleteIds.length;
  var total   = nDirty + nDelete;

  if (!total && !_estDirty) { genToast('No hay cambios que guardar.', 'info'); return; }

  // Si no hay seguimiento granular pero _estDirty está activo, marcar todo como dirty
  if (total === 0 && _estDirty) {
    _estData.forEach(function(r) { _estDirtySet.add(r); });
    nDirty = _estDirtySet.size;
    total  = nDirty;
  }

  genRequireAdmin(async function() {
    var btn = document.getElementById('est-btn-guardar');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando…'; }

    try {
      if (total <= _EST_SAVE_THRESHOLD_) {
        /* ── Guardado por fila ──────────────────────────────────────── */
        _estShowSaveProgress(0, total, 'Iniciando guardado…');
        var done = 0;

        // Primero eliminar filas borradas
        for (var i = 0; i < _estDeleteIds.length; i++) {
          _estShowSaveProgress(done, total, 'Eliminando fila del servidor…');
          await genAPI.deleteEstructuraFila(_genApp.adminKey, _estDeleteIds[i]);
          done++;
        }

        // Luego guardar filas modificadas
        var dirtyArr = Array.from(_estDirtySet);
        for (var j = 0; j < dirtyArr.length; j++) {
          _estShowSaveProgress(done, total,
            'Guardando fila ' + (j + 1) + ' de ' + dirtyArr.length + '…');
          var fila = Object.assign({}, dirtyArr[j]);
          fila.ciclo   = _genApp.ciclo;
          fila.periodo = _genApp.periodo || '';
          var res = await genAPI.saveEstructuraFila(_genApp.adminKey, fila);
          // Actualizar el id en memoria si fue un insert nuevo
          if (res && res.id && !dirtyArr[j].id) dirtyArr[j].id = res.id;
          done++;
        }

        _estHideSaveProgress();
        _estDirtySet.clear();
        _estDeleteIds = [];
        _estDirty = false;
        genToast(total + ' cambio' + (total !== 1 ? 's' : '') + ' guardado' + (total !== 1 ? 's' : '') + ' correctamente.', 'ok');

      } else {
        /* ── Reemplazo total (muchos cambios) ──────────────────────── */
        _estShowSaveProgress(0, 1, 'Guardando ' + _estData.length + ' filas…');
        var filas = _estData.map(function(row) {
          var f = Object.assign({}, row);
          f.ciclo   = _genApp.ciclo;
          f.periodo = _genApp.periodo || '';
          return f;
        });
        await genAPI.replaceEstructura(_genApp.adminKey, _genApp.ciclo, filas);
        _estHideSaveProgress();
        _estDirtySet.clear();
        _estDeleteIds = [];
        _estDirty = false;
        genToast(_estData.length + ' filas guardadas correctamente.', 'ok');
      }

      if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar'; btn.style.background = ''; btn.style.borderColor = ''; }

    } catch(err) {
      _estHideSaveProgress();
      genToast('Error al guardar: ' + err.message, 'error');
      if (err.message && err.message.includes('administrador')) _genApp.adminKey = null;
      if (btn) { btn.disabled = false; _estUpdateSaveBtn(); }
    }
  });
}

async function _estValidarServidor() {
  if (_estDirty) {
    genToast('Guarda los cambios antes de validar.', 'warning');
    return;
  }
  var btn = document.getElementById('est-btn-validar');
  if (btn) { btn.disabled = true; btn.textContent = 'Validando…'; }
  try {
    var resultado = await genAPI.validarEstructura(_genApp.ciclo);
    _estConflictos = { errores: resultado.errores || [], advertencias: resultado.advertencias || [] };
    _estActualizarBarraConflictos();
    if (resultado.valida) {
      genToast('Estructura válida: sin errores críticos.', 'ok');
    } else {
      genToast(resultado.total_errores + ' error(es) encontrado(s). Revisa la pestaña Conflictos.', 'warning');
    }
    if (_estView === 'conflictos') {
      var content = document.getElementById('est-view-content');
      if (content) content.innerHTML = _estConflictosHTML();
    }
  } catch(err) {
    genToast('Error en validación: ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '✓ Validar'; }
}

async function _estCambiarEstado(nuevoEstado) {
  if (_estDirty) {
    genToast('Guarda los cambios antes de cambiar el estado.', 'warning');
    return;
  }
  if (nuevoEstado === 'VALIDADA' && _estConflictos.errores.length) {
    genToast('No se puede validar con errores críticos. Corrígelos primero.', 'error');
    return;
  }
  genRequireAdmin(async function() {
    try {
      await genAPI.saveEstadoEstructura(_genApp.adminKey, _genApp.ciclo, nuevoEstado);
      _estEstado = nuevoEstado;
      genToast('Estado actualizado: ' + (_EST_ESTADO_INFO_[nuevoEstado]||{}).label, 'ok');
      genNavTo('estructura'); // Re-render con nuevo estado
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
    }
  });
}

async function _estGenerarCarga() {
  if (_estConflictos.errores.length) {
    genToast('Existen errores críticos. Corrígelos antes de generar la carga.', 'error');
    return;
  }

  genRequireAdmin(function() {
    // Resolver matches con los catálogos en memoria
    var materias = _genApp.materias || [];
    var docentes = _genApp.docentes || [];
    var grupos   = _genApp.grupos   || [];

    var matPorNombre = {};
    var matPorClave  = {};
    materias.forEach(function(m) {
      var n = genNormStr(m.nombre || '');
      var c = genNormStr(m.clave  || '');
      if (n) matPorNombre[n] = m.id;
      if (c) matPorClave[c]  = m.id;
    });
    var docPorNombre = {};
    docentes.forEach(function(d) {
      docPorNombre[genNormStr(genNombreDocente(d))] = d.id;
      if (d.apellido_paterno) {
        var ape = genNormStr(d.apellido_paterno);
        if (ape && !docPorNombre[ape]) docPorNombre[ape] = d.id;
      }
    });
    // índice de grupos con todas las formas posibles (incluye g.clave)
    var grpIdx = {};
    grupos.forEach(function(g) {
      function addG(k) { var nk = genNormStr(String(k||'')); if (nk && !grpIdx[nk]) grpIdx[nk] = g.id; }
      addG(genLabelGrupo(g));
      if (g.clave) addG(g.clave);
      if (g.grupo) {
        addG(g.grupo);
        addG(String(g.grado||'') + g.grupo);
        addG(String(g.grado||'') + '0' + g.grupo);
        var tp = g.turno ? genNormStr(g.turno).charAt(0) : '';
        if (tp) { addG(tp + String(g.grado||'') + g.grupo); addG(tp + String(g.grado||'') + '0' + g.grupo); }
      }
    });

    var matchHints = {}, docenteHints = {}, grupoHints = {};
    var sinMaterias = [], sinDocentes = [], sinGrupos = [];
    var uacSet = {}, docSet = {}, grpSet = {};
    _estData.forEach(function(row) {
      var uac = String(row.uac     || '').trim();
      var doc = String(row.docente || '').trim();
      var grp = String(row.grupo   || '').trim();
      if (uac) uacSet[uac] = true;
      if (doc) docSet[doc] = true;
      if (grp) grpSet[grp] = true;
    });
    Object.keys(uacSet).forEach(function(uac) {
      var n  = genNormStr(uac);
      var id = matPorNombre[n] || matPorClave[n];
      if (!id) {
        for (var k in matPorNombre) {
          if (k.length >= 5 && (n === k || n.indexOf(k) !== -1 || k.indexOf(n) !== -1)) { id = matPorNombre[k]; break; }
        }
      }
      if (id) matchHints[uac] = id; else sinMaterias.push(uac);
    });
    Object.keys(docSet).forEach(function(doc) {
      var n  = genNormStr(doc);
      var id = docPorNombre[n];
      if (!id) { var tok = n.split(/\s+/)[0]; if (tok && tok.length >= 3) id = docPorNombre[tok]; }
      if (id) docenteHints[doc] = id; else sinDocentes.push(doc);
    });
    Object.keys(grpSet).forEach(function(g) {
      var n  = genNormStr(g);
      var id = grpIdx[n];
      if (!id) { var sp = n.replace(/^[mvts]/, '').trim(); id = grpIdx[sp]; }
      if (id) grupoHints[g] = id; else sinGrupos.push(g);
    });

    var hints = { matchHints: matchHints, docenteHints: docenteHints, grupoHints: grupoHints };
    var nMat  = Object.keys(matchHints).length;
    var nDoc  = Object.keys(docenteHints).length;
    var nGrp  = Object.keys(grupoHints).length;
    var periodoMsg = _genApp.periodo ? ' · Periodo ' + _genApp.periodo : '';

    var resumen =
      '<ul style="margin:10px 0 0;padding-left:18px;font-size:0.85rem;line-height:1.8;">' +
      '<li><strong>' + nMat + '</strong> materia(s) resueltas' +
        (sinMaterias.length ? ' <span style="color:#f97316;">(' + sinMaterias.length + ' sin coincidencia)</span>' : ' ✓') + '</li>' +
      '<li><strong>' + nDoc + '</strong> docente(s) resueltos' +
        (sinDocentes.length ? ' <span style="color:#f97316;">(' + sinDocentes.length + ' sin coincidencia)</span>' : ' ✓') + '</li>' +
      '<li><strong>' + nGrp + '</strong> grupo(s) resueltos' +
        (sinGrupos.length ? ' <span style="color:#f97316;">(' + sinGrupos.length + ' sin coincidencia)</span>' : ' ✓') + '</li>' +
      '</ul>';
    var advertencia = (sinMaterias.length || sinDocentes.length || sinGrupos.length)
      ? '<p style="margin-top:10px;font-size:0.8rem;color:#92400e;background:#fef3c7;padding:8px 10px;border-radius:8px;">' +
        '⚠ Los registros sin coincidencia serán omitidos.</p>'
      : '';

    genConfirm(
      'Se generarán asignaciones para el ciclo <strong>' + genEsc(_genApp.ciclo) + '</strong>' + periodoMsg + '.' +
      ' Las asignaciones existentes <em>no</em> se eliminan.' +
      resumen + advertencia,
      async function() {
        try {
          var res = await genAPI.estructuraACarga(_genApp.adminKey, _genApp.ciclo, hints);
          genToast(res.message || 'Proceso completado.', 'ok');
          if (res.sin_match && res.sin_match.length) {
            var detalle = res.sin_match.slice(0, 10).map(function(item) {
              var txt = String(item)
                .replace(/^Grupo:\s*/i, '')
                .replace(/,\s*UAC:\s*/i, ' → Materia: ');
              return '<li>' + genEsc(txt) + '</li>';
            }).join('');
            var mas = res.sin_match.length > 10
              ? '<li style="color:#94a3b8;">… y ' + (res.sin_match.length - 10) + ' más</li>'
              : '';
            _genModal.open(
              'Registros omitidos (' + res.sin_match.length + ')',
              '<p style="font-size:0.85rem;color:#64748b;margin-bottom:10px;">Los siguientes registros no generaron asignación:</p>' +
              '<ul style="padding-left:18px;font-size:0.82rem;line-height:1.8;max-height:280px;overflow-y:auto;">' +
                detalle + mas + '</ul>',
              '<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cerrar</button>'
            );
          }
        } catch(err) {
          genToast('Error: ' + err.message, 'error');
        }
      },
      { label: 'Generar asignaciones', cls: 'gen-btn-primary', title: 'Generar carga horaria' }
    );
  });
}

function _estExportarCSV() {
  var headers = _EST_COLS_.map(function(c) { return c.label; });
  var rows = _estData.map(function(row) {
    return _EST_COLS_.map(function(c) {
      var v = String(row[c.key] !== undefined ? row[c.key] : '');
      // Escapar comillas y encerrar si contiene coma/salto
      if (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(',');
  });

  var csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n'); // BOM para Excel
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href      = url;
  a.download  = 'estructura_educativa_' + (_genApp.ciclo||'ciclo') + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  genToast('Archivo CSV descargado.', 'ok');
}

// ══════════════════════════════════════════════════════════════════════
//  CAPTURA VISUAL DE HORARIOS
// ══════════════════════════════════════════════════════════════════════

var _estCapvGrupo    = '';  // grupo activo (modo grupo)
var _estCapvBrush    = -1;  // rowIdx del pincel (-1 = sin selección)
var _estCapvPendDia  = '';  // día pendiente para el picker
var _estCapvMode     = 'grupo';  // 'grupo' | 'docente'
var _estCapvDocente  = '';       // docente activo (modo docente)

var _CAPV_HOURS_ = (function() {
  var h = []; for (var i = 7; i <= 21; i++) h.push(i); return h;
})();
var _CAPV_DIA_LABELS_ = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
var _CAPV_PALETTE_ = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4',
  '#f97316','#84cc16','#ec4899','#14b8a6','#6366f1','#eab308',
  '#22c55e','#0ea5e9','#a855f7','#f43f5e','#64748b','#7c3aed','#059669','#dc2626'
];

function _estCapvColor(i) { return _CAPV_PALETTE_[i % _CAPV_PALETTE_.length]; }

function _estCapvGruposList() {
  var seen = {}, list = [];
  _estData.forEach(function(r) {
    var g = String(r.grupo||'').trim(); if (g && !seen[g]) { seen[g]=true; list.push(g); }
  });
  return list.sort();
}

function _estCapvRowsForGrupo(grupo) {
  return _estData.reduce(function(acc, r, i) {
    if (String(r.grupo||'').trim() === grupo) acc.push(i); return acc;
  }, []);
}

/* Mapa de ocupación: map[dia][hora] = {rowIdx, isFirst, color, uac, docente, span} */
function _estCapvBuildMap(rowIndices) {
  var map = {}; _EST_DIAS_.forEach(function(d){ map[d]={}; });
  rowIndices.forEach(function(rowIdx, ci) {
    var row = _estData[rowIdx], color = _estCapvColor(ci);
    _EST_DIAS_.forEach(function(dia) {
      var val = String(row[dia]||'').trim(); if (!val) return;
      var m = val.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
      if (!m) return;
      var hs = parseInt(m[1],10), he = parseInt(m[3],10);
      for (var h = hs; h < he; h++) {
        map[dia][h] = { rowIdx:rowIdx, isFirst:h===hs, slot:val, color:color,
          uac:String(row.uac||'').trim(), docente:String(row.docente||'').trim(),
          grupo:String(row.grupo||'').trim(), span:he-hs };
      }
    });
  });
  return map;
}

/* Detecta conflicto de docente para un slot propuesto */
function _estCapvConflicto(docente, dia, slotLabel, excludeRowIdx) {
  if (!docente) return null;
  var m = slotLabel.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  var hs = parseInt(m[1],10), he = parseInt(m[3],10);
  for (var i=0; i<_estData.length; i++) {
    if (i===excludeRowIdx) continue;
    var row = _estData[i];
    if (String(row.docente||'').trim() !== docente) continue;
    var v = String(row[dia]||'').trim(); if (!v) continue;
    var m2 = v.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
    if (!m2) continue;
    var s2=parseInt(m2[1],10), e2=parseInt(m2[3],10);
    if (hs<e2 && he>s2) return { uac:String(row.uac||'').trim(), grupo:String(row.grupo||'').trim() };
  }
  return null;
}

/* Lista de docentes con al menos una materia asignada (excluye vacantes) */
function _estCapvDocList() {
  var seen = {}, list = [];
  _estData.forEach(function(r) {
    if (String(r.tipo_asignacion_docente||'').trim() === 'Vacante') return;
    var d = String(r.docente||'').trim(); if (d && !seen[d]) { seen[d]=true; list.push(d); }
  });
  return list.sort();
}

/* Índices de filas donde row.docente === docente (excluye vacantes) */
function _estCapvRowsForDocente(docente) {
  return _estData.reduce(function(acc, r, i) {
    if (String(r.tipo_asignacion_docente||'').trim() === 'Vacante') return acc;
    if (String(r.docente||'').trim() === docente) acc.push(i);
    return acc;
  }, []);
}

/* Devuelve filas del contexto activo (grupo o docente) */
function _estCapvCurrentRows() {
  return _estCapvMode === 'docente'
    ? _estCapvRowsForDocente(_estCapvDocente)
    : _estCapvRowsForGrupo(_estCapvGrupo);
}

/* Verifica si el grupo del row ya tiene algo asignado en ese slot */
function _estCapvGrupoConflicto(grupo, dia, slotLabel, excludeRowIdx) {
  if (!grupo) return null;
  var m = slotLabel.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  var hs = parseInt(m[1],10), he = parseInt(m[3],10);
  for (var i=0; i<_estData.length; i++) {
    if (i===excludeRowIdx) continue;
    var row = _estData[i];
    if (String(row.grupo||'').trim() !== grupo) continue;
    var v = String(row[dia]||'').trim(); if (!v) continue;
    var m2 = v.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
    if (!m2) continue;
    var s2=parseInt(m2[1],10), e2=parseInt(m2[3],10);
    if (hs<e2 && he>s2) return { uac:String(row.uac||'').trim() };
  }
  return null;
}

/* Cambia modo y re-renderiza la vista completa de captura visual */
function _estCapvCambiarModo(m) {
  _estCapvMode  = m;
  _estCapvBrush = -1;
  var cont = document.getElementById('est-view-content');
  if (cont) cont.innerHTML = _estCapvHTML();
}

function _estCapvCambiarDocente(d) {
  _estCapvDocente = d;
  _estCapvBrush   = -1;
  _estCapvRefresh();
}

// ── Render principal ──────────────────────────────────────────────────

function _estCapvSelectorHTML() {
  if (_estCapvMode === 'docente') {
    var docs = _estCapvDocList();
    if (!docs.length) return '<span class="est-capv-hint" style="color:#f59e0b">Sin docentes asignados aún.</span>';
    if (!_estCapvDocente || docs.indexOf(_estCapvDocente)===-1) _estCapvDocente = docs[0];
    return '<label class="est-capv-grupo-label">Docente:</label>'+
      '<select id="est-capv-doc-sel" class="est-capv-grupo-sel" onchange="_estCapvCambiarDocente(this.value)">'+
      docs.map(function(d){ return '<option value="'+genEsc(d)+'"'+(d===_estCapvDocente?' selected':'')+'>'+genEsc(d)+'</option>'; }).join('')+
      '</select>';
  }
  var grupos = _estCapvGruposList();
  if (!_estCapvGrupo || grupos.indexOf(_estCapvGrupo)===-1) _estCapvGrupo = grupos[0]||'';
  return '<label class="est-capv-grupo-label">Grupo:</label>'+
    '<select id="est-capv-sel" class="est-capv-grupo-sel" onchange="_estCapvCambiarGrupo(this.value)">'+
    grupos.map(function(g){ return '<option value="'+genEsc(g)+'"'+(g===_estCapvGrupo?' selected':'')+'>'+genEsc(g)+'</option>'; }).join('')+
    '</select>';
}

function _estCapvHTML() {
  var grupos = _estCapvGruposList();
  if (!grupos.length)
    return '<div class="gen-empty-state" style="margin-top:32px"><p>No hay datos en la estructura todavía.</p></div>';

  var modeBar =
    '<div class="est-capv-mode-bar">'+
      '<button class="est-capv-mode-btn'+(_estCapvMode==='grupo'?' active':'')+'" data-mode="grupo" onclick="_estCapvCambiarModo(\'grupo\')">'+
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> Por grupo</button>'+
      '<button class="est-capv-mode-btn'+(_estCapvMode==='docente'?' active':'')+'" data-mode="docente" onclick="_estCapvCambiarModo(\'docente\')">'+
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Por docente</button>'+
    '</div>';

  var topbar = '<div class="est-capv-topbar">'+
    modeBar+
    '<span id="est-capv-topbar-sel" style="display:contents">'+_estCapvSelectorHTML()+'</span>'+
    '<span class="est-capv-hint">Selecciona una materia (panel izq.) · clic en bloque vacío para asignar · clic en bloque ocupado para quitar</span>'+
    '</div>'+
    (_estCapvMode === 'grupo' ? _estAutoBarHTML() : '');

  return topbar + '<div id="est-capv-inner">'+_estCapvInnerHTML()+'</div>';
}

function _estCapvInnerHTML() {
  var rows = _estCapvCurrentRows();
  var map  = _estCapvBuildMap(rows);
  var panel = _estCapvMode === 'docente' ? _estCapvPanelDocHTML(rows) : _estCapvPanelHTML(rows);
  return '<div class="est-capv-layout">'+panel+_estCapvGridHTML(rows, map)+'</div>';
}

function _estCapvPanelHTML(rowIndices) {
  if (!rowIndices.length)
    return '<div class="est-capv-panel"><p class="est-capv-empty">Sin materias para este grupo.</p></div>';

  var items = rowIndices.map(function(rowIdx,i) {
    var row   = _estData[rowIdx];
    var color = _estCapvColor(i);
    var uac   = String(row.uac||'').trim() || '(sin nombre)';
    var doc   = String(row.docente||'').trim() || '—';
    var tot   = Number(row.tot_horas)||0;
    var asig  = _EST_DIAS_.reduce(function(s,d){ return s+_estParseHorasDia(row[d]); },0);
    var pct   = tot>0 ? Math.min(100,Math.round(asig/tot*100)) : 0;
    var isAct = _estCapvBrush===rowIdx;
    var isFin = tot>0 && asig>=tot;
    return '<div class="est-capv-mi'+(isAct?' est-capv-mi--active':'')+(isFin?' est-capv-mi--complete':'')+'" '+
      'onclick="_estCapvPickBrush('+rowIdx+')" title="'+genEsc(uac)+'">' +
      '<div class="est-capv-mi-color" style="background:'+color+'"></div>'+
      '<div class="est-capv-mi-body">'+
        '<div class="est-capv-mi-uac">'+genEsc(uac)+'</div>'+
        '<div class="est-capv-mi-doc">'+genEsc(doc)+'</div>'+
        '<div class="est-capv-mi-prog">'+
          '<div class="est-capv-mi-bar"><div class="est-capv-mi-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'+
          '<span class="est-capv-mi-hrs">'+asig+'/'+tot+'h</span>'+
        '</div>'+
      '</div>'+
      (isAct ? '<div class="est-capv-mi-pin">✎</div>' : '')+
    '</div>';
  }).join('');

  return '<div class="est-capv-panel"><div class="est-capv-panel-title">Materias del grupo</div>'+items+'</div>';
}

function _estCapvGridHTML(rowIndices, map) {
  var thead = '<thead><tr>'+
    '<th class="est-capv-th-hora"></th>'+
    _EST_DIAS_.map(function(d,i){ return '<th class="est-capv-th-dia">'+_CAPV_DIA_LABELS_[i]+'</th>'; }).join('')+
    '</tr></thead>';

  var hasBrush = _estCapvBrush >= 0;
  var tbody = '<tbody>' + _CAPV_HOURS_.map(function(h) {
    var hLabel = (h<10?'0':'')+h+':00';
    var cells = _EST_DIAS_.map(function(dia) {
      var occ = map[dia][h];
      if (occ) {
        if (!occ.isFirst) {
          return '<td class="est-capv-cell est-capv-cell--cont" '+
            'style="background:'+occ.color+'18;border-top:1px dashed '+occ.color+'44" '+
            'data-dia="'+dia+'" data-hour="'+h+'" data-row="'+occ.rowIdx+'" '+
            'onclick="_estCapvCellClick(this)"></td>';
        }
        var uacSh = occ.uac.length>26 ? occ.uac.slice(0,24)+'…' : occ.uac;
        var subLabel = _estCapvMode === 'docente'
          ? occ.grupo
          : (occ.docente ? occ.docente.split(' ').slice(-2).join(' ') : '');
        var bMatch = _estCapvBrush===occ.rowIdx;
        return '<td class="est-capv-cell est-capv-cell--occ'+(bMatch?' est-capv-cell--brush-match':'')+'" '+
          'style="background:'+occ.color+'20;border-left:3px solid '+occ.color+';border-top:1.5px solid '+occ.color+'66" '+
          'data-dia="'+dia+'" data-hour="'+h+'" data-row="'+occ.rowIdx+'" '+
          'onclick="_estCapvCellClick(this)">'+
          '<div class="est-capv-occ-label" style="color:'+occ.color+'">'+
            '<span class="est-capv-occ-uac">'+genEsc(uacSh)+'</span>'+
            (subLabel?'<span class="est-capv-occ-doc">'+genEsc(subLabel)+'</span>':'')+
          '</div></td>';
      }
      return '<td class="est-capv-cell est-capv-cell--empty'+(hasBrush?' est-capv-cell--droppable':'')+'" '+
        'data-dia="'+dia+'" data-hour="'+h+'" data-row="-1" '+
        'onclick="_estCapvCellClick(this)"></td>';
    }).join('');
    return '<tr><th class="est-capv-th-hora">'+hLabel+'</th>'+cells+'</tr>';
  }).join('') + '</tbody>';

  return '<div class="est-capv-grid-wrap">'+
    '<table class="est-capv-grid">'+thead+tbody+'</table>'+
    '<div id="est-capv-picker" class="est-capv-picker" style="display:none"></div>'+
    '</div>';
}

/* Panel lateral para modo docente: muestra grupo + uac de cada fila */
function _estCapvPanelDocHTML(rowIndices) {
  if (!rowIndices.length)
    return '<div class="est-capv-panel"><p class="est-capv-empty">Sin materias asignadas a este docente.</p></div>';

  var items = rowIndices.map(function(rowIdx, i) {
    var row   = _estData[rowIdx];
    var color = _estCapvColor(i);
    var uac   = String(row.uac||'').trim() || '(sin nombre)';
    var grupo = String(row.grupo||'').trim() || '—';
    var tot   = Number(row.tot_horas)||0;
    var asig  = _EST_DIAS_.reduce(function(s,d){ return s+_estParseHorasDia(row[d]); },0);
    var pct   = tot>0 ? Math.min(100,Math.round(asig/tot*100)) : 0;
    var isAct = _estCapvBrush===rowIdx;
    var isFin = tot>0 && asig>=tot;
    return '<div class="est-capv-mi'+(isAct?' est-capv-mi--active':'')+(isFin?' est-capv-mi--complete':'')+'" '+
      'onclick="_estCapvPickBrush('+rowIdx+')" title="'+genEsc(uac)+' — '+genEsc(grupo)+'">' +
      '<div class="est-capv-mi-color" style="background:'+color+'"></div>'+
      '<div class="est-capv-mi-body">'+
        '<div class="est-capv-mi-uac">'+genEsc(uac)+'</div>'+
        '<div class="est-capv-mi-doc" style="color:#6366f1;font-weight:600">Grupo: '+genEsc(grupo)+'</div>'+
        '<div class="est-capv-mi-prog">'+
          '<div class="est-capv-mi-bar"><div class="est-capv-mi-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'+
          '<span class="est-capv-mi-hrs">'+asig+'/'+tot+'h</span>'+
        '</div>'+
      '</div>'+
      (isAct ? '<div class="est-capv-mi-pin">✎</div>' : '')+
    '</div>';
  }).join('');

  return '<div class="est-capv-panel"><div class="est-capv-panel-title">Materias del docente</div>'+items+'</div>';
}

// ── Interacción ───────────────────────────────────────────────────────

function _estCapvPickBrush(rowIdx) {
  _estCapvBrush = (_estCapvBrush===rowIdx) ? -1 : rowIdx;
  _estCapvRefresh();
}

function _estCapvCambiarGrupo(g) {
  _estCapvGrupo = g;
  _estCapvBrush = -1;
  _estCapvRefresh();
  _estAutoRefreshBar();
}

function _estCapvCellClick(td) {
  var dia    = td.dataset.dia;
  var hour   = parseInt(td.dataset.hour, 10);
  var rowIdx = parseInt(td.dataset.row, 10);
  _estCapvHidePicker();

  if (rowIdx >= 0) {
    if (_estCapvBrush === rowIdx) {
      // Mismo pincel → limpiar
      _estCapvClear(rowIdx, dia);
    } else if (_estCapvBrush >= 0) {
      // Otro pincel → limpiar primero, luego asignar el pincel
      _estCapvClear(rowIdx, dia);
      _estCapvShowPicker(td, dia, hour, _estCapvBrush);
    } else {
      // Sin pincel → seleccionar esta materia como pincel
      _estCapvPickBrush(rowIdx);
    }
    return;
  }

  if (_estCapvBrush < 0) return;
  _estCapvShowPicker(td, dia, hour, _estCapvBrush);
}

function _estCapvShowPicker(td, dia, hour, rowIdx) {
  var rows = _estCapvCurrentRows();
  var map  = _estCapvBuildMap(rows);
  var slots = [];
  for (var dur=1; dur<=3; dur++) {
    if (hour+dur > 22) break;
    var label = (hour<10?'0':'')+hour+':00-'+(hour+dur<10?'0':'')+(hour+dur)+':00';
    var free = true;
    for (var h2=hour; h2<hour+dur; h2++) {
      var occ = map[dia][h2];
      if (occ && occ.rowIdx !== rowIdx) { free=false; break; }
    }
    if (free) slots.push({ label:label, dur:dur });
  }
  if (!slots.length) return;
  if (slots.length === 1) { _estCapvAssign(rowIdx, dia, slots[0].label); return; }

  _estCapvPendDia = dia;
  var picker = document.getElementById('est-capv-picker');
  if (!picker) return;

  var wrap     = document.querySelector('.est-capv-grid-wrap');
  var wrapRect = wrap.getBoundingClientRect();
  var tdRect   = td.getBoundingClientRect();
  var top  = tdRect.top  - wrapRect.top  + wrap.scrollTop;
  var left = tdRect.right- wrapRect.left + 4;

  picker.innerHTML =
    '<div class="est-capv-picker-title">¿Cuántas horas?</div>'+
    slots.map(function(s) {
      return '<button class="est-capv-picker-btn" '+
        'onclick="_estCapvPickerSelect(\''+s.label+'\','+rowIdx+')">'+
        s.dur+'h <small>'+s.label+'</small></button>';
    }).join('')+
    '<button class="est-capv-picker-cancel" onclick="_estCapvHidePicker()">✕ cancelar</button>';

  picker.style.display = 'block';
  picker.style.top  = top+'px';
  picker.style.left = left+'px';
}

function _estCapvPickerSelect(slot, rowIdx) {
  _estCapvHidePicker();
  _estCapvAssign(rowIdx, _estCapvPendDia, slot);
}

function _estCapvHidePicker() {
  var p = document.getElementById('est-capv-picker'); if (p) p.style.display='none';
}

function _estCapvAssign(rowIdx, dia, slotLabel) {
  var row   = _estData[rowIdx];
  var doc   = String(row.docente||'').trim();
  var grupo = String(row.grupo||'').trim();
  var cf = _estCapvConflicto(doc, dia, slotLabel, rowIdx);
  if (cf) genToast('⚠ '+doc+' ya tiene clase ese día ('+cf.uac+', grupo '+cf.grupo+').', 'warning');
  if (_estCapvMode === 'docente') {
    var gcf = _estCapvGrupoConflicto(grupo, dia, slotLabel, rowIdx);
    if (gcf) genToast('⚠ El grupo '+grupo+' ya tiene "'+gcf.uac+'" asignado en ese horario.', 'warning');
  }

  row[dia] = slotLabel;
  _estDirtySet.add(row);
  _estDirty = true;
  _estUpdateSaveBtn();
  _estUpdateDashboard();
  _estValidarLocal();
  _estCapvRefresh();
}

function _estCapvClear(rowIdx, dia) {
  var row  = _estData[rowIdx];
  row[dia] = '';
  _estDirtySet.add(row);
  _estDirty = true;
  _estUpdateSaveBtn();
  _estUpdateDashboard();
  _estValidarLocal();
  _estCapvRefresh();
}

function _estCapvRefresh() {
  var inner = document.getElementById('est-capv-inner'); if (!inner) return;
  inner.innerHTML = _estCapvInnerHTML();
}

// ══════════════════════════════════════════════════════════════════════
//  AUTOACOMODO DE HORARIOS
// ══════════════════════════════════════════════════════════════════════

var _estAutoSnap = null; // { grupo, rows: [{rowIdx, lunes, martes, …}] }

/* Rango de horas válidas según turno */
function _estAutoRangoTurno(turno) {
  var t = String(turno||'').trim().toLowerCase();
  if (t === 'vespertino') return { ini: 14, fin: 21 };
  if (t === 'matutino')   return { ini: 7,  fin: 14 };
  return { ini: 7, fin: 21 }; // Mixto o sin turno
}

/* Algoritmo greedy: genera propuesta de slots para horas pendientes del grupo */
function _estAutoProponerGrupo(grupo) {
  var filas = _estCapvRowsForGrupo(grupo);
  if (!filas.length) return { proposals: {}, unplaced: [], msg: 'Sin filas para este grupo.' };

  // ── Mapa de ocupación GLOBAL (todas las filas de _estData) ──────
  var grupoMap   = {};  // dia → { hora → rowIdx }   (solo el grupo actual)
  var docenteMap = {};  // docente → dia → hora → true (todos los grupos)
  _EST_DIAS_.forEach(function(d) { grupoMap[d] = {}; });

  _estData.forEach(function(row, i) {
    var g   = String(row.grupo||'').trim();
    var doc = String(row.docente||'').trim();
    var tp  = String(row.tipo_asignacion_docente||'').trim();
    _EST_DIAS_.forEach(function(dia) {
      var v = String(row[dia]||'').trim(); if (!v) return;
      var m = v.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
      if (!m) return;
      var hs = parseInt(m[1],10), he = parseInt(m[3],10);
      for (var h = hs; h < he; h++) {
        if (g === grupo) grupoMap[dia][h] = i;
        if (doc && tp !== 'Vacante') {
          if (!docenteMap[doc])           docenteMap[doc] = {};
          if (!docenteMap[doc][dia])      docenteMap[doc][dia] = {};
          docenteMap[doc][dia][h] = true;
        }
      }
    });
  });

  // ── Pendientes ───────────────────────────────────────────────────
  var pending = [];
  filas.forEach(function(rowIdx) {
    var row = _estData[rowIdx];
    var tot = Number(row.tot_horas) || 0;
    if (!tot) return;
    var asig = _EST_DIAS_.reduce(function(s,d){ return s + _estParseHorasDia(row[d]); }, 0);
    var pend = tot - asig;
    if (pend <= 0) return;
    pending.push({
      rowIdx: rowIdx,
      uac:    String(row.uac||'').trim() || '(sin nombre)',
      doc:    String(row.docente||'').trim(),
      tipo:   String(row.tipo_asignacion_docente||'').trim(),
      turno:  String(row.turno||'').trim(),
      tot:    tot, asig: asig, pend: pend
    });
  });

  if (!pending.length) return { proposals: {}, unplaced: [], msg: 'Todo ya está asignado para este grupo.' };

  // Ordenar: más horas pendientes primero (más difíciles de colocar)
  pending.sort(function(a,b){ return b.pend - a.pend; });

  var proposals = {}; // rowIdx → { dia → slotLabel }
  var unplaced  = [];

  pending.forEach(function(mat) {
    var rango    = _estAutoRangoTurno(mat.turno);
    var horasLeft = mat.pend;
    var rowIdx    = mat.rowIdx;
    var row       = _estData[rowIdx];

    // Días ya asignados a esta materia (antes y durante el algoritmo)
    var usedDias = {};
    _EST_DIAS_.forEach(function(d) { if (String(row[d]||'').trim()) usedDias[d] = true; });
    if (proposals[rowIdx]) Object.keys(proposals[rowIdx]).forEach(function(d){ usedDias[d] = true; });

    // Carga actual por día (para el grupo)
    function diaLoad(dia) {
      var c = 0;
      for (var h = rango.ini; h < rango.fin; h++) if (grupoMap[dia][h] !== undefined) c++;
      return c;
    }

    // Preferir días nuevos (no usados), ordenados de menor a mayor carga
    var diasFresh = _EST_DIAS_.filter(function(d){ return !usedDias[d]; });
    diasFresh.sort(function(a,b){ return diaLoad(a) - diaLoad(b); });
    var diasUsed  = _EST_DIAS_.filter(function(d){ return usedDias[d]; });
    diasUsed.sort(function(a,b){ return diaLoad(a) - diaLoad(b); });
    var diasOrd   = diasFresh.concat(diasUsed);

    // Máximo 2 horas por bloque (regla operativa del plantel)
    var preferBlk = 2;

    for (var di = 0; di < diasOrd.length && horasLeft > 0; di++) {
      var dia    = diasOrd[di];
      var maxBlk = Math.min(preferBlk, horasLeft);
      var placed = false;

      for (var startH = rango.ini; startH < rango.fin && !placed; startH++) {
        for (var blk = maxBlk; blk >= 1; blk--) {
          var endH = startH + blk;
          if (endH > rango.fin) continue;

          // Verificar grupo libre
          var ok = true;
          for (var h = startH; h < endH; h++) {
            if (grupoMap[dia][h] !== undefined) { ok = false; break; }
          }
          if (!ok) continue;

          // Verificar docente libre (si aplica)
          if (mat.doc && mat.tipo !== 'Vacante') {
            for (var h2 = startH; h2 < endH; h2++) {
              if (docenteMap[mat.doc] && docenteMap[mat.doc][dia] && docenteMap[mat.doc][dia][h2]) {
                ok = false; break;
              }
            }
          }
          if (!ok) continue;

          // Slot válido — asignar
          var label = (startH<10?'0':'')+startH+':00-'+(endH<10?'0':'')+endH+':00';
          if (!proposals[rowIdx]) proposals[rowIdx] = {};
          proposals[rowIdx][dia] = label;

          // Actualizar mapas para las siguientes iteraciones
          for (var h3 = startH; h3 < endH; h3++) {
            grupoMap[dia][h3] = rowIdx;
            if (mat.doc && mat.tipo !== 'Vacante') {
              if (!docenteMap[mat.doc])           docenteMap[mat.doc] = {};
              if (!docenteMap[mat.doc][dia])      docenteMap[mat.doc][dia] = {};
              docenteMap[mat.doc][dia][h3] = true;
            }
          }

          horasLeft -= blk;
          usedDias[dia] = true;
          placed = true;
          break; // siguiente día
        }
      }
    }

    if (horasLeft > 0)
      unplaced.push({ uac: mat.uac, horas: horasLeft,
        razon: mat.doc ? 'Sin slots libres para ' + mat.doc : 'Sin slots disponibles' });
  });

  return { proposals: proposals, unplaced: unplaced };
}

/* Aplica propuestas a _estData y guarda snapshot para deshacer */
function _estAutoAplicar(grupo, proposals) {
  var snap = [];
  Object.keys(proposals).forEach(function(ri) {
    var rowIdx = parseInt(ri, 10);
    var row    = _estData[rowIdx];
    snap.push({ rowIdx: rowIdx,
      lunes: row.lunes, martes: row.martes, miercoles: row.miercoles,
      jueves: row.jueves, viernes: row.viernes });
    Object.keys(proposals[ri]).forEach(function(dia) {
      row[dia] = proposals[ri][dia];
      _estDirtySet.add(row);
    });
  });
  _estAutoSnap = { grupo: grupo, rows: snap };
  _estDirty = true;
  _estUpdateSaveBtn();
  _estUpdateDashboard();
  _estValidarLocal();
}

/* Limpia todos los días del grupo y guarda snapshot */
function _estAutoLimpiarGrupo(grupo) {
  var filas = _estCapvRowsForGrupo(grupo);
  if (!filas.length) return;
  var snap = [];
  var tieneDatos = false;
  filas.forEach(function(rowIdx) {
    var row = _estData[rowIdx];
    var orig = { rowIdx: rowIdx,
      lunes: row.lunes, martes: row.martes, miercoles: row.miercoles,
      jueves: row.jueves, viernes: row.viernes };
    snap.push(orig);
    var hayAlgo = _EST_DIAS_.some(function(d){ return String(row[d]||'').trim(); });
    if (hayAlgo) {
      tieneDatos = true;
      _EST_DIAS_.forEach(function(d){ row[d] = ''; });
      _estDirtySet.add(row);
    }
  });
  if (!tieneDatos) { genToast('El grupo ya está vacío.', 'info'); return; }
  _estAutoSnap = { grupo: grupo, rows: snap };
  _estDirty = true;
  _estUpdateSaveBtn();
  _estUpdateDashboard();
  _estValidarLocal();
  _estCapvRefresh();
  _estAutoRefreshBar();
  genToast('Horario del grupo limpiado. Usa "Deshacer" si fue un error.', 'ok');
}

/* Deshace la última acción (propuesta o limpieza) */
function _estAutoDeshacer() {
  if (!_estAutoSnap) return;
  _estAutoSnap.rows.forEach(function(s) {
    var row = _estData[s.rowIdx];
    row.lunes = s.lunes; row.martes = s.martes; row.miercoles = s.miercoles;
    row.jueves = s.jueves; row.viernes = s.viernes;
    _estDirtySet.add(row);
  });
  _estAutoSnap = null;
  _estDirty = true;
  _estUpdateSaveBtn();
  _estUpdateDashboard();
  _estValidarLocal();
  _estCapvRefresh();
  _estAutoRefreshBar();
  genToast('Acción deshecha.', 'ok');
}

/* Handler botón "Proponer horario" */
function _estAutoProponer() {
  if (!_estCapvGrupo) return;
  var result = _estAutoProponerGrupo(_estCapvGrupo);

  if (result.msg) { genToast(result.msg, 'info'); return; }
  var propCount = Object.keys(result.proposals).length;
  if (!propCount) { genToast('No hay horas pendientes por asignar.', 'info'); return; }

  _estAutoAplicar(_estCapvGrupo, result.proposals);
  _estCapvRefresh();
  _estAutoRefreshBar();

  if (result.unplaced.length) {
    var pendMsg = result.unplaced.map(function(u){
      return '"'+u.uac+'" ('+u.horas+'h — '+u.razon+')';
    }).join('; ');
    genToast(propCount+' materia'+(propCount>1?'s':'')+' acomodada'+(propCount>1?'s':'')+
      '. ⚠ Sin colocar: '+pendMsg, 'warning');
  } else {
    genToast('✓ '+propCount+' materia'+(propCount>1?'s':'')+' acomodada'+(propCount>1?'s':'')+
      ' correctamente.', 'ok');
  }
}

/* Actualiza la barra de autoacomodo sin re-renderizar todo */
function _estAutoRefreshBar() {
  var bar = document.getElementById('est-auto-bar');
  if (bar) bar.outerHTML = _estAutoBarHTML();
}

/* HTML de la barra de acciones de autoacomodo */
function _estAutoBarHTML() {
  var hasSnap = _estAutoSnap && _estAutoSnap.grupo === _estCapvGrupo;
  return '<div class="est-auto-bar" id="est-auto-bar">'+
    '<span class="est-auto-label">Autoacomodo:</span>'+
    '<button class="gen-btn gen-btn-sm gen-btn-primary est-auto-btn" onclick="_estAutoProponer()" title="Asignar automáticamente las horas pendientes de este grupo">'+
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="5 3 19 12 5 21 5 3"/></svg> Proponer horario</button>'+
    '<button class="gen-btn gen-btn-sm est-auto-btn" onclick="_estAutoLimpiarGrupo(\''+genEsc(_estCapvGrupo)+'\')" title="Borrar todos los horarios del grupo para empezar de cero">'+
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg> Limpiar grupo</button>'+
    (hasSnap ? '<button class="gen-btn gen-btn-sm est-auto-btn est-auto-undo" onclick="_estAutoDeshacer()" title="Deshacer la última acción automática">'+
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> Deshacer</button>' : '')+
    '</div>';
}
