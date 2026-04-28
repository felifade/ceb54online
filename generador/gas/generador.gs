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
    headers: ['id', 'clave', 'grado', 'grupo', 'turno', 'capacidad', 'ciclo', 'capacitacion', 'activo']
  },
  MATERIAS: {
    name: 'GEN_MATERIAS',
    headers: ['id', 'clave', 'nombre', 'componente', 'hrs_semana', 'semestre', 'activo']
  },
  AULAS: {
    name: 'GEN_AULAS',
    headers: ['id', 'clave', 'nombre', 'tipo', 'capacidad', 'ubicacion', 'activo', 'disponible', 'observaciones']
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
  },
  HORARIOS_INICIALES: {
    name: 'GEN_HORARIOS_INICIALES',
    headers: ['id', 'ciclo', 'periodo', 'docente', 'docente_id', 'grupo', 'grupo_id',
              'turno', 'semestre', 'uac', 'materia_id', 'componente',
              'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'horas',
              'tipo', 'activo']
  },
  ESTRUCTURA: {
    name: 'GEN_ESTRUCTURA',
    headers: ['id', 'ciclo', 'periodo', 'plantel', 'grupo', 'turno', 'semestre',
              'campo_disciplinar', 'uac', 'num_componente', 'curriculum_ampliado',
              'componente', 'tot_horas', 'propiedad_uac', 'laboral',
              'docente', 'tipo_asignacion_docente', 'docente_tiempo_fijo', 'estatus_cobertura',
              'formacion_docente',
              'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'horas',
              'grupo_id', 'materia_id', 'docente_id']
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
/**
 * Ajusta las referencias de fila en una fórmula A1.
 * Solo modifica referencias relativas (sin $). Ejemplo:
 *   _adjustRowRef_('=VLOOKUP(M2,Hoja!A:C,3,0)', 2, 5) → '=VLOOKUP(M5,Hoja!A:C,3,0)'
 */
function _adjustRowRef_(formula, fromRow, toRow) {
  if (!formula || fromRow === toRow) return formula;
  // Captura referencias tipo A2 (relativas) — omite $A$2 (absolutas)
  return formula.replace(/(\$?[A-Z]+)(\$?)(\d+)/g, function(m, col, dollar, row) {
    if (dollar === '$') return m;               // fila absoluta → no tocar
    return parseInt(row) === fromRow ? col + toRow : m;
  });
}

function _genUpsert_(sheetKey, record) {
  var def   = GEN_SHEETS_[sheetKey];
  var sheet = _genGetSheet_(sheetKey);

  // Si no tiene id, es inserción
  if (!record.id) {
    record.id = _genNewId_();
    var row = def.headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });
    sheet.appendRow(row);
    var newRowNum = sheet.getLastRow();
    // Copiar fórmulas de la primera fila de datos (si existe) para las celdas sin valor
    if (newRowNum > 2) {
      var tmplFormulas = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getFormulas()[0];
      tmplFormulas.forEach(function(f, fi) {
        if (!f) return;
        var colHeader = (def.headers[fi] || '');
        if (record[colHeader] !== undefined && record[colHeader] !== '') return; // ya tiene valor
        var adjusted = _adjustRowRef_(f, 2, newRowNum);
        sheet.getRange(newRowNum, fi + 1).setFormula(adjusted);
      });
    }
    return { action: 'inserted', id: record.id };
  }

  // Buscar fila existente
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var idIdx = headers.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(record.id)) {
      // Leer fórmulas ANTES de sobrescribir
      var existingFormulas = sheet.getRange(i + 1, 1, 1, headers.length).getFormulas()[0];
      var newRow = headers.map(function(h) { return record[h] !== undefined ? record[h] : data[i][headers.indexOf(h)]; });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      // Restaurar fórmulas solo cuando el record NO provee un valor para esa columna
      existingFormulas.forEach(function(f, fi) {
        if (f && record[headers[fi]] === undefined) sheet.getRange(i + 1, fi + 1).setFormula(f);
      });
      return { action: 'updated', id: record.id };
    }
  }

  // No encontrado → insertar
  var row2 = def.headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });
  sheet.appendRow(row2);
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
// OCUPACIÓN DE ESPACIOS
// ══════════════════════════════════════════════════════════════════

