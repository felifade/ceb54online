// api_nuevo.js — Override progresivo al nuevo GAS (solo PRUEBAS)
// Cada función aquí reemplaza su equivalente en api_v3.js
// Las funciones no migradas siguen usando el GAS viejo sin cambios.

(function () {
  var PEC_API  = 'https://script.google.com/macros/s/AKfycbw8tIW035KH4TczR57btpZVpzToDu4uxQXjUUV4uziQhhixLqjE-iMkVGnXV7Qsm2O1/exec';
  var ACAD_API = 'https://script.google.com/macros/s/AKfycbyeex2Txz_EdUyj9qvsi_DPet3KweejaP4KBOUEdj8GQg_HIK3aCkxsMWxzxhTuknh6/exec';

  // ── Cache (5 min TTL) ──────────────────────────────────────────────
  var _cache = {};
  var TTL = 5 * 60 * 1000;

  function fromCache(key) {
    var hit = _cache[key];
    if (!hit) return null;
    if (Date.now() - hit.ts > TTL) { delete _cache[key]; return null; }
    return hit.data;
  }
  function toCache(key, data) { _cache[key] = { data: data, ts: Date.now() }; }

  function get(base, action, params) {
    var key = action + JSON.stringify(params || {});
    var cached = fromCache(key);
    if (cached) return Promise.resolve(cached);
    var url = base + '?action=' + action + '&_t=' + Date.now();
    if (params) Object.keys(params).forEach(function (k) {
      url += '&' + k + '=' + encodeURIComponent(params[k]);
    });
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      toCache(key, d);
      return d;
    });
  }

  function norm(s) {
    return String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtDate(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return String(v).slice(0, 10); }
  }

  // ── Datos compartidos (se llenan en getDashboardData y se reusan) ──
  var _datos = { alumnos: [], calificaciones: [], catalogo: [] };

  // ── Override: getDashboardData ─────────────────────────────────────
  window.api.getDashboardData = async function () {
    var results = await Promise.all([
      get(PEC_API,  'getEquipos'),
      get(PEC_API,  'getCalificaciones'),
      get(ACAD_API, 'getAlumnos'),
    ]);

    _datos.catalogo       = results[0].equipos        || [];
    _datos.calificaciones = results[1].calificaciones || [];
    _datos.alumnos        = results[2].alumnos        || [];

    var catalogo       = _datos.catalogo;
    var calificaciones = _datos.calificaciones;
    var alumnos        = _datos.alumnos;

    // Solo semestres PEC: 1, 3, 5
    var alumnosPec = alumnos.filter(function (a) {
      return [1, 3, 5].indexOf(Number(a.semestre)) > -1;
    });

    // Grupos únicos
    var gruposSet = {};
    alumnosPec.forEach(function (a) { if (a.grupo) gruposSet[a.grupo] = true; });
    var grupos = Object.keys(gruposSet).sort();

    // Calificaciones por matrícula
    var califPorMat = {};
    calificaciones.forEach(function (c) {
      var k = norm(c.matricula);
      if (!califPorMat[k]) califPorMat[k] = 0;
      califPorMat[k]++;
    });

    // Equipos desde ALUMNOS
    var equiposMap = {};
    alumnosPec.forEach(function (a) {
      var subEq = String(a.equipo || '').trim();
      if (!subEq || subEq === '0') return;

      var turnoIni   = norm(a.turno || '').charAt(0) || 'x';
      var claveGrupo = String(a.semestre) + turnoIni;
      var id         = claveGrupo + '-' + subEq;

      if (!equiposMap[id]) {
        var cat = catalogo.find(function (e) { return norm(e.clave) === claveGrupo; });
        equiposMap[id] = {
          id:          id,
          clave:       claveGrupo,
          subEquipo:   subEq,
          grupo:       a.grupo,
          _grupos:     {},
          semestre:    a.semestre,
          turno:       a.turno,
          nombre:      'Equipo ' + subEq,
          urlDoc:      cat ? (cat.url_minuta || '') : '',
          integrantes: [],
          estado:      'Pendiente',
        };
      }

      equiposMap[id]._grupos[a.grupo] = true;
      equiposMap[id].grupo = Object.keys(equiposMap[id]._grupos).sort().join(' / ');
      equiposMap[id].integrantes.push(a.nombre || a.matricula);

      if (califPorMat[norm(a.matricula)]) {
        equiposMap[id].estado = 'Evaluado';
      }
    });

    var equiposMapped = Object.values(equiposMap).map(function (e) {
      delete e._grupos; return e;
    });

    var sinEquipo = alumnosPec
      .filter(function (a) { var eq = String(a.equipo || '').trim(); return !eq || eq === '0'; })
      .map(function (a) { return { alumno: a.nombre, grupo: a.grupo, matricula: a.matricula }; });

    var evaluados = equiposMapped.filter(function (e) { return e.estado === 'Evaluado'; }).length;
    var avance    = equiposMapped.length ? Math.round((evaluados / equiposMapped.length) * 100) : 0;

    return {
      totalGrupos:       grupos.length,
      totalEquipos:      equiposMapped.length,
      evaluaciones:      calificaciones,
      todasEvaluaciones: calificaciones,
      grupos:            grupos,
      equipos:           equiposMapped,
      avance:            avance,
      directorio:        [],
      programacion:      [],
      sinEquipo:         sinEquipo,
      config:            { parcialActivo: '1' },
      fechas:            {},
    };
  };

  // ── Override: Directorio → usa ACAD getDocentes ───────────────────
  window.initDirectorioV2 = async function () {
    feather.replace();
    var el = document.getElementById('view-directorio');
    if (!el) return;
    var titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = 'Directorio Docente';
    el.innerHTML = '<p style="color:#94a3b8;font-size:.85rem;padding:1rem">Cargando...</p>';

    try {
      var res = await get(ACAD_API, 'getDocentes');
      var docentes = res.docentes || [];

      if (!docentes.length) {
        el.innerHTML = '<div class="panel"><p style="color:#94a3b8;">Sin docentes registrados en el ciclo activo.</p></div>';
        return;
      }

      var html = '<div class="stats-grid" style="margin-bottom:1.5rem;">'
        + '<div class="stat-card"><div class="stat-icon"><i data-feather="user"></i></div>'
        + '<div class="stat-details"><span class="stat-title">Docentes</span>'
        + '<h3 class="stat-value">' + docentes.length + '</h3></div></div></div>';

      html += '<div class="panel"><h2>Planta Docente — Ciclo Activo</h2>'
        + '<table style="width:100%;border-collapse:collapse;font-size:.875rem;margin-top:1rem;">'
        + '<thead><tr style="background:#f1f5f9;">'
        + '<th style="padding:10px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Nombre</th>'
        + '<th style="padding:10px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Materias</th>'
        + '<th style="padding:10px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Semestres</th>'
        + '<th style="padding:10px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Turno</th>'
        + '</tr></thead><tbody>';

      docentes.forEach(function (d) {
        html += '<tr style="border-bottom:1px solid #E2E8F0;">'
          + '<td style="padding:10px 12px;font-weight:600;">' + esc(d.nombre) + '</td>'
          + '<td style="padding:10px 12px;color:#475569;">' + esc(d.materias) + '</td>'
          + '<td style="padding:10px 12px;color:#475569;">' + esc(d.semestres) + '</td>'
          + '<td style="padding:10px 12px;"><span style="background:#f1f5f9;padding:2px 8px;border-radius:99px;font-size:.75rem;font-weight:600;">' + esc(d.turno) + '</span></td>'
          + '</tr>';
      });

      html += '</tbody></table></div>';
      el.innerHTML = html;
      feather.replace();
    } catch (e) {
      el.innerHTML = '<div class="panel" style="border-left:4px solid #ef4444;"><h2 style="color:#ef4444;">Error</h2><p>' + esc(e.message) + '</p></div>';
    }
  };

  // ── Override: Auditoría → usa PEC minutas + calificaciones ────────
  window.initAuditoriaView = async function () {
    feather.replace();
    var container = document.getElementById('view-auditoria');
    if (!container) return;
    var titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = 'Auditoría PEC';
    container.innerHTML = '<p style="color:#94a3b8;font-size:.85rem;padding:1rem">Cargando...</p>';

    try {
      var results = await Promise.all([
        get(PEC_API, 'getMinutas'),
        get(PEC_API, 'getCalificaciones'),
      ]);

      var minutas = (results[0].minutas || []).sort(function (a, b) {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      var califs = (results[1].calificaciones || []).sort(function (a, b) {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });

      var html = '<div class="panel" style="margin-bottom:1.5rem;">'
        + '<h2>Minutas registradas (' + minutas.length + ')</h2>';

      if (minutas.length) {
        html += '<table style="width:100%;border-collapse:collapse;font-size:.875rem;margin-top:1rem;">'
          + '<thead><tr style="background:#f1f5f9;">'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Equipo</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Docente</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Grupo</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Parcial</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Fecha</th>'
          + '</tr></thead><tbody>';
        minutas.slice(0, 30).forEach(function (m) {
          html += '<tr style="border-bottom:1px solid #E2E8F0;">'
            + '<td style="padding:8px 12px;font-weight:700;color:#3884C0;">' + esc(m.equipo) + '</td>'
            + '<td style="padding:8px 12px;">' + esc(m.docente) + '</td>'
            + '<td style="padding:8px 12px;">' + esc(m.grupo) + '</td>'
            + '<td style="padding:8px 12px;">P' + esc(m.parcial) + '</td>'
            + '<td style="padding:8px 12px;color:#94a3b8;font-size:.8rem;">' + fmtDate(m.updated_at) + '</td>'
            + '</tr>';
        });
        html += '</tbody></table>';
      } else {
        html += '<p style="color:#94a3b8;font-size:.85rem;margin-top:.5rem;">Sin minutas registradas en este ciclo.</p>';
      }
      html += '</div>';

      html += '<div class="panel"><h2>Calificaciones capturadas (' + califs.length + ')</h2>';
      if (califs.length) {
        html += '<table style="width:100%;border-collapse:collapse;font-size:.875rem;margin-top:1rem;">'
          + '<thead><tr style="background:#f1f5f9;">'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Alumno</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Equipo</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Grupo</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Parcial</th>'
          + '<th style="padding:8px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;color:#64748B;border-bottom:1px solid #E2E8F0;">Total</th>'
          + '</tr></thead><tbody>';
        califs.slice(0, 30).forEach(function (c) {
          html += '<tr style="border-bottom:1px solid #E2E8F0;">'
            + '<td style="padding:8px 12px;">' + esc(c.alumno || c.matricula) + '</td>'
            + '<td style="padding:8px 12px;font-weight:700;color:#3884C0;">' + esc(c.equipo) + '</td>'
            + '<td style="padding:8px 12px;">' + esc(c.grupo) + '</td>'
            + '<td style="padding:8px 12px;">P' + esc(c.parcial) + '</td>'
            + '<td style="padding:8px 12px;font-weight:700;color:#059669;">' + (c.total || '—') + '</td>'
            + '</tr>';
        });
        html += '</tbody></table>';
      } else {
        html += '<p style="color:#94a3b8;font-size:.85rem;margin-top:.5rem;">Sin calificaciones en este ciclo.</p>';
      }
      html += '</div>';

      container.innerHTML = html;
      feather.replace();
    } catch (e) {
      container.innerHTML = '<div class="panel" style="border-left:4px solid #ef4444;"><h2 style="color:#ef4444;">Error</h2><p>' + esc(e.message) + '</p></div>';
    }
  };

  window._log && window._log('[api_nuevo] dashboard + directorio + auditoria → nuevo GAS');
})();
