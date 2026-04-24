// ═══════════════════════════════════════════════════════════════════
//  CALIFICACIONES INTRASEMESTRALES — BACKEND INDEPENDIENTE
//  CEB 5/4 "Profr. Rafael Ramírez"
//
//  Este es un proyecto GAS NUEVO y separado. No toca nada del PEC
//  ni de otros módulos.  Solo lee la hoja "CONCENTRADO SUBDIRECCION"
//  del Sheets de Subdirección y la expone como JSON para la página web.
//
//  ESTRUCTURA DE LA HOJA (generada por actualizarConcentradoSubdireccion):
//    Fila 2   → Título "CONCENTRADO SUBDIRECCIÓN" (visual)
//    Fila 3   → Encabezados: CLAVE | No. | NOMBRE | GRUPO | ASIG | DOCENTE | TIPO
//    Fila 4+  → Datos
//    Col A    → CLAVE (oculta, interna)
//    Col H    → CALIFICACIÓN  (la agrega subdirección manualmente)
//    Col I    → VALIDA / Observaciones (la agrega subdirección manualmente)
//
//  PASOS PARA DESPLEGAR:
//  1. Ve a https://script.google.com → Nuevo proyecto
//     Nombre sugerido: "API Calificaciones Intrasemestrales CEB54"
//  2. Borra el código de ejemplo y pega este archivo completo
//  3. En CONFIGURACIÓN pon el ID del Sheets de Subdirección
//     (está en la URL: /spreadsheets/d/<<ESTE_ID>>/edit)
//  4. Deploy → New deployment → Web app
//       · Execute as: Me
//       · Who has access: Anyone
//  5. Copia la URL y pégala en intrasemestral.js  (variable GAS_URL)
// ═══════════════════════════════════════════════════════════════════

// ── CONFIGURACIÓN — solo cambia esto ────────────────────────────────
const SHEET_ID   = "17dSH2SL4S2iPYZFSlqVeEI-ESqvjIf_l5wdcWlpVLSE";
const SHEET_NAME = "CONCENTRADO SUBDIRECCION"; // sin acento, así lo crea el script
// ────────────────────────────────────────────────────────────────────

// Fila donde están los encabezados (1-based, según el script de subdirección)
const FILA_ENCABEZADOS = 3;
// Fila donde empiezan los datos
const FILA_DATOS = 4;


function doGet(e) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = _findSheet(ss, SHEET_NAME);

    if (!sheet) {
      return _json({ status: "error", message: "Hoja no encontrada: " + SHEET_NAME });
    }

    const raw = sheet.getDataRange().getValues();

    // ── Leer encabezados de la fila 3 (índice 2) ────────────────────
    const headerIdx = FILA_ENCABEZADOS - 1;
    if (raw.length <= headerIdx) {
      return _json({ status: "error", message: "La hoja no tiene datos aún." });
    }

    const headers = raw[headerIdx].map(c =>
      String(c).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
    );

    // Mapear columnas por su nombre (robusto ante cambios de orden)
    const col = {
      nombre:      headers.indexOf("NOMBRE DEL ALUMNO(A)") > -1
                     ? headers.indexOf("NOMBRE DEL ALUMNO(A)")
                     : headers.findIndex(h => h.includes("NOMBRE") && h.includes("ALUMNO")),
      grupo:       headers.findIndex(h => h === "GRUPO"),
      asignatura:  headers.findIndex(h => h.includes("ASIGNATURA")),
      docente:     headers.findIndex(h => h.includes("DOCENTE")),
      tipo:        headers.findIndex(h => h.includes("TIPO")),
      calificacion:headers.findIndex(h => h.includes("CALIFICACI")),
      observacion: headers.findIndex(h => h.includes("VALIDA") || h.includes("OBSERV")),
    };

    // ── Extraer registros desde la fila de datos ─────────────────────
    const registros = [];
    for (let i = FILA_DATOS - 1; i < raw.length; i++) {
      const row    = raw[i];
      const nombre = col.nombre > -1 ? String(row[col.nombre] || "").trim() : "";
      if (!nombre) continue;

      const calRaw = col.calificacion > -1 ? row[col.calificacion] : "";
      const cal    = (calRaw !== "" && calRaw !== null && !isNaN(parseFloat(calRaw)))
        ? parseFloat(calRaw)
        : null;

      registros.push({
        nombre:      nombre,
        grupo:       col.grupo       > -1 ? String(row[col.grupo]       || "").trim() : "",
        asignatura:  col.asignatura  > -1 ? String(row[col.asignatura]  || "").trim() : "",
        docente:     col.docente     > -1 ? String(row[col.docente]     || "").trim() : "",
        tipo:        col.tipo        > -1 ? String(row[col.tipo]        || "").toUpperCase().trim() : "",
        calificacion: cal,
        observacion: col.observacion > -1 ? String(row[col.observacion] || "").trim() : "",
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
