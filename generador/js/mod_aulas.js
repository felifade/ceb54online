/* ── mod_aulas.js — Catálogo de Espacios Institucionales ─────────── */

genRegisterModule('aulas', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando espacios…</span></div>';
    try {
      var aulas = await genAPI.getAulas(true);
      _genApp.aulas = aulas;
      container.innerHTML = _aulaHTML(aulas);
      _aulaBind();
    } catch(err) {
      genShowError('No se pudo cargar el catálogo: ' + err.message);
    }
  }
});

var _AULA_TIPOS_ = [
  'Aula regular', 'Laboratorio de Ciencias', 'Laboratorio de Cómputo',
  'Laboratorio de Física', 'Laboratorio de Química', 'Laboratorio de Biología',
  'Taller', 'Sala audiovisual', 'Biblioteca', 'Cancha deportiva',
  'Patio', 'Auditorio', 'Salón de usos múltiples', 'Otro'
];

var _AULA_TIPO_ICON_ = {
  'Aula regular':           '🏫',
  'Laboratorio de Ciencias':'🔬',
  'Laboratorio de Cómputo': '💻',
  'Laboratorio de Física':  '⚗️',
  'Laboratorio de Química': '🧪',
  'Laboratorio de Biología':'🧫',
  'Taller':                 '🔧',
  'Sala audiovisual':       '📽️',
  'Biblioteca':             '📚',
  'Cancha deportiva':       '🏃',
  'Patio':                  '🌳',
  'Auditorio':              '🎭',
  'Salón de usos múltiples':'🏛️',
  'Otro':                   '📌'
};

function _aulaTipoIcon(tipo) {
  return _AULA_TIPO_ICON_[tipo] || '📌';
}

