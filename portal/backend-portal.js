/**
 * PORTAL ESTUDIANTIL CEB 5/4 — Google Apps Script Backend
 * Alumnos acceden con CURP · Padres con Folio
 * Despliega como aplicación web independiente del backend PEC
 *
 * Hojas requeridas en el mismo Google Sheets activo:
 *   Portal_Alumnos        → CURP | Nombre | Grupo | Semestre
 *   Portal_Padres         → Folio | Nombre_Padre | CURP_Hijo | Nombre_Hijo | Grupo_Hijo
 *   Enc_Alumnos           → (se crea automáticamente)
 *   Enc_Padres            → (se crea automáticamente)
 *   Configuracion         → compartida con el sistema PEC
 *   Evaluaciones          → compartida con el sistema PEC (calificaciones P2, P3)
 *   Calificaciones_Sabanas → generada por el procesador de sábanas (calificaciones completas)
 */

// ── CONSTANTES SÁBANAS ───────────────────────────────────────────────
const SH_CAL_SAB = 'Calificaciones_Sabanas';
const COLS_SAB   = [
  'ciclo','periodo','grupo','asignatura','docente','curp','nombre',
  'p1_portafolio','p1_examen','p1_pec','p1_c4','p1_total','p1_faltas',
  'p2_portafolio','p2_examen','p2_pec','p2_c4','p2_total','p2_faltas',
  'p3_portafolio','p3_examen','p3_pec','p3_c4','p3_total','p3_faltas',
  'global','archivo_origen','fecha_proceso'
];

// ── IDs HOJAS HISTÓRICAS P1 ─────────────────────────────────────────
const P_OLD_2S = "1MmAwYm2mfRBH3q-BGlKklwvsHE8iSYY5y1ac4mO07rQ";
const P_OLD_4S = "1aRY6lP8R5-myw61Epbffsc1WmzNDYo67N0ovGOWng7s";

