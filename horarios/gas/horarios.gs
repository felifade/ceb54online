// ============================================================
// MÓDULO HORARIOS CEB 5/4 — Google Apps Script
// ============================================================
// Instrucciones de despliegue:
//   1. Crear un NUEVO proyecto de Apps Script (independiente del de PEC/Tutorías)
//   2. Pegar TODO este código como archivo Code.gs
//   3. ⚠️  IMPORTANTE: Pega el ID de tu Google Sheets en SPREADSHEET_ID_ (ver abajo)
//      El ID está en la URL de tu Sheets:
//      https://docs.google.com/spreadsheets/d/  →ESTE_ES_EL_ID←  /edit
//   4. Publicar → Aplicación web
//        Ejecutar como: yo mismo
//        Quién tiene acceso: cualquiera
//   5. Copiar la URL generada y pegarla en horarios/js/api_horarios.js
// ============================================================

const HORARIOS_ADMIN_KEY_ = 'CEB54_HORARIOS_ADMIN'; // Cambiar si se desea
const HOJA_RAW_           = 'HORARIOS_RAW';
const HOJA_DOCENTES_      = 'DOCENTES_RAW';
const HOJA_WEB_           = 'HORARIOS_WEB';
const HOJA_EXTRAESC_      = 'EXTRAESCOLARES_RAW'; // Nueva hoja para fortalecimiento

// ── CONFIGURACIÓN DEL SPREADSHEET ────────────────────────────
const SPREADSHEET_ID_ = '1KR8f7ObGmO8F2dVgJepKpKYBeMEktBme2jTTbImS8nM';

// Helper: obtiene el spreadsheet ya sea vinculado o por ID
function _getSpreadsheet_() {
  // Si el script está vinculado a un Sheets, getActiveSpreadsheet() funciona.
  // Si es standalone (proyecto independiente), se usa openById().
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {}
  if (ss) return ss;
  if (!SPREADSHEET_ID_)
    throw new Error('Configura SPREADSHEET_ID_ en el código del GAS.');
  return SpreadsheetApp.openById(SPREADSHEET_ID_);
}

// ── PUNTO DE ENTRADA GET ─────────────────────────────────────
function doGet(e) {
  var p      = (e && e.parameter) ? e.parameter : {};
  var action = p.action || 'getHorariosWeb';

  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);

  var result;
  try {
    switch (action) {
      case 'getHorariosWeb':
        result = { status: 'ok', data: _getHorariosWebData_() };
        break;
      case 'regenerar':
        if ((p.adminKey || '') !== HORARIOS_ADMIN_KEY_)
          result = { status: 'error', message: 'Clave de administrador incorrecta.' };
        else
          result = _regenerar_();
        break;
      case 'getDocentes':
        result = { status: 'ok', data: _getDocentes_() };
        break;
      case 'getCatalogoUAC':
        result = { status: 'ok', data: _getCatalogoUAC_() };
        break;
      case 'getDocenteData':
        result = { status: 'ok', data: _getDocenteData_(p.clave, p.ciclo) };
        break;
      default:
        result = { status: 'error', message: 'Acción no reconocida: ' + action };
    }
  } catch (err) {
    result = { status: 'error', message: err.message };
  }

  out.setContent(JSON.stringify(result));
  return out;
}

// ── PUNTO DE ENTRADA POST (Captura) ──────────────────────────
function doPost(e) {
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);

  var result;
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action || '';

    // Todas las acciones de escritura requieren adminKey
    if ((body.adminKey || '') !== HORARIOS_ADMIN_KEY_) {
      result = { status: 'error', message: 'Clave de administrador incorrecta.' };
      out.setContent(JSON.stringify(result));
      return out;
    }

    switch (action) {
      case 'saveDocente':
        result = _saveDocente_(body.docente);
        break;
      case 'saveCargaHoraria':
        result = _saveCargaHoraria_(body.filas);
        break;
      case 'saveExtraescolares':
        result = _saveExtraescolares_(body.filas);
        break;
      case 'replaceCargaHoraria':
        result = _replaceCargaHoraria_(body.clave, body.ciclo, body.filas);
        break;
      case 'replaceExtraescolares':
        result = _replaceExtraescolares_(body.clave, body.ciclo, body.filas);
        break;
      default:
        result = { status: 'error', message: 'Acción POST no reconocida: ' + action };
    }
  } catch (err) {
    result = { status: 'error', message: err.message };
  }

  out.setContent(JSON.stringify(result));
  return out;
}