function _genGetOcupacionEspacios_(ciclo, version) {
  var aulas    = _genGetAulas_();
  var horarios = _genGetHorarios_(ciclo, version);

  // Índice: aula_id → array de bloques asignados
  var bloquesPorAula = {};
  horarios.forEach(function(h) {
    if (!h.aula_id) return;
    var k = String(h.aula_id);
    if (!bloquesPorAula[k]) bloquesPorAula[k] = [];
    bloquesPorAula[k].push({
      dia:        h.dia,
      bloque:     h.bloque,
      grupo_id:   h.grupo_id,
      materia_id: h.materia_id,
      docente_id: h.docente_id
    });
  });

  // Detectar conflictos de aula (mismo espacio, mismo bloque)
  var conflictosPorAula = {};
  var aulaSlot = {};
  horarios.forEach(function(h) {
    if (!h.aula_id) return;
    var key = String(h.aula_id) + '|' + h.dia + '|' + String(h.bloque);
    if (aulaSlot[key]) {
      var k = String(h.aula_id);
      if (!conflictosPorAula[k]) conflictosPorAula[k] = 0;
      conflictosPorAula[k]++;
    }
    aulaSlot[key] = true;
  });

  return aulas.map(function(a) {
    var id     = String(a.id);
    var bloqs  = bloquesPorAula[id] || [];
    return {
      id:              a.id,
      clave:           a.clave,
      nombre:          a.nombre,
      tipo:            a.tipo,
      capacidad:       a.capacidad,
      ubicacion:       a.ubicacion || '',
      disponible:      a.disponible,
      activo:          a.activo,
      observaciones:   a.observaciones || '',
      bloques_ocupados: bloqs.length,
      conflictos:      conflictosPorAula[id] || 0,
      detalle:         bloqs
    };
  });
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
    totalDocentes:    docentes.filter(function(d){ return String(d.activo) !== 'false'; }).length,
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
// HORARIOS INICIALES
// ══════════════════════════════════════════════════════════════════

function _genGetHorariosIniciales_(ciclo, periodo) {
  return _genGetAll_('HORARIOS_INICIALES', function(r) {
    if (ciclo && String(r.ciclo) !== String(ciclo)) return false;
    if (periodo && String(r.periodo || '') !== String(periodo)) return false;
    return true;
  });
}

function _genSaveHoraInicial_(fila) { return _genUpsert_('HORARIOS_INICIALES', fila); }

function _genDeleteHoraInicial_(id) { return _genDelete_('HORARIOS_INICIALES', id); }

/** Reemplaza todas las filas de un docente en un ciclo+periodo. */
function _genReplaceHorariosInicialesDocente_(ciclo, periodo, docente_id, filas) {
  var sheet      = _genGetSheet_('HORARIOS_INICIALES');
  var data       = sheet.getDataRange().getValues();
  var headers    = data[0].map(String);
  var cicloIdx   = headers.indexOf('ciclo');
  var perIdx     = headers.indexOf('periodo');
  var docIdx     = headers.indexOf('docente_id');
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][cicloIdx]) !== String(ciclo)) continue;
    if (periodo && String(data[i][perIdx] || '') !== String(periodo)) continue;
    if (docente_id && String(data[i][docIdx]) !== String(docente_id)) continue;
    sheet.deleteRow(i + 1);
  }
  filas.forEach(function(f) {
    f.ciclo      = ciclo;
    f.periodo    = periodo || '';
    f.docente_id = docente_id;
    f.activo     = 'true';
    if (!f.id) f.id = _genNewId_();
    var row = GEN_SHEETS_.HORARIOS_INICIALES.headers.map(function(h) {
      return f[h] !== undefined ? f[h] : '';
    });
    sheet.appendRow(row);
  });
  return { status: 'ok', message: filas.length + ' filas guardadas.' };
}

/**
 * Promueve las filas de HORARIOS_INICIALES a GEN_ESTRUCTURA.
 * Solo copia las filas que aún no están en ESTRUCTURA (por uac+grupo+ciclo).
 * Retorna cuántas se insertaron y cuántas ya existían.
 */
