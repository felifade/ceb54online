/**
 * BACKEND SISTEMA INTEGRADO (CEB 5/4)
 * UNIFICACIÓN: Portal PEC Profesores + Portal Estudiantil Alumnos/Padres
 * 
 * Este script permite que una única URL de Web App maneje ambos portales.
 * Instrucciones: Copia TODO este código y pégalo en tu proyecto de Google Apps Script.
 */

// ── CONFIGURACIÓN DE HOJAS (PEC) ──────────────────────────────────────────
const S_ALUMNOS = "Alumnos";
const S_EVALUACIONES = "Evaluaciones";
const S_DIRECTORIO = "Directorio";
const S_PROGRAMACION = "Programación";
const S_TUTORIAS = "Tutorias";
const S_CONFIGURACION = "Configuracion";
const S_USUARIOS = "Usuarios";
const S_FEEDBACK = "Retroalimentacion"; 
const S_BITACORA = "PEC_Bitacora";

// ── CONFIGURACIÓN DE HOJAS (PORTAL ESTUDIANTIL) ───────────────────────────
const SH_ALU  = "Portal_Alumnos";
const SH_PAD  = "Portal_Padres";
const SH_EA   = "Enc_Alumnos";
const SH_EP   = "Enc_Padres";
const SH_CONF = "Configuracion"; // Compartida
const SH_EVAL = "Evaluaciones";  // Compartida

// ── IDs HOJAS HISTÓRICAS P1 (COMPARTIDO) ──────────────────────────────────
const OLD_GRADES_SHEET_ID    = "1MmAwYm2mfRBH3q-BGlKklwvsHE8iSYY5y1ac4mO07rQ"; 
const OLD_GRADES_SHEET_ID_4S = "1aRY6lP8R5-myw61Epbffsc1WmzNDYo67N0ovGOWng7s"; 

