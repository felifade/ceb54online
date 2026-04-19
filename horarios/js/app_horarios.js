// ============================================================
// app_horarios.js — Módulo de Horarios CEB 5/4
// Independiente: no importa ni modifica código de otros módulos
// ============================================================

// ── PALETA DE COLORES POR MATERIA/GRUPO ──────────────────────
const _HOR_PALETTE = [
  { bg:'#eff6ff', border:'#3b82f6', text:'#1e40af' },
  { bg:'#f0fdf4', border:'#22c55e', text:'#15803d' },
  { bg:'#fef9c3', border:'#ca8a04', text:'#713f12' },
  { bg:'#fdf4ff', border:'#a855f7', text:'#6b21a8' },
  { bg:'#fff7ed', border:'#ea580c', text:'#7c2d12' },
  { bg:'#f0fdfa', border:'#0d9488', text:'#115e59' },
  { bg:'#fef2f2', border:'#dc2626', text:'#7f1d1d' },
  { bg:'#fefce8', border:'#d97706', text:'#78350f' },
  { bg:'#f0f9ff', border:'#0284c7', text:'#0c4a6e' },
  { bg:'#fff1f2', border:'#e11d48', text:'#881337' },
  { bg:'#ecfdf5', border:'#059669', text:'#064e3b' },
  { bg:'#f5f3ff', border:'#7c3aed', text:'#4c1d95' },
];
const _horColorMap = {};
let   _horColorCtr = 0;

function horColor(label) {
  if (!label) return _HOR_PALETTE[0];
  if (_horColorMap[label] === undefined)
    _horColorMap[label] = _horColorCtr++ % _HOR_PALETTE.length;
  return _HOR_PALETTE[_horColorMap[label]];
}

// ── ORDEN DE DÍAS ────────────────────────────────────────────
const HOR_DIAS_ORDER = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
const HOR_DIAS_LABEL = {
  LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles',
  JUEVES:'Jueves', VIERNES:'Viernes'
};
const HOR_DIAS_SHORT = {
  LUNES:'Lun', MARTES:'Mar', MIERCOLES:'Mié',
  JUEVES:'Jue', VIERNES:'Vie'
};

// ── ESTADO ───────────────────────────────────────────────────
let _horData    = [];   // HORARIOS_WEB completo
let _horActiveTab = 'grupo';

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {

  // Verificar que la URL está configurada
  if (HORARIOS_API_URL.includes('REEMPLAZAR')) {
    horShowLoading(false);
    horShowError(
      'URL del API no configurada. ' +
      'Abre <code>horarios/js/api_horarios.js</code> y reemplaza ' +
      '<code>REEMPLAZAR_CON_URL_DE_GAS_HORARIOS</code> ' +
      'con la URL de tu deployment de Apps Script.'
    );
    return;
  }

  // Tabs
  document.querySelectorAll('.hor-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { horSwitchTab(btn.dataset.tab); });
  });

  // Botón regenerar
  var btnRegen = document.getElementById('btn-regenerar');
  if (btnRegen) btnRegen.addEventListener('click', horHandleRegen);

  // Selects de grupo
  var selCicloGrupo = document.getElementById('sel-ciclo-grupo');
  var selGrupo      = document.getElementById('sel-grupo');
  if (selCicloGrupo) selCicloGrupo.addEventListener('change', function() {
    horPopulateGrupos();
    horRenderGrupoView();
  });
  if (selGrupo) selGrupo.addEventListener('change', horRenderGrupoView);

  // Selects de docente
  var selCicloDoc = document.getElementById('sel-ciclo-doc');
  var selDocente  = document.getElementById('sel-docente');
  if (selCicloDoc) selCicloDoc.addEventListener('change', function() {
    horPopulateDocentes();
    horRenderDocenteView();
  });
  if (selDocente) selDocente.addEventListener('change', horRenderDocenteView);

  // Filtros generales
  var searchGen  = document.getElementById('search-gen');
  var filterDia  = document.getElementById('filter-dia-gen');
  if (searchGen) searchGen.addEventListener('input', horRenderGeneralView);
  if (filterDia) filterDia.addEventListener('change', horRenderGeneralView);

  // Cargar datos
  horShowLoading(true);
  try {
    _horData = await horariosAPI.getHorariosWeb();
    horShowLoading(false);
    horInitApp();
  } catch (err) {
    horShowLoading(false);
    horShowError(err.message);
  }
});