function _aulaHTML(aulas) {
  var activos   = aulas.filter(function(a) { return String(a.activo) !== 'false'; });
  var inactivos = aulas.filter(function(a) { return String(a.activo) === 'false'; });

  // Agrupar por tipo para el resumen
  var porTipo = {};
  activos.forEach(function(a) {
    var t = a.tipo || 'Sin tipo';
    porTipo[t] = (porTipo[t] || 0) + 1;
  });
  var resumenTipos = Object.keys(porTipo).map(function(t) {
    return '<span class="gen-badge gen-badge-blue" style="margin-right:4px">' +
      _aulaTipoIcon(t) + ' ' + genEsc(t) + ': ' + porTipo[t] + '</span>';
  }).join('');

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Espacios</h1>
    <p class="gen-page-sub">${activos.length} espacios activos${inactivos.length ? ' · ' + inactivos.length + ' inactivos' : ''}</p>
    ${resumenTipos ? '<div style="margin-top:8px">' + resumenTipos + '</div>' : ''}
  </div>
  <div class="gen-header-actions">
    <select id="gen-aula-filtro-tipo" class="gen-select" style="min-width:160px">
      <option value="">Todos los tipos</option>
      ${_AULA_TIPOS_.map(function(t){ return '<option value="'+genEsc(t)+'">'+_aulaTipoIcon(t)+' '+genEsc(t)+'</option>'; }).join('')}
    </select>
    <input type="text" id="gen-aula-search" class="gen-search-input" placeholder="Buscar espacio…">
    <button class="gen-btn gen-btn-primary" id="gen-aula-nuevo">+ Nuevo espacio</button>
  </div>
</div>

<div class="gen-table-wrapper">
  <table class="gen-table">
    <thead>
      <tr>
        <th>Clave</th>
        <th>Nombre / Identificador</th>
        <th>Tipo</th>
        <th>Capacidad</th>
        <th>Ubicación</th>
        <th>Disponible</th>
        <th>Estado</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-aula-tbody">
      ${aulas.length === 0
        ? '<tr><td colspan="8" class="gen-td-empty">No hay espacios registrados. Agrega el primero.</td></tr>'
        : aulas.map(_aulaRow).join('')}
    </tbody>
  </table>
</div>`;
}

function _aulaRow(a) {
  var activo = String(a.activo) !== 'false';
  var dispOk = String(a.disponible) !== 'false' && String(a.disponible) !== 'NO';
  var badgeActivo = activo
    ? '<span class="gen-badge gen-badge-ok">Activo</span>'
    : '<span class="gen-badge gen-badge-gray">Inactivo</span>';
  var badgeDisp = dispOk
    ? '<span class="gen-badge gen-badge-ok">Sí</span>'
    : '<span class="gen-badge gen-badge-gray">No</span>';
  return `<tr data-id="${genEsc(a.id)}" data-nombre="${genEsc(a.nombre||'').toLowerCase()}" data-tipo="${genEsc(a.tipo||'')}">
    <td><span class="gen-mono">${genEsc(a.clave||'—')}</span></td>
    <td><strong>${genEsc(a.nombre||'—')}</strong>${a.observaciones ? '<br><span class="gen-hint">'+genEsc(a.observaciones)+'</span>' : ''}</td>
    <td><span class="gen-aula-tipo-badge">${_aulaTipoIcon(a.tipo)} ${genEsc(a.tipo||'—')}</span></td>
    <td>${genEsc(a.capacidad||'—')}</td>
    <td>${genEsc(a.ubicacion||'—')}</td>
    <td>${badgeDisp}</td>
    <td>${badgeActivo}</td>
    <td class="gen-td-actions">
      <button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genAulaEditar('${genEsc(a.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genAulaEliminar('${genEsc(a.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </td>
  </tr>`;
}

function _aulaBind() {
  document.getElementById('gen-aula-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genAulaForm(null); });
  });

  document.getElementById('gen-aula-search').addEventListener('input', function() {
    _aulaFiltrar();
  });

  document.getElementById('gen-aula-filtro-tipo').addEventListener('change', function() {
    _aulaFiltrar();
  });
}

function _aulaFiltrar() {
  var q    = (document.getElementById('gen-aula-search').value || '').toLowerCase();
  var tipo = document.getElementById('gen-aula-filtro-tipo').value;
  document.querySelectorAll('#gen-aula-tbody tr[data-id]').forEach(function(tr) {
    var matchQ    = !q    || tr.dataset.nombre.includes(q);
    var matchTipo = !tipo || tr.dataset.tipo === tipo;
    tr.style.display = (matchQ && matchTipo) ? '' : 'none';
  });
}

function genAulaForm(id) {
  var a = id ? genById(_genApp.aulas, id) : {};
  if (!a) { genToast('Espacio no encontrado.', 'error'); return; }
  var isNew = !id;

  _genModal.open(
    isNew ? 'Nuevo espacio institucional' : 'Editar espacio',
    `<div class="gen-form-grid-2">
      <div class="gen-form-group">
        <label class="gen-label">Clave / Código *</label>
        <input type="text" id="ga-clave" class="gen-input gen-input-mono" value="${genEsc(a.clave||'')}" placeholder="A01, LAB-FIS…" maxlength="15">
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Nombre completo *</label>
        <input type="text" id="ga-nombre" class="gen-input" value="${genEsc(a.nombre||'')}" placeholder="Aula 01, Laboratorio de Física…">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Tipo de espacio</label>
        <select id="ga-tipo" class="gen-select">
          ${_AULA_TIPOS_.map(function(t){
            return '<option value="'+t+'" '+(a.tipo===t?'selected':'')+'>'+_aulaTipoIcon(t)+' '+t+'</option>';
          }).join('')}
        </select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Capacidad (alumnos)</label>
        <input type="number" id="ga-cap" class="gen-input" value="${genEsc(a.capacidad||'35')}" min="1" max="500">
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Ubicación / Edificio</label>
        <input type="text" id="ga-ubic" class="gen-input" value="${genEsc(a.ubicacion||'')}" placeholder="Planta baja, Edificio A…">
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Observaciones</label>
        <input type="text" id="ga-obs" class="gen-input" value="${genEsc(a.observaciones||'')}" placeholder="Proyector, AC, requiere reserva previa…">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Disponible para horarios</label>
        <select id="ga-disp" class="gen-select">
          <option value="SI" ${String(a.disponible)!=='NO'&&String(a.disponible)!=='false'?'selected':''}>Sí</option>
          <option value="NO" ${String(a.disponible)==='NO'||String(a.disponible)==='false'?'selected':''}>No</option>
        </select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Estado del registro</label>
        <select id="ga-activo" class="gen-select">
          <option value="true" ${String(a.activo)!=='false'?'selected':''}>Activo</option>
          <option value="false" ${String(a.activo)==='false'?'selected':''}>Inactivo</option>
        </select>
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="ga-save">Guardar</button>`
  );

  document.getElementById('ga-save').addEventListener('click', async function() {
    var record = {
      id:           id || '',
      clave:        document.getElementById('ga-clave').value.trim(),
      nombre:       document.getElementById('ga-nombre').value.trim(),
      tipo:         document.getElementById('ga-tipo').value,
      capacidad:    document.getElementById('ga-cap').value,
      ubicacion:    document.getElementById('ga-ubic').value.trim(),
      observaciones:document.getElementById('ga-obs').value.trim(),
      disponible:   document.getElementById('ga-disp').value,
      activo:       document.getElementById('ga-activo').value
    };
    if (!record.clave || !record.nombre) {
      genToast('Clave y nombre son obligatorios.', 'warning');
      return;
    }
    var btn = document.getElementById('ga-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await genAPI.saveAula(_genApp.adminKey, record);
      _genModal.close();
      genToast('Espacio guardado.', 'ok');
      _genApp.aulas = await genAPI.getAulas(true);
      genNavTo('aulas');
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
      if (err.message.includes('administrador')) _genApp.adminKey = null;
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
}

async function genAulaEditar(id) { genRequireAdmin(function() { genAulaForm(id); }); }

async function genAulaEliminar(id) {
  genRequireAdmin(function() {
    var a = genById(_genApp.aulas, id);
    if (!a) return;
    genConfirm('¿Eliminar el espacio "' + (a.nombre || id) + '"?', async function() {
      try {
        await genAPI.deleteAula(_genApp.adminKey, id);
        genToast('Espacio eliminado.', 'ok');
        _genApp.aulas = await genAPI.getAulas(true);
        genNavTo('aulas');
      } catch(err) { genToast('Error: ' + err.message, 'error'); }
    });
  });
}