// ── LISTAR DOCENTES ──────────────────────────────────────────
function _getDocentes_() {
  var ss    = _getSpreadsheet_();
  var sheet = ss.getSheetByName(HOJA_DOCENTES_);
  if (!sheet) return [];

  var vals = sheet.getDataRange().getValues();
  if (vals.length < 2) return [];

  var hdrs = vals[0].map(function(h) { return String(h).trim().toUpperCase(); });
  var iClave = hdrs.indexOf('CLAVE_ECONOMICA_CURP');
  var iNom   = hdrs.indexOf('DOCENTE');
  var iForm  = hdrs.indexOf('FORMACION ACADEMICA');
  if (iClave < 0 || iNom < 0) return [];

  var list = [];
  for (var i = 1; i < vals.length; i++) {
    var clave = String(vals[i][iClave] || '').trim();
    if (!clave) continue;
    list.push({
      clave:     clave,
      nombre:    String(vals[i][iNom]  || '').trim(),
      formacion: iForm >= 0 ? String(vals[i][iForm] || '').trim() : ''
    });
  }
  return list;
}

// ── LEER CATÁLOGO UAC ─────────────────────────────────────────
// Hoja: CATALOGO_UAC  Columnas esperadas: UAC (o MATERIA), COMPONENTE
// Retorna [] si la hoja no existe (no es un error crítico).
function _getCatalogoUAC_() {
  var ss    = _getSpreadsheet_();
  var sheet = ss.getSheetByName('CATALOGO_UAC');
  if (!sheet) return [];

  var vals = sheet.getDataRange().getValues();
  if (vals.length < 2) return [];

  var hdrs  = vals[0].map(function(h) { return String(h).trim().toUpperCase(); });
  var iUAC  = hdrs.indexOf('UAC');
  if (iUAC  < 0) iUAC  = hdrs.indexOf('MATERIA');  // columna alternativa
  var iComp = hdrs.indexOf('COMPONENTE');
  if (iUAC  < 0) return [];                          // sin columna UAC/MATERIA

  var list = [];
  var seen = {};
  for (var i = 1; i < vals.length; i++) {
    var uac = String(vals[i][iUAC] || '').trim();
    if (!uac || seen[uac]) continue;
    seen[uac] = true;
    list.push({
      uac:        uac,
      componente: iComp >= 0 ? String(vals[i][iComp] || '').trim() : ''
    });
  }
  // Orden alfabético para que el selector web sea fácil de navegar
  list.sort(function(a, b) { return a.uac.localeCompare(b.uac); });
  return list;
}

// ── GUARDAR / ACTUALIZAR DOCENTE ──────────────────────────────
function _saveDocente_(d) {
  if (!d || !d.nombre || !d.clave)
    return { status: 'error', message: 'Nombre y clave son obligatorios.' };

  var ss    = _getSpreadsheet_();
  var sheet = _ensureSheet_(ss, HOJA_DOCENTES_, ['CLAVE_ECONOMICA_CURP','DOCENTE','FORMACION ACADEMICA']);

  var vals  = sheet.getDataRange().getValues();
  var hdrs  = vals[0].map(function(h) { return String(h).trim().toUpperCase(); });
  var iClave = hdrs.indexOf('CLAVE_ECONOMICA_CURP');
  var iNom   = hdrs.indexOf('DOCENTE');
  var iForm  = hdrs.indexOf('FORMACION ACADEMICA');

  // Buscar si ya existe
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][iClave] || '').trim() === d.clave.trim()) {
      // Actualizar fila existente
      sheet.getRange(i+1, iClave+1).setValue(d.clave.trim());
      sheet.getRange(i+1, iNom+1).setValue(d.nombre.trim());
      if (iForm >= 0) sheet.getRange(i+1, iForm+1).setValue(d.formacion || '');
      return { status: 'ok', message: 'Docente actualizado: ' + d.nombre, accion: 'actualizado' };
    }
  }

  // Nuevo docente — agregar al final
  var newRow = new Array(hdrs.length).fill('');
  newRow[iClave] = d.clave.trim();
  newRow[iNom]   = d.nombre.trim();
  if (iForm >= 0) newRow[iForm] = d.formacion || '';
  sheet.appendRow(newRow);
  return { status: 'ok', message: 'Docente guardado: ' + d.nombre, accion: 'nuevo' };
}

