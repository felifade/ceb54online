/**
 * PREFECTURA — Funciones GAS (Prefectura.gs)
 * Hoja exclusiva: "Prefectura_Incidencias"
 *
 * CÓMO USAR:
 * 1. Este archivo va en el proyecto "PEC Sistemas" (el mismo que Portal Estudiantil CEB.gs)
 * 2. NO tiene doGet/doPost propios — usa el dispatcher de Portal Estudiantil CEB.gs
 * 3. La URL es la misma del Portal:
 *    https://script.google.com/macros/s/AKfycbwqT7gO.../exec
 * 4. Después de pegar este código → Implementar → Administrar → Nueva versión → Guardar
 *
 * COLUMNAS DE LA HOJA "Prefectura_Incidencias":
 * A: id  B: fecha_registro  C: semana  D: grupo  E: nombre_alumno
 * F: tipo_incidencia  G: descripcion  H: observaciones
 * I: total_incidencias  J: requiere_labor_social  K: labor_social_realizada
 * L: fecha_labor_social  M: registrado_por
 */

const S_INCIDENCIAS = "Prefectura_Incidencias";
const UMBRAL_LABOR  = 3;

// ── GET: datos base (alumnos desde Portal_Alumnos) ──────────────────────────
// Columnas Portal_Alumnos: CURP | Nombre | Grupo | Semestre
function getPrefecturaBase(ss) {
  const hoja = ss.getSheetByName("Portal_Alumnos");
  if (!hoja) return ok({ status: "success", directorio: [], grupos: [] });

  const rows = hoja.getDataRange().getValues();
  rows.shift(); // quitar encabezado

  const directorio = rows
    .filter(r => r[1]) // nombre no vacío (columna B)
    .map(r => ({
      nombre: String(r[1] || "").trim(),
      grupo:  String(r[2] || "").trim(),
      email:  String(r[0] || "").trim()  // CURP en lugar de email
    }));

  const grupos = [...new Set(directorio.map(a => a.grupo).filter(Boolean))].sort();

  return ok({ status: "success", directorio, grupos });
}

// ── GET: consultar incidencias con filtros ───────────────────────────────────
function getIncidencias(e, ss) {
  const hoja = _getOrCreateHoja(ss);
  const rows = hoja.getDataRange().getValues();
  if (rows.length <= 1) return ok({ status: "success", incidencias: [] });
  rows.shift(); // encabezado

  const fGrupo  = (e.parameter.grupo  || "").toLowerCase().trim();
  const fAlumno = (e.parameter.alumno || "").toLowerCase().trim();
  const fSemana = e.parameter.semana ? parseInt(e.parameter.semana) : null;
  const fTipo   = (e.parameter.tipo   || "").toLowerCase().trim();

  const incidencias = rows
    .filter(r => r[0]) // id no vacío
    .map(r => ({
      id:                    String(r[0]  || ""),
      fecha_registro:        _fmtDate(r[1]),
      semana:                parseInt(r[2])  || 0,
      grupo:                 String(r[3]  || ""),
      nombre_alumno:         String(r[4]  || ""),
      tipo_incidencia:       String(r[5]  || ""),
      descripcion:           String(r[6]  || ""),
      observaciones:         String(r[7]  || ""),
      total_incidencias:     parseInt(r[8]) || 1,
      requiere_labor_social: r[9] === true || r[9] === "Sí" || r[9] === "SI",
      labor_social_realizada:r[10] === true || r[10] === "Sí" || r[10] === "SI",
      fecha_labor_social:    _fmtDate(r[11]),
      registrado_por:        String(r[12] || "")
    }))
    .filter(i => {
      if (fGrupo  && !i.grupo.toLowerCase().includes(fGrupo))          return false;
      if (fAlumno && !i.nombre_alumno.toLowerCase().includes(fAlumno)) return false;
      if (fSemana && i.semana !== fSemana)                             return false;
      if (fTipo   && i.tipo_incidencia.toLowerCase() !== fTipo)        return false;
      return true;
    });

  return ok({ status: "success", incidencias });
}

// ── POST: guardar nueva incidencia ───────────────────────────────────────────
function saveIncidencia(p, ss) {
  if (!p.nombre_alumno) return ok({ status: "error", message: "Falta nombre_alumno." });
  if (!p.tipo_incidencia) return ok({ status: "error", message: "Falta tipo_incidencia." });

  const hoja = _getOrCreateHoja(ss);

  // Contar incidencias previas del alumno
  const todas = hoja.getDataRange().getValues();
  const previas = todas.slice(1).filter(r =>
    String(r[4] || "").toLowerCase() === p.nombre_alumno.toLowerCase()
  );
  const totalNuevo = previas.length + 1;
  const requiereLaborSocial = totalNuevo >= UMBRAL_LABOR;

  const id  = "INC-" + Date.now();
  const now = new Date();

  hoja.appendRow([
    id,
    now,
    p.semana || 0,
    p.grupo || "",
    p.nombre_alumno,
    p.tipo_incidencia,
    p.descripcion || "",
    p.observaciones || "",
    totalNuevo,
    requiereLaborSocial ? "Sí" : "No",
    "No",       // labor_social_realizada
    "",         // fecha_labor_social
    p.registrado_por || ""
  ]);

  // Si llegó al umbral, actualizar todos los registros previos del alumno también
  if (requiereLaborSocial) {
    _actualizarLaborSocialAlumno(hoja, p.nombre_alumno, totalNuevo);
  }

  return ok({
    status: "success",
    id,
    total: totalNuevo,
    requiereLaborSocial
  });
}

// ── POST: marcar labor social realizada ──────────────────────────────────────
function marcarLaborSocial(p, ss) {
  if (!p.rowId) return ok({ status: "error", message: "Falta rowId." });

  const hoja  = _getOrCreateHoja(ss);
  const rows  = hoja.getDataRange().getValues();
  const fecha = p.fecha_labor_social || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Buscar por id (columna A)
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(p.rowId)) {
      const fila = i + 1;
      hoja.getRange(fila, 11).setValue("Sí");   // labor_social_realizada
      hoja.getRange(fila, 12).setValue(fecha);  // fecha_labor_social
      return ok({ status: "success", fila });
    }
  }
  return ok({ status: "error", message: "Registro no encontrado con id: " + p.rowId });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Obtiene o crea la hoja de incidencias con encabezados
function _getOrCreateHoja(ss) {
  let hoja = ss.getSheetByName(S_INCIDENCIAS);
  if (!hoja) {
    hoja = ss.insertSheet(S_INCIDENCIAS);
    hoja.appendRow([
      "id", "fecha_registro", "semana", "grupo", "nombre_alumno",
      "tipo_incidencia", "descripcion", "observaciones",
      "total_incidencias", "requiere_labor_social",
      "labor_social_realizada", "fecha_labor_social", "registrado_por"
    ]);
    // Formato de encabezado
    hoja.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#fef2f2");
    hoja.setFrozenRows(1);
  }
  return hoja;
}

// Actualiza total_incidencias y requiere_labor_social en TODOS los registros del alumno
function _actualizarLaborSocialAlumno(hoja, nombreAlumno, totalActual) {
  const rows = hoja.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4] || "").toLowerCase() === nombreAlumno.toLowerCase()) {
      hoja.getRange(i + 1, 9).setValue(totalActual);   // total_incidencias
      hoja.getRange(i + 1, 10).setValue("Sí");          // requiere_labor_social
    }
  }
}

function _fmtDate(val) {
  if (!val) return "";
  if (val instanceof Date && !isNaN(val)) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return String(val);
}