function _genHorariosInicialesAEstructura_(ciclo, periodo) {
  var iniciales  = _genGetHorariosIniciales_(ciclo, periodo);
  var estructura = _genGetEstructura_(ciclo, periodo);

  // Índice rápido: "ciclo|grupo|uac" para deduplicar
  var estIdx = {};
  estructura.forEach(function(r) {
    var k = String(r.ciclo) + '|' + String(r.grupo||'').trim() + '|' + String(r.uac||'').trim();
    estIdx[k] = true;
  });

  var sheet    = _genGetSheet_('ESTRUCTURA');
  var inserted = 0, omitidos = 0;

  iniciales.forEach(function(f) {
    var k = String(ciclo) + '|' + String(f.grupo||'').trim() + '|' + String(f.uac||'').trim();
    if (estIdx[k]) { omitidos++; return; }

    var fila = {
      id:              _genNewId_(),
      ciclo:           ciclo,
      periodo:         periodo || '',
      plantel:         '',
      grupo:           f.grupo         || '',
      grupo_id:        f.grupo_id      || '',
      turno:           f.turno         || '',
      semestre:        f.semestre      || '',
      campo_disciplinar: '',
      uac:             f.uac           || '',
      materia_id:      f.materia_id    || '',
      num_componente:  '',
      curriculum_ampliado: '',
      componente:      f.componente    || '',
      tot_horas:       f.horas         || '',
      propiedad_uac:   '',
      laboral:         '',
      docente:         f.docente       || '',
      docente_id:      f.docente_id    || '',
      formacion_docente: '',
      lunes:           f.lunes         || '',
      martes:          f.martes        || '',
      miercoles:       f.miercoles     || '',
      jueves:          f.jueves        || '',
      viernes:         f.viernes       || '',
      horas:           f.horas         || ''
    };

    var row = GEN_SHEETS_.ESTRUCTURA.headers.map(function(h) {
      return fila[h] !== undefined ? fila[h] : '';
    });
    sheet.appendRow(row);
    estIdx[k] = true;
    inserted++;
  });

  return {
    status:   'ok',
    message:  inserted + ' filas promovidas a Estructura Educativa. ' + omitidos + ' ya existían.',
    insertadas: inserted,
    omitidas:   omitidos
  };
}

// ══════════════════════════════════════════════════════════════════
// ESTRUCTURA EDUCATIVA
// ══════════════════════════════════════════════════════════════════

function _genGetEstructura_(ciclo, periodo) {
  return _genGetAll_('ESTRUCTURA', function(r) {
    if (ciclo && String(r.ciclo) !== String(ciclo)) return false;
    if (periodo && String(r.periodo || '') !== String(periodo)) return false;
    return true;
  });
}

function _genSaveEstructuraFila_(fila) { return _genUpsert_('ESTRUCTURA', fila); }

function _genDeleteEstructuraFila_(id) { return _genDelete_('ESTRUCTURA', id); }

/**
 * Reemplaza la estructura de un ciclo (y periodo si se indica).
 * Si periodo está vacío, elimina todas las filas del ciclo.
 * Si periodo es 'A' o 'B', elimina solo las filas de ese periodo.
 */
