/**
 * MÓDULO: TUTORÍAS — CEB 5/4
 * ─────────────────────────────────────────────────────────────────
 * Responsabilidades EXCLUSIVAS:
 *   - Registros de sesiones de tutoría
 *   - Seguimiento por alumno y grupo
 *   - Reportes de asistencia a tutoría
 *   - Detección de alumnos en riesgo académico
 *
 * DEPENDE DE: 00-config.gs (incluir en el mismo proyecto GAS)
 *
 * HOJAS REQUERIDAS EN EL SPREADSHEET DE CICLO:
 *   TUTORIAS       — registros de sesiones
 *   ALUMNOS        — referencia cruzada (solo lectura)
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
      case 'getTutorias':       return getTutorias(p);
      case 'getResumenGrupo':   return getResumenGrupo(p);
      case 'getAlumnosRiesgo':  return getAlumnosRiesgo(p);
      case 'ping':              return _ok({ modulo: 'tutorias', version: '1.0' });
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
      case 'guardarTutoria':    return guardarTutoria(body);
      case 'marcarAsistencia':  return marcarAsistencia(body);
      default: return _err('Acción no reconocida: ' + action);
    }
  } catch (err) {
    return _err('Error interno: ' + err.toString());
  }
}

// ── LECTURA ───────────────────────────────────────────────────────

function getTutorias(p) {
  const hoja = _getHoja('TUTORIAS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  let datos = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));

  if (p.grupo)   datos = datos.filter(d => _normalizar(d.grupo)   === _normalizar(p.grupo));
  if (p.docente) datos = datos.filter(d => _normalizar(d.docente) === _normalizar(p.docente));
  if (p.parcial) datos = datos.filter(d => String(d.parcial)      === p.parcial);
  if (p.fecha_desde) {
    const desde = new Date(p.fecha_desde);
    datos = datos.filter(d => new Date(d.fecha) >= desde);
  }

  return _ok({ tutorias: datos, total: datos.length });
}

function getResumenGrupo(p) {
  if (!p.grupo) return _err('grupo requerido.');
  const hoja = _getHoja('TUTORIAS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const grupo = _normalizar(p.grupo);
  const datos = filas
    .filter(f => f[0] && _normalizar(String(f[cab.indexOf('grupo')])) === grupo)
    .map(f => _filaAObj(cab, f));

  // Contar sesiones por alumno
  const porAlumno = {};
  datos.forEach(d => {
    const k = _normalizar(d.alumno || d.matricula);
    porAlumno[k] = (porAlumno[k] || 0) + 1;
  });

  return _ok({
    grupo,
    total_sesiones: datos.length,
    total_alumnos:  Object.keys(porAlumno).length,
    resumen_alumnos: Object.entries(porAlumno).map(([a, n]) => ({ alumno: a, sesiones: n })),
  });
}

function getAlumnosRiesgo(p) {
  // Alumnos con 0 sesiones de tutoría en el parcial actual
  const hojaT = _getHoja('TUTORIAS');
  const [cabT, ...filasT] = hojaT.getDataRange().getValues();
  const parcial = p.parcial || '1';
  const grupo   = _normalizar(p.grupo || '');

  const conTutoria = new Set(
    filasT
      .filter(f => f[0] && String(f[cabT.indexOf('parcial')]) === parcial)
      .filter(f => !grupo || _normalizar(String(f[cabT.indexOf('grupo')])) === grupo)
      .map(f => _normalizar(String(f[cabT.indexOf('matricula')])))
  );

  // Leer alumnos del grupo
  const hojaA = _getHoja('ALUMNOS');
  const [cabA, ...filasA] = hojaA.getDataRange().getValues();
  let alumnos = filasA.filter(f => f[0]).map(f => _filaAObj(cabA, f));
  if (grupo) alumnos = alumnos.filter(a => _normalizar(a.grupo) === grupo);

  const enRiesgo = alumnos.filter(a => !conTutoria.has(_normalizar(a.matricula)));
  return _ok({ en_riesgo: enRiesgo, total: enRiesgo.length });
}

// ── ESCRITURA ─────────────────────────────────────────────────────

function guardarTutoria(body) {
  const hoja = _getHoja('TUTORIAS');
  const [cab] = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues();

  // No sobrescribir — cada sesión es un registro nuevo
  const fila = cab.map(c => body[c] !== undefined ? body[c] : '');
  fila[cab.indexOf('created_at')] = new Date();
  hoja.appendRow(fila);

  return _ok({ mensaje: 'Sesión de tutoría registrada.' });
}

function marcarAsistencia(body) {
  if (!body.tutorias || !Array.isArray(body.tutorias)) return _err('tutorias[] requerido.');
  const hoja = _getHoja('TUTORIAS');
  body.tutorias.forEach(t => {
    const fila = [
      t.matricula, t.nombre, t.grupo, t.docente, t.parcial,
      t.fecha, t.tipo, t.observaciones, new Date(),
    ];
    hoja.appendRow(fila);
  });
  return _ok({ mensaje: `${body.tutorias.length} registros guardados.` });
}

// ── Utilidad ──────────────────────────────────────────────────────

function _filaAObj(cabecera, fila) {
  const obj = {};
  cabecera.forEach((c, i) => { obj[c] = fila[i] !== undefined ? fila[i] : ''; });
  return obj;
}
