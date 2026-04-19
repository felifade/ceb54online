/* ── mod_materias.js — Catálogo de Materias / UAC ───────────────── */

genRegisterModule('materias', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando materias…</span></div>';
    try {
      var materias = await genAPI.getMaterias(true);
      _genApp.materias = materias;
      // Pre-asignar colores
      materias.forEach(function(m) { if (m.id) genGetMateriaColor(m.id); });
      _matCurrentSem = '';
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

// Tab activo (semestre vacío = Todas)
var _matCurrentSem = '';

// ── SEMESTRE BADGE ──────────────────────────────────────────────────

function _matSemestreBadge(sem) {
  if (!sem || sem === '') return '<span class="gen-badge gen-badge-gray" style="font-size:10px">General</span>';
  return '<span class="gen-badge gen-badge-blue" style="font-size:10px">'+genEsc(sem)+'°</span>';
}

// ── HTML PRINCIPAL ──────────────────────────────────────────────────

function _matHTML(materias) {
  // Determinar qué semestres mostrar según el periodo activo
  var semsPeriodo = genGetSemestresPeriodo();
  var semsVisibles = semsPeriodo ? semsPeriodo : _MAT_SEMESTRES_;

  // Si el tab actual no es válido para el periodo, resetear a ''
  if (_matCurrentSem && semsPeriodo && semsPeriodo.indexOf(_matCurrentSem) === -1) {
    _matCurrentSem = '';
  }

  var tabs = [''].concat(semsVisibles).map(function(s) {
    var label = s ? s+'°' : 'Todas';
    var active = s === _matCurrentSem ? ' active' : '';
    return '<button class="gen-mat-tab'+active+'" data-sem="'+s+'">'+label+'</button>';
  }).join('');

  var periodoInfo = _genApp.periodo
    ? '<span class="gen-periodo-badge gen-periodo-badge-'+_genApp.periodo+'">Periodo '+_genApp.periodo+' · Sems '+semsVisibles.join(', ')+'°</span>'
    : '';

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Materias / UAC</h1>
    <p class="gen-page-sub">${materias.length} materias registradas${periodoInfo ? ' &nbsp;' + periodoInfo : ''}</p>
  </div>
  <div class="gen-header-actions">
    <input type="text" id="gen-mat-search" class="gen-search-input" placeholder="Buscar materia…">
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

// ── CONSTRUCCIÓN AGRUPADA DEL TBODY ─────────────────────────────────

/**
 * Genera el HTML del tbody agrupando las materias:
 *   1. Materias generales (componente no es capacitación)
 *   2. Por cada capacitación reconocida, su propio bloque
 * Si `sem` está definido, filtra solo ese semestre primero.
 */
function _matBuildTbody(materias, sem) {
  var list = (materias || []);
  // Filtrar por periodo activo cuando se muestra "Todas"
  var semsPeriodo = genGetSemestresPeriodo();
  if (sem) {
    // Tab específico: solo ese semestre
    list = list.filter(function(m) { return String(m.semestre||'') === sem; });
  } else if (semsPeriodo) {
    // Tab "Todas" con periodo activo: mostrar sems del periodo + materias sin semestre (generales)
    list = list.filter(function(m) {
      var ms = String(m.semestre || '').trim();
      return !ms || semsPeriodo.indexOf(ms) !== -1;
    });
  }

  if (list.length === 0) {
    var msg = sem ? 'No hay materias para el semestre '+sem+'°.' : 'No hay materias registradas.';
    return '<tr><td colspan="8" class="gen-td-empty">'+msg+'</td></tr>';
  }

  // Separar en grupos
  var generales = list.filter(function(m) { return !genGetCap(m.componente); });
  var porCap = {};
  GEN_CAPACITACIONES_.forEach(function(cap) { porCap[cap] = []; });
  list.forEach(function(m) {
    var cap = genGetCap(m.componente);
    if (cap) porCap[cap].push(m);
  });

  var html = '';

  // 1. Generales
  if (generales.length) {
    html += '<tr class="gen-mat-sep" data-sep="general">' +
            '<td colspan="8"><span class="gen-mat-sep-label">Materias generales</span></td></tr>';
    html += generales.map(_matRow).join('');
  }

  // 2. Por capacitación
  GEN_CAPACITACIONES_.forEach(function(cap) {
    var mats = porCap[cap];
    if (!mats || !mats.length) return;
    var s = _GEN_CAP_STYLE_[cap] || {};
    html += '<tr class="gen-mat-sep gen-mat-sep-cap" data-sep="'+genEsc(cap)+'">' +
            '<td colspan="8"><span class="gen-mat-sep-label" style="border-color:'+s.border+';color:'+s.text+'">'+
            'Capacitación: '+genEsc(cap)+'</span></td></tr>';
    html += mats.map(_matRow).join('');
  });

  return html;
}

// ── FILA DE MATERIA ──────────────────────────────────────────────────

function _matRow(m) {
  var activo = String(m.activo) !== 'false';
  var badge  = activo
    ? '<span class="gen-badge gen-badge-ok">Activa</span>'
    : '<span class="gen-badge gen-badge-gray">Inactiva</span>';
  var color  = genGetMateriaColor(m.id);
  var sem    = m.semestre ? String(m.semestre).trim() : '';
  var cap    = genGetCap(m.componente);
  var s      = cap ? _GEN_CAP_STYLE_[cap] : null;

  // Columna componente/capacitación
  var compHtml;
  if (cap && s) {
    compHtml = '<span class="gen-mat-cap-badge" style="background:'+s.bg+';color:'+s.text+';border-color:'+s.border+'">'+
               genEsc(cap)+'</span>';
  } else {
    compHtml = genEsc(m.componente || '—');
  }

  var rowClass = cap ? ' class="gen-mat-cap-row"' : '';
  var rowStyle = cap && s ? ' style="border-left:3px solid '+s.border+'"' : '';

  return '<tr data-id="'+genEsc(m.id)+'" data-nombre="'+genEsc(m.nombre||'').toLowerCase()+
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

// ── EVENTOS ─────────────────────────────────────────────────────────

function _matBind() {
  document.getElementById('gen-mat-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genMatForm(null); });
  });

  document.getElementById('gen-mat-search').addEventListener('input', _matFiltrar);

  document.querySelectorAll('.gen-mat-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.gen-mat-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _matCurrentSem = btn.dataset.sem;
      var tbody = document.getElementById('gen-mat-tbody');
      if (tbody) {
        tbody.innerHTML = _matBuildTbody(_genApp.materias, _matCurrentSem);
        _matFiltrar(); // re-aplicar búsqueda activa
      }
    });
  });
}

function _matFiltrar() {
  var q = (document.getElementById('gen-mat-search').value || '').toLowerCase();

  // Mostrar/ocultar filas de materia
  document.querySelectorAll('#gen-mat-tbody tr[data-id]').forEach(function(tr) {
    tr.style.display = (!q || tr.dataset.nombre.includes(q)) ? '' : 'none';
  });

  // Mostrar/ocultar separadores: ocultar si todos sus items están ocultos
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
