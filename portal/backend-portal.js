/**
 * PORTAL ESTUDIANTIL CEB 5/4 — Google Apps Script Backend
 * Alumnos acceden con CURP · Padres con Folio
 * Despliega como aplicación web independiente del backend PEC
 *
 * Hojas requeridas en el mismo Google Sheets activo:
 *   Portal_Alumnos   → CURP | Nombre | Grupo | Semestre
 *   Portal_Padres    → Folio | Nombre_Padre | CURP_Hijo | Nombre_Hijo | Grupo_Hijo
 *   Enc_Alumnos      → (se crea automáticamente)
 *   Enc_Padres       → (se crea automáticamente)
 *   Configuracion    → compartida con el sistema PEC
 *   Evaluaciones     → compartida con el sistema PEC (calificaciones P2, P3)
 */

// ── IDs HOJAS HISTÓRICAS P1 ─────────────────────────────────────────
const P_OLD_2S = "1MmAwYm2mfRBH3q-BGlKklwvsHE8iSYY5y1ac4mO07rQ";
const P_OLD_4S = "1aRY6lP8R5-myw61Epbffsc1WmzNDYo67N0ovGOWng7s";

// ── NOMBRES DE HOJAS ────────────────────────────────────────────────
const SH_ALU  = "Portal_Alumnos";
const SH_PAD  = "Portal_Padres";
const SH_EA   = "Enc_Alumnos";
const SH_EP   = "Enc_Padres";
const SH_CONF = "Configuracion";
const SH_EVAL = "Evaluaciones";

