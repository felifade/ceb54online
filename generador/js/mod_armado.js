/* ── mod_armado.js — Armado Manual de Horarios ──────────────────── */

genRegisterModule('armado', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state"><p>Selecciona un ciclo escolar primero.</p></div>';
      return;
    }
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando datos…</span></div>';
    try {
      var [docentes, grupos, materias, aulas, carga, horarios, cfg] = await Promise.all([
        genAPI.getDocentes(),
        genAPI.getGrupos(),
        genAPI.getMaterias(),
        genAPI.getAulas(),
        genAPI.getCarga(_genApp.ciclo),
        genAPI.getHorarios(_genApp.ciclo, _genApp.version, true),
        genAPI.getConfig(true)   // force: siempre config fresca
      ]);
      _genApp.docentes = docentes;
      _genApp.grupos   = grupos;
      _genApp.materias = materias;
      _genApp.aulas    = aulas;
      _genApp.carga    = carga;
      _genApp.horarios = horarios;

      var nBloques = parseInt(cfg.num_bloques || '8');
      var horaIni  = _cfgCleanTime(cfg.hora_inicio, '07:00');
      var duracion = parseInt(cfg.duracion_bloque || '50');
      var dias     = (cfg.dias_semana || 'LU,MA,MI,JU,VI').split(',').map(function(d){ return d.trim(); });

      var gruposCiclo = grupos.filter(function(g) {
        return String(g.activo) !== 'false' && (!g.ciclo || g.ciclo === _genApp.ciclo);
      });

      container.innerHTML = _armadoHTML(gruposCiclo, nBloques, horaIni, duracion, dias);
      _armadoBind(nBloques, horaIni, duracion, dias);
    } catch(err) {
      genShowError('Error al cargar: ' + err.message);
    }
  }
});

var _armadoCurrentGrupo_ = null;

