/* ── mod_reportes.js — Vistas de Horario y Reportes ────────────── */

genRegisterModule('reportes', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state"><p>Selecciona un ciclo escolar primero.</p></div>';
      return;
    }
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando…</span></div>';
    try {
      var [docentes, grupos, materias, aulas, horarios, cfg] = await Promise.all([
        genAPI.getDocentes(),
        genAPI.getGrupos(),
        genAPI.getMaterias(),
        genAPI.getAulas(),
        genAPI.getHorarios(_genApp.ciclo, _genApp.version),
        genAPI.getConfig(true)
      ]);
      _genApp.docentes = docentes;
      _genApp.grupos   = grupos;
      _genApp.materias = materias;
      _genApp.aulas    = aulas;
      _genApp.horarios = horarios;
      container.innerHTML = _reportesHTML(grupos, docentes, aulas, cfg);
      _reportesBind(cfg);
    } catch(err) {
      genShowError('Error al cargar: ' + err.message);
    }
  }
});

function _reportesHTML(grupos, docentes, aulas, cfg) {
  var gruposCiclo = grupos.filter(function(g) {
    return String(g.activo) !== 'false' && (!g.ciclo || g.ciclo === _genApp.ciclo);
  });
  var docentesActivos = docentes.filter(function(d) { return String(d.activo) !== 'false'; });
  var aulasDisp = aulas.filter(function(a) { return String(a.activo) !== 'false'; });

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Reportes y Vistas de Horario</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong> — Versión: <strong>${genEsc(_genApp.version)}</strong></p>
  </div>
</div>

<div class="gen-rep-tabs">
  <button class="gen-rep-tab active" data-tab="grupo">Por grupo</button>
  <button class="gen-rep-tab" data-tab="docente">Por docente</button>
  <button class="gen-rep-tab" data-tab="espacio">Por espacio</button>
  <button class="gen-rep-tab" data-tab="ocupacion">Ocupación general</button>
</div>

<!-- Tab: por grupo -->
<div id="gen-rep-tab-grupo" class="gen-rep-tab-content">
  <div class="gen-card" style="margin-bottom:16px">
    <div class="gen-form-row" style="align-items:flex-end;gap:12px">
      <div class="gen-form-group" style="flex:1;margin:0">
        <label class="gen-label">Grupo</label>
        <select id="gen-rep-grupo" class="gen-select">
          <option value="">-- Selecciona --</option>
          ${gruposCiclo.map(function(g){
            return '<option value="'+genEsc(g.id)+'">'+genEsc(genLabelGrupo(g))+'</option>';
          }).join('')}
        </select>
      </div>
      <button class="gen-btn gen-btn-primary" id="gen-rep-ver-grupo" disabled>Ver horario</button>
    </div>
  </div>
  <div id="gen-rep-resultado-grupo"></div>
</div>

<!-- Tab: por docente -->
<div id="gen-rep-tab-docente" class="gen-rep-tab-content" style="display:none">
  <div class="gen-card" style="margin-bottom:16px">
    <div class="gen-form-row" style="align-items:flex-end;gap:12px">
      <div class="gen-form-group" style="flex:1;margin:0">
        <label class="gen-label">Docente</label>
        <select id="gen-rep-docente" class="gen-select">
          <option value="">-- Selecciona --</option>
          ${docentesActivos.map(function(d){
            return '<option value="'+genEsc(d.id)+'">'+genEsc(genNombreDocente(d))+'</option>';
          }).join('')}
        </select>
      </div>
      <button class="gen-btn gen-btn-primary" id="gen-rep-ver-docente" disabled>Ver horario</button>
    </div>
  </div>
  <div id="gen-rep-resultado-docente"></div>
</div>

<!-- Tab: por espacio -->
<div id="gen-rep-tab-espacio" class="gen-rep-tab-content" style="display:none">
  <div class="gen-card" style="margin-bottom:16px">
    <div class="gen-form-row" style="align-items:flex-end;gap:12px">
      <div class="gen-form-group" style="flex:1;margin:0">
        <label class="gen-label">Aula / Laboratorio / Espacio</label>
        <select id="gen-rep-espacio" class="gen-select">
          <option value="">-- Selecciona --</option>
          ${aulasDisp.map(function(a){
            return '<option value="'+genEsc(a.id)+'">'+genEsc((a.clave||'')+' — '+a.nombre+(a.tipo?' ('+a.tipo+')':''))+'</option>';
          }).join('')}
        </select>
      </div>
      <button class="gen-btn gen-btn-primary" id="gen-rep-ver-espacio" disabled>Ver horario</button>
    </div>
  </div>
  <div id="gen-rep-resultado-espacio"></div>
</div>

<!-- Tab: ocupación general -->
<div id="gen-rep-tab-ocupacion" class="gen-rep-tab-content" style="display:none">
  <div id="gen-rep-resultado-ocupacion">
    <div class="gen-loading"><div class="gen-spinner"></div><span>Cargando ocupación…</span></div>
  </div>
</div>`;
}

function _reportesBind(cfg) {
  var nBloques = parseInt(cfg.num_bloques || '8');
  var horaIni  = _cfgCleanTime(cfg.hora_inicio, '07:00');
  var duracion = parseInt(cfg.duracion_bloque || '50');
  var dias     = (cfg.dias_semana || 'LU,MA,MI,JU,VI').split(',').map(function(d){ return d.trim(); });

  // ── TABS ─────────────────────────────────────────────────────────
  document.querySelectorAll('.gen-rep-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.gen-rep-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      document.querySelectorAll('.gen-rep-tab-content').forEach(function(c) { c.style.display = 'none'; });
      var tabId = 'gen-rep-tab-' + this.dataset.tab;
      document.getElementById(tabId).style.display = '';
      if (this.dataset.tab === 'ocupacion') _repCargarOcupacion(nBloques, dias);
    });
  });

  // ── GRUPO ─────────────────────────────────────────────────────────
  document.getElementById('gen-rep-grupo').addEventListener('change', function() {
    document.getElementById('gen-rep-ver-grupo').disabled = !this.value;
  });
  document.getElementById('gen-rep-ver-grupo').addEventListener('click', function() {
    var id = document.getElementById('gen-rep-grupo').value;
    if (!id) return;
    var entity = genById(_genApp.grupos, id);
    var sesiones = _genApp.horarios.filter(function(h) { return String(h.grupo_id) === String(id); });
    document.getElementById('gen-rep-resultado-grupo').innerHTML =
      _repGridHTML(sesiones, dias, nBloques, horaIni, duracion, 'grupo', entity);
  });

  // ── DOCENTE ───────────────────────────────────────────────────────
  document.getElementById('gen-rep-docente').addEventListener('change', function() {
    document.getElementById('gen-rep-ver-docente').disabled = !this.value;
  });
  document.getElementById('gen-rep-ver-docente').addEventListener('click', function() {
    var id = document.getElementById('gen-rep-docente').value;
    if (!id) return;
    var entity = genById(_genApp.docentes, id);
    var sesiones = _genApp.horarios.filter(function(h) { return String(h.docente_id) === String(id); });
    document.getElementById('gen-rep-resultado-docente').innerHTML =
      _repGridHTML(sesiones, dias, nBloques, horaIni, duracion, 'docente', entity);
  });

  // ── ESPACIO ───────────────────────────────────────────────────────
  document.getElementById('gen-rep-espacio').addEventListener('change', function() {
    document.getElementById('gen-rep-ver-espacio').disabled = !this.value;
  });
  document.getElementById('gen-rep-ver-espacio').addEventListener('click', function() {
    var id = document.getElementById('gen-rep-espacio').value;
    if (!id) return;
    var entity = genById(_genApp.aulas, id);
    var sesiones = _genApp.horarios.filter(function(h) { return String(h.aula_id) === String(id); });
    document.getElementById('gen-rep-resultado-espacio').innerHTML =
      _repGridHTML(sesiones, dias, nBloques, horaIni, duracion, 'espacio', entity);
  });
}

// ── GRID HORARIO (grupo / docente / espacio) ──────────────────────
function _repGridHTML(sesiones, dias, nBloques, horaIni, duracion, viewType, entity) {
  var diasLabels = { LU:'Lunes', MA:'Martes', MI:'Miércoles', JU:'Jueves', VI:'Viernes', SA:'Sábado' };

  var gridMap = {};
  sesiones.forEach(function(h) { gridMap[h.dia + '|' + h.bloque] = h; });

  var titles = {
    grupo:   'Horario del grupo: '   + (entity ? genLabelGrupo(entity) : ''),
    docente: 'Horario del docente: ' + (entity ? genNombreDocente(entity) : ''),
    espacio: 'Horario del espacio: ' + (entity ? genEsc((entity.clave||'') + ' — ' + entity.nombre) : '')
  };
  var title = titles[viewType] || '';

  var thead = '<tr><th class="gen-rep-th-bloque">Bloque</th>' +
    dias.map(function(d) { return '<th>' + genEsc(diasLabels[d]||d) + '</th>'; }).join('') + '</tr>';

  var _rtp    = String(horaIni || '07:00').split(':');
  var _rStart = (parseInt(_rtp[0], 10) || 7) * 60 + (parseInt(_rtp[1], 10) || 0);
  var _rDur   = parseInt(duracion, 10) || 50;

  var tbody = '';
  for (var b = 1; b <= nBloques; b++) {
    var bStart = _rStart + (b - 1) * _rDur;
    var bEnd   = bStart + _rDur;
    var bLbl   = String(Math.floor(bStart/60)%24).padStart(2,'0') + ':' + String(bStart%60).padStart(2,'0') +
                 ' – ' + String(Math.floor(bEnd/60)%24).padStart(2,'0') + ':' + String(bEnd%60).padStart(2,'0');
    tbody += '<tr><td class="gen-rep-bloque-label"><strong>B' + b + '</strong><br><span>' + bLbl + '</span></td>';
    dias.forEach(function(dia) {
      var entry = gridMap[dia + '|' + String(b)];
      if (!entry) { tbody += '<td class="gen-rep-cell gen-rep-cell-empty"></td>'; return; }
      var m = genById(_genApp.materias, entry.materia_id);
      var d = genById(_genApp.docentes, entry.docente_id);
      var g = genById(_genApp.grupos,   entry.grupo_id);
      var a = genById(_genApp.aulas,    entry.aula_id);
      var color = m ? genGetMateriaColor(m.id) : '#94a3b8';

      var linea1, linea2, linea3;
      if (viewType === 'grupo') {
        linea1 = m ? genEsc(m.nombre) : '?';
        linea2 = d ? genEsc(d.apellido_paterno || d.nombre) : '';
        linea3 = a ? genEsc(a.clave || a.nombre) : '';
      } else if (viewType === 'docente') {
        linea1 = g ? genEsc(genLabelGrupo(g)) : '?';
        linea2 = m ? genEsc(m.nombre) : '';
        linea3 = a ? genEsc(a.clave || a.nombre) : '';
      } else { // espacio
        linea1 = g ? genEsc(genLabelGrupo(g)) : '?';
        linea2 = m ? genEsc(m.nombre) : '';
        linea3 = d ? genEsc(d.apellido_paterno || d.nombre) : '';
      }

      tbody += '<td class="gen-rep-cell" style="background:' + color + '15;border-left:3px solid ' + color + '">' +
        '<span class="gen-rep-mat">' + linea1 + '</span>' +
        (linea2 ? '<span class="gen-rep-doc">' + linea2 + '</span>' : '') +
        (linea3 ? '<span class="gen-rep-aula">' + linea3 + '</span>' : '') +
        '</td>';
    });
    tbody += '</tr>';
  }

  // Leyenda de materias
  var materiaSet = {};
  sesiones.forEach(function(h) {
    if (!materiaSet[h.materia_id]) materiaSet[h.materia_id] = 0;
    materiaSet[h.materia_id]++;
  });
  var legend = Object.keys(materiaSet).map(function(mid) {
    var mat = genById(_genApp.materias, mid);
    var col = genGetMateriaColor(mid);
    return '<span class="gen-rep-legend-item" style="border-left:4px solid '+col+';background:'+col+'15">' +
      genEsc(mat ? mat.nombre : mid) + ' <em>(' + materiaSet[mid] + ')</em></span>';
  }).join('');

  // Encabezado de espacio con info extra
  var extraInfo = '';
  if (viewType === 'espacio' && entity) {
    extraInfo = '<div class="gen-rep-espacio-info">' +
      (entity.tipo ? '<span class="gen-badge gen-badge-blue">' + genEsc(entity.tipo) + '</span>' : '') +
      (entity.capacidad ? ' Capacidad: <strong>' + genEsc(entity.capacidad) + '</strong>' : '') +
      (entity.ubicacion ? ' · ' + genEsc(entity.ubicacion) : '') +
      '</div>';
  }

  return `
<div class="gen-card gen-rep-result-card">
  <div class="gen-card-header-row">
    <div>
      <h3 class="gen-card-title">${genEsc(title)}</h3>
      ${extraInfo}
    </div>
  </div>
  ${sesiones.length === 0 ? '<p class="gen-muted" style="padding:16px 0">Sin clases asignadas en este horario.</p>' : ''}
  <div class="gen-table-wrapper gen-rep-table-wrapper">
    <table class="gen-table gen-rep-table">
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>
  ${legend ? '<div class="gen-rep-legend">' + legend + '</div>' : ''}
</div>`;
}

// ── VISTA DE OCUPACIÓN GENERAL ────────────────────────────────────
async function _repCargarOcupacion(nBloques, dias) {
  var wrapper = document.getElementById('gen-rep-resultado-ocupacion');
  wrapper.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Calculando ocupación…</span></div>';
  try {
    var ocupacion = await genAPI.getOcupacionEspacios(_genApp.ciclo, _genApp.version);
    wrapper.innerHTML = _repOcupacionHTML(ocupacion, nBloques, dias);
  } catch(err) {
    wrapper.innerHTML = '<div class="gen-error-state"><p>Error: ' + genEsc(err.message) + '</p></div>';
  }
}

function _repOcupacionHTML(ocupacion, nBloques, dias) {
  var totalBloques = nBloques * dias.length;

  // Separar por tipo
  var porTipo = {};
  ocupacion.forEach(function(e) {
    var t = e.tipo || 'Sin tipo';
    if (!porTipo[t]) porTipo[t] = [];
    porTipo[t].push(e);
  });

  // Stats globales
  var totalEspacios   = ocupacion.length;
  var conConflictos   = ocupacion.filter(function(e){ return e.conflictos > 0; }).length;
  var sinUso          = ocupacion.filter(function(e){ return e.bloques_ocupados === 0; }).length;
  var conUso          = totalEspacios - sinUso;

  var statsHtml = `
<div class="gen-ocp-stats">
  <div class="gen-ocp-stat">
    <span class="gen-ocp-num">${totalEspacios}</span>
    <span class="gen-ocp-lbl">Total espacios</span>
  </div>
  <div class="gen-ocp-stat gen-ocp-stat-ok">
    <span class="gen-ocp-num">${conUso}</span>
    <span class="gen-ocp-lbl">En uso</span>
  </div>
  <div class="gen-ocp-stat gen-ocp-stat-gray">
    <span class="gen-ocp-num">${sinUso}</span>
    <span class="gen-ocp-lbl">Sin asignar</span>
  </div>
  <div class="gen-ocp-stat ${conConflictos > 0 ? 'gen-ocp-stat-danger' : 'gen-ocp-stat-ok'}">
    <span class="gen-ocp-num">${conConflictos}</span>
    <span class="gen-ocp-lbl">Con conflictos</span>
  </div>
</div>`;

  var tiposHtml = Object.keys(porTipo).sort().map(function(tipo) {
    var espacios = porTipo[tipo];
    var cardsHtml = espacios.map(function(e) {
      var pct = totalBloques > 0 ? Math.round((e.bloques_ocupados / totalBloques) * 100) : 0;
      var barColor = e.conflictos > 0 ? 'var(--gen-danger)' :
                     pct >= 80 ? '#f59e0b' :
                     pct > 0   ? 'var(--gen-success)' : 'var(--gen-border)';
      var dispBadge = String(e.disponible) === 'NO' || String(e.disponible) === 'false'
        ? '<span class="gen-badge gen-badge-gray" style="font-size:10px">No disponible</span>'
        : '';
      return `<div class="gen-ocp-card ${e.conflictos > 0 ? 'gen-ocp-card-conflict' : ''}">
        <div class="gen-ocp-card-header">
          <span class="gen-ocp-clave">${genEsc(e.clave||'—')}</span>
          ${dispBadge}
          ${e.conflictos > 0 ? '<span class="gen-badge gen-badge-warn" style="font-size:10px">⚠ '+e.conflictos+' conflicto'+(e.conflictos>1?'s':'')+'</span>' : ''}
        </div>
        <div class="gen-ocp-nombre">${genEsc(e.nombre||'—')}</div>
        ${e.ubicacion ? '<div class="gen-ocp-ubic">📍 '+genEsc(e.ubicacion)+'</div>' : ''}
        <div class="gen-ocp-bar-wrap">
          <div class="gen-ocp-bar" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="gen-ocp-bar-info">
          <span>${e.bloques_ocupados} bloques ocupados de ${totalBloques}</span>
          <strong style="color:${barColor}">${pct}%</strong>
        </div>
        ${e.capacidad ? '<div class="gen-ocp-cap">Cap: '+genEsc(e.capacidad)+' alumnos</div>' : ''}
        ${e.observaciones ? '<div class="gen-ocp-obs">'+genEsc(e.observaciones)+'</div>' : ''}
      </div>`;
    }).join('');

    return `<div class="gen-ocp-section">
      <h3 class="gen-ocp-tipo-title">${genEsc(tipo)} <span class="gen-ocp-tipo-count">(${espacios.length})</span></h3>
      <div class="gen-ocp-grid">${cardsHtml}</div>
    </div>`;
  }).join('');

  return `
<div class="gen-page-header" style="margin-bottom:16px">
  <div>
    <h2 class="gen-page-title" style="font-size:18px">Ocupación de espacios</h2>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong> — ${totalBloques} bloques disponibles por espacio</p>
  </div>
  <button class="gen-btn gen-btn-secondary" onclick="_repCargarOcupacion(${nBloques},[${dias.map(function(d){return "'"+d+"'"}).join(',')}])">
    Recargar
  </button>
</div>
${statsHtml}
${tiposHtml || '<div class="gen-empty-state"><p>Sin datos de horarios para calcular ocupación.</p></div>'}`;
}
