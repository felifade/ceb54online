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

    // Acción especial: calificaciones por parcial
    if (e.parameter.action === "getCalificaciones") {
      return doGetCalificaciones(e, ss);
    }
    const userEmail = normalizeText(e.parameter.userEmail || "");

    // 1. CONFIGURACIÓN
    let config = { docente: "Felipe López Salazar", parcialActivo: "2" };
    const sConf = getSheet(ss, S_CONFIGURACION);
    if (sConf) {
      const d = sConf.getDataRange().getValues();
      d.forEach(r => {
        if (!r[0]) return;
        const key = String(r[0]).trim();
        const keyNorm = normalizeText(key);
        if (keyNorm === "docente_nombre") config.docente = r[1];
        else if (keyNorm === "parcial_activo") config.parcialActivo = normalizeParcial(r[1]);
        else config[key] = r[1]; // Captura todas las demás claves (ej: pec_2m_nombre, etc.)
      });
    }
    const parcialActivo = config.parcialActivo;

    // Fechas límite por parcial
    let fechas = { p1: "", p2: "", p3: "" };
    if (sConf) {
      const d = sConf.getDataRange().getValues();
      d.forEach(r => {
        const key = normalizeText(r[0]);
        if (key === "cal_p1_fecha") fechas.p1 = String(r[1] || "").trim();
        if (key === "cal_p2_fecha") fechas.p2 = String(r[1] || "").trim();
        if (key === "cal_p3_fecha") fechas.p3 = String(r[1] || "").trim();
      });
    }

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

    // Mapa de evaluados para rapidez
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
          asistencia: String(r[12] || "SÍ").trim().toUpperCase()
        }));
        if (!isAdmin && userEmail !== "") tutoriasData = tutoriasData.filter(x => x.docenteEmail === userEmail);
      }
    }

    // 7. EVALUACIONES PEC
    const sEv = getSheet(ss, S_EVALUACIONES);
    let evaluaciones = [];
    if (sEv) {
      const d = sEv.getDataRange().getValues(); d.shift();
      const evRaw = d.map(r => ({
        fecha: r[0],
        parcial: r[1],
        grupoId: String(r[2]),
        equipoId: String(r[3]),
        equipoNombre: String(r[4] || ''),
        materia: String(r[5] || ''),
        docente: String(r[6] || ''),
        puntaje: Number(r[7] || 0),
        observaciones: r[8] || "",
        alumno: String(r[9] || ''),
        docenteEmail: normalizeText(r[10])
      }));
      evaluaciones = [...evRaw];
      if (!isAdmin && userEmail !== "") evaluaciones = evaluaciones.filter(x => x.docenteEmail === userEmail);
    }
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


    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      feedbackHistory: feedbackHistory,
      config: config,
      grupos: [...gruposConEquipos],
      equipos: listaEquipos,
      evaluaciones: evaluaciones,
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
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
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
          normalizeText(body.docente_email)
        ]);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    if (action === "deleteTutoria") {
      const s = getSheet(ss, S_TUTORIAS); const d = s.getDataRange().getValues();
      const tF = new Date(body.fecha).getTime(); const tA = String(body.alumno).trim();
      for (let i = d.length - 1; i >= 1; i--) {
        if (Math.abs(new Date(d[i][0]).getTime() - tF) < 10000 && String(d[i][3]).trim() === tA) { s.deleteRow(i + 1); break; }
      }
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

    // PEC: GUARDAR EVALUACIÓN
    const sEv = getSheet(ss, S_EVALUACIONES);
    const base = [new Date(), body.parcial, body.grupoId, body.equipoId, body.equipoNombre, body.materia, body.docente, "", body.observaciones || "", "", normalizeText(body.docente_email)];
    if (body.integrantes && body.integrantes.length > 0) {
      body.integrantes.forEach(i => { const r = [...base]; r[7] = i.puntaje; r[9] = i.alumno; sEv.appendRow(r); });
    } else {
      base[7] = body.puntaje; sEv.appendRow(base);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }));

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }));
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
