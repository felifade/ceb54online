/* ─────────────────────────────────────────────────────────────────────
   horario-portal.js — Visor de horario para Portal Alumno / Portal Padre
   Lee HORARIOS_WEB desde el GAS de Horarios (solo lectura).
   No modifica ningún dato. Compatible con alumno.html y padre.html.
────────────────────────────────────────────────────────────────────── */

var HORARIO_P_URL = 'https://script.google.com/macros/s/AKfycbyQUyTVSi3-IxFpHR_ySzjaW5AxmXEiI29bVve4IixeKyOwtohWO-kreg8ycl0jFphw/exec';

var HORARIO_P_DIAS = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'];
var HORARIO_P_DIAS_LABEL = {
  LUNES:'Lunes', MARTES:'Martes', MIERCOLES:'Miércoles', JUEVES:'Jueves', VIERNES:'Viernes'
};
var HORARIO_P_DIAS_SHORT = {
  LUNES:'Lun', MARTES:'Mar', MIERCOLES:'Mié', JUEVES:'Jue', VIERNES:'Vie'
};

var HORARIO_P_PALETTE = [
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

var _hpCache    = null;
var _hpCacheTs  = 0;
var _hpCacheTTL = 15 * 60 * 1000;
var _hpColorMap = {};
var _hpColorIdx = 0;

function _hpColor(label) {
  if (!label) return HORARIO_P_PALETTE[0];
  if (_hpColorMap[label] === undefined)
    _hpColorMap[label] = _hpColorIdx++ % HORARIO_P_PALETTE.length;
  return HORARIO_P_PALETTE[_hpColorMap[label]];
}

function _hpEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _hpFmtTime(t) {
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

function _hpFetch(force) {
  if (!force && _hpCache && (Date.now() - _hpCacheTs) < _hpCacheTTL)
    return Promise.resolve(_hpCache);
  var url = HORARIO_P_URL + '?action=getHorariosWeb&_t=' + Date.now();
  return fetch(url, { method: 'GET', redirect: 'follow' })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      if (json.status === 'error') throw new Error(json.message || 'Error al cargar horarios');
      _hpCache   = json.data || [];
      _hpCacheTs = Date.now();
      return _hpCache;
    });
}