// ── UTILIDADES ──────────────────────────────────────────────────────
function norm(val) {
  if (!val) return "";
  return String(val).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function ok(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ok({ status: "error", message: msg });
}

function getSheet(ss, name) {
  return ss.getSheets().find(s => norm(s.getName()) === norm(name)) || null;
}

function ensureSheet(ss, name, headers) {
  let s = getSheet(ss, name);
  if (!s) { s = ss.insertSheet(name); s.appendRow(headers); }
  return s;
}

// ── LEER CONFIGURACIÓN ──────────────────────────────────────────────
function readConfig(ss) {
  const cfg = {
    portal_p1_activa: false, portal_p2_activa: false, portal_p3_activa: false,
    portal_enc_abierta: true,
    portal_fecha_captura: "", portal_fecha_aclaracion: "", portal_fecha_cierre: "",
    directivo_director: "", directivo_subdirector: "", directivo_plantel: "CEB 5/4",
    eval_docentes_activa: false,
    eval_pec_activa:      false,
    eval_padres_activa:   false,
  };
  const s = getSheet(ss, SH_CONF);
  if (!s) return cfg;
  s.getDataRange().getValues().forEach(r => {
    if (!r[0]) return;
    const k = norm(String(r[0]));
    const v = r[1];
    if (k === "portal_p1_activa")       cfg.portal_p1_activa       = norm(String(v)) === "si";
    if (k === "portal_p2_activa")       cfg.portal_p2_activa       = norm(String(v)) === "si";
    if (k === "portal_p3_activa")       cfg.portal_p3_activa       = norm(String(v)) === "si";
    if (k === "portal_enc_abierta")     cfg.portal_enc_abierta     = norm(String(v)) !== "no";
    if (k === "portal_fecha_captura")   cfg.portal_fecha_captura   = String(v || "").trim();
    if (k === "portal_fecha_aclaracion")cfg.portal_fecha_aclaracion= String(v || "").trim();
    if (k === "portal_fecha_cierre")    cfg.portal_fecha_cierre    = String(v || "").trim();
    if (k === "directivo_director")     cfg.directivo_director     = String(v || "").trim();
    if (k === "directivo_subdirector")  cfg.directivo_subdirector  = String(v || "").trim();
    if (k === "directivo_plantel")      cfg.directivo_plantel      = String(v || "").trim();
    if (k === "eval_docentes_activa")   cfg.eval_docentes_activa   = norm(String(v)) === "si";
    if (k === "eval_pec_activa")        cfg.eval_pec_activa        = norm(String(v)) === "si";
    if (k === "eval_padres_activa")     cfg.eval_padres_activa     = norm(String(v)) === "si";
  });
  return cfg;
}

// ── LEER CALIFICACIONES PEC DE UN ALUMNO ────────────────────────────
function readCalifAlumno(ss, nombre, config) {
  const result = { p1: null, p2: null, p3: null };
  const nombreNorm = norm(nombre);

  // P1: hojas históricas
  if (config.portal_p1_activa) {
    [P_OLD_2S, P_OLD_4S].forEach(id => {
      if (result.p1 !== null) return;
      try {
        const oldSS = SpreadsheetApp.openById(id);
        oldSS.getSheets().forEach(sheet => {
          if (result.p1 !== null) return;
          const data = sheet.getDataRange().getValues();
          let hRow = -1, nCol = 1, cCol = 6;
          for (let i = 0; i < Math.min(6, data.length); i++) {
            data[i].forEach((c, j) => {
              const cv = String(c).toUpperCase().trim();
              if (cv === "NOMBRE") { hRow = i; nCol = j; }
              if (cv.includes("PRIMER PARCIAL")) { hRow = i; cCol = j; }
            });
            if (hRow === i) break;
          }
          if (hRow < 0) return;
          for (let i = hRow + 1; i < data.length; i++) {
            if (norm(String(data[i][nCol])) === nombreNorm) {
              result.p1 = Math.min(parseFloat(Number(data[i][cCol]).toFixed(2)), 2);
              break;
            }
          }
        });
      } catch(e) { Logger.log("P1 error: " + e); }
    });
  }

  // P2 y P3: hoja Evaluaciones
  const sEv = getSheet(ss, SH_EVAL);
  if (sEv) {
    const rows = sEv.getDataRange().getValues(); rows.shift();
    ["2","3"].forEach(p => {
      if (!config["portal_p" + p + "_activa"]) return;
      let total = 0;
      rows.forEach(r => {
        const parc = String(r[1]).match(/\d+/);
        if (parc && parc[0] === p && norm(String(r[9])) === nombreNorm) {
          total += Number(r[7] || 0);
        }
      });
      if (total > 0) result["p" + p] = Math.min(parseFloat(total.toFixed(2)), 2);
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const ss  = SpreadsheetApp.getActiveSpreadsheet();
    const act = e.parameter.action || "";
    if (act === "loginAlumno")       return loginAlumno(e, ss);
    if (act === "loginPadre")        return loginPadre(e, ss);
    if (act === "getCalAlumno")      return getCalAlumno(e, ss);
    if (act === "getCalPadre")       return getCalPadre(e, ss);
    if (act === "getConfig")         return ok({ status:"success", config: readConfig(ss) });
    if (act === "getEncuestaStatus") return getEncuestaStatus(e, ss);
    if (act === "adminPortal")       return adminPortalGet(e, ss);
    return err("Acción no válida");
  } catch(ex) { return err(ex.toString()); }
}

// ── LOGIN ALUMNO ────────────────────────────────────────────────────
function loginAlumno(e, ss) {
  const curp = String(e.parameter.curp || "").trim().toUpperCase();
  if (curp.length < 10) return err("CURP inválido. Verifica el formato.");
  const s = getSheet(ss, SH_ALU);
  if (!s) return err("El portal no está configurado. Contacta a la administración.");
  const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === curp);
  if (!row) return err("CURP no registrado. Verifica o contacta a Control Escolar.");
  return ok({ status:"success", tipo:"alumno",
    curp: String(row[0]).trim(), nombre: String(row[1]).trim(),
    grupo: String(row[2]).trim(), semestre: String(row[3] || "").trim() });
}

// ── LOGIN PADRE ─────────────────────────────────────────────────────
function loginPadre(e, ss) {
  const folio = String(e.parameter.folio || "").trim().toUpperCase();
  if (folio.length < 3) return err("Folio inválido.");
  const s = getSheet(ss, SH_PAD);
  if (!s) return err("El portal no está configurado. Contacta a la administración.");
  const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === folio);
  if (!row) return err("Folio no encontrado. Verifica o solicítalo en Control Escolar.");
  return ok({ status:"success", tipo:"padre",
    folio: String(row[0]).trim(), nombre: String(row[1]).trim(),
    curpHijo: String(row[2]).trim(), nombreHijo: String(row[3]).trim(),
    grupoHijo: String(row[4] || "").trim() });
}

// ── CALIFICACIONES ALUMNO ───────────────────────────────────────────
function getCalAlumno(e, ss) {
  const curp = String(e.parameter.curp || "").trim().toUpperCase();
  if (!curp) return err("CURP requerido");
  const s = getSheet(ss, SH_ALU);
  if (!s) return err("Sistema no configurado");
  const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === curp);
  if (!row) return err("Acceso no autorizado");
  const config = readConfig(ss);
  const calificaciones = readCalifAlumno(ss, String(row[1]).trim(), config);
  return ok({ status:"success",
    alumno: { curp, nombre: String(row[1]).trim(), grupo: String(row[2]).trim() },
    calificaciones, config });
}

