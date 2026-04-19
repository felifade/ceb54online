// ============================================================
// print_horarios.js — Impresión / PDF institucional de Horarios
// CEB 5/4 — Módulo independiente; requiere app_horarios.js cargado
// ============================================================

// ── CONFIGURACIÓN INSTITUCIONAL ──────────────────────────────
var _PRINT_CFG = {
  sep:        'Secretaría de Educación Pública',
  subsep:     'Subsecretaría de Educación Media Superior',
  dgb:        'Dirección General del Bachillerato',
  plantel:    'Centro de Estudios de Bachillerato 5/4',
  nombrePlantel: '"Profr. Rafael Ramírez"',
  cct:        'CCT: 13DBP0001Z',
  logoSrc:    '../assets/logo.png'
};

// ── ENTRADA PÚBLICA: IMPRIMIR POR GRUPO (individual) ─────────
function horImprimirGrupo() {
  var ciclo  = (document.getElementById('sel-ciclo-grupo') || {}).value || '';
  var grupo  = (document.getElementById('sel-grupo')       || {}).value || '';
  if (!grupo) { alert('Selecciona un grupo antes de imprimir.'); return; }

  var sessions = _horData.filter(function(r){
    return (!ciclo || r.ciclo === ciclo) && r.grupo === grupo;
  });
  if (!sessions.length) { alert('No hay sesiones para este grupo.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horario Grupo ' + _pe(grupo) + '</title>' +
    _printCss('landscape') +
    '</head><body>' +
    _headerHtml('Horario de Actividades', ciclo) +
    _grupoBody(sessions, grupo, ciclo) +
    '</body></html>';

  _openPrint(html, 'Horario Grupo ' + grupo);
}

// ── ENTRADA PÚBLICA: IMPRIMIR POR DOCENTE (individual) ───────
function horImprimirDocente() {
  var ciclo   = (document.getElementById('sel-ciclo-doc') || {}).value || '';
  var docente = (document.getElementById('sel-docente')   || {}).value || '';
  if (!docente) { alert('Selecciona un docente antes de imprimir.'); return; }

  var sessions = _horData.filter(function(r){
    return (!ciclo || r.ciclo === ciclo) && r.docente === docente;
  });
  if (!sessions.length) { alert('No hay sesiones para este docente.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horario ' + _pe(docente) + '</title>' +
    _printCss('landscape') +
    '</head><body>' +
    _headerHtml('Carga Horaria Frente a Grupo', ciclo) +
    _docenteBody(sessions, docente, ciclo) +
    '</body></html>';

  _openPrint(html, 'Horario ' + docente);
}

// ── ENTRADA PÚBLICA: IMPRIMIR TODOS LOS GRUPOS ───────────────
function horImprimirTodosGrupos() {
  var ciclo  = (document.getElementById('sel-ciclo-grupo') || {}).value || '';
  var base   = ciclo ? _horData.filter(function(r){ return r.ciclo === ciclo; }) : _horData;

  var grupos = Array.from(new Set(base.map(function(r){ return r.grupo; }).filter(Boolean))).sort();
  if (!grupos.length) { alert('No hay grupos disponibles para el ciclo seleccionado.'); return; }

  var pages = [];
  grupos.forEach(function(grupo) {
    var sessions = base.filter(function(r){ return r.grupo === grupo; });
    if (!sessions.length) return;
    pages.push(
      '<div class="report-page">' +
        _headerHtml('Horario de Actividades', ciclo) +
        _grupoBody(sessions, grupo, ciclo) +
      '</div>'
    );
  });

  if (!pages.length) { alert('No se encontraron datos para generar.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horarios por Grupo' + (ciclo ? ' — ' + ciclo : '') + '</title>' +
    _printCss('landscape') +
    '</head><body>' +
    pages.join('') +
    '</body></html>';

  _openPrint(html, 'Todos los Grupos' + (ciclo ? ' ' + ciclo : ''));
}

// ── ENTRADA PÚBLICA: IMPRIMIR TODOS LOS DOCENTES ─────────────
function horImprimirTodosDocentes() {
  var ciclo = (document.getElementById('sel-ciclo-doc') || {}).value || '';
  var base  = ciclo ? _horData.filter(function(r){ return r.ciclo === ciclo; }) : _horData;

  var docentes = Array.from(new Set(base.map(function(r){ return r.docente; }).filter(Boolean))).sort();
  if (!docentes.length) { alert('No hay docentes disponibles para el ciclo seleccionado.'); return; }

  var pages = [];
  docentes.forEach(function(docente) {
    var sessions = base.filter(function(r){ return r.docente === docente; });
    if (!sessions.length) return;
    pages.push(
      '<div class="report-page">' +
        _headerHtml('Carga Horaria Frente a Grupo', ciclo) +
        _docenteBody(sessions, docente, ciclo) +
      '</div>'
    );
  });

  if (!pages.length) { alert('No se encontraron datos para generar.'); return; }

  var html = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<title>Horarios por Docente' + (ciclo ? ' — ' + ciclo : '') + '</title>' +
    _printCss('landscape') +
    '</head><body>' +
    pages.join('') +
    '</body></html>';

  _openPrint(html, 'Todos los Docentes' + (ciclo ? ' ' + ciclo : ''));
}

// ── ABRIR VENTANA DE IMPRESIÓN ───────────────────────────────
function _openPrint(html, title) {
  var win = window.open('', '_blank',
    'width=1000,height=720,scrollbars=yes,resizable=yes');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente.\n' +
          'Permite ventanas emergentes para este sitio e intenta de nuevo.');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(function() {
    win.focus();
    win.print();
  }, 1000);
}

// ── BODY: GRUPO (contenido reutilizable) ─────────────────────
function _grupoBody(sessions, grupo, ciclo) {
  var turno    = sessions[0] ? (sessions[0].turno || '') : '';
  var totalHrs = sessions.reduce(function(a,r){ return a+(parseFloat(r.horas_bloque)||0);},0);
  var semestre = _inferSemestre(grupo);
  var hrsStr   = (Math.round(totalHrs * 10) / 10) + ' hrs';

  var metaHtml =
    '<table class="meta-table"><tbody>' +
    '<tr>' +
      '<th class="meta-lbl">Grupo</th><td class="meta-val">' + _pe(grupo) + '</td>' +
      '<th class="meta-lbl">Turno</th><td class="meta-val">' + _pe(turno) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Semestre</th><td class="meta-val">' + _pe(semestre) + '</td>' +
      '<th class="meta-lbl">Ciclo escolar</th><td class="meta-val">' + _pe(ciclo) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Total horas / semana</th>' +
      '<td class="meta-val" colspan="3"><strong>' + hrsStr + '</strong></td>' +
    '</tr>' +
    '</tbody></table>';

  return metaHtml +
    '<h2 class="section-title">Distribución Semanal de Actividades</h2>' +
    _buildScheduleTable(sessions, 'grupo') +
    '<h2 class="section-title">Materias Asignadas al Grupo</h2>' +
    _materiasTableHtml(sessions, 'grupo') +
    _firmasGrupoHtml();
}

// ── BODY: DOCENTE (contenido reutilizable) ───────────────────
function _docenteBody(sessions, docente, ciclo) {
  var formacion = sessions[0] ? (sessions[0].formacion_academica || '') : '';
  var clave     = sessions[0] ? (sessions[0].clave_docente || '') : '';
  var grupos    = _uniqSorted(
    sessions.filter(function(r){ return r.componente !== 'EXTRAESCOLAR'; })
            .map(function(r){ return r.grupo; })
  );
  var totalHrs  = sessions.reduce(function(a,r){ return a+(parseFloat(r.horas_bloque)||0);},0);
  var hrsStr    = (Math.round(totalHrs * 10) / 10) + ' hrs';

  var metaHtml =
    '<table class="meta-table"><tbody>' +
    '<tr>' +
      '<th class="meta-lbl">Docente</th>' +
      '<td class="meta-val" colspan="3">' + _pe(docente) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Clave / CURP</th><td class="meta-val">' + _pe(clave) + '</td>' +
      '<th class="meta-lbl">Ciclo escolar</th><td class="meta-val">' + _pe(ciclo) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Formación académica</th><td class="meta-val">' + _pe(formacion) + '</td>' +
      '<th class="meta-lbl">Grupos atendidos</th><td class="meta-val">' + _pe(grupos.join(', ')) + '</td>' +
    '</tr><tr>' +
      '<th class="meta-lbl">Total horas / semana</th>' +
      '<td class="meta-val" colspan="3"><strong>' + hrsStr + '</strong></td>' +
    '</tr>' +
    '</tbody></table>';

  return metaHtml +
    '<h2 class="section-title">Distribución Semanal</h2>' +
    _buildScheduleTable(sessions, 'docente') +
    '<h2 class="section-title">Detalle de Carga Horaria</h2>' +
    _materiasTableHtml(sessions, 'docente') +
    _firmasDocenteHtml(docente);
}

// ── TABLA DE HORARIO (rowspan, índice-seguro) ────────────────
function _buildScheduleTable(sessions, viewType) {
  var norm = sessions.map(function(s) {
    return Object.assign({}, s, {
      hora_inicio: horFormatTime(s.hora_inicio),
      hora_fin:    horFormatTime(s.hora_fin)
    });
  });

  var times = Array.from(new Set(
    norm.map(function(r){ return r.hora_inicio; }).filter(Boolean)
  )).sort(function(a,b){ return a.localeCompare(b); });

  if (!times.length) return '<p class="no-data">Sin horarios definidos.</p>';

  var lookup = {};
  norm.forEach(function(s) {
    if (!lookup[s.dia]) lookup[s.dia] = {};
    if (!lookup[s.dia][s.hora_inicio]) lookup[s.dia][s.hora_inicio] = s;
  });

  var occ  = {};
  var dias   = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
  var labels = {LUNES:'Lunes',MARTES:'Martes',MIERCOLES:'Miércoles',
                JUEVES:'Jueves',VIERNES:'Viernes'};

  var html = '<div class="sched-wrap"><table class="sched-print">' +
    '<thead><tr><th class="th-hora">Hora</th>' +
    dias.map(function(d){ return '<th class="th-dia">' + labels[d] + '</th>'; }).join('') +
    '</tr></thead><tbody>';

  times.forEach(function(time, timeIdx) {
    html += '<tr><td class="td-hora">' + _pe(time) + '</td>';

    dias.forEach(function(day) {
      var occKey = day + '_' + timeIdx;
      if (occ[occKey]) return;

      var s = lookup[day] && lookup[day][time];
      if (s) {
        var span = 1;
        for (var k = timeIdx + 1; k < times.length; k++) {
          if (times[k] < s.hora_fin) span++;
          else break;
        }
        for (var j = 1; j < span; j++) occ[day + '_' + (timeIdx+j)] = true;

        var label, sub;
        if (viewType === 'grupo') {
          label = s.materia;
          sub   = s.docente;
        } else if (s.componente === 'EXTRAESCOLAR') {
          label = s.materia;   // nombre de la actividad
          sub   = 'Extrac.';
        } else {
          label = s.grupo;
          sub   = s.materia;
        }
        var hrsNum = parseFloat(s.horas_bloque) || 0;
        var hrsStr = (hrsNum % 1 === 0 ? String(Math.round(hrsNum)) : String(hrsNum)) + ' hr';

        html += '<td rowspan="' + span + '" class="td-session">' +
          '<div class="cell-label">' + _pe(label) + '</div>' +
          '<div class="cell-sub">' + _pe(sub) + '</div>' +
          '<div class="cell-time">' + _pe(s.hora_inicio) + '–' + _pe(s.hora_fin) +
            ' <span class="cell-hrs">(' + hrsStr + ')</span></div>' +
        '</td>';
      } else {
        html += '<td class="td-empty"></td>';
      }
    });

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// ── TABLA DE MATERIAS / CARGA (dos columnas si ≥ 4 filas) ────
function _materiasTableHtml(sessions, viewType) {
  var grouped = {};
  sessions.forEach(function(r) {
    var key = viewType === 'grupo'
      ? (r.materia + '|' + r.docente)
      : (r.grupo   + '|' + r.materia);

    if (!grouped[key]) grouped[key] = {
      materia:    r.materia,
      docente:    r.docente,
      grupo:      r.grupo,
      turno:      r.turno,
      componente: r.componente,
      hrs:        0
    };
    grouped[key].hrs += parseFloat(r.horas_bloque) || 0;
  });

  // Para docente: separar carga regular de extraescolares
  var keys = Object.keys(grouped).sort();
  var regularKeys = keys.filter(function(k){ return grouped[k].componente !== 'EXTRAESCOLAR'; });
  var extraKeys   = keys.filter(function(k){ return grouped[k].componente === 'EXTRAESCOLAR'; });

  var rows = (viewType === 'docente' ? regularKeys : keys).map(function(k) {
    var d   = grouped[k];
    var hrs = Math.round(d.hrs * 10) / 10;
    if (viewType === 'grupo') {
      return '<tr>' +
        '<td>' + _pe(d.materia)    + '</td>' +
        '<td>' + _pe(d.componente) + '</td>' +
        '<td>' + _pe(d.docente)    + '</td>' +
        '<td class="hrs-cell">' + hrs + '</td>' +
      '</tr>';
    } else {
      return '<tr>' +
        '<td>' + _pe(d.grupo)   + '</td>' +
        '<td>' + _pe(d.turno)   + '</td>' +
        '<td>' + _pe(d.materia) + '</td>' +
        '<td class="hrs-cell">' + hrs + '</td>' +
      '</tr>';
    }
  });

  var totalHrs = Math.round(
    regularKeys.reduce(function(a,k){ return a + grouped[k].hrs; }, 0) * 10
  ) / 10;
  // Si es grupo, totalHrs incluye todas las filas
  if (viewType === 'grupo') {
    totalHrs = Math.round(
      Object.keys(grouped).reduce(function(a,k){ return a + grouped[k].hrs; }, 0) * 10
    ) / 10;
  }

  var header = viewType === 'grupo'
    ? '<tr><th>Materia / UAC</th><th>Comp.</th><th>Docente</th><th>Hrs</th></tr>'
    : '<tr><th>Grupo</th><th>Turno</th><th>Materia / UAC</th><th>Hrs</th></tr>';

  var totalBar = '<p class="mat-total-bar">Total horas / semana: <strong>' + totalHrs + '</strong></p>';

  var mainTable;
  if (rows.length >= 4) {
    var half  = Math.ceil(rows.length / 2);
    var left  = rows.slice(0, half);
    var right = rows.slice(half);

    mainTable = '<table class="two-col-wrap"><tr>' +
      '<td class="two-col-cell">' +
        '<table class="mat-table"><thead>' + header + '</thead>' +
        '<tbody>' + left.join('') + '</tbody></table>' +
      '</td>' +
      '<td class="two-col-cell">' +
        '<table class="mat-table"><thead>' + header + '</thead>' +
        '<tbody>' + right.join('') + '</tbody></table>' +
      '</td>' +
    '</tr></table>' + totalBar;
  } else {
    mainTable = '<table class="mat-table">' +
      '<thead>' + header + '</thead>' +
      '<tbody>' + rows.join('') +
        '<tr class="total-row">' +
          '<td colspan="3"><strong>Total horas / semana</strong></td>' +
          '<td class="hrs-cell"><strong>' + totalHrs + '</strong></td>' +
        '</tr>' +
      '</tbody>' +
      '</table>';
  }

  // Para docente: agregar tabla de extraescolares si las hay
  if (viewType === 'docente' && extraKeys.length > 0) {
    var extRows = extraKeys.map(function(k) {
      var d   = grouped[k];
      var hrs = Math.round(d.hrs * 10) / 10;
      return '<tr><td colspan="3">' + _pe(d.materia) + '</td>' +
             '<td class="hrs-cell">' + hrs + '</td></tr>';
    });
    var extTotal = Math.round(
      extraKeys.reduce(function(a,k){ return a + grouped[k].hrs; }, 0) * 10
    ) / 10;
    mainTable +=
      '<p class="mat-ext-title">Extraescolares / Fortalecimiento</p>' +
      '<table class="mat-table">' +
        '<thead><tr><th colspan="3">Actividad</th><th>Hrs</th></tr></thead>' +
        '<tbody>' + extRows.join('') +
          '<tr class="total-row">' +
            '<td colspan="3"><strong>Total extraescolar / semana</strong></td>' +
            '<td class="hrs-cell"><strong>' + extTotal + '</strong></td>' +
          '</tr>' +
        '</tbody>' +
      '</table>';
  }

  return mainTable;
}

// ── ENCABEZADO INSTITUCIONAL ─────────────────────────────────
function _headerHtml(docTitle, ciclo) {
  return '<div class="inst-header">' +
    '<div class="inst-logo-wrap">' +
      '<img src="' + _pe(_PRINT_CFG.logoSrc) + '" alt="Logo CEB" ' +
           'style="width:62px;height:auto;" ' +
           'onerror="this.style.display=\'none\'">' +
    '</div>' +
    '<div class="inst-text">' +
      '<div class="inst-sep">'    + _pe(_PRINT_CFG.sep)    + '</div>' +
      '<div class="inst-subsep">' + _pe(_PRINT_CFG.subsep) + '</div>' +
      '<div class="inst-dgb">'    + _pe(_PRINT_CFG.dgb)    + '</div>' +
      '<div class="inst-plantel">' +
        _pe(_PRINT_CFG.plantel) + ' ' + _pe(_PRINT_CFG.nombrePlantel) +
      '</div>' +
      '<div class="inst-cct">' + _pe(_PRINT_CFG.cct) + '</div>' +
    '</div>' +
  '</div>' +
  '<div class="doc-title-bar">' +
    '<span class="doc-title">' + _pe(docTitle) + '</span>' +
    (ciclo ? '<span class="doc-ciclo">Ciclo Escolar ' + _pe(ciclo) + '</span>' : '') +
    '<span class="doc-date">Fecha: ' + _fmtDate() + '</span>' +
  '</div>';
}

// ── FIRMAS: POR GRUPO ────────────────────────────────────────
function _firmasGrupoHtml() {
  return '<div class="firmas-section">' +
    '<div class="firma-col">' +
      '<div class="firma-line"></div>' +
      '<div class="firma-label">Director(a) del Plantel</div>' +
      '<div class="firma-cargo">Vo. Bo.</div>' +
    '</div>' +
    '<div class="firma-col firma-col-sello">' +
      '<div class="sello-circle">SELLO</div>' +
    '</div>' +
    '<div class="firma-col">' +
      '<div class="firma-line"></div>' +
      '<div class="firma-label">Subdirector(a) Académico(a)</div>' +
      '<div class="firma-cargo">Elaboró</div>' +
    '</div>' +
  '</div>';
}

// ── FIRMAS: POR DOCENTE ──────────────────────────────────────
function _firmasDocenteHtml(docente) {
  return '<div class="firmas-section">' +
    '<div class="firma-col">' +
      '<div class="firma-line"></div>' +
      '<div class="firma-label">Director(a) del Plantel</div>' +
      '<div class="firma-cargo">Vo. Bo.</div>' +
    '</div>' +
    '<div class="firma-col firma-col-sello">' +
      '<div class="sello-circle">SELLO</div>' +
    '</div>' +
    '<div class="firma-col">' +
      '<div class="firma-line"></div>' +
      '<div class="firma-label">' + _pe(docente) + '</div>' +
      '<div class="firma-cargo">Docente — Enterado(a)</div>' +
    '</div>' +
  '</div>';
}

// ── CSS DE IMPRESIÓN ─────────────────────────────────────────
function _printCss(orientation) {
  return '<style>' +
    '@page { size: letter ' + orientation + '; margin: 6mm 8mm 8mm; }' +
    '*, *::before, *::after { box-sizing: border-box; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt;' +
           'color: #000; margin: 0; padding: 0; background: white; }' +

    /* ─ Salto de página entre reportes en lote ─ */
    '.report-page { page-break-after: always; break-after: page; }' +
    '.report-page:last-child { page-break-after: auto; break-after: auto; }' +

    /* ─ Encabezado institucional ─ */
    '.inst-header { display: flex; align-items: center; gap: 8pt;' +
                   'border-bottom: 2pt solid #000; padding-bottom: 4pt; margin-bottom: 3pt; }' +
    '.inst-logo-wrap { flex-shrink: 0; }' +
    '.inst-text { flex: 1; }' +
    '.inst-sep    { font-size: 6.5pt; color: #555; }' +
    '.inst-subsep { font-size: 6.5pt; color: #555; }' +
    '.inst-dgb    { font-size: 7pt; color: #333; margin-top: 1pt; }' +
    '.inst-plantel{ font-size: 9.5pt; font-weight: bold; color: #000; margin-top: 2pt; line-height: 1.2; }' +
    '.inst-cct    { font-size: 6.5pt; color: #555; margin-top: 1pt; }' +

    /* ─ Barra de título del documento ─ */
    '.doc-title-bar { display: flex; align-items: baseline; gap: 12pt;' +
                     'border-bottom: 1pt solid #888; padding: 3pt 0; margin-bottom: 3pt; }' +
    '.doc-title  { font-size: 10pt; font-weight: bold; flex: 1; }' +
    '.doc-ciclo  { font-size: 7.5pt; color: #333; }' +
    '.doc-date   { font-size: 7pt; color: #555; white-space: nowrap; }' +

    /* ─ Tabla de metadatos compacta (2 pares por fila) ─ */
    '.meta-table { width: 100%; border-collapse: collapse; margin-bottom: 4pt; font-size: 7.5pt; }' +
    '.meta-lbl { text-align: left; padding: 1.5pt 5pt 1.5pt 2pt; width: 20%; color: #555;' +
                'font-weight: normal; border-bottom: 0.5pt solid #e0e0e0; white-space: nowrap; }' +
    '.meta-val { padding: 1.5pt 8pt 1.5pt 2pt; font-weight: bold; border-bottom: 0.5pt solid #e0e0e0; width: 30%; }' +

    /* ─ Título de sección ─ */
    '.section-title { font-size: 8.5pt; font-weight: bold; text-transform: uppercase;' +
                     'letter-spacing: 0.5pt; border-bottom: 1pt solid #000;' +
                     'padding-bottom: 2pt; margin: 3pt 0 2pt; }' +

    /* ─ Tabla de horario ─ */
    '.sched-wrap { width: 100%; overflow: visible; }' +
    '.sched-print { width: 100%; border-collapse: collapse; font-size: 7pt; }' +
    '.th-hora { width: 38pt; background: #e8e8e8; font-size: 6.5pt; text-align: center;' +
               'padding: 2pt; border: 0.75pt solid #999; }' +
    '.th-dia  { background: #e8e8e8; font-size: 7.5pt; font-weight: bold; text-align: center;' +
               'padding: 2pt; border: 0.75pt solid #999; }' +
    '.td-hora { background: #f4f4f4; font-size: 6.5pt; font-weight: bold; text-align: center;' +
               'padding: 1pt; border: 0.75pt solid #bbb; white-space: nowrap; vertical-align: middle;' +
               'height: 24pt; }' +
    '.td-session { border: 0.75pt solid #999; padding: 2pt 3pt; vertical-align: top;' +
                  'border-top: 2pt solid #333; height: 24pt; overflow: hidden; }' +
    '.td-empty   { border: 0.75pt solid #ddd; background: #fafafa; height: 24pt; }' +
    '.cell-label { font-weight: bold; font-size: 7pt; line-height: 1.25; margin-bottom: 1pt;' +
                  'display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }' +
    '.cell-sub   { font-size: 6pt; color: #444; line-height: 1.2;' +
                  'display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }' +
    '.cell-time  { font-size: 5.5pt; color: #666; white-space: nowrap; }' +
    '.cell-hrs   { color: #888; }' +

    /* ─ Tabla de materias ─ */
    '.mat-table { width: 100%; border-collapse: collapse; font-size: 7pt; margin-top: 2pt; }' +
    '.mat-table thead th { background: #e8e8e8; border: 0.75pt solid #999;' +
                          'padding: 2pt 4pt; text-align: left; font-size: 6.5pt; }' +
    '.mat-table tbody td { border: 0.75pt solid #ccc; padding: 2pt 4pt; vertical-align: top; }' +
    '.mat-table .total-row td { background: #f0f0f0; border-top: 1pt solid #666; }' +
    '.hrs-cell { text-align: center; white-space: nowrap; }' +
    '.no-data  { color: #888; font-style: italic; padding: 4pt 0; font-size: 7.5pt; }' +

    /* ─ Tabla de materias en dos columnas ─ */
    '.two-col-wrap { width: 100%; border-collapse: collapse; margin-top: 2pt; }' +
    '.two-col-cell { vertical-align: top; width: 50%; }' +
    '.two-col-cell:first-child { padding-right: 4pt; }' +
    '.two-col-cell + .two-col-cell { padding-left: 4pt; }' +
    '.mat-total-bar { font-size: 7pt; text-align: right; border-top: 1pt solid #444;' +
                     'padding-top: 2pt; margin: 2pt 0 0; }' +
    '.mat-ext-title { font-size: 7.5pt; font-weight: bold; color: #475569;' +
                     'border-top: 0.75pt solid #94a3b8; margin: 6pt 0 2pt;' +
                     'padding-top: 4pt; text-transform: uppercase; letter-spacing: 0.4pt; }' +

    /* ─ Sección de firmas ─ */
    '.firmas-section { display: flex; justify-content: space-between; align-items: flex-end;' +
                      'margin-top: 8pt; gap: 8pt; page-break-inside: avoid; break-inside: avoid; }' +
    '.firma-col { flex: 1; text-align: center; }' +
    '.firma-col-sello { flex: 0 0 auto; width: 50pt; }' +
    '.firma-line { border-bottom: 1pt solid #000; height: 16pt; margin-bottom: 3pt; }' +
    '.firma-label { font-size: 7.5pt; font-weight: bold; }' +
    '.firma-cargo { font-size: 6.5pt; color: #555; margin-top: 1pt; }' +
    '.sello-circle { width: 38pt; height: 38pt; border: 1.5pt dashed #999; border-radius: 50%;' +
                    'display: flex; align-items: center; justify-content: center;' +
                    'margin: 0 auto; font-size: 6pt; color: #bbb; letter-spacing: 1pt; }' +

    /* ─ Impresión ─ */
    '@media print {' +
      'body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      '.td-session { border-top-color: #555 !important; }' +
      'h2.section-title, .firmas-section { page-break-inside: avoid; break-inside: avoid; }' +
      'h2.section-title { page-break-after: avoid; break-after: avoid; }' +
    '}' +
  '</style>';
}

// ── HELPERS ───────────────────────────────────────────────────
function _pe(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function _fmtDate() {
  var d  = new Date();
  var dd = ('0' + d.getDate()).slice(-2);
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  var yy = d.getFullYear();
  return dd + '/' + mm + '/' + yy;
}

/** "M201" → "2° Semestre", "V301" → "3° Semestre", etc. */
function _inferSemestre(grupo) {
  var m = String(grupo).match(/[A-Z](\d)(\d{2})/i);
  if (!m) return '';
  var num = parseInt(m[1], 10);
  if (!num || num < 1 || num > 6) return '';
  return num + '\u00b0 Semestre';
}
