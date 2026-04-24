// ═══════════════════════════════════════════════════════════════════
//  CALIFICACIONES INTRASEMESTRALES — FUNCIÓN GAS
//  CEB 5/4 "Profr. Rafael Ramírez"
//
//  INSTRUCCIONES DE INSTALACIÓN:
//  1. Abre el proyecto de Google Apps Script que ya tienes desplegado
//     (el mismo que usan PEC, tutorías, etc.)
//  2. Copia el contenido de este archivo y pégalo al final de Code.gs
//  3. En la función doGet(e) existente agrega este bloque dentro del
//     primer if/switch de acciones:
//
//       if (_act === "getCalifIntrasemestral") {
//         return getCalifIntrasemestral(e);
//       }
//
//  4. En CONFIGURACIÓN abajo, pon el ID del Google Sheets que
//     contiene la hoja "CONCENTRADO SUBDIRECCIÓN".
//     Si es el mismo Sheets del GAS principal, deja INTRASEMESTRAL_SHEET_ID vacío.
//
//  5. Haz un nuevo deployment (Deploy → New deployment) o actualiza
//     el existente.  Copia la URL y pégala en intrasemestral.js (GAS_URL).
// ═══════════════════════════════════════════════════════════════════

// ── CONFIGURACIÓN ───────────────────────────────────────────────────
// ID del Spreadsheet con la hoja de calificaciones.
// Deja vacío ("") si es el mismo Spreadsheet al que está ligado este GAS.
const INTRASEMESTRAL_SHEET_ID   = "";

// Nombre exacto de la pestaña (hoja) con los datos
const INTRASEMESTRAL_SHEET_NAME = "CONCENTRADO SUBDIRECCIÓN";

// Calificación mínima para acreditar
const INTRASEMESTRAL_CAL_MIN    = 6;
// ────────────────────────────────────────────────────────────────────


/**
 * Lee la hoja CONCENTRADO SUBDIRECCIÓN, detecta columnas dinámicamente
 * y devuelve un array de registros normalizados como JSON.
 *
 * Llamada: ?action=getCalifIntrasemestral
 */
function getCalifIntrasemestral(e) {
  try {
    const ss = INTRASEMESTRAL_SHEET_ID
      ? SpreadsheetApp.openById(INTRASEMESTRAL_SHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();

    const sheet = _getSheetCI(ss, INTRASEMESTRAL_SHEET_NAME);
    if (!sheet) {
      return _jsonCI({ status: "error", message: "Hoja no encontrada: " + INTRASEMESTRAL_SHEET_NAME });
    }

    const raw = sheet.getDataRange().getValues();

    // ── Detectar fila de encabezados buscando "NOMBRE" + "ALUMNO" ──
    let headerRow = -1;
    let colMap    = {};

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i].map(c => String(c).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
      const hasNombre = row.some(c => c.includes("NOMBRE") && c.includes("ALUMNO"));
      if (hasNombre) {
        headerRow = i;
        row.forEach((col, idx) => {
          if (col.includes("NOMBRE") && col.includes("ALUMNO")) colMap.nombre       = idx;
          else if (col === "GRUPO")                              colMap.grupo        = idx;
          else if (col.includes("ASIGNATURA"))                   colMap.asignatura   = idx;
          else if (col.includes("DOCENTE"))                      colMap.docente      = idx;
          else if (col.includes("TIPO"))                         colMap.tipo         = idx;
          else if (col.includes("CALIFICACI"))                   colMap.calificacion = idx;
          else if (col.includes("VALIDA") || col.includes("OBSERV")) colMap.observacion = idx;
        });
        break;
      }
    }

    if (headerRow === -1) {
      return _jsonCI({ status: "error", message: "No se encontró la fila de encabezados en la hoja." });
    }

    // ── Extraer registros ───────────────────────────────────────────
    const registros = [];
    for (let i = headerRow + 1; i < raw.length; i++) {
      const row    = raw[i];
      const nombre = String(row[colMap.nombre] || "").trim();
      if (!nombre) continue; // fila vacía

      const calRaw = colMap.calificacion !== undefined ? row[colMap.calificacion] : "";
      const cal    = (calRaw !== "" && calRaw !== null && !isNaN(parseFloat(calRaw)))
        ? parseFloat(calRaw)
        : null;

      registros.push({
        nombre:      nombre,
        grupo:       colMap.grupo        !== undefined ? String(row[colMap.grupo]        || "").trim() : "",
        asignatura:  colMap.asignatura   !== undefined ? String(row[colMap.asignatura]   || "").trim() : "",
        docente:     colMap.docente      !== undefined ? String(row[colMap.docente]      || "").trim() : "",
        tipo:        colMap.tipo         !== undefined ? String(row[colMap.tipo]         || "").toUpperCase().trim() : "",
        calificacion: cal,
        observacion: colMap.observacion  !== undefined ? String(row[colMap.observacion]  || "").trim() : "",
      });
    }

    return _jsonCI({ status: "ok", total: registros.length, registros });

  } catch (err) {
    return _jsonCI({ status: "error", message: err.message });
  }
}

// ── Helpers internos ────────────────────────────────────────────────

function _getSheetCI(ss, name) {
  // Busca la hoja tolerando variaciones de acentos/mayúsculas
  const target = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  return ss.getSheets().find(s =>
    s.getName().normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim() === target
  ) || null;
}

function _jsonCI(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