// ── GUARDAR CARGA HORARIA ─────────────────────────────────────
function _saveCargaHoraria_(filas) {
  if (!filas || !filas.length)
    return { status: 'error', message: 'No se recibieron filas de carga.' };

  var ss    = _getSpreadsheet_();
  var sheet = _ensureSheet_(ss, HOJA_RAW_, [
    'CLAVE_ECONOMICA_CURP','CICLO ESCOLAR','GRUPO','TURNO','UAC','COMPONENTE',
    'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','TOT','ACTIVO'
  ]);

  var vals  = sheet.getDataRange().getValues();
  var hdrs  = vals[0].map(function(h) { return String(h).trim().toUpperCase(); });

  function col_(n) { return hdrs.indexOf(n); }
  var iClave = col_('CLAVE_ECONOMICA_CURP');
  var iCiclo = col_('CICLO ESCOLAR');
  var iGrupo = col_('GRUPO');
  var iTurno = col_('TURNO');
  var iUAC   = col_('UAC');
  var iComp  = col_('COMPONENTE');
  var iLun   = col_('LUNES');
  var iMar   = col_('MARTES');
  var iMie   = col_('MIERCOLES');
  var iJue   = col_('JUEVES');
  var iVie   = col_('VIERNES');
  var iTot   = col_('TOT');
  var iActv  = col_('ACTIVO');

  var savedCount = 0;
  var dupCount   = 0;

  filas.forEach(function(f) {
    // Deduplicar: clave+ciclo+grupo+materia
    var isDup = false;
    for (var i = 1; i < vals.length; i++) {
      if (
        String(vals[i][iClave] || '').trim() === f.clave  &&
        String(vals[i][iCiclo] || '').trim() === f.ciclo  &&
        String(vals[i][iGrupo] || '').trim() === f.grupo  &&
        String(vals[i][iUAC]   || '').trim() === f.materia
      ) { isDup = true; break; }
    }
    if (isDup) { dupCount++; return; }

    var newRow = new Array(hdrs.length).fill('');
    newRow[iClave] = f.clave     || '';
    newRow[iCiclo] = f.ciclo     || '';
    newRow[iGrupo] = f.grupo     || '';
    newRow[iTurno] = f.turno     || '';
    newRow[iUAC]   = f.materia   || '';
    newRow[iComp]  = f.componente|| '';
    newRow[iLun]   = f.lunes     || '';
    newRow[iMar]   = f.martes    || '';
    newRow[iMie]   = f.miercoles || '';
    newRow[iJue]   = f.jueves    || '';
    newRow[iVie]   = f.viernes   || '';
    newRow[iTot]   = f.total     || '';
    if (iActv >= 0) newRow[iActv] = 'TRUE';

    // Forzar texto en columnas de hora
    var nextRow = sheet.getLastRow() + 1;
    sheet.appendRow(newRow);
    var diasIdx = [iLun, iMar, iMie, iJue, iVie].filter(function(i) { return i >= 0; });
    diasIdx.forEach(function(ci) {
      sheet.getRange(nextRow, ci+1).setNumberFormat('@');
    });

    savedCount++;
  });

  return {
    status: 'ok',
    message: savedCount + ' fila(s) guardadas en HORARIOS_RAW.' +
             (dupCount ? ' ' + dupCount + ' duplicado(s) omitido(s).' : ''),
    guardadas:   savedCount,
    duplicados:  dupCount
  };
}

