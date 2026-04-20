/* ─────────────────────────────────────────────────────────────────────────
   horario-doc.js — Visor de Horario Definitivo para Portal de Tutorías
   Lee HORARIOS_WEB desde el GAS de Horarios (solo lectura).
   Separado deliberadamente del módulo de Horario Provisional (futuro).
──────────────────────────────────────────────────────────────────────────── */

var HD_URL      = 'https://script.google.com/macros/s/AKfycbyQUyTVSi3-IxFpHR_ySzjaW5AxmXEiI29bVve4IixeKyOwtohWO-kreg8ycl0jFphw/exec';
var HD_CACHE    = null;
var HD_CACHE_TS = 0;
var HD_CACHE_TTL = 15 * 60 * 1000;
var HD_COLOR_MAP = {};
var HD_COLOR_IDX = 0;

var HD_DIAS       = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
var HD_DIAS_LABEL = { LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles', JUEVES:'Jueves', VIERNES:'Viernes' };
var HD_DIAS_SHORT = { LUNES:'Lun', MARTES:'Mar', MIERCOLES:'Mié', JUEVES:'Jue', VIERNES:'Vie' };

var HD_PALETTE = [
  { bg:'#eff6ff', border:'#3b82f6', text:'#1e40af' },
  { bg:'#f0fdf4', border:'#22c55e', text:'#166534' },
  { bg:'#fef9c3', border:'#ca8a04', text:'#713f12' },
  { bg:'#fdf4ff', border:'#a855f7', text:'#6b21a8' },
  { bg:'#fff7ed', border:'#f97316', text:'#7c2d12' },
  { bg:'#f0fdfa', border:'#0d9488', text:'#134e4a' },
  { bg:'#fef2f2', border:'#ef4444', text:'#7f1d1d' },
  { bg:'#fefce8', border:'#eab308', text:'#854d0e' },
  { bg:'#f0f9ff', border:'#0ea5e9', text:'#0c4a6e' },
  { bg:'#fff1f2', border:'#f43f5e', text:'#881337' },
  { bg:'#ecfdf5', border:'#10b981', text:'#064e3b' },
  { bg:'#f5f3ff', border:'#8b5cf6', text:'#4c1d95' }
];

// ── Helpers ───────────────────────────────────────────────────────────────
function hdEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function hdNorm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

function hdColor(label) {
  if (!label) return HD_PALETTE[0];
  if (HD_COLOR_MAP[label] === undefined)
    HD_COLOR_MAP[label] = HD_COLOR_IDX++ % HD_PALETTE.length;
  return HD_PALETTE[HD_COLOR_MAP[label]];
}

function hdFmtTime(t) {
  if (t === null || t === undefined || t === '') return '';
  var n = parseFloat(t);
  if (!isNaN(n) && n > 0 && n < 1) {
    var h = Math.floor(n * 24);
    var m = Math.round((n * 24 - h) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  var s = String(t).trim();
  if (/^\d+:\d+/.test(s)) return s.substring(0, 5);
  return s;
}

// ── Fetch con caché ───────────────────────────────────────────────────────
function hdFetch(force) {
  if (!force && HD_CACHE && (Date.now() - HD_CACHE_TS) < HD_CACHE_TTL)
    return Promise.resolve(HD_CACHE);
  var url = HD_URL + '?action=getHorariosWeb&_t=' + Date.now();
  return fetch(url, { method: 'GET', redirect: 'follow' })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      if (json.status === 'error') throw new Error(json.message || 'Error del servidor');
      HD_CACHE    = json.data || [];
      HD_CACHE_TS = Date.now();
      return HD_CACHE;
    });
}

// ── Render del grid semanal ───────────────────────────────────────────────
function hdRenderGrid(sessions) {
  var norm = sessions.map(function(s) {
    return {
      dia:          s.dia,
      grupo:        s.grupo,
      materia:      s.materia,
      componente:   s.componente,
      hora_inicio:  hdFmtTime(s.hora_inicio),
      hora_fin:     hdFmtTime(s.hora_fin),
      horas_bloque: s.horas_bloque
    };
  });

  var timesSet = {};
  norm.forEach(function(r) { if (r.hora_inicio) timesSet[r.hora_inicio] = true; });
  var times = Object.keys(timesSet).sort(function(a, b) { return a.localeCompare(b); });
  if (!times.length) return '<div class="hd-empty">Sin horarios definidos en los datos.</div>';

  var lookup = {};
  norm.forEach(function(s) {
    if (!lookup[s.dia]) lookup[s.dia] = {};
    if (!lookup[s.dia][s.hora_inicio]) lookup[s.dia][s.hora_inicio] = s;
  });

  var activeDias = HD_DIAS.filter(function(d) {
    return norm.some(function(s) { return s.dia === d; });
  });

  var ths = activeDias.map(function(d) {
    return '<th class="hd-th-day">' +
      '<span class="hd-day-full">'  + HD_DIAS_LABEL[d] + '</span>' +
      '<span class="hd-day-short">' + HD_DIAS_SHORT[d] + '</span>' +
    '</th>';
  }).join('');

  var occ  = {};
  var rows = '';

  times.forEach(function(time, ti) {
    rows += '<tr>';
    rows += '<td class="hd-time">' + hdEsc(time) + '</td>';

    activeDias.forEach(function(day) {
      if (occ[day + '_' + ti]) return;

      var s = lookup[day] && lookup[day][time];
      if (s) {
        var span = 1;
        for (var k = ti + 1; k < times.length; k++) {
          if (times[k] < s.hora_fin) span++;
          else break;
        }
        for (var j = 1; j < span; j++) occ[day + '_' + (ti + j)] = true;

        var isExtra = s.componente === 'EXTRAESCOLAR';
        var c       = hdColor(s.grupo);
        var hrs     = parseFloat(s.horas_bloque) || 0;
        var hrsStr  = (hrs % 1 === 0 ? String(Math.round(hrs)) : String(hrs)) + 'h';
        var cls     = 'hd-cell' + (isExtra ? ' hd-cell-extra' : '');
        var style   = '--hd-bg:' + c.bg + ';--hd-border:' + c.border + ';--hd-text:' + c.text;

        rows +=
          '<td rowspan="' + span + '" class="' + cls + '" style="' + style + ';">' +
            '<div class="hd-cell-inner">' +
              '<div class="hd-cell-grupo">' + hdEsc(s.grupo || '—') + '</div>' +
              (s.materia ? '<div class="hd-cell-mat">' + hdEsc(s.materia) + '</div>' : '') +
              '<div class="hd-cell-footer">' +
                '<span class="hd-cell-hrs">' + hrsStr + '</span>' +
                (s.hora_fin ? '<span class="hd-cell-range">\u00a0' + hdEsc(time) + '–' + hdEsc(s.hora_fin) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</td>';
      } else {
        rows += '<td class="hd-cell hd-cell-empty"></td>';
      }
    });

    rows += '</tr>';
  });

  return (
    '<div class="hd-scroll-wrap">' +
      '<table class="hd-table">' +
        '<thead><tr>' +
          '<th class="hd-th-time">Hora</th>' + ths +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

// ── Leyenda de grupos ─────────────────────────────────────────────────────
function hdRenderLegend(sessions) {
  var grupos = {};
  sessions.forEach(function(s) {
    if (!s.grupo) return;
    if (!grupos[s.grupo]) grupos[s.grupo] = { materias: new Set() };
    if (s.materia) grupos[s.grupo].materias.add(s.materia);
  });

  var keys = Object.keys(grupos).sort();
  if (!keys.length) return '';

  var items = keys.map(function(g) {
    var c    = hdColor(g);
    var mats = Array.from(grupos[g].materias).join(', ');
    return (
      '<div class="hd-legend-item">' +
        '<span class="hd-legend-dot" style="background:' + c.border + ';"></span>' +
        '<div class="hd-legend-label">' +
          '<span class="hd-legend-grupo">' + hdEsc(g) + '</span>' +
          (mats ? '<span class="hd-legend-mat">' + hdEsc(mats) + '</span>' : '') +
        '</div>' +
      '</div>'
    );
  }).join('');

  return (
    '<div class="hd-section-title">Grupos asignados</div>' +
    '<div class="hd-legend">' + items + '</div>'
  );
}

// ── Header del docente ────────────────────────────────────────────────────
function hdRenderHeader(docente, sessions) {
  var ciclo    = sessions.length ? (sessions[0].ciclo    || '') : '';
  var periodo  = sessions.length ? (sessions[0].periodo  || '') : '';
  var semestres = Array.from(new Set(sessions.map(function(s) { return s.semestre; }).filter(Boolean))).sort().join(', ');
  var turnos   = Array.from(new Set(sessions.map(function(s) { return s.turno; }).filter(Boolean))).sort().join(' · ');
  var grupos   = Array.from(new Set(sessions.filter(function(s) { return s.componente !== 'EXTRAESCOLAR'; })
                   .map(function(s) { return s.grupo; }).filter(Boolean))).length;
  var totalHrs = sessions.reduce(function(sum, s) { return sum + (parseFloat(s.horas_bloque) || 0); }, 0);
  var totalHrsRnd = Math.round(totalHrs * 10) / 10;

  var hrsColor = totalHrsRnd > 35 ? '#f97316' : '#059669';
  var hrsLabel = totalHrsRnd > 35 ? '⚠ ' + totalHrsRnd + ' hrs/sem' : totalHrsRnd + ' hrs/sem';

  var initials = String(docente).split(/\s+/).filter(Boolean).slice(0, 2)
    .map(function(w) { return w[0] || ''; }).join('').toUpperCase();

  var chips = '';
  if (ciclo)    chips += '<span class="hd-chip"><span>📅</span>' + hdEsc(ciclo)    + '</span>';
  if (periodo)  chips += '<span class="hd-chip"><span>🗂</span>Periodo ' + hdEsc(periodo) + '</span>';
  if (semestres)chips += '<span class="hd-chip"><span>🎓</span>' + hdEsc(semestres) + '° Sem</span>';
  if (turnos)   chips += '<span class="hd-chip"><span>🕐</span>' + hdEsc(turnos)   + '</span>';
  if (grupos)   chips += '<span class="hd-chip"><span>👥</span>' + grupos           + ' grupo' + (grupos !== 1 ? 's' : '') + '</span>';

  return (
    '<div class="hd-header">' +
      '<div class="hd-header-inner">' +
        '<div class="hd-avatar">' + hdEsc(initials) + '</div>' +
        '<div class="hd-header-info">' +
          '<div class="hd-docente-name">' + hdEsc(docente) + '</div>' +
          '<div class="hd-docente-tag">Horario Definitivo · Solo lectura</div>' +
          (chips ? '<div class="hd-chips">' + chips + '</div>' : '') +
        '</div>' +
        '<div class="hd-hrs-badge" style="color:' + hrsColor + ';border-color:' + hrsColor + ';">' +
          hrsLabel +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ── Render principal ──────────────────────────────────────────────────────
function hdRender() {
  var container = document.getElementById('hd-container');
  if (!container) return;

  // Si la vista está oculta, no renderizar
  var section = document.getElementById('view-horario-definitivo');
  if (section && section.classList.contains('hidden')) return;

  var docente = sessionStorage.getItem('user_name') || '';
  if (!docente) {
    container.innerHTML =
      '<div class="hd-empty">' +
      '<div class="hd-empty-icon">🔐</div>' +
      '<p>No se pudo identificar al docente. Vuelve a iniciar sesión.</p>' +
      '</div>';
    return;
  }

  // Loading state
  container.innerHTML =
    '<div class="hd-loading">' +
      '<div class="hd-spinner"></div>' +
      '<span>Cargando horario definitivo…</span>' +
    '</div>';

  // Reset colores
  HD_COLOR_MAP = {};
  HD_COLOR_IDX = 0;

  hdFetch().then(function(data) {
    HD_COLOR_MAP = {};
    HD_COLOR_IDX = 0;

    if (!data.length) {
      container.innerHTML =
        '<div class="hd-empty">' +
        '<div class="hd-empty-icon">📭</div>' +
        '<p>Aún no hay horario definitivo disponible en el sistema.</p>' +
        '<p class="hd-empty-sub">Cuando el horario sea cargado, aparecerá automáticamente aquí.</p>' +
        '</div>';
      return;
    }

    // Coincidencia por nombre normalizado
    var normDoc  = hdNorm(docente);
    var sessions = data.filter(function(r) {
      return hdNorm(r.docente) === normDoc;
    });

    // Intento secundario: coincidencia parcial por apellido
    if (!sessions.length) {
      var partes = normDoc.split(/\s+/).filter(function(p) { return p.length > 3; });
      if (partes.length) {
        sessions = data.filter(function(r) {
          var nd = hdNorm(r.docente || '');
          return partes.every(function(p) { return nd.indexOf(p) !== -1; });
        });
      }
    }

    if (!sessions.length) {
      container.innerHTML =
        '<div class="hd-empty">' +
        '<div class="hd-empty-icon">🗓</div>' +
        '<p>Aún no hay horario definitivo disponible para <strong>' + hdEsc(docente) + '</strong>.</p>' +
        '<p class="hd-empty-sub">Cuando el horario sea registrado en el sistema, aparecerá aquí automáticamente.</p>' +
        '</div>';
      return;
    }

    container.innerHTML =
      hdRenderHeader(docente, sessions) +
      '<div class="hd-section-title" style="margin-top:1rem;">Horario semanal</div>' +
      hdRenderGrid(sessions) +
      hdRenderLegend(sessions);

  }).catch(function(err) {
    container.innerHTML =
      '<div class="hd-empty">' +
      '<div class="hd-empty-icon">⚠️</div>' +
      '<p>No se pudo cargar el horario.</p>' +
      '<p class="hd-empty-sub">' + hdEsc(err.message || 'Error de conexión') + '</p>' +
      '<button class="hd-retry-btn" id="hd-retry">Reintentar</button>' +
      '</div>';
    var btn = document.getElementById('hd-retry');
    if (btn) btn.addEventListener('click', function() { HD_CACHE = null; hdRender(); });
  });
}

// ── Activar render al navegar a esta vista ────────────────────────────────
document.addEventListener('click', function(e) {
  var link = e.target.closest('.nav-link[data-view="horario-definitivo"]');
  if (link) {
    // Pequeño delay para que el DOM actualice la visibilidad de la sección
    setTimeout(hdRender, 20);
  }
});
