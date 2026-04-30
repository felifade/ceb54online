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

  // ── Correos de docentes (fuente local mientras el GAS no los devuelva) ──
  var _correos = {
    'agudo garcia jose alfredo':              'd.jaagudo54@dgb.edu.mx',
    'alvarez perez irma':                     'd.ialvarez54@dgb.edu.mx',
    'arenas orozco elvia abigail':            'd.earenas54@dgb.edu.mx',
    'arteaga badillo alicia':                 'd.aarteaga54@dgb.edu.mx',
    'banos ruiz victor arturo':               'd.victorbansruiz.54@dgb.edu.mx',
    'becerra hernandez fabiola alejandra':    'd.fabecerra54@dgb.edu.mx',
    'bustamante abonce jose mauro roberto':   'd.jmrbustamante54@dgb.edu.mx',
    'cadena galindo laura maria':             'd.lmcadena54@dgb.edu.mx',
    'camargo contreras pedro':                'd.pcamargo54@dgb.edu.mx',
    'cano lopez teresa':                      'd.tcano54@dgb.edu.mx',
    'canseco prado angela gabriela':          'd.acansecop54@dgb.edu.mx',
    'carranza quiroz claudia':                'd.ccarranza54@dgb.edu.mx',
    'cortez cervantes j.jesus':               'd.jesuscortezc54@dgb.edu.mx',
    'enriquez aguilar leticia':               'd.lenriquez54@dgb.edu.mx',
    'espinosa arteaga martin':                'd.mespinosa54@dgb.edu.mx',
    'galan mireles eva maria':                'd.evagalanezm54@dgb.edu.mx',
    'garcia lopez juana maria':               'd.jmgarcia54@dgb.edu.mx',
    'gayosso tolentino erika itzel':          'd.erikagayossot5_4@dgb.edu.mx',
    'gonzalez gardini claudia nayeli':        'd.cgonzalezg54@dgb.edu.mx',
    'hernandez camargo sivonney':             'd.shernandezc54@dgb.edu.mx',
    'hernandez hernandez luis ignacio':       'd.lihernandez54@dgb.edu.mx',
    'hernandez picazo luis francisco':        'd.luisfpicazo5_4@dgb.edu.mx',
    'hernandez vargas soila':                 'd.shernandez54@dgb.edu.mx',
    'herrera gomez alfonso':                  'd.aherrera54@dgb.edu.mx',
    'juarez flores aurora':                   'd.ajuarez54@dgb.edu.mx',
    'lopez garcia martha maria':              'd.mmlopez54@dgb.edu.mx',
    'lopez salazar felipe':                   'd.flopez54@dgb.edu.mx',
    'lopez vazquez luz maria del carmen':     'd.lmclopez54@dgb.edu.mx',
    'martinez flores daniel':                 'd.dmartinez54@dgb.edu.mx',
    'martinez flores grindelia':              'd.gmartinez54@dgb.edu.mx',
    'martinez ruiz martin':                   'd.mmartinezr54@dgb.edu.mx',
    'mendoza garcia maria isabel':            'd.mmendoza54@dgb.edu.mx',
    'oviedo juarez hernan saide':             'd.hsoviedo54@dgb.edu.mx',
    'perez picazo delfino':                   'd.delfinoperezp54@dgb.edu.mx',
    'priego cardoza olga leticia':            'd.olpriego54@dgb.edu.mx',
    'rios cruz oscar geovani':                'd.oscarriosc54@dgb.edu.mx',
    'rubio garcia maria elena':               'd.merubio54@dgb.edu.mx',
    'sanchez meza jerusalen':                 'd.jsanchez54@dgb.edu.mx',
    'vazquez alamilla ismael':                'd.ivazquez54@dgb.edu.mx',
    'vite barrera saul elias':                'd.saulviteb54@dgb.edu.mx',
  };

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

  // ── Override: Directorio → getEstructura (grupos) + getDocentes (parcial/correo) ──
  window.initDirectorioV2 = async function () {
    feather.replace();
    var el = document.getElementById('view-directorio');
    if (!el) return;
    var titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = 'Directorio Escolar Oficial (CEB 5/4)';
    el.innerHTML = '<p style="color:#94a3b8;font-size:.85rem;padding:1rem">Cargando...</p>';

    try {
      var results = await Promise.all([
        get(ACAD_API, 'getEstructura'),
        get(ACAD_API, 'getDocentes'),
      ]);

      var estructura = (results[0].estructura || []).filter(function (e) {
        return [1, 3, 5].indexOf(Number(e.semestre)) > -1;
      });
      var docentes = results[1].docentes || [];

      if (!estructura.length) {
        el.innerHTML = '<div class="panel"><p style="color:#94a3b8;">Sin estructura registrada para el ciclo activo.</p></div>';
        return;
      }

      // Mapa docente → {parcial, ponderacion, correo}
      var docenteMap = {};
      docentes.forEach(function (d) {
        docenteMap[norm(d.nombre)] = {
          parcial:     String(d.parcial     || '').trim(),
          ponderacion: String(d.ponderacion || '').trim(),
          correo:      d.correo || d.email || _correos[norm(d.nombre)] || '',
        };
      });

      // Agrupar por grupo → lista de materias
      var porGrupo = {};
      estructura.forEach(function (e) {
        var g = String(e.grupo || '').trim().toUpperCase();
        if (!g) return;
        if (!porGrupo[g]) porGrupo[g] = { semestre: Number(e.semestre), turno: String(e.turno || ''), materias: [] };
        var dInfo = docenteMap[norm(e.docente)] || {};
        porGrupo[g].materias.push({
          materia:     String(e.materia  || '').trim(),
          docente:     String(e.docente  || '').trim(),
          correo:      dInfo.correo      || _correos[norm(e.docente)] || '',
          parcial:     dInfo.parcial     || '',
          ponderacion: dInfo.ponderacion || '',
        });
      });

      // Secciones por semestre
      var agrupados = {};
      Object.keys(porGrupo).sort(function (a, b) {
        return a.localeCompare(b, undefined, { numeric: true });
      }).forEach(function (gKey) {
        var info = porGrupo[gKey];
        var sem  = info.semestre + 'º Semestre';
        if (!agrupados[sem]) agrupados[sem] = {};
        agrupados[sem][gKey] = info;
      });

      var html = '<div class="panel" style="margin-bottom:2rem;border-left:8px solid #0891b2;'
        + 'box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);padding:1rem 1.5rem;">'
        + '<h2 style="display:flex;align-items:center;gap:10px;margin:0;color:#1e293b;font-size:1.3rem;">'
        + '<i data-feather="map" style="color:#0891b2;width:22px;"></i> Directorio de Materias y Docentes</h2>'
        + '</div>';

      Object.keys(agrupados).sort().forEach(function (sem) {
        html += '<div style="margin-bottom:2rem;">'
          + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">'
          + '<span style="background:#0891b2;color:white;padding:2px 12px;border-radius:999px;font-weight:800;font-size:.8rem;">'
          + sem.toUpperCase() + '</span></div>'
          + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;">';

        Object.keys(agrupados[sem]).sort(function (a, b) {
          return a.localeCompare(b, undefined, { numeric: true });
        }).forEach(function (gKey) {
          var info   = agrupados[sem][gKey];
          var turno  = String(info.turno || '').toUpperCase();
          var isVesp = turno.indexOf('VESP') > -1 || gKey.toLowerCase().charAt(0) === 'v';
          var accent = isVesp ? '#7c3aed' : '#0891b2';

          html += '<div class="panel" style="padding:0;border:none;border-radius:12px;overflow:hidden;'
            + 'box-shadow:0 2px 10px rgba(0,0,0,0.05);background:#fff;border-top:3px solid ' + accent + ';">'
            + '<div style="background:' + accent + '08;padding:.75rem 1rem;border-bottom:1px solid #f1f5f9;">'
            + '<h3 style="margin:0;font-size:1rem;color:#1e293b;font-weight:800;">Grupo ' + esc(gKey) + '</h3>'
            + '<div style="font-size:.75rem;color:#64748b;font-weight:600;margin-top:2px;">'
            + info.materias.length + ' materias</div></div>'
            + '<div style="padding:.75rem;">'
            + '<table style="width:100%;border-collapse:collapse;font-size:.8rem;"><tbody>';

          info.materias.forEach(function (f) {
            var pList  = f.parcial ? f.parcial.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
            var badges = pList.length ? pList.map(function (p) {
              var bg = '#e2e8f0', clr = '#64748b';
              if (p === '1') { bg = '#eff6ff'; clr = '#2563eb'; }
              if (p === '2') { bg = '#fff7ed'; clr = '#f97316'; }
              if (p === '3') { bg = '#f0fdf4'; clr = '#16a34a'; }
              return '<span style="background:' + bg + ';color:' + clr + ';padding:1px 6px;border-radius:4px;'
                + 'font-size:.65rem;font-weight:900;border:1px solid ' + clr + '22;">P' + p + '</span>';
            }).join('') : '<span style="color:#94a3b8;font-size:.65rem;font-style:italic;">No participa</span>';

            html += '<tr style="border-bottom:1px solid #f8fafc;">'
              + '<td style="padding:10px 4px;vertical-align:top;">'
              + '<div style="font-weight:700;color:#334155;line-height:1.2;margin-bottom:4px;">' + esc(f.materia) + '</div>'
              + '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + badges + '</div></td>'
              + '<td style="padding:10px 4px;vertical-align:top;">'
              + '<div style="font-weight:600;color:#475569;">' + esc(f.docente || 'Sin Asignar') + '</div>'
              + '<div style="font-size:.65rem;color:#94a3b8;margin-top:2px;">' + esc(f.correo) + '</div>'
              + '</td></tr>';
          });

          html += '</tbody></table></div></div>';
        });

        html += '</div></div>';
      });

      el.innerHTML = html;
      feather.replace();
    } catch (e) {
      el.innerHTML = '<div class="panel" style="border-left:4px solid #ef4444;"><h2 style="color:#ef4444;">Error</h2><p>' + esc(e.message) + '</p></div>';
    }
  };

  // ── Override: Auditoría → detecta vacíos en Parcial y Ponderación ──
  window.initAuditoriaView = async function () {
    feather.replace();
    var container = document.getElementById('view-auditoria');
    if (!container) return;
    var titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = 'Auditoría de Asignaciones (Líderes de Academia)';
    container.innerHTML = '<p style="color:#94a3b8;font-size:.85rem;padding:1rem">Cargando...</p>';

    try {
      // ESTRUCTURA da el semestre correcto por materia; DOCENTES da el estado de parcial/ponderacion
      var results = await Promise.all([
        get(ACAD_API, 'getEstructura'),
        get(ACAD_API, 'getDocentes'),
      ]);

      var estructura = (results[0].estructura || []).filter(function (e) {
        return [1, 3, 5].indexOf(Number(e.semestre)) > -1;
      });
      var docentes = results[1].docentes || [];

      // Mapa docente → {parcial, ponderacion}
      var docenteMap = {};
      docentes.forEach(function (d) {
        docenteMap[norm(d.nombre)] = {
          parcial:     String(d.parcial     || '').trim(),
          ponderacion: String(d.ponderacion || '').trim(),
        };
      });

      // Dedup por materia+semestre+turno (sin docente en key → una entrada por materia por semestre+turno)
      // Si varios docentes imparten la misma materia, conservamos el que esté pendiente (más urgente)
      var grupos = {};
      estructura.forEach(function (e) {
        var grupoCode = String(e.grupo || '').trim().toLowerCase();
        var turno     = grupoCode.charAt(0) === 'v' ? 'Vespertino' : 'Matutino';
        var key       = norm(e.materia) + '|' + Number(e.semestre) + '|' + turno;

        var dInfo       = docenteMap[norm(e.docente)] || {};
        var parcial     = String(dInfo.parcial     || '').trim();
        var ponderacion = String(dInfo.ponderacion || '').trim();
        var esFaltante  = parcial === '' || ponderacion === '';

        if (!grupos[key]) {
          grupos[key] = {
            materia:     String(e.materia  || '').trim(),
            semestre:    Number(e.semestre),
            turno:       turno,
            docente:     String(e.docente  || 'Sin asignar').trim(),
            parcial:     parcial,
            ponderacion: ponderacion,
            esFaltante:  esFaltante,
          };
        } else if (esFaltante && !grupos[key].esFaltante) {
          // Actualizar con el docente problemático para que aparezca en faltantes
          grupos[key].docente     = String(e.docente || 'Sin asignar').trim();
          grupos[key].parcial     = parcial;
          grupos[key].ponderacion = ponderacion;
          grupos[key].esFaltante  = true;
        }
      });

      var entries = Object.values(grupos);

      var asignados = entries.filter(function (e) { return !e.esFaltante; });
      var faltantes = entries.filter(function (e) { return e.esFaltante; });

      var total = entries.length;
      var ok    = asignados.length;
      var fail  = faltantes.length;
      var pct   = total > 0 ? Math.round((ok / total) * 100) : 0;

      // Stats
      var html = '<div class="stats-grid" style="margin-bottom:1.5rem;">'
        + '<div class="stat-card"><div class="stat-icon"><i data-feather="list"></i></div>'
        + '<div class="stat-details"><span class="stat-title">Total Materias</span>'
        + '<h3 class="stat-value" style="color:#1e293b;">' + total + '</h3></div></div>'

        + '<div class="stat-card" style="border-left:4px solid #10b981;">'
        + '<div class="stat-icon" style="color:#10b981;"><i data-feather="check-circle"></i></div>'
        + '<div class="stat-details"><span class="stat-title">Ya Asignadas</span>'
        + '<h3 class="stat-value" style="color:#059669;">' + ok + '</h3></div></div>'

        + '<div class="stat-card" style="border-left:4px solid #ef4444;">'
        + '<div class="stat-icon" style="color:#ef4444;"><i data-feather="alert-circle"></i></div>'
        + '<div class="stat-details"><span class="stat-title">Pendientes (Huecos)</span>'
        + '<h3 class="stat-value" style="color:#dc2626;">' + fail + '</h3></div></div>'

        + '<div class="stat-card highlight" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);">'
        + '<div class="stat-icon" style="color:white;opacity:.8;"><i data-feather="pie-chart"></i></div>'
        + '<div class="stat-details"><span class="stat-title" style="color:rgba(255,255,255,.8);">Avance Global</span>'
        + '<h3 class="stat-value" style="color:white;">' + pct + '%</h3></div></div>'
        + '</div>';

      // Cabecera
      html += '<div class="panel" style="margin-bottom:1.5rem;border-left:8px solid #2563eb;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<div><h2 style="display:flex;align-items:center;gap:10px;margin:0;color:#1e293b;">'
        + '<i data-feather="shield" style="color:#2563eb;"></i> Planilla de Auditoría: Materias sin Configurar</h2>'
        + '<p style="color:#64748b;font-size:.95rem;margin-top:5px;">Detecta vacíos en Parcial y Ponderación para los Líderes de Academia.</p></div>'
        + '<button onclick="window.initAuditoriaView()" class="btn btn-outline" style="border-radius:12px;padding:10px 20px;">'
        + '<i data-feather="refresh-cw" style="width:16px;"></i> Recargar</button>'
        + '</div></div>';

      // Agrupar faltantes por semestre+turno
      var agrupados = {};
      faltantes.forEach(function (e) {
        var isV = e.turno.toUpperCase().indexOf('VESP') > -1;
        var key = e.semestre + 'º Semestre - ' + (isV ? 'Vespertino' : 'Matutino');
        if (!agrupados[key]) agrupados[key] = [];
        agrupados[key].push(e);
      });

      var keys = Object.keys(agrupados).sort();
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:1.5rem;">';

      if (!keys.length) {
        html += '<div class="panel" style="grid-column:1/-1;text-align:center;padding:5rem;background:#ecfdf5;border:2px dashed #10b981;border-radius:24px;">'
          + '<div style="font-size:4rem;margin-bottom:1.5rem;">✨</div>'
          + '<h2 style="color:#064e3b;font-size:2rem;">¡Excelente Trabajo!</h2>'
          + '<p style="color:#065f46;font-size:1.2rem;">Todas las materias tienen Parcial y Ponderación configurados.</p></div>';
      }

      keys.forEach(function (key) {
        var lista    = agrupados[key];
        var isV      = key.indexOf('Vespertino') > -1;
        var gradient = isV ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'linear-gradient(135deg,#f59e0b,#d97706)';

        html += '<div class="panel" style="padding:0;border:none;border-radius:20px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);background:#fff;">'
          + '<div style="background:' + gradient + ';padding:1.5rem;color:white;">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
          + '<div><h3 style="margin:0;font-size:1.25rem;font-weight:800;">' + esc(key) + '</h3>'
          + '<div style="font-size:.85rem;opacity:.9;margin-top:4px;display:flex;align-items:center;gap:6px;font-weight:500;">'
          + '<i data-feather="' + (isV ? 'moon' : 'sun') + '" style="width:14px;"></i> Turno ' + (isV ? 'Vespertino' : 'Matutino') + '</div></div>'
          + '<div style="background:rgba(255,255,255,.2);padding:4px 12px;border-radius:99px;font-size:.8rem;font-weight:800;">'
          + lista.length + ' FALTANTES</div></div></div>'
          + '<div style="padding:1.25rem;background:#f8fafc;">'
          + '<div style="display:flex;flex-direction:column;gap:12px;max-height:500px;overflow-y:auto;">';

        lista.forEach(function (e) {
          var sinParcial = e.parcial === '';
          var sinPond    = e.ponderacion === '';

          html += '<div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:16px;box-shadow:0 2px 4px rgba(0,0,0,.02);">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">'
            + '<div style="flex:1;"><div style="font-weight:800;color:#1e293b;font-size:1rem;line-height:1.2;">' + esc(e.materia) + '</div></div>'
            + '<div style="width:32px;height:32px;background:#fff1f2;border-radius:10px;display:flex;align-items:center;justify-content:center;">'
            + '<i data-feather="alert-circle" style="color:#e11d48;width:18px;"></i></div></div>'
            + '<div style="background:#f1f5f9;padding:10px;border-radius:12px;display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
            + '<div style="width:28px;height:28px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,.05);">'
            + '<i data-feather="user" style="width:14px;color:#64748b;"></i></div>'
            + '<div style="font-size:.85rem;color:#475569;font-weight:600;">' + esc(e.docente || 'Sin asignar') + '</div></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
            + '<div style="background:' + (sinParcial ? '#fff1f2' : '#ecfdf5') + ';padding:8px;border-radius:10px;'
            + 'border:1px solid ' + (sinParcial ? '#e11d4822' : '#10b98122') + ';text-align:center;">'
            + '<div style="font-size:.6rem;text-transform:uppercase;color:' + (sinParcial ? '#e11d48' : '#059669') + ';font-weight:800;">Estatus Parcial</div>'
            + '<div style="font-size:.75rem;font-weight:800;color:' + (sinParcial ? '#be123c' : '#047857') + ';margin-top:2px;">' + (sinParcial ? 'PENDIENTE' : 'CONFIGURADO') + '</div></div>'
            + '<div style="background:' + (sinPond ? '#fff1f2' : '#ecfdf5') + ';padding:8px;border-radius:10px;'
            + 'border:1px solid ' + (sinPond ? '#e11d4822' : '#10b98122') + ';text-align:center;">'
            + '<div style="font-size:.6rem;text-transform:uppercase;color:' + (sinPond ? '#e11d48' : '#059669') + ';font-weight:800;">Ponderación</div>'
            + '<div style="font-size:.75rem;font-weight:800;color:' + (sinPond ? '#be123c' : '#047857') + ';margin-top:2px;">' + (sinPond ? 'PENDIENTE' : 'CONFIGURADO') + '</div></div>'
            + '</div></div>';
        });

        html += '</div></div></div>';
      });

      html += '</div>';
      container.innerHTML = html;
      feather.replace();
    } catch (e) {
      container.innerHTML = '<div class="panel" style="border-left:4px solid #ef4444;"><h2 style="color:#ef4444;">Error</h2><p>' + esc(e.message) + '</p></div>';
    }
  };

  // ── Helper compartido: directorio en formato antiguo {grupo,materia,docente,correo,parcial,ponderacion} ──
  // Usado tanto por getDirectorio (modal de captura) como por el parche de fetchAllData (filtro de grupos)
  async function buildDirectorio() {
    var results = await Promise.all([
      get(ACAD_API, 'getEstructura'),
      get(ACAD_API, 'getDocentes'),
    ]);
    var estructura = (results[0].estructura || []).filter(function (e) {
      return [1, 3, 5].indexOf(Number(e.semestre)) > -1;
    });
    var docentes = results[1].docentes || [];

    var docenteMap = {};
    docentes.forEach(function (d) {
      docenteMap[norm(d.nombre)] = {
        parcial:     String(d.parcial     || '').trim(),
        ponderacion: String(d.ponderacion || '').trim(),
        correo:      d.correo || d.email  || _correos[norm(d.nombre)] || '',
      };
    });

    // Una fila por grupo+materia (igual que el directorio viejo)
    var seen = {};
    var dir  = [];
    estructura.forEach(function (e) {
      var key = norm(e.grupo) + '|' + norm(e.materia);
      if (seen[key]) return;
      seen[key] = true;
      var dInfo = docenteMap[norm(e.docente)] || {};
      // Si parcial no está configurado aún en DOCENTES, incluir en todos los parciales
      // para que el filtro de initGrupos no bloquee al docente durante el setup
      var parcial = String(dInfo.parcial || '').trim() || '1, 2, 3';
      dir.push({
        grupo:       String(e.grupo   || '').trim().toUpperCase(),
        materia:     String(e.materia || '').trim(),
        docente:     String(e.docente || '').trim(),
        correo:      dInfo.correo      || _correos[norm(e.docente)] || '',
        parcial:     parcial,
        ponderacion: dInfo.ponderacion || '',
      });
    });
    return dir;
  }

  // ── Override: getDirectorio → para el modal de captura (carga de materias) ──
  window.api.getDirectorio = async function () {
    return buildDirectorio();
  };

  // ── Patch: fetchAllData → inyecta directorio del nuevo GAS ──
  // initGrupos usa fetchAllData().directorio para filtrar qué grupos puede ver el docente
  var _origFetchAllData = window.api.fetchAllData.bind(window.api);
  window.api.fetchAllData = async function () {
    var data = await _origFetchAllData();
    data.directorio = await buildDirectorio();
    return data;
  };

  window._log && window._log('[api_nuevo] dashboard + directorio + auditoria + captura → nuevo GAS');
})();
