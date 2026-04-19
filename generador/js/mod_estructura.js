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
      _estGrupoFiltroSem = '';

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
  { key: 'docente',            label: 'DOCENTE',         w: 170, t: 'docente'},
  { key: 'formacion_docente',  label: 'FORMACIÓN',       w: 145, t: 'text'   },
  { key: 'lunes',              label: 'LUN',             w: 38,  t: 'num'    },
  { key: 'martes',             label: 'MAR',             w: 38,  t: 'num'    },
  { key: 'miercoles',          label: 'MIÉ',             w: 38,  t: 'num'    },
  { key: 'jueves',             label: 'JUE',             w: 38,  t: 'num'    },
  { key: 'viernes',            label: 'VIE',             w: 38,  t: 'num'    },
  { key: 'horas',              label: 'HRS',             w: 45,  t: 'num'    }
];

// ── ESTADO DEL MÓDULO ────────────────────────────────────────────────

var _estData           = [];
var _estEstado         = 'EN_CAPTURA';
var _estPeriodo        = '';   // snapshot del periodo al renderizar
var _estDirty          = false;
var _estView           = 'grid';
var _estConflictos     = { errores: [], advertencias: [] };
var _estGrupoFiltroSem = '';   // '' = todos | '2'|'4'|'6' = solo ese | '246' = conjunto

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

<div class="est-view-tabs">
  <button class="est-view-tab${_estView==='grid'?' active':''}" data-view="grid">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
    Grilla
  </button>
  <button class="est-view-tab${_estView==='grupo'?' active':''}" data-view="grupo">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
    Por grupo
  </button>
  <button class="est-view-tab${_estView==='docente'?' active':''}" data-view="docente">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    Por docente
  </button>
  <button class="est-view-tab${_estView==='conflictos'?' active':''}" data-view="conflictos">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    Conflictos
    <span id="est-conflict-count" class="est-conf-count" style="display:none"></span>
  </button>
</div>

<div id="est-view-content">
  ${_estViewHTML()}
