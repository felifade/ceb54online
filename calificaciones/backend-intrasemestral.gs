// ═══════════════════════════════════════════════════════════════════
//  CALIFICACIONES INTRASEMESTRALES — BACKEND INDEPENDIENTE
//  CEB 5/4 "Profr. Rafael Ramírez"
//
//  INSTRUCCIONES (proyecto GAS nuevo, separado de todo lo demás):
//
//  1. Ve a https://script.google.com → Nuevo proyecto
//  2. Ponle nombre: "Calificaciones Intrasemestrales CEB54"
//  3. Borra todo el código que aparece y pega este archivo completo
//  4. En CONFIGURACIÓN (abajo), pon el ID del Google Sheets que
//     contiene la hoja "CONCENTRADO SUBDIRECCIÓN"
//     (el ID está en la URL del Sheets: /spreadsheets/d/ESTE_ES_EL_ID/edit)
//  5. Despliega:  Deploy → New deployment → Web app
//       · Execute as: Me
//       · Who has access: Anyone
//     Copia la URL del deployment
//  6. Pega esa URL en intrasemestral.js (variable GAS_URL)
// ═══════════════════════════════════════════════════════════════════

// ── CONFIGURACIÓN — solo cambia esto ────────────────────────────────
const SHEET_ID   = "PEGA_AQUI_EL_ID_DEL_GOOGLE_SHEETS"; // ID del Sheets de Subdirección
const SHEET_NAME = "CONCENTRADO SUBDIRECCIÓN";            // nombre exacto de la pestaña
// ────────────────────────────────────────────────────────────────────


function doGet(e) {
  // CORS: permite peticiones desde el sitio
  const output = _buildResponse(e);
  return output;
}

function _buildResponse(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = _findSheet(ss, SHEET_NAME);

    if (!sheet) {
      return _json({ status: "error", message: "Hoja no encontrada: " + SHEET_NAME });
    }

    const raw = sheet.getDataRange().getValues();

    // Detectar fila de encabezados buscando la celda que contenga
    // "NOMBRE" y "ALUMNO" en cualquier columna
    let headerRow = -1;
    let colMap    = {};

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i].map(c =>
        String(c).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
      );
      if (row.some(c => c.includes("NOMBRE") && c.includes("ALUMNO"))) {
        headerRow = i;
        row.forEach((col, idx) => {
          if      (col.includes("NOMBRE") && col.includes("ALUMNO")) colMap.nombre       = idx;
          else if (col === "GRUPO")                                   colMap.grupo        = idx;
          else if (col.includes("ASIGNATURA"))                        colMap.asignatura   = idx;
          else if (col.includes("DOCENTE"))                           colMap.docente      = idx;
          else if (col.includes("TIPO"))                              colMap.tipo         = idx;
          else if (col.includes("CALIFICACI"))                        colMap.calificacion = idx;
          else if (col.includes("VALIDA") || col.includes("OBSERV")) colMap.observacion  = idx;
        });
        break;
      }
    }

    if (headerRow === -1) {
      return _json({ status: "error", message: "No se encontró la fila de encabezados en la hoja." });
    }

    // Extraer registros fila por fila
    const registros = [];
    for (let i = headerRow + 1; i < raw.length; i++) {
      const row    = raw[i];
      const nombre = String(row[colMap.nombre] || "").trim();
      if (!nombre) continue; // fila vacía, saltar

      const calRaw = colMap.calificacion !== undefined ? row[colMap.calificacion] : "";
      const cal    = (calRaw !== "" && calRaw !== null && !isNaN(parseFloat(calRaw)))
        ? parseFloat(calRaw)
        : null;

      registros.push({
        nombre:      nombre,
        grupo:       colMap.grupo       !== undefined ? String(row[colMap.grupo]       || "").trim() : "",
        asignatura:  colMap.asignatura  !== undefined ? String(row[colMap.asignatura]  || "").trim() : "",
        docente:     colMap.docente     !== undefined ? String(row[colMap.docente]     || "").trim() : "",
        tipo:        colMap.tipo        !== undefined ? String(row[colMap.tipo]        || "").toUpperCase().trim() : "",
        calificacion: cal,
        observacion: colMap.observacion !== undefined ? String(row[colMap.observacion] || "").trim() : "",
      });
    }

    return _json({ status: "ok", total: registros.length, registros });

  } catch (err) {
    return _json({ status: "error", message: err.message });
  }
}

// Busca la hoja tolerando diferencias de acentos y mayúsculas
function _findSheet(ss, name) {
  const target = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  return ss.getSheets().find(s =>
    s.getName().normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim() === target
  ) || null;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
