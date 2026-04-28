/**
 * MÓDULO: PEC — CEB 5/4
 * ─────────────────────────────────────────────────────────────────
 * Responsabilidades EXCLUSIVAS de este módulo:
 *   - Equipos y proyectos PEC
 *   - Minutas de seguimiento
 *   - Calificaciones PEC por parcial
 *   - Cierre y presentación PEC
 *
 * DEPENDE DE: 00-config.gs (incluir en el mismo proyecto GAS)
 *
 * HOJAS REQUERIDAS EN EL SPREADSHEET DE CICLO:
 *   PEC_EQUIPOS   — equipos y proyectos por semestre/turno
 *   PEC_MINUTAS   — minutas capturadas por docente
 *   PEC_CALIF     — calificaciones PEC por parcial
 *   PEC_CIERRE    — información de cierre/presentación
 * ─────────────────────────────────────────────────────────────────
 */

// ── ROUTER GET ────────────────────────────────────────────────────

function doGet(e) {
  try {
    const bloq = _checkMantenimiento();
    if (bloq) return bloq;

    const p      = e.parameter || {};
    const action = (p.action || '').trim();

    switch (action) {
      case 'getDashboardData':  return getDashboardData(p);
      case 'getEquipos':        return getEquipos(p);
      case 'getMinutas':        return getMinutas(p);
      case 'getCalificaciones': return getCalificacionesPec(p);
      case 'getCierre':         return getCierrePec(p);
      case 'ping':              return _ok({ modulo: 'pec', version: '1.0' });
      default:                  return _err('Acción no reconocida: ' + action);
    }
  } catch (err) {
    return _err('Error interno: ' + err.toString());
  }
}

// ── ROUTER POST ───────────────────────────────────────────────────

function doPost(e) {
  try {
    const bloq = _checkMantenimiento();
    if (bloq) return bloq;

    const body   = JSON.parse(e.postData.contents);
    const action = (body.action || '').trim();

    switch (action) {
      case 'guardarMinuta':      return guardarMinuta(body);
      case 'guardarCalificacion': return guardarCalificacionPec(body);
      case 'actualizarEquipo':   return actualizarEquipo(body);
      default: return _err('Acción no reconocida: ' + action);
    }
  } catch (err) {
    return _err('Error interno: ' + err.toString());
  }
}

// ── CONFIGURACIÓN DASHBOARD (PEC info por semestre) ──────────────
// Estos valores se leen desde la hoja PEC_EQUIPOS, no están hardcodeados.

function getDashboardData(p) {
  const hoja = _getHoja('PEC_EQUIPOS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const equipos = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));

  // Construir objeto de config para el frontend (compatible con info_pec.js)
  const config = {};
  equipos.forEach(eq => {
    const key = `pec_${eq.clave}`; // ej: pec_2m, pec_2v, pec_4m, pec_6
    config[key + '_nombre']   = eq.nombre_proyecto;
    config[key + '_objetivo'] = eq.objetivo;
    config[key + '_url']      = eq.url_minuta;
    if (eq.url_presentacion)  config[`pec_presentacion_${eq.clave}_url`] = eq.url_presentacion;
  });

  return _ok(config);
}

// ── LECTURA ───────────────────────────────────────────────────────

function getEquipos(p) {
  const hoja = _getHoja('PEC_EQUIPOS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  let equipos = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));
  if (p.semestre) equipos = equipos.filter(eq => String(eq.semestre) === p.semestre);
  return _ok({ equipos });
}

function getMinutas(p) {
  const hoja = _getHoja('PEC_MINUTAS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  let minutas = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));
  if (p.grupo)   minutas = minutas.filter(m => _normalizar(m.grupo) === _normalizar(p.grupo));
  if (p.equipo)  minutas = minutas.filter(m => _normalizar(m.equipo) === _normalizar(p.equipo));
  if (p.parcial) minutas = minutas.filter(m => String(m.parcial) === p.parcial);
  return _ok({ minutas, total: minutas.length });
}

function getCalificacionesPec(p) {
  const hoja = _getHoja('PEC_CALIF');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  let cals = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));
  if (p.grupo)   cals = cals.filter(c => _normalizar(c.grupo)   === _normalizar(p.grupo));
  if (p.parcial) cals = cals.filter(c => String(c.parcial)      === p.parcial);
  if (p.equipo)  cals = cals.filter(c => _normalizar(c.equipo)  === _normalizar(p.equipo));
  return _ok({ calificaciones: cals, total: cals.length });
}

function getCierrePec(p) {
  const hoja = _getHoja('PEC_CIERRE');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const datos = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));
  return _ok({ cierre: datos });
}