// ── GUARDAR EXTRAESCOLARES ────────────────────────────────────
function _saveExtraescolares_(filas) {
  if (!filas || !filas.length)
    return { status: 'error', message: 'No se recibieron filas de extraescolares.' };

  var ss    = _getSpreadsheet_();
  var sheet = _ensureSheet_(ss, HOJA_EXTRAESC_, [
    'CICLO ESCOLAR','CLAVE_ECONOMICA_CURP','DOCENTE','ACTIVIDAD_EXTRAESCOLAR',
    'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','TOTAL_HORAS_EXT','ACTIVO'
  ]);

  var vals  = sheet.getDataRange().getValues();
  var hdrs  = vals[0].map(function(h) { return String(h).trim().toUpperCase(); });

  function col_(n) { return hdrs.indexOf(n); }
  var iCiclo = col_('CICLO ESCOLAR');
  var iClave = col_('CLAVE_ECONOMICA_CURP');
  var iDoc   = col_('DOCENTE');
  var iAct   = col_('ACTIVIDAD_EXTRAESCOLAR');
  var iLun   = col_('LUNES');
  var iMar   = col_('MARTES');
  var iMie   = col_('MIERCOLES');
  var iJue   = col_('JUEVES');
  var iVie   = col_('VIERNES');
  var iTot   = col_('TOTAL_HORAS_EXT');
  var iActv  = col_('ACTIVO');

  var savedCount = 0;
  var dupCount   = 0;

  filas.forEach(function(f) {
    // Deduplicar por clave+ciclo+actividad
    var isDup = false;
    for (var i = 1; i < vals.length; i++) {
      if (
        String(vals[i][iClave] || '').trim() === f.clave     &&
        String(vals[i][iCiclo] || '').trim() === f.ciclo     &&
        String(vals[i][iAct]   || '').trim() === f.actividad
      ) { isDup = true; break; }
    }
    if (isDup) { dupCount++; return; }

    var newRow = new Array(hdrs.length).fill('');
    newRow[iCiclo] = f.ciclo     || '';
    newRow[iClave] = f.clave     || '';
    newRow[iDoc]   = f.docente   || '';
    newRow[iAct]   = f.actividad || '';
    newRow[iLun]   = f.lunes     || '';
    newRow[iMar]   = f.martes    || '';
    newRow[iMie]   = f.miercoles || '';
    newRow[iJue]   = f.jueves    || '';
    newRow[iVie]   = f.viernes   || '';
    newRow[iTot]   = f.total     || '';
    if (iActv >= 0) newRow[iActv] = 'TRUE';
    sheet.appendRow(newRow);
    savedCount++;
  });

  return {
    status: 'ok',
    message: savedCount + ' actividad(es) guardadas en EXTRAESCOLARES_RAW.' +
             (dupCount ? ' ' + dupCount + ' duplicado(s) omitido(s).' : ''),
    guardadas:  savedCount,
    duplicados: dupCount
  };
}

// ── LEER DATOS DE UN DOCENTE (para edición) ──────────────────
function _getDocenteData_(clave, ciclo) {
  if (!clave) return { carga: [], extra: [] };

  var ss = _getSpreadsheet_();

  // ── Leer HORARIOS_RAW ──────────────────────────────────────
  var carga  = [];
  var rawSh  = ss.getSheetByName(HOJA_RAW_);
  if (rawSh) {
    var rv   = rawSh.getDataRange().getValues();
    var rh   = rv[0].map(function(h) { return String(h).trim().toUpperCase(); });
    var rClave = rh.indexOf('CLAVE_ECONOMICA_CURP');
    var rCiclo = rh.indexOf('CICLO ESCOLAR');
    var rGrupo = rh.indexOf('GRUPO');
    var rTurno = rh.indexOf('TURNO');
    var rUAC   = rh.indexOf('UAC');
    var rComp  = rh.indexOf('COMPONENTE');
    var rLun   = rh.indexOf('LUNES');
    var rMar   = rh.indexOf('MARTES');
    var rMie   = rh.indexOf('MIERCOLES');
    var rJue   = rh.indexOf('JUEVES');
    var rVie   = rh.indexOf('VIERNES');
    var rTot   = rh.indexOf('TOT');

    for (var i = 1; i < rv.length; i++) {
      var row = rv[i];
      var ck  = String(row[rClave] || '').trim();
      var cc  = String(row[rCiclo] || '').trim();
      if (ck !== clave.trim()) continue;
      if (ciclo && cc !== ciclo.trim()) continue;

      carga.push({
        grupo:      rGrupo >= 0 ? String(row[rGrupo] || '').trim() : '',
        turno:      rTurno >= 0 ? String(row[rTurno] || '').trim() : '',
        materia:    rUAC   >= 0 ? String(row[rUAC]   || '').trim() : '',
        componente: rComp  >= 0 ? String(row[rComp]  || '').trim() : '',
        lunes:      rLun   >= 0 ? _horaRaw_(row[rLun])  : '',
        martes:     rMar   >= 0 ? _horaRaw_(row[rMar])  : '',
        miercoles:  rMie   >= 0 ? _horaRaw_(row[rMie])  : '',
        jueves:     rJue   >= 0 ? _horaRaw_(row[rJue])  : '',
        viernes:    rVie   >= 0 ? _horaRaw_(row[rVie])  : '',
        total:      rTot   >= 0 ? String(row[rTot]   || '').trim() : ''
      });
    }
  }

  // ── Leer EXTRAESCOLARES_RAW ────────────────────────────────
  var extra = [];
  var extSh = ss.getSheetByName(HOJA_EXTRAESC_);
  if (extSh) {
    var ev   = extSh.getDataRange().getValues();
    var eh   = ev[0].map(function(h) { return String(h).trim().toUpperCase(); });
    var eClave = eh.indexOf('CLAVE_ECONOMICA_CURP');
    var eCiclo = eh.indexOf('CICLO ESCOLAR');
    var eAct   = eh.indexOf('ACTIVIDAD_EXTRAESCOLAR');
    var eLun   = eh.indexOf('LUNES');
    var eMar   = eh.indexOf('MARTES');
    var eMie   = eh.indexOf('MIERCOLES');
    var eJue   = eh.indexOf('JUEVES');
    var eVie   = eh.indexOf('VIERNES');
    var eTot   = eh.indexOf('TOTAL_HORAS_EXT');

    for (var j = 1; j < ev.length; j++) {
      var erow = ev[j];
      var eck  = String(erow[eClave] || '').trim();
      var ecc  = String(erow[eCiclo] || '').trim();
      if (eck !== clave.trim()) continue;
      if (ciclo && ecc !== ciclo.trim()) continue;

      extra.push({
        actividad:  eAct >= 0 ? String(erow[eAct] || '').trim() : '',
        lunes:      eLun >= 0 ? _horaRaw_(erow[eLun]) : '',
        martes:     eMar >= 0 ? _horaRaw_(erow[eMar]) : '',
        miercoles:  eMie >= 0 ? _horaRaw_(erow[eMie]) : '',
        jueves:     eJue >= 0 ? _horaRaw_(erow[eJue]) : '',
        viernes:    eVie >= 0 ? _horaRaw_(erow[eVie]) : '',
        total:      eTot >= 0 ? String(erow[eTot] || '').trim() : ''
      });
    }
  }

  return { carga: carga, extra: extra };
}

