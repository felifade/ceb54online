/* ═══════════════════════════════════════════════════════════════════
   GENERADOR DE HORARIOS ONLINE — Google Apps Script Backend
   CEB 5/4 — v1.0.0
   ═══════════════════════════════════════════════════════════════════
   INSTRUCCIONES DE DESPLIEGUE:
   1. Crear un nuevo proyecto de Apps Script (independiente).
   2. Pegar TODO este código como Code.gs.
   3. Poner el ID de tu Google Sheets en SPREADSHEET_ID_ (ver abajo).
      El ID está en la URL: https://docs.google.com/spreadsheets/d/→ID←/edit
   4. Publicar → Aplicación web
        Ejecutar como: yo mismo
        Quién tiene acceso: cualquiera (anónimo)
   5. Copiar la URL del despliegue y pegarla en js/api_generador.js
   ═══════════════════════════════════════════════════════════════════ */

// ── CONFIGURACIÓN ─────────────────────────────────────────────────
const GEN_SPREADSHEET_ID_ = '';          // ← Pega aquí el ID de tu Sheets
const GEN_ADMIN_KEY_       = 'CEB54_GENERADOR_ADMIN';

// ── DEFINICIÓN DE HOJAS ───────────────────────────────────────────
const GEN_SHEETS_ = {
  CONFIG: {
    name: 'GEN_CONFIG',
    headers: ['clave', 'valor']
  },
  DOCENTES: {
    name: 'GEN_DOCENTES',
    headers: ['id', 'clave', 'nombre', 'apellido_paterno', 'apellido_materno', 'especialidad', 'hrs_max', 'activo']
  },
  GRUPOS: {
    name: 'GEN_GRUPOS',
    headers: ['id', 'clave', 'grado', 'grupo', 'turno', 'capacidad', 'ciclo', 'activo']
  },
  MATERIAS: {
    name: 'GEN_MATERIAS',
    headers: ['id', 'clave', 'nombre', 'componente', 'hrs_semana', 'activo']
  },
  AULAS: {
    name: 'GEN_AULAS',
    headers: ['id', 'clave', 'nombre', 'capacidad', 'tipo', 'activo']
  },
  CARGA: {
    name: 'GEN_CARGA_HORARIA',
    headers: ['id', 'ciclo', 'docente_id', 'grupo_id', 'materia_id', 'hrs_asignadas']
  },
  DISPONIBILIDAD: {
    name: 'GEN_DISPONIBILIDAD',
    headers: ['id', 'ciclo', 'docente_id', 'dia', 'bloque', 'disponible', 'nota']
  },
  HORARIOS: {
    name: 'GEN_HORARIOS',
    headers: ['id', 'ciclo', 'version', 'grupo_id', 'dia', 'bloque', 'materia_id', 'docente_id', 'aula_id']
  },
  RESTRICCIONES: {
    name: 'GEN_RESTRICCIONES',
    headers: ['id', 'tipo', 'ciclo', 'entidad_id', 'dia', 'bloque', 'descripcion']
  },
  VERSIONES: {
    name: 'GEN_VERSIONES',
    headers: ['id', 'ciclo', 'version', 'fecha', 'descripcion', 'activa']
  }
};

// ══════════════════════════════════════════════════════════════════
// HELPERS GENÉRICOS
// ══════════════════════════════════════════════════════════════════

function _genGetSS_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {}
  if (ss) return ss;
  if (!GEN_SPREADSHEET_ID_)
    throw new Error('Configura GEN_SPREADSHEET_ID_ en el código del GAS.');
  return SpreadsheetApp.openById(GEN_SPREADSHEET_ID_);
}

/** Obtiene o crea una hoja con sus encabezados. */
function _genGetSheet_(sheetKey) {
  var def = GEN_SHEETS_[sheetKey];
  if (!def) throw new Error('Hoja desconocida: ' + sheetKey);
  var ss    = _genGetSS_();
  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.appendRow(def.headers);
    sheet.getRange(1, 1, 1, def.headers.length)
         .setFontWeight('bold')
         .setBackground('#1e3a5f')
         .setFontColor('#ffffff');
  }
  return sheet;
}

