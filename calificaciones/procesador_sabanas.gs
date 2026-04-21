// ═══════════════════════════════════════════════════════════════════════
//  PROCESADOR DE SÁBANAS DE CALIFICACIONES — CEB 5/4
//  Google Apps Script — container-bound al Spreadsheet del portal
//
//  SERVICIOS A HABILITAR EN EL PROYECTO:
//    Servicios avanzados → Drive API v2
//
//  HOJAS QUE CREA/USA:
//    CONTROL            → configuración + IDs de carpetas Drive
//    Calificaciones_Sabanas → hoja maestra normalizada (fuente del portal)
//    Bitacora_Sabanas   → log de cada archivo procesado
//
//  FLUJO:
//    1. Docente sube su Excel/Sheets a la carpeta "Pendientes" en Drive
//    2. Admin abre este Spreadsheet y usa el menú  Sábanas → Procesar nuevas
//    3. El script detecta grupo, asignatura, docente, mapea columnas
//    4. Extrae calificaciones por CURP y hace upsert en Calificaciones_Sabanas
//    5. Mueve el archivo a "Procesados" (o "Errores" si falla)
//    6. El portal lee Calificaciones_Sabanas via getCalifSabanas()
// ═══════════════════════════════════════════════════════════════════════

// ── NOMBRES DE HOJAS ─────────────────────────────────────────────────
const SH_CONTROL = 'CONTROL';
const SH_CAL     = 'Calificaciones_Sabanas';
const SH_BIT     = 'Bitacora_Sabanas';

// ── ESQUEMA HOJA MAESTRA ─────────────────────────────────────────────
// Orden exacto de columnas en Calificaciones_Sabanas
const COLS_MAESTRA = [
  'ciclo', 'periodo', 'grupo', 'asignatura', 'docente', 'curp', 'nombre',
  'p1_portafolio', 'p1_examen', 'p1_pec', 'p1_c4', 'p1_total', 'p1_faltas',
  'p2_portafolio', 'p2_examen', 'p2_pec', 'p2_c4', 'p2_total', 'p2_faltas',
  'p3_portafolio', 'p3_examen', 'p3_pec', 'p3_c4', 'p3_total', 'p3_faltas',
  'global', 'archivo_origen', 'fecha_proceso'
];

// ── LEER CONFIGURACIÓN ────────────────────────────────────────────────
function getConfig() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const ctrl = ss.getSheetByName(SH_CONTROL);
  if (!ctrl) throw new Error('Hoja CONTROL no encontrada. Ejecuta Sábanas → Inicializar sistema primero.');
  return {
    carpetaPendientesId: String(ctrl.getRange('B2').getValue()).trim(),
    carpetaProcesadosId: String(ctrl.getRange('B3').getValue()).trim(),
    carpetaErroresId:    String(ctrl.getRange('B4').getValue()).trim(),
    ciclo:               String(ctrl.getRange('B5').getValue()).trim(),
    periodo:             String(ctrl.getRange('B6').getValue()).trim(),
  };
}

// ════════════════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL — disparada por el botón del menú
// ════════════════════════════════════════════════════════════════════════
function procesarPendientes() {
  const ui  = SpreadsheetApp.getUi();
  const cfg = getConfig();

  if (!cfg.carpetaPendientesId) {
    ui.alert('⚠ Configura primero el ID de la carpeta Pendientes en la hoja CONTROL (celda B2).');
    return;
  }

  // Obtener archivos de la carpeta Pendientes
  let carpeta;
  try { carpeta = DriveApp.getFolderById(cfg.carpetaPendientesId); }
  catch(e) { ui.alert('Error al acceder a la carpeta Pendientes:\n' + e.message); return; }

  const archivos = [];
  const it = carpeta.getFiles();
  while (it.hasNext()) {
    const f    = it.next();
    const mime = f.getMimeType();
    if (
      mime === MimeType.GOOGLE_SHEETS ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel'
    ) archivos.push(f);
  }

  if (!archivos.length) {
    ui.alert('No hay archivos nuevos en la carpeta Pendientes.');
    return;
  }

  let ok = 0, errores = 0;

  archivos.forEach(file => {
    try {
      const res = procesarArchivo(file, cfg);
      moverArchivo(file, cfg.carpetaProcesadosId);
      registrarBitacora({
        fecha: new Date(), archivo: file.getName(),
        grupo: res.grupo, asignatura: res.asignatura,
        alumnos: res.alumnos, estado: 'OK', error: ''
      });
      ok++;
    } catch(e) {
      moverArchivo(file, cfg.carpetaErroresId);
      registrarBitacora({
        fecha: new Date(), archivo: file.getName(),
        grupo: '—', asignatura: '—',
        alumnos: 0, estado: 'ERROR', error: e.message
      });
      Logger.log('ERROR procesando ' + file.getName() + ': ' + e.message);
      errores++;
    }
  });

  ui.alert(
    'Procesamiento completado.\n\n' +
    '✓ ' + ok      + ' archivo(s) procesado(s) correctamente\n' +
    '✗ ' + errores + ' archivo(s) con error(es)\n\n' +
    'Revisa la hoja Bitacora_Sabanas para ver el detalle.'
  );
}

