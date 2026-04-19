/* ── mod_grupos.js — Catálogo de Grupos ──────────────────────────── */

genRegisterModule('grupos', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando grupos…</span></div>';
    try {
      var grupos = await genAPI.getGrupos(true);
      _genApp.grupos = grupos;
      container.innerHTML = _grpHTML(grupos);
      _grpBind();
    } catch(err) {
      genShowError('No se pudo cargar el catálogo: ' + err.message);
    }
  }
});

function _grpHTML(grupos) {
  // Organizar por grado
  var byGrado = {};
  grupos.forEach(function(g) {
    var key = g.grado || '?';
    if (!byGrado[key]) byGrado[key] = [];
    byGrado[key].push(g);
  });
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Grupos</h1>
    <p class="gen-page-sub">${grupos.length} grupos registrados</p>
  </div>
  <div class="gen-header-actions">
    <input type="text" id="gen-grp-search" class="gen-search-input" placeholder="Buscar grupo…">
    <button class="gen-btn gen-btn-primary" id="gen-grp-nuevo">+ Nuevo grupo</button>
  </div>
</div>

<div class="gen-table-wrapper">
  <table class="gen-table" id="gen-grp-table">
    <thead>
      <tr>
        <th>Clave</th>
        <th>Grado</th>
        <th>Grupo</th>
        <th>Turno</th>
        <th>Ciclo</th>
        <th>Capacidad</th>
        <th>Estado</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-grp-tbody">
      ${grupos.length === 0
        ? '<tr><td colspan="8" class="gen-td-empty">No hay grupos registrados. Agrega el primero.</td></tr>'
        : grupos.map(_grpRow).join('')}
    </tbody>
  </table>
</div>`;
}

function _grpRow(g) {
  var activo = String(g.activo) !== 'false';
  var badge  = activo
    ? '<span class="gen-badge gen-badge-ok">Activo</span>'
    : '<span class="gen-badge gen-badge-gray">Inactivo</span>';
  var label  = (g.grado || '') + '°' + (g.grupo || '');
  return `<tr data-id="${genEsc(g.id)}" data-label="${label.toLowerCase()}">
    <td><span class="gen-mono">${genEsc(g.clave || '—')}</span></td>
    <td>${genEsc(g.grado || '—')}</td>
    <td><strong>${genEsc(g.grupo || '—')}</strong></td>
    <td>${genEsc(g.turno || '—')}</td>
    <td>${genEsc(g.ciclo || '—')}</td>
    <td>${genEsc(g.capacidad || '—')}</td>
    <td>${badge}</td>
    <td class="gen-td-actions">
      <button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genGrpEditar('${genEsc(g.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genGrpEliminar('${genEsc(g.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </td>
  </tr>`;
}

function _grpBind() {
  document.getElementById('gen-grp-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genGrpForm(null); });
  });
  document.getElementById('gen-grp-search').addEventListener('input', function() {
    var q = this.value.toLowerCase();
    document.querySelectorAll('#gen-grp-tbody tr[data-id]').forEach(function(tr) {
      var match = !q || tr.dataset.label.includes(q) ||
                  tr.querySelector('.gen-mono').textContent.toLowerCase().includes(q);
      tr.style.display = match ? '' : 'none';
    });
  });
}

function genGrpForm(id) {
  var g = id ? genById(_genApp.grupos, id) : {};
  if (!g) { genToast('Grupo no encontrado.', 'error'); return; }
  var isNew = !id;
  _genModal.open(
    isNew ? 'Nuevo grupo' : 'Editar grupo',
    `<div class="gen-form-grid-2">
      <div class="gen-form-group">
        <label class="gen-label">Clave *</label>
        <input type="text" id="gg-clave" class="gen-input gen-input-mono" value="${genEsc(g.clave||'')}" placeholder="1A, 2B…" maxlength="10">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Grado *</label>
        <select id="gg-grado" class="gen-select">
          <option value="">-- Grado --</option>
          ${[1,2,3,4,5,6].map(function(n){
            return '<option value="'+n+'" '+(String(g.grado)===String(n)?'selected':'')+'>'+n+'°</option>';
          }).join('')}
        </select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Grupo *</label>
        <input type="text" id="gg-grupo" class="gen-input" value="${genEsc(g.grupo||'')}" placeholder="A, B, C…" maxlength="5">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Turno</label>
        <select id="gg-turno" class="gen-select">
          <option value="Matutino" ${g.turno==='Matutino'?'selected':''}>Matutino</option>
          <option value="Vespertino" ${g.turno==='Vespertino'?'selected':''}>Vespertino</option>
          <option value="Mixto" ${g.turno==='Mixto'?'selected':''}>Mixto</option>
        </select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Ciclo escolar</label>
        <input type="text" id="gg-ciclo" class="gen-input" value="${genEsc(g.ciclo||_genApp.ciclo||'')}" placeholder="2025-2026">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Capacidad</label>
        <input type="number" id="gg-cap" class="gen-input" value="${genEsc(g.capacidad||'35')}" min="1" max="60">
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Estado</label>
        <select id="gg-activo" class="gen-select">
          <option value="true" ${String(g.activo)!=='false'?'selected':''}>Activo</option>
          <option value="false" ${String(g.activo)==='false'?'selected':''}>Inactivo</option>
        </select>
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="gg-save">Guardar</button>`
  );
  document.getElementById('gg-save').addEventListener('click', async function() {
    var record = {
      id:         id || '',
      clave:      document.getElementById('gg-clave').value.trim(),
      grado:      document.getElementById('gg-grado').value,
      grupo:      document.getElementById('gg-grupo').value.trim().toUpperCase(),
      turno:      document.getElementById('gg-turno').value,
      ciclo:      document.getElementById('gg-ciclo').value.trim(),
      capacidad:  document.getElementById('gg-cap').value,
      activo:     document.getElementById('gg-activo').value
    };
    if (!record.clave || !record.grado || !record.grupo) {
      genToast('Clave, grado y grupo son obligatorios.', 'warning');
      return;
    }
    var btn = document.getElementById('gg-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await genAPI.saveGrupo(_genApp.adminKey, record);
      _genModal.close();
      genToast('Grupo guardado.', 'ok');
      _genApp.grupos = await genAPI.getGrupos(true);
      genNavTo('grupos');
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
      if (err.message.includes('administrador')) _genApp.adminKey = null;
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
}

async function genGrpEditar(id) {
  genRequireAdmin(function() { genGrpForm(id); });
}

async function genGrpEliminar(id) {
  genRequireAdmin(function() {
    var g = genById(_genApp.grupos, id);
    if (!g) return;
    genConfirm('¿Eliminar el grupo ' + genLabelGrupo(g) + '?', async function() {
      try {
        await genAPI.deleteGrupo(_genApp.adminKey, id);
        genToast('Grupo eliminado.', 'ok');
        _genApp.grupos = await genAPI.getGrupos(true);
        genNavTo('grupos');
      } catch(err) {
        genToast('Error: ' + err.message, 'error');
      }
    });
  });
}