/** Convierte filas de una hoja en array de objetos usando la primera fila como keys. */
function _genSheetToObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(String);
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/** Genera un ID único (timestamp + random). */
function _genNewId_() {
  return Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

/** Respuesta JSON helper. */
function _genJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

/** Valida la clave de administrador. */
function _genCheckAdmin_(key) {
  if ((key || '') !== GEN_ADMIN_KEY_)
    throw new Error('Clave de administrador incorrecta.');
}

// ── CRUD GENÉRICO ─────────────────────────────────────────────────

/** Devuelve todos los registros activos (o todos si includeInactive=true). */
function _genGetAll_(sheetKey, filterFn) {
  var sheet = _genGetSheet_(sheetKey);
  var rows  = _genSheetToObjects_(sheet);
  if (filterFn) return rows.filter(filterFn);
  return rows;
}

/** Inserta o actualiza un registro por su id. */
function _genUpsert_(sheetKey, record) {
  var def   = GEN_SHEETS_[sheetKey];
  var sheet = _genGetSheet_(sheetKey);

  // Si no tiene id, es inserción
  if (!record.id) {
    record.id = _genNewId_();
    var row = def.headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });
    sheet.appendRow(row);
    return { action: 'inserted', id: record.id };
  }

  // Buscar fila existente
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var idIdx = headers.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(record.id)) {
      var newRow = headers.map(function(h) { return record[h] !== undefined ? record[h] : data[i][headers.indexOf(h)]; });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      return { action: 'updated', id: record.id };
    }
  }

  // No encontrado → insertar
  var row = def.headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });
  sheet.appendRow(row);
  return { action: 'inserted', id: record.id };
}

/** Elimina (borrado físico) un registro por su id. */
function _genDelete_(sheetKey, id) {
  var sheet   = _genGetSheet_(sheetKey);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var idIdx   = headers.indexOf('id');
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idIdx]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { action: 'deleted', id: id };
    }
  }
  throw new Error('Registro no encontrado: ' + id);
}

/** Elimina todos los registros que coincidan con un filtro de columna=valor. */
function _genDeleteWhere_(sheetKey, col, val) {
  var sheet   = _genGetSheet_(sheetKey);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var colIdx  = headers.indexOf(col);
  if (colIdx === -1) return { deleted: 0 };
  var count = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIdx]) === String(val)) {
      sheet.deleteRow(i + 1);
      count++;
    }
  }
  return { deleted: count };
}

// ══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════════

function _genGetConfig_() {
  var sheet = _genGetSheet_('CONFIG');
  var rows  = _genSheetToObjects_(sheet);
  var cfg   = {};
  rows.forEach(function(r) { if (r.clave) cfg[r.clave] = r.valor; });
  return cfg;
}

function _genSaveConfig_(cfg) {
  var sheet   = _genGetSheet_('CONFIG');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var claveIdx = headers.indexOf('clave');
  var valorIdx = headers.indexOf('valor');

  // Actualizar existentes y recoger nuevos
  var updated = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][claveIdx]);
    if (cfg[k] !== undefined) {
      sheet.getRange(i + 1, valorIdx + 1).setValue(cfg[k]);
      updated[k] = true;
    }
  }
  // Insertar nuevos
  Object.keys(cfg).forEach(function(k) {
    if (!updated[k]) sheet.appendRow([k, cfg[k]]);
  });
  return { status: 'ok', message: 'Configuración guardada.' };
}

// ══════════════════════════════════════════════════════════════════
// CATÁLOGOS
// ══════════════════════════════════════════════════════════════════

function _genGetDocentes_()  { return _genGetAll_('DOCENTES'); }
function _genGetGrupos_()    { return _genGetAll_('GRUPOS'); }
function _genGetMaterias_()  { return _genGetAll_('MATERIAS'); }
function _genGetAulas_()     { return _genGetAll_('AULAS'); }

function _genSaveDocente_(d)  { return _genUpsert_('DOCENTES', d); }
function _genSaveGrupo_(g)    { return _genUpsert_('GRUPOS', g); }
function _genSaveMateria_(m)  { return _genUpsert_('MATERIAS', m); }
function _genSaveAula_(a)     { return _genUpsert_('AULAS', a); }

function _genDeleteDocente_(id)  { return _genDelete_('DOCENTES', id); }
function _genDeleteGrupo_(id)    { return _genDelete_('GRUPOS', id); }
function _genDeleteMateria_(id)  { return _genDelete_('MATERIAS', id); }
function _genDeleteAula_(id)     { return _genDelete_('AULAS', id); }