</div>
${_estDatalistsHTML()}`;
}

function _estViewHTML() {
  if (_estView === 'grid')      return _estGridHTML();
  if (_estView === 'grupo')     return _estPorGrupoHTML();
  if (_estView === 'docente')   return _estPorDocenteHTML();
  if (_estView === 'conflictos') return _estConflictosHTML();
  return '';
}

// ── VISTA GRILLA ─────────────────────────────────────────────────────

function _estGridHTML() {
  var cerrada = _estEstado === 'CERRADA';
  var thead = '<tr><th class="est-th-num">#</th>' +
    _EST_COLS_.map(function(c) {
      return '<th style="min-width:'+c.w+'px;max-width:'+(c.w+40)+'px">'+c.label+'</th>';
    }).join('') +
    '<th class="est-th-del"></th></tr>';

  var rows = _estData.length === 0
    ? '<tr><td colspan="'+ (_EST_COLS_.length + 2) +'" class="gen-td-empty">Sin filas. Usa "+ Agregar fila" o pega desde Excel.</td></tr>'
    : _estData.map(function(row, i) { return _estGridRow(row, i, cerrada); }).join('');

  var addBtn = cerrada ? '' :
    '<div style="padding:10px 0"><button class="gen-btn gen-btn-secondary gen-btn-sm" id="est-add-row">+ Agregar fila</button>' +
    '<span class="gen-hint" style="margin-left:12px">Pega desde Excel con Ctrl+V en cualquier celda</span></div>';

  return '<div class="est-grid-wrap"><table class="est-grid" id="est-grid-table">' +
         '<thead>'+thead+'</thead>' +
         '<tbody id="est-grid-tbody">'+rows+'</tbody>' +
         '</table></div>' + addBtn;
}

function _estGridRow(row, idx, cerrada) {
  var errFila = _estConflictos.errores.filter(function(e) { return e.fila === idx + 1; }).length;
  var wrnFila = _estConflictos.advertencias.filter(function(e) { return e.fila === idx + 1; }).length;
  var rowCls  = errFila ? ' est-row-error' : (wrnFila ? ' est-row-warn' : '');

  var cells = _EST_COLS_.map(function(col) {
    var val  = row[col.key] !== undefined ? String(row[col.key]) : '';
    var tipo = col.t;
    var dlAttr = _estDatalistAttr(tipo);
    var inputType = tipo === 'num' ? 'number' : 'text';
    var disabled  = cerrada ? ' disabled' : '';
    return '<td><input type="'+inputType+'" class="est-cell" ' +
           'data-row="'+idx+'" data-col="'+genEsc(col.key)+'"' +
           dlAttr + disabled +
           ' value="'+genEsc(val)+'" style="width:100%"></td>';
  }).join('');

  var delBtn = cerrada ? '<td></td>' :
    '<td><button class="gen-btn-icon gen-btn-delete est-del-row" data-row="'+idx+'" title="Eliminar fila">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
    '</button></td>';

  return '<tr class="est-grid-row'+rowCls+'" data-row="'+idx+'">' +
         '<td class="est-td-num">'+(idx+1)+'</td>' +
         cells + delBtn + '</tr>';
}

// ── VISTA POR GRUPO ──────────────────────────────────────────────────

function _estPorGrupoHTML() {
  if (!_estData.length) {
    return '<div class="gen-empty-state" style="margin-top:32px"><p>No hay datos en la estructura todavía.</p></div>';
  }

  // Chips de filtro
  var chips = [
    { val: '',    label: 'Todos' },
    { val: '2',   label: '2°' },
    { val: '4',   label: '4°' },
    { val: '6',   label: '6°' },
    { val: '246', label: '2°, 4° y 6°' }
  ];
  var filtroBar = '<div class="est-filtro-bar">' +
    '<span class="est-filtro-label">Semestre:</span>' +
    chips.map(function(c) {
      var active = _estGrupoFiltroSem === c.val ? ' active' : '';
      return '<button class="est-filtro-chip' + active + '" onclick="_estSetGrupoFiltro(\'' + c.val + '\')">' + c.label + '</button>';
    }).join('') +
    '</div>';

  return filtroBar + '<div id="est-grupo-cards" class="est-cards-grid">' + _estGrupoCardsHTML() + '</div>';
}

function _estGrupoCardsHTML() {
  var filtro = _estGrupoFiltroSem;
  var porGrupo = {};
  _estData.forEach(function(row) {
    var sem = String(row.semestre || '').trim();
    // Aplicar filtro
    if (filtro === '246') {
      if (['2','4','6'].indexOf(sem) === -1) return;
    } else if (filtro && sem !== filtro) {
      return;
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
      var docenteTag = f.docente
        ? '<span style="font-size:11px;color:var(--gen-muted);">'+genEsc(f.docente)+'</span>'
        : '<span style="color:#ef4444;font-size:11px;">Sin asignar</span>';
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
        '<span style="color:var(--gen-muted);font-size:12px;">'+filas.length+' materia'+(filas.length!==1?'s':'')+'</span>' +
        '<span class="est-v2-total-badge" style="background:'+sc.light+';color:'+sc.text+';border-color:'+sc.border+'">'+totalHrs+' hrs / sem</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _estSetGrupoFiltro(sem) {
  _estGrupoFiltroSem = sem;
  // Actualizar chips activos
  document.querySelectorAll('.est-filtro-chip').forEach(function(btn) {
    var matches = btn.textContent.trim() === (['','2','4','6','246'].indexOf(sem) !== -1
      ? [{ val:'',label:'Todos'},{val:'2',label:'2°'},{val:'4',label:'4°'},{val:'6',label:'6°'},{val:'246',label:'2°, 4° y 6°'}].find(function(c){return c.val===sem;}).label
      : '');
    btn.classList.toggle('active', btn.getAttribute('onclick').indexOf("'"+sem+"'") !== -1);
  });
  // Refrescar solo las tarjetas
  var cards = document.getElementById('est-grupo-cards');
  if (cards) cards.innerHTML = _estGrupoCardsHTML();
}

// ── VISTA POR DOCENTE ────────────────────────────────────────────────

function _estPorDocenteHTML() {
  var porDocente = {};
  _estData.forEach(function(row) {
    var d = row.docente ? String(row.docente).trim() : '(sin docente)';
    if (!porDocente[d]) porDocente[d] = [];
    porDocente[d].push(row);
  });

  if (!Object.keys(porDocente).length) {
    return '<div class="gen-empty-state" style="margin-top:32px"><p>No hay datos en la estructura todavía.</p></div>';
  }

  var sinDocente = porDocente['(sin docente)'];

  return '<div class="est-cards-grid">' +
    Object.keys(porDocente).sort(function(a, b) {
      // Sin docente al final
      if (a === '(sin docente)') return 1;
      if (b === '(sin docente)') return -1;
      return a.localeCompare(b);
    }).map(function(d) {
      var filas     = porDocente[d];
      var totalHrs  = filas.reduce(function(s, f) { return s + (Number(f.tot_horas) || 0); }, 0);
      var formacion = '';
      for (var i = 0; i < filas.length; i++) {
        if (filas[i].formacion_docente) { formacion = filas[i].formacion_docente; break; }
      }
      var grupos = Array.from(new Set(filas.map(function(f) { return f.grupo || ''; }).filter(Boolean))).sort();

      // Color de horas según carga
      var hrsColor, hrsBg, hrsBorder;
      if (totalHrs === 0)       { hrsColor='#64748b'; hrsBg='#f1f5f9'; hrsBorder='#cbd5e1'; }
      else if (totalHrs <= 25)  { hrsColor='#0369a1'; hrsBg='#e0f2fe'; hrsBorder='#7dd3fc'; }
      else if (totalHrs <= 35)  { hrsColor='#15803d'; hrsBg='#dcfce7'; hrsBorder='#86efac'; }
      else if (totalHrs <= 40)  { hrsColor='#92400e'; hrsBg='#fef3c7'; hrsBorder='#fcd34d'; }
      else                      { hrsColor='#991b1b'; hrsBg='#fee2e2'; hrsBorder='#fca5a5'; }

      var hrsIcon = totalHrs > 35 ? '⚠ ' : '';
      var hrsBadge = '<span class="est-v2-hrs-badge" style="background:'+hrsBg+';color:'+hrsColor+';border-color:'+hrsBorder+'">'+hrsIcon+totalHrs+' hrs</span>';

      // Avatar con iniciales
      var initials = d === '(sin docente)' ? '?' :
        d.split(/\s+/).filter(Boolean).slice(0, 2).map(function(w) { return w[0] || ''; }).join('').toUpperCase();
      var avatarBg = d === '(sin docente)' ? '#ef4444' : '#3b82f6';

      var rows = filas.map(function(f) {
        var sc2 = _EST_SEM_COLORS_[String(f.semestre||'').trim()] || null;
        var grupoTag = f.grupo
          ? '<span class="est-v2-badge" style="'+(sc2?'background:'+sc2.light+';color:'+sc2.text+';border-color:'+sc2.border+';':'')+' font-size:10px;">'+genEsc(f.grupo)+'</span>'
          : '<span style="color:var(--gen-muted);">—</span>';
        return '<tr>' +
          '<td>'+grupoTag+'</td>' +
          '<td class="est-v2-uac">'+genEsc(f.uac||'—')+'</td>' +
          '<td class="est-v2-hrs">'+genEsc(String(f.tot_horas||'—'))+'</td>' +
          '</tr>';
      }).join('');

      var overloadBorder = totalHrs > 35 ? 'border-top:3px solid #f97316;' : 'border-top:3px solid #3b82f6;';

      return '<div class="est-card-v2" style="'+overloadBorder+'">' +
        '<div class="est-v2-head" style="background:'+(totalHrs>35?'#fff7ed':'#f0f9ff')+';">' +
          '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">' +
            '<div class="est-v2-avatar" style="background:'+avatarBg+';">'+genEsc(initials)+'</div>' +
            '<div style="min-width:0;">' +
              '<div class="est-v2-grupo" style="font-size:13px;">'+genEsc(d)+'</div>' +
              (formacion ? '<div style="font-size:11px;color:var(--gen-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+genEsc(formacion)+'</div>' : '') +
            '</div>' +
          '</div>' +
          hrsBadge +
        '</div>' +
        '<table class="est-card-table est-v2-table">' +
          '<thead><tr><th>Grupo</th><th>UAC</th><th>H</th></tr></thead>' +
          '<tbody>'+rows+'</tbody>' +
        '</table>' +
        '<div class="est-v2-foot">' +
          '<span style="color:var(--gen-muted);font-size:12px;">'+filas.length+' materia'+(filas.length!==1?'s':'')+'</span>' +
          '<span style="font-size:12px;color:var(--gen-muted);">'+grupos.length+' grupo'+(grupos.length!==1?'s':'')+'</span>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
}

function _estGrupoSemFromGrupo_(grupo) {
  // Intenta inferir semestre desde el nombre del grupo (ej. "201" → sem 2)
  var m = String(grupo).match(/^[A-Z]?(\d)/i);
  return m ? m[1] : '';
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
    if (!row.docente || !String(row.docente).trim()) {
      errores.push({ tipo: 'SIN_DOCENTE', fila: i + 1, grupo: row.grupo,
        mensaje: 'Fila '+(i+1)+': "'+row.uac+'" sin docente asignado.' });
    }
    var dias = ['lunes','martes','miercoles','jueves','viernes'];
    var suma = dias.reduce(function(s,d) { return s + (Number(row[d])||0); }, 0);
    var tot  = Number(row.tot_horas) || 0;
    if (tot > 0 && suma > 0 && suma !== tot) {
      advert.push({ tipo: 'HORAS_INCONSISTENTES', fila: i + 1, grupo: row.grupo,
        mensaje: 'Fila '+(i+1)+' ('+row.uac+'): días='+suma+' ≠ TOT_HORAS='+tot+'.' });
    }
  });

  var docenteDia = {};
  _estData.forEach(function(row) {
    if (!row.docente) return;
    ['lunes','martes','miercoles','jueves','viernes'].forEach(function(dia) {
      var h = Number(row[dia]) || 0;
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
    _estDirty = true;
    _estValidarLocal();
    // Actualizar color de la fila
    var tr = inp.closest('tr');
    if (tr) {
      var errFila = _estConflictos.errores.filter(function(e) { return e.fila === rowIdx + 1; }).length;
      var wrnFila = _estConflictos.advertencias.filter(function(e) { return e.fila === rowIdx + 1; }).length;
      tr.className = 'est-grid-row' + (errFila ? ' est-row-error' : wrnFila ? ' est-row-warn' : '');
    }
    // Actualizar botón guardar
    var btnG = document.getElementById('est-btn-guardar');
    if (btnG) { btnG.textContent = '● Guardar todo'; btnG.style.background = '#f59e0b'; btnG.style.borderColor = '#f59e0b'; }
  });

  // Eliminar fila
  tbody.addEventListener('click', function(e) {
    var btn = e.target.closest('.est-del-row');
    if (!btn) return;
    var rowIdx = parseInt(btn.dataset.row, 10);
    if (isNaN(rowIdx)) return;
    _estData.splice(rowIdx, 1);
    _estDirty = true;
    _estRebuildGrid();
    _estValidarLocal();
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
      while (_estData.length <= tgtRowIdx) _estData.push({});
      cols.forEach(function(val, ci) {
        var tgtColIdx = colIdx + ci;
        if (tgtColIdx >= _EST_COLS_.length) return;
        _estData[tgtRowIdx][_EST_COLS_[tgtColIdx].key] = val.replace(/\r/g, '').trim();
      });
    });

    _estDirty = true;
    _estRebuildGrid();
    _estValidarLocal();
  });
}

// ── REBUILD GRID (sin re-render total) ──────────────────────────────

function _estRebuildGrid() {
  var tbody = document.getElementById('est-grid-tbody');
  if (!tbody) return;
  var cerrada = _estEstado === 'CERRADA';
  if (_estData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="'+(_EST_COLS_.length + 2)+'" class="gen-td-empty">Sin filas. Usa "+ Agregar fila" o pega desde Excel.</td></tr>';
  } else {
    tbody.innerHTML = _estData.map(function(row, i) { return _estGridRow(row, i, cerrada); }).join('');
  }
  // Re-bind grid events (delegated, so they re-attach automatically)
}

// ── SWITCH VIEW ──────────────────────────────────────────────────────

function _estSwitchView(view) {
  _estView = view;
  document.querySelectorAll('.est-view-tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === view);
  });
  var content = document.getElementById('est-view-content');
  if (content) content.innerHTML = _estViewHTML();
  if (view === 'grid') _estBindGrid();
}

// ── ACCIONES ─────────────────────────────────────────────────────────

function _estAddRow() {
  _estData.push({});
  _estDirty = true;
  _estRebuildGrid();
}

async function _estGuardarTodo() {
  if (!_estData.length) { genToast('No hay datos que guardar.', 'info'); return; }
  genRequireAdmin(async function() {
    var btn = document.getElementById('est-btn-guardar');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    try {
      // Asignar ciclo y periodo a cada fila antes de enviar
      var filas = _estData.map(function(row) {
        var f = Object.assign({}, row);
        f.ciclo   = _genApp.ciclo;
        f.periodo = _genApp.periodo || '';
        return f;
      });
      await genAPI.replaceEstructura(_genApp.adminKey, _genApp.ciclo, filas);
      _estDirty = false;
      genToast(_estData.length + ' filas guardadas correctamente.', 'ok');
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar todo'; btn.style.background = ''; btn.style.borderColor = ''; }
    } catch(err) {
      genToast('Error al guardar: ' + err.message, 'error');
      if (err.message.includes('administrador')) _genApp.adminKey = null;
      if (btn) { btn.disabled = false; btn.textContent = '● Guardar todo'; }
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
  var periodoMsg = _genApp.periodo ? ' (Periodo '+_genApp.periodo+')' : '';
  genRequireAdmin(function() {
    genConfirm(
      'Esto generará asignaciones de Carga Horaria desde la estructura educativa'+periodoMsg+'. Las asignaciones existentes para este ciclo no se eliminarán; se agregarán las nuevas. ¿Continuar?',
      async function() {
        try {
          var res = await genAPI.estructuraACarga(_genApp.adminKey, _genApp.ciclo);
          genToast(res.message, 'ok');
          if (res.sin_match && res.sin_match.length) {
            genToast('Sin coincidencia en catálogo: ' + res.sin_match.slice(0,3).join(', ') + (res.sin_match.length > 3 ? '…' : ''), 'warning');
          }
        } catch(err) {
          genToast('Error: ' + err.message, 'error');
        }
      }
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