// ════════════════════════════════════════════════════════════════════════
//  PROCESAMIENTO DE UN ARCHIVO
// ════════════════════════════════════════════════════════════════════════
function procesarArchivo(file, cfg) {
  let ss;
  let esConvertido = false;

  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
    ss = SpreadsheetApp.openById(file.getId());
  } else {
    // Excel: convertir temporalmente a Google Sheets
    const recurso = { title: '_tmp_' + file.getName(), mimeType: MimeType.GOOGLE_SHEETS };
    const tmp = Drive.Files.insert(recurso, file.getBlob(), { convert: true });
    ss = SpreadsheetApp.openById(tmp.id);
    esConvertido = true;
  }

  try {
    const sheet = ss.getSheets()[0];

    const meta      = extraerMetadatos(sheet);
    const estructura = encontrarEstructura(sheet);
    const colMap    = mapearColumnas(estructura);
    const alumnos   = extraerAlumnos(sheet, estructura, colMap);

    if (!alumnos.length) throw new Error('No se encontraron filas de alumnos válidas (CURP vacío en todas las filas).');

    const registros = alumnos.map(a => ({
      ciclo: cfg.ciclo, periodo: cfg.periodo,
      grupo: meta.grupo, asignatura: meta.asignatura, docente: meta.docente,
      archivo_origen: file.getName(), fecha_proceso: new Date(),
      ...a
    }));

    upsertCalificaciones(registros);

    return { grupo: meta.grupo, asignatura: meta.asignatura, alumnos: alumnos.length };

  } finally {
    if (esConvertido) {
      try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch(_) {}
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  EXTRACCIÓN DE METADATOS  (GRUPO / ASIGNATURA / DOCENTE)
// ════════════════════════════════════════════════════════════════════════
function extraerMetadatos(sheet) {
  const meta = { grupo: '', asignatura: '', docente: '' };
  const maxRow = Math.min(10, sheet.getLastRow());
  const maxCol = Math.min(6, sheet.getLastColumn());

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const val = String(sheet.getRange(r, c).getValue()).trim();
      if (!val) continue;
      const up = val.toUpperCase();
      if (!meta.grupo     && (up.startsWith('GRUPO:') || up.startsWith('GRUPO :')))
        meta.grupo     = val.replace(/^GRUPO\s*:\s*/i, '').trim();
      if (!meta.asignatura && (up.startsWith('ASIGNATURA:') || up.startsWith('MATERIA:')))
        meta.asignatura = val.replace(/^(ASIGNATURA|MATERIA)\s*:\s*/i, '').trim();
      if (!meta.docente   && (up.startsWith('DOCENTE:') || up.startsWith('PROFESOR:')))
        meta.docente   = val.replace(/^(DOCENTE|PROFESOR)\s*:\s*/i, '').trim();
    }
  }

  if (!meta.grupo)      throw new Error('Campo GRUPO no encontrado en el archivo (se esperaba "GRUPO: XXX" en las primeras 10 filas).');
  if (!meta.asignatura) throw new Error('Campo ASIGNATURA no encontrado en el archivo.');
  return meta;
}

