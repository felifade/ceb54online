// ═══════════════════════════════════════════════════════════════════
//  CONCENTRADO SUBDIRECCIÓN — Script container-bound al Sheets
//  CEB 5/4 "Profr. Rafael Ramírez"
//
//  MEJORAS respecto a la versión anterior:
//  - Preserva CALIFICACIÓN y VALIDA entre ejecuciones (antes se borraban)
//  - Agrega encabezados de las columnas H e I automáticamente
//  - Expande el título fusionado para cubrir todas las columnas (B2:I2)
//  - Aplica formato visual a las nuevas columnas
// ═══════════════════════════════════════════════════════════════════

function actualizarConcentradoSubdireccion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombreHojaConcentrado    = "CONCENTRADO SUBDIRECCION";
  const filaEncabezados          = 3;
  const filaInicioDatosFuente    = 9;
  const filaInicioDatosConcentrado = 4;

  let hojaConcentrado = ss.getSheetByName(nombreHojaConcentrado);
  if (!hojaConcentrado) {
    hojaConcentrado = ss.insertSheet(nombreHojaConcentrado);
  }

  // Recuperar DOCENTE, CALIFICACIÓN y VALIDA ya capturados ← MEJORA
  const datosGuardados = obtenerDatosGuardados_(hojaConcentrado, filaInicioDatosConcentrado);

  const hojasExcluir = [nombreHojaConcentrado, "subdireccion base"];
  const todasLasHojas = ss.getSheets();
  let concentrado = [];
  let consecutivo = 1;

  todasLasHojas.forEach(hoja => {
    const nombreHoja = hoja.getName().trim();
    if (hojasExcluir.includes(nombreHoja)) return;

    const tipoEvaluacion = obtenerTipoEvaluacion_(nombreHoja);
    if (!tipoEvaluacion) return;

    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < filaInicioDatosFuente) return;

    const datos = hoja.getRange(
      filaInicioDatosFuente, 2,
      ultimaFila - filaInicioDatosFuente + 1, 3
    ).getValues();

    datos.forEach(fila => {
      const nombreAlumno = limpiarTexto_(fila[0]);
      const grupo        = limpiarTexto_(fila[1]);
      const asignatura   = limpiarTexto_(fila[2]);

      if (nombreAlumno !== "" && !esEncabezado_(nombreAlumno)) {
        const clave = construirClave_(nombreAlumno, grupo, asignatura, tipoEvaluacion);

        // Recuperar datos previamente capturados por clave ← MEJORA
        const guardado      = datosGuardados[clave] || {};
        const docente       = guardado.docente       || "";
        const calificacion  = guardado.calificacion  || ""; // ← MEJORA
        const valida        = guardado.valida        || ""; // ← MEJORA

        concentrado.push([
          clave,          // A CLAVE (oculta)
          consecutivo,    // B No.
          nombreAlumno,   // C NOMBRE DEL ALUMNO(A)
          grupo,          // D GRUPO
          asignatura,     // E ASIGNATURA
          docente,        // F DOCENTE
          tipoEvaluacion, // G TIPO DE EVALUACIÓN
          calificacion,   // H CALIFICACIÓN  ← MEJORA
          valida,         // I VALIDA        ← MEJORA
        ]);

        consecutivo++;
      }
    });
  });

  hojaConcentrado.clear();

  // Título fusionado — ahora cubre hasta la col I ← MEJORA
  hojaConcentrado.getRange("B2:I2").merge();
  hojaConcentrado.getRange("B2")
    .setValue("CONCENTRADO SUBDIRECCIÓN")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setFontSize(12);

  // Encabezados — ahora incluye CALIFICACIÓN y VALIDA ← MEJORA
  const encabezados = [[
    "CLAVE",
    "No.",
    "NOMBRE DEL ALUMNO(A)",
    "GRUPO",
    "ASIGNATURA",
    "DOCENTE",
    "TIPO DE EVALUACIÓN",
    "CALIFICACIÓN",  // ← MEJORA
    "VALIDA",        // ← MEJORA
  ]];

  hojaConcentrado.getRange(filaEncabezados, 1, 1, 9).setValues(encabezados); // ← 9 cols

  if (concentrado.length > 0) {
    hojaConcentrado.getRange(
      filaInicioDatosConcentrado, 1, concentrado.length, 9 // ← 9 cols
    ).setValues(concentrado);
  }

  // Formato encabezados
  hojaConcentrado.getRange(filaEncabezados, 1, 1, 9)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  // Formato visual columnas CALIFICACIÓN y VALIDA ← MEJORA
  if (concentrado.length > 0) {
    hojaConcentrado.getRange(filaInicioDatosConcentrado, 8, concentrado.length, 2)
      .setHorizontalAlignment("center");
  }

  hojaConcentrado.setFrozenRows(3);
  hojaConcentrado.autoResizeColumns(1, 9); // ← 9 cols

  hojaConcentrado.setColumnWidth(1, 120);  // CLAVE
  hojaConcentrado.setColumnWidth(2, 60);   // No.
  hojaConcentrado.setColumnWidth(3, 280);  // Nombre
  hojaConcentrado.setColumnWidth(4, 100);  // Grupo
  hojaConcentrado.setColumnWidth(5, 320);  // Asignatura
  hojaConcentrado.setColumnWidth(6, 220);  // Docente
  hojaConcentrado.setColumnWidth(7, 160);  // Tipo
  hojaConcentrado.setColumnWidth(8, 110);  // Calificación ← MEJORA
  hojaConcentrado.setColumnWidth(9, 110);  // Valida       ← MEJORA

  hojaConcentrado.hideColumns(1); // Ocultar col CLAVE

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Concentrado actualizado. Registros: " + concentrado.length,
    "Subdirección", 5
  );

  Logger.log("Registros encontrados: " + concentrado.length);
}


