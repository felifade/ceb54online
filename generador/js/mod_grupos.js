/* ── mod_grupos.js — Catálogo de Grupos ──────────────────────────── */

var _grpViewMode = 'flat';   // 'flat' | 'grouped'

genRegisterModule('grupos', {
  async render(container) {
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando grupos…</span></div>';
    try {
      var grupos = await genAPI.getGrupos(true);
      _genApp.grupos = grupos;
      container.innerHTML = _grpHTML(grupos);
      _grpRefreshTbody(grupos);
      _grpBind(grupos);
    } catch(err) {
      genShowError('No se pudo cargar el catálogo: ' + err.message);
    }
  }
});

/* ── Filtro por ciclo ──────────────────────────────────────────────── */
function _grpFilterByCiclo(grupos) {
  if (!_genApp.ciclo) return grupos;
  return grupos.filter(function(g) {
    return String(g.ciclo || '').trim() === String(_genApp.ciclo).trim();
  });
}

/* ── Shell HTML (estructura + cabecera) ────────────────────────────── */
function _grpHTML(grupos) {
  var filtrados  = _grpFilterByCiclo(grupos);
  var totalTxt   = _genApp.ciclo
    ? filtrados.length + ' de ' + grupos.length + ' grupos &nbsp;·&nbsp; Ciclo <strong>' + genEsc(_genApp.ciclo) + '</strong>'
    : grupos.length + ' grupos registrados';
  var periodoInfo = _genApp.periodo
    ? '<span class="gen-periodo-badge gen-periodo-badge-'+_genApp.periodo+'">Periodo '+_genApp.periodo+
      ' · Sems '+GEN_PERIODO_SEMESTRES_[_genApp.periodo].join(', ')+'°</span>'
    : '';

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Catálogo de Grupos</h1>
    <p class="gen-page-sub">${totalTxt}${periodoInfo ? ' &nbsp;' + periodoInfo : ''}</p>
  </div>
  <div class="gen-header-actions">
    <div class="gen-mat-view-toggle">
      <button class="gen-mat-vtab ${_grpViewMode==='flat'?'active':''}" id="gen-grp-vtab-flat">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Lista
      </button>
      <button class="gen-mat-vtab ${_grpViewMode==='grouped'?'active':''}" id="gen-grp-vtab-grouped">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Por grado
      </button>
    </div>
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
        <th>Capacitación</th>
        <th>Sem. actual</th>
        <th>Estado</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-grp-tbody"></tbody>
  </table>
</div>`;
}

/* ── Relleno del tbody ─────────────────────────────────────────────── */
function _grpRefreshTbody(grupos) {
  var tbody = document.getElementById('gen-grp-tbody');
  if (!tbody) return;
  var list = _grpFilterByCiclo(grupos || _genApp.grupos || []);
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="gen-td-empty">' +
      (_genApp.ciclo
        ? 'No hay grupos registrados para el ciclo <strong>' + genEsc(_genApp.ciclo) + '</strong>. ' +
          'Puedes agregar grupos o revisar el ciclo asignado en cada registro.'
        : 'No hay grupos registrados. Agrega el primero.') +
      '</td></tr>';
    return;
  }
  tbody.innerHTML = _grpViewMode === 'grouped'
    ? _grpBuildGrouped(list)
    : list.map(_grpRow).join('');
}

/* ── Vista agrupada por grado ──────────────────────────────────────── */
function _grpBuildGrouped(grupos) {
  /* Agrupar por grado */
  var byGrado = {};
  grupos.forEach(function(g) {
    var gr = String(g.grado || '?');
    if (!byGrado[gr]) byGrado[gr] = [];
    byGrado[gr].push(g);
  });

  var grados = Object.keys(byGrado).sort(function(a, b) {
    return (parseInt(a) || 99) - (parseInt(b) || 99);
  });

  var rows = [];
  grados.forEach(function(grado, idx) {
    var list = byGrado[grado];

    /* Ordenar dentro del grado: turno → grupo */
    list.sort(function(a, b) {
      var ta = String(a.turno || '').toLowerCase();
      var tb = String(b.turno || '').toLowerCase();
      if (ta !== tb) return ta < tb ? -1 : 1;
      return String(a.grupo || '').localeCompare(String(b.grupo || ''));
    });

    /* Badges para la cabecera del grado */
    var sem = _genApp.periodo ? genSemestreDeGrado(grado, _genApp.periodo) : null;
    var semBadge = sem
      ? '<span class="gen-mat-grp-count gen-mat-grp-count--cap" style="margin-left:6px">Sem ' + sem + '°</span>'
      : '';
    var countBadge = '<span class="gen-mat-grp-count" style="margin-left:8px">' +
      list.length + ' grupo' + (list.length !== 1 ? 's' : '') + '</span>';

    rows.push(
      '<tr class="gen-mat-grp-head gen-grp-grado-head" data-grado="' + genEsc(grado) + '">' +
      '<td colspan="10"><span class="gen-mat-grp-label">Grado ' + genEsc(grado) + '°</span>' +
      countBadge + semBadge + '</td></tr>'
    );

    /* Sub-cabeceras de turno si hay más de uno en este grado */
    var turnos = [];
    var turnoSeen = {};
    list.forEach(function(g) {
      var t = String(g.turno || 'Sin turno');
      if (!turnoSeen[t]) { turnoSeen[t] = true; turnos.push(t); }
    });
    var multiTurno = turnos.length > 1;
    var curTurno = null;

    list.forEach(function(g) {
      var t = String(g.turno || 'Sin turno');
      if (multiTurno && t !== curTurno) {
        curTurno = t;
        rows.push(
          '<tr class="gen-mat-grp-head--cap gen-grp-turno-head">' +
          '<td colspan="10"><span style="font-size:0.71rem;font-weight:600;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase">' +
          genEsc(t) + '</span></td></tr>'
        );
      }
      rows.push(_grpRow(g));
    });
  });

  return rows.join('');
}

/* ── Badge de capacitación ─────────────────────────────────────────── */
function _grpCapBadge(cap) {
  if (!cap) return '<span class="gen-badge gen-badge-gray" style="font-size:10px">General</span>';
  var s = _GEN_CAP_STYLE_[cap];
  if (s) return '<span class="gen-grp-cap-badge" style="background:'+s.bg+';color:'+s.text+';border-color:'+s.border+'">'+genEsc(s.short)+'</span>';
  return '<span class="gen-badge gen-badge-gray" style="font-size:10px">'+genEsc(cap)+'</span>';
}

/* ── Fila de grupo ─────────────────────────────────────────────────── */
function _grpRow(g) {
  var activo = String(g.activo) !== 'false';
  var badge  = activo
    ? '<span class="gen-badge gen-badge-ok">Activo</span>'
    : '<span class="gen-badge gen-badge-gray">Inactivo</span>';
  var label  = (g.grado || '') + '°' + (g.grupo || '');
  var cap    = g.capacitacion ? String(g.capacitacion).trim() : '';

  var semActual = _genApp.periodo ? genSemestreDeGrado(g.grado, _genApp.periodo) : null;
  var semCell   = semActual
    ? '<span class="gen-badge gen-badge-blue" style="font-size:10px">Sem '+semActual+'°</span>'
    : '<span class="gen-badge gen-badge-gray" style="font-size:10px">—</span>';

  return `<tr data-id="${genEsc(g.id)}" data-label="${label.toLowerCase()} ${String(g.clave||'').toLowerCase()} ${String(g.turno||'').toLowerCase()}">
    <td><span class="gen-mono">${genEsc(g.clave || '—')}</span></td>
    <td>${genEsc(g.grado || '—')}</td>
    <td><strong>${genEsc(g.grupo || '—')}</strong></td>
    <td>${genEsc(g.turno || '—')}</td>
    <td>${genEsc(g.ciclo || '—')}</td>
    <td>${genEsc(g.capacidad || '—')}</td>
    <td>${_grpCapBadge(cap)}</td>
    <td>${semCell}</td>
    <td>${badge}</td>
    <td class="gen-td-actions">
      <button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genGrpEditar('${genEsc(g.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genGrpEliminar('${genEsc(g.id)}')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </td>
  </tr>`;
}

/* ── Event bindings ────────────────────────────────────────────────── */
function _grpBind(grupos) {
  /* Toggle de vista */
  document.getElementById('gen-grp-vtab-flat').addEventListener('click', function() {
    if (_grpViewMode === 'flat') return;
    _grpViewMode = 'flat';
    document.getElementById('gen-grp-vtab-flat').classList.add('active');
    document.getElementById('gen-grp-vtab-grouped').classList.remove('active');
    _grpRefreshTbody(grupos);
    var q = document.getElementById('gen-grp-search').value;
    if (q) _grpApplySearch(q);
  });
  document.getElementById('gen-grp-vtab-grouped').addEventListener('click', function() {
    if (_grpViewMode === 'grouped') return;
    _grpViewMode = 'grouped';
    document.getElementById('gen-grp-vtab-grouped').classList.add('active');
    document.getElementById('gen-grp-vtab-flat').classList.remove('active');
    _grpRefreshTbody(grupos);
    var q = document.getElementById('gen-grp-search').value;
    if (q) _grpApplySearch(q);
  });

  /* Búsqueda */
  document.getElementById('gen-grp-search').addEventListener('input', function() {
    _grpApplySearch(this.value);
  });

  /* Nuevo grupo */
  document.getElementById('gen-grp-nuevo').addEventListener('click', function() {
    genRequireAdmin(function() { genGrpForm(null); });
  });
}

function _grpApplySearch(q) {
  var qn = q.trim().toLowerCase();
  document.querySelectorAll('#gen-grp-tbody tr[data-id]').forEach(function(tr) {
    var match = !qn || tr.dataset.label.includes(qn) ||
                tr.querySelector('.gen-mono').textContent.toLowerCase().includes(qn);
    tr.style.display = match ? '' : 'none';
  });
  /* Ocultar cabeceras de grado/turno si no tienen filas de datos visibles debajo */
  document.querySelectorAll('#gen-grp-tbody .gen-grp-grado-head, #gen-grp-tbody .gen-grp-turno-head').forEach(function(hdr) {
    var isTurno = hdr.classList.contains('gen-grp-turno-head');
    var next = hdr.nextElementSibling;
    var anyVisible = false;
    while (next) {
      var isGradoNext  = next.classList.contains('gen-grp-grado-head');
      var isTurnoNext  = next.classList.contains('gen-grp-turno-head');
      /* Cabecera de grado siempre corta; cabecera de turno solo corta si estamos en un turno */
      if (isGradoNext || (isTurno && isTurnoNext)) break;
      if (next.dataset.id && next.style.display !== 'none') anyVisible = true;
      next = next.nextElementSibling;
    }
    hdr.style.display = anyVisible ? '' : 'none';
  });
}

/* ── Formulario ────────────────────────────────────────────────────── */
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
        <input type="number" id="gg-capacidad" class="gen-input" value="${genEsc(g.capacidad||'35')}" min="1" max="60">
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Capacitación</label>
        <select id="gg-cap" class="gen-select">
          <option value="" ${!g.capacitacion?'selected':''}>Sin capacitación (grupo general)</option>
          ${GEN_CAPACITACIONES_.map(function(c){
            return '<option value="'+genEsc(c)+'" '+(g.capacitacion===c?'selected':'')+'>'+genEsc(c)+'</option>';
          }).join('')}
        </select>
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
      id:           id || '',
      clave:        document.getElementById('gg-clave').value.trim(),
      grado:        document.getElementById('gg-grado').value,
      grupo:        document.getElementById('gg-grupo').value.trim().toUpperCase(),
      turno:        document.getElementById('gg-turno').value,
      ciclo:        document.getElementById('gg-ciclo').value.trim(),
      capacidad:    document.getElementById('gg-capacidad').value,
      capacitacion: document.getElementById('gg-cap').value,
      activo:       document.getElementById('gg-activo').value
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
