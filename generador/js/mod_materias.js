/* ── mod_materias.js — Catálogo de Materias / UAC ───────────────── */

genRegisterModule('materias', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando materias…</span></div>';
    try {
      var materias = await genAPI.getMaterias(true);
      _genApp.materias = materias;
      materias.forEach(function(m) { if (m.id) genGetMateriaColor(m.id); });
      _matCurrentSem = '';
      // No resetear _matViewMode al re-renderizar — conserva preferencia del usuario
      container.innerHTML = _matHTML(materias);
      _matBind();
    } catch(err) {
      genShowError('No se pudo cargar el catálogo: ' + err.message);
    }
  }
});

// ── CONSTANTES ──────────────────────────────────────────────────────

var _MAT_COMPONENTES_ = [
  'Matemáticas', 'Comunicación', 'Ciencias Naturales', 'Ciencias Sociales',
  'Tecnología', 'Expresiones', 'Lengua Extranjera', 'Educación Física',
  'Fortalecimiento', 'Orientación', 'Tutoría',
  'Tecnologías de la Información', 'Higiene y Salud Comunitaria', 'Auxiliar Educativo',
  'Otro'
];

var _MAT_SEMESTRES_ = ['1', '2', '3', '4', '5', '6'];

// ── ESTADO DEL MÓDULO ────────────────────────────────────────────────

var _matCurrentSem = '';
var _matViewMode   = 'flat';   // 'flat' | 'grouped'

// ── DETECCIÓN DE CAPACITACIÓN ────────────────────────────────────────

/**
 * Detección SOLO por campo `componente` (para vista plana y badge visual).
 * No aplica inferencia por nombre — lo que dice el campo, eso vale.
 */
function _matDetectCapFlat(m) {
  return genGetCap(m.componente);
}

/**
 * Detección INTELIGENTE para la vista "Por componente".
 * Reglas:
 *  - Semestres 1 y 2 → nunca capacitación (son comunes a todos los grupos)
 *  - El campo `componente` explícito siempre gana sobre las reglas de nombre
 *  - Semestre 3 → reglas controladas por nombre de materia
 *  - Semestre 5 → reglas controladas por nombre de materia
 *  - Resto → null (sin inferencia, para no inventar capacitación)
 */
function _matDetectCapGrouped(m) {
  var sem = String(m.semestre || '').trim();

  // 1° y 2° nunca llevan capacitación
  if (sem === '1' || sem === '2') return null;

  // Campo componente explícito tiene prioridad
  var c = genGetCap(m.componente);
  if (c) return c;

  // Solo aplicar reglas de nombre en semestres 3 y 5
  if (sem !== '3' && sem !== '5') return null;

  var nom = genNormStr(m.nombre || '');

  if (sem === '3') {
    // Higiene y Salud Comunitaria — 3°
    if (nom.indexOf('bases anatomic') !== -1 ||
        nom.indexOf('fisiolog') !== -1 ||
        nom.indexOf('salud enfermedad') !== -1 ||
        nom.indexOf('epidemiolog') !== -1) {
      return 'Higiene y Salud Comunitaria';
    }
    // Auxiliar Educativo — 3°
    if (nom.indexOf('sistema educativo') !== -1 ||
        nom.indexOf('intervencion educativa') !== -1) {
      return 'Auxiliar Educativo';
    }
    // Tecnologías de la Información — 3°
    if (nom.indexOf('gestion de archivo') !== -1 ||
        nom.indexOf('archivo de texto') !== -1 ||
        nom.indexOf('hoja de calculo') !== -1 ||
        nom.indexOf('hoja calculo') !== -1) {
      return 'Tecnologías de la Información';
    }
  }

  if (sem === '5') {
    // Tecnologías de la Información — 5°
    if (nom.indexOf('sistemas de informacion') !== -1 ||
        nom.indexOf('sistema de informacion') !== -1 ||
        nom.indexOf('programacion') !== -1) {
      return 'Tecnologías de la Información';
    }
    // Auxiliar Educativo — 5°
    if (nom.indexOf('intervencion educativa') !== -1) {
      return 'Auxiliar Educativo';
    }
    // Higiene y Salud Comunitaria — 5°
    if (nom.indexOf('salud sexual') !== -1 ||
        nom.indexOf('tecnicas clinicas') !== -1) {
      return 'Higiene y Salud Comunitaria';
    }
  }

  return null;  // sin coincidencia → materia general
}