// ── UTILIDADES DE NORMALIZACIÓN ───────────────────────────────────────────
function normalizeText(val) {
  if (!val) return "";
  return String(val).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeParcial(val) {
  if (!val) return "";
  const match = String(val).match(/\d+/);
  return match ? match[0] : String(val).trim();
}

// Alias para compatibilidad con código del Portal
function norm(val) { return normalizeText(val); }

function getSheet(ss, name) {
  const sheets = ss.getSheets();
  const target = normalizeText(name);
  return sheets.find(s => normalizeText(s.getName()) === target) || null;
}

function ensureSheet(ss, name, headers) {
  let s = getSheet(ss, name);
  if (!s) { s = ss.insertSheet(name); s.appendRow(headers); }
  return s;
}

function ok(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ok({ status: "error", message: msg });
}

// ═══════════════════════════════════════════════════════════════════════════
// MÉTODO GET: DESPACHADOR DE RUTAS
// ═══════════════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e.parameter.action || "";

    // --- RUTAS PORTAL ESTUDIANTIL ---
    if (action === "loginAlumno")       return loginAlumno(e, ss);
    if (action === "loginPadre")        return loginPadre(e, ss);
    if (action === "getCalAlumno")      return getCalAlumno(e, ss);
    if (action === "getCalPadre")       return getCalPadre(e, ss);
    if (action === "getConfig")         return ok({ status:"success", config: readConfigPortal(ss) });
    if (action === "getEncuestaStatus") return getEncuestaStatus(e, ss);
    if (action === "adminPortal")       return adminPortalGet(e, ss);

    // --- RUTAS PORTAL PEC (PROFESORES) ---
    if (action === "getCalificaciones") return doGetCalificaciones(e, ss);
    if (action === "getEdicion")        return getEdicionData(e, ss);
    if (action === "getBitacora")       return getBitacoraData(e, ss);

    // --- DEFAULT: DASHBOARD PEC ---
    return doGetDashboardPEC(e, ss);

  } catch (error) {
    return ok({ status: "error", message: error.toString() });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÉTODO POST: DESPACHADOR DE ACCIONES
// ═══════════════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    const action = body.action || "";

    // --- ACCIONES PORTAL ESTUDIANTIL ---
    if (action === "encuestaAlumno")   return saveEncAlumno(body, ss);
    if (action === "encuestaPadre")    return saveEncPadre(body, ss);
    if (action === "adminPortal")      return adminPortalPost(body, ss);

    // --- ACCIONES PORTAL PEC (PROFESORES) ---
    if (action === "login")            return loginPEC(body, ss);
    if (action === "setFechaLimite")   return setFechaLimite(body, ss);
    if (action === "toggleCalificacion") return toggleCalificacion(body, ss);
    if (action === "export")           return exportSabana(ss);
    if (action === "saveTutoria")      return saveTutoria(body, ss);
    if (action === "deleteTutoria")    return deleteTutoria(body, ss);
    if (action === "updateTutoriaField") return updateTutoriaField(body, ss);
    if (action === "eval-docente")     return saveEvalDocente(body, ss);
    if (action === "editarEvaluacion") return editarEvaluacion(ss, body);
    
    // CAPTURA PEC (Acción por defecto si tiene datos de evaluación)
    if (body.equipoId || body.integrantes) return saveEvaluacionPEC(body, ss);

    return err("Acción no válida");

  } catch (error) {
    return err(error.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA PORTAL PEC (PROFESORES)
// ═══════════════════════════════════════════════════════════════════════════

function loginPEC(body, ss) {
  const s = getSheet(ss, S_USUARIOS); if (!s) return err("Sistema no configurado (Usuarios)");
  const d = s.getDataRange().getValues(); d.shift();
  const f = d.find(r => r[0] && normalizeText(r[0]) === normalizeText(body.email) && String(r[1]) === String(body.password));
  if (f) return ok({ status: "success", nombre: f[2], rol: f[3] || "Docente" });
  return ok({ status: "error", message: "Credenciales inválidas" });
}

function doGetDashboardPEC(e, ss) {
  const userEmail = normalizeText(e.parameter.userEmail || "");

  // 1. CONFIGURACIÓN
  let config = { docente: "Felipe López Salazar", parcialActivo: "2" };
  const sConf = getSheet(ss, S_CONFIGURACION);
  if (sConf) {
    sConf.getDataRange().getValues().forEach(r => {
      if (!r[0]) return;
      const keyNorm = normalizeText(r[0]);
      if (keyNorm === "docente_nombre") config.docente = r[1];
      else if (keyNorm === "parcial_activo") config.parcialActivo = normalizeParcial(r[1]);
      else config[r[0]] = r[1];
    });
  }
  const parcialActivo = config.parcialActivo;

  // Fechas límite
  let fechas = { p1: "", p2: "", p3: "" };
  if (sConf) {
    sConf.getDataRange().getValues().forEach(r => {
      const key = normalizeText(r[0]);
      if (key === "cal_p1_fecha") fechas.p1 = String(r[1] || "").trim();
      if (key === "cal_p2_fecha") fechas.p2 = String(r[1] || "").trim();
      if (key === "cal_p3_fecha") fechas.p3 = String(r[1] || "").trim();
    });
  }

  // 2. ROL
  let userRole = "Docente";
  const sUsr = getSheet(ss, S_USUARIOS);
  if (sUsr && userEmail !== "") {
    const d = sUsr.getDataRange().getValues();
    const f = d.find(r => r[0] && normalizeText(r[0]) === userEmail);
    if (f) userRole = String(f[3] || "Docente").trim();
  }
  const isAdmin = userEmail !== "" && (userRole.toLowerCase() === "admin" || userEmail === "admin@ceb54.online");

  // 3. ALUMNOS Y EQUIPOS
  const sAlum = getSheet(ss, S_ALUMNOS);
  const equiposMap = {};
  let gruposConEquipos = new Set();
  let alumnosFull = [];
  let sinEquipo = [];

  const evaluadosMap = {};
  const sEvCheck = getSheet(ss, S_EVALUACIONES);
  if (sEvCheck) {
    const dEv = sEvCheck.getDataRange().getValues(); dEv.shift();
    dEv.forEach(r => evaluadosMap[String(r[3])] = true);
  }

  if (sAlum) {
    const d = sAlum.getDataRange().getValues();
    if (d.length > 1) {
      d.shift();
      d.forEach(r => {
        const nom = String(r[1] || "").trim();
        const grp = String(r[2] || "").trim();
        const nEq = String(r[4] || "").trim();
        const sex = String(r[6] || "H").toUpperCase();
        if (!nom) return;
        alumnosFull.push({ nombre: nom, grupo: grp, sexo: sex, pin: String(r[0] || "").trim() });
        if (!nEq || nEq === "0" || nEq === "" || nEq === "S/E") {
          sinEquipo.push({ alumno: nom, grupo: grp });
        } else if (grp) {
          gruposConEquipos.add(grp);
          const id = `${grp}-${nEq}`;
          if (!equiposMap[id]) {
            equiposMap[id] = { id: id, nombre: `Equipo ${nEq}`, grupo: grp, tema: r[3] || "Proyecto", integrantes: [], urlDoc: r[5] || "", estado: evaluadosMap[id] ? "Evaluado" : "Pendiente" };
          }
          equiposMap[id].integrantes.push(nom);
        }
      });
    }
  }

  // 4. DIRECTORIO Y PROGRAMACIÓN
  let directorio = [];
  const sDir = getSheet(ss, S_DIRECTORIO);
  if (sDir) {
    const d = sDir.getDataRange().getValues(); d.shift();
    directorio = d.map(r => ({ grupo: String(r[0] || '').trim(), materia: String(r[1] || '').trim(), docente: String(r[2] || '').trim(), correo: normalizeText(r[3]), parcial: String(r[4] || '').trim() })).filter(x => x.grupo !== "");
  }

  let sheetProg = getSheet(ss, S_PROGRAMACION);
  let programacion = [];
  if (sheetProg) {
    const d = sheetProg.getDataRange().getValues(); d.shift();
    programacion = d.map(r => ({ parcial: normalizeParcial(r[0]), semestre: String(r[1] || '').trim(), turno: String(r[2] || '').trim().toUpperCase(), materia: String(r[3] || '').trim(), docente: String(r[4] || '').trim(), ponderacion: Number(r[5] || 0), grupoEspecial: String(r[6] || '').trim() }));
  }

  // 5. ACCESO
  let gruposDelDocente = [];
  if (isAdmin) {
    gruposDelDocente = [...new Set([...gruposConEquipos, ...directorio.map(d => d.grupo)])].sort();
  } else if (userEmail !== "") {
    const tempGrupos = new Set();
    directorio.filter(d => d.correo === userEmail).forEach(d => tempGrupos.add(d.grupo));
    programacion.filter(p => normalizeText(p.docente) === userEmail).forEach(p => {
      if (p.grupoEspecial) p.grupoEspecial.split(',').forEach(g => tempGrupos.add(g.trim()));
    });
    gruposDelDocente = [...tempGrupos].filter(g => g !== "").sort();
  }

  // 6. TUTORÍAS
  const sTut = getSheet(ss, S_TUTORIAS);
  let tutoriasData = [];
  if (sTut) {
    const d = sTut.getDataRange().getValues(); d.shift();
    tutoriasData = d.map(r => ({ fecha: r[0], parcial: normalizeParcial(r[1]), grupo: String(r[2]), alumno: String(r[3]), sexo: String(r[4] || 'H'), asignatura: String(r[5]), regular: r[6]==='X', intra: r[7]==='X', tema: String(r[8]), grupal: r[9]==='X', individual: r[10]==='X', docenteEmail: normalizeText(r[11]), asistencia: String(r[12]||"SÍ") }));
    if (!isAdmin) tutoriasData = tutoriasData.filter(x => x.docenteEmail === userEmail);
  }

  // 7. EVALUACIONES
  let evaluaciones = [];
  if (sEvCheck) {
    const d = sEvCheck.getDataRange().getValues(); d.shift();
    evaluaciones = d.map(r => ({ parcial: r[1], equipoId: String(r[3]), materia: String(r[5]), docente: String(r[6]), puntaje: Number(r[7]), alumno: String(r[9]), docenteEmail: normalizeText(r[10]) }));
    if (!isAdmin) evaluaciones = evaluaciones.filter(x => x.docenteEmail === userEmail);
  }

  return ok({
    status: "success", config, equipos: Object.values(equiposMap), evaluaciones, tutorias: tutoriasData,
    alumnosFull, isAdmin, gruposDelDocente, parcialActivo, fechas
  });
}

// PEC POST FUNCTIONS
function saveEvaluacionPEC(body, ss) {
  const emailCaptura = normalizeText(body.docente_email || "");
  const sEv = getSheet(ss, S_EVALUACIONES);
  const base = [new Date(), body.parcial, body.grupoId, body.equipoId, body.equipoNombre, body.materia, body.docente, "", body.observaciones || "", "", emailCaptura, "CAPTURA"];
  if (body.integrantes && body.integrantes.length > 0) {
    body.integrantes.forEach(i => { const r = [...base]; r[7] = i.puntaje; r[9] = i.alumno; sEv.appendRow(r); });
  } else {
    base[7] = body.puntaje; sEv.appendRow(base);
  }
  return ok({ status: "success" });
}

function saveTutoria(body, ss) {
  const s = getSheet(ss, S_TUTORIAS);
  const fecha = body.fecha || new Date();
  const alumnos = body.alumnos || [{ nombre: body.alumno, sexo: body.sexo }];
  alumnos.forEach(alum => {
    s.appendRow([fecha, body.parcial, body.grupo, alum.nombre, alum.sexo, body.asignatura, body.regular ? "X" : "", body.intra ? "X" : "", body.tema, body.grupal ? "X" : "", body.individual ? "X" : "", normalizeText(body.docente_email)]);
  });
  return ok({ status: "success" });
}

function setFechaLimite(body, ss) {
  const sConf = getSheet(ss, S_CONFIGURACION) || ss.insertSheet(S_CONFIGURACION);
  const key = "cal_p" + body.parcial + "_fecha";
  const d = sConf.getDataRange().getValues();
  let found = false;
  for (let i = 0; i < d.length; i++) {
    if (normalizeText(String(d[i][0])) === key) { sConf.getRange(i+1, 2).setValue(body.fecha); found = true; break; }
  }
  if (!found) sConf.appendRow([key, body.fecha]);
  return ok({ status: "success" });
}

function toggleCalificacion(body, ss) {
  const sConf = getSheet(ss, S_CONFIGURACION) || ss.insertSheet(S_CONFIGURACION);
  const key = "cal_p" + body.parcial + "_activa";
  const valor = body.activa ? "si" : "no";
  const d = sConf.getDataRange().getValues();
  let found = false;
  for (let i = 0; i < d.length; i++) {
    if (normalizeText(String(d[i][0])) === key) { sConf.getRange(i+1, 2).setValue(valor); found = true; break; }
  }
  if (!found) sConf.appendRow([key, valor]);
  return ok({ status: "success" });
}

function exportSabana(ss) {
  // Función placeholder para generar la sábana (usar lógica de backend-codigo-gas.js si es necesario)
  return ok({ status: "success", message: "Proceso de exportación iniciado" });
}

function deleteTutoria(body, ss) {
  const s = getSheet(ss, S_TUTORIAS); const d = s.getDataRange().getValues();
  const tF = new Date(body.fecha).getTime(); const tA = String(body.alumno).trim();
  for (let i = d.length - 1; i >= 1; i--) {
    if (Math.abs(new Date(d[i][0]).getTime() - tF) < 10000 && String(d[i][3]).trim() === tA) { s.deleteRow(i + 1); break; }
  }
  return ok({ status: "success" });
}

function updateTutoriaField(body, ss) {
  const s = getSheet(ss, S_TUTORIAS); const d = s.getDataRange().getValues();
  const m = { "parcial": 1, "sexo": 4, "tema": 8, "asistencia": 12 };
  let col = m[body.column];
  for (let i = 1; i < d.length; i++) {
    if (Math.abs(new Date(d[i][0]).getTime() - new Date(body.fecha).getTime()) < 10000 && String(d[i][3]).trim() === String(body.alumno).trim()) {
      s.getRange(i+1, col+1).setValue(body.value);
      return ok({ status: "success" });
    }
  }
  return err("Fila no encontrada");
}

function saveEvalDocente(body, ss) {
  let sF = ensureSheet(ss, S_FEEDBACK, ["Fecha", "Parcial", "Alumno", "Grupo", "Docente", "Materia", "Claridad", "Respeto", "Dominio", "Org", "Promedio", "Comentarios"]);
  const data = [new Date(), body.parcial, body.alumno, body.grupo, body.docente, body.materia, body.c1, body.c2, body.c3, body.c4, ((body.c1 + body.c2 + body.c3 + body.c4) / 4).toFixed(2), body.comentarios || ""];
  sF.appendRow(data);
  return ok({ status: "success" });
}

// EDITAR EVALUACIÓN (Versión consolidada)
function editarEvaluacion(ss, body) {
  const sEv = getSheet(ss, S_EVALUACIONES);
  const d = sEv.getDataRange().getValues();
  const parc = normalizeParcial(body.parcial); const eqId = String(body.equipoId); const mat = normalizeText(body.materia); const al = String(body.alumno).trim();
  for (let i = 1; i < d.length; i++) {
    if (normalizeParcial(d[i][1]) === parc && String(d[i][3]) === eqId && normalizeText(d[i][5]) === mat && String(d[i][9]).trim() === al) {
      sEv.getRange(i+1, 8).setValue(body.nuevoPuntaje);
      if (body.nuevaObs) sEv.getRange(i+1, 9).setValue(body.nuevaObs);
      return ok({ status: "success" });
    }
  }
  return err("No se encontró el registro");
}

function getEdicionData(e, ss) {
  const sEv = getSheet(ss, S_EVALUACIONES); if (!sEv) return ok({ status: "success", evaluaciones: [] });
  const userEmail = normalizeText(e.parameter.userEmail || "");
  const d = sEv.getDataRange().getValues(); d.shift();
  const evs = d.map((r,idx) => ({ rowIndex: idx+2, parcial: normalizeParcial(r[1]), grupoId: r[2], equipoId: r[3], equipoNombre: r[4], materia: r[5], puntaje: r[7], observaciones: r[8], alumno: r[9], docenteEmail: normalizeText(r[10]) }));
  return ok({ status: "success", evaluaciones: evs.filter(ev => ev.docenteEmail === userEmail || userEmail === "admin@ceb54.online") });
}

function getBitacoraData(e, ss) {
  const sBit = getSheet(ss, S_BITACORA); if (!sBit) return ok({ status: "success", bitacora: [] });
  const d = sBit.getDataRange().getValues(); d.shift();
  return ok({ status: "success", bitacora: d.map(r => ({ fecha: r[0], usuario: r[1], equipo: r[4], materia: r[5], nuevo: r[8] })) });
}

function doGetCalificaciones(e, ss) {
  // Lógica de recuperación de calificaciones para el Dashboard PEC
  // (Usa la lógica compleja de backend-codigo-gas.js si se requiere reporte avanzado)
  return ok({ status: "success", mensaje: "Reporte de calificaciones generado" });
}

// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA PORTAL ESTUDIANTIL (ALUMNOS/PADRES)
// ═══════════════════════════════════════════════════════════════════════════

function readConfigPortal(ss) {
  const cfg = { portal_p1_activa: false, portal_p2_activa: false, portal_p3_activa: false, portal_enc_abierta: true };
  const s = getSheet(ss, SH_CONF); if (!s) return cfg;
  s.getDataRange().getValues().forEach(r => {
    if (!r[0]) return;
    const k = normalizeText(r[0]);
    if (k.includes("p1_activa")) cfg.portal_p1_activa = norm(r[1]) === "si";
    if (k.includes("p2_activa")) cfg.portal_p2_activa = norm(r[1]) === "si";
    if (k.includes("p3_activa")) cfg.portal_p3_activa = norm(r[1]) === "si";
    if (k.includes("enc_abierta")) cfg.portal_enc_abierta = norm(r[1]) !== "no";
  });
  return cfg;
}

function loginAlumno(e, ss) {
  const curp = String(e.parameter.curp || "").trim().toUpperCase();
  const s = getSheet(ss, SH_ALU); if (!s) return err("Hoja Alumnos no encontrada");
  const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === curp);
  if (!row) return err("CURP no registrado");
  return ok({ status:"success", tipo:"alumno", nombre: row[1], grupo: row[2] });
}

function loginPadre(e, ss) {
  const folio = String(e.parameter.folio || "").trim().toUpperCase();
  const s = getSheet(ss, SH_PAD); if (!s) return err("Hoja Padres no encontrada");
  const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === folio);
  if (!row) return err("Folio no encontrado");
  return ok({ status:"success", tipo:"padre", nombre: row[1], nombreHijo: row[3] });
}