function horInitApp() {
  document.getElementById('hor-main').style.display = '';
  horPopulateCiclos('sel-ciclo-grupo');
  horPopulateCiclos('sel-ciclo-doc');
  horPopulateGrupos();
  horPopulateDocentes();
  horRenderGrupoView();
}

// ── POBLAR SELECTS ────────────────────────────────────────────
function horGetCiclos() {
  return Array.from(new Set(_horData.map(function(r){ return r.ciclo; }).filter(Boolean)))
    .sort().reverse();
}

function horPopulateCiclos(selId) {
  var sel = document.getElementById(selId);
  if (!sel) return;
  var ciclos = horGetCiclos();
  sel.innerHTML = ciclos.length
    ? ciclos.map(function(c){ return '<option value="'+horEsc(c)+'">'+horEsc(c)+'</option>'; }).join('')
    : '<option value="">Sin datos</option>';
}

function horPopulateGrupos() {
  var ciclo = (document.getElementById('sel-ciclo-grupo') || {}).value || '';
  var sel   = document.getElementById('sel-grupo');
  if (!sel) return;
  var grupos = Array.from(new Set(
    _horData.filter(function(r){ return !ciclo || r.ciclo === ciclo; })
            .map(function(r){ return r.grupo; }).filter(Boolean)
  )).sort();
  sel.innerHTML = grupos.length
    ? grupos.map(function(g){ return '<option value="'+horEsc(g)+'">'+horEsc(g)+'</option>'; }).join('')
    : '<option value="">Sin grupos</option>';
}

function horPopulateDocentes() {
  var ciclo = (document.getElementById('sel-ciclo-doc') || {}).value || '';
  var sel   = document.getElementById('sel-docente');
  if (!sel) return;
  var docentes = Array.from(new Set(
    _horData.filter(function(r){ return !ciclo || r.ciclo === ciclo; })
            .map(function(r){ return r.docente; }).filter(Boolean)
  )).sort();
  sel.innerHTML = docentes.length
    ? docentes.map(function(d){ return '<option value="'+horEsc(d)+'">'+horEsc(d)+'</option>'; }).join('')
    : '<option value="">Sin docentes</option>';
}

// ── TABS ─────────────────────────────────────────────────────
function horSwitchTab(tab) {
  _horActiveTab = tab;
  document.querySelectorAll('.hor-tab-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.hor-tab-pane').forEach(function(p){
    p.classList.toggle('active', p.id === 'pane-' + tab);
  });
  if (tab === 'grupo')   horRenderGrupoView();
  if (tab === 'docente') horRenderDocenteView();
  if (tab === 'general') horRenderGeneralView();
}

// ── VISTA: POR GRUPO ─────────────────────────────────────────
function horRenderGrupoView() {
  var ciclo = (document.getElementById('sel-ciclo-grupo') || {}).value || '';
  var grupo = (document.getElementById('sel-grupo')       || {}).value || '';
  var out   = document.getElementById('view-grupo');
  if (!out) return;

  if (!grupo) {
    out.innerHTML = '<p class="hor-hint">Selecciona un ciclo y grupo para ver el horario.</p>';
    return;
  }

  var sessions = _horData.filter(function(r){
    return (!ciclo || r.ciclo === ciclo) && r.grupo === grupo;
  });

  if (!sessions.length) {
    out.innerHTML = '<p class="hor-hint">No hay sesiones registradas para este grupo. Verifica que <code>HORARIOS_WEB</code> tenga datos.</p>';
    return;
  }

  var materias  = Array.from(new Set(sessions.map(function(r){ return r.materia; }).filter(Boolean))).sort();
  var docentes  = Array.from(new Set(sessions.map(function(r){ return r.docente; }).filter(Boolean))).sort();
  var totalHrs  = sessions.reduce(function(a,r){ return a + (parseFloat(r.horas_bloque)||0); }, 0);
  var turno     = sessions[0] ? (sessions[0].turno || '') : '';

  out.innerHTML =
    '<div class="hor-summary-bar">' +
      horSumChip(grupo, 'Grupo') +
      (turno ? horSumChip(turno, 'Turno') : '') +
      horSumChip(String(materias.length), 'Materias') +
      horSumChip(String(docentes.length), 'Docentes') +
      horSumChip(String(Math.round(totalHrs*10)/10), 'Hrs/sem') +
      '<button class="hor-print-btn" onclick="horImprimirGrupo()">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>' +
        ' Imprimir / PDF' +
      '</button>' +
    '</div>' +
    '<h3 class="hor-section-title">Horario Semanal</h3>' +
    horRenderGrid(sessions, 'grupo') +
    '<h3 class="hor-section-title" style="margin-top:2rem;">Materias del Grupo</h3>' +
    horRenderMateriasList(sessions);
}

