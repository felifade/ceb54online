/* ── mod_docentes.js — Catálogo de Docentes ─────────────────────── */

var _docViewMode     = 'list';  // 'list' | 'cards'
var _docShowInactive = false;   // los inactivos se ocultan por defecto

genRegisterModule('docentes', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando docentes…</span></div>';
    try {
      var docentes = await genAPI.getDocentes(true);
      _genApp.docentes = docentes;
      container.innerHTML = _docShell(docentes);
      _docRefresh(docentes);
      _docBind(docentes);
    } catch(err) {
      genShowError('No se pudo cargar el catálogo: ' + err.message);
    }
  }
});

/* ── Cabecera + contenedor ─────────────────────────────────────────── */
function _docShell(docentes) {
  var nAct = docentes.filter(function(d) { return String(d.activo) !== 'false'; }).length;
  var nIn  = docentes.filter(function(d) { return String(d.activo) === 'false'; }).length;
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Docentes</h1>
    <p class="gen-page-sub">${nAct} docentes activos${nIn ? ' &nbsp;·&nbsp; <span style="color:var(--gen-muted)">' + nIn + ' inactivos</span>' : ''}</p>
  </div>
  <div class="gen-header-actions">
    <div class="gen-mat-view-toggle">
      <button class="gen-mat-vtab ${_docViewMode==='list'?'active':''}" id="gen-doc-vtab-list">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Lista
      </button>
      <button class="gen-mat-vtab ${_docViewMode==='cards'?'active':''}" id="gen-doc-vtab-cards">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="9" height="9" rx="1"/><rect x="13" y="3" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>
        Tarjetas
      </button>
    </div>
    <input type="text" id="gen-doc-search" class="gen-search-input" placeholder="Buscar docente…">
    <button class="gen-btn gen-btn-primary" id="gen-doc-nuevo">+ Nuevo docente</button>
  </div>
</div>
<div id="gen-doc-content"></div>`;
}

/* ── Refresco del área de contenido ───────────────────────────────── */
function _docRefresh(docentes) {
  var all      = docentes || _genApp.docentes || [];
  var activos  = all.filter(function(d) { return String(d.activo) !== 'false'; });
  var inact    = all.filter(function(d) { return String(d.activo) === 'false'; });
  var el = document.getElementById('gen-doc-content');
  if (!el) return;
  el.innerHTML = _docViewMode === 'cards'
    ? _docBuildCards(activos, inact)
    : _docBuildList(activos, inact);
}

/* ═══════════════════════════════════════════════════════════════════
   VISTA DE TARJETAS
═══════════════════════════════════════════════════════════════════ */
function _docBuildCards(activos, inactivos) {
  if (activos.length === 0 && inactivos.length === 0) {
    return '<div class="gen-empty-state"><p>No hay docentes registrados. Agrega el primero.</p></div>';
  }

  var html = '';

  /* Grid de activos */
  if (activos.length === 0) {
    html += '<p style="color:var(--gen-muted);padding:12px 0">No hay docentes activos.</p>';
  } else {
    html += '<div class="gen-doc-grid" id="gen-doc-grid-active">' +
      activos.map(function(d) { return _docCard(d, false); }).join('') +
      '</div>';
  }

  /* Sección colapsable de inactivos */
  if (inactivos.length > 0) {
    var shown = _docShowInactive;
    html += '<div class="gen-doc-inactive-section" id="gen-doc-inactive-section">' +
      '<button class="gen-doc-inactive-toggle" id="gen-doc-inactive-btn">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="gen-doc-inactive-chevron" style="transform:rotate(' + (shown ? '90' : '0') + 'deg);transition:transform .2s"><polyline points="9 18 15 12 9 6"/></svg>' +
        '<span>' + (shown ? 'Ocultar' : 'Mostrar') + ' docentes inactivos</span>' +
        '<span class="gen-badge gen-badge-gray" style="margin-left:4px">' + inactivos.length + '</span>' +
      '</button>' +
      '<div class="gen-doc-grid gen-doc-inactive-grid" id="gen-doc-grid-inactive" style="display:' + (shown ? 'grid' : 'none') + '">' +
        inactivos.map(function(d) { return _docCard(d, true); }).join('') +
      '</div>' +
    '</div>';
  }

  return html;
}

/* Tarjeta individual */
function _docCard(d, inactive) {
  var col      = _docAvatarColor(d);
  var ini      = _docInitials(d);
  var nombre   = genNombreDocente(d);
  var esp      = String(d.especialidad || '').trim();
  var hrs      = String(d.hrs_max || '').trim();
  var searchStr = (nombre + ' ' + (d.clave||'') + ' ' + esp).toLowerCase();

  return '<div class="gen-doc-card' + (inactive ? ' gen-doc-card--inactive' : '') + '" ' +
    'data-id="' + genEsc(d.id) + '" data-search="' + genEsc(searchStr) + '">' +

    /* Header: avatar + badge */
    '<div class="gen-doc-card-header">' +
      '<div class="gen-doc-avatar" style="background:' + col.bg + ';color:' + col.text + '">' + ini + '</div>' +
      (inactive
        ? '<span class="gen-badge gen-badge-gray" style="font-size:10px;align-self:flex-start">Inactivo</span>'
        : '<span class="gen-badge gen-badge-ok" style="font-size:10px;align-self:flex-start">Activo</span>') +
    '</div>' +

    /* Body: nombre, clave, especialidad, horas */
    '<div class="gen-doc-card-body">' +
      '<div class="gen-doc-card-name">' + genEsc(nombre) + '</div>' +
      '<div class="gen-doc-card-clave gen-mono">' + genEsc(d.clave || '—') + '</div>' +
      (esp ? '<div class="gen-doc-card-esp">' + genEsc(esp) + '</div>' : '') +
      (hrs ? '<div class="gen-doc-card-hrs">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        genEsc(hrs) + ' hrs / sem' +
      '</div>' : '') +
    '</div>' +

    /* Acciones */
    '<div class="gen-doc-card-actions">' +
      '<button class="gen-btn gen-btn-sm gen-btn-secondary" onclick="genDocEditar(\'' + genEsc(d.id) + '\')">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        'Editar' +
      '</button>' +
      '<button class="gen-btn gen-btn-sm gen-btn-ghost-danger" onclick="genDocEliminar(\'' + genEsc(d.id) + '\')">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
      '</button>' +
    '</div>' +
  '</div>';
}

/* Avatar: iniciales */
function _docInitials(d) {
  var a = String(d.apellido_paterno || '').trim();
  var n = String(d.nombre || '').trim();
  return ((a.charAt(0) || '') + (n.charAt(0) || '')).toUpperCase() || '?';
}

/* Avatar: color determinista por apellido */
var _DOC_AVATAR_COLORS_ = [
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fae8ff', text: '#7e22ce' },
  { bg: '#ffedd5', text: '#9a3412' },
  { bg: '#fef9c3', text: '#854d0e' },
  { bg: '#ffe4e6', text: '#9f1239' },
  { bg: '#cffafe', text: '#155e75' },
  { bg: '#e0e7ff', text: '#3730a3' },
];
function _docAvatarColor(d) {
  var s = String(d.apellido_paterno || d.nombre || d.clave || 'X');
  var code = s.toUpperCase().charCodeAt(0) || 65;
  return _DOC_AVATAR_COLORS_[code % _DOC_AVATAR_COLORS_.length];
}

/* ═══════════════════════════════════════════════════════════════════
   VISTA DE LISTA
═══════════════════════════════════════════════════════════════════ */
function _docBuildList(activos, inactivos) {
  var sepRow = '';
  if (inactivos.length > 0) {
    var shown = _docShowInactive;
    sepRow =
      '<tr class="gen-doc-inactive-sep" id="gen-doc-inactive-sep">' +
        '<td colspan="6">' +
          '<button class="gen-doc-inactive-toggle gen-doc-inactive-toggle--row" id="gen-doc-inactive-btn">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="gen-doc-inactive-chevron" style="transform:rotate(' + (shown?'90':'0') + 'deg);transition:transform .2s"><polyline points="9 18 15 12 9 6"/></svg>' +
            '<span>' + (shown ? 'Ocultar' : 'Mostrar') + ' docentes inactivos</span>' +
            '<span class="gen-badge gen-badge-gray" style="margin-left:4px">' + inactivos.length + '</span>' +
          '</button>' +
        '</td>' +
      '</tr>' +
      inactivos.map(function(d) {
        return _docRow(d, true, !shown);
      }).join('');
  }

  var emptyRow = '<tr><td colspan="6" class="gen-td-empty">No hay docentes registrados.</td></tr>';

  return '<div class="gen-table-wrapper">' +
    '<table class="gen-table" id="gen-doc-table">' +
      '<thead><tr>' +
        '<th>Clave</th><th>Nombre completo</th><th>Especialidad</th>' +
        '<th>Hrs. máx/sem</th><th>Estado</th><th class="gen-th-actions">Acciones</th>' +
      '</tr></thead>' +
      '<tbody id="gen-doc-tbody">' +
        (activos.length === 0 && inactivos.length === 0
          ? emptyRow
          : activos.map(function(d) { return _docRow(d, false, false); }).join('') + sepRow) +
      '</tbody>' +
    '</table>' +
  '</div>';
}

function _docRow(d, inactive, hidden) {
  var nombre  = genEsc(genNombreDocente(d));
  var badge   = inactive
    ? '<span class="gen-badge gen-badge-gray">Inactivo</span>'
    : '<span class="gen-badge gen-badge-ok">Activo</span>';
  var searchStr = (genNombreDocente(d) + ' ' + (d.clave||'') + ' ' + (d.especialidad||'')).toLowerCase();
  var style   = hidden ? ' style="display:none"' : '';
  var cls     = inactive ? ' class="gen-doc-inactive-row"' : '';
  return '<tr data-id="' + genEsc(d.id) + '" data-search="' + genEsc(searchStr) + '"' + cls + style + '>' +
    '<td><span class="gen-mono">' + genEsc(d.clave || '—') + '</span></td>' +
    '<td>' + nombre + '</td>' +
    '<td>' + genEsc(d.especialidad || '—') + '</td>' +
    '<td>' + genEsc(d.hrs_max || '—') + '</td>' +
    '<td>' + badge + '</td>' +
    '<td class="gen-td-actions">' +
      '<button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genDocEditar(\'' + genEsc(d.id) + '\')">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      '</button>' +
      '<button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genDocEliminar(\'' + genEsc(d.id) + '\')">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
      '</button>' +
    '</td>' +
  '</tr>';
}

/* ═══════════════════════════════════════════════════════════════════
   EVENT BINDINGS
═══════════════════════════════════════════════════════════════════ */
function _docBind(docentes) {
  /* Toggle de vista */
  document.getElementById('gen-doc-vtab-list').addEventListener('click', function() {
    if (_docViewMode === 'list') return;
    _docViewMode = 'list';
    document.getElementById('gen-doc-vtab-list').classList.add('active');
    document.getElementById('gen-doc-vtab-cards').classList.remove('active');
    _docRefresh(docentes);
    _docWireInactiveBtn(docentes);
    var q = document.getElementById('gen-doc-search').value;
    if (q) _docApplySearch(q);
  });
  document.getElementById('gen-doc-vtab-cards').addEventListener('click', function() {
    if (_docViewMode === 'cards') return;
    _docViewMode = 'cards';
    document.getElementById('gen-doc-vtab-cards').classList.add('active');
    document.getElementById('gen-doc-vtab-list').classList.remove('active');
    _docRefresh(docentes);
    _docWireInactiveBtn(docentes);
    var q = document.getElementById('gen-doc-search').value;
    if (q) _docApplySearch(q);
  });

  /* Búsqueda */
  document.getElementById('gen-doc-search').addEventListener('input', function() {
    _docApplySearch(this.value);
  });

  /* Nuevo docente */
  document.getElementById('gen-doc-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genDocForm(null); });
  });

  /* Botón de inactivos (se conecta después de renderizar) */
  _docWireInactiveBtn(docentes);
}

function _docWireInactiveBtn(docentes) {
  var btn = document.getElementById('gen-doc-inactive-btn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    _docShowInactive = !_docShowInactive;
    /* Actualizar texto + chevron */
    var chevron = document.getElementById('gen-doc-inactive-chevron');
    var label   = btn.querySelector('span');
    if (chevron) chevron.style.transform = _docShowInactive ? 'rotate(90deg)' : 'rotate(0deg)';
    if (label)   label.textContent = _docShowInactive ? 'Ocultar docentes inactivos' : 'Mostrar docentes inactivos';

    if (_docViewMode === 'cards') {
      var grid = document.getElementById('gen-doc-grid-inactive');
      if (grid) grid.style.display = _docShowInactive ? 'grid' : 'none';
    } else {
      document.querySelectorAll('.gen-doc-inactive-row').forEach(function(tr) {
        tr.style.display = _docShowInactive ? '' : 'none';
      });
    }
  });
}

/* Búsqueda — funciona en ambas vistas */
function _docApplySearch(q) {
  var qn = q.trim().toLowerCase();
  if (_docViewMode === 'cards') {
    document.querySelectorAll('.gen-doc-card[data-id]').forEach(function(card) {
      var match = !qn || card.dataset.search.includes(qn);
      card.style.display = match ? '' : 'none';
    });
    /* Ocultar sección de inactivos si ninguna tarjeta coincide */
    var sec = document.getElementById('gen-doc-inactive-section');
    if (sec) {
      var any = Array.from(sec.querySelectorAll('.gen-doc-card[data-id]')).some(function(c) {
        return c.style.display !== 'none';
      });
      sec.style.display = (qn && !any) ? 'none' : '';
    }
  } else {
    document.querySelectorAll('#gen-doc-tbody tr[data-id]').forEach(function(tr) {
      var match = !qn || tr.dataset.search.includes(qn);
      tr.style.display = match ? '' : 'none';
    });
    var sep = document.getElementById('gen-doc-inactive-sep');
    if (sep) sep.style.display = '';
  }
}

/* ═══════════════════════════════════════════════════════════════════
   FORMULARIO
═══════════════════════════════════════════════════════════════════ */
function genDocForm(id) {
  var d = id ? genById(_genApp.docentes, id) : {};
  if (!d) { genToast('Docente no encontrado.', 'error'); return; }
  var isNew = !id;
  _genModal.open(
    isNew ? 'Nuevo docente' : 'Editar docente',
    `<div class="gen-form-grid-2">
      <div class="gen-form-group">
        <label class="gen-label">Clave *</label>
        <input type="text" id="gd-clave" class="gen-input gen-input-mono" value="${genEsc(d.clave||'')}" placeholder="DOCXXXX" maxlength="10">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Nombre(s) *</label>
        <input type="text" id="gd-nombre" class="gen-input" value="${genEsc(d.nombre||'')}" placeholder="Nombre">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Apellido paterno *</label>
        <input type="text" id="gd-ap" class="gen-input" value="${genEsc(d.apellido_paterno||'')}" placeholder="Apellido paterno">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Apellido materno</label>
        <input type="text" id="gd-am" class="gen-input" value="${genEsc(d.apellido_materno||'')}" placeholder="Apellido materno">
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Especialidad / UAC</label>
        <input type="text" id="gd-esp" class="gen-input" value="${genEsc(d.especialidad||'')}" placeholder="Ej. Matemáticas, Tecnologías…">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Horas máx. por semana</label>
        <input type="number" id="gd-hrs" class="gen-input" value="${genEsc(d.hrs_max||'20')}" min="1" max="50">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Estado</label>
        <select id="gd-activo" class="gen-select">
          <option value="true" ${String(d.activo) !== 'false' ? 'selected' : ''}>Activo</option>
          <option value="false" ${String(d.activo) === 'false' ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="gd-save">Guardar</button>`
  );
  document.getElementById('gd-save').addEventListener('click', async function() {
    var record = {
      id:               id || '',
      clave:            document.getElementById('gd-clave').value.trim(),
      nombre:           document.getElementById('gd-nombre').value.trim(),
      apellido_paterno: document.getElementById('gd-ap').value.trim(),
      apellido_materno: document.getElementById('gd-am').value.trim(),
      especialidad:     document.getElementById('gd-esp').value.trim(),
      hrs_max:          document.getElementById('gd-hrs').value,
      activo:           document.getElementById('gd-activo').value
    };
    if (!record.clave || !record.nombre || !record.apellido_paterno) {
      genToast('Clave, nombre y apellido paterno son obligatorios.', 'warning');
      return;
    }
    var btn = document.getElementById('gd-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await genAPI.saveDocente(_genApp.adminKey, record);
      _genModal.close();
      genToast('Docente guardado correctamente.', 'ok');
      _genApp.docentes = await genAPI.getDocentes(true);
      genNavTo('docentes');
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
      if (err.message.includes('administrador')) _genApp.adminKey = null;
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
}

async function genDocEditar(id) {
  genRequireAdmin(function() { genDocForm(id); });
}

async function genDocEliminar(id) {
  genRequireAdmin(function() {
    var d = genById(_genApp.docentes, id);
    if (!d) return;
    genConfirm('¿Eliminar a ' + genNombreDocente(d) + '? Esta acción no se puede deshacer.', async function() {
      try {
        await genAPI.deleteDocente(_genApp.adminKey, id);
        genToast('Docente eliminado.', 'ok');
        _genApp.docentes = await genAPI.getDocentes(true);
        genNavTo('docentes');
      } catch(err) {
        genToast('Error: ' + err.message, 'error');
        if (err.message.includes('administrador')) _genApp.adminKey = null;
      }
    });
  });
}