// ── CALIFICACIONES PADRE ────────────────────────────────────────────
function getCalPadre(e, ss) {
  const folio = String(e.parameter.folio || "").trim().toUpperCase();
  if (!folio) return err("Folio requerido");
  const s = getSheet(ss, SH_PAD);
  if (!s) return err("Sistema no configurado");
  const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === folio);
  if (!row) return err("Acceso no autorizado");
  const config = readConfig(ss);
  const nombreHijo = String(row[3]).trim();
  const calificaciones = readCalifAlumno(ss, nombreHijo, config);
  return ok({ status:"success",
    padre:  { folio, nombre: String(row[1]).trim() },
    hijo:   { nombre: nombreHijo, grupo: String(row[4] || "").trim(), curp: String(row[2]).trim() },
    directivos: { director: config.directivo_director, subdirector: config.directivo_subdirector, plantel: config.directivo_plantel },
    calificaciones, config });
}

// ── ESTADO DE ENCUESTA ──────────────────────────────────────────────
function getEncuestaStatus(e, ss) {
  const id   = String(e.parameter.id   || "").trim().toUpperCase();
  const tipo = String(e.parameter.tipo || "alumno");
  const sEnc = getSheet(ss, tipo === "padre" ? SH_EP : SH_EA);
  if (!sEnc) return ok({ status:"success", respondido: false });
  const respondido = sEnc.getDataRange().getValues().some(r => String(r[1]).trim().toUpperCase() === id);
  return ok({ status:"success", respondido });
}

// ═══════════════════════════════════════════════════════════════════
// POST
// ═══════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    const act  = body.action || "";
    if (act === "encuestaAlumno")   return saveEncAlumno(body, ss);
    if (act === "encuestaPadre")    return saveEncPadre(body, ss);
    if (act === "adminPortal")      return adminPortal(body, ss);
    return err("Acción no válida");
  } catch(ex) { return err(ex.toString()); }
}

// ── GUARDAR ENCUESTA ALUMNO ─────────────────────────────────────────
function saveEncAlumno(body, ss) {
  const curp = String(body.curp || "").trim().toUpperCase();
  if (!curp) return err("CURP requerido");

  // Verificar que la encuesta está abierta
  const config = readConfig(ss);
  if (!config.portal_enc_abierta) return err("El período de evaluación ha cerrado.");

  // Verificar que el alumno existe
  const sAlu = getSheet(ss, SH_ALU);
  if (!sAlu) return err("Sistema no configurado");
  const alumno = sAlu.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === curp);
  if (!alumno) return err("Acceso no autorizado");

  // Anti-duplicado
  const sEnc = ensureSheet(ss, SH_EA, [
    "Fecha","CURP","Nombre","Grupo",
    "Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9","Q10","Comentarios"
  ]);
  if (sEnc.getDataRange().getValues().some(r => String(r[1]).trim().toUpperCase() === curp))
    return err("Ya enviaste tu evaluación. No puedes modificarla.");

  const q = body.respuestas || {};
  sEnc.appendRow([
    new Date(), curp, alumno[1], body.grupo||alumno[2]||"",
    q.q1||"",q.q2||"",q.q3||"",q.q4||"",q.q5||"",
    q.q6||"",q.q7||"",q.q8||"",q.q9||"",q.q10||"",
    q.comentarios||""
  ]);
  return ok({ status:"success" });
}