// ── VISTA: POR DOCENTE ────────────────────────────────────────
function horRenderDocenteView() {
  var ciclo   = (document.getElementById('sel-ciclo-doc') || {}).value || '';
  var docente = (document.getElementById('sel-docente')   || {}).value || '';
  var out     = document.getElementById('view-docente');
  if (!out) return;

  if (!docente) {
    out.innerHTML = '<p class="hor-hint">Selecciona un ciclo y docente para ver el horario.</p>';
    return;
  }

  var sessions = _horData.filter(function(r){
    return (!ciclo || r.ciclo === ciclo) && r.docente === docente;
  });

  if (!sessions.length) {
    out.innerHTML = '<p class="hor-hint">No hay sesiones registradas para este docente.</p>';
    return;
  }

  var grupos    = Array.from(new Set(
    sessions.filter(function(r){ return r.componente !== 'EXTRAESCOLAR'; })
            .map(function(r){ return r.grupo; }).filter(Boolean)
  )).sort();
  var materias  = Array.from(new Set(sessions.map(function(r){ return r.materia; }).filter(Boolean))).sort();
  var totalHrs  = sessions.reduce(function(a,r){ return a + (parseFloat(r.horas_bloque)||0); }, 0);
  var extSessions = sessions.filter(function(r){ return r.componente === 'EXTRAESCOLAR'; });
  var formacion = sessions[0] ? (sessions[0].formacion_academica || '') : '';

  out.innerHTML =
    '<div class="hor-docente-header">' +
      '<div class="hor-docente-avatar">' + horInitials(docente) + '</div>' +
      '<div>' +
        '<div class="hor-docente-name">' + horEsc(docente) + '</div>' +
        (formacion ? '<div class="hor-docente-form">' + horEsc(formacion) + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="hor-summary-bar">' +
      horSumChip(String(grupos.length), 'Grupos') +
      horSumChip(String(materias.length), 'Materias') +
      horSumChip(String(Math.round(totalHrs*10)/10), 'Hrs/sem') +
      (extSessions.length ? horSumChip(String(extSessions.length), 'Extraesc.') : '') +
      '<button class="hor-print-btn" onclick="horImprimirDocente()">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>' +
        ' Imprimir / PDF' +
      '</button>' +
    '</div>' +
    '<h3 class="hor-section-title">Horario Semanal</h3>' +
    horRenderGrid(sessions, 'docente') +
    '<h3 class="hor-section-title" style="margin-top:2rem;">Grupos y Materias</h3>' +
    horRenderGruposMatList(sessions);
}

// ── VISTA: GENERAL ────────────────────────────────────────────
function horRenderGeneralView() {
  var search = ((document.getElementById('search-gen') || {}).value || '').toLowerCase().trim();
  var dia    = (document.getElementById('filter-dia-gen') || {}).value || '';
  var out    = document.getElementById('view-general');
  if (!out) return;

  var rows = _horData;
  if (dia)    rows = rows.filter(function(r){ return r.dia === dia; });
  if (search) rows = rows.filter(function(r){
    return [r.grupo, r.materia, r.docente, r.dia, r.hora_inicio, r.ciclo, r.turno]
      .some(function(v){ return String(v).toLowerCase().indexOf(search) >= 0; });
  });

  // Ordenar: ciclo desc, grupo, día, hora
  rows = rows.slice().sort(function(a, b) {
    if (a.ciclo !== b.ciclo) return String(b.ciclo).localeCompare(String(a.ciclo));
    if (a.grupo !== b.grupo) return String(a.grupo).localeCompare(String(b.grupo));
    var di = HOR_DIAS_ORDER.indexOf(a.dia) - HOR_DIAS_ORDER.indexOf(b.dia);
    if (di !== 0) return di;
    return String(a.hora_inicio).localeCompare(String(b.hora_inicio));
  });

  if (!rows.length) {
    out.innerHTML = '<p class="hor-hint">No se encontraron sesiones con los filtros aplicados.</p>';
    return;
  }

  var tbody = rows.map(function(r) {
    var dc = horColor(r.dia);
    return '<tr>' +
      '<td>' + horEsc(r.ciclo) + '</td>' +
      '<td><span class="hor-badge-grupo">' + horEsc(r.grupo) + '</span></td>' +
      '<td>' + horEsc(r.turno) + '</td>' +
      '<td>' + horEsc(r.materia) + '</td>' +
      '<td>' + horEsc(r.docente) + '</td>' +
      '<td><span class="hor-badge-dia" style="background:' + dc.bg + ';color:' + dc.text + ';">' + horEsc(r.dia) + '</span></td>' +
      '<td class="hor-mono">' + horEsc(horFormatTime(r.hora_inicio)) + '</td>' +
      '<td class="hor-mono">' + horEsc(horFormatTime(r.hora_fin)) + '</td>' +
      '<td class="hor-mono">' + horEsc(r.horas_bloque) + '</td>' +
    '</tr>';
  }).join('');

  out.innerHTML =
    '<div class="hor-gen-count">' + rows.length + ' sesión' + (rows.length !== 1 ? 'es' : '') + ' encontrada' + (rows.length !== 1 ? 's' : '') + '</div>' +
    '<div class="hor-gen-table-wrap">' +
    '<table class="hor-gen-table">' +
    '<thead><tr>' +
      '<th>Ciclo</th><th>Grupo</th><th>Turno</th>' +
      '<th>Materia</th><th>Docente</th>' +
      '<th>Día</th><th>Inicio</th><th>Fin</th><th>Hrs</th>' +
    '</tr></thead>' +
    '<tbody>' + tbody + '</tbody>' +
    '</table></div>';
}

// ── GRID DE HORARIO SEMANAL ───────────────────────────────────
function horRenderGrid(sessions, viewType) {
  if (!sessions.length)
    return '<p class="hor-hint">Sin sesiones para mostrar.</p>';

  // Normalizar horas de todas las sesiones antes de cualquier operación
  sessions = sessions.map(function(s) {
    return Object.assign({}, s, {
      hora_inicio: horFormatTime(s.hora_inicio),
      hora_fin:    horFormatTime(s.hora_fin)
    });
  });

  // Horas únicas de inicio, ordenadas lexicográficamente (HH:MM ordena bien)
  var times = Array.from(new Set(
    sessions.map(function(r){ return r.hora_inicio; }).filter(Boolean)
  )).sort(function(a, b){ return a.localeCompare(b); });

  if (!times.length)
    return '<p class="hor-hint">Sin horarios definidos.</p>';

  // Lookup: dia -> hora_inicio -> sesión (solo la primera si hubiera duplicados)
  var lookup = {};
  sessions.forEach(function(s) {
    if (!lookup[s.dia]) lookup[s.dia] = {};
    if (!lookup[s.dia][s.hora_inicio]) lookup[s.dia][s.hora_inicio] = s;
  });

  // ── OCUPACIÓN POR ÍNDICE ─────────────────────────────────────
  // Clave: "LUNES_2" = columna LUNES, slot índice 2.
  // Usar índices evita el bug del string calculado que no coincide
  // con el siguiente slot real, lo que generaba una columna fantasma
  // en VIERNES (último día, el más expuesto al desplazamiento acumulado).
  var occ = {};

  var html =
    '<div class="sched-scroll">' +
    '<table class="sched-table">' +
    '<thead><tr>' +
      '<th class="sched-th-time"></th>' +
      HOR_DIAS_ORDER.map(function(d){
        return '<th class="sched-th-day">' + HOR_DIAS_SHORT[d] + '</th>';
      }).join('') +
    '</tr></thead><tbody>';

  times.forEach(function(time, timeIdx) {
    html += '<tr>';
    html += '<td class="sched-td-time">' + horEsc(time) + '</td>';

    HOR_DIAS_ORDER.forEach(function(day) {
      // La clave usa el ÍNDICE del slot, no un string de hora calculado
      var occKey = day + '_' + timeIdx;
      if (occ[occKey]) return; // cubierto por rowspan de fila anterior

      var s = lookup[day] && lookup[day][time];
      if (s) {
        // Calcular rowspan contando cuántos slots caen dentro de [hora_inicio, hora_fin)
        // Esto es robusto aunque los slots no sean exactamente cada 60 min
        var span = 1;
        for (var k = timeIdx + 1; k < times.length; k++) {
          if (times[k] < s.hora_fin) span++;
          else break;
        }

        // Marcar los siguientes (span-1) slots de ESTE día como ocupados por índice
        for (var j = 1; j < span; j++) {
          occ[day + '_' + (timeIdx + j)] = true;
        }

        var label, sub;
        if (viewType === 'grupo') {
          label = s.materia;
          sub   = s.docente;
        } else if (s.componente === 'EXTRAESCOLAR') {
          label = s.materia;   // nombre de la actividad
          sub   = 'Extraescolar';
        } else {
          label = s.grupo;
          sub   = s.materia;
        }
        var c       = horColor(label);
        // Número de horas legible: "2h", "1.5h", etc.
        var hrsNum  = parseFloat(s.horas_bloque) || 0;
        var hrsStr  = (hrsNum % 1 === 0 ? String(Math.round(hrsNum)) : String(hrsNum)) + 'h';
        // Tooltip para ver nombre completo al pasar el cursor
        var tooltip = horEsc(label) + ' · ' + horEsc(sub) +
                      ' · ' + horEsc(s.hora_inicio) + '–' + horEsc(s.hora_fin) +
                      ' (' + hrsStr + ')';

        html +=
          '<td rowspan="' + span + '" class="sched-td-session"' +
              ' title="' + tooltip + '"' +
              ' style="background:' + c.bg + '; border-top:3px solid ' + c.border + '; cursor:default;">' +
            '<div class="sched-label" style="color:' + c.text + ';">' + horEsc(label) + '</div>' +
            '<div class="sched-sub">' + horEsc(sub) + '</div>' +
            '<div class="sched-time-tag">' +
              horEsc(s.hora_inicio) + '–' + horEsc(s.hora_fin) +
              '<span class="sched-hrs-badge">' + hrsStr + '</span>' +
            '</div>' +
          '</td>';
      } else {
        html += '<td class="sched-td-empty"></td>';
      }
    });

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// ── LISTAS DE RESUMEN ─────────────────────────────────────────
function horRenderMateriasList(sessions) {
  var byMat = {};
  sessions.forEach(function(r) {
    if (!byMat[r.materia]) byMat[r.materia] = {
      docente:    r.docente,
      componente: r.componente,
      total:      r.total_horas_materia,
      sesiones:   0
    };
    byMat[r.materia].sesiones++;
  });

  var cards = Object.keys(byMat).sort().map(function(mat) {
    var info = byMat[mat];
    var c    = horColor(mat);
    return '<div class="hor-mat-card" style="border-left:4px solid ' + c.border + '; background:' + c.bg + ';">' +
      '<div class="hor-mat-name" style="color:' + c.text + ';">' + horEsc(mat) + '</div>' +
      '<div class="hor-mat-docente">' + horEsc(info.docente) + '</div>' +
      (info.componente ? '<div class="hor-mat-comp">' + horEsc(info.componente) + '</div>' : '') +
      (info.total ? '<div class="hor-mat-hrs">' + horEsc(info.total) + ' hrs totales</div>' : '') +
    '</div>';
  }).join('');

  return '<div class="hor-mat-grid">' + cards + '</div>';
}

function horRenderGruposMatList(sessions) {
  var byGrupo = {};
  var extActs = {};   // actividades extraescolares separadas

  sessions.forEach(function(r) {
    if (r.componente === 'EXTRAESCOLAR') {
      var key = r.materia || '(sin nombre)';
      if (!extActs[key]) extActs[key] = { hrs: 0 };
      extActs[key].hrs += parseFloat(r.horas_bloque) || 0;
      return;
    }
    if (!byGrupo[r.grupo]) byGrupo[r.grupo] = {
      materias: [],
      turno:    r.turno,
      hrs:      0
    };
    if (byGrupo[r.grupo].materias.indexOf(r.materia) < 0)
      byGrupo[r.grupo].materias.push(r.materia);
    byGrupo[r.grupo].hrs += parseFloat(r.horas_bloque) || 0;
  });

  var cards = Object.keys(byGrupo).sort().map(function(grupo) {
    var info = byGrupo[grupo];
    var c    = horColor(grupo);
    return '<div class="hor-mat-card" style="border-left:4px solid ' + c.border + '; background:' + c.bg + ';">' +
      '<div class="hor-mat-name" style="color:' + c.text + ';">' + horEsc(grupo) + '</div>' +
      (info.turno ? '<div class="hor-mat-comp">' + horEsc(info.turno) + '</div>' : '') +
      '<div class="hor-mat-docente">' + info.materias.sort().map(horEsc).join(' · ') + '</div>' +
      '<div class="hor-mat-hrs">' + Math.round(info.hrs * 10) / 10 + ' hrs / semana</div>' +
    '</div>';
  }).join('');

  // Tarjetas de extraescolares
  var extCards = Object.keys(extActs).sort().map(function(act) {
    var info = extActs[act];
    return '<div class="hor-mat-card" style="border-left:4px solid #94a3b8; background:#f8fafc;">' +
      '<div class="hor-mat-name" style="color:#475569;">' + horEsc(act) + '</div>' +
      '<div class="hor-mat-comp" style="color:#94a3b8;">Extraescolar / Fortalecimiento</div>' +
      '<div class="hor-mat-hrs">' + Math.round(info.hrs * 10) / 10 + ' hrs / semana</div>' +
    '</div>';
  }).join('');

  var extSection = extCards
    ? '<h3 class="hor-section-title" style="margin-top:1.5rem;">Extraescolares / Fortalecimiento</h3>' +
      '<div class="hor-mat-grid">' + extCards + '</div>'
    : '';

  return '<div class="hor-mat-grid">' + cards + '</div>' + extSection;
}

// ── REGENERAR ─────────────────────────────────────────────────
async function horHandleRegen() {
  var key = window.prompt('Clave de administrador\n(definida en HORARIOS_ADMIN_KEY_ del GAS):');
  if (!key) return;

  var btn = document.getElementById('btn-regenerar');
  btn.disabled    = true;
  btn.textContent = 'Procesando...';

  try {
    var result = await horariosAPI.regenerar(key);
    if (result.status === 'ok') {
      window.alert('✅ ' + result.message);
      horariosAPI.clearCache();
      // Limpiar colores para reasignar desde cero con los datos nuevos
      Object.keys(_horColorMap).forEach(function(k){ delete _horColorMap[k]; });
      _horColorCtr = 0;
      _horData = await horariosAPI.getHorariosWeb(true);
      horInitApp();
    } else {
      window.alert('❌ ' + result.message);
    }
  } catch (err) {
    window.alert('Error al regenerar: ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Regenerar HORARIOS_WEB';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// ── LOADING / ERROR ───────────────────────────────────────────
function horShowLoading(on) {
  var el = document.getElementById('hor-loading');
  if (el) el.style.display = on ? '' : 'none';
}

function horShowError(msg) {
  var el = document.getElementById('hor-error');
  if (!el) return;
  el.style.display = '';
  el.innerHTML =
    '<div class="hor-error-box">' +
      '<div style="font-size:1.5rem; margin-bottom:0.5rem;">⚠️</div>' +
      '<strong>No se pudo cargar el módulo de Horarios.</strong><br>' +
      '<p style="margin:0.5rem 0 0; font-size:0.85rem; color:#64748b;">' + msg + '</p>' +
    '</div>';
}

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Normaliza cualquier valor de hora a string "HH:MM".
 * Maneja tres casos:
 *   1. Ya es "07:00" → lo devuelve tal cual
 *   2. Es un ISO string "1899-12-30T07:00:00.000Z" → extrae la hora UTC
 *   3. Es un Date object → extrae getHours/getMinutes
 */
function horFormatTime(v) {
  if (!v && v !== 0) return '';
  // Objeto Date (raro pero defensivo)
  if (v instanceof Date) {
    return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  }
  var s = String(v).trim();
  // ISO string con T (ej. "1899-12-30T07:00:00.000Z")
  if (s.indexOf('T') !== -1) {
    // Usar UTC porque Sheets serializa las horas en UTC al hacer JSON.stringify de un Date
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
    }
  }
  // Ya tiene formato HH:MM — normalizar cero inicial si falta
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    var parts = s.split(':');
    return ('0' + parseInt(parts[0], 10)).slice(-2) + ':' + parts[1];
  }
  return s;
}

function horEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function horInitials(name) {
  return String(name || '').split(/\s+/).slice(0,2)
    .map(function(w){ return w[0] || ''; }).join('').toUpperCase();
}

function horSumChip(val, lbl) {
  return '<div class="hor-sum-chip">' +
    '<span class="hor-sum-val">' + horEsc(val) + '</span>' +
    '<span class="hor-sum-lbl">' + horEsc(lbl) + '</span>' +
  '</div>';
}
