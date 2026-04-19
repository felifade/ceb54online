/* ── mod_carga.js — Carga Horaria (asignación Docente-Grupo-Materia) */

genRegisterModule('carga', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state"><p>Selecciona un ciclo escolar primero.</p>' +
        '<button class="gen-btn gen-btn-primary" onclick="document.getElementById(\'gen-ciclo-btn\').click()">Seleccionar ciclo</button></div>';
      return;
    }
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando datos…</span></div>';
    try {
      var [docentes, grupos, materias, carga] = await Promise.all([
        genAPI.getDocentes(),
        genAPI.getGrupos(),
        genAPI.getMaterias(),
        genAPI.getCarga(_genApp.ciclo, true)
      ]);
      _genApp.docentes = docentes;
      _genApp.grupos   = grupos;
      _genApp.materias = materias;
      _genApp.carga    = carga;
      container.innerHTML = _cargaHTML(grupos, carga);
      _cargaBind();
    } catch(err) {
      genShowError('Error al cargar datos: ' + err.message);
    }
  }
});

function _cargaHTML(grupos, carga) {
  // Filtra grupos del ciclo activo
  var gruposCiclo = grupos.filter(function(g) {
    return !_genApp.ciclo || !g.ciclo || g.ciclo === _genApp.ciclo;
  }).filter(function(g) { return String(g.activo) !== 'false'; });

  var html = `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Carga Horaria</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong> — Asignación docente → grupo → materia</p>
  </div>
  <div class="gen-header-actions">
    <select id="gen-carga-filtro-grupo" class="gen-select" style="min-width:160px">
      <option value="">Todos los grupos</option>
      ${gruposCiclo.map(function(g) { return '<option value="'+genEsc(g.id)+'">'+genEsc(genLabelGrupo(g))+'</option>'; }).join('')}
    </select>
    <button class="gen-btn gen-btn-primary" id="gen-carga-nueva">+ Agregar asignación</button>
  </div>
</div>

<div class="gen-table-wrapper">
  <table class="gen-table" id="gen-carga-table">
    <thead>
      <tr>
        <th>Grupo</th>
        <th>Materia / UAC</th>
        <th>Docente</th>
        <th>Hrs/semana</th>
        <th class="gen-th-actions">Acciones</th>
      </tr>
    </thead>
    <tbody id="gen-carga-tbody">
      ${_cargaRows(carga)}
    </tbody>
  </table>
</div>`;
  return html;
}