// ══════════════════════════════════════════════════════════════════
// CARGA HORARIA
// ══════════════════════════════════════════════════════════════════

function _genGetCarga_(ciclo) {
  return _genGetAll_('CARGA', function(r) {
    return !ciclo || String(r.ciclo) === String(ciclo);
  });
}

function _genSaveCargaFila_(fila) { return _genUpsert_('CARGA', fila); }

function _genDeleteCargaFila_(id) { return _genDelete_('CARGA', id); }

/** Reemplaza toda la carga de un grupo en un ciclo. */
function _genReplaceCargaGrupo_(adminKey, ciclo, grupo_id, filas) {
  _genCheckAdmin_(adminKey);
  var sheet   = _genGetSheet_('CARGA');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var cicloIdx  = headers.indexOf('ciclo');
  var grupoIdx  = headers.indexOf('grupo_id');
  // Borrar existentes
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][cicloIdx]) === String(ciclo) &&
        String(data[i][grupoIdx]) === String(grupo_id)) {
      sheet.deleteRow(i + 1);
    }
  }
  // Insertar nuevas
  filas.forEach(function(f) {
    f.ciclo    = ciclo;
    f.grupo_id = grupo_id;
    if (!f.id) f.id = _genNewId_();
    var row = GEN_SHEETS_.CARGA.headers.map(function(h) { return f[h] !== undefined ? f[h] : ''; });
    sheet.appendRow(row);
  });
  return { status: 'ok', message: 'Carga horaria actualizada (' + filas.length + ' filas).' };
}

// ══════════════════════════════════════════════════════════════════
// DISPONIBILIDAD
// ══════════════════════════════════════════════════════════════════

function _genGetDisponibilidad_(ciclo, docente_id) {
  return _genGetAll_('DISPONIBILIDAD', function(r) {
    var ok = true;
    if (ciclo)      ok = ok && String(r.ciclo) === String(ciclo);
    if (docente_id) ok = ok && String(r.docente_id) === String(docente_id);
    return ok;
  });
}

/** Reemplaza toda la disponibilidad de un docente en un ciclo. */
function _genReplaceDisponibilidad_(ciclo, docente_id, filas) {
  var sheet   = _genGetSheet_('DISPONIBILIDAD');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var cicloIdx    = headers.indexOf('ciclo');
  var docenteIdx  = headers.indexOf('docente_id');
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][cicloIdx]) === String(ciclo) &&
        String(data[i][docenteIdx]) === String(docente_id)) {
      sheet.deleteRow(i + 1);
    }
  }
  filas.forEach(function(f) {
    f.ciclo      = ciclo;
    f.docente_id = docente_id;
    if (!f.id) f.id = _genNewId_();
    var row = GEN_SHEETS_.DISPONIBILIDAD.headers.map(function(h) { return f[h] !== undefined ? f[h] : ''; });
    sheet.appendRow(row);
  });
  return { status: 'ok', message: 'Disponibilidad guardada.' };
}

// ══════════════════════════════════════════════════════════════════
// HORARIOS
// ══════════════════════════════════════════════════════════════════

function _genGetHorarios_(ciclo, version) {
  return _genGetAll_('HORARIOS', function(r) {
    var ok = true;
    if (ciclo)   ok = ok && String(r.ciclo) === String(ciclo);
    if (version) ok = ok && String(r.version) === String(version);
    return ok;
  });
}

function _genSaveHorarioFila_(fila) { return _genUpsert_('HORARIOS', fila); }

function _genDeleteHorarioFila_(id) { return _genDelete_('HORARIOS', id); }

/** Limpia el horario de un grupo/ciclo/version y reescribe. */
function _genReplaceHorarioGrupo_(ciclo, version, grupo_id, filas) {
  var sheet   = _genGetSheet_('HORARIOS');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var cicloIdx   = headers.indexOf('ciclo');
  var verIdx     = headers.indexOf('version');
  var grupoIdx   = headers.indexOf('grupo_id');
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][cicloIdx]) === String(ciclo) &&
        String(data[i][verIdx])   === String(version) &&
        String(data[i][grupoIdx]) === String(grupo_id)) {
      sheet.deleteRow(i + 1);
    }
  }
  filas.forEach(function(f) {
    f.ciclo    = ciclo;
    f.version  = version;
    f.grupo_id = grupo_id;
    if (!f.id) f.id = _genNewId_();
    var row = GEN_SHEETS_.HORARIOS.headers.map(function(h) { return f[h] !== undefined ? f[h] : ''; });
    sheet.appendRow(row);
  });
  return { status: 'ok', message: 'Horario guardado.' };
}