// ════════════════════════════════════════════════════════════════════════
//  ENCONTRAR ESTRUCTURA DE LA TABLA
//  Retorna: { headerMergedRow, headerSubRow, dataStart, mergedVals, subVals }
// ════════════════════════════════════════════════════════════════════════
function encontrarEstructura(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // Buscar la fila donde aparece CURP y/o NOMBRE → esa es la fila de sub-headers
  let headerSubRow = -1;

  for (let r = 1; r <= Math.min(18, lastRow); r++) {
    const vals = sheet.getRange(r, 1, 1, lastCol).getValues()[0]
      .map(v => String(v).toUpperCase().trim());
    if (vals.includes('CURP') && vals.some(v => v.includes('NOMBRE'))) {
      headerSubRow = r;
      break;
    }
  }

  if (headerSubRow === -1)
    throw new Error('No se encontró la fila de encabezados (se esperaban columnas CURP y NOMBRE).');

  const headerMergedRow = headerSubRow - 1; // fila anterior: "PRIMER PARCIAL", etc.

  const mergedVals = headerMergedRow >= 1
    ? sheet.getRange(headerMergedRow, 1, 1, lastCol).getValues()[0].map(v => String(v).trim())
    : new Array(lastCol).fill('');

  const subVals = sheet.getRange(headerSubRow, 1, 1, lastCol).getValues()[0]
    .map(v => String(v).trim());

  return { headerMergedRow, headerSubRow, dataStart: headerSubRow + 1, mergedVals, subVals };
}

// ════════════════════════════════════════════════════════════════════════
//  MAPEAR COLUMNAS
//  Retorna un objeto con índices 0-based de cada campo relevante
// ════════════════════════════════════════════════════════════════════════
function mapearColumnas(estructura) {
  const { mergedVals, subVals } = estructura;

  // ── Columnas fijas ────────────────────────────────────────────────
  const colCurp   = subVals.findIndex(v => v.toUpperCase() === 'CURP');
  const colNombre = subVals.findIndex(v => v.toUpperCase().includes('NOMBRE'));
  if (colCurp   === -1) throw new Error('Columna CURP no encontrada en la fila de encabezados.');
  if (colNombre === -1) throw new Error('Columna NOMBRE no encontrada en la fila de encabezados.');

  // ── Detectar inicios de cada parcial (en fila merged) ────────────
  // Un parcial empieza en la columna donde mergedVals tiene "PRIMER","SEGUNDO","TERCER" + "PARCIAL"
  const parcialStarts = { p1: -1, p2: -1, p3: -1, global: -1 };
  mergedVals.forEach((v, i) => {
    const u = v.toUpperCase();
    if (u.includes('PARCIAL')) {
      if      ((u.includes('PRIMER')  || u.includes('1ER') || u.match(/P\.?\s*1\b/)) && parcialStarts.p1 === -1) parcialStarts.p1 = i;
      else if ((u.includes('SEGUNDO') || u.includes('2DO') || u.match(/P\.?\s*2\b/)) && parcialStarts.p2 === -1) parcialStarts.p2 = i;
      else if ((u.includes('TERCER')  || u.includes('3ER') || u.match(/P\.?\s*3\b/)) && parcialStarts.p3 === -1) parcialStarts.p3 = i;
    }
    if (u === 'GLOBAL' || u === 'CALIFICACIÓN GLOBAL' || u === 'CALIFICACION GLOBAL') parcialStarts.global = i;
  });

  // Fallback: buscar en subVals si merged no encontró
  if (parcialStarts.p1 === -1) {
    subVals.forEach((v, i) => {
      const u = v.toUpperCase();
      if (u.includes('PRIMER PARCIAL')  && parcialStarts.p1 === -1) parcialStarts.p1 = i;
      if (u.includes('SEGUNDO PARCIAL') && parcialStarts.p2 === -1) parcialStarts.p2 = i;
      if (u.includes('TERCER PARCIAL')  && parcialStarts.p3 === -1) parcialStarts.p3 = i;
    });
  }

  // Detectar GLOBAL en subVals si no apareció en merged
  if (parcialStarts.global === -1) {
    parcialStarts.global = subVals.findIndex(v => v.toUpperCase() === 'GLOBAL' || v.toUpperCase() === 'CALIFICACION GLOBAL');
  }

  // ── Mapear columnas internas de cada parcial ──────────────────────
  // Estrategia: a partir de parcelStart, buscar "Total"/"TOTAL" en subVals.
  // Los 4 componentes están justo antes del Total.
  // "FALTAS" está justo después del Total.
  function mapParcial(startCol, nextParcialStart) {
    if (startCol === -1) return null;

    const limit = nextParcialStart !== -1 ? nextParcialStart : subVals.length;

    // Buscar "Total" en el rango del parcial
    let totalCol = -1;
    for (let i = startCol; i < limit; i++) {
      if (subVals[i].toUpperCase() === 'TOTAL') { totalCol = i; break; }
    }

    // Si no hay "Total" explícito, intentar heurística: última columna numérica antes de FALTAS
    if (totalCol === -1) {
      for (let i = startCol; i < limit - 1; i++) {
        const u = subVals[i].toUpperCase();
        if (u === 'FALTAS' || u === 'F') { totalCol = i - 1; break; }
      }
    }

    // FALTAS: columna después del Total que se llame FALTAS o F
    let faltasCol = -1;
    if (totalCol !== -1) {
      for (let i = totalCol + 1; i < Math.min(totalCol + 4, limit); i++) {
        const u = subVals[i].toUpperCase();
        if (u === 'FALTAS' || u === 'F' || u === 'FALTAS F') { faltasCol = i; break; }
      }
    }

    // Componentes: columnas entre startCol y totalCol (excluyendo "No. Clases:" si la hay)
    // Tomamos hasta 4 componentes numéricos
    const compCols = [];
    const endComp  = totalCol !== -1 ? totalCol : startCol + 5;
    for (let i = startCol; i < endComp; i++) {
      // Ignorar la columna "No. Clases:" que es asistencia, no calificación
      const u = subVals[i].toUpperCase();
      if (u.includes('NO.') || u.includes('CLASES') || u === 'NO') continue;
      compCols.push(i);
    }

    return { comps: compCols, total: totalCol, faltas: faltasCol };
  }

  return {
    curp:   colCurp,
    nombre: colNombre,
    p1:     mapParcial(parcialStarts.p1, parcialStarts.p2),
    p2:     mapParcial(parcialStarts.p2, parcialStarts.p3),
    p3:     mapParcial(parcialStarts.p3, parcialStarts.global !== -1 ? parcialStarts.global : -1),
    global: parcialStarts.global
  };
}

