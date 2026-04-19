/* ── mod_docentes.js — Catálogo de Docentes ─────────────────────── */

genRegisterModule('docentes', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando docentes…</span></div>';
    try {
      var docentes = await genAPI.getDocentes(true);
      _genApp.docentes = docentes;
      container.innerHTML = _docHTML(docentes);
      _docBind();
    } catch(err) {
      genShowError('No se pudo cargar el catálogo: ' + err.message);
    }
  }
});

function _docHTML(docentes) {
  var activos   = docentes.filter(function(d) { return String(d.activo) !== 'false'; });
  var inactivos = docentes.filter(function(d) { return String(d.activo) === 'false'; });
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Docentes</h1>
    <p class="gen-page-sub">${activos.length} docentes activos${inactivos.length ? ' · ' + inactivos.length + ' inactivos' : ''}</p>
  </div>
  <div class="gen-header-actions">
    <input type="text" id="gen-doc-search" class="gen-search-input" placeholder="Buscar docente…">
    <button class="gen-btn gen-btn-primary" id="gen-doc-nuevo">+ Nuevo docente</button>
  </div>
</div>

<div class="gen-table-wrapper">
  <table class="gen-table" id="gen-doc-table">
    <thead>
      <tr>
        <th>Clave</th>
        <th>Nombre completo</th>
        <th>Especialidad</th>
        <th>Hrs. máx/sem</th>
        <th>Estado</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-doc-tbody">
      ${docentes.length === 0 ? '<tr><td colspan="6" class="gen-td-empty">No hay docentes registrados. Agrega el primero con el botón "+ Nuevo docente".</td></tr>' : docentes.map(_docRow).join('')}
    </tbody>
  </table>
</div>`;
}

function _docRow(d) {
  var nombre   = genEsc(genNombreDocente(d));
  var activo   = String(d.activo) !== 'false';
  var badge    = activo
    ? '<span class="gen-badge gen-badge-ok">Activo</span>'
    : '<span class="gen-badge gen-badge-gray">Inactivo</span>';
  return `<tr data-id="${genEsc(d.id)}" data-nombre="${nombre.toLowerCase()}">
    <td><span class="gen-mono">${genEsc(d.clave || '—')}</span></td>
    <td>${nombre}</td>
    <td>${genEsc(d.especialidad || '—')}</td>
    <td>${genEsc(d.hrs_max || '—')}</td>
    <td>${badge}</td>
    <td class="gen-td-actions">
      <button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genDocEditar('${genEsc(d.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genDocEliminar('${genEsc(d.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </td>
  </tr>`;
}

function _docBind() {
  document.getElementById('gen-doc-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genDocForm(null); });
  });

  document.getElementById('gen-doc-search').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    document.querySelectorAll('#gen-doc-tbody tr[data-id]').forEach(function(tr) {
      var match = !q || tr.dataset.nombre.includes(q) ||
                  tr.querySelector('.gen-mono').textContent.toLowerCase().includes(q);
      tr.style.display = match ? '' : 'none';
    });
  });
}

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
