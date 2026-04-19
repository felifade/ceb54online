/* ── mod_disponibilidad.js — Disponibilidad de Docentes ───────────── */

genRegisterModule('disponibilidad', {
  async render(container) {
    if (!_genApp.ciclo) {
      container.innerHTML = '<div class="gen-empty-state"><p>Selecciona un ciclo escolar primero.</p></div>';
      return;
    }
    container.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando…</span></div>';
    try {
      var docentes = await genAPI.getDocentes();
      _genApp.docentes = docentes;
      var activos = docentes.filter(function(d) { return String(d.activo) !== 'false'; });
      container.innerHTML = _dispHTML(activos);
      _dispBind(activos);
    } catch(err) {
      genShowError('Error al cargar: ' + err.message);
    }
  }
});

var _DISP_DIAS_ = ['LU','MA','MI','JU','VI'];
var _DISP_DIAS_LABEL_ = { LU:'Lunes', MA:'Martes', MI:'Miércoles', JU:'Jueves', VI:'Viernes' };

function _dispHTML(docentes) {
  var docenteOpts = docentes.map(function(d) {
    return '<option value="'+genEsc(d.id)+'">'+genEsc(genNombreDocente(d))+'</option>';
  }).join('');

  return `
<div class="gen-page-header">
  <div>
    <h1 class="gen-page-title">Disponibilidad Docente</h1>
    <p class="gen-page-sub">Ciclo: <strong>${genEsc(_genApp.ciclo)}</strong></p>
  </div>
</div>

<div class="gen-card" style="margin-bottom:20px">
  <div class="gen-form-row" style="align-items:flex-end;gap:12px">
    <div class="gen-form-group" style="flex:1;margin:0">
      <label class="gen-label">Docente</label>
      <select id="gen-disp-docente" class="gen-select">
        <option value="">-- Selecciona un docente --</option>
        ${docenteOpts}
      </select>
    </div>
    <button class="gen-btn gen-btn-primary" id="gen-disp-cargar" disabled>Cargar disponibilidad</button>
  </div>
</div>

<div id="gen-disp-grid-wrapper"></div>`;
}

function _dispBind(docentes) {
  var sel = document.getElementById('gen-disp-docente');
  var btn = document.getElementById('gen-disp-cargar');

  sel.addEventListener('change', function() {
    btn.disabled = !this.value;
  });

  btn.addEventListener('click', async function() {
    var docenteId = sel.value;
    if (!docenteId) return;
    var wrapper = document.getElementById('gen-disp-grid-wrapper');
    wrapper.innerHTML = '<div class="gen-loading"><div class="gen-spinner"></div><span>Cargando…</span></div>';
    try {
      var dispData = await genAPI.getDisponibilidad(_genApp.ciclo, docenteId);
      var cfg      = await genAPI.getConfig(true);
      var nBloques = parseInt(cfg.num_bloques || '8');
      var horaIni  = _cfgCleanTime(cfg.hora_inicio, '07:00');
      var duracion = parseInt(cfg.duracion_bloque || '50');
      wrapper.innerHTML = _dispGridHTML(docenteId, dispData, nBloques, horaIni, duracion);
      _dispGridBind(docenteId, nBloques);
    } catch(err) {
      wrapper.innerHTML = '<div class="gen-error-state"><p>Error: ' + genEsc(err.message) + '</p></div>';
    }
  });
}

function _dispBloqueLabel(bloqueIdx, horaIni, duracion) {
  var tp  = String(horaIni || '07:00').split(':');
  var startMin = (parseInt(tp[0], 10) || 7) * 60 + (parseInt(tp[1], 10) || 0);
  var bMin = startMin + bloqueIdx * (parseInt(duracion, 10) || 50);
  return String(Math.floor(bMin / 60) % 24).padStart(2,'0') + ':' + String(bMin % 60).padStart(2,'0');
}