function _cargaRows(carga) {
  if (!carga || carga.length === 0)
    return '<tr><td colspan="5" class="gen-td-empty">No hay asignaciones de carga horaria. Usa "+ Agregar asignación".</td></tr>';

  // Ordenar por grupo
  var sorted = carga.slice().sort(function(a, b) {
    var ga = genById(_genApp.grupos, a.grupo_id);
    var gb = genById(_genApp.grupos, b.grupo_id);
    return genLabelGrupo(ga).localeCompare(genLabelGrupo(gb));
  });

  return sorted.map(function(c) {
    var g = genById(_genApp.grupos, c.grupo_id);
    var m = genById(_genApp.materias, c.materia_id);
    var d = genById(_genApp.docentes, c.docente_id);
    var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
    return `<tr data-id="${genEsc(c.id)}" data-grupo="${genEsc(c.grupo_id)}">
      <td>${g ? '<strong>'+genEsc(genLabelGrupo(g))+'</strong>' : '<span class="gen-muted">—</span>'}</td>
      <td>
        <span class="gen-mat-chip" style="background:${color}20;border-left:3px solid ${color}">
          ${m ? genEsc(m.nombre) : '<span class="gen-muted">ID: '+genEsc(c.materia_id)+'</span>'}
        </span>
      </td>
      <td>${d ? genEsc(genNombreDocente(d)) : '<span class="gen-muted">Sin asignar</span>'}</td>
      <td>${genEsc(c.hrs_asignadas||'—')}</td>
      <td class="gen-td-actions">
        <button class="gen-btn-icon gen-btn-edit" title="Editar" onclick="genCargaEditar('${genEsc(c.id)}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="gen-btn-icon gen-btn-delete" title="Eliminar" onclick="genCargaEliminar('${genEsc(c.id)}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function _cargaBind() {
  document.getElementById('gen-carga-nueva').addEventListener('click', function() {
    genRequireAdmin(function() { genCargaForm(null); });
  });

  document.getElementById('gen-carga-filtro-grupo').addEventListener('change', function() {
    var val = this.value;
    document.querySelectorAll('#gen-carga-tbody tr[data-id]').forEach(function(tr) {
      tr.style.display = (!val || tr.dataset.grupo === val) ? '' : 'none';
    });
  });
}

/**
 * Devuelve los semestres esperados de un grupo a partir de su grado.
 * Grado 1 → semestres 1 y 2, Grado 2 → 3 y 4, Grado 3 → 5 y 6.
 */
function _cargaGrupoSemestres(grupoId) {
  var g = genById(_genApp.grupos, grupoId);
  if (!g || !g.grado) return [];
  var gr = parseInt(g.grado, 10);
  if (isNaN(gr) || gr < 1 || gr > 3) return [];
  return [String(gr * 2 - 1), String(gr * 2)];
}

/** Retorna la capacitación del grupo (vacío si no tiene). */
function _cargaGrupoCapacitacion(grupoId) {
  var g = genById(_genApp.grupos, grupoId);
  return (g && g.capacitacion) ? String(g.capacitacion).trim() : '';
}

/**
 * Genera las <option> del selector de materias priorizadas por semestre y capacitación.
 *
 * Grupos de opciones (de mayor a menor prioridad):
 *   1. ✓ Semestre X/Y° · <Capacitación>  — coincide en semestre y capacitación
 *   2. · Semestre X/Y° (generales)        — mismo semestre, materia general (o sin cap)
 *   3. ── Otras materias ──               — resto, con hint de semestre entre paréntesis
 *
 * Si no hay info de grupo: lista plana con semestre entre paréntesis.
 */
function _cargaMateriaOpts(grupoId, selectedId) {
  var activas = (_genApp.materias || []).filter(function(m) { return String(m.activo) !== 'false'; });
  var sems    = grupoId ? _cargaGrupoSemestres(grupoId) : [];
  var cap     = grupoId ? _cargaGrupoCapacitacion(grupoId) : '';

  if (!sems.length && !cap) {
    // Sin info de grupo: lista plana
    return '<option value="">-- Selecciona materia --</option>' +
      activas.map(function(m) {
        var hint = m.semestre ? ' (Sem '+m.semestre+'°)' : '';
        return '<option value="'+genEsc(m.id)+'"'+(String(selectedId)===String(m.id)?' selected':'')+'>'+genEsc(m.nombre+hint)+'</option>';
      }).join('');
  }

  // Clasificar cada materia en uno de tres cubos
  var primerCubo = [], segundoCubo = [], tercerCubo = [];
  activas.forEach(function(m) {
    var enSem  = sems.length ? (m.semestre && sems.indexOf(String(m.semestre)) !== -1) : false;
    var mCap   = genGetCap(m.componente);
    var enCap  = cap ? (mCap === cap) : false;

    if (enSem && (cap ? enCap : !mCap)) {
      primerCubo.push(m);   // semestre correcto + (cap coincide o es general si grupo sin cap)
    } else if (enSem) {
      segundoCubo.push(m);  // mismo semestre pero distinta cap o general
    } else {
      tercerCubo.push(m);   // todo lo demás
    }
  });

  var html = '<option value="">-- Selecciona materia --</option>';

  function optTag(m, extraHint) {
    var label = m.nombre + (extraHint || '');
    return '<option value="'+genEsc(m.id)+'"'+(String(selectedId)===String(m.id)?' selected':'')+'>'+genEsc(label)+'</option>';
  }

  if (primerCubo.length) {
    var g1 = sems.length && cap
      ? '✓ Semestre '+sems.join('/')+'° · '+cap
      : '✓ Semestre '+sems.join('/')+'°';
    html += '<optgroup label="'+genEsc(g1)+'">';
    html += primerCubo.map(function(m) { return optTag(m); }).join('');
    html += '</optgroup>';
  }

  if (segundoCubo.length) {
    var g2 = cap ? '· Semestre '+sems.join('/')+'° (otras materias)' : '· Otras materias del semestre';
    html += '<optgroup label="'+genEsc(g2)+'">';
    html += segundoCubo.map(function(m) {
      var mCap = genGetCap(m.componente);
      return optTag(m, mCap ? ' ['+mCap+']' : '');
    }).join('');
    html += '</optgroup>';
  }

  if (tercerCubo.length) {
    html += '<optgroup label="── Otras materias ──">';
    html += tercerCubo.map(function(m) {
      var hint = m.semestre ? ' (Sem '+m.semestre+'°)' : '';
      return optTag(m, hint);
    }).join('');
    html += '</optgroup>';
  }

  return html;
}

function _cargaActualizarHint(grupoId) {
  var hint = document.getElementById('gc-materia-hint');
  if (!hint) return;
  if (!grupoId) { hint.textContent = ''; return; }
  var sems = _cargaGrupoSemestres(grupoId);
  var cap  = _cargaGrupoCapacitacion(grupoId);
  var partes = [];
  if (sems.length) partes.push('Sem '+sems.join('/') + '°');
  if (cap) partes.push(cap);
  hint.textContent = partes.length ? partes.join(' · ') + ' arriba' : '';
}

function genCargaForm(id) {
  var c = id ? genById(_genApp.carga, id) : {};
  if (!c) { genToast('Asignación no encontrada.', 'error'); return; }
  var isNew = !id;

  var grupoOpts = _genApp.grupos
    .filter(function(g) { return String(g.activo) !== 'false'; })
    .map(function(g) {
      return '<option value="'+genEsc(g.id)+'" '+(c.grupo_id===g.id?'selected':'')+'>'+genEsc(genLabelGrupo(g))+'</option>';
    }).join('');

  var docenteOpts = '<option value="">Sin asignar</option>' + _genApp.docentes
    .filter(function(d) { return String(d.activo) !== 'false'; })
    .map(function(d) {
      return '<option value="'+genEsc(d.id)+'" '+(c.docente_id===d.id?'selected':'')+'>'+genEsc(genNombreDocente(d))+'</option>';
    }).join('');

  var materiaOptsHtml = _cargaMateriaOpts(c.grupo_id, c.materia_id);

  _genModal.open(
    isNew ? 'Nueva asignación de carga' : 'Editar asignación',
    `<div class="gen-form-grid-2">
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Grupo *</label>
        <select id="gc-grupo" class="gen-select"><option value="">-- Selecciona grupo --</option>${grupoOpts}</select>
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Materia / UAC *</label>
        <span id="gc-materia-hint" class="gen-hint" style="float:right;margin-top:2px"></span>
        <select id="gc-materia" class="gen-select">${materiaOptsHtml}</select>
      </div>
      <div class="gen-form-group gen-span-2">
        <label class="gen-label">Docente</label>
        <select id="gc-docente" class="gen-select">${docenteOpts}</select>
      </div>
      <div class="gen-form-group">
        <label class="gen-label">Horas por semana</label>
        <input type="number" id="gc-hrs" class="gen-input" value="${genEsc(c.hrs_asignadas||'3')}" min="1" max="20">
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="gc-save">Guardar</button>`
  );

  // Al cambiar grupo, actualizar opciones de materia priorizadas por semestre
  document.getElementById('gc-grupo').addEventListener('change', function() {
    var grupoId = this.value;
    var sel = document.getElementById('gc-materia');
    if (sel) sel.innerHTML = _cargaMateriaOpts(grupoId, '');
    _cargaActualizarHint(grupoId);
  });
  _cargaActualizarHint(c.grupo_id);

  document.getElementById('gc-save').addEventListener('click', async function() {
    var record = {
      id:           id || '',
      ciclo:        _genApp.ciclo,
      grupo_id:     document.getElementById('gc-grupo').value,
      materia_id:   document.getElementById('gc-materia').value,
      docente_id:   document.getElementById('gc-docente').value,
      hrs_asignadas: document.getElementById('gc-hrs').value
    };
    if (!record.grupo_id || !record.materia_id) {
      genToast('Grupo y materia son obligatorios.', 'warning');
      return;
    }
    var btn = document.getElementById('gc-save');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await genAPI.saveCargaFila(_genApp.adminKey, record);
      _genModal.close();
      genToast('Asignación guardada.', 'ok');
      _genApp.carga = await genAPI.getCarga(_genApp.ciclo, true);
      // Refrescar solo el tbody
      var tbody = document.getElementById('gen-carga-tbody');
      if (tbody) tbody.innerHTML = _cargaRows(_genApp.carga);
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
      if (err.message.includes('administrador')) _genApp.adminKey = null;
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  });
}

function genCargaEditar(id) { genRequireAdmin(function() { genCargaForm(id); }); }

function genCargaEliminar(id) {
  genRequireAdmin(function() {
    genConfirm('¿Eliminar esta asignación de carga horaria?', async function() {
      try {
        await genAPI.deleteCargaFila(_genApp.adminKey, id);
        genToast('Asignación eliminada.', 'ok');
        _genApp.carga = await genAPI.getCarga(_genApp.ciclo, true);
        var tbody = document.getElementById('gen-carga-tbody');
        if (tbody) tbody.innerHTML = _cargaRows(_genApp.carga);
      } catch(err) { genToast('Error: ' + err.message, 'error'); }
    });
  });
}
