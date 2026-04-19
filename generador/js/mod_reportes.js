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
      container.innerHTML = _reportesHTML(grupos, docentes, horarios, cfg);
      _reportesBind(cfg);
    } catch(err) {
      genShowError('Error al cargar: ' + err.message);
    }
  }
});

function _reportesHTML(grupos, docentes, horarios, cfg) {
  var gruposCiclo = grupos.filter(function(g) {
    return String(g.activo) !== 'false' && (!g.ciclo || g.ciclo === _genApp.ciclo);
  });
  var docentesActivos = docentes.filter(function(d) { return String(d.activo) !== 'false'; });

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
</div>`;
}

function _reportesBind(cfg) {
  var nBloques = parseInt(cfg.num_bloques || '8');
  var horaIni  = _cfgCleanTime(cfg.hora_inicio, '07:00');
  var duracion = parseInt(cfg.duracion_bloque || '50');
  var dias     = (cfg.dias_semana || 'LU,MA,MI,JU,VI').split(',').map(function(d){ return d.trim(); });

  // Tabs
  document.querySelectorAll('.gen-rep-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.gen-rep-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      document.querySelectorAll('.gen-rep-tab-content').forEach(function(c) { c.style.display = 'none'; });
      document.getElementById('gen-rep-tab-' + this.dataset.tab).style.display = '';
    });
  });

  // Grupo selector
  document.getElementById('gen-rep-grupo').addEventListener('change', function() {
    document.getElementById('gen-rep-ver-grupo').disabled = !this.value;
  });
  document.getElementById('gen-rep-ver-grupo').addEventListener('click', function() {
    var id = document.getElementById('gen-rep-grupo').value;
    if (!id) return;
    var grupo = genById(_genApp.grupos, id);
    var horariosGrupo = _genApp.horarios.filter(function(h) { return String(h.grupo_id) === String(id); });
    document.getElementById('gen-rep-resultado-grupo').innerHTML =
      _repGridHTML(horariosGrupo, dias, nBloques, horaIni, duracion, 'grupo', grupo);
  });

  // Docente selector
  document.getElementById('gen-rep-docente').addEventListener('change', function() {
    document.getElementById('gen-rep-ver-docente').disabled = !this.value;
  });
  document.getElementById('gen-rep-ver-docente').addEventListener('click', function() {
    var id = document.getElementById('gen-rep-docente').value;
    if (!id) return;
    var docente = genById(_genApp.docentes, id);
    var horariosDocente = _genApp.horarios.filter(function(h) { return String(h.docente_id) === String(id); });
    document.getElementById('gen-rep-resultado-docente').innerHTML =
      _repGridHTML(horariosDocente, dias, nBloques, horaIni, duracion, 'docente', docente);
  });
}

function _repGridHTML(sesiones, dias, nBloques, horaIni, duracion, viewType, entity) {
  var diasLabels = { LU:'Lunes', MA:'Martes', MI:'Miércoles', JU:'Jueves', VI:'Viernes', SA:'Sábado' };

  // Índice
  var gridMap = {};
  sesiones.forEach(function(h) { gridMap[h.dia + '|' + h.bloque] = h; });

  var title = viewType === 'grupo'
    ? 'Horario: ' + (entity ? genLabelGrupo(entity) : '')
    : 'Horario: ' + (entity ? genNombreDocente(entity) : '');

  var thead = '<tr><th class="gen-rep-th-bloque">Bloque</th>' +
    dias.map(function(d) { return '<th>'+genEsc(diasLabels[d]||d)+'</th>'; }).join('') + '</tr>';

  var _rtp      = String(horaIni || '07:00').split(':');
  var _rStart   = (parseInt(_rtp[0], 10) || 7) * 60 + (parseInt(_rtp[1], 10) || 0);
  var _rDur     = parseInt(duracion, 10) || 50;

  var tbody = '';
  for (var b = 1; b <= nBloques; b++) {
    var bStart   = _rStart + (b - 1) * _rDur;
    var bEnd     = bStart + _rDur;
    var bloqueLabel = String(Math.floor(bStart/60)%24).padStart(2,'0') + ':' + String(bStart%60).padStart(2,'0') +
      ' – ' + String(Math.floor(bEnd/60)%24).padStart(2,'0') + ':' + String(bEnd%60).padStart(2,'0');
    tbody += '<tr><td class="gen-rep-bloque-label"><strong>B' + b + '</strong><br><span>' + bloqueLabel + '</span></td>';
    dias.forEach(function(dia) {
      var key   = dia + '|' + String(b);
      var entry = gridMap[key];
      if (!entry) {
        tbody += '<td class="gen-rep-cell gen-rep-cell-empty"></td>';
        return;
      }
      var m     = genById(_genApp.materias, entry.materia_id);
      var d     = genById(_genApp.docentes, entry.docente_id);
      var g     = genById(_genApp.grupos, entry.grupo_id);
      var a     = genById(_genApp.aulas, entry.aula_id);
      var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
      var mainLabel = viewType === 'grupo' ? (m ? genEsc(m.nombre) : '?') : (g ? genEsc(genLabelGrupo(g)) : '?');
      var subLabel  = viewType === 'grupo' ? (d ? genEsc(d.apellido_paterno||d.nombre) : '') : (m ? genEsc(m.nombre) : '');
      tbody += '<td class="gen-rep-cell" style="background:'+color+'15;border-left:3px solid '+color+'">'+
        '<span class="gen-rep-mat">'+mainLabel+'</span>'+
        (subLabel ? '<span class="gen-rep-doc">'+subLabel+'</span>' : '')+
        (a ? '<span class="gen-rep-aula">'+genEsc(a.clave||a.nombre)+'</span>' : '')+
        '</td>';
    });
    tbody += '</tr>';
  }

  // Resumen de materias
  var materiaSet = {};
  sesiones.forEach(function(h) {
    if (!materiaSet[h.materia_id]) materiaSet[h.materia_id] = 0;
    materiaSet[h.materia_id]++;
  });
  var legendHtml = Object.keys(materiaSet).map(function(mid) {
    var m     = genById(_genApp.materias, mid);
    var color = genGetMateriaColor(mid);
    return '<span class="gen-rep-legend-item" style="border-left:4px solid '+color+';background:'+color+'15">' +
      genEsc(m ? m.nombre : mid) + ' <em>('+materiaSet[mid]+')</em></span>';
  }).join('');

  return `
<div class="gen-card gen-rep-result-card">
  <div class="gen-card-header-row">
    <h3 class="gen-card-title">${genEsc(title)}</h3>
  </div>
  <div class="gen-table-wrapper gen-rep-table-wrapper">
    <table class="gen-table gen-rep-table">
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>
  ${legendHtml ? '<div class="gen-rep-legend">' + legendHtml + '</div>' : ''}
</div>`;
}
