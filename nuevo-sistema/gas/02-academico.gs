/**
 * MÓDULO: ACADÉMICO — CEB 5/4
 * ─────────────────────────────────────────────────────────────────
 * Responsabilidades:
 *   - Estructura educativa (grupos, materias, cargas horarias)
 *   - Catálogo de alumnos por ciclo
 *   - Catálogo de docentes por ciclo
 *   - Calificaciones (lectura y escritura)
 *   - Dashboard académico
 *
 * DEPENDE DE: 00-config.gs (incluir en el mismo proyecto GAS)
 *
 * HOJAS REQUERIDAS EN EL SPREADSHEET DE CICLO:
 *   ESTRUCTURA     — semestres, grupos, materias, cargas
 *   DOCENTES       — catálogo de docentes del ciclo
 *   ALUMNOS        — matrícula del ciclo
 *   CALIFICACIONES — una fila por alumno × materia × parcial
 *   MATERIAS       — catálogo de materias con docente asignado
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
      case 'getEstructura':   return getEstructura(p);
      case 'getAlumnos':      return getAlumnos(p);
      case 'getDocentes':     return getDocentes(p);
      case 'getGrupos':       return getGrupos(p);
      case 'getMaterias':     return getMaterias(p);
      case 'getCalificaciones': return getCalificaciones(p);
      case 'getDashboard':    return getDashboard(p);
      case 'getCicloInfo':    return getCicloInfo();
      case 'importarDesdeGenerador': return importarDesdeGenerador(p);
      case 'ping':            return _ok({ modulo: 'academico', version: '1.0' });
      default:                return _err('Acción no reconocida: ' + action);
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
      case 'importarEstructura':        return importarEstructura(body);
      case 'importarDesdeGenerador':    return importarDesdeGenerador(body);
      case 'guardarCalificacion':       return guardarCalificacion(body);
      case 'asignarEquipos':            return asignarEquipos(body);
      default: return _err('Acción no reconocida: ' + action);
    }
  } catch (err) {
    return _err('Error interno: ' + err.toString());
  }
}

// ── FUNCIONES DE LECTURA ──────────────────────────────────────────

function getCicloInfo() {
  const cfg = _initConfig();
  return _ok({
    ciclo:   cfg.cicloActivo,
    modo:    cfg.modo,
    version: cfg.version,
  });
}

function getAlumnos(p) {
  const hoja   = _getHoja('ALUMNOS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const grupo  = (p.grupo  || '').trim().toUpperCase();
  const semestre = parseInt(p.semestre || '0');

  let datos = filas
    .filter(f => f[0]) // descartar filas vacías
    .map(f => _filaAObj(cab, f));

  if (grupo)    datos = datos.filter(d => d.grupo    === grupo);
  if (semestre) datos = datos.filter(d => Number(d.semestre) === semestre);

  return _ok({ alumnos: datos, total: datos.length });
}

function getDocentes(p) {
  const hoja   = _getHoja('DOCENTES');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const datos  = filas
    .filter(f => f[0])
    .map(f => _filaAObj(cab, f));
  return _ok({ docentes: datos, total: datos.length });
}

function getGrupos(p) {
  const hoja   = _getHoja('ALUMNOS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const idxGrupo    = cab.indexOf('grupo');
  const idxSemestre = cab.indexOf('semestre');
  const grupos = [...new Set(filas.filter(f => f[0]).map(f => f[idxGrupo]))].sort();
  return _ok({ grupos });
}

function getMaterias(p) {
  const hoja   = _getHoja('MATERIAS');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const semestre = parseInt(p.semestre || '0');
  let datos = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));
  if (semestre) datos = datos.filter(d => Number(d.semestre) === semestre);
  return _ok({ materias: datos });
}

function getEstructura(p) {
  const hoja   = _getHoja('ESTRUCTURA');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  return _ok({ estructura: filas.filter(f => f[0]).map(f => _filaAObj(cab, f)) });
}

function getCalificaciones(p) {
  const hoja   = _getHoja('CALIFICACIONES');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const grupo   = (p.grupo   || '').trim().toUpperCase();
  const parcial = (p.parcial || '').trim();
  const materia = (p.materia || '').toLowerCase().trim();

  let datos = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));
  if (grupo)   datos = datos.filter(d => d.grupo   === grupo);
  if (parcial) datos = datos.filter(d => String(d.parcial) === parcial);
  if (materia) datos = datos.filter(d => _normalizar(d.materia) === materia);

  return _ok({ calificaciones: datos, total: datos.length });
}

function getDashboard(p) {
  // Estadísticas rápidas para el panel administrativo
  const hojaCal = _getHoja('CALIFICACIONES');
  const [cabCal, ...filasCal] = hojaCal.getDataRange().getValues();
  const cals = filasCal.filter(f => f[0]).map(f => _filaAObj(cabCal, f));

  const parcial = p.parcial || '';
  const datos   = parcial ? cals.filter(c => String(c.parcial) === parcial) : cals;

  const notas  = datos.map(c => Number(c.calificacion)).filter(n => !isNaN(n));
  const reprobados = notas.filter(n => n < 6).length;

  return _ok({
    total:          notas.length,
    promedio:       notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2) : 0,
    reprobados,
    pctReprobacion: notas.length ? ((reprobados / notas.length) * 100).toFixed(1) : 0,
  });
}

// ── FUNCIONES DE ESCRITURA ────────────────────────────────────────

function guardarCalificacion(body) {
  const hoja   = _getHoja('CALIFICACIONES');
  const [cab]  = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues();

  // Buscar fila existente (mismo alumno + materia + parcial)
  const datos  = hoja.getDataRange().getValues();
  const idxFil = datos.findIndex((f, i) => i > 0
    && _normalizar(f[cab.indexOf('matricula')]) === _normalizar(body.matricula)
    && _normalizar(f[cab.indexOf('materia')])   === _normalizar(body.materia)
    && String(f[cab.indexOf('parcial')])         === String(body.parcial)
  );

  const fila = cab.map(c => body[c] !== undefined ? body[c] : '');
  fila[cab.indexOf('updated_at')] = new Date();

  if (idxFil > 0) {
    hoja.getRange(idxFil + 1, 1, 1, fila.length).setValues([fila]);
  } else {
    hoja.appendRow(fila);
  }

  return _ok({ mensaje: 'Calificación guardada.' });
}

/**
 * Importa la estructura educativa de inicio de ciclo.
 * Genera automáticamente DOCENTES, GRUPOS y MATERIAS desde ESTRUCTURA.
 */