function _genReplaceEstructura_(ciclo, filas, periodo) {
  var sheet      = _genGetSheet_('ESTRUCTURA');
  var data       = sheet.getDataRange().getValues();
  var headers    = data[0].map(String);
  var cicloIdx   = headers.indexOf('ciclo');
  var periodoIdx = headers.indexOf('periodo');
  var nCols      = headers.length;

  // ── Capturar plantilla de fórmulas ANTES de borrar ────────────────
  // Buscar la primera fila del ciclo+periodo que tenga alguna fórmula
  var formulaTemplates = []; // [{colIdx, formula, srcRow}]
  for (var t = 1; t < data.length; t++) {
    var tc = String(data[t][cicloIdx]);
    var tp = periodoIdx >= 0 ? String(data[t][periodoIdx] || '') : '';
    if (tc !== String(ciclo)) continue;
    if (periodo && tp && tp !== String(periodo)) continue;
    var rowFormulas = sheet.getRange(t + 1, 1, 1, nCols).getFormulas()[0];
    var hasFml = rowFormulas.some(function(f) { return !!f; });
    if (hasFml) {
      rowFormulas.forEach(function(f, fi) {
        if (f) formulaTemplates.push({ colIdx: fi, formula: f, srcRow: t + 1 });
      });
      break; // con una fila plantilla es suficiente
    }
  }

  // ── Eliminar filas del ciclo+periodo ──────────────────────────────
  for (var i = data.length - 1; i >= 1; i--) {
    var rowCiclo   = String(data[i][cicloIdx]);
    var rowPeriodo = periodoIdx >= 0 ? String(data[i][periodoIdx] || '') : '';
    if (rowCiclo !== String(ciclo)) continue;
    if (periodo && rowPeriodo && rowPeriodo !== String(periodo)) continue;
    sheet.deleteRow(i + 1);
  }

  // ── Insertar filas nuevas y registrar número de fila real ─────────
  var insertedRowNums = [];
  filas.forEach(function(f) {
    f.ciclo = ciclo;
    if (periodo) f.periodo = periodo;
    if (!f.id) f.id = _genNewId_();
    var row = GEN_SHEETS_.ESTRUCTURA.headers.map(function(h) { return f[h] !== undefined ? f[h] : ''; });
    sheet.appendRow(row);
    insertedRowNums.push(sheet.getLastRow());
  });

  // ── Re-aplicar fórmulas a cada fila insertada ─────────────────────
  if (formulaTemplates.length > 0) {
    insertedRowNums.forEach(function(rowNum) {
      formulaTemplates.forEach(function(tmpl) {
        var adjusted = _adjustRowRef_(tmpl.formula, tmpl.srcRow, rowNum);
        sheet.getRange(rowNum, tmpl.colIdx + 1).setFormula(adjusted);
      });
    });
  }

  return { status: 'ok', message: 'Estructura guardada (' + filas.length + ' filas).' };
}

/** Estado actual de la estructura para un ciclo+periodo (guardado en GEN_CONFIG). */
function _genGetEstadoEstructura_(ciclo, periodo) {
  var cfg  = _genGetConfig_();
  var base = (ciclo || '') + (periodo ? '_' + periodo : '');
  return {
    estado: cfg['est_estado_' + base] || 'EN_CAPTURA',
    fecha:  cfg['est_fecha_'  + base] || ''
  };
}

var ACAD_API_URL_ = 'https://script.google.com/macros/s/AKfycbyeex2Txz_EdUyj9qvsi_DPet3KweejaP4KBOUEdj8GQg_HIK3aCkxsMWxzxhTuknh6/exec';

function _genSaveEstadoEstructura_(ciclo, estado, periodo) {
  var cfg  = {};
  var base = (ciclo || '') + (periodo ? '_' + periodo : '');
  cfg['est_estado_' + base] = estado;
  cfg['est_fecha_'  + base] = new Date().toISOString().slice(0, 10);
  _genSaveConfig_(cfg);

  // Al validar → sincronizar automáticamente con el módulo Académico
  if (estado === 'VALIDADA') {
    try {
      var params = '?action=importarDesdeGenerador&ciclo=' + encodeURIComponent(ciclo || '');
      if (periodo) params += '&periodo=' + encodeURIComponent(periodo);
      UrlFetchApp.fetch(ACAD_API_URL_ + params, { muteHttpExceptions: true, followRedirects: true });
    } catch (e) {
      Logger.log('Sync académico falló: ' + e.toString());
    }
  }

  return { status: 'ok', estado: estado };
}


/** Parsea horas de un campo de día: acepta número o rango "HH:MM-HH:MM". */
function _genParseHorasDia_(val) {
  if (!val) return 0;
  var s = String(val).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (m) {
    var ini = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var fin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
    return fin > ini ? Math.round((fin - ini) / 60) : 0;
  }
  return Number(s) || 0;
}