function _dispGridHTML(docenteId, dispData, nBloques, horaIni, duracion) {
  // Construir mapa dispData: dia|bloque → disponible/nota
  var dispMap = {};
  dispData.forEach(function(d) {
    dispMap[d.dia + '|' + d.bloque] = d;
  });

  var thead = '<tr><th>Bloque</th>' + _DISP_DIAS_.map(function(d) {
    return '<th>' + _DISP_DIAS_LABEL_[d] + '</th>';
  }).join('') + '</tr>';

  var tbody = '';
  for (var b = 1; b <= nBloques; b++) {
    var label = 'B' + b + ' · ' + _dispBloqueLabel(b - 1, horaIni, duracion);
    tbody += '<tr><td class="gen-disp-bloque-label">' + label + '</td>';
    _DISP_DIAS_.forEach(function(dia) {
      var key   = dia + '|' + String(b);
      var entry = dispMap[key];
      var avail = !entry || String(entry.disponible) !== 'NO';
      tbody += '<td class="gen-disp-cell ' + (avail ? 'gen-disp-yes' : 'gen-disp-no') + '"' +
               ' data-dia="' + dia + '" data-bloque="' + b + '" data-avail="' + avail + '"' +
               ' title="Click para cambiar">' +
               (avail ? '✓' : '✗') + '</td>';
    });
    tbody += '</tr>';
  }

  return `
<div class="gen-card">
  <div class="gen-card-header-row">
    <h3 class="gen-card-title">Disponibilidad semanal</h3>
    <div class="gen-disp-legend">
      <span class="gen-disp-yes-pill">✓ Disponible</span>
      <span class="gen-disp-no-pill">✗ No disponible</span>
    </div>
  </div>
  <p class="gen-hint" style="margin-bottom:12px">Haz clic en una celda para marcar/desmarcar disponibilidad.</p>
  <div class="gen-table-wrapper gen-disp-table-wrapper">
    <table class="gen-table gen-disp-table">
      <thead>${thead}</thead>
      <tbody id="gen-disp-tbody">${tbody}</tbody>
    </table>
  </div>
  <div class="gen-form-actions" style="margin-top:16px">
    <button class="gen-btn gen-btn-secondary" id="gen-disp-all-yes">Marcar todos disponible</button>
    <button class="gen-btn gen-btn-secondary" id="gen-disp-all-no">Marcar todos no disponible</button>
    <button class="gen-btn gen-btn-primary" id="gen-disp-guardar">Guardar disponibilidad</button>
  </div>
</div>`;
}

function _dispGridBind(docenteId, nBloques) {
  // Toggle celda
  document.querySelectorAll('#gen-disp-tbody .gen-disp-cell').forEach(function(cell) {
    cell.addEventListener('click', function() {
      var avail = this.dataset.avail === 'true';
      avail = !avail;
      this.dataset.avail = avail;
      this.className = 'gen-disp-cell ' + (avail ? 'gen-disp-yes' : 'gen-disp-no');
      this.textContent = avail ? '✓' : '✗';
    });
  });

  // Marcar todos
  document.getElementById('gen-disp-all-yes').addEventListener('click', function() {
    document.querySelectorAll('#gen-disp-tbody .gen-disp-cell').forEach(function(c) {
      c.dataset.avail = 'true';
      c.className = 'gen-disp-cell gen-disp-yes';
      c.textContent = '✓';
    });
  });
  document.getElementById('gen-disp-all-no').addEventListener('click', function() {
    document.querySelectorAll('#gen-disp-tbody .gen-disp-cell').forEach(function(c) {
      c.dataset.avail = 'false';
      c.className = 'gen-disp-cell gen-disp-no';
      c.textContent = '✗';
    });
  });

  // Guardar
  document.getElementById('gen-disp-guardar').addEventListener('click', function() {
    genRequireAdmin(async function() {
      var filas = [];
      document.querySelectorAll('#gen-disp-tbody .gen-disp-cell').forEach(function(cell) {
        filas.push({
          dia:         cell.dataset.dia,
          bloque:      cell.dataset.bloque,
          disponible:  cell.dataset.avail === 'true' ? 'SI' : 'NO',
          nota:        ''
        });
      });
      var btn = document.getElementById('gen-disp-guardar');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await genAPI.saveDisponibilidad(_genApp.adminKey, _genApp.ciclo, docenteId, filas);
        genToast('Disponibilidad guardada correctamente.', 'ok');
      } catch(err) {
        genToast('Error: ' + err.message, 'error');
        if (err.message.includes('administrador')) _genApp.adminKey = null;
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar disponibilidad';
      }
    });
  });
}
