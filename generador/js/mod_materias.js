/* ── mod_materias.js — Catálogo de Materias / UAC ───────────────── */

genRegisterModule('materias', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando materias…</span></div>';
    try {
      var materias = await genAPI.getMaterias(true);
      _genApp.materias = materias;
      // Pre-asignar colores
      materias.forEach(function(m) { if (m.id) genGetMateriaColor(m.id); });
      container.innerHTML = _matHTML(materias);
      _matBind();
    } catch(err) {
      genShowError('No se pudo cargar el catálogo: ' + err.message);
    }
  }
});

var _MAT_COMPONENTES_ = [
  'Matemáticas', 'Comunicación', 'Ciencias Naturales', 'Ciencias Sociales',
  'Tecnología', 'Expresiones', 'Lengua Extranjera', 'Educación Física',
  'Fortalecimiento', 'Orientación', 'Tutoría', 'Otro'
];

function _matHTML(materias) {
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Materias / UAC</h1>
    <p class="gen-page-sub">${materias.length} materias registradas</p>
  </div>
  <div class="gen-header-actions">
    <input type="text" id="gen-mat-search" class="gen-search-input" placeholder="Buscar materia…">
    <button class="gen-btn gen-btn-primary" id="gen-mat-nuevo">+ Nueva materia</button>
  </div>
</div>

<div class="gen-table-wrapper">
  <table class="gen-table">
    <thead>
      <tr>
        <th style="width:32px"></th>
        <th>Clave</th>
        <th>Nombre</th>
        <th>Componente</th>
        <th>Hrs/semana</th>
        <th>Estado</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-mat-tbody">
      ${materias.length === 0
        ? '<tr><td colspan="7" class="gen-td-empty">No hay materias registradas.</td></tr>'
        : materias.map(_matRow).join('')}
    </tbody>
  </table>
</div>`;
}

function _matRow(m) {
  var activo = String(m.activo) !== 'false';
  var badge  = activo
    ? '<span class="gen-badge gen-badge-ok">Activa</span>'
    : '<span class="gen-badge gen-badge-gray">Inactiva</span>';
  var color  = genGetMateriaColor(m.id);
  return `<tr data-id="${genEsc(m.id)}" data-nombre="${genEsc(m.nombre||'').toLowerCase()}">
    <td><span class="gen-color-dot" style="background:${color}"></span></td>
    <td><span class="gen-mono">${genEsc(m.clave||'—')}</span></td>
    <td><strong>${genEsc(m.nombre||'—')}</strong></td>
    <td>${genEsc(m.componente||'—')}</td>
    <td>${genEsc(m.hrs_semana||'—')}</td>
    <td>${badge}</td>
    <td class="gen-td-actions">
      <button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genMatEditar('${genEsc(m.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genMatEliminar('${genEsc(m.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </td>
  </tr>`;
}

function _matBind() {
  document.getElementById('gen-mat-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genMatForm(null); });
  });
  document.getElementById('gen-mat-search').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    document.querySelectorAll('#gen-mat-tbody tr[data-id]').forEach(function(tr) {
      tr.style.display = (!q || tr.dataset.nombre.includes(q)) ? '' : 'none';
    });
  });
}

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