// ── NOMBRES DE HOJAS ────────────────────────────────────────────────
const SH_MSG  = "Calendario_eventos";
const SH_CMP  = "Calendario_cumple";
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
    if (k === "parcial_activo")         cfg.parcial_activo         = String(v || "").trim();
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
      const materiasMap = {}; // acumula puntaje por materia
      rows.forEach(r => {
        const parc = String(r[1]).match(/\d+/);
        if (parc && parc[0] === p && norm(String(r[9])) === nombreNorm) {
          const pts = Number(r[7] || 0);
          total += pts;
          const mat = String(r[5] || "").trim();
          if (mat) {
            materiasMap[mat] = (materiasMap[mat] || 0) + pts;
          }
        }
      });
      if (total > 0) {
        result["p" + p] = Math.min(parseFloat(total.toFixed(2)), 2);
        result["p" + p + "_materias"] = Object.entries(materiasMap).map(function(entry) {
          return { nombre: entry[0], cal: parseFloat(entry[1].toFixed(2)) };
        });
      }
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════
function doGetPortal(e) {
  try {
    const ss  = SpreadsheetApp.getActiveSpreadsheet();
    const act = e.parameter.action || "";
    if (act === "loginAlumno")       return loginAlumno(e, ss);
    if (act === "loginPadre")        return loginPadre(e, ss);
    if (act === "getCalAlumno")      return getCalAlumno(e, ss);
    if (act === "getCalPadre")       return getCalPadre(e, ss);
    if (act === "getCalifSabanas")   return getCalifSabanasHandler(e, ss);
    if (act === "getMensajes")        return getMensajesHandler(e, ss);
    if (act === "getCumpleanosAdmin") return getCumpleanosAdminHandler(e, ss);
    if (act === "getConfig")         return ok({ status:"success", config: readConfig(ss) });
    if (act === "getEncuestaStatus")    return getEncuestaStatus(e, ss);
    if (act === "adminPortal")          return adminPortalGet(e, ss);
    if (act === "getPrefecturaBase")    return getPrefecturaBase(ss);
    if (act === "getIncidencias")       return getIncidencias(e, ss);
    if (act === "getCalendario")        return getCalendario(ss);
    if (e.parameter.action === "getPecCierre") {
      return doGetPecCierre(ss);
    }
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
function doPostPortal(e) {
  try {
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    const act  = body.action || "";
    if (act === "encuestaAlumno")    return saveEncAlumno(body, ss);
    if (act === "encuestaPadre")     return saveEncPadre(body, ss);
    if (act === "adminPortal")       return adminPortal(body, ss);
    if (act === "saveIncidencia")    return saveIncidencia(body, ss);
    if (act === "marcarLaborSocial") return marcarLaborSocial(body, ss);
    if (act === "saveMensaje")       return saveMensajeHandler(body, ss);
    if (act === "toggleMensaje")     return toggleMensajeHandler(body, ss);
    if (act === "deleteMensaje")     return deleteMensajeHandler(body, ss);
    if (act === "saveCumpleanos")    return saveCumpleanosHandler(body, ss);
    if (act === "toggleCumpleanos")  return toggleCumpleanosHandler(body, ss);
    if (act === "deleteCumpleanos")  return deleteCumpleanosHandler(body, ss);
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

// ── CALENDARIO: eventos y cumpleaños desde Sheets ───────────────────
// Hoja: Calendario_eventos (misma que SH_MSG)
// Columnas detectadas dinámicamente por header para evitar desajustes de posición
function getCalendario(ss) {
  const sEv  = getSheet(ss, SH_MSG);

  function fmtISO(val) {
    if (!val) return "";
    if (val instanceof Date && !isNaN(val))
      return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
    return String(val).trim();
  }

  const eventos = [];
  if (sEv && sEv.getLastRow() > 1) {
    const all = sEv.getDataRange().getValues();
    const hdr = all[0].map(h => norm(String(h)));
    const c = k => { const i = hdr.indexOf(norm(k)); return i >= 0 ? i : null; };
    const g = (r, k, def) => { const i = c(k); return i !== null ? r[i] : (def !== undefined ? def : ""); };
    all.slice(1).forEach(r => {
      const titulo = String(g(r, "titulo", "") || "").trim();
      if (!titulo) return;
      eventos.push({
        titulo:        titulo,
        tipo:          String(g(r, "tipo",          "evento") || "evento").trim().toLowerCase(),
        fecha_inicio:  fmtISO(g(r, "fecha_inicio",  "")),
        fecha_fin:     fmtISO(g(r, "fecha_fin",     "")),
        hora:          String(g(r, "hora",           "") || "").trim(),
        categoria:     String(g(r, "categoria",      "academico") || "academico").trim().toLowerCase(),
        descripcion:   String(g(r, "descripcion",    "") || "").trim(),
        prioridad:     String(g(r, "prioridad",      "") || "").trim().toLowerCase(),
        visible:       norm(String(g(r, "visible",   "SI") || "SI")) !== "no" ? "SI" : "NO",
        portal_alumno: norm(String(g(r, "portal_alumno", "NO") || "NO")) === "si" ? "SI" : "NO"
      });
    });
  }

  const cumpleanos = [];

  const sCmp = getSheet(ss, SH_CMP);
  if (sCmp && sCmp.getLastRow() > 1) {
    const rows = sCmp.getDataRange().getValues();
    const hdr  = rows[0].map(h => norm(String(h)));
    const ci   = k => { const i = hdr.indexOf(norm(k)); return i >= 0 ? i : -1; };
    rows.slice(1).forEach(r => {
      const nom = String(r[ci("nombre") >= 0 ? ci("nombre") : 0] || "").trim();
      if (!nom) return;
      const iVis = ci("visible");
      if (iVis >= 0 && norm(String(r[iVis])) === "no") return;
      cumpleanos.push({
        nombre: nom,
        fecha:  fmtISO(r[ci("fecha") >= 0 ? ci("fecha") : 1]),
        cargo:  String(r[ci("cargo") >= 0 ? ci("cargo") : 2] || "Docente").trim(),
        visible: "SI"
      });
    });
  }

  return ok({ status: "success", eventos, cumpleanos });
}

// ════════════════════════════════════════════════════════════════════════
//  CALIFICACIONES DE SÁBANAS — handler para el portal
//  action=getCalifSabanas&curp=CURP_DEL_ALUMNO
//  Retorna todas las materias con calificaciones completas (3 parciales + global)
// ════════════════════════════════════════════════════════════════════════
function getCalifSabanasHandler(e, ss) {
  const curp = String(e.parameter.curp || "").trim().toUpperCase();
  if (!curp) return err("Se requiere el parámetro curp.");

  const hoja = ss.getSheetByName(SH_CAL_SAB);
  if (!hoja || hoja.getLastRow() < 2)
    return ok({ status: "success", materias: [] });

  const curpIdx = COLS_SAB.indexOf("curp");
  const data    = hoja.getRange(2, 1, hoja.getLastRow() - 1, COLS_SAB.length).getValues();

  const materias = data
    .filter(r => String(r[curpIdx]).toUpperCase() === curp)
    .map(r => {
      const obj = {};
      COLS_SAB.forEach((col, i) => {
        // No exponer datos de auditoría al alumno
        if (col === "archivo_origen" || col === "fecha_proceso") return;
        obj[col] = r[i];
      });
      return obj;
    });

  return ok({ status: "success", materias });
}

// ════════════════════════════════════════════════════════════════════════
//  MENSAJES INSTITUCIONALES
//  Hoja: Calendario_eventos
//  Columnas reales: titulo | tipo | fecha_inicio | fecha_fin | hora |
//                  categoria | descripcion | visible | prioridad | portal_alumno
//  Mapeo frontend: categoria→destinatario, descripcion→contenido, visible→activo
//  id sintético: "ROW_N" (número de fila en la hoja, 1-based)
// ════════════════════════════════════════════════════════════════════════

const ADMIN_KEY  = "CEB54_ADMIN_PORTAL";

function getMensajesHandler(e, ss) {
  if (e.parameter.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const s = getSheet(ss, SH_MSG);
  if (!s || s.getLastRow() < 2) return ok({ status:"success", mensajes: [] });
  const all = s.getDataRange().getValues();
  const hdr = all[0].map(h => norm(String(h)));
  const fmtD = v => v instanceof Date
    ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : String(v ?? "").trim();
  const col = k => { const i = hdr.indexOf(norm(k)); return i >= 0 ? i : null; };
  const get = (r, k) => { const i = col(k); return i !== null ? fmtD(r[i]) : ""; };

  const mensajes = all.slice(1)
    .map((r, i) => ({
      id:            "ROW_" + (i + 2),
      titulo:        get(r, "titulo"),
      tipo:          get(r, "tipo"),
      fecha_inicio:  get(r, "fecha_inicio"),
      fecha_fin:     get(r, "fecha_fin"),
      destinatario:  get(r, "categoria"),
      contenido:     get(r, "descripcion"),
      activo:        norm(get(r, "visible")) !== "no",
      portal_alumno: norm(get(r, "portal_alumno")) === "si"
    }))
    .filter(m => m.titulo);
  return ok({ status:"success", mensajes });
}

function saveMensajeHandler(body, ss) {
  if (body.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const s = getSheet(ss, SH_MSG);
  if (!s) return err("Hoja no encontrada.");
  const id = String(body.id || "").trim();
  const all = s.getDataRange().getValues();
  const hdr = all[0].map(h => norm(String(h)));
  const visVal = (body.activo === false || body.activo === "false" || body.activo === "no") ? "NO" : "SI";
  const setCol = (row, key, val) => { const i = hdr.indexOf(norm(key)); if (i >= 0) row[i] = val; };

  if (id && id.startsWith("ROW_")) {
    const rowNum = parseInt(id.replace("ROW_", ""), 10);
    if (isNaN(rowNum) || rowNum < 2 || rowNum > all.length) return err("Mensaje no encontrado.");
    const row = [...all[rowNum - 1]];
    const portalVal = (body.portal_alumno === true || body.portal_alumno === "true" || body.portal_alumno === "si") ? "SI" : "NO";
    setCol(row, "titulo",        String(body.titulo       || "").trim());
    setCol(row, "tipo",          String(body.tipo         || "evento").trim());
    setCol(row, "fecha_inicio",  String(body.fecha_inicio || "").trim());
    setCol(row, "fecha_fin",     String(body.fecha_fin    || "").trim());
    setCol(row, "categoria",     String(body.destinatario || "").trim());
    setCol(row, "descripcion",   String(body.contenido    || "").trim());
    setCol(row, "visible",       visVal);
    setCol(row, "portal_alumno", portalVal);
    s.getRange(rowNum, 1, 1, row.length).setValues([row]);
    return ok({ status:"success", id });
  } else {
    const portalVal = (body.portal_alumno === true || body.portal_alumno === "true" || body.portal_alumno === "si") ? "SI" : "NO";
    const newRow = new Array(hdr.length).fill("");
    setCol(newRow, "titulo",        String(body.titulo       || "").trim());
    setCol(newRow, "tipo",          String(body.tipo         || "evento").trim());
    setCol(newRow, "fecha_inicio",  String(body.fecha_inicio || "").trim());
    setCol(newRow, "fecha_fin",     String(body.fecha_fin    || "").trim());
    setCol(newRow, "categoria",     String(body.destinatario || "").trim());
    setCol(newRow, "descripcion",   String(body.contenido    || "").trim());
    setCol(newRow, "visible",       visVal);
    setCol(newRow, "portal_alumno", portalVal);
    s.appendRow(newRow);
    return ok({ status:"success", id: "ROW_" + s.getLastRow() });
  }
}

function toggleMensajeHandler(body, ss) {
  if (body.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const id = String(body.id || "").trim();
  if (!id || !id.startsWith("ROW_")) return err("Se requiere id válido.");
  const rowNum = parseInt(id.replace("ROW_", ""), 10);
  if (isNaN(rowNum) || rowNum < 2) return err("ID inválido.");
  const s = getSheet(ss, SH_MSG);
  if (!s || rowNum > s.getLastRow()) return err("Mensaje no encontrado.");
  const all = s.getDataRange().getValues();
  const hdr = all[0].map(h => norm(String(h)));
  const iVis = hdr.indexOf(norm("visible"));
  const col = iVis >= 0 ? iVis : 7;
  const current = norm(String(all[rowNum - 1][col] ?? ""));
  const nuevo = current === "no" ? "SI" : "NO";
  s.getRange(rowNum, col + 1).setValue(nuevo);
  return ok({ status:"success", activo: nuevo !== "NO" });
}

function deleteMensajeHandler(body, ss) {
  if (body.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const id = String(body.id || "").trim();
  if (!id || !id.startsWith("ROW_")) return err("Se requiere id válido.");
  const rowNum = parseInt(id.replace("ROW_", ""), 10);
  if (isNaN(rowNum) || rowNum < 2) return err("ID inválido.");
  const s = getSheet(ss, SH_MSG);
  if (!s || rowNum > s.getLastRow()) return err("Mensaje no encontrado.");
  s.deleteRow(rowNum);
  return ok({ status:"success" });
}

// ════════════════════════════════════════════════════════════════════════
//  CUMPLEAÑOS
//  Hoja: Cumpleaños
//  Columnas: id | nombre | fecha | tipo | cargo | mostrar_portal | notas
// ════════════════════════════════════════════════════════════════════════

// Columnas reales de Calendario_cumple: nombre | fecha | cargo | visible
const HDR_CMP = ["nombre","fecha","cargo","visible"];

function getCumpleanosAdminHandler(e, ss) {
  if (e.parameter.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const s = ensureSheet(ss, SH_CMP, HDR_CMP);
  if (s.getLastRow() < 2) return ok({ status:"success", cumpleanos: [] });
  const all  = s.getDataRange().getValues();
  const hdr  = all[0].map(h => norm(String(h)));
  const ci   = k => { const i = hdr.indexOf(norm(k)); return i >= 0 ? i : -1; };
  const fmtD = v => v instanceof Date
    ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : String(v ?? "").trim();
  const cumpleanos = all.slice(1).map((r, i) => ({
    id:      "ROW_" + (i + 2),
    nombre:  String(r[ci("nombre") >= 0 ? ci("nombre") : 0] || "").trim(),
    fecha:   fmtD(r[ci("fecha")   >= 0 ? ci("fecha")   : 1]),
    cargo:   String(r[ci("cargo") >= 0 ? ci("cargo")   : 2] || "").trim(),
    visible: norm(String(r[ci("visible") >= 0 ? ci("visible") : 3] || "si")) !== "no"
  })).filter(r => r.nombre);
  return ok({ status:"success", cumpleanos });
}

function saveCumpleanosHandler(body, ss) {
  if (body.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const s = ensureSheet(ss, SH_CMP, HDR_CMP);
  const id = String(body.id || "").trim();
  const fmtDate = v => {
    if (!v) return "";
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
    return String(v).trim();
  };
  const row = [
    String(body.nombre  || "").trim(),
    fmtDate(body.fecha),
    String(body.cargo   || "Docente").trim(),
    body.visible === false || norm(String(body.visible)) === "no" ? "NO" : "SI"
  ];
  if (id.startsWith("ROW_")) {
    const rowNum = parseInt(id.replace("ROW_", ""), 10);
    if (isNaN(rowNum) || rowNum < 2) return err("ID inválido.");
    s.getRange(rowNum, 1, 1, HDR_CMP.length).setValues([row]);
  } else {
    s.appendRow(row);
  }
  return ok({ status:"success" });
}

function toggleCumpleanosHandler(body, ss) {
  if (body.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const id = String(body.id || "").trim();
  if (!id.startsWith("ROW_")) return err("Se requiere id.");
  const rowNum = parseInt(id.replace("ROW_", ""), 10);
  if (isNaN(rowNum) || rowNum < 2) return err("ID inválido.");
  const s = getSheet(ss, SH_CMP);
  if (!s) return err("Hoja no encontrada.");
  const hdr  = s.getDataRange().getValues()[0].map(h => norm(String(h)));
  const iVis = hdr.indexOf("visible");
  const col  = (iVis >= 0 ? iVis : 3) + 1;
  const current = norm(String(s.getRange(rowNum, col).getValue()));
  const nuevo   = current === "no" ? "SI" : "NO";
  s.getRange(rowNum, col).setValue(nuevo);
  return ok({ status:"success", visible: nuevo });
}

function deleteCumpleanosHandler(body, ss) {
  if (body.adminKey !== ADMIN_KEY) return err("No autorizado.");
  const id = String(body.id || "").trim();
  if (!id.startsWith("ROW_")) return err("Se requiere id.");
  const rowNum = parseInt(id.replace("ROW_", ""), 10);
  if (isNaN(rowNum) || rowNum < 2) return err("ID inválido.");
  const s = getSheet(ss, SH_CMP);
  if (!s) return err("Hoja no encontrada.");
  s.deleteRow(rowNum);
  return ok({ status:"success" });
}