// ══════════════════════════════════════════════════════════════════
// RESTRICCIONES
// ══════════════════════════════════════════════════════════════════

function _genGetRestricciones_(ciclo) {
  return _genGetAll_('RESTRICCIONES', function(r) {
    return !ciclo || String(r.ciclo) === String(ciclo);
  });
}

function _genSaveRestriccion_(r)  { return _genUpsert_('RESTRICCIONES', r); }
function _genDeleteRestriccion_(id) { return _genDelete_('RESTRICCIONES', id); }

// ══════════════════════════════════════════════════════════════════
// VERSIONES
// ══════════════════════════════════════════════════════════════════

function _genGetVersiones_(ciclo) {
  return _genGetAll_('VERSIONES', function(r) {
    return !ciclo || String(r.ciclo) === String(ciclo);
  });
}

function _genSaveVersion_(v) { return _genUpsert_('VERSIONES', v); }

// ══════════════════════════════════════════════════════════════════
// DETECCIÓN DE CONFLICTOS (server-side)
// ══════════════════════════════════════════════════════════════════

function _genDetectarConflictos_(ciclo, version) {
  var horarios      = _genGetHorarios_(ciclo, version);
  var disponibilidad = _genGetDisponibilidad_(ciclo);
  var conflictos    = [];

  // Índices rápidos
  var docenteSlot  = {};  // docente_id|dia|bloque → id
  var grupoSlot    = {};  // grupo_id|dia|bloque   → id
  var aulaSlot     = {};  // aula_id|dia|bloque    → id
  var dispSet      = {};  // docente_id|dia|bloque → disponible

  disponibilidad.forEach(function(d) {
    var k = d.docente_id + '|' + d.dia + '|' + d.bloque;
    dispSet[k] = String(d.disponible);
  });

  horarios.forEach(function(h) {
    // 1. Docente en dos grupos al mismo tiempo
    if (h.docente_id) {
      var dk = h.docente_id + '|' + h.dia + '|' + h.bloque;
      if (docenteSlot[dk]) {
        conflictos.push({
          tipo: 'DOCENTE_DUPLICADO',
          severidad: 'error',
          mensaje: 'Docente asignado a dos grupos en el mismo bloque.',
          fila_a: docenteSlot[dk],
          fila_b: h.id,
          dia: h.dia,
          bloque: h.bloque,
          docente_id: h.docente_id
        });
      } else {
        docenteSlot[dk] = h.id;
      }

      // 2. Docente marcado como no disponible
      if (dispSet[dk] === 'NO' || dispSet[dk] === 'false') {
        conflictos.push({
          tipo: 'DOCENTE_NO_DISPONIBLE',
          severidad: 'warning',
          mensaje: 'Docente asignado en bloque marcado como no disponible.',
          fila: h.id,
          dia: h.dia,
          bloque: h.bloque,
          docente_id: h.docente_id
        });
      }
    }

    // 3. Grupo con dos asignaciones al mismo tiempo
    if (h.grupo_id) {
      var gk = h.grupo_id + '|' + h.dia + '|' + h.bloque;
      if (grupoSlot[gk]) {
        conflictos.push({
          tipo: 'GRUPO_DUPLICADO',
          severidad: 'error',
          mensaje: 'Grupo con dos asignaciones en el mismo bloque.',
          fila_a: grupoSlot[gk],
          fila_b: h.id,
          dia: h.dia,
          bloque: h.bloque,
          grupo_id: h.grupo_id
        });
      } else {
        grupoSlot[gk] = h.id;
      }
    }

    // 4. Aula con dos grupos al mismo tiempo
    if (h.aula_id) {
      var ak = h.aula_id + '|' + h.dia + '|' + h.bloque;
      if (aulaSlot[ak]) {
        conflictos.push({
          tipo: 'AULA_DUPLICADA',
          severidad: 'error',
          mensaje: 'Aula ocupada por dos grupos en el mismo bloque.',
          fila_a: aulaSlot[ak],
          fila_b: h.id,
          dia: h.dia,
          bloque: h.bloque,
          aula_id: h.aula_id
        });
      } else {
        aulaSlot[ak] = h.id;
      }
    }
  });

  return conflictos;
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD / RESUMEN
// ══════════════════════════════════════════════════════════════════

function _genGetResumen_(ciclo, version) {
  var docentes  = _genGetDocentes_();
  var grupos    = _genGetGrupos_();
  var materias  = _genGetMaterias_();
  var aulas     = _genGetAulas_();
  var carga     = _genGetCarga_(ciclo);
  var horarios  = _genGetHorarios_(ciclo, version);
  var conflictos = _genDetectarConflictos_(ciclo, version);

  // Grupos con horario asignado
  var gruposConHorario = new Set(horarios.map(function(h) { return h.grupo_id; })).size;
  var gruposTotales    = grupos.filter(function(g) { return String(g.activo) !== 'false' && g.activo !== false; }).length;

  // Docentes con carga
  var docentesConCarga = new Set(carga.map(function(c) { return c.docente_id; })).size;

  return {
    totalDocentes:    docentes.length,
    totalGrupos:      gruposTotales,
    totalMaterias:    materias.length,
    totalAulas:       aulas.length,
    gruposConHorario: gruposConHorario,
    docentesConCarga: docentesConCarga,
    totalConflictos:  conflictos.filter(function(c) { return c.severidad === 'error'; }).length,
    totalWarnings:    conflictos.filter(function(c) { return c.severidad === 'warning'; }).length,
    porcentajeAvance: gruposTotales > 0 ? Math.round((gruposConHorario / gruposTotales) * 100) : 0
  };
}

// ══════════════════════════════════════════════════════════════════
// PUNTO DE ENTRADA GET
// ══════════════════════════════════════════════════════════════════

function doGet(e) {
  var p      = (e && e.parameter) ? e.parameter : {};
  var action = p.action || '';

  try {
    var result;
    switch (action) {
      case 'getConfig':
        result = { status: 'ok', data: _genGetConfig_() };
        break;
      case 'getDocentes':
        result = { status: 'ok', data: _genGetDocentes_() };
        break;
      case 'getGrupos':
        result = { status: 'ok', data: _genGetGrupos_() };
        break;
      case 'getMaterias':
        result = { status: 'ok', data: _genGetMaterias_() };
        break;
      case 'getAulas':
        result = { status: 'ok', data: _genGetAulas_() };
        break;
      case 'getCarga':
        result = { status: 'ok', data: _genGetCarga_(p.ciclo) };
        break;
      case 'getDisponibilidad':
        result = { status: 'ok', data: _genGetDisponibilidad_(p.ciclo, p.docente_id) };
        break;
      case 'getHorarios':
        result = { status: 'ok', data: _genGetHorarios_(p.ciclo, p.version) };
        break;
      case 'getRestricciones':
        result = { status: 'ok', data: _genGetRestricciones_(p.ciclo) };
        break;
      case 'getVersiones':
        result = { status: 'ok', data: _genGetVersiones_(p.ciclo) };
        break;
      case 'getConflictos':
        result = { status: 'ok', data: _genDetectarConflictos_(p.ciclo, p.version) };
        break;
      case 'getResumen':
        result = { status: 'ok', data: _genGetResumen_(p.ciclo, p.version) };
        break;
      case 'ping':
        result = { status: 'ok', message: 'Generador de Horarios Online v1.0.0' };
        break;
      default:
        result = { status: 'error', message: 'Acción GET no reconocida: ' + action };
    }
    return _genJson_(result);
  } catch (err) {
    return _genJson_({ status: 'error', message: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
// PUNTO DE ENTRADA POST
// ══════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action || '';
    var key    = body.adminKey || '';
    var result;

    switch (action) {

      // ── CONFIG ───────────────────────────────────────────────
      case 'saveConfig':
        _genCheckAdmin_(key);
        result = _genSaveConfig_(body.config);
        break;

      // ── DOCENTES ─────────────────────────────────────────────
      case 'saveDocente':
        _genCheckAdmin_(key);
        var r1 = _genSaveDocente_(body.record);
        result = { status: 'ok', message: 'Docente guardado.', result: r1 };
        break;
      case 'deleteDocente':
        _genCheckAdmin_(key);
        _genDeleteDocente_(body.id);
        result = { status: 'ok', message: 'Docente eliminado.' };
        break;

      // ── GRUPOS ───────────────────────────────────────────────
      case 'saveGrupo':
        _genCheckAdmin_(key);
        var r2 = _genSaveGrupo_(body.record);
        result = { status: 'ok', message: 'Grupo guardado.', result: r2 };
        break;
      case 'deleteGrupo':
        _genCheckAdmin_(key);
        _genDeleteGrupo_(body.id);
        result = { status: 'ok', message: 'Grupo eliminado.' };
        break;

      // ── MATERIAS ─────────────────────────────────────────────
      case 'saveMateria':
        _genCheckAdmin_(key);
        var r3 = _genSaveMateria_(body.record);
        result = { status: 'ok', message: 'Materia guardada.', result: r3 };
        break;
      case 'deleteMateria':
        _genCheckAdmin_(key);
        _genDeleteMateria_(body.id);
        result = { status: 'ok', message: 'Materia eliminada.' };
        break;

      // ── AULAS ────────────────────────────────────────────────
      case 'saveAula':
        _genCheckAdmin_(key);
        var r4 = _genSaveAula_(body.record);
        result = { status: 'ok', message: 'Aula guardada.', result: r4 };
        break;
      case 'deleteAula':
        _genCheckAdmin_(key);
        _genDeleteAula_(body.id);
        result = { status: 'ok', message: 'Aula eliminada.' };
        break;

      // ── CARGA HORARIA ─────────────────────────────────────────
      case 'saveCargaFila':
        _genCheckAdmin_(key);
        var r5 = _genSaveCargaFila_(body.record);
        result = { status: 'ok', message: 'Carga guardada.', result: r5 };
        break;
      case 'deleteCargaFila':
        _genCheckAdmin_(key);
        _genDeleteCargaFila_(body.id);
        result = { status: 'ok', message: 'Carga eliminada.' };
        break;
      case 'replaceCargaGrupo':
        result = _genReplaceCargaGrupo_(key, body.ciclo, body.grupo_id, body.filas || []);
        break;

      // ── DISPONIBILIDAD ────────────────────────────────────────
      case 'saveDisponibilidad':
        _genCheckAdmin_(key);
        var r6 = _genReplaceDisponibilidad_(body.ciclo, body.docente_id, body.filas || []);
        result = r6;
        break;

      // ── HORARIOS ─────────────────────────────────────────────
      case 'saveHorarioFila':
        _genCheckAdmin_(key);
        var r7 = _genSaveHorarioFila_(body.record);
        result = { status: 'ok', message: 'Bloque guardado.', result: r7 };
        break;
      case 'deleteHorarioFila':
        _genCheckAdmin_(key);
        _genDeleteHorarioFila_(body.id);
        result = { status: 'ok', message: 'Bloque eliminado.' };
        break;
      case 'replaceHorarioGrupo':
        _genCheckAdmin_(key);
        var r8 = _genReplaceHorarioGrupo_(body.ciclo, body.version, body.grupo_id, body.filas || []);
        result = r8;
        break;

      // ── RESTRICCIONES ────────────────────────────────────────
      case 'saveRestriccion':
        _genCheckAdmin_(key);
        var r9 = _genSaveRestriccion_(body.record);
        result = { status: 'ok', message: 'Restricción guardada.', result: r9 };
        break;
      case 'deleteRestriccion':
        _genCheckAdmin_(key);
        _genDeleteRestriccion_(body.id);
        result = { status: 'ok', message: 'Restricción eliminada.' };
        break;

      // ── VERSIONES ────────────────────────────────────────────
      case 'saveVersion':
        _genCheckAdmin_(key);
        var r10 = _genSaveVersion_(body.record);
        result = { status: 'ok', message: 'Versión guardada.', result: r10 };
        break;

      default:
        result = { status: 'error', message: 'Acción POST no reconocida: ' + action };
    }

    return _genJson_(result);
  } catch (err) {
    return _genJson_({ status: 'error', message: err.message });
  }
}