// ── REEMPLAZAR CARGA HORARIA (edición) ────────────────────────
// Elimina SOLO las filas del docente+ciclo y las reinserta.
function _replaceCargaHoraria_(clave, ciclo, filas) {
  if (!clave || !ciclo)
    return { status: 'error', message: 'Clave y ciclo son obligatorios para reemplazar.' };

  var ss    = _getSpreadsheet_();
  var sheet = _ensureSheet_(ss, HOJA_RAW_, [
    'CLAVE_ECONOMICA_CURP','CICLO ESCOLAR','GRUPO','TURNO','UAC','COMPONENTE',
    'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','TOT','ACTIVO'
  ]);

  var vals = sheet.getDataRange().getValues();
  var hdrs = vals[0].map(function(h) { return String(h).trim().toUpperCase(); });
  var iClave = hdrs.indexOf('CLAVE_ECONOMICA_CURP');
  var iCiclo = hdrs.indexOf('CICLO ESCOLAR');

  // Borrar de abajo a arriba para no desplazar índices
  var borradas = 0;
  for (var i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][iClave] || '').trim() === clave.trim() &&
        String(vals[i][iCiclo] || '').trim() === ciclo.trim()) {
      sheet.deleteRow(i + 1); // 1-indexed
      borradas++;
    }
  }

  // Reinsertar las filas del formulario
  var resultado = _saveCargaHoraria_(filas);
  resultado.message = 'Reemplazados: ' + borradas + ' eliminado(s). ' + resultado.message;
  return resultado;
}

// ── REEMPLAZAR EXTRAESCOLARES (edición) ──────────────────────
function _replaceExtraescolares_(clave, ciclo, filas) {
  if (!clave || !ciclo)
    return { status: 'error', message: 'Clave y ciclo son obligatorios para reemplazar.' };

  var ss    = _getSpreadsheet_();
  var sheet = _ensureSheet_(ss, HOJA_EXTRAESC_, [
    'CICLO ESCOLAR','CLAVE_ECONOMICA_CURP','DOCENTE','ACTIVIDAD_EXTRAESCOLAR',
    'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','TOTAL_HORAS_EXT','ACTIVO'
  ]);

  var vals = sheet.getDataRange().getValues();
  var hdrs = vals[0].map(function(h) { return String(h).trim().toUpperCase(); });
  var iClave = hdrs.indexOf('CLAVE_ECONOMICA_CURP');
  var iCiclo = hdrs.indexOf('CICLO ESCOLAR');

  var borradas = 0;
  for (var i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][iClave] || '').trim() === clave.trim() &&
        String(vals[i][iCiclo] || '').trim() === ciclo.trim()) {
      sheet.deleteRow(i + 1);
      borradas++;
    }
  }

  if (!filas || filas.length === 0) {
    return {
      status: 'ok',
      message: borradas + ' extraescolar(es) eliminado(s). No se insertaron nuevos.',
      guardadas: 0, duplicados: 0
    };
  }

  var resultado = _saveExtraescolares_(filas);
  resultado.message = 'Reemplazados: ' + borradas + ' eliminado(s). ' + resultado.message;
  return resultado;
}