function getCalAlumno(e, ss) {
  const curp = String(e.parameter.curp || "").trim().toUpperCase();
  const s = getSheet(ss, SH_ALU); const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === curp);
  const qualifications = readCalifAlumnoPortal(ss, row[1], readConfigPortal(ss));
  return ok({ status:"success", alumno: { nombre: row[1], grupo: row[2] }, calificaciones: qualifications });
}

function getCalPadre(e, ss) {
  const folio = String(e.parameter.folio || "").trim().toUpperCase();
  const s = getSheet(ss, SH_PAD); const row = s.getDataRange().getValues().find(r => String(r[0]).trim().toUpperCase() === folio);
  const qualifications = readCalifAlumnoPortal(ss, row[3], readConfigPortal(ss));
  return ok({ status:"success", hijo: { nombre: row[3], grupo: row[4] }, calificaciones: qualifications });
}

function readCalifAlumnoPortal(ss, nombre, config) {
  const result = { p1: null, p2: null, p3: null };
  const sEv = getSheet(ss, SH_EVAL); if (!sEv) return result;
  const rows = sEv.getDataRange().getValues(); rows.shift();
  ["2","3"].forEach(p => {
    if (!config["portal_p" + p + "_activa"]) return;
    let total = 0;
    rows.forEach(r => { if (normalizeParcial(r[1]) === p && normalizeText(r[9]) === normalizeText(nombre)) total += Number(r[7] || 0); });
    if (total > 0) result["p" + p] = Math.min(total, 2);
  });
  return result;
}