// ── Recupera DOCENTE + CALIFICACIÓN + VALIDA guardados ────────────
// (antes solo recuperaba DOCENTE — mejora clave para no perder califs)
function obtenerDatosGuardados_(hoja, filaInicioDatosConcentrado) {
  const guardados = {};
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < filaInicioDatosConcentrado) return guardados;

  const datos = hoja.getRange(
    filaInicioDatosConcentrado, 1,
    ultimaFila - filaInicioDatosConcentrado + 1,
    9  // ← ahora lee 9 columnas (antes 7)
  ).getValues();

  datos.forEach(fila => {
    const clave = limpiarTexto_(fila[0]); // A
    if (!clave) return;
    guardados[clave] = {
      docente:      limpiarTexto_(fila[5]), // F
      calificacion: fila[7] !== undefined ? fila[7] : "", // H ← MEJORA
      valida:       fila[8] !== undefined ? limpiarTexto_(fila[8]) : "", // I ← MEJORA
    };
  });

  return guardados;
}


// ── Detecta si un valor parece encabezado en lugar de nombre ────────
// Cubre los casos más comunes: títulos de columna, etiquetas, números.
function esEncabezado_(valor) {
  const v = normalizarTexto_(valor);

  // Palabras clave típicas de encabezados
  const patronesEncabezado = [
    "NOMBRE", "ALUMNO", "NO.", "NUM", "NUMERO",
    "GRUPO", "ASIGNATURA", "MATERIA", "DOCENTE",
    "CALIFICACION", "EVALUACION", "TIPO", "CLAVE",
    "LISTA", "REGISTRO", "FOLIO", "CURP"
  ];

  if (patronesEncabezado.some(p => v.includes(p))) return true;

  // Valor puramente numérico (número de lista o fila)
  if (/^\d+$/.test(v)) return true;

  // Muy corto para ser un nombre completo (menos de 4 caracteres)
  if (v.length < 4) return true;

  return false;
}

function construirClave_(nombreAlumno, grupo, asignatura, tipoEvaluacion) {
  return [
    normalizarTexto_(nombreAlumno),
    normalizarTexto_(grupo),
    normalizarTexto_(asignatura),
    normalizarTexto_(tipoEvaluacion)
  ].join(" | ");
}

function obtenerTipoEvaluacion_(nombreHoja) {
  const nombre = normalizarTexto_(nombreHoja);
  if (nombre.includes("CURSO")) return "CURSO";
  if (nombre.includes("EXAM") || nombre.includes("EVAL") || nombre.includes("EVALUACION")) return "EXAMEN";
  return "";
}

function limpiarTexto_(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function normalizarTexto_(texto) {
  return limpiarTexto_(texto)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Subdirección")
    .addItem("Actualizar concentrado", "actualizarConcentradoSubdireccion")
    .addToUi();
}

function activarMenu() {
  onOpen();
}