// ── HELPER: normalizar celdas de hora desde Sheets ──────────
// Sheets convierte "07:00" a tipo Date con la fecha base 1899-12-30.
function _horaRaw_(v) {
  if (!v) return '';
  if (v instanceof Date) return _dateToTimeStr_(v);
  var s = String(v).trim();
  if (!s) return '';
  // Formato HH:MM directo
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    var p = s.split(':');
    return ('0' + parseInt(p[0],10)).slice(-2) + ':' + p[1];
  }
  return s; // rangos "07:00-09:00" ya como texto
}

// ── HELPER: Crear hoja si no existe ──────────────────────────
function _ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#0f172a');
    sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

// ── LECTURA DE HORARIOS_WEB ───────────────────────────────────
function _getHorariosWebData_() {
  const ss    = _getSpreadsheet_();
  const sheet = ss.getSheetByName(HOJA_WEB_);
  if (!sheet) return [];

  const vals = sheet.getDataRange().getValues();
  if (vals.length < 2) return [];

  const hdrs = vals[0].map(function(h) {
    return String(h).trim().toLowerCase().replace(/ /g, '_');
  });

  var rows = [];
  for (var i = 1; i < vals.length; i++) {
    var r = {};
    hdrs.forEach(function(h, j) {
      var v = vals[i][j];
      // Sheets auto-convierte "07:00" a Date → lo revertimos a string "HH:MM"
      if (v instanceof Date) {
        v = _dateToTimeStr_(v);
      } else if (v === null || v === undefined) {
        v = '';
      }
      r[h] = v;
    });
    rows.push(r);
  }
  return rows;
}

