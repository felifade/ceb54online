/**
 * BACKEND MAESTRO UNIFICADO: PEC + TUTORÍAS + EXPORTACIÓN
 * v3.5 - ESTABILIZADO (Merge de versión de usuario + Fixes de acceso)
 */

// --- CONFIGURACIÓN DE PESTAÑAS ---
const S_ALUMNOS = "Alumnos";
const S_EVALUACIONES = "Evaluaciones";
const S_DIRECTORIO = "Directorio";
const S_PROGRAMACION = "Programación";
const S_TUTORIAS = "Tutorias";
const S_CONFIGURACION = "Configuracion";
const S_USUARIOS = "Usuarios";
const S_FEEDBACK = "Retroalimentacion"; // Nueva pestaña para evitar mezclar datos
const S_BITACORA = "PEC_Bitacora";      // Bitácora de ediciones posteriores
// Hojas del módulo Presentación/Cierre PEC
const S_PEC_CIERRE_GENERAL  = "PEC_CIERRE_GENERAL";
const S_PEC_CIERRE_MATERIAS = "PEC_CIERRE_MATERIAS";
const S_PEC_CIERRE_INSUMOS  = "PEC_CIERRE_INSUMOS";

// --- FUNCIONES DE NORMALIZACIÓN ---
function normalizeText(val) {
  if (!val) return "";
  return String(val).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeParcial(val) {
  if (!val) return "";
  const match = String(val).match(/\d+/);
  return match ? match[0] : String(val).trim();
}

// Buscar hojas ignorando acentos
function getSheet(ss, name) {
  const sheets = ss.getSheets();
  const target = normalizeText(name);
  return sheets.find(s => normalizeText(s.getName()) === target);
}

// === CALIFICACIONES PEC: IDs HOJAS HISTÓRICAS ===
const OLD_GRADES_SHEET_ID    = "1MmAwYm2mfRBH3q-BGlKklwvsHE8iSYY5y1ac4mO07rQ"; // 2do semestre
const OLD_GRADES_SHEET_ID_4S = "1aRY6lP8R5-myw61Epbffsc1WmzNDYo67N0ovGOWng7s"; // 4to semestre

// === MÉTODO GET: LECTURA DE DATOS ===
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Módulo Presentación / Cierre PEC (alimentado desde Sheets)
    if (e.parameter.action === "getPecCierre") {
      return doGetPecCierre(ss);
    }
    // Acción especial: calificaciones por parcial
    if (e.parameter.action === "getCalificaciones") {
      return doGetCalificaciones(e, ss);
    }
    // Módulo de edición posterior (aislado del flujo de captura)
    if (e.parameter.action === "getEdicion") {
      return getEdicionData(e, ss);
    }
    if (e.parameter.action === "getBitacora") {
      return getBitacoraData(e, ss);
    }
    // Módulo Calendario Institucional (Eventos, Periodos, Cumpleaños)
    if (e.parameter.action === "getCalendario") {
      return getCalendarioData(ss);
    }
    const userEmail = normalizeText(e.parameter.userEmail || "");

    // ── CACHÉ GAS: evita releer Sheets si los datos ya están en memoria ──────
    const _cache  = CacheService.getScriptCache();
    const _cKey   = 'pec_v1_' + userEmail;
    const _cached = _cache.get(_cKey);
    if (_cached) return ContentService.createTextOutput(_cached).setMimeType(ContentService.MimeType.JSON);
    // ─────────────────────────────────────────────────────────────────────────

    // 1. CONFIGURACIÓN — leer UNA sola vez y reutilizar para config + fechas
    let config = { docente: "Felipe López Salazar", parcialActivo: "2" };
    const sConf = getSheet(ss, S_CONFIGURACION);
    const confData = sConf ? sConf.getDataRange().getValues() : [];
    confData.forEach(r => {
      if (!r[0]) return;
      const key = String(r[0]).trim();
      const keyNorm = normalizeText(key);
      if (keyNorm === "docente_nombre") config.docente = r[1];
      else if (keyNorm === "parcial_activo") config.parcialActivo = normalizeParcial(r[1]);
      else config[key] = r[1];
    });
    const parcialActivo = config.parcialActivo;

    // Fechas límite — reutiliza confData (sin segunda lectura a Sheets)
    let fechas = { p1: "", p2: "", p3: "" };
    confData.forEach(r => {
      const key = normalizeText(r[0]);
      if (key === "cal_p1_fecha") fechas.p1 = String(r[1] || "").trim();
      if (key === "cal_p2_fecha") fechas.p2 = String(r[1] || "").trim();
      if (key === "cal_p3_fecha") fechas.p3 = String(r[1] || "").trim();
    });

    // 2. ROL DE USUARIO
    let userRole = "Docente";
    const sUsr = getSheet(ss, S_USUARIOS);
    if (sUsr && userEmail !== "") {
      const d = sUsr.getDataRange().getValues();
      const f = d.find(r => r[0] && normalizeText(r[0]) === userEmail);
      if (f) userRole = String(f[3] || "Docente").trim();
    }
    const isAdmin = userEmail !== "" && (userRole.toLowerCase() === "admin" || userEmail === "admin@ceb54.online");

    // 3. RECUPERAR ALUMNOS Y EQUIPOS (PEC + TUTORÍAS)
    const sAlum = getSheet(ss, S_ALUMNOS);
    const equiposMap = {};
    let gruposConEquipos = new Set();
    let alumnosFull = [];
    let sinEquipo = [];

    // Leer S_EVALUACIONES UNA sola vez — reutilizado en sección 7
    const evaluadosMap = {};
    const sEv = getSheet(ss, S_EVALUACIONES);
    const evRaw = [];
    if (sEv) {
      const dEv = sEv.getDataRange().getValues(); dEv.shift();
      dEv.forEach(r => {
        const equipoId = String(r[3]);
        evaluadosMap[equipoId] = true;
        evRaw.push({
          fecha: r[0], parcial: r[1], grupoId: String(r[2]),
          equipoId: equipoId, equipoNombre: String(r[4] || ''),
          materia: String(r[5] || ''), docente: String(r[6] || ''),
          puntaje: Number(r[7] || 0), observaciones: r[8] || "",
          alumno: String(r[9] || ''), docenteEmail: normalizeText(r[10])
        });
      });
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

          // Diagnóstico: Alumnos sin equipo
          if (!nEq || nEq === "0" || nEq === "" || nEq === "S/E" || nEq === "undefined") {
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
      directorio = d.map(r => ({
        grupo: String(r[0] || '').trim(),
        materia: String(r[1] || '').trim(),
        docente: String(r[2] || '').trim(),
        correo: normalizeText(r[3]),
        parcial: String(r[4] || '').trim(),
        ponderacion: String(r[5] || '').trim()
      })).filter(x => x.grupo !== "");
    }

    let sheetProg = getSheet(ss, S_PROGRAMACION);
    let programacion = [];
    if (sheetProg) {
      const d = sheetProg.getDataRange().getValues(); d.shift();
      programacion = d.map(r => ({
        parcial: normalizeParcial(r[0]),
        semestre: String(r[1] || '').trim(),
        turno: String(r[2] || '').trim().toUpperCase(),
        materia: String(r[3] || '').trim(),
        docente: String(r[4] || '').trim(),
        ponderacion: Number(r[5] || 0),
        grupoEspecial: String(r[6] || '').trim()
      }));
    }

    // 5. CÁLCULO DE ACCESO PEC
    let gruposDelDocente = [];
    let audit = { email: userEmail, role: userRole, materias: [], gDirectos: [], gEspeciales: [] };

    if (isAdmin) {
      gruposDelDocente = [...new Set([...gruposConEquipos, ...directorio.map(d => d.grupo)])].sort();
    } else if (userEmail !== "") {
      const misDirectos = directorio.filter(d => d.correo === userEmail);
      const misEspeciales = programacion.filter(p => normalizeText(p.docente) === userEmail || (p.correoDocente && normalizeText(p.correoDocente) === userEmail));

      const tempGrupos = new Set();
      misDirectos.forEach(d => tempGrupos.add(d.grupo));
      misEspeciales.forEach(p => {
        if (p.grupoEspecial) {
          p.grupoEspecial.split(',').forEach(g => tempGrupos.add(g.trim()));
        }
      });
      gruposDelDocente = [...tempGrupos].filter(g => g !== "").sort();
    }

    // 6. HISTORIAL TUTORÍAS (Alineado con columnas reales)
    const sTut = getSheet(ss, S_TUTORIAS);
    let tutoriasData = [];
    if (sTut) {
      const d = sTut.getDataRange().getValues();
      if (d.length > 1) {
        d.shift();
        tutoriasData = d.map(r => ({
          fecha: r[0],
          parcial: normalizeParcial(r[1]),
          grupo: String(r[2] || ''),
          alumno: String(r[3] || ''),
          sexo: String(r[4] || 'H').toUpperCase(),
          asignatura: String(r[5] || ''),
          regular: r[6] === 'X' || r[6] === true || r[6] === "Regular",
          intra: r[7] === 'X' || r[7] === true || r[7] === "Intra",
          tema: String(r[8] || ''),
          grupal: r[9] === 'X' || r[9] === true || r[9] === 'Grupal',
          individual: r[10] === 'X' || r[10] === true || r[10] === 'Individual',
          docenteEmail: normalizeText(r[11] || ""),
          asistencia: String(r[12] || "SÍ").trim().toUpperCase(),
          fecha_tutoria: String(r[13] || "")
        }));
        if (!isAdmin && userEmail !== "") tutoriasData = tutoriasData.filter(x => x.docenteEmail === userEmail);
      }
    }

    // 7. EVALUACIONES PEC — reutiliza evRaw leído en sección 3 (sin segunda lectura)
    const todasEvaluaciones = [...evRaw];
    const evaluaciones = (isAdmin || userEmail === "")
      ? [...evRaw]
      : evRaw.filter(x => x.docenteEmail === userEmail);
    const listaEquipos = Object.values(equiposMap);

    // 8. AVANCE DOCENTE
    let avanceDoc = { total: 0, evaluados: 0, porcentaje: 0 };
    if (gruposDelDocente.length > 0) {
      const gN = gruposDelDocente.map(g => String(g).replace(/^[A-Za-z]+/, ''));
      const eqs = listaEquipos.filter(eq => gN.includes(String(eq.grupo).replace(/^[A-Za-z]+/, '')));
      avanceDoc.total = eqs.length;
      avanceDoc.evaluados = eqs.filter(eq => eq.estado === 'Evaluado').length;
      avanceDoc.porcentaje = avanceDoc.total === 0 ? 0 : Math.round((avanceDoc.evaluados / avanceDoc.total) * 100);
    }


    // 9. RETROALIMENTACIÓN DOCENTE (HISTORIAL CON CALIFICACIONES)
    let feedbackHistory = [];
    const sFHistory = getSheet(ss, S_FEEDBACK);
    if (sFHistory) {
      const dF = sFHistory.getDataRange().getValues();
      if (dF.length > 1) {
        dF.shift(); // Quitar encabezados
        feedbackHistory = dF.map(r => ({
          parcial: String(r[1] || ""),
          alumno: String(r[2] || ""),
          grupo: String(r[3] || ""),
          docente: String(r[4] || ""),
          materia: String(r[5] || ""),
          claridad: r[6], // Columna G
          respeto: r[7],  // Columna H
          dominio: r[8],  // Columna I
          org: r[9],      // Columna J
          promedio: r[10],// Columna K
          comentarios: String(r[11] || "") // Columna L
        }));
      }
    }


    const _respStr = JSON.stringify({
      status: "success",
      feedbackHistory: feedbackHistory,
      config: config,
      grupos: [...gruposConEquipos],
      equipos: listaEquipos,
      evaluaciones: evaluaciones,
      todasEvaluaciones: todasEvaluaciones,
      tutorias: tutoriasData,
      alumnosFull: alumnosFull,
      directorio: directorio,
      programacion: programacion,
      isAdmin: isAdmin,
      gruposDelDocente: gruposDelDocente,
      parcialActivo: parcialActivo,
      avanceDocente: avanceDoc,
      sinEquipo: sinEquipo,
      audit: audit,
      fechas: fechas
    });
    // Guardar en caché 5 min (máx 100KB — si excede, se omite silenciosamente)
    try { _cache.put(_cKey, _respStr, 300); } catch(_) {}
    return ContentService.createTextOutput(_respStr).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Invalida caché GAS tras cualquier escritura ──────────────────────────────
function _invalidarCache(email) {
  try {
    const c = CacheService.getScriptCache();
    if (email) c.remove('pec_v1_' + normalizeText(email));
    c.remove('pec_v1_'); // caché global (sin userEmail)
  } catch(_) {}
}

// === MÉTODO POST: ACCIONES DE ESCRITURA ===
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    const action = body.action || "";

    // LOGIN
    if (action === "login") {
      const s = getSheet(ss, S_USUARIOS); if (!s) return ContentService.createTextOutput("error");
      const d = s.getDataRange().getValues(); d.shift();
      const f = d.find(r => r[0] && normalizeText(r[0]) === normalizeText(body.email) && String(r[1]) === String(body.password));
      if (f) return ContentService.createTextOutput(JSON.stringify({ status: "success", nombre: f[2], rol: f[3] || "Docente" }));
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Credenciales inválidas" }));
    }

    // GUARDAR FECHA LÍMITE POR PARCIAL
    if (action === "setFechaLimite") {
      const sConf = getSheet(ss, S_CONFIGURACION) || ss.insertSheet(S_CONFIGURACION);
      const key   = "cal_p" + body.parcial + "_fecha";
      const valor = String(body.fecha || "").trim();
      const d = sConf.getDataRange().getValues();
      let found = false;
      for (let i = 0; i < d.length; i++) {
        if (normalizeText(String(d[i][0])) === key) {
          sConf.getRange(i + 1, 2).setValue(valor);
          found = true; break;
        }
      }
      if (!found) sConf.appendRow([key, valor]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    // ACTIVAR / DESACTIVAR CALIFICACIONES POR PARCIAL (solo admin)
    if (action === "toggleCalificacion") {
      const sConf = getSheet(ss, S_CONFIGURACION) || ss.insertSheet(S_CONFIGURACION);
      const key = "cal_p" + body.parcial + "_activa";
      const valor = body.activa ? "si" : "no";
      const d = sConf.getDataRange().getValues();
      let found = false;
      for (let i = 0; i < d.length; i++) {
        if (normalizeText(String(d[i][0])) === key) {
          sConf.getRange(i + 1, 2).setValue(valor);
          found = true;
          break;
        }
      }
      if (!found) sConf.appendRow([key, valor]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    // EXPORTAR SÁBANA (PEC)
    if (action === "export") {
      generarConcentradoDeAsignaturas(ss);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Reportes generados" }));
    }

    // TUTORÍAS: GUARDAR (Soporte Multi-Alumno)
    if (action === "saveTutoria") {
      const s = getSheet(ss, S_TUTORIAS);
      const fecha = body.fecha || new Date();
      const alumnos = body.alumnos || [{ nombre: body.alumno, sexo: body.sexo }];

      alumnos.forEach(alum => {
        s.appendRow([
          fecha,
          body.parcial,
          body.grupo,
          alum.nombre,
          alum.sexo,
          body.asignatura,
          body.regular ? "X" : "",
          body.intra ? "X" : "",
          body.tema,
          body.grupal ? "X" : "",
          body.individual ? "X" : "",
          normalizeText(body.docente_email),
          body.asistencia || "",
          body.fecha_tutoria || ""
        ]);
      });
      _invalidarCache(body.docente_email);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    if (action === "deleteTutoria") {
      const s = getSheet(ss, S_TUTORIAS); const d = s.getDataRange().getValues();
      const tF = new Date(body.fecha).getTime(); const tA = String(body.alumno).trim();
      for (let i = d.length - 1; i >= 1; i--) {
        if (Math.abs(new Date(d[i][0]).getTime() - tF) < 10000 && String(d[i][3]).trim() === tA) { s.deleteRow(i + 1); break; }
      }
      _invalidarCache(body.docente_email);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    if (action === "updateTutoriaField") {
      const s = getSheet(ss, S_TUTORIAS); const d = s.getDataRange().getValues();
      const tF = new Date(body.fecha).getTime(); const tA = String(body.alumno).trim();
      // Mapa de columnas: Parcial=1(B), Sexo=4(E), Tema=8(I), Asistencia=12(M)
      const m = { "parcial": 1, "sexo": 4, "tema": 8, "asistencia": 12 };
      let col = m[body.column];
      let matched = false;
      if (col !== undefined) {
        for (let i = 1; i < d.length; i++) {
          const rowDateMs = new Date(d[i][0]).getTime();
          // Compara fecha (con margen de 10s) y nombre exacto del alumno
          if (Math.abs(rowDateMs - tF) < 10000 && String(d[i][3]).trim() === tA) {
            s.getRange(i + 1, col + 1).setValue(body.value);
            matched = true;
            break;
          }
        }
      }
      if (!matched) return ContentService.createTextOutput(JSON.stringify({ status: "error", message: `No se encontró la fila. Col: ${body.column}, Alumno: ${tA}` }));
      _invalidarCache(body.docente_email);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    // EVALUACIÓN DOCENTE POR ALUMNO
    if (action === "eval-docente") {
      let sF = getSheet(ss, S_FEEDBACK);
      if (!sF) {
        sF = ss.insertSheet(S_FEEDBACK);
        sF.appendRow(["Fecha", "Parcial", "Alumno", "Grupo", "Docente", "Materia", "Claridad", "Respeto", "Dominio", "Org", "Promedio", "Comentarios"]);
      }

      // VALIDACIÓN: ¿Ya evaluó a este maestro en este parcial?
      const d = sF.getDataRange().getValues();
      const p = String(body.parcial); const a = String(body.alumno); const g = String(body.grupo); const doc = String(body.docente);
      const existe = d.some(r => String(r[1]) === p && String(r[2]) === a && String(r[3]) === g && String(r[4]) === doc);
      if (existe) return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Ya has evaluado a este profesor anteriormente." }));

      const data = [
        new Date(),
        body.parcial,
        body.alumno,
        body.grupo,
        body.docente,
        body.materia,
        body.c1, body.c2, body.c3, body.c4,
        ((body.c1 + body.c2 + body.c3 + body.c4) / 4).toFixed(2),
        body.comentarios || ""
      ];
      sF.appendRow(data);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    // EDICIÓN POSTERIOR (módulo aislado — no afecta flujo de captura)
    if (action === "editarEvaluacion") {
      return editarEvaluacion(ss, body);
    }

    // PEC: GUARDAR EVALUACIÓN
    // Validación backend: verificar que el docente tiene asignada esta materia
    const emailCaptura = normalizeText(body.docente_email || "");
    if (emailCaptura) {
      const sDir = getSheet(ss, S_DIRECTORIO);
      if (sDir) {
        const dirRows = sDir.getDataRange().getValues(); dirRows.shift();
        const asignacion = dirRows.find(r =>
          normalizeText(r[3]) === emailCaptura &&
          normalizeText(r[1]) === normalizeText(body.materia)
        );
        // Verificar si es admin
        const sUsrV = getSheet(ss, S_USUARIOS);
        let esAdmin = false;
        if (sUsrV) {
          const uRows = sUsrV.getDataRange().getValues();
          const uRow = uRows.find(r => normalizeText(r[0]) === emailCaptura);
          if (uRow && String(uRow[3] || "").toLowerCase() === "admin") esAdmin = true;
        }
        if (!esAdmin && !asignacion) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: "No tienes permiso para capturar esta materia. Contacta al administrador."
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    const sEv = getSheet(ss, S_EVALUACIONES);

    // VALIDACIÓN ANTI-DUPLICADO: buscar si ya existe (parcial, equipoId, materia, alumno)
    const evRows = sEv.getDataRange().getValues();
    evRows.shift(); // quitar encabezado
    const parcialNorm = normalizeParcial(body.parcial);
    const equipoIdStr = String(body.equipoId || "");
    const materiaNorm = normalizeText(body.materia || "");

    if (body.integrantes && body.integrantes.length > 0) {
      // Validar cada integrante individualmente
      const intDuplicados = body.integrantes.filter(integ => {
        const alumnoStr = String(integ.alumno || "").trim();
        return evRows.some(r =>
          normalizeParcial(r[1]) === parcialNorm &&
          String(r[3])           === equipoIdStr &&
          normalizeText(r[5])    === materiaNorm &&
          String(r[9] || "").trim() === alumnoStr
        );
      });
      if (intDuplicados.length > 0) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "duplicado",
          message: "Este equipo ya fue capturado para esta materia y parcial. Utiliza el módulo de Edición para realizar cambios."
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else {
      // Evaluación de equipo completo (sin alumno individual)
      const yaDuplica = evRows.some(r =>
        normalizeParcial(r[1]) === parcialNorm &&
        String(r[3])           === equipoIdStr &&
        normalizeText(r[5])    === materiaNorm &&
        String(r[9] || "").trim() === ""
      );
      if (yaDuplica) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "duplicado",
          message: "Este equipo ya fue capturado para esta materia y parcial. Utiliza el módulo de Edición para realizar cambios."
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Col L: tipo_registro = "CAPTURA" en registro nuevo
    const base = [new Date(), body.parcial, body.grupoId, body.equipoId, body.equipoNombre, body.materia, body.docente, "", body.observaciones || "", "", emailCaptura, "CAPTURA"];
    if (body.integrantes && body.integrantes.length > 0) {
      body.integrantes.forEach(i => { const r = [...base]; r[7] = i.puntaje; r[9] = i.alumno; sEv.appendRow(r); });
    } else {
      base[7] = body.puntaje; sEv.appendRow(base);
    }
    _invalidarCache(emailCaptura);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }));

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }));
  }
}

// === PRESENTACIÓN / CIERRE PEC (datos desde Sheets) ===
function doGetPecCierre(ss) {
  try {
    const CICLO  = "2025-2026";
    const SEMS   = ["2", "4", "6"];
    const TURNOS = ["matutino", "vespertino"];

    function readRows(name) {
      const sh = getSheet(ss, name);
      if (!sh) return [];
      const rows = sh.getDataRange().getValues();
      rows.shift(); // omitir encabezado
      return rows.filter(r => r.some(c => String(c).trim() !== ""));
    }

    const genRows = readRows(S_PEC_CIERRE_GENERAL);
    const matRows = readRows(S_PEC_CIERRE_MATERIAS);
    const insRows = readRows(S_PEC_CIERRE_INSUMOS);

    const semestres = {};
    SEMS.forEach(function(sem) {
      semestres[sem] = {};
      TURNOS.forEach(function(turno) {
        const gen = genRows.find(function(r) {
          return String(r[0]).trim() === CICLO &&
                 String(r[1]).trim() === sem   &&
                 normalizeText(r[2]) === turno &&
                 normalizeText(r[9]) === "si";
        });

        const mats = matRows
          .filter(function(r) {
            return String(r[0]).trim() === CICLO &&
                   String(r[1]).trim() === sem   &&
                   normalizeText(r[2]) === turno &&
                   normalizeText(r[7]) === "si";
          })
          .sort(function(a, b) { return Number(a[6]) - Number(b[6]); })
          .map(function(r) {
            return { nombre: String(r[3] || ""), aporte: String(r[4] || ""), color: String(r[5] || "#059669") };
          });

        const insumos = insRows
          .filter(function(r) {
            return String(r[0]).trim() === CICLO &&
                   String(r[1]).trim() === sem   &&
                   normalizeText(r[2]) === turno &&
                   normalizeText(r[7]) === "si";
          })
          .sort(function(a, b) { return Number(a[6]) - Number(b[6]); })
          .map(function(r) {
            var obs = String(r[5] || "").trim();
            return obs ? String(r[3] || "") + " (" + obs + ")" : String(r[3] || "");
          });

        semestres[sem][turno] = gen ? {
          fecha:         String(gen[3] || "Por definir"),
          horario:       String(gen[4] || "—"),
          lugar:         String(gen[5] || "Instalaciones CEB 5/4"),
          descripcion:   String(gen[7] || ""),
          observaciones: String(gen[8] || ""),
          materias:      mats,
          materiales:    insumos,
        } : null;
      });
    });

    // Evento general: primera fila matutino/vespertino para horarios del pill-bar
    var matRow = genRows.find(function(r) { return String(r[0]).trim() === CICLO && normalizeText(r[2]) === "matutino" && normalizeText(r[9]) === "si"; });
    var vesRow = genRows.find(function(r) { return String(r[0]).trim() === CICLO && normalizeText(r[2]) === "vespertino" && normalizeText(r[9]) === "si"; });
    var evento = {
      fecha:       matRow ? String(matRow[3] || "Por definir") : "Por definir",
      lugar:       matRow ? String(matRow[5] || "Instalaciones CEB 5/4") : "Instalaciones CEB 5/4",
      horario_mat: matRow ? String(matRow[4] || "08:00 – 12:00 hrs") : "08:00 – 12:00 hrs",
      horario_ves: vesRow ? String(vesRow[4] || "13:00 – 17:00 hrs") : "13:00 – 17:00 hrs",
    };

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", evento: evento, semestres: semestres }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// === CALIFICACIONES PEC POR PARCIAL ===
function doGetCalificaciones(e, ss) {
  const userEmail = normalizeText(e.parameter.userEmail || "");

  // 1. Verificar admin
  let isAdmin = userEmail === "admin@ceb54.online";
  const sUsr = getSheet(ss, S_USUARIOS);
  if (sUsr && userEmail !== "") {
    const d = sUsr.getDataRange().getValues();
    const f = d.find(r => r[0] && normalizeText(r[0]) === userEmail);
    if (f && String(f[3] || "").toLowerCase() === "admin") isAdmin = true;
  }

  // 2. Leer overrides de activación en Configuracion
  const sConf = getSheet(ss, S_CONFIGURACION);
  let cfgCal = { p1: null, p2: null, p3: null };
  let fechas  = { p1: "", p2: "", p3: "" };
  if (sConf) {
    sConf.getDataRange().getValues().forEach(r => {
      const k = normalizeText(r[0]);
      if (k === "cal_p1_activa") cfgCal.p1 = String(r[1]).toLowerCase() === "si";
      if (k === "cal_p2_activa") cfgCal.p2 = String(r[1]).toLowerCase() === "si";
      if (k === "cal_p3_activa") cfgCal.p3 = String(r[1]).toLowerCase() === "si";
      if (k === "cal_p1_fecha")  fechas.p1  = String(r[1] || "").trim();
      if (k === "cal_p2_fecha")  fechas.p2  = String(r[1] || "").trim();
      if (k === "cal_p3_fecha")  fechas.p3  = String(r[1] || "").trim();
    });
  }

  // 3. Alumnos y equipos del sistema actual
  const sAlum = getSheet(ss, S_ALUMNOS);
  const alumnosInfo = {}; // nombre_lower -> { nombre, grupo }
  const equiposSet = new Set();
  if (sAlum) {
    const d = sAlum.getDataRange().getValues(); d.shift();
    d.forEach(r => {
      const nombre = String(r[1] || '').trim();
      const grupo  = String(r[2] || '').trim();
      const equipo = String(r[4] || '').trim();
      if (!nombre) return;
      alumnosInfo[nombre.toLowerCase()] = { nombre, grupo };
      if (grupo && equipo && equipo !== '0' && equipo !== 'S/E' && equipo !== '') {
        equiposSet.add(grupo + "-" + equipo);
      }
    });
  }
  const totalEquipos = equiposSet.size;

  // 4. Evaluaciones P2 y P3 del sistema actual
  const sEv = getSheet(ss, S_EVALUACIONES);
  const calMap = { "2": {}, "3": {} };
  const evaluadosPor = { "2": new Set(), "3": new Set() };
  if (sEv) {
    const d = sEv.getDataRange().getValues(); d.shift();
    d.forEach(r => {
      const parc   = normalizeParcial(r[1]);
      if (parc !== "2" && parc !== "3") return;
      const eqId   = String(r[3]);
      const alumno = String(r[9] || '').trim();
      const pts    = Number(r[7] || 0);
      const grp    = String(r[2] || '').trim();
      evaluadosPor[parc].add(eqId);
      if (alumno) {
        if (!calMap[parc][alumno]) {
          const info = alumnosInfo[alumno.toLowerCase()] || { nombre: alumno, grupo: grp };
          calMap[parc][alumno] = { alumno: info.nombre, grupo: info.grupo, cal: 0 };
        }
        calMap[parc][alumno].cal += pts;
      }
    });
  }

  // 5. Activación automática: cuando todos los equipos tienen evaluación
  const p2Auto = totalEquipos > 0 && evaluadosPor["2"].size >= totalEquipos;
  const p3Auto = totalEquipos > 0 && evaluadosPor["3"].size >= totalEquipos;
  const p1Activa = cfgCal.p1 !== null ? cfgCal.p1 : false;
  const p2Activa = cfgCal.p2 !== null ? cfgCal.p2 : p2Auto;
  const p3Activa = cfgCal.p3 !== null ? cfgCal.p3 : p3Auto;

  // 6. Leer P1 de hojas históricas (una pestaña por grupo, múltiples hojas)
  let calP1 = [];
  const sheetIds = [OLD_GRADES_SHEET_ID, OLD_GRADES_SHEET_ID_4S];

  sheetIds.forEach(sheetId => {
    try {
      const oldSS = SpreadsheetApp.openById(sheetId);
      oldSS.getSheets().forEach(sheet => {
        const data = sheet.getDataRange().getValues();
        if (data.length < 2) return;

        // Buscar fila de encabezados con NOMBRE y PRIMER PARCIAL
        let headerRow = -1, nombreCol = 1, calCol = 6;
        for (let i = 0; i < Math.min(6, data.length); i++) {
          for (let j = 0; j < data[i].length; j++) {
            const c = String(data[i][j]).toUpperCase().trim();
            if (c === "NOMBRE")               { headerRow = i; nombreCol = j; }
            if (c.includes("PRIMER PARCIAL")) { headerRow = i; calCol    = j; }
          }
          if (headerRow === i) break;
        }
        if (headerRow < 0) return;

        const grupo = sheet.getName().trim();
        for (let i = headerRow + 1; i < data.length; i++) {
          const nombre = String(data[i][nombreCol] || '').trim();
          if (!nombre || nombre.toUpperCase() === "NOMBRE") continue;
          const cal = parseFloat(data[i][calCol]) || 0;
          calP1.push({ alumno: nombre, grupo: grupo, cal: Math.min(parseFloat(cal.toFixed(2)), 2) });
        }
      });
    } catch(err) {
      Logger.log("Error leyendo hoja histórica (" + sheetId + "): " + err.toString());
    }
  });

  // 7. Convertir maps a arrays limitando a 2 puntos máximo
  const toArr = map => Object.values(map).map(v => ({
    alumno: v.alumno, grupo: v.grupo,
    cal: Math.min(parseFloat(v.cal.toFixed(2)), 2)
  }));

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    isAdmin: isAdmin,
    parciales: {
      p1: { activa: p1Activa, data: calP1 },
      p2: { activa: p2Activa, data: toArr(calMap["2"]) },
      p3: { activa: p3Activa, data: toArr(calMap["3"]) }
    },
    fechas: fechas,
    stats: { totalEquipos: totalEquipos, evaluadosP2: evaluadosPor["2"].size, evaluadosP3: evaluadosPor["3"].size }
  })).setMimeType(ContentService.MimeType.JSON);
}

// === REPORTES PEC: GENERAR SÁBANA ===
function generarConcentradoDeAsignaturas(ss) {
  const sEv = getSheet(ss, S_EVALUACIONES);
  const dataEv = sEv ? sEv.getDataRange().getValues() : [];
  if (dataEv.length > 0) dataEv.shift();

  const scObj = {}; const scI = {};
  dataEv.forEach(r => {
    const parc = String(r[1]); const eqId = String(r[3]); const mat = String(r[5]).trim();
    const pts = Number(r[7]); const al = String(r[9] || "").trim();
    if (al) {
      if (!scI[al]) scI[al] = {}; if (!scI[al][parc]) scI[al][parc] = {};
      scI[al][parc][mat] = Math.max(scI[al][parc][mat] || 0, pts);
    } else {
      if (!scObj[eqId]) scObj[eqId] = {}; if (!scObj[eqId][parc]) scObj[eqId][parc] = {};
      scObj[eqId][parc][mat] = Math.max(scObj[eqId][parc][mat] || 0, pts);
    }
  });

  const sD = getSheet(ss, S_DIRECTORIO);
  const dirMap = {};
  if (sD) {
    const d = sD.getDataRange().getValues(); d.shift();
    d.forEach(r => {
      const g = String(r[0] || "").replace(/^[A-Za-z]+/, '');
      const m = String(r[1] || '').trim();
      if (!dirMap[g]) dirMap[g] = []; if (!dirMap[g].includes(m)) dirMap[g].push(m);
    });
  }

  const sA = getSheet(ss, S_ALUMNOS);
  const dA = sA ? sA.getDataRange().getValues() : []; dA.shift();
  const gO = {};
  dA.forEach(r => {
    const al = String(r[1]); const gr = String(r[2]); const eq = String(r[4]);
    if (!gr || !al) return; if (!gO[gr]) gO[gr] = [];
    gO[gr].push({ al: al, eq: eq, sc: scObj[`${gr}-${eq}`] || {} });
  });

  const parcs = ["1", "2", "3"];
  for (const [gr, als] of Object.entries(gO)) {
    const grN = gr.replace(/^[A-Za-z]+/, '');
    const tMats = dirMap[grN] || [];
    const mE = new Set();
    als.forEach(a => {
      Object.values(a.sc).forEach(pS => Object.keys(pS).forEach(m => mE.add(m)));
      if (scI[a.al]) Object.values(scI[a.al]).forEach(pS => Object.keys(pS).forEach(m => mE.add(m)));
    });
    const mats = tMats.filter(m => mE.has(m));
    if (mats.length === 0) continue;

    const sN = `Sabana_${gr}`;
    let sR = ss.getSheetByName(sN) || ss.insertSheet(sN); sR.clear();
    let f1 = ["EQUIPO", "ESTUDIANTE"]; let f2 = ["", ""];
    parcs.forEach(p => { mats.forEach(m => { f1.push(`PARCIAL ${p}`); f2.push(m); }); f1.push(`PARCIAL ${p}`); f2.push("PROM"); });
    const out = [f1, f2];
    als.sort((a, b) => a.al.localeCompare(b.al)).forEach(a => {
      const f = [a.eq, a.al];
      parcs.forEach(p => {
        let sub = 0; let c = 0;
        mats.forEach(m => {
          let s = ""; if (scI[a.al] && scI[a.al][p] && scI[a.al][p][m] !== undefined) s = scI[a.al][p][m];
          else if (a.sc[p] && a.sc[p][m] !== undefined) s = a.sc[p][m];
          f.push(s); if (s !== "") { sub += Number(s); c++; }
        });
        f.push(c > 0 ? (sub / c).toFixed(1) : "");
      });
      out.push(f);
    });
    sR.getRange(1, 1, out.length, out[0].length).setValues(out);
    sR.getRange(1, 1, 2, out[0].length).setBackground('#e0f2fe').setFontWeight('bold');
    sR.setColumnWidth(1, 65); sR.setColumnWidth(2, 280);
    sR.setFrozenRows(2); sR.setFrozenColumns(2);
  }
}

// ============================================================
// MÓDULO DE EDICIÓN POSTERIOR — v1.0
// Aislado del flujo de captura. No modifica doPost principal.
// ============================================================

// Helper: verificar admin reutilizable
function _esAdmin(ss, userEmail) {
  if (!userEmail) return false;
  if (userEmail === normalizeText("admin@ceb54.online")) return true;
  const sUsr = getSheet(ss, S_USUARIOS);
  if (!sUsr) return false;
  const rows = sUsr.getDataRange().getValues();
  const found = rows.find(r => r[0] && normalizeText(r[0]) === userEmail);
  return !!(found && String(found[3] || "").toLowerCase() === "admin");
}

// Helper: leer fecha_cierre desde Configuracion
// Devuelve siempre un objeto Date o null
function _getFechaCierre(ss) {
  const sConf = getSheet(ss, S_CONFIGURACION);
  if (!sConf) return null;
  const rows = sConf.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (normalizeText(String(rows[i][0])) !== "portal_fecha_cierre") continue;
    const val = rows[i][1] || rows[i][2];   // col B primero, col C como respaldo
    if (!val) return null;
    // Si Sheets ya lo convirtió a Date (formato fecha en la celda)
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    // Si está como texto "DD/MM/YYYY"
    const txt = String(val).trim();
    const partes = txt.split('/');
    if (partes.length === 3) {
      const d = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
      if (!isNaN(d.getTime())) return d;
    }
    // Si está como texto "YYYY-MM-DD"
    const d2 = new Date(txt);
    if (!isNaN(d2.getTime())) return d2;
    return null;
  }
  return null;
}

// GET: Devuelve registros de Evaluaciones filtrados para el módulo de edición
function getEdicionData(e, ss) {
  const userEmail = normalizeText(e.parameter.userEmail || "");
  const isAdmin   = _esAdmin(ss, userEmail);
  const dCierre = _getFechaCierre(ss);
  const edicionAbierta = dCierre ? new Date() <= dCierre : true;
  const fechaCierreStr = dCierre
    ? Utilities.formatDate(dCierre, Session.getScriptTimeZone(), "dd/MM/yyyy")
    : "";

  const sEv = getSheet(ss, S_EVALUACIONES);
  if (!sEv) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "success", evaluaciones: [], fechaCierre: fechaCierreStr, edicionAbierta, isAdmin
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const d = sEv.getDataRange().getValues();
  d.shift(); // quitar encabezado

  const evaluaciones = d.map((r, idx) => ({
    rowIndex: idx + 2,      // fila real en Sheets (1-based + 1 por header)
    fecha:          r[0] ? Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : "",
    parcial:        normalizeParcial(r[1]),
    grupoId:        String(r[2] || ""),
    equipoId:       String(r[3] || ""),
    equipoNombre:   String(r[4] || ""),
    materia:        String(r[5] || ""),
    docente:        String(r[6] || ""),
    puntaje:        Number(r[7] || 0),
    observaciones:  String(r[8] || ""),
    alumno:         String(r[9] || ""),
    docenteEmail:   normalizeText(r[10] || ""),
    tipoRegistro:   String(r[11] || "CAPTURA"),   // "" en filas antiguas → se lee como CAPTURA
    fechaEdicion:   r[12] ? Utilities.formatDate(new Date(r[12]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : "",
    usuarioEdicion: String(r[13] || "")
  })).filter(r => r.equipoId !== ""); // quitar filas vacías

  // Docentes solo ven sus propios registros
  const resultado = isAdmin ? evaluaciones : evaluaciones.filter(ev => ev.docenteEmail === userEmail);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    evaluaciones: resultado,
    fechaCierre: fechaCierreStr,
    edicionAbierta,
    isAdmin
  })).setMimeType(ContentService.MimeType.JSON);
}

// GET: Devuelve la bitácora de cambios (solo admin)
function getBitacoraData(e, ss) {
  const userEmail = normalizeText(e.parameter.userEmail || "");
  if (!_esAdmin(ss, userEmail)) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: "Acceso restringido a administradores."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const sBit = getSheet(ss, S_BITACORA);
  if (!sBit) {
    return ContentService.createTextOutput(JSON.stringify({ status: "success", bitacora: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const d = sBit.getDataRange().getValues();
  if (d.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ status: "success", bitacora: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  d.shift();

  const bitacora = d.map(r => ({
    fechaCambio:      r[0] ? Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss") : "",
    usuarioEmail:     String(r[1] || ""),
    parcial:          String(r[2] || ""),
    equipoId:         String(r[3] || ""),
    equipoNombre:     String(r[4] || ""),
    materia:          String(r[5] || ""),
    alumno:           String(r[6] || ""),
    puntajeAnterior:  r[7],
    puntajeNuevo:     r[8],
    obsAnterior:      String(r[9] || ""),
    obsNueva:         String(r[10] || ""),
    motivo:           String(r[11] || "")
  })).reverse(); // más reciente primero

  return ContentService.createTextOutput(JSON.stringify({ status: "success", bitacora }))
    .setMimeType(ContentService.MimeType.JSON);
}

// POST action="editarEvaluacion": modifica puntaje/observaciones y registra en bitácora
function editarEvaluacion(ss, body) {
  const userEmail = normalizeText(body.userEmail || "");
  const isAdmin   = _esAdmin(ss, userEmail);
  const dCierre   = _getFechaCierre(ss);

  // --- REGLA DE EDICIÓN CONTROLADA ---
  if (!isAdmin && dCierre && new Date() > dCierre) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "El periodo de edición ha cerrado. Solo el administrador puede modificar registros."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // --- LOCALIZAR FILA por clave compuesta ---
  const sEv = getSheet(ss, S_EVALUACIONES);
  if (!sEv) return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Hoja Evaluaciones no encontrada." })).setMimeType(ContentService.MimeType.JSON);

  const d        = sEv.getDataRange().getValues();
  const parcial  = normalizeParcial(body.parcial);
  const equipoId = String(body.equipoId || "");
  const materia  = normalizeText(body.materia || "");
  const alumno   = String(body.alumno || "").trim();

  let rowFound = -1;
  for (let i = 1; i < d.length; i++) {
    if (
      normalizeParcial(d[i][1])       === parcial  &&
      String(d[i][3])                  === equipoId &&
      normalizeText(d[i][5] || "")    === materia  &&
      String(d[i][9] || "").trim()    === alumno
    ) {
      // Docentes solo pueden editar sus propias filas
      if (!isAdmin && normalizeText(d[i][10] || "") !== userEmail) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error", message: "No puedes editar registros de otra persona."
        })).setMimeType(ContentService.MimeType.JSON);
      }
      rowFound = i;
      break;
    }
  }

  if (rowFound === -1) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: "Registro no encontrado. Verifica los filtros."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const puntajeAnterior = d[rowFound][7];
  const obsAnterior     = String(d[rowFound][8] || "");
  const nuevoPuntaje    = parseFloat(body.nuevoPuntaje);
  const nuevaObs        = String(body.nuevaObs || "").trim();
  const motivo          = String(body.motivo || "Sin motivo especificado").trim();

  if (isNaN(nuevoPuntaje) || nuevoPuntaje < 0 || nuevoPuntaje > 10) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error", message: "El nuevo puntaje debe ser un número entre 0 y 10."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // --- ACTUALIZAR FILA ---
  sEv.getRange(rowFound + 1, 8).setValue(nuevoPuntaje);                        // Col H: puntaje
  if (nuevaObs !== "") sEv.getRange(rowFound + 1, 9).setValue(nuevaObs);       // Col I: observaciones
  sEv.getRange(rowFound + 1, 12).setValue("EDICION");                          // Col L: tipo_registro
  sEv.getRange(rowFound + 1, 13).setValue(new Date());                         // Col M: fecha_edicion
  sEv.getRange(rowFound + 1, 14).setValue(userEmail);                          // Col N: usuario_edicion

  // --- REGISTRAR EN BITÁCORA ---
  let sBit = getSheet(ss, S_BITACORA);
  if (!sBit) {
    sBit = ss.insertSheet(S_BITACORA);
    sBit.appendRow([
      "Fecha Cambio", "Usuario Email", "Parcial", "Equipo ID", "Equipo Nombre",
      "Materia", "Alumno", "Puntaje Anterior", "Puntaje Nuevo",
      "Obs Anterior", "Obs Nueva", "Motivo"
    ]);
    sBit.getRange(1, 1, 1, 12).setBackground('#fef3c7').setFontWeight('bold');
  }
  sBit.appendRow([
    new Date(),
    userEmail,
    body.parcial,
    body.equipoId,
    String(body.equipoNombre || ""),
    body.materia,
    body.alumno,
    puntajeAnterior,
    nuevoPuntaje,
    obsAnterior,
    nuevaObs,
    motivo
  ]);

  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// MÓDULO CALENDARIO INSTITUCIONAL — v2.0
// Unifica lectura de cumpleaños y eventos para frontend
// ============================================================
function getCalendarioData(ss) {
  let cumpleanos = [];
  let eventos = [];
  
  // 1. Leer Cumpleaños
  const shCumples = getSheet(ss, "cumpleanos");
  if (shCumples && shCumples.getLastRow() > 1) {
    const data = shCumples.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    data.slice(1).forEach(r => {
      let obj = {};
      headers.forEach((h, i) => {
        let val = r[i];
        if (h === "fecha" && val instanceof Date) {
          val = Utilities.formatDate(val, "America/Mexico_City", "yyyy-MM-dd");
        }
        obj[h] = val;
      });
      cumpleanos.push(obj);
    });
  }

  // 2. Leer Eventos y Periodos Especiales
  const shEventos = getSheet(ss, "eventos_calendario");
  if (shEventos && shEventos.getLastRow() > 1) {
    const data = shEventos.getDataRange().getValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    data.slice(1).forEach(r => {
      let obj = {};
      headers.forEach((h, i) => {
        let val = r[i];
        if ((h === "fecha_inicio" || h === "fecha_fin") && val instanceof Date) {
          val = Utilities.formatDate(val, "America/Mexico_City", "yyyy-MM-dd");
        }
        obj[h] = val;
      });
      eventos.push(obj);
    });
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    cumpleanos: cumpleanos,
    eventos: eventos
  })).setMimeType(ContentService.MimeType.JSON);
}