// ── GUARDAR ENCUESTA PADRE ──────────────────────────────────────────
function saveEncPadre(body, ss) {
  const folio = String(body.folio || "").trim().toUpperCase();
  if (!folio) return err("Folio requerido");

  const config = readConfig(ss);
  if (!config.portal_enc_abierta) return err("El período de evaluación ha cerrado.");

  const sPad = getSheet(ss, SH_PAD);
  if (!sPad) return err("Sistema no configurado");
  const padre = sPad.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === folio);
  if (!padre) return err("Acceso no autorizado");

  const sEnc = ensureSheet(ss, SH_EP, [
    "Fecha","Folio","Nombre_Padre","Nombre_Hijo","Grupo",
    "E1","E2","E3","E4","E5",        // Escuela/Institución
    "D1","D2","D3","D4",              // Director
    "S1","S2","S3","S4",              // Subdirector
    "Cal_General","Comentarios","Sugerencias"
  ]);
  if (sEnc.getDataRange().getValues().some(r => String(r[1]).trim().toUpperCase() === folio))
    return err("Ya enviaste tu evaluación. No puedes modificarla.");

  const q = body.respuestas || {};
  sEnc.appendRow([
    new Date(), folio, padre[1], padre[3], padre[4],
    q.e1||"",q.e2||"",q.e3||"",q.e4||"",q.e5||"",
    q.d1||"",q.d2||"",q.d3||"",q.d4||"",
    q.s1||"",q.s2||"",q.s3||"",q.s4||"",
    q.cal_general||"",q.comentarios||"",q.sugerencias||""
  ]);
  return ok({ status:"success" });
}

// ── ADMIN VÍA GET (toggles desde acceso.html) ──────────────────────
function adminPortalGet(e, ss) {
  if (e.parameter.adminKey !== "CEB54_ADMIN_PORTAL") return err("No autorizado");
  const sConf = getSheet(ss, SH_CONF) || ss.insertSheet(SH_CONF);
  const updates = {};
  const p = e.parameter;
  if (p.eval_docentes !== undefined) updates["eval_docentes_activa"] = p.eval_docentes;
  if (p.eval_pec      !== undefined) updates["eval_pec_activa"]      = p.eval_pec;
  if (p.eval_padres   !== undefined) updates["eval_padres_activa"]   = p.eval_padres;
  const rows = sConf.getDataRange().getValues();
  Object.entries(updates).forEach(([key, val]) => {
    const idx = rows.findIndex(r => norm(String(r[0])) === key);
    if (idx >= 0) sConf.getRange(idx + 1, 2).setValue(val);
    else          sConf.appendRow([key, val]);
  });
  return ok({ status:"success" });
}

// ── ADMIN: FECHAS Y CONFIGURACIÓN DEL PORTAL ───────────────────────
function adminPortal(body, ss) {
  // Protección básica por clave
  if (body.adminKey !== "CEB54_ADMIN_PORTAL") return err("No autorizado");
  const sConf = getSheet(ss, SH_CONF) || ss.insertSheet(SH_CONF);
  const updates = {};
  if (body.fecha_captura   !== undefined) updates["portal_fecha_captura"]    = body.fecha_captura;
  if (body.fecha_aclaracion!== undefined) updates["portal_fecha_aclaracion"] = body.fecha_aclaracion;
  if (body.fecha_cierre    !== undefined) updates["portal_fecha_cierre"]      = body.fecha_cierre;
  if (body.enc_abierta     !== undefined) updates["portal_enc_abierta"]      = body.enc_abierta ? "si":"no";
  if (body.p1_activa       !== undefined) updates["portal_p1_activa"]        = body.p1_activa ? "si":"no";
  if (body.p2_activa       !== undefined) updates["portal_p2_activa"]        = body.p2_activa ? "si":"no";
  if (body.p3_activa       !== undefined) updates["portal_p3_activa"]        = body.p3_activa ? "si":"no";
  if (body.director        !== undefined) updates["directivo_director"]       = body.director;
  if (body.subdirector     !== undefined) updates["directivo_subdirector"]    = body.subdirector;
  if (body.eval_docentes   !== undefined) updates["eval_docentes_activa"]     = body.eval_docentes ? "si":"no";
  if (body.eval_pec        !== undefined) updates["eval_pec_activa"]          = body.eval_pec      ? "si":"no";
  if (body.eval_padres     !== undefined) updates["eval_padres_activa"]       = body.eval_padres   ? "si":"no";

  const rows = sConf.getDataRange().getValues();
  Object.entries(updates).forEach(([key, val]) => {
    const idx = rows.findIndex(r => norm(String(r[0])) === key);
    if (idx >= 0) sConf.getRange(idx + 1, 2).setValue(val);
    else          sConf.appendRow([key, val]);
  });
  return ok({ status:"success" });
}