// ── TRANSFORMACIÓN RAW → WEB ──────────────────────────────────
function _regenerar_() {
  var ss = _getSpreadsheet_();

  var rawSheet = ss.getSheetByName(HOJA_RAW_);
  var docSheet = ss.getSheetByName(HOJA_DOCENTES_);

  if (!rawSheet) return { status: 'error', message: 'No existe la hoja "' + HOJA_RAW_ + '". Créala y pega los datos de Access.' };
  if (!docSheet) return { status: 'error', message: 'No existe la hoja "' + HOJA_DOCENTES_ + '". Créala y pega los datos de docentes.' };

  // ── Leer DOCENTES_RAW ──
  var docVals  = docSheet.getDataRange().getValues();
  var docHdrs  = docVals[0].map(function(h) { return String(h).trim().toUpperCase(); });
  var iDocClave = docHdrs.indexOf('CLAVE_ECONOMICA_CURP');
  var iDocNom   = docHdrs.indexOf('DOCENTE');
  var iDocForm  = docHdrs.indexOf('FORMACION ACADEMICA');

  if (iDocClave < 0) return { status: 'error', message: 'DOCENTES_RAW: falta columna CLAVE_ECONOMICA_CURP.' };
  if (iDocNom   < 0) return { status: 'error', message: 'DOCENTES_RAW: falta columna DOCENTE.' };

  var docMap = {};
  for (var i = 1; i < docVals.length; i++) {
    var clave = String(docVals[i][iDocClave] || '').trim();
    if (!clave) continue;
    docMap[clave] = {
      docente:   String(docVals[i][iDocNom]  || '').trim(),
      formacion: iDocForm >= 0 ? String(docVals[i][iDocForm] || '').trim() : ''
    };
  }

  // ── Leer HORARIOS_RAW ──
  var rawVals = rawSheet.getDataRange().getValues();
  var rawHdrs = rawVals[0].map(function(h) { return String(h).trim().toUpperCase(); });

  function col_(name) { return rawHdrs.indexOf(name); }

  var iClave  = col_('CLAVE_ECONOMICA_CURP');
  var iCiclo  = col_('CICLO ESCOLAR');
  var iGrupo  = col_('GRUPO');
  var iTurno  = col_('TURNO');
  var iUAC    = col_('UAC');
  var iComp   = col_('COMPONENTE');
  var iTot    = col_('TOT');

  var DIAS = [
    { col: col_('LUNES'),     label: 'LUNES'     },
    { col: col_('MARTES'),    label: 'MARTES'    },
    { col: col_('MIERCOLES'), label: 'MIERCOLES' },
    { col: col_('JUEVES'),    label: 'JUEVES'    },
    { col: col_('VIERNES'),   label: 'VIERNES'   }
  ];

  // Acepta separador - o – y espacios opcionales; también H:MM sin cero inicial
  var TIME_RE = /^(\d{1,2}:\d{2})\s*[-\u2013]\s*(\d{1,2}:\d{2})$/;

  var webRows = [];
  var seen    = {};

  for (var r = 1; r < rawVals.length; r++) {
    var row   = rawVals[r];
    var clave = iClave >= 0 ? String(row[iClave] || '').trim() : '';
    if (!clave) continue;

    var ciclo  = iCiclo >= 0 ? String(row[iCiclo]  || '').trim() : '';
    var grupo  = iGrupo >= 0 ? String(row[iGrupo]  || '').trim() : '';
    var turno  = iTurno >= 0 ? String(row[iTurno]  || '').trim() : '';
    var uac    = iUAC   >= 0 ? String(row[iUAC]    || '').trim() : '';
    var comp   = iComp  >= 0 ? String(row[iComp]   || '').trim() : '';
    var tot    = iTot   >= 0 ? String(row[iTot]    || '').trim() : '';

    var info = docMap[clave] || { docente: clave, formacion: '' };

    DIAS.forEach(function(dia) {
      if (dia.col < 0) return;
      var celda = String(row[dia.col] || '').trim();
      if (!celda) return;
      var m = celda.match(TIME_RE);
      if (!m) return;

      var hi = _normalTime_(m[1]);
      var hf = _normalTime_(m[2]);
      var hb = _calcHoras_(hi, hf);

      var key = [ciclo, grupo, uac, clave, dia.label, hi].join('|');
      if (seen[key]) return;
      seen[key] = true;

      webRows.push([
        ciclo, grupo, turno, uac, comp,
        clave, info.docente, info.formacion,
        dia.label, hi, hf, hb, tot, 'TRUE'
      ]);
    });
  }

  // ── Leer EXTRAESCOLARES_RAW ──
  var extSheet = ss.getSheetByName(HOJA_EXTRAESC_);
  if (extSheet) {
    var extVals = extSheet.getDataRange().getValues();
    if (extVals.length > 1) {
      var extHdrs = extVals[0].map(function(h) { return String(h).trim().toUpperCase(); });
      var eiClave = extHdrs.indexOf('CLAVE_ECONOMICA_CURP');
      var eiCiclo = extHdrs.indexOf('CICLO ESCOLAR');
      var eiAct   = extHdrs.indexOf('ACTIVIDAD_EXTRAESCOLAR');
      var eiDoc   = extHdrs.indexOf('DOCENTE');
      var eiTot   = extHdrs.indexOf('TOTAL_HORAS_EXT');

      var EDIAS = [
        { col: extHdrs.indexOf('LUNES'),     label: 'LUNES'     },
        { col: extHdrs.indexOf('MARTES'),    label: 'MARTES'    },
        { col: extHdrs.indexOf('MIERCOLES'), label: 'MIERCOLES' },
        { col: extHdrs.indexOf('JUEVES'),    label: 'JUEVES'    },
        { col: extHdrs.indexOf('VIERNES'),   label: 'VIERNES'   }
      ];

      for (var e = 1; e < extVals.length; e++) {
        var erow  = extVals[e];
        var eClave = eiClave >= 0 ? String(erow[eiClave] || '').trim() : '';
        if (!eClave) continue;

        var eCiclo = eiCiclo >= 0 ? String(erow[eiCiclo] || '').trim() : '';
        var eAct   = eiAct   >= 0 ? String(erow[eiAct]   || '').trim() : 'Actividad';
        var eDoc   = eiDoc   >= 0 ? String(erow[eiDoc]   || '').trim() : eClave;
        var eTot   = eiTot   >= 0 ? String(erow[eiTot]   || '').trim() : '';
        
        // Usar info del docente (formación) si existe
        var eInfo = docMap[eClave] || { docente: eDoc, formacion: '' };

        EDIAS.forEach(function(dia) {
          if (dia.col < 0) return;
          var celda = String(erow[dia.col] || '').trim();
          if (!celda) return;
          var m = celda.match(TIME_RE);
          if (!m) return;

          var hi = _normalTime_(m[1]);
          var hf = _normalTime_(m[2]);
          var hb = _calcHoras_(hi, hf);

          // Clave única para evitar duplicados en la misma regeneración
          var eKey = [eCiclo, 'EXTRA', eAct, eClave, dia.label, hi].join('|');
          if (seen[eKey]) return;
          seen[eKey] = true;

          webRows.push([
            eCiclo, 'FORTALECIMIENTO', 'N/A', eAct, 'EXTRAESCOLAR',
            eClave, eInfo.docente, eInfo.formacion,
            dia.label, hi, hf, hb, eTot, 'TRUE'
          ]);
        });
      }
    }
  }

  // ── Escribir HORARIOS_WEB ──
  var webSheet = ss.getSheetByName(HOJA_WEB_);
  if (!webSheet) {
    webSheet = ss.insertSheet(HOJA_WEB_);
  } else {
    webSheet.clearContents();
  }

  var hdrs = [
    'ciclo', 'grupo', 'turno', 'materia', 'componente',
    'clave_economica_curp', 'docente', 'formacion_academica',
    'dia', 'hora_inicio', 'hora_fin', 'horas_bloque', 'total_horas_materia', 'activo'
  ];

  webSheet.getRange(1, 1, 1, hdrs.length).setValues([hdrs]);

  if (webRows.length > 0) {
    // Forzar texto plano en las columnas de hora ANTES de escribir los valores,
    // para que Sheets no auto-convierta "07:00" a tipo Date internamente.
    var iHi = hdrs.indexOf('hora_inicio') + 1; // 1-indexed
    var iHf = hdrs.indexOf('hora_fin')    + 1;
    if (iHi > 0) webSheet.getRange(2, iHi, webRows.length, 1).setNumberFormat('@');
    if (iHf > 0) webSheet.getRange(2, iHf, webRows.length, 1).setNumberFormat('@');

    webSheet.getRange(2, 1, webRows.length, hdrs.length).setValues(webRows);
  }

  // Formato del encabezado
  var hRange = webSheet.getRange(1, 1, 1, hdrs.length);
  hRange.setFontWeight('bold');
  hRange.setBackground('#0f172a');
  hRange.setFontColor('#ffffff');
  webSheet.setFrozenRows(1);
  webSheet.autoResizeColumns(1, hdrs.length);

  return {
    status:  'ok',
    message: 'HORARIOS_WEB regenerada correctamente. ' + webRows.length + ' sesiones procesadas.',
    total:   webRows.length
  };
}