// ════════════════════════════════════════════════════════════════════════
//  EXTRAER FILAS DE ALUMNOS
// ════════════════════════════════════════════════════════════════════════
function extraerAlumnos(sheet, estructura, colMap) {
  const { dataStart } = estructura;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (dataStart > lastRow) return [];

  const data = sheet.getRange(dataStart, 1, lastRow - dataStart + 1, lastCol).getValues();
  const alumnos = [];

  data.forEach(row => {
    const curp   = String(row[colMap.curp]   || '').trim().toUpperCase();
    const nombre = String(row[colMap.nombre] || '').trim();

    // Saltar filas vacías, totales o encabezados repetidos
    if (!curp || !nombre) return;
    if (curp === 'CURP' || curp === 'NO.' || curp === 'N°') return;
    // Saltar si el CURP parece un número de fila (solo dígitos cortos)
    if (/^\d{1,3}$/.test(curp)) return;

    function getComp(pm, idx) {
      if (!pm || idx >= pm.comps.length) return '';
      return fmtGrade(row[pm.comps[idx]]);
    }
    function getTotal(pm) {
      if (!pm || pm.total === -1) return '';
      return fmtGrade(row[pm.total]);
    }
    function getFaltas(pm) {
      if (!pm || pm.faltas === -1) return '';
      const v = row[pm.faltas];
      if (v === null || v === '') return '';
      const n = Number(v);
      return isNaN(n) ? '' : n;
    }

    alumnos.push({
      curp, nombre,
      // Parcial 1: c1=portafolio, c2=examen, c3=PEC, c4=componente extra (vacío en mayoría)
      p1_portafolio: getComp(colMap.p1, 0),
      p1_examen:     getComp(colMap.p1, 1),
      p1_pec:        getComp(colMap.p1, 2),
      p1_c4:         getComp(colMap.p1, 3),
      p1_total:      getTotal(colMap.p1),
      p1_faltas:     getFaltas(colMap.p1),
      // Parcial 2
      p2_portafolio: getComp(colMap.p2, 0),
      p2_examen:     getComp(colMap.p2, 1),
      p2_pec:        getComp(colMap.p2, 2),
      p2_c4:         getComp(colMap.p2, 3),
      p2_total:      getTotal(colMap.p2),
      p2_faltas:     getFaltas(colMap.p2),
      // Parcial 3
      p3_portafolio: getComp(colMap.p3, 0),
      p3_examen:     getComp(colMap.p3, 1),
      p3_pec:        getComp(colMap.p3, 2),
      p3_c4:         getComp(colMap.p3, 3),
      p3_total:      getTotal(colMap.p3),
      p3_faltas:     getFaltas(colMap.p3),
      // Global
      global:        colMap.global !== -1 ? fmtGrade(row[colMap.global]) : '',
    });
  });

  return alumnos;
}

