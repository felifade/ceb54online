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
  // Fuente de verdad: ALUMNOS.equipo
  // PEC_EQUIPOS solo se usa para enriquecer con nombre_proyecto y url_minuta
  window.api.getDashboardData = async function () {
    var results = await Promise.all([
      get(PEC_API,  'getEquipos'),        // catálogo: nombre, url (opcional)
      get(PEC_API,  'getCalificaciones'), // califs capturadas
      get(ACAD_API, 'getAlumnos'),        // fuente principal
    ]);

    var catalogo       = results[0].equipos        || [];
    var calificaciones = results[1].calificaciones || [];
    var alumnos        = results[2].alumnos        || [];

    // Solo semestres PEC: 1, 3, 5
    var alumnosPec = alumnos.filter(function (a) {
      return [1, 3, 5].indexOf(Number(a.semestre)) > -1;
    });

    // Grupos únicos de los alumnos PEC
    var gruposSet = {};
    alumnosPec.forEach(function (a) { if (a.grupo) gruposSet[a.grupo] = true; });
    var grupos = Object.keys(gruposSet).sort();

    // Lookup rápido: calificaciones por matrícula
    var califPorMat = {};
    calificaciones.forEach(function (c) {
      var k = norm(c.matricula);
      if (!califPorMat[k]) califPorMat[k] = 0;
      califPorMat[k]++;
    });

    // Construir equipos desde ALUMNOS:
    // clave del PEC group = primer char del turno + semestre  → "1m", "3v", etc.
    // id del sub-equipo   = clave_pec + "-" + número de equipo del alumno
    var equiposMap = {};
    alumnosPec.forEach(function (a) {
      var subEq = String(a.equipo || '').trim();
      if (!subEq || subEq === '0') return; // sin equipo asignado

      var turnoIni = norm(a.turno || '').charAt(0) || 'x';
      var claveGrupo = String(a.semestre) + turnoIni;  // "1m", "3v", "5v"…
      var id = claveGrupo + '-' + subEq;               // "1m-3", "3v-1"…

      if (!equiposMap[id]) {
        // Enriquecer con catálogo PEC_EQUIPOS si existe
        var cat = catalogo.find(function (e) { return norm(e.clave) === claveGrupo; });
        equiposMap[id] = {
          id:          id,
          clave:       claveGrupo,
          subEquipo:   subEq,
          grupo:       a.grupo,   // grupo real del salón: "1A", "3B", etc.
          _grupos:     {},        // acumula todos los grupos que aportan alumnos
          semestre:    a.semestre,
          turno:       a.turno,
          nombre:      cat ? (cat.nombre_proyecto || '') : ('Equipo ' + subEq),
          urlDoc:      cat ? (cat.url_minuta || '') : '',
          integrantes: [],
          estado:      'Pendiente',
        };
      }

      // Si el equipo tiene alumnos de varios grupos, reflejar todos
      equiposMap[id]._grupos[a.grupo] = true;
      equiposMap[id].grupo = Object.keys(equiposMap[id]._grupos).sort().join(' / ');

      equiposMap[id].integrantes.push(a.nombre || a.matricula);

      // Marcar como Evaluado si el alumno tiene al menos una calificación
      if (califPorMat[norm(a.matricula)]) {
        equiposMap[id].estado = 'Evaluado';
      }
    });

    var equiposMapped = Object.values(equiposMap).map(function (e) {
      delete e._grupos;
      return e;
    });

    // Alumnos PEC sin equipo asignado
    var sinEquipo = alumnosPec
      .filter(function (a) {
        var eq = String(a.equipo || '').trim();
        return !eq || eq === '0';
      })
      .map(function (a) {
        return { alumno: a.nombre, grupo: a.grupo, matricula: a.matricula };
      });

    // Avance: equipos evaluados / total equipos
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

  window._log && window._log('[api_nuevo] getDashboardData → nuevo GAS activo');
})();