/**
 * Dispatcher: usa la función correcta según el modo de vista actual.
 * Llamado desde _matRow para el badge visual de la fila.
 */
function _matCapForRow(m) {
  return _matViewMode === 'grouped' ? _matDetectCapGrouped(m) : _matDetectCapFlat(m);
}

// ── BADGE DE SEMESTRE ────────────────────────────────────────────────

function _matSemestreBadge(sem) {
  if (!sem || sem === '') return '<span class="gen-badge gen-badge-gray" style="font-size:10px">General</span>';
  return '<span class="gen-badge gen-badge-blue" style="font-size:10px">'+genEsc(sem)+'°</span>';
}

// ── HTML PRINCIPAL ───────────────────────────────────────────────────

function _matHTML(materias) {
  var semsPeriodo  = genGetSemestresPeriodo();
  var semsVisibles = semsPeriodo ? semsPeriodo : _MAT_SEMESTRES_;

  if (_matCurrentSem && semsPeriodo && semsPeriodo.indexOf(_matCurrentSem) === -1) {
    _matCurrentSem = '';
  }

  var tabs = [''].concat(semsVisibles).map(function(s) {
    var active = s === _matCurrentSem ? ' active' : '';
    return '<button class="gen-mat-tab'+active+'" data-sem="'+s+'">'+(s ? s+'°' : 'Todas')+'</button>';
  }).join('');

  var periodoInfo = _genApp.periodo
    ? '<span class="gen-periodo-badge gen-periodo-badge-'+_genApp.periodo+'">Periodo '+_genApp.periodo+' · Sems '+semsVisibles.join(', ')+'°</span>'
    : '';

  var vFlat    = _matViewMode === 'flat'    ? ' active' : '';
  var vGrouped = _matViewMode === 'grouped' ? ' active' : '';

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Materias / UAC</h1>
    <p class="gen-page-sub">${materias.length} materias registradas${periodoInfo ? ' &nbsp;' + periodoInfo : ''}</p>
  </div>
  <div class="gen-header-actions">
    <input type="text" id="gen-mat-search" class="gen-search-input" placeholder="Buscar materia…">
    <div class="gen-mat-view-toggle">
      <button class="gen-mat-vtab${vFlat}" id="gen-mat-vflat" title="Lista plana">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Plana
      </button>
      <button class="gen-mat-vtab${vGrouped}" id="gen-mat-vgrouped" title="Agrupar por componente">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Por componente
      </button>
    </div>
    <button class="gen-btn gen-btn-primary" id="gen-mat-nuevo">+ Nueva materia</button>
  </div>
</div>

<div class="gen-mat-tabs-bar">${tabs}</div>

<div class="gen-table-wrapper">
  <table class="gen-table">
    <thead>
      <tr>
        <th style="width:32px"></th>
        <th>Clave</th>
        <th>Nombre</th>
        <th>Semestre</th>
        <th>Componente / Capacitación</th>
        <th>Hrs</th>
        <th>Estado</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-mat-tbody">
      ${_matBuildTbody(materias, _matCurrentSem)}
    </tbody>
  </table>
</div>`;
}

// ── CONSTRUCCIÓN DEL TBODY ───────────────────────────────────────────

/** Filtra la lista por semestre/periodo y delega al constructor de vista. */
function _matBuildTbody(materias, sem) {
  var list = materias || [];
  var semsPeriodo = genGetSemestresPeriodo();

  if (sem) {
    list = list.filter(function(m) { return String(m.semestre || '') === sem; });
  } else if (semsPeriodo) {
    list = list.filter(function(m) {
      var ms = String(m.semestre || '').trim();
      return !ms || semsPeriodo.indexOf(ms) !== -1;
    });
  }

  if (list.length === 0) {
    var msg = sem ? 'No hay materias para el semestre '+sem+'°.' : 'No hay materias registradas.';
    return '<tr><td colspan="8" class="gen-td-empty">'+msg+'</td></tr>';
  }

  return _matViewMode === 'grouped' ? _matBuildGrouped(list) : _matBuildFlat(list);
}

// ── VISTA PLANA (flat) ───────────────────────────────────────────────

/**
 * Vista plana: "Materias generales" + sección por cada capacitación.
 * Usa SOLO el campo `componente` — sin inferencia por nombre de materia.
 */
function _matBuildFlat(list) {
  var generales = list.filter(function(m) { return !_matDetectCapFlat(m); });
  var porCap = {};
  GEN_CAPACITACIONES_.forEach(function(cap) { porCap[cap] = []; });
  list.forEach(function(m) {
    var cap = _matDetectCapFlat(m);
    if (cap) porCap[cap].push(m);
  });

  var html = '';
  if (generales.length) {
    html += _matSepGeneral('Materias generales', generales.length);
    html += generales.map(_matRow).join('');
  }
  GEN_CAPACITACIONES_.forEach(function(cap) {
    var mats = porCap[cap];
    if (!mats || !mats.length) return;
    html += _matSepCap(cap, mats.length);
    html += mats.map(_matRow).join('');
  });
  return html;
}

// ── VISTA AGRUPADA (grouped) ─────────────────────────────────────────

/**
 * Vista agrupada por componente curricular con reglas inteligentes por semestre.
 * Usa _matDetectCapGrouped: respeta restricciones de 1°/2°, aplica reglas
 * controladas para 3° y 5°, y no infiere en el resto.
 */
function _matBuildGrouped(list) {
  var compGrupos = {};  // componente → [materias]
  var compOrder  = [];
  var capGrupos  = {};
  GEN_CAPACITACIONES_.forEach(function(cap) { capGrupos[cap] = []; });

  list.forEach(function(m) {
    var cap = _matDetectCapGrouped(m);
    if (cap) {
      capGrupos[cap].push(m);
    } else {
      var comp = (m.componente || '').trim() || 'Sin componente';
      if (!compGrupos[comp]) { compGrupos[comp] = []; compOrder.push(comp); }
      compGrupos[comp].push(m);
    }
  });

  // Ordenar componentes: "Sin componente" y "Otro" al final, resto alfabético
  compOrder.sort(function(a, b) {
    var aLast = (a === 'Sin componente' || a === 'Otro') ? 1 : 0;
    var bLast = (b === 'Sin componente' || b === 'Otro') ? 1 : 0;
    if (aLast !== bLast) return aLast - bLast;
    return a.localeCompare(b, 'es');
  });

  var html = '';

  compOrder.forEach(function(comp) {
    var mats = compGrupos[comp];
    if (!mats.length) return;
    html += _matGrpHeader(comp, mats.length);
    html += mats.map(_matRow).join('');
  });

  // Capacitaciones al final, como sub-encabezados dentro de un bloque visual propio
  var totalCap = GEN_CAPACITACIONES_.reduce(function(t, c) { return t + (capGrupos[c] || []).length; }, 0);
  if (totalCap) {
    html += _matGrpHeaderCap(totalCap);
    GEN_CAPACITACIONES_.forEach(function(cap) {
      var mats = capGrupos[cap];
      if (!mats.length) return;
      html += _matSepCap(cap, mats.length);
      html += mats.map(_matRow).join('');
    });
  }

  return html;
}

// ── FILAS SEPARADORAS ────────────────────────────────────────────────

function _matSepGeneral(label, count) {
  return '<tr class="gen-mat-sep" data-sep="general">' +
    '<td colspan="8"><span class="gen-mat-sep-label">'+genEsc(label)+
    ' <em style="font-weight:400;opacity:.65">('+count+')</em></span></td></tr>';
}

function _matSepCap(cap, count) {
  var s = _GEN_CAP_STYLE_[cap] || {};
  return '<tr class="gen-mat-sep gen-mat-sep-cap" data-sep="'+genEsc(cap)+'">' +
    '<td colspan="8"><span class="gen-mat-sep-label" style="border-color:'+genEsc(s.border||'#94a3b8')+
    ';color:'+genEsc(s.text||'#64748b')+'">Capacitación: '+genEsc(cap)+
    ' <em style="font-weight:400;opacity:.65">('+count+')</em></span></td></tr>';
}

function _matGrpHeader(comp, count) {
  return '<tr class="gen-mat-sep gen-mat-grp-head" data-sep="'+genEsc(comp)+'">' +
    '<td colspan="8">' +
    '<span class="gen-mat-grp-label">'+genEsc(comp)+'</span>' +
    '<span class="gen-mat-grp-count">'+count+'</span>' +
    '</td></tr>';
}

function _matGrpHeaderCap(totalCap) {
  return '<tr class="gen-mat-sep gen-mat-grp-head gen-mat-grp-head--cap" data-sep="capacitaciones">' +
    '<td colspan="8">' +
    '<span class="gen-mat-grp-label">Capacitaciones</span>' +
    '<span class="gen-mat-grp-count gen-mat-grp-count--cap">'+totalCap+'</span>' +
    '</td></tr>';
}

// ── FILA DE MATERIA ──────────────────────────────────────────────────

function _matRow(m) {
  var activo = String(m.activo) !== 'false';
  var badge  = activo
    ? '<span class="gen-badge gen-badge-ok">Activa</span>'
    : '<span class="gen-badge gen-badge-gray">Inactiva</span>';
  var color = genGetMateriaColor(m.id);
  var sem   = m.semestre ? String(m.semestre).trim() : '';
  var cap   = _matCapForRow(m);   // usa la función correcta según modo de vista
  var s     = cap ? _GEN_CAP_STYLE_[cap] : null;

  var compHtml = cap && s
    ? '<span class="gen-mat-cap-badge" style="background:'+s.bg+';color:'+s.text+';border-color:'+s.border+'">'+genEsc(cap)+'</span>'
    : genEsc(m.componente || '—');

  var rowClass = cap ? ' class="gen-mat-cap-row"' : '';
  var rowStyle = cap && s ? ' style="border-left:3px solid '+s.border+'"' : '';

  return '<tr data-id="'+genEsc(m.id)+'" data-nombre="'+genEsc((m.nombre||'').toLowerCase())+
    '" data-semestre="'+genEsc(sem)+'" data-cap="'+genEsc(cap||'')+'"'+rowClass+rowStyle+'>' +
    '<td><span class="gen-color-dot" style="background:'+color+'"></span></td>' +
    '<td><span class="gen-mono">'+genEsc(m.clave||'—')+'</span></td>' +
    '<td><strong>'+genEsc(m.nombre||'—')+'</strong></td>' +
    '<td>'+_matSemestreBadge(sem)+'</td>' +
    '<td>'+compHtml+'</td>' +
    '<td>'+genEsc(m.hrs_semana||'—')+'</td>' +
    '<td>'+badge+'</td>' +
    '<td class="gen-td-actions">' +
      '<button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genMatEditar(\''+genEsc(m.id)+'\')">'+
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
      '</button>' +
      '<button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genMatEliminar(\''+genEsc(m.id)+'\')">'+
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'+
      '</button>' +
    '</td></tr>';
}

// ── EVENTOS ──────────────────────────────────────────────────────────

function _matBind() {
  document.getElementById('gen-mat-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genMatForm(null); });
  });

  document.getElementById('gen-mat-search').addEventListener('input', _matFiltrar);

  // Tabs de semestre
  document.querySelectorAll('.gen-mat-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.gen-mat-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _matCurrentSem = btn.dataset.sem;
      _matRefreshTbody();
    });
  });

  // Toggle de vista
  var btnFlat    = document.getElementById('gen-mat-vflat');
  var btnGrouped = document.getElementById('gen-mat-vgrouped');
  if (btnFlat) btnFlat.addEventListener('click', function() {
    if (_matViewMode === 'flat') return;
    _matViewMode = 'flat';
    btnFlat.classList.add('active');
    btnGrouped.classList.remove('active');
    _matRefreshTbody();
  });
  if (btnGrouped) btnGrouped.addEventListener('click', function() {
    if (_matViewMode === 'grouped') return;
    _matViewMode = 'grouped';
    btnGrouped.classList.add('active');
    btnFlat.classList.remove('active');
    _matRefreshTbody();
  });
}

function _matRefreshTbody() {
  var tbody = document.getElementById('gen-mat-tbody');
  if (tbody) {
    tbody.innerHTML = _matBuildTbody(_genApp.materias, _matCurrentSem);
    _matFiltrar();
  }
}

function _matFiltrar() {
  var q = (document.getElementById('gen-mat-search').value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Mostrar/ocultar filas de materia
  document.querySelectorAll('#gen-mat-tbody tr[data-id]').forEach(function(tr) {
    var nom = tr.dataset.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    tr.style.display = (!q || nom.includes(q)) ? '' : 'none';
  });

  // Ocultar separadores si todos sus items están ocultos
  document.querySelectorAll('#gen-mat-tbody tr.gen-mat-sep').forEach(function(sep) {
    var hayVisible = false;
    var next = sep.nextElementSibling;
    while (next && !next.classList.contains('gen-mat-sep')) {
      if (next.dataset.id && next.style.display !== 'none') { hayVisible = true; break; }
      next = next.nextElementSibling;
    }
    sep.style.display = hayVisible ? '' : 'none';
  });
}

// ── FORMULARIO ───────────────────────────────────────────────────────

function genMatForm(id) {
  var m = id ? genById(_genApp.materias, id) : {};
  if (!m) { genToast('Materia no encontrada.', 'error'); return; }
  var isNew = !id;
  _genModal.open(
    isNew ? 'Nueva materia' : 'Editar materia',
    `<div class="gen-form-grid-2">
      <div class="gen-form-group">
        <label class="gen-label">Clave *</label>
        <input type="text" id="gm-clave" class="gen-input gen-input-mono" value="${genEsc(m.clave||'')}" placeholder="MAT001" maxlength="20">
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Nombre completo *</label>
        <input type="text" id="gm-nombre" class="gen-input" value="${genEsc(m.nombre||'')}" placeholder="Nombre de la materia o UAC">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Semestre</label>
        <select id="gm-sem" class="gen-select">
          <option value="" ${!m.semestre?'selected':''}>General / sin semestre</option>
          ${_MAT_SEMESTRES_.map(function(s){
            return '<option value="'+s+'" '+(String(m.semestre)===s?'selected':'')+'>Semestre '+s+'°</option>';
          }).join('')}
        </select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Componente curricular</label>
        <select id="gm-comp" class="gen-select">
          <option value="">-- Selecciona --</option>
          ${_MAT_COMPONENTES_.map(function(c){
            return '<option value="'+c+'" '+(m.componente===c?'selected':'')+'>'+c+'</option>';
          }).join('')}
        </select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Horas semanales</label>
        <input type="number" id="gm-hrs" class="gen-input" value="${genEsc(m.hrs_semana||'3')}" min="1" max="20">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Estado</label>
        <select id="gm-activo" class="gen-select">
          <option value="true" ${String(m.activo)!=='false'?'selected':''}>Activa</option>
          <option value="false" ${String(m.activo)==='false'?'selected':''}>Inactiva</option>
        </select>
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="gm-save">Guardar</button>`
  );
  document.getElementById('gm-save').addEventListener('click', async function() {
    var record = {
      id:         id || '',
      clave:      document.getElementById('gm-clave').value.trim(),
      nombre:     document.getElementById('gm-nombre').value.trim(),
      semestre:   document.getElementById('gm-sem').value,
      componente: document.getElementById('gm-comp').value,
      hrs_semana: document.getElementById('gm-hrs').value,
      activo:     document.getElementById('gm-activo').value
    };
    if (!record.clave || !record.nombre) {
      genToast('Clave y nombre son obligatorios.', 'warning');
      return;
    }
    var btn = document.getElementById('gm-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await genAPI.saveMateria(_genApp.adminKey, record);
      _genModal.close();
      genToast('Materia guardada.', 'ok');
      _genApp.materias = await genAPI.getMaterias(true);
      genNavTo('materias');
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
      if (err.message.includes('administrador')) _genApp.adminKey = null;
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
}

async function genMatEditar(id) { genRequireAdmin(function() { genMatForm(id); }); }

async function genMatEliminar(id) {
  genRequireAdmin(function() {
    var m = genById(_genApp.materias, id);
    if (!m) return;
    genConfirm('¿Eliminar la materia "' + (m.nombre || id) + '"?', async function() {
      try {
        await genAPI.deleteMateria(_genApp.adminKey, id);
        genToast('Materia eliminada.', 'ok');
        _genApp.materias = await genAPI.getMaterias(true);
        genNavTo('materias');
      } catch(err) { genToast('Error: ' + err.message, 'error'); }
    });
  });
}
