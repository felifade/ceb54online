/* ── mod_aulas.js — Catálogo de Aulas / Espacios ───────────────── */

genRegisterModule('aulas', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando aulas…</span></div>';
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

var _AULA_TIPOS_ = ['Aula regular', 'Laboratorio', 'Taller', 'Sala de cómputo', 'Cancha', 'Patio', 'Auditorio', 'Biblioteca', 'Otro'];

function _aulaHTML(aulas) {
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Aulas</h1>
    <p class="gen-page-sub">${aulas.length} espacios registrados</p>
  </div>
  <div class="gen-header-actions">
    <input type="text" id="gen-aula-search" class="gen-search-input" placeholder="Buscar aula…">
    <button class="gen-btn gen-btn-primary" id="gen-aula-nuevo">+ Nueva aula</button>
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
        <th>Estado</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-aula-tbody">
      ${aulas.length === 0
        ? '<tr><td colspan="6" class="gen-td-empty">No hay aulas registradas.</td></tr>'
        : aulas.map(_aulaRow).join('')}
    </tbody>
  </table>
</div>`;
}

function _aulaRow(a) {
  var activo = String(a.activo) !== 'false';
  var badge  = activo
    ? '<span class="gen-badge gen-badge-ok">Activa</span>'
    : '<span class="gen-badge gen-badge-gray">Inactiva</span>';
  return `<tr data-id="${genEsc(a.id)}" data-nombre="${genEsc(a.nombre||'').toLowerCase()}">
    <td><span class="gen-mono">${genEsc(a.clave||'—')}</span></td>
    <td><strong>${genEsc(a.nombre||'—')}</strong></td>
    <td><span class="gen-badge gen-badge-blue">${genEsc(a.tipo||'—')}</span></td>
    <td>${genEsc(a.capacidad||'—')}</td>
    <td>${badge}</td>
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
    var q = this.value.toLowerCase();
    document.querySelectorAll('#gen-aula-tbody tr[data-id]').forEach(function(tr) {
      tr.style.display = (!q || tr.dataset.nombre.includes(q)) ? '' : 'none';
    });
  });
}

function genAulaForm(id) {
  var a = id ? genById(_genApp.aulas, id) : {};
  if (!a) { genToast('Aula no encontrada.', 'error'); return; }
  var isNew = !id;
  _genModal.open(
    isNew ? 'Nueva aula' : 'Editar aula',
    `<div class="gen-form-grid-2">
      <div class="gen-form-group">
        <label class="gen-label">Clave *</label>
        <input type="text" id="ga-clave" class="gen-input gen-input-mono" value="${genEsc(a.clave||'')}" placeholder="A01, LAB-FIS…" maxlength="15">
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Nombre / Identificador *</label>
        <input type="text" id="ga-nombre" class="gen-input" value="${genEsc(a.nombre||'')}" placeholder="Aula 01, Laboratorio de Física…">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Tipo</label>
        <select id="ga-tipo" class="gen-select">
          ${_AULA_TIPOS_.map(function(t){
            return '<option value="'+t+'" '+(a.tipo===t?'selected':'')+'>'+t+'</option>';
          }).join('')}
        </select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Capacidad</label>
        <input type="number" id="ga-cap" class="gen-input" value="${genEsc(a.capacidad||'35')}" min="1" max="200">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Estado</label>
        <select id="ga-activo" class="gen-select">
          <option value="true" ${String(a.activo)!=='false'?'selected':''}>Activa</option>
          <option value="false" ${String(a.activo)==='false'?'selected':''}>Inactiva</option>
        </select>
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="ga-save">Guardar</button>`
  );
  document.getElementById('ga-save').addEventListener('click', async function() {
    var record = {
      id:        id || '',
      clave:     document.getElementById('ga-clave').value.trim(),
      nombre:    document.getElementById('ga-nombre').value.trim(),
      tipo:      document.getElementById('ga-tipo').value,
      capacidad: document.getElementById('ga-cap').value,
      activo:    document.getElementById('ga-activo').value
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
      genToast('Aula guardada.', 'ok');
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
    genConfirm('¿Eliminar el aula "' + (a.nombre || id) + '"?', async function() {
      try {
        await genAPI.deleteAula(_genApp.adminKey, id);
        genToast('Aula eliminada.', 'ok');
        _genApp.aulas = await genAPI.getAulas(true);
        genNavTo('aulas');
      } catch(err) { genToast('Error: ' + err.message, 'error'); }
    });
  });
}