function _armadoHTML(grupos, nBloques, horaIni, duracion, dias) {
  var diasLabels = { LU:'Lunes', MA:'Martes', MI:'Miércoles', JU:'Jueves', VI:'Viernes', SA:'Sábado' };
  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Armado de Horarios</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong> — Versión: <strong>${genEsc(_genApp.version)}</strong></p>
  </div>
  <div class="gen-header-actions">
    <select id="gen-arm-version" class="gen-select" style="min-width:120px" title="Versión del horario">
      <option value="v1" ${_genApp.version==='v1'?'selected':''}>v1</option>
      <option value="v2" ${_genApp.version==='v2'?'selected':''}>v2</option>
      <option value="v3" ${_genApp.version==='v3'?'selected':''}>v3</option>
    </select>
    <button class="gen-btn gen-btn-secondary" id="gen-arm-conflictos-btn">Ver conflictos</button>
  </div>
</div>

<div class="gen-armado-layout">
  <!-- Panel izquierdo: selector de grupo + materias asignables -->
  <aside class="gen-arm-sidebar">
    <div class="gen-arm-sidebar-section">
      <label class="gen-label">Grupo</label>
      <select id="gen-arm-grupo" class="gen-select">
        <option value="">-- Selecciona --</option>
        ${grupos.map(function(g) {
          return '<option value="'+genEsc(g.id)+'">'+genEsc(genLabelGrupo(g))+'</option>';
        }).join('')}
      </select>
    </div>
    <div class="gen-arm-sidebar-section" id="gen-arm-pool-wrapper" style="display:none">
      <p class="gen-hint" style="margin-bottom:8px">Materias asignadas a este grupo (haz clic en un bloque del grid y luego en una materia):</p>
      <div id="gen-arm-pool" class="gen-arm-pool"></div>
    </div>
  </aside>

  <!-- Panel derecho: grid horario -->
  <main class="gen-arm-main">
    <div id="gen-arm-grid-wrapper" class="gen-arm-grid-placeholder">
      <p class="gen-muted">Selecciona un grupo para ver su horario.</p>
    </div>
  </main>
</div>`;
}

function _armadoBind(nBloques, horaIni, duracion, dias) {
  document.getElementById('gen-arm-version').addEventListener('change', function() {
    _genApp.version = this.value;
    if (_armadoCurrentGrupo_) _armadoCargarGrupo(_armadoCurrentGrupo_, nBloques, horaIni, duracion, dias);
  });

  document.getElementById('gen-arm-grupo').addEventListener('change', function() {
    _armadoCurrentGrupo_ = this.value || null;
    if (_armadoCurrentGrupo_) {
      _armadoCargarGrupo(_armadoCurrentGrupo_, nBloques, horaIni, duracion, dias);
    } else {
      document.getElementById('gen-arm-grid-wrapper').innerHTML = '<p class="gen-muted">Selecciona un grupo para ver su horario.</p>';
      document.getElementById('gen-arm-pool-wrapper').style.display = 'none';
    }
  });

  document.getElementById('gen-arm-conflictos-btn').addEventListener('click', function() {
    genNavTo('conflictos');
  });
}

function _armadoCargarGrupo(grupoId, nBloques, horaIni, duracion, dias) {
  var diasLabels = { LU:'Lunes', MA:'Martes', MI:'Miércoles', JU:'Jueves', VI:'Viernes', SA:'Sábado' };

  // Materias asignadas a este grupo via carga horaria
  var cargaGrupo = _genApp.carga.filter(function(c) { return String(c.grupo_id) === String(grupoId); });

  // Pool de materias disponibles
  var poolHtml = cargaGrupo.length === 0
    ? '<p class="gen-muted" style="font-size:12px">Sin carga horaria asignada. Ve a "Carga Horaria" primero.</p>'
    : cargaGrupo.map(function(c) {
        var m     = genById(_genApp.materias, c.materia_id);
        var d     = genById(_genApp.docentes, c.docente_id);
        var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
        return '<div class="gen-arm-pool-item" data-carga-id="'+genEsc(c.id)+'" data-materia-id="'+genEsc(c.materia_id)+'" data-docente-id="'+genEsc(c.docente_id||'')+'" style="border-left:4px solid '+color+'">'+
          '<strong style="color:'+color+'">'+(m ? genEsc(m.nombre) : '?')+'</strong>'+
          '<span>'+(d ? genEsc(genNombreDocente(d)) : 'Sin docente')+'</span>'+
          '</div>';
      }).join('');

  document.getElementById('gen-arm-pool').innerHTML = poolHtml;
  document.getElementById('gen-arm-pool-wrapper').style.display = '';

  // Construir grid
  var horariosGrupo = _genApp.horarios.filter(function(h) {
    return String(h.grupo_id) === String(grupoId) && h.version === _genApp.version;
  });

  // Índice: dia|bloque → horario entry
  var gridMap = {};
  horariosGrupo.forEach(function(h) { gridMap[h.dia + '|' + h.bloque] = h; });

  var thead = '<tr><th class="gen-arm-th-bloque">Bloque</th>' +
    dias.map(function(d) { return '<th>'+genEsc(diasLabels[d]||d)+'</th>'; }).join('') + '</tr>';

  // Calcular minuto de inicio una sola vez (parseo robusto)
  var _timeParts = String(horaIni || '07:00').split(':');
  var _startMin  = (parseInt(_timeParts[0], 10) || 7) * 60 + (parseInt(_timeParts[1], 10) || 0);
  var _dur       = parseInt(duracion, 10) || 50;

  var tbody = '';
  for (var b = 1; b <= nBloques; b++) {
    var bMin = _startMin + (b - 1) * _dur;
    var bH   = Math.floor(bMin / 60) % 24;
    var bM   = bMin % 60;
    var bloqueLabel = 'B' + b + ' ' + String(bH).padStart(2,'0') + ':' + String(bM).padStart(2,'0');
    tbody += '<tr><td class="gen-arm-bloque-label">'+bloqueLabel+'</td>';
    dias.forEach(function(dia) {
      var key    = dia + '|' + String(b);
      var entry  = gridMap[key];
      var cellContent = '';
      var cellClass = 'gen-arm-cell';
      if (entry) {
        var m = genById(_genApp.materias, entry.materia_id);
        var d = genById(_genApp.docentes, entry.docente_id);
        var a = genById(_genApp.aulas, entry.aula_id);
        var color = m ? genGetMateriaColor(m.id) : '#94a3b8';
        cellContent = '<div class="gen-arm-cell-content" style="background:'+color+'20;border-left:3px solid '+color+'">'+
          '<span class="gen-arm-cell-mat">'+(m ? genEsc(m.nombre) : '?')+'</span>'+
          '<span class="gen-arm-cell-doc">'+(d ? genEsc(d.apellido_paterno||d.nombre) : '')+'</span>'+
          (a ? '<span class="gen-arm-cell-aula">'+genEsc(a.clave||a.nombre)+'</span>' : '')+
          '<button class="gen-arm-cell-del" onclick="genArmadoLimpiarBloque(\''+dia+'\','+b+',\''+grupoId+'\')" title="Quitar">×</button>'+
          '</div>';
        cellClass += ' gen-arm-cell-filled';
      } else {
        cellContent = '<span class="gen-arm-cell-empty">+</span>';
      }
      tbody += '<td class="'+cellClass+'" data-dia="'+dia+'" data-bloque="'+b+'" data-grupo="'+grupoId+'" onclick="genArmadoClickCell(this,\''+dia+'\','+b+',\''+grupoId+'\')">'+cellContent+'</td>';
    });
    tbody += '</tr>';
  }

  document.getElementById('gen-arm-grid-wrapper').innerHTML = `
<div class="gen-table-wrapper gen-arm-table-wrapper">
  <table class="gen-table gen-arm-table">
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
</div>`;

  // Bind pool items
  document.querySelectorAll('.gen-arm-pool-item').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('.gen-arm-pool-item').forEach(function(x) { x.classList.remove('selected'); });
      this.classList.add('selected');
    });
  });
}

// Clic en celda del grid → asignar materia seleccionada del pool
function genArmadoClickCell(cell, dia, bloque, grupoId) {
  var selectedPool = document.querySelector('.gen-arm-pool-item.selected');
  if (!selectedPool) {
    if (cell.classList.contains('gen-arm-cell-filled')) return; // ya tiene contenido, ignora
    genToast('Selecciona primero una materia del panel izquierdo.', 'info');
    return;
  }

  var materiaId  = selectedPool.dataset.materiaId;
  var docenteId  = selectedPool.dataset.docenteId || '';

  _armadoAbrirAsignacion(dia, bloque, grupoId, materiaId, docenteId);
}

function _armadoAbrirAsignacion(dia, bloque, grupoId, materiaId, docenteId) {
  var m     = genById(_genApp.materias, materiaId);
  var color = m ? genGetMateriaColor(m.id) : '#94a3b8';

  var aulaOpts = '<option value="">Sin aula</option>' + _genApp.aulas
    .filter(function(a) { return String(a.activo) !== 'false'; })
    .map(function(a) { return '<option value="'+genEsc(a.id)+'">'+genEsc(a.clave||a.nombre)+'</option>'; }).join('');

  var docenteOpts = '<option value="">Sin docente</option>' + _genApp.docentes
    .filter(function(d) { return String(d.activo) !== 'false'; })
    .map(function(d) { return '<option value="'+genEsc(d.id)+'" '+(String(d.id)===String(docenteId)?'selected':'')+'>'+genEsc(genNombreDocente(d))+'</option>'; }).join('');

  _genModal.open(
    'Asignar bloque',
    `<div style="padding:8px 0">
      <div class="gen-arm-preview-chip" style="background:${color}20;border-left:4px solid ${color};padding:8px 12px;border-radius:6px;margin-bottom:16px">
        <strong style="color:${color}">${m ? genEsc(m.nombre) : '?'}</strong>
        &nbsp;·&nbsp; Bloque ${bloque} &nbsp;·&nbsp; ${dia}
      </div>
      <div class="gen-form-grid-2">
        <div class="gen-form-group gen-span-2">
          <label class="gen-label">Docente</label>
          <select id="ga-docente" class="gen-select">${docenteOpts}</select>
        </div>
        <div class="gen-form-group gen-span-2">
          <label class="gen-label">Aula</label>
          <select id="ga-aula" class="gen-select">${aulaOpts}</select>
        </div>
      </div>
    </div>`,
    `<button class="gen-btn gen-btn-secondary" onclick="_genModal.close()">Cancelar</button>
     <button class="gen-btn gen-btn-primary" id="ga-asignar">Asignar</button>`
  );

  document.getElementById('ga-asignar').addEventListener('click', async function() {
    var record = {
      ciclo:      _genApp.ciclo,
      version:    _genApp.version,
      grupo_id:   grupoId,
      dia:        dia,
      bloque:     String(bloque),
      materia_id: materiaId,
      docente_id: document.getElementById('ga-docente').value,
      aula_id:    document.getElementById('ga-aula').value
    };
    genRequireAdmin(async function() {
      var btn = document.getElementById('ga-asignar');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await genAPI.saveHorarioFila(_genApp.adminKey, record);
        _genModal.close();
        genToast('Bloque asignado.', 'ok');
        // Refrescar horarios y reconstruir grid
        _genApp.horarios = await genAPI.getHorarios(_genApp.ciclo, _genApp.version, true);
        var cfg = await genAPI.getConfig();
        var nBloques = parseInt(cfg.num_bloques || '8');
        var dias     = (cfg.dias_semana || 'LU,MA,MI,JU,VI').split(',').map(function(d){ return d.trim(); });
        var duracion = parseInt(cfg.duracion_bloque || '50');
        _armadoCargarGrupo(grupoId, nBloques, _cfgCleanTime(cfg.hora_inicio, '07:00'), duracion, dias);
      } catch(err) {
        genToast('Error: ' + err.message, 'error');
        if (err.message.includes('administrador')) _genApp.adminKey = null;
        btn.disabled = false; btn.textContent = 'Asignar';
      }
    });
  });
}

async function genArmadoLimpiarBloque(dia, bloque, grupoId) {
  // Buscar el registro de horario
  var entry = _genApp.horarios.find(function(h) {
    return String(h.grupo_id) === String(grupoId) &&
           h.dia === dia &&
           String(h.bloque) === String(bloque) &&
           h.version === _genApp.version;
  });
  if (!entry) return;

  genRequireAdmin(async function() {
    try {
      await genAPI.deleteHorarioFila(_genApp.adminKey, entry.id);
      genToast('Bloque liberado.', 'ok');
      _genApp.horarios = await genAPI.getHorarios(_genApp.ciclo, _genApp.version, true);
      var cfg = await genAPI.getConfig();
      var nBloques = parseInt(cfg.num_bloques || '8');
      var dias     = (cfg.dias_semana || 'LU,MA,MI,JU,VI').split(',').map(function(d){ return d.trim(); });
      var duracion = parseInt(cfg.duracion_bloque || '50');
      _armadoCargarGrupo(grupoId, nBloques, _cfgCleanTime(cfg.hora_inicio, '07:00'), duracion, dias);
    } catch(err) {
      genToast('Error: ' + err.message, 'error');
    }
  });
}
