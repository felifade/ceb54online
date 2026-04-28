/**
 * MÓDULO: EVALUACIÓN — CEB 5/4
 * ─────────────────────────────────────────────────────────────────
 * Responsabilidades EXCLUSIVAS:
 *   - Calificaciones intrasemestrales
 *   - Calificaciones de exámenes parciales
 *   - Concentrado de calificaciones por grupo
 *   - Exportación de sábanas
 *   - Consulta pública de calificaciones (alumnos/padres)
 *
 * DEPENDE DE: 00-config.gs (incluir en el mismo proyecto GAS)
 *
 * HOJAS REQUERIDAS EN EL SPREADSHEET DE CICLO:
 *   EVALUACIONES   — una fila por alumno × materia × parcial × tipo
 *   ALUMNOS        — referencia cruzada (solo lectura)
 *   MATERIAS       — referencia cruzada (solo lectura)
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
      case 'getCalificaciones':  return getCalificaciones(p);
      case 'getConcentrado':     return getConcentrado(p);
      case 'getCalAlumno':       return getCalAlumno(p);   // vista alumno/padre
      case 'getSabana':          return getSabana(p);
      case 'getIntrasemestrales': return getIntrasemestrales(p);
      case 'ping':               return _ok({ modulo: 'evaluacion', version: '1.0' });
      default:                   return _err('Acción no reconocida: ' + action);
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
      case 'guardarCalificacion':  return guardarCalificacion(body);
      case 'importarSabana':       return importarSabana(body);
      default: return _err('Acción no reconocida: ' + action);
    }
  } catch (err) {
    return _err('Error interno: ' + err.toString());
  }
}

// ── LECTURA ───────────────────────────────────────────────────────

function getCalificaciones(p) {
  const hoja = _getHoja('EVALUACIONES');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  let datos = filas.filter(f => f[0]).map(f => _filaAObj(cab, f));

  if (p.grupo)   datos = datos.filter(d => _normalizar(d.grupo)   === _normalizar(p.grupo));
  if (p.materia) datos = datos.filter(d => _normalizar(d.materia) === _normalizar(p.materia));
  if (p.parcial) datos = datos.filter(d => String(d.parcial)      === p.parcial);
  if (p.tipo)    datos = datos.filter(d => _normalizar(d.tipo)    === _normalizar(p.tipo));

  return _ok({ calificaciones: datos, total: datos.length });
}

function getCalAlumno(p) {
  // Vista pública para alumno o padre — solo requiere matrícula
  if (!p.matricula) return _err('matricula requerida.');
  const hoja = _getHoja('EVALUACIONES');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const mat  = _normalizar(p.matricula);
  const datos = filas
    .filter(f => f[0] && _normalizar(String(f[cab.indexOf('matricula')])) === mat)
    .map(f => _filaAObj(cab, f));

  // Agrupar por materia + parcial
  const agrupado = {};
  datos.forEach(d => {
    const k = `${_normalizar(d.materia)}_p${d.parcial}`;
    agrupado[k] = agrupado[k] || { materia: d.materia, parcial: d.parcial, tipos: {} };
    agrupado[k].tipos[d.tipo] = d.calificacion;
  });

  return _ok({ matricula: p.matricula, calificaciones: Object.values(agrupado) });
}

function getConcentrado(p) {
  if (!p.grupo) return _err('grupo requerido.');
  const hoja = _getHoja('EVALUACIONES');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const grupo   = _normalizar(p.grupo);
  const parcial = p.parcial || '';

  let datos = filas
    .filter(f => f[0] && _normalizar(String(f[cab.indexOf('grupo')])) === grupo)
    .map(f => _filaAObj(cab, f));

  if (parcial) datos = datos.filter(d => String(d.parcial) === parcial);

  // Agrupar por alumno → promedio por materia
  const porAlumno = {};
  datos.forEach(d => {
    const k = _normalizar(d.matricula);
    if (!porAlumno[k]) porAlumno[k] = { matricula: d.matricula, nombre: d.nombre, materias: {} };
    const mat = _normalizar(d.materia);
    if (!porAlumno[k].materias[mat]) porAlumno[k].materias[mat] = [];
    porAlumno[k].materias[mat].push(Number(d.calificacion));
  });

  const concentrado = Object.values(porAlumno).map(a => {
    const promedios = {};
    Object.entries(a.materias).forEach(([m, notas]) => {
      promedios[m] = (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1);
    });
    return { matricula: a.matricula, nombre: a.nombre, promedios };
  });

  return _ok({ grupo: p.grupo, parcial, concentrado });
}

function getSabana(p) {
  if (!p.grupo) return _err('grupo requerido.');
  const hoja = _getHoja('EVALUACIONES');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const grupo = _normalizar(p.grupo);
  const datos = filas
    .filter(f => f[0] && _normalizar(String(f[cab.indexOf('grupo')])) === grupo)
    .map(f => _filaAObj(cab, f));
  return _ok({ grupo: p.grupo, filas: datos, columnas: cab });
}

function getIntrasemestrales(p) {
  if (!p.grupo) return _err('grupo requerido.');
  const hoja = _getHoja('EVALUACIONES');
  const [cab, ...filas] = hoja.getDataRange().getValues();
  const grupo = _normalizar(p.grupo);
  const datos = filas
    .filter(f => f[0]
      && _normalizar(String(f[cab.indexOf('grupo')])) === grupo
      && _normalizar(String(f[cab.indexOf('tipo')])) === 'intrasemestral'
    )
    .map(f => _filaAObj(cab, f));
  return _ok({ grupo: p.grupo, intrasemestrales: datos });
}

// ── ESCRITURA ─────────────────────────────────────────────────────

function guardarCalificacion(body) {
  const hoja = _getHoja('EVALUACIONES');
  const [cab] = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues();
  const datos  = hoja.getDataRange().getValues();

  // Buscar fila existente (mismo alumno + materia + parcial + tipo)
  const idxFil = datos.findIndex((f, i) => i > 0
    && _normalizar(String(f[cab.indexOf('matricula')])) === _normalizar(body.matricula)
    && _normalizar(String(f[cab.indexOf('materia')]))   === _normalizar(body.materia)
    && String(f[cab.indexOf('parcial')])                === String(body.parcial)
    && _normalizar(String(f[cab.indexOf('tipo')]))      === _normalizar(body.tipo)
  );

  const fila = cab.map(c => body[c] !== undefined ? body[c] : '');
  fila[cab.indexOf('updated_at')] = new Date();

  if (idxFil > 0) {
    hoja.getRange(idxFil + 1, 1, 1, fila.length).setValues([fila]);
    return _ok({ mensaje: 'Calificación actualizada.', accion: 'actualizado' });
  } else {
    hoja.appendRow(fila);
    return _ok({ mensaje: 'Calificación guardada.', accion: 'creado' });
  }
}

function importarSabana(body) {
  if (!body.filas || !Array.isArray(body.filas)) return _err('filas[] requerido.');
  const hoja = _getHoja('EVALUACIONES');
  const [cab] = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues();
  body.filas.forEach(f => {
    const fila = cab.map(c => f[c] !== undefined ? f[c] : '');
    fila[cab.indexOf('updated_at')] = new Date();
    hoja.appendRow(fila);
  });
  return _ok({ mensaje: `${body.filas.length} registros importados.` });
}

// ── Utilidad ──────────────────────────────────────────────────────

function _filaAObj(cabecera, fila) {
  const obj = {};
  cabecera.forEach((c, i) => { obj[c] = fila[i] !== undefined ? fila[i] : ''; });
  return obj;
}
