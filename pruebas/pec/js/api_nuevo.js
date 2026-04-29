// api_nuevo.js — Override progresivo al nuevo GAS (solo PRUEBAS)
// Cada función aquí reemplaza su equivalente en api_v3.js
// Las funciones no migradas siguen usando el GAS viejo sin cambios.

(function () {
  var PEC_API  = 'https://script.google.com/macros/s/AKfycbw8tIW035KH4TczR57btpZVpzToDu4uxQXjUUV4uziQhhixLqjE-iMkVGnXV7Qsm2O1/exec';
  var ACAD_API = 'https://script.google.com/macros/s/AKfycbyeex2Txz_EdUyj9qvsi_DPet3KweejaP4KBOUEdj8GQg_HIK3aCkxsMWxzxhTuknh6/exec';

  // ── Helpers ────────────────────────────────────────────────────────
  function get(base, action, params) {
    var url = base + '?action=' + action + '&_t=' + Date.now();
    if (params) Object.keys(params).forEach(function (k) {
      url += '&' + k + '=' + encodeURIComponent(params[k]);
    });
    return fetch(url).then(function (r) { return r.json(); });
  }

  function norm(s) {
    return String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // ── Override: getDashboardData ─────────────────────────────────────
  // Reemplaza api.getDashboardData() para usar nuevo GAS + ACAD
  window.api.getDashboardData = async function () {
    var results = await Promise.all([
      get(PEC_API,  'getEquipos'),
      get(PEC_API,  'getCalificaciones'),
      get(ACAD_API, 'getAlumnos'),
      get(ACAD_API, 'getGrupos'),
    ]);

    var equipos        = results[0].equipos        || [];
    var calificaciones = results[1].calificaciones || [];
    var alumnos        = results[2].alumnos        || [];
    var grupos         = results[3].grupos         || [];

    // Calcular cuántas calificaciones tiene cada equipo en este parcial
    var califPorEquipo = {};
    calificaciones.forEach(function (c) {
      var k = norm(c.equipo);
      califPorEquipo[k] = (califPorEquipo[k] || 0) + 1;
    });

    // Mapear equipos al formato que espera el dashboard actual
    var equiposMapped = equipos.map(function (eq) {
      var key = norm(eq.clave);
      var tieneCalif = (califPorEquipo[key] || 0) > 0;
      var turnoAbrev = eq.turno ? eq.turno.charAt(0).toUpperCase() + '.' : '';
      return {
        id:       eq.clave,
        grupo:    'Sem.' + eq.semestre + ' ' + turnoAbrev,
        clave:    eq.clave,
        semestre: eq.semestre,
        turno:    eq.turno,
        nombre:   eq.nombre_proyecto || '',
        estado:   tieneCalif ? 'Evaluado' : 'Pendiente',
      };
    });

    // Alumnos sin equipo (equipo vacío o 0)
    var sinEquipo = alumnos
      .filter(function (a) {
        var eq = String(a.equipo || '').trim();
        return !eq || eq === '0';
      })
      .map(function (a) {
        return { alumno: a.nombre, grupo: a.grupo, matricula: a.matricula };
      });

    // Avance global: calificaciones capturadas / (equipos × 7 materias aprox)
    var totalEsperado = equipos.length * 7;
    var avance = totalEsperado === 0 ? 0 : Math.round((calificaciones.length / totalEsperado) * 100);
    avance = Math.min(avance, 100);

    return {
      totalGrupos:       grupos.length,
      totalEquipos:      equipos.length,
      evaluaciones:      calificaciones,
      todasEvaluaciones: calificaciones,
      grupos:            grupos,
      equipos:           equiposMapped,
      avance:            avance,
      directorio:        [],   // pendiente de migrar
      programacion:      [],   // pendiente de migrar
      sinEquipo:         sinEquipo,
      config:            { parcialActivo: '1' },
      fechas:            {},
    };
  };

  window._log && window._log('[api_nuevo] getDashboardData → nuevo GAS activo');
})();