function fmtGrade(val) {
  if (val === null || val === '' || val === undefined) return '';
  const n = Number(val);
  return isNaN(n) ? '' : n;
}

// ════════════════════════════════════════════════════════════════════════
//  UPSERT EN HOJA MAESTRA
//  Clave única: ciclo + periodo + grupo + asignatura + curp
//  Si ya existe → actualiza; si no → agrega nueva fila
// ════════════════════════════════════════════════════════════════════════
function upsertCalificaciones(registros) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(SH_CAL);
  if (!hoja) throw new Error('Hoja ' + SH_CAL + ' no encontrada. Ejecuta Inicializar sistema.');

  const lastRow = hoja.getLastRow();

  // Índice por clave → número de fila (1-based)
  const indice = {};
  if (lastRow > 1) {
    // Lee solo las primeras 6 columnas para construir el índice rápidamente
    hoja.getRange(2, 1, lastRow - 1, 6).getValues().forEach((r, i) => {
      const k = [r[0], r[1], r[2], r[3], r[5]].join('|').toUpperCase();
      indice[k] = i + 2;
    });
  }

  const nuevos = [];

  registros.forEach(reg => {
    const k = [reg.ciclo, reg.periodo, reg.grupo, reg.asignatura, reg.curp].join('|').toUpperCase();
    const fila = COLS_MAESTRA.map(col => {
      const v = reg[col];
      return (v === undefined || v === null) ? '' : v;
    });

    if (indice[k]) {
      hoja.getRange(indice[k], 1, 1, fila.length).setValues([fila]);
    } else {
      nuevos.push(fila);
    }
  });

  if (nuevos.length) {
    hoja.getRange(Math.max(2, lastRow + 1), 1, nuevos.length, COLS_MAESTRA.length)
      .setValues(nuevos);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  BITÁCORA
// ════════════════════════════════════════════════════════════════════════
function registrarBitacora(entrada) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(SH_BIT);
  if (!hoja) return;
  hoja.appendRow([
    Utilities.formatDate(entrada.fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    entrada.archivo, entrada.grupo, entrada.asignatura,
    entrada.alumnos, entrada.estado, entrada.error
  ]);
}

// ════════════════════════════════════════════════════════════════════════
//  MOVER ARCHIVO EN DRIVE
// ════════════════════════════════════════════════════════════════════════
function moverArchivo(file, destFolderId) {
  if (!destFolderId) return;
  try {
    const dest = DriveApp.getFolderById(destFolderId);
    file.moveTo(dest);
  } catch(e) {
    Logger.log('No se pudo mover ' + file.getName() + ': ' + e.message);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  FUNCIÓN PÚBLICA PARA EL PORTAL
//  Llamada desde doGetPortal() → action=getCalifSabanas&curp=XXXXX
// ════════════════════════════════════════════════════════════════════════
/**
 * Retorna todas las calificaciones de sábana para un CURP dado.
 * Devuelve array de objetos: [{ ciclo, periodo, grupo, asignatura, ...parciales, global }]
 */
function getCalifSabanas(curp) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(SH_CAL);
  if (!hoja || hoja.getLastRow() < 2) return [];

  const curpUp = String(curp).trim().toUpperCase();
  const idx    = COLS_MAESTRA.indexOf('curp'); // columna 5 (0-based)

  const data = hoja.getRange(2, 1, hoja.getLastRow() - 1, COLS_MAESTRA.length).getValues();
  return data
    .filter(r => String(r[idx]).toUpperCase() === curpUp)
    .map(r => {
      const obj = {};
      COLS_MAESTRA.forEach((col, i) => { obj[col] = r[i]; });
      return obj;
    });
}

// ════════════════════════════════════════════════════════════════════════
//  INICIALIZAR SISTEMA (ejecutar UNA sola vez)
// ════════════════════════════════════════════════════════════════════════
function inicializarSistema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // ── Hoja CONTROL ─────────────────────────────────────────────────
  let ctrl = ss.getSheetByName(SH_CONTROL);
  if (!ctrl) {
    ctrl = ss.insertSheet(SH_CONTROL);
    ss.setActiveSheet(ctrl);
    ss.moveActiveSheet(1); // dejarla primera
  }
  ctrl.clearContents();
  ctrl.getRange('A1').setValue('CONFIGURACIÓN DEL PROCESADOR DE SÁBANAS');
  ctrl.getRange('A1:B1').merge()
    .setBackground('#1e3a8a').setFontColor('white')
    .setFontWeight('bold').setFontSize(12);

  ctrl.getRange('A2:B6').setValues([
    ['ID Carpeta Pendientes',  '← pega aquí el ID de la carpeta Drive'],
    ['ID Carpeta Procesados',  '← pega aquí el ID de la carpeta Drive'],
    ['ID Carpeta Errores',     '← pega aquí el ID de la carpeta Drive'],
    ['Ciclo escolar',          '← ej: 2024-2025'],
    ['Periodo',                '← A o B'],
  ]);
  ctrl.getRange('A2:A6').setFontWeight('bold').setBackground('#f1f5f9');
  ctrl.getRange('B2:B6').setBackground('#fef9c3');
  ctrl.setColumnWidth(1, 220).setColumnWidth(2, 380);

  ctrl.getRange('A8').setValue(
    '▶ Usa el menú  Sábanas → Procesar nuevas sábanas  para iniciar el procesamiento.'
  ).setFontStyle('italic').setFontColor('#374151');

  // ── Hoja Calificaciones_Sabanas ──────────────────────────────────
  let cal = ss.getSheetByName(SH_CAL);
  if (!cal) cal = ss.insertSheet(SH_CAL);
  cal.clearContents();
  cal.getRange(1, 1, 1, COLS_MAESTRA.length).setValues([COLS_MAESTRA]);
  cal.getRange(1, 1, 1, COLS_MAESTRA.length)
    .setBackground('#1e3a8a').setFontColor('white').setFontWeight('bold');
  cal.setFrozenRows(1);
  // Ancho óptimo para las columnas de calificación
  cal.setColumnWidth(1, 100); // ciclo
  cal.setColumnWidth(2, 75);  // periodo
  cal.setColumnWidth(3, 80);  // grupo
  cal.setColumnWidth(4, 280); // asignatura
  cal.setColumnWidth(5, 200); // docente
  cal.setColumnWidth(6, 170); // curp
  cal.setColumnWidth(7, 220); // nombre
  // Resaltar columnas de totales
  [12, 18, 24].forEach(col => {
    cal.getRange(1, col).setBackground('#166534').setFontColor('white');
  });
  cal.getRange(1, 25).setBackground('#7c2d12').setFontColor('white'); // global

  // ── Hoja Bitácora ─────────────────────────────────────────────────
  let bit = ss.getSheetByName(SH_BIT);
  if (!bit) bit = ss.insertSheet(SH_BIT);
  bit.clearContents();
  const bitHdr = ['FECHA', 'ARCHIVO', 'GRUPO', 'ASIGNATURA', 'ALUMNOS', 'ESTADO', 'ERROR'];
  bit.getRange(1, 1, 1, bitHdr.length).setValues([bitHdr]);
  bit.getRange(1, 1, 1, bitHdr.length)
    .setBackground('#065f46').setFontColor('white').setFontWeight('bold');
  bit.setFrozenRows(1);
  bit.setColumnWidth(1, 155); // fecha
  bit.setColumnWidth(2, 280); // archivo
  bit.setColumnWidth(7, 400); // error

  ui.alert(
    '✓ Sistema inicializado correctamente.\n\n' +
    'Próximos pasos:\n' +
    '1. Abre la hoja CONTROL\n' +
    '2. Pega los IDs de tus carpetas de Drive en las celdas B2, B3, B4\n' +
    '   (el ID está en la URL de Drive: drive.google.com/drive/folders/[ID])\n' +
    '3. Ingresa el ciclo escolar y periodo en B5, B6\n' +
    '4. Usa el menú  Sábanas → Procesar nuevas sábanas'
  );
}

// ── MENÚ PERSONALIZADO ───────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🗂 Sábanas')
    .addItem('▶ Procesar nuevas sábanas',        'procesarPendientes')
    .addSeparator()
    .addItem('⚙ Inicializar sistema (1a vez)',    'inicializarSistema')
    .addToUi();
}