function importarEstructura(body) {
  if (!body.datos || !Array.isArray(body.datos)) return _err('datos requeridos.');

  const hoja = _getHoja('ESTRUCTURA');
  hoja.clearContents();

  const cols = ['semestre', 'grupo', 'materia', 'docente', 'horas_semana', 'turno'];
  hoja.appendRow(cols);
  body.datos.forEach(f => hoja.appendRow(cols.map(c => f[c] || '')));

  // Generar automáticamente catálogo de docentes únicos
  _generarDocentes(body.datos);

  return _ok({ mensaje: 'Estructura importada.', filas: body.datos.length });
}

function _generarDocentes(datos) {
  const hoja  = _getHoja('DOCENTES');
  hoja.clearContents();
  hoja.appendRow(['nombre', 'materias', 'semestres', 'turno', 'updated_at']);

  const mapa = {};
  datos.forEach(f => {
    if (!f.docente) return;
    if (!mapa[f.docente]) mapa[f.docente] = { materias: new Set(), semestres: new Set(), turno: f.turno };
    mapa[f.docente].materias.add(f.materia);
    mapa[f.docente].semestres.add(f.semestre);
  });

  Object.entries(mapa).forEach(([nombre, d]) => {
    hoja.appendRow([
      nombre,
      [...d.materias].join(', '),
      [...d.semestres].sort().join(', '),
      d.turno,
      new Date(),
    ]);
  });
}

// ── ASIGNACIÓN DE EQUIPOS PEC ─────────────────────────────────────

