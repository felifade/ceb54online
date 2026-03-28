/**
 * BACKEND MAESTRO UNIFICADO: PEC + TUTORÍAS + EXPORTACIÓN
 * v3.3.1 - CORRECCIÓN: SEMESTRE Y TURNO EN PROGRAMACIÓN
 */

// --- CONFIGURACIÓN DE PESTAÑAS ---
const S_ALUMNOS = "Alumnos";
const S_EVALUACIONES = "Evaluaciones";
const S_DIRECTORIO = "Directorio";
const S_PROGRAMACION = "Programación";
const S_TUTORIAS = "Tutorias";
const S_CONFIGURACION = "Configuracion";
const S_USUARIOS = "Usuarios";

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

// === MÉTODO GET: LECTURA DE DATOS ===
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userEmail = normalizeText(e.parameter.userEmail || "");
    
    // 1. CONFIGURACIÓN
    let config = { docente: "Felipe López Salazar", parcialActivo: "2" };
    const sConf = getSheet(ss, S_CONFIGURACION);
    if (sConf) {
       const d = sConf.getDataRange().getValues();
       d.forEach(r => {
          if (normalizeText(r[0]) === "docente_nombre") config.docente = r[1];
          if (normalizeText(r[0]) === "parcial_activo") config.parcialActivo = normalizeParcial(r[1]);
       });
    }
    const parcialActivo = config.parcialActivo;

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
    
    if (sAlum) {
      const d = sAlum.getDataRange().getValues();
      if(d.length > 1) {
        d.shift();
        d.forEach(r => {
          const nom = String(r[1] || "").trim(); const grp = String(r[2] || "").trim();
          const nEq = String(r[4] || "").trim(); const sex = String(r[6] || "H").toUpperCase();
          if (!nom) return;
          alumnosFull.push({ nombre: nom, grupo: grp, sexo: sex });
          if (grp && nEq !== "0" && nEq !== "") {
            gruposConEquipos.add(grp);
            const id = `${grp}-${nEq}`;
            if (!equiposMap[id]) {
              equiposMap[id] = { id: id, nombre: `Equipo ${nEq}`, grupo: grp, tema: r[3] || "Proyecto", integrantes: [], urlDoc: r[5] || "", estado: "Pendiente" };
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
       directorio = d.map(r => ({ grupo: String(r[0]||'').trim(), materia: String(r[1]||'').trim(), docente: String(r[2]||'').trim(), correo: normalizeText(r[3]) })).filter(x => x.grupo !== "");
    }
    let sheetProg = getSheet(ss, S_PROGRAMACION);
    let programacion = []; 
    if (sheetProg) {
       const d = sheetProg.getDataRange().getValues(); d.shift();
       programacion = d.map(r => ({ 
         parcial: normalizeParcial(r[0]), 
         semestre: String(r[1]||'').trim(), // <--- CORREGIDO (v3.3.1)
         turno: String(r[2]||'').trim(),    // <--- CORREGIDO (v3.3.1)
         materia: String(r[3]||'').trim(), 
         ponderacion: Number(r[5] || 0), // Columna F
         grupoEspecial: String(r[6]||'').trim(), // Columna G
         correoDocente: normalizeText(r[7]) 
       }));
    }

    // 5. CÁLCULO DE ACCESO PEC (v3.3 - Prioridad Columna G)
    let gruposDelDocente = [];
    let audit = { email: userEmail, role: userRole, materias: [], gDirectos: [], gEspeciales: [] };
    
    if (isAdmin) {
      gruposDelDocente = [...new Set([...gruposConEquipos, ...directorio.map(d => d.grupo)])].sort();
    } else if (userEmail !== "") {
      const misProgramas = programacion.filter(p => p.correoDocente === userEmail && p.parcial === parcialActivo);
      const tempGrupos = [];

      misProgramas.forEach(p => {
          audit.materias.push(normalizeText(p.materia));
          if (p.grupoEspecial && p.grupoEspecial !== "") {
              // OPCIÓN A: Prioridad Grupo Especial (Escrito en Columna G)
              const esp = p.grupoEspecial.split(',').map(g => g.trim());
              tempGrupos.push(...esp);
              audit.gEspeciales.push(...esp);
          } else {
              // OPCIÓN B: Búsqueda cruzada por materia y correo en el Directorio
              const matches = directorio.filter(d => d.correo === userEmail && normalizeText(d.materia) === normalizeText(p.materia));
              tempGrupos.push(...matches.map(m => m.grupo));
              audit.gDirectos.push(...matches.map(m => m.grupo));
          }
      });
      gruposDelDocente = [...new Set(tempGrupos)].filter(g => g !== "").sort();
    }

    // 6. HISTORIAL TUTORÍAS
    const sTut = getSheet(ss, S_TUTORIAS);
    let tutoriasData = [];
    if (sTut) {
       const d = sTut.getDataRange().getValues();
       if(d.length > 1) {
         d.shift();
         tutoriasData = d.map(r => ({ 
            fecha: r[0], parcial: r[1], semestre: r[2], turno: r[3], grupo: r[4], 
            alumno: r[5], sexo: r[6]||"H", motivo: r[7], acuerdos: r[8], 
            tipo: r[9], individual: r[9]==="Individual", grupal: r[9]==="Grupal", 
            docente_email: normalizeText(r[10]),
            asistencia: r[11] || "SÍ" // <--- NUEVO CAMPO (v3.3)
         }));
         if (!isAdmin && userEmail !== "") tutoriasData = tutoriasData.filter(x => x.docente_email === userEmail);
       }
    }

    // 7. EVALUACIONES PEC
    const sEv = getSheet(ss, S_EVALUACIONES);
    const evMap = {}; let evaluaciones = []; let totalGlobalEv = 0;
    if (sEv) {
       const d = sEv.getDataRange().getValues(); d.shift();
       const evRaw = d.map(r => { evMap[String(r[3])] = true; return { parcial: String(r[1]), equipoId: String(r[3]), docenteEmail: normalizeText(r[10]) }; });
       totalGlobalEv = evRaw.length;
       evaluaciones = [...evRaw];
       if (!isAdmin && userEmail !== "") evaluaciones = evaluaciones.filter(x => x.docenteEmail === userEmail);
    }
    const listaEquipos = Object.values(equiposMap).map(eq => { if (evMap[eq.id]) eq.estado = "Evaluado"; return eq; });

    // 8. AVANCE DOCENTE
    let avance = { total: 0, evaluados: 0, porcentaje: 0 };
    if (gruposDelDocente.length > 0) {
      const gN = gruposDelDocente.map(g => String(g).replace(/^[A-Za-z]+/, ''));
      const eqs = listaEquipos.filter(eq => gN.includes(String(eq.grupo).replace(/^[A-Za-z]+/, '')));
      avance.total = eqs.length;
      avance.evaluados = eqs.filter(eq => eq.estado === 'Evaluado').length;
      avance.pendientes = avance.total - avance.evaluados; 
      avance.porcentaje = avance.total === 0 ? 0 : Math.round((avance.evaluados / avance.total) * 100);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success", config: config, grupos: [...gruposConEquipos], equipos: listaEquipos, evaluaciones: evaluaciones,
      tutorias: tutoriasData, alumnosFull: alumnosFull, directorio: directorio, programacion: programacion,
      isAdmin: isAdmin, gruposDelDocente: gruposDelDocente, parcialActivo: parcialActivo, avanceDocente: avance, audit: audit,
      totalEquiposGlobal: listaEquipos.length, totalEvaluacionesGlobal: totalGlobalEv 
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
      if (f) return ContentService.createTextOutput(JSON.stringify({ status: "success", nombre: f[2], rol: f[3]||"Docente" }));
      return ContentService.createTextOutput("error INVALIDO");
    }

    // EXPORTAR SÁBANA (PEC)
    if (action === "export") {
      generarConcentradoDeAsignaturas(ss);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Reportes generados" }));
    }

    // TUTORÍAS: GUARDAR / ELIMINAR / EDITAR
    if (action === "saveTutoria") {
      const s = getSheet(ss, S_TUTORIAS);
      s.appendRow([
        body.fecha||new Date(), 
        body.parcial, 
        body.semestre, 
        body.turno, 
        body.grupo, 
        body.alumno, 
        body.sexo, 
        body.motivo, 
        body.acuerdos, 
        body.tipo, 
        normalizeText(body.docente_email),
        body.asistencia || "SÍ" 
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }
    if (action === "deleteTutoria") {
      const s = getSheet(ss, S_TUTORIAS); const d = s.getDataRange().getValues();
      const tF = new Date(body.fecha).getTime(); const tA = String(body.alumno).trim();
      for(let i=d.length-1; i>=1; i--) { if(new Date(d[i][0]).getTime()===tF && String(d[i][5]).trim()===tA){ s.deleteRow(i+1); break; } }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }
    if (action === "updateTutoriaField") {
       const s = getSheet(ss, S_TUTORIAS); const d = s.getDataRange().getValues();
       const tF = new Date(body.fecha).getTime(); const tA = String(body.alumno).trim();
       const m = { "sexo": 6, "motivo": 7, "acuerdos": 8, "asistencia": 11 }; 
       const col = m[body.column];
       if (col !== undefined) {
         for(let i=1; i<d.length; i++){ if(new Date(d[i][0]).getTime()===tF && String(d[i][5]).trim()===tA){ s.getRange(i+1, col+1).setValue(body.value); break; } }
       }
       return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
    }

    // PEC: GUARDAR EVALUACIÓN
    const sEv = getSheet(ss, S_EVALUACIONES);
    const base = [new Date(), body.parcial, body.grupoId, body.equipoId, body.equipoNombre, body.materia, body.docente, "", body.observaciones||"", "", normalizeText(body.docente_email)];
    if (body.integrantes && body.integrantes.length > 0) {
       body.integrantes.forEach(i => { const r = [...base]; r[7]=i.puntaje; r[9]=i.alumno; sEv.appendRow(r); });
    } else {
       base[7]=body.puntaje; sEv.appendRow(base);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }));

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }));
  }
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
        if(!scI[al]) scI[al] = {}; if(!scI[al][parc]) scI[al][parc] = {};
        scI[al][parc][mat] = Math.max(scI[al][parc][mat] || 0, pts);
    } else {
        if(!scObj[eqId]) scObj[eqId] = {}; if(!scObj[eqId][parc]) scObj[eqId][parc] = {};
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
    if(!gr || !al) return; if(!gO[gr]) gO[gr] = [];
    gO[gr].push({ al: al, eq: eq, sc: scObj[`${gr}-${eq}`] || {} });
  });

  const parcs = ["1", "2", "3"];
  for (const [gr, als] of Object.entries(gO)) {
    const grN = gr.replace(/^[A-Za-z]+/, '');
    const tMats = dirMap[grN] || [];
    const mE = new Set();
    als.forEach(a => {
      Object.values(a.sc).forEach(pS => Object.keys(pS).forEach(m => mE.add(m)));
      if(scI[a.al]) Object.values(scI[a.al]).forEach(pS => Object.keys(pS).forEach(m => mE.add(m)));
    });
    const mats = tMats.filter(m => mE.has(m));
    if (mats.length === 0) continue;

    const sN = `Sabana_${gr}`;
    let sR = ss.getSheetByName(sN) || ss.insertSheet(sN); sR.clear();
    let f1 = ["EQUIPO", "ESTUDIANTE"]; let f2 = ["", ""];
    parcs.forEach(p => { mats.forEach(m => { f1.push(`PARCIAL ${p}`); f2.push(m); }); f1.push(`PARCIAL ${p}`); f2.push("PROM"); });
    const out = [f1, f2];
    als.sort((a,b) => a.al.localeCompare(b.al)).forEach(a => {
       const f = [a.eq, a.al];
       parcs.forEach(p => {
         let sub = 0; let c = 0;
         mats.forEach(m => {
            let s = ""; if (scI[a.al] && scI[a.al][p] && scI[a.al][p][m] !== undefined) s = scI[a.al][p][m];
            else if (a.sc[p] && a.sc[p][m] !== undefined) s = a.sc[p][m];
            f.push(s); if(s !== "") { sub += Number(s); c++; }
         });
         f.push(c > 0 ? (sub / c).toFixed(1) : "");
       });
       out.push(f);
    });
    sR.getRange(1, 1, out.length, out[0].length).setValues(out);
    sR.getRange(1, 1, 2, out[0].length).setBackground('#e0f2fe').setFontWeight('bold');
  }
}