/** Validaciones server-side de la estructura educativa para un ciclo (y periodo si se indica). */
function _genValidarEstructura_(ciclo, periodo) {
  var data    = _genGetEstructura_(ciclo, periodo);
  var errores = [];
  var advert  = [];

  // Validación de periodo vs semestre
  if (periodo) {
    var GEN_PERIODO_SEMS = { A: ['1','3','5'], B: ['2','4','6'] };
    var semsPeriodo    = GEN_PERIODO_SEMS[periodo] || [];
    var semsIncorrectos = periodo === 'A' ? ['2','4','6'] : ['1','3','5'];
    data.forEach(function(row, i) {
      var rowSem = String(row.semestre || '').trim();
      if (rowSem && semsIncorrectos.indexOf(rowSem) !== -1) {
        errores.push({ tipo: 'SEMESTRE_PERIODO_INCORRECTO', fila: i + 1, grupo: row.grupo,
          mensaje: 'Fila '+(i+1)+' ('+( row.grupo||'sin grupo')+'): semestre '+rowSem+
            '° no corresponde al Periodo '+periodo+
            '. Se esperan semestres '+semsPeriodo.join(', ')+'°.' });
      }
    });
  }

  data.forEach(function(row, i) {
    if (!row.uac || !String(row.uac).trim()) return;
    // UAC sin docente
    if (!row.docente || !String(row.docente).trim()) {
      errores.push({ tipo: 'SIN_DOCENTE', fila: i + 1, grupo: row.grupo,
        mensaje: 'Fila '+(i+1)+': "'+row.uac+'" sin docente asignado.' });
    }
    // Suma de días ≠ TOT_HORAS
    var dias = ['lunes','martes','miercoles','jueves','viernes'];
    var sumaDias = dias.reduce(function(s,d) { return s + _genParseHorasDia_(row[d]); }, 0);
    var tot = Number(row.tot_horas) || 0;
    if (tot > 0 && sumaDias > 0 && sumaDias !== tot) {
      advert.push({ tipo: 'HORAS_INCONSISTENTES', fila: i + 1, grupo: row.grupo,
        mensaje: 'Fila '+(i+1)+' ('+row.uac+'): días='+sumaDias+' ≠ TOT='+tot+'.' });
    }
  });

  // Docente >6h en un día
  var docenteDia = {};
  data.forEach(function(row) {
    if (!row.docente) return;
    ['lunes','martes','miercoles','jueves','viernes'].forEach(function(dia) {
      var h = _genParseHorasDia_(row[dia]);
      if (!h) return;
      var k = String(row.docente).trim() + '|' + dia;
      docenteDia[k] = (docenteDia[k] || 0) + h;
    });
  });
  Object.keys(docenteDia).forEach(function(k) {
    if (docenteDia[k] > 6) {
      var p = k.split('|');
      errores.push({ tipo: 'DOCENTE_EXCEDE_DIA',
        mensaje: '"'+p[0]+'" tiene '+docenteDia[k]+' hrs el '+p[1]+' (máx 6).',
        docente: p[0], dia: p[1] });
    }
  });

  // Grupo con pocas horas
  var grupoHoras = {};
  data.forEach(function(row) {
    if (!row.grupo) return;
    grupoHoras[row.grupo] = (grupoHoras[row.grupo] || 0) + (Number(row.tot_horas) || 0);
  });
  Object.keys(grupoHoras).forEach(function(g) {
    if (grupoHoras[g] > 0 && grupoHoras[g] < 25) {
      advert.push({ tipo: 'GRUPO_INCOMPLETO',
        mensaje: 'Grupo "'+g+'" tiene solo '+grupoHoras[g]+' hrs (esperado ≥25).', grupo: g });
    }
  });

  // Docente con carga total excesiva
  var docenteTotal = {};
  data.forEach(function(row) {
    if (!row.docente) return;
    docenteTotal[row.docente] = (docenteTotal[row.docente]||0) + (Number(row.tot_horas)||0);
  });
  Object.keys(docenteTotal).forEach(function(d) {
    if (docenteTotal[d] > 35) {
      advert.push({ tipo: 'DOCENTE_SOBRECARGA',
        mensaje: '"'+d+'" tiene '+docenteTotal[d]+' hrs semanales en total.', docente: d });
    }
  });

  return {
    errores: errores, advertencias: advert,
    total_errores: errores.length, total_advertencias: advert.length,
    valida: errores.length === 0
  };
}

/**
 * Convierte las filas de estructura en entradas de CARGA_HORARIA.
 * Empareja UAC y DOCENTE con los catálogos existentes por nombre/clave.
 */
