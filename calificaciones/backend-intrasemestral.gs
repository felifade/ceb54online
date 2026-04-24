// ═══════════════════════════════════════════════════════════════════
//  CALIFICACIONES INTRASEMESTRALES — BACKEND INDEPENDIENTE
//  CEB 5/4 "Profr. Rafael Ramírez"
//
//  ESTRUCTURA DE LA HOJA (generada por actualizarConcentradoSubdireccion):
//    Fila 2   → Título "CONCENTRADO SUBDIRECCIÓN" (visual)
//    Fila 3   → Encabezados: CLAVE | No. | NOMBRE | GRUPO | ASIG | DOCENTE | TIPO | CALIFICACIÓN | VALIDA
//    Fila 4+  → Datos
//    Col A    → CLAVE (identificador único por registro)
//    Col H    → CALIFICACIÓN
//    Col I    → VALIDA / Observaciones
//
//  DESPLIEGUE:
//  Cada vez que modifiques este archivo: Deploy → Manage deployments → Edit → nueva versión.
// ═══════════════════════════════════════════════════════════════════

const SHEET_ID   = "17dSH2SL4S2iPYZFSlqVeEI-ESqvjIf_l5wdcWlpVLSE";
const SHEET_NAME = "CONCENTRADO SUBDIRECCION";

const FILA_ENCABEZADOS = 3;
const FILA_DATOS       = 4;

// ── Enrutador principal ─────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || "";
    if (action === "getCalifIntrasemestral") return _json(getCalif_());
    if (action === "guardarCalif")           return _json(guardarCalif_(e.parameter));
    return _json({ status: "error", message: "Acción no reconocida: " + action });
  } catch (err) {
    return _json({ status: "error", message: err.message });
  }
}

// ── Leer todos los registros ────────────────────────────────────────
function getCalif_() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = _findSheet(ss, SHEET_NAME);
  if (!sheet) return { status: "error", message: "Hoja no encontrada: " + SHEET_NAME };

  const raw = sheet.getDataRange().getValues();
  const headerIdx = FILA_ENCABEZADOS - 1;
  if (raw.length <= headerIdx) return { status: "error", message: "La hoja no tiene datos aún." };

  const headers = raw[headerIdx].map(c =>
    String(c).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
  );

  const col = {
    clave:       0, // Col A — siempre fija
    nombre:      headers.findIndex(h => h.includes("NOMBRE") && h.includes("ALUMNO")),
    grupo:       headers.findIndex(h => h === "GRUPO"),
    asignatura:  headers.findIndex(h => h.includes("ASIGNATURA")),
    docente:     headers.findIndex(h => h.includes("DOCENTE")),
    tipo:        headers.findIndex(h => h.includes("TIPO")),
    calificacion:headers.findIndex(h => h.includes("CALIFICACI")),
    observacion: headers.findIndex(h => h.includes("VALIDA") || h.includes("OBSERV")),
  };

  const registros = [];
  for (let i = FILA_DATOS - 1; i < raw.length; i++) {
    const row    = raw[i];
    const nombre = col.nombre > -1 ? String(row[col.nombre] || "").trim() : "";
    if (!nombre) continue;

    const calRaw = col.calificacion > -1 ? row[col.calificacion] : "";
    const cal    = (calRaw !== "" && calRaw !== null && !isNaN(parseFloat(calRaw)))
      ? parseFloat(calRaw) : null;

    registros.push({
      clave:       String(row[col.clave] || "").trim(),
      nombre:      nombre,
      grupo:       col.grupo      > -1 ? String(row[col.grupo]      || "").trim() : "",
      asignatura:  col.asignatura > -1 ? String(row[col.asignatura] || "").trim() : "",
      docente:     col.docente    > -1 ? String(row[col.docente]    || "").trim() : "",
      tipo:        col.tipo       > -1 ? String(row[col.tipo]       || "").toUpperCase().trim() : "",
      calificacion: cal,
      observacion: col.observacion > -1 ? String(row[col.observacion] || "").trim() : "",
    });
  }

  return { status: "ok", total: registros.length, registros };
}

// ── Guardar calificación de un registro ─────────────────────────────
function guardarCalif_(params) {
  const clave       = String(params.clave       || "").trim();
  const calStr      = String(params.calificacion || "").trim();
  const observacion = String(params.observacion  || "").trim();

  if (!clave) return { status: "error", message: "Falta la clave del registro." };

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = _findSheet(ss, SHEET_NAME);
  if (!sheet) return { status: "error", message: "Hoja no encontrada: " + SHEET_NAME };

  const lastRow = sheet.getLastRow();
  if (lastRow < FILA_DATOS) return { status: "error", message: "Sin datos en la hoja." };

  const claves = sheet.getRange(FILA_DATOS, 1, lastRow - FILA_DATOS + 1, 1).getValues();

  for (let i = 0; i < claves.length; i++) {
    if (String(claves[i][0]).trim() !== clave) continue;

    const fila   = FILA_DATOS + i;
    const calVal = calStr !== "" ? parseFloat(calStr) : "";
    sheet.getRange(fila, 8).setValue(calVal);      // col H = CALIFICACIÓN
    sheet.getRange(fila, 9).setValue(observacion); // col I = VALIDA / Observación
    SpreadsheetApp.flush();
    return { status: "ok", fila: fila };
  }

  return { status: "error", message: "Registro no encontrado." };
}

// ── Utilidades ──────────────────────────────────────────────────────
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