// ── HELPERS ──────────────────────────────────────────────────

// Convierte un objeto Date (producido por Sheets al leer celdas de tipo hora)
// en un string "HH:MM". GAS usa la zona horaria del spreadsheet, por eso
// se usan getHours()/getMinutes() en lugar de getUTCHours()/getUTCMinutes().
function _dateToTimeStr_(d) {
  var h = d.getHours();
  var m = d.getMinutes();
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

function _normalTime_(t) {
  var parts = String(t).trim().split(':');
  return ('0' + parseInt(parts[0], 10)).slice(-2) + ':' + ('0' + (parseInt(parts[1], 10) || 0)).slice(-2);
}

function _calcHoras_(ini, fin) {
  var p1 = ini.split(':').map(Number);
  var p2 = fin.split(':').map(Number);
  var diff = (p2[0] * 60 + p2[1]) - (p1[0] * 60 + p1[1]);
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
}

// ── MENÚ (ejecución manual desde Google Sheets) ───────────────
// Al abrir la hoja aparece el menú "Horarios CEB" → "Regenerar HORARIOS_WEB"
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Horarios CEB')
    .addItem('▶ Regenerar HORARIOS_WEB', 'regenerarDesdeMenu_')
    .addSeparator()
    .addItem('Ver clave de admin', 'verClaveAdmin_')
    .addToUi();
}

function regenerarDesdeMenu_() {
  var ui     = SpreadsheetApp.getUi();
  var result = _regenerar_();
  if (result.status === 'ok') {
    ui.alert('✅ ' + result.message);
  } else {
    ui.alert('❌ Error: ' + result.message);
  }
}

function verClaveAdmin_() {
  SpreadsheetApp.getUi().alert(
    'Clave de administrador:\n\n' + HORARIOS_ADMIN_KEY_ +
    '\n\nUsa esta clave en el botón "Regenerar HORARIOS_WEB" del módulo web.'
  );
}