function _genEstructuraACarga_(ciclo, periodo) {
  var data     = _genGetEstructura_(ciclo, periodo);
  var grupos   = _genGetGrupos_();
  var materias = _genGetMaterias_();
  var docentes = _genGetDocentes_();

  function norm(s) { return String(s||'').trim().toLowerCase(); }

  var creados = 0, omitidos = 0, sinMatch = [];

  data.forEach(function(row) {
    if (!row.uac) { omitidos++; return; }

    var g = grupos.filter(function(x) {
      return norm(x.grado)+'°'+norm(x.grupo) === norm(row.grupo) ||
             norm(x.clave) === norm(row.grupo);
    })[0] || null;

    var m = materias.filter(function(x) {
      return norm(x.nombre) === norm(row.uac) || norm(x.clave) === norm(row.uac);
    })[0] || null;

    var d = row.docente ? docentes.filter(function(x) {
      var nombre = [x.nombre, x.apellido_paterno, x.apellido_materno].filter(Boolean).join(' ');
      return norm(nombre) === norm(row.docente);
    })[0] || null : null;

    if (!g || !m) {
      omitidos++;
      if (!g) sinMatch.push('Grupo: "' + row.grupo + '"');
      if (!m) sinMatch.push('UAC: "' + row.uac + '"');
      return;
    }

    _genUpsert_('CARGA', {
      ciclo:         ciclo,
      grupo_id:      g.id,
      materia_id:    m.id,
      docente_id:    d ? d.id : '',
      hrs_asignadas: row.tot_horas || row.horas || ''
    });
    creados++;
  });

  return {
    status: 'ok',
    message: creados + ' asignaciones generadas, ' + omitidos + ' omitidas.',
    creados: creados, omitidos: omitidos,
    sin_match: sinMatch.slice(0, 30)
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
      case 'getOcupacionEspacios':
        result = { status: 'ok', data: _genGetOcupacionEspacios_(p.ciclo, p.version) };
        break;
      case 'getHorariosIniciales':
        result = { status: 'ok', data: _genGetHorariosIniciales_(p.ciclo, p.periodo || '') };
        break;
      case 'getEstructura':
        result = { status: 'ok', data: _genGetEstructura_(p.ciclo, p.periodo || '') };
        break;
      case 'getEstadoEstructura':
        result = { status: 'ok', data: _genGetEstadoEstructura_(p.ciclo, p.periodo || '') };
        break;
      case 'validarEstructura':
        result = { status: 'ok', data: _genValidarEstructura_(p.ciclo, p.periodo || '') };
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

      // ── HORARIOS INICIALES ────────────────────────────────────
      case 'saveHoraInicial':
        _genCheckAdmin_(key);
        result = { status: 'ok', message: 'Fila guardada.', result: _genSaveHoraInicial_(body.record) };
        break;
      case 'deleteHoraInicial':
        _genCheckAdmin_(key);
        _genDeleteHoraInicial_(body.id);
        result = { status: 'ok', message: 'Fila eliminada.' };
        break;
      case 'replaceHorariosInicialesDocente':
        _genCheckAdmin_(key);
        result = _genReplaceHorariosInicialesDocente_(body.ciclo, body.periodo || '', body.docente_id, body.filas || []);
        break;
      case 'horariosInicialesAEstructura':
        _genCheckAdmin_(key);
        result = _genHorariosInicialesAEstructura_(body.ciclo, body.periodo || '');
        break;

      // ── ESTRUCTURA EDUCATIVA ──────────────────────────────────
      case 'saveEstructuraFila':
        _genCheckAdmin_(key);
        var re1 = _genSaveEstructuraFila_(body.record);
        result = { status: 'ok', message: 'Fila guardada.', result: re1 };
        break;
      case 'deleteEstructuraFila':
        _genCheckAdmin_(key);
        _genDeleteEstructuraFila_(body.id);
        result = { status: 'ok', message: 'Fila eliminada.' };
        break;
      case 'replaceEstructura':
        _genCheckAdmin_(key);
        result = _genReplaceEstructura_(body.ciclo, body.filas || [], body.periodo || '');
        break;
      case 'saveEstadoEstructura':
        _genCheckAdmin_(key);
        result = _genSaveEstadoEstructura_(body.ciclo, body.estado, body.periodo || '');
        break;
      case 'estructuraACarga':
        _genCheckAdmin_(key);
        result = _genEstructuraACarga_(body.ciclo, body.periodo || '');
        break;

      default:
        result = { status: 'error', message: 'Acción POST no reconocida: ' + action };
    }

    return _genJson_(result);
  } catch (err) {
    return _genJson_({ status: 'error', message: err.message });
  }
}