// ── ESCRITURA ─────────────────────────────────────────────────────

function guardarMinuta(body) {
  const hoja = _getHoja('PEC_MINUTAS');
  const [cab] = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues();

  // Verificar si ya existe minuta para este equipo + parcial
  const datos  = hoja.getDataRange().getValues();
  const idxFil = datos.findIndex((f, i) => i > 0
    && _normalizar(String(f[cab.indexOf('equipo')])) === _normalizar(body.equipo)
    && String(f[cab.indexOf('parcial')]) === String(body.parcial)
    && _normalizar(String(f[cab.indexOf('docente')])) === _normalizar(body.docente)
  );

  const fila = cab.map(c => body[c] !== undefined ? body[c] : '');
  fila[cab.indexOf('updated_at')] = new Date();

  if (idxFil > 0) {
    hoja.getRange(idxFil + 1, 1, 1, fila.length).setValues([fila]);
    return _ok({ mensaje: 'Minuta actualizada.', accion: 'actualizado' });
  } else {
    hoja.appendRow(fila);
    return _ok({ mensaje: 'Minuta guardada.', accion: 'creado' });
  }
}

function guardarCalificacionPec(body) {
  const hoja = _getHoja('PEC_CALIF');
  const [cab] = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues();

  const datos  = hoja.getDataRange().getValues();
  const idxFil = datos.findIndex((f, i) => i > 0
    && _normalizar(String(f[cab.indexOf('alumno')])) === _normalizar(body.alumno)
    && _normalizar(String(f[cab.indexOf('equipo')])) === _normalizar(body.equipo)
    && String(f[cab.indexOf('parcial')]) === String(body.parcial)
  );

  const fila = cab.map(c => body[c] !== undefined ? body[c] : '');
  fila[cab.indexOf('updated_at')] = new Date();

  if (idxFil > 0) {
    hoja.getRange(idxFil + 1, 1, 1, fila.length).setValues([fila]);
  } else {
    hoja.appendRow(fila);
  }

  return _ok({ mensaje: 'Calificación PEC guardada.' });
}

function actualizarEquipo(body) {
  const hoja = _getHoja('PEC_EQUIPOS');
  const [cab] = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues();
  const datos = hoja.getDataRange().getValues();
  const idxFil = datos.findIndex((f, i) => i > 0
    && _normalizar(String(f[cab.indexOf('clave')])) === _normalizar(body.clave)
  );

  const fila = cab.map(c => body[c] !== undefined ? body[c] : '');
  fila[cab.indexOf('updated_at')] = new Date();

  if (idxFil > 0) {
    hoja.getRange(idxFil + 1, 1, 1, fila.length).setValues([fila]);
    return _ok({ mensaje: 'Equipo actualizado.' });
  } else {
    hoja.appendRow(fila);
    return _ok({ mensaje: 'Equipo creado.' });
  }
}

// ── Utilidad ──────────────────────────────────────────────────────

function _filaAObj(cabecera, fila) {
  const obj = {};
  cabecera.forEach((c, i) => { obj[c] = fila[i] !== undefined ? fila[i] : ''; });
  return obj;
}