// ── RENDER GRID SEMANAL ────────────────────────────────────────────────────
function _hpRenderGrid(sessions, grupo) {
  if (!sessions.length) {
    return '<div class="hp-empty">' +
      '<p>Sin sesiones registradas para el grupo <strong>' + _hpEsc(grupo) + '</strong>.</p>' +
      '<p style="font-size:0.78rem;color:#94a3b8;margin-top:0.35rem;">Verifica que el horario haya sido cargado en el sistema.</p>' +
      '</div>';
  }

  // Normalizar tiempos
  var norm = sessions.map(function(s) {
    return {
      dia:          s.dia,
      materia:      s.materia,
      docente:      s.docente,
      componente:   s.componente,
      hora_inicio:  _hpFmtTime(s.hora_inicio),
      hora_fin:     _hpFmtTime(s.hora_fin),
      horas_bloque: s.horas_bloque
    };
  });

  // Tiempos únicos ordenados
  var timesSet = {};
  norm.forEach(function(r) { if (r.hora_inicio) timesSet[r.hora_inicio] = true; });
  var times = Object.keys(timesSet).sort(function(a, b) { return a.localeCompare(b); });
  if (!times.length) return '<div class="hp-empty">Sin horarios definidos.</div>';

  // Lookup [día][hora_inicio] → sesión
  var lookup = {};
  norm.forEach(function(s) {
    if (!lookup[s.dia]) lookup[s.dia] = {};
    if (!lookup[s.dia][s.hora_inicio]) lookup[s.dia][s.hora_inicio] = s;
  });

  // Solo días con sesiones
  var activeDias = HORARIO_P_DIAS.filter(function(d) {
    return norm.some(function(s) { return s.dia === d; });
  });

  var ths = activeDias.map(function(d) {
    return '<th class="hp-th-day">' +
      '<span class="hp-day-full">'  + HORARIO_P_DIAS_LABEL[d] + '</span>' +
      '<span class="hp-day-short">' + HORARIO_P_DIAS_SHORT[d] + '</span>' +
    '</th>';
  }).join('');

  var occ  = {};
  var rows = '';

  times.forEach(function(time, ti) {
    rows += '<tr>';
    rows += '<td class="hp-time">' + _hpEsc(time) + '</td>';

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

        var c       = _hpColor(s.materia);
        var hrs     = parseFloat(s.horas_bloque) || 0;
        var hrsStr  = (hrs % 1 === 0 ? String(Math.round(hrs)) : String(hrs)) + 'h';
        var isExtra = s.componente === 'EXTRAESCOLAR';
        var cls     = 'hp-cell' + (isExtra ? ' hp-cell-extra' : '');
        var style   = '--cell-bg:' + c.bg + ';--cell-border:' + c.border + ';--cell-text:' + c.text;

        rows +=
          '<td rowspan="' + span + '" class="' + cls + '" style="' + style + ';">' +
            '<div class="hp-cell-inner">' +
              '<div class="hp-cell-materia">' + _hpEsc(s.materia || '—') + '</div>' +
              (s.docente ? '<div class="hp-cell-docente">' + _hpEsc(s.docente) + '</div>' : '') +
              '<div class="hp-cell-footer">' +
                '<span class="hp-cell-hrs">' + hrsStr + '</span>' +
                (s.hora_fin ? '<span class="hp-cell-range">\u00a0' + _hpEsc(time) + '–' + _hpEsc(s.hora_fin) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</td>';
      } else {
        rows += '<td class="hp-cell hp-cell-empty"></td>';
      }
    });

    rows += '</tr>';
  });

  return (
    '<div class="hp-scroll-wrap">' +
      '<table class="hp-table">' +
        '<thead><tr>' +
          '<th class="hp-th-time">Hora</th>' + ths +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

// ── LEYENDA DE MATERIAS ────────────────────────────────────────────────────
function _hpRenderLegend(sessions) {
  var materias = {};
  sessions.forEach(function(s) {
    if (!s.materia) return;
    if (!materias[s.materia]) materias[s.materia] = { docente: s.docente || '' };
  });
  var keys = Object.keys(materias).sort();
  if (!keys.length) return '';

  var items = keys.map(function(mat) {
    var c = _hpColor(mat);
    var d = materias[mat];
    return (
      '<div class="hp-legend-item">' +
        '<span class="hp-legend-dot" style="background:' + c.border + ';"></span>' +
        '<div class="hp-legend-label">' +
          '<span class="hp-legend-mat">' + _hpEsc(mat) + '</span>' +
          (d.docente ? '<span class="hp-legend-doc">' + _hpEsc(d.docente) + '</span>' : '') +
        '</div>' +
      '</div>'
    );
  }).join('');

  return '<div class="hp-legend">' + items + '</div>';
}

// ── API PÚBLICA ────────────────────────────────────────────────────────────
var horarioPortal = {
  render: function(grupo, container) {
    if (!container || !grupo) {
      if (container) container.innerHTML =
        '<div class="hp-empty">No se pudo determinar el grupo. Vuelve a iniciar sesión.</div>';
      return;
    }

    // Reset colores para esta renderización
    _hpColorMap = {};
    _hpColorIdx = 0;

    container.innerHTML =
      '<div class="hp-loading"><div class="hp-spinner"></div><span>Cargando horario…</span></div>';

    _hpFetch().then(function(data) {
      _hpColorMap = {};
      _hpColorIdx = 0;

      if (!data.length) {
        container.innerHTML =
          '<div class="hp-empty"><p>El sistema de horarios no tiene datos disponibles en este momento.</p>' +
          '<p style="font-size:0.78rem;color:#94a3b8;margin-top:0.35rem;">Intenta más tarde o consulta a tu coordinador académico.</p></div>';
        return;
      }

      // Normalización del grupo para comparación
      var normGrupo = String(grupo).toUpperCase().trim().replace(/\s+/g, '');

      // Intentar coincidencia exacta normalizada primero
      var sessions = data.filter(function(r) {
        return String(r.grupo || '').toUpperCase().trim().replace(/\s+/g, '') === normGrupo;
      });

      // Si no hay coincidencia exacta, intentar coincidencia por dígitos solamente
      if (!sessions.length) {
        var soloDigitos = normGrupo.replace(/[^0-9]/g, '');
        if (soloDigitos.length >= 2) {
          sessions = data.filter(function(r) {
            return String(r.grupo || '').replace(/[^0-9]/g, '') === soloDigitos;
          });
        }
      }

      // Si aún sin resultados, mensaje limpio
      if (!sessions.length) {
        container.innerHTML =
          '<div class="hp-empty">' +
          '<p>Horario no disponible para el grupo <strong>' + _hpEsc(grupo) + '</strong>.</p>' +
          '<p style="font-size:0.78rem;color:#94a3b8;margin-top:0.35rem;">Verifica que el horario haya sido cargado en el sistema.</p>' +
          '</div>';
        return;
      }

      // Metadatos del grupo
      var ciclo     = sessions.length ? (sessions[0].ciclo    || '') : '';
      var turno     = sessions.length ? (sessions[0].turno    || '') : '';
      var semestre  = sessions.length ? (sessions[0].semestre || '') : '';
      var nMaterias = (function() {
        var s = {};
        sessions.forEach(function(r) { if (r.materia && r.componente !== 'EXTRAESCOLAR') s[r.materia] = true; });
        return Object.keys(s).length;
      })();

      // Actualizar badge del encabezado
      var badge = document.getElementById('hp-grupo-badge');
      if (badge) badge.textContent = 'Grupo ' + grupo;

      var meta =
        '<div class="hp-meta">' +
          (ciclo    ? '<span class="hp-meta-chip"><span class="hp-meta-icon">📅</span>' + _hpEsc(ciclo) + '</span>' : '') +
          (semestre ? '<span class="hp-meta-chip"><span class="hp-meta-icon">🎓</span>' + _hpEsc(semestre) + '° Sem</span>' : '') +
          (turno    ? '<span class="hp-meta-chip"><span class="hp-meta-icon">🕐</span>' + _hpEsc(turno) + '</span>' : '') +
          (nMaterias ? '<span class="hp-meta-chip"><span class="hp-meta-icon">📚</span>' + nMaterias + ' materias</span>' : '') +
        '</div>';

      container.innerHTML = meta + _hpRenderGrid(sessions, grupo) + _hpRenderLegend(sessions);

    }).catch(function(err) {
      container.innerHTML =
        '<div class="hp-empty">' +
          '<p style="margin-bottom:0.35rem;">No se pudo cargar el horario.</p>' +
          '<p style="font-size:0.75rem;color:#94a3b8;">' + _hpEsc(err.message || 'Error desconocido') + '</p>' +
          '<button class="hp-retry-btn" id="hp-retry-btn">Reintentar</button>' +
        '</div>';
      var btn = document.getElementById('hp-retry-btn');
      if (btn) btn.addEventListener('click', function() { horarioPortal.render(grupo, container); });
    });
  }
};