/**
 * Actualiza la columna `equipo` en ALUMNOS para un lote de alumnos.
 * body.asignaciones = [{ matricula, equipo }, ...]
 */
function asignarEquipos(body) {
  if (!body.asignaciones || !Array.isArray(body.asignaciones))
    return _err('asignaciones[] requerido.');

  const hoja  = _getHoja('ALUMNOS');
  const datos = hoja.getDataRange().getValues();
  const cab   = datos[0];
  const idxMat = cab.indexOf('matricula');
  const idxEq  = cab.indexOf('equipo');

  if (idxEq === -1) return _err('Columna equipo no encontrada en ALUMNOS.');

  const mapa = {};
  body.asignaciones.forEach(a => { mapa[_normalizar(String(a.matricula))] = a.equipo || ''; });

  let actualizados = 0;
  datos.forEach((f, i) => {
    if (i === 0) return;
    const mat = _normalizar(String(f[idxMat]));
    if (mapa[mat] !== undefined) {
      hoja.getRange(i + 1, idxEq + 1).setValue(mapa[mat]);
      actualizados++;
    }
  });

  return _ok({ mensaje: `${actualizados} alumnos actualizados.`, actualizados });
}

// ── MIGRACIÓN DESDE GENERADOR DE HORARIOS ────────────────────────

const GEN_SPREADSHEET_ID = '1HiQ84JcZg8iGk4Z5xrZXeko7OW4jGGfB845k39gmgGM';

/**
 * Lee GEN_ESTRUCTURA del Generador de Horarios y llena la hoja
 * ESTRUCTURA del ciclo activo, luego regenera DOCENTES automáticamente.
 *
 * Body params (todos opcionales):
 *   ciclo   — filtra por ciclo (ej: "2026-2027")
 *   periodo — filtra por periodo ("A" o "B")
 */
function importarDesdeGenerador(body) {
  const ciclo   = String(body.ciclo   || '').trim();
  const periodo = String(body.periodo || '').trim();

  const genSS    = SpreadsheetApp.openById(GEN_SPREADSHEET_ID);
  const genSheet = genSS.getSheetByName('GEN_ESTRUCTURA');
  if (!genSheet) return _err('Hoja GEN_ESTRUCTURA no encontrada en el Generador.');

  const [cab, ...filas] = genSheet.getDataRange().getValues();
  const idx = {};
  cab.forEach((c, i) => { idx[String(c).trim()] = i; });

  const requeridos = ['grupo', 'turno', 'semestre', 'uac', 'tot_horas'];
  for (const campo of requeridos) {
    if (idx[campo] === undefined) return _err('Columna faltante en GEN_ESTRUCTURA: ' + campo);
  }

  let registros = filas.filter(f => f[idx['grupo']]);

  if (ciclo)   registros = registros.filter(r => String(r[idx['ciclo']]   || '') === ciclo);
  if (periodo) registros = registros.filter(r => String(r[idx['periodo']] || '') === periodo);

  if (!registros.length) return _err('Sin registros para los filtros indicados.');

  const datos = registros.map(r => ({
    semestre:     r[idx['semestre']],
    grupo:        r[idx['grupo']],
    materia:      r[idx['uac']],
    docente:      r[idx['docente']] || '',
    horas_semana: r[idx['tot_horas']],
    turno:        r[idx['turno']],
  }));

  // Escribir ESTRUCTURA
  const hoja = _getHoja('ESTRUCTURA');
  hoja.clearContents();
  const cols = ['semestre', 'grupo', 'materia', 'docente', 'horas_semana', 'turno'];
  hoja.appendRow(cols);
  datos.forEach(f => hoja.appendRow(cols.map(c => f[c] !== undefined ? f[c] : '')));

  // Regenerar DOCENTES
  _generarDocentes(datos);

  return _ok({ mensaje: 'Estructura importada desde Generador.', filas: datos.length });
}

// ── Utilidad ──────────────────────────────────────────────────────

function _filaAObj(cabecera, fila) {
  const obj = {};
  cabecera.forEach((c, i) => { obj[c] = fila[i] !== undefined ? fila[i] : ''; });
  return obj;
}