function getEncuestaStatus(e, ss) {
  const id = String(e.parameter.id || "").trim().toUpperCase();
  const sEnc = getSheet(ss, e.parameter.tipo === "padre" ? SH_EP : SH_EA);
  const respondido = sEnc ? sEnc.getDataRange().getValues().some(r => String(r[1]).trim().toUpperCase() === id) : false;
  return ok({ status:"success", respondido });
}

function saveEncAlumno(body, ss) {
  const sEnc = ensureSheet(ss, SH_EA, ["Fecha","CURP","Nombre","Grupo","Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9","Q10","Comentarios"]);
  const q = body.respuestas || {};
  sEnc.appendRow([new Date(), body.curp, body.nombre, body.grupo, q.q1, q.q2, q.q3, q.q4, q.q5, q.q6, q.q7, q.q8, q.q9, q.q10, q.comentarios]);
  return ok({ status:"success" });
}

function saveEncPadre(body, ss) {
  const sEnc = ensureSheet(ss, SH_EP, ["Fecha","Folio","Nombre_Padre","Nombre_Hijo","Grupo","E1","E2","E3","E4","E5","D1","D2","D3","D4","S1","S2","S3","S4","Cal_General","Comentarios","Sugerencias"]);
  const q = body.respuestas || {};
  sEnc.appendRow([new Date(), body.folio, body.nombre_padre, body.nombre_hijo, body.grupo, q.e1, q.e2, q.e3, q.e4, q.e5, q.d1, q.d2, q.d3, q.d4, q.s1, q.s2, q.s3, q.s4, q.cal_general, q.comentarios, q.sugerencias]);
  return ok({ status:"success" });
}

function adminPortalGet(e, ss) {
  if (e.parameter.adminKey !== "CEB54_ADMIN_PORTAL") return err("No autorizado");
  const sConf = ensureSheet(ss, SH_CONF, ["Clave", "Valor"]);
  sConf.appendRow([e.parameter.action, "Valor"]);
  return ok({ status:"success" });
}

function adminPortalPost(body, ss) {
  if (body.adminKey !== "CEB54_ADMIN_PORTAL") return err("No autorizado");
  const sConf = ensureSheet(ss, SH_CONF, ["Clave", "Valor"]);
  // Lógica simplificada de actualización de configuración
  return ok({ status:"success" });
}
