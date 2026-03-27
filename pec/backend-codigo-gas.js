/**
 * BACKEND PARA EL PEC - GOOGLE APPS SCRIPT
 * v2.2 - RECONSTRUCCIÓN COMPLETA CON CONTROL DE ACCESO Y EXPORTACIÓN
 */

// Nombres de las pestañas
const SHEET_ALUMNOS = "Alumnos";
const SHEET_EVALUACIONES = "Evaluaciones";
const SHEET_DIRECTORIO = "Directorio";
const SHEET_PROGRAMACION = "Programación";
const SHEET_TUTORIAS = "Tutorias";
const SHEET_CONFIGURACION = "Configuracion";
const SHEET_USUARIOS = "Usuarios";

const HEADERS_ALUMNOS = ["nombre_alumno", "grupo", "numero_equipo", "tema", "url_documento"];
const HEADERS_EVAL = ["fecha", "parcial", "grupoId", "equipoId", "equipoNombre", "materia", "docente", "puntaje", "observaciones", "alumno", "docente_email"];
const HEADERS_DIRECTORIO = ["Grupo", "Materia", "Docente", "Correo"];
const HEADERS_PROGRAMACION = ["Parcial", "Semestre", "Turno", "Materia", "Docente", "Ponderación", "grupoEspecial", "correo_docente"];

function normalize(val) {
  if (!val) return "";
  return String(val).toLowerCase().trim();
}

function normalizeParcial(val) {
  if (!val) return "";
  const match = String(val).match(/\d+/);
  return match ? match[0] : String(val).trim();
}

// === METODO GET ===
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userEmail = normalize(e.parameter.userEmail || "");
    let debugLog = [];

    // 1. LEER CONFIGURACIÓN
    let config = { docente: "Felipe López Salazar", parcialActivo: "2" };
    const sheetConf = ss.getSheetByName(SHEET_CONFIGURACION);
    if (sheetConf) {
       const dataConf = sheetConf.getDataRange().getValues();
       dataConf.forEach(row => {
          if (normalize(row[0]) === "docente_nombre") config.docente = row[1];
          if (normalize(row[0]) === "parcial_activo") config.parcialActivo = normalizeParcial(row[1]);
       });
    }
    const parcialActivo = config.parcialActivo;

    // 2. VERIFICAR ROL
    let userRole = "Docente";
    const sheetUsr = ss.getSheetByName(SHEET_USUARIOS);
    if (sheetUsr) {
      const dataUsr = sheetUsr.getDataRange().getValues();
      const userFound = dataUsr.find(r => normalize(r[0]) === userEmail);
      if (userFound) userRole = String(userFound[3] || "Docente").trim();
    }
    const isAdmin = userRole.toLowerCase() === "admin" || userEmail === "admin@ceb54.online";

    // 3. LEER EQUIPOS (Desde Alumnos)
    const sheetAlum = ss.getSheetByName(SHEET_ALUMNOS);
    const equiposMap = {}; 
    let gruposConEquipos = new Set();
    
    if (sheetAlum) {
      const dataAlum = sheetAlum.getDataRange().getValues();
      if(dataAlum.length > 1) {
        dataAlum.shift();
        dataAlum.forEach(row => {
          const alumno = row[1]; const grupo = String(row[2] || "").trim();
          const numEq = String(row[4] || "").trim();
          if (!grupo || !alumno || numEq === "0" || numEq === "") return;
          
          gruposConEquipos.add(grupo);
          const idUnico = `${grupo}-${numEq}`;
          if (!equiposMap[idUnico]) {
            equiposMap[idUnico] = { id: idUnico, nombre: `Equipo ${numEq}`, grupo: grupo, tema: row[3] || "Proyecto", integrantes: [], urlDoc: row[5] || "", estado: "Pendiente" };
          }
          equiposMap[idUnico].integrantes.push(alumno);
        });
      }
    }
    const gruposUnicos = [...gruposConEquipos];

    // 4. LEER DIRECTORIO
    let directorio = [];
    const sheetDir = ss.getSheetByName(SHEET_DIRECTORIO);
    if (sheetDir) {
       const dataDir = sheetDir.getDataRange().getValues();
       if(dataDir.length > 1) {
         dataDir.shift();
         directorio = dataDir.map(row => ({
            grupo: String(row[0] || '').trim(),
            materia: String(row[1] || '').trim(),
            docente: String(row[2] || '').trim(),
            correo: normalize(row[3])
         })).filter(d => d.grupo !== "");
       }
    }

    // 5. LEER PROGRAMACIÓN
    let programacion = [];
    let sheetProg = ss.getSheetByName(SHEET_PROGRAMACION) || ss.getSheetByName("Programacion");
    if (sheetProg) {
       const dataProg = sheetProg.getDataRange().getValues();
       if(dataProg.length > 1) {
         dataProg.shift();
         programacion = dataProg.map(row => ({
            parcial: normalizeParcial(row[0]),
            semestre: String(row[1] || ''),
            turno: String(row[2] || '').toUpperCase(),
            materia: String(row[3] || '').trim(),
            docente: String(row[4] || ''),
            ponderacion: Number(row[5] || 0),
            grupoEspecial: String(row[6] || ''),
            correoDocente: normalize(row[7])
         }));
       }
    }

    // 6. CÁLCULO DE GRUPOS DEL DOCENTE
    let gruposDelDocente = [];
    if (isAdmin) {
      gruposDelDocente = [...new Set([...gruposUnicos, ...directorio.map(d => d.grupo)])].sort();
    } else if (userEmail && userEmail !== "") {
      // 1. Grupos donde su correo aparece directo en el Directorio (Validando que no sea vacío)
      const gruposDirectos = directorio
        .filter(d => d.correo !== "" && d.correo === userEmail)
        .map(d => d.grupo);

      // 2. Grupos por materia en Programación (Validando que no sea vacío)
      const materiasEnParcial = programacion
        .filter(p => p.correoDocente !== "" && p.correoDocente === userEmail && p.parcial === parcialActivo)
        .map(p => normalize(p.materia));
      
      const gruposPorMateria = directorio
        .filter(d => materiasEnParcial.length > 0 && materiasEnParcial.includes(normalize(d.materia)))
        .map(d => d.grupo);
      
      gruposDelDocente = [...new Set([...gruposDirectos, ...gruposPorMateria])].filter(g => g !== "").sort();
    }

    // 7. CALCULAR AVANCE
    const sheetEv = ss.getSheetByName(SHEET_EVALUACIONES);
    let evaluaciones = [];
    const evaluadosMap = {};
    if (sheetEv) {
       const dataEv = sheetEv.getDataRange().getValues();
       if(dataEv.length > 1) {
         dataEv.shift();
         evaluaciones = dataEv.map(row => {
           const id = String(row[3]);
           evaluadosMap[id] = true;
           return { fecha: row[0], parcial: row[1], grupoId: String(row[2]), equipoId: id, equipoNombre: row[4], materia: row[5], docente: row[6], puntaje: Number(row[7]), observaciones: row[8], alumno: row[9], docenteEmail: normalize(row[10]) };
         });
         // Filtrar dashboard docente
         if (!isAdmin) evaluaciones = evaluaciones.filter(ev => ev.docenteEmail === userEmail || ev.docenteEmail === "");
       }
    }

    // Actualizar estados de equipos con evaluados
    const listaEquipos = Object.values(equiposMap).map(eq => {
       if (evaluadosMap[eq.id]) eq.estado = "Evaluado";
       return eq;
    });

    let avanceDocente = { total: 0, evaluados: 0, pendientes: 0, porcentaje: 0 };
    if (gruposDelDocente.length > 0) {
      // Normalizar mi lista de grupos (ej: ["M201"] -> ["201"])
      const misGruposNorm = gruposDelDocente.map(g => String(g || "").replace(/^[A-Za-z]+/, ''));
      
      // Filtrar equipos que pertenecen a mis grupos normalizados
      const eqsMiAcceso = listaEquipos.filter(eq => {
          const eqNorm = String(eq.grupo || "").replace(/^[A-Za-z]+/, '');
          return misGruposNorm.includes(eqNorm);
      });
      
      avanceDocente.total = eqsMiAcceso.length;
      avanceDocente.evaluados = eqsMiAcceso.filter(eq => eq.estado === 'Evaluado').length;
      avanceDocente.pendientes = avanceDocente.total - avanceDocente.evaluados;
      avanceDocente.porcentaje = avanceDocente.total === 0 ? 0 : Math.round((avanceDocente.evaluados / avanceDocente.total) * 100);
    }

    const payload = {
      status: "success",
      grupos: gruposUnicos,
      equipos: listaEquipos,
      evaluaciones: evaluaciones,
      directorio: directorio,
      programacion: programacion,
      isAdmin: isAdmin,
      gruposDelDocente: gruposDelDocente,
      parcialActivo: parcialActivo,
      avanceDocente: avanceDocente,
      sinEquipo: [] // omitido para brevedad en debug
    };
    
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// === METODO POST ===
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    
    if (body.action === "export") {
      generarConcentradoDeAsignaturas(ss);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Reportes generados." })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (body.action === "login") {
      const sheetUser = ss.getSheetByName(SHEET_USUARIOS);
      const dataUser = sheetUser.getDataRange().getValues();
      dataUser.shift();
      const found = dataUser.find(row => normalize(row[0]) === normalize(body.email) && String(row[1]) === String(body.password));
      if (found) return ContentService.createTextOutput(JSON.stringify({ status: "success", nombre: found[2], rol: found[3] || "Docente" })).setMimeType(ContentService.MimeType.JSON);
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Inválido" })).setMimeType(ContentService.MimeType.JSON);
    }

    const sheetEval = ss.getSheetByName(SHEET_EVALUACIONES);
    const baseRow = [new Date(), body.parcial, body.grupoId, body.equipoId, body.equipoNombre, body.materia, body.docente, "", body.observaciones || "", "", normalize(body.docente_email)];
    
    if (body.integrantes && body.integrantes.length > 0) {
       body.integrantes.forEach(indiv => {
          const rowCopy = [...baseRow]; rowCopy[7] = indiv.puntaje; rowCopy[9] = indiv.alumno;       
          sheetEval.appendRow(rowCopy);
       });
    } else {
       baseRow[7] = body.puntaje;
       sheetEval.appendRow(baseRow);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// FUNCIÓN DE EXPORTACIÓN (LA "SÁBANA")
function generarConcentradoDeAsignaturas(ss) {
  const sheetEv = ss.getSheetByName(SHEET_EVALUACIONES);
  const dataEv = sheetEv ? sheetEv.getDataRange().getValues() : [];
  if (dataEv.length > 0) dataEv.shift();
  
  const scoresObj = {}; const scoresIndiv = {};
  dataEv.forEach(row => {
    const parcial = String(row[1]); const grupoEqId = String(row[3]);
    const materia = String(row[5]).trim(); const puntaje = Number(row[7]);
    const alumnoNom = row[9] ? String(row[9]).trim() : "";
    if (alumnoNom) {
        if(!scoresIndiv[alumnoNom]) scoresIndiv[alumnoNom] = {};
        if(!scoresIndiv[alumnoNom][parcial]) scoresIndiv[alumnoNom][parcial] = {};
        scoresIndiv[alumnoNom][parcial][materia] = Math.max(scoresIndiv[alumnoNom][parcial][materia] || 0, puntaje);
    } else {
        if(!scoresObj[grupoEqId]) scoresObj[grupoEqId] = {};
        if(!scoresObj[grupoEqId][parcial]) scoresObj[grupoEqId][parcial] = {};
        scoresObj[grupoEqId][parcial][materia] = Math.max(scoresObj[grupoEqId][parcial][materia] || 0, puntaje);
    }
  });

  const sheetDir = ss.getSheetByName(SHEET_DIRECTORIO);
  const directorioMap = {};
  if (sheetDir) {
    const dataDir = sheetDir.getDataRange().getValues();
    if (dataDir.length > 1) {
      dataDir.shift();
      dataDir.forEach(row => {
        const grupoNum = String(row[0] || "").replace(/^[A-Za-z]+/, '');
        const materia = String(row[1] || '').trim();
        if (!directorioMap[grupoNum]) directorioMap[grupoNum] = [];
        if (!directorioMap[grupoNum].includes(materia)) directorioMap[grupoNum].push(materia);
      });
    }
  }

  const sheetAlum = ss.getSheetByName(SHEET_ALUMNOS);
  const dataAlum = sheetAlum ? sheetAlum.getDataRange().getValues() : [];
  dataAlum.shift();
  
  const gruposObj = {}; 
  dataAlum.forEach(row => {
    const alumno = String(row[1]); const grupo = String(row[2]); const numEq = String(row[4]);
    if(!grupo || !alumno) return;
    if(!gruposObj[grupo]) gruposObj[grupo] = [];
    gruposObj[grupo].push({ alumno: alumno, equipo: numEq, scores: scoresObj[`${grupo}-${numEq}`] || {} });
  });

  const parciales = ["1", "2", "3"];
  for (const [grupo, alumnos] of Object.entries(gruposObj)) {
    const grupoNum = grupo.replace(/^[A-Za-z]+/, '');
    const todasMaterias = directorioMap[grupoNum] || [];
    const materiasEvaluadas = new Set();
    alumnos.forEach(alum => {
      Object.values(alum.scores).forEach(pS => Object.keys(pS).forEach(m => materiasEvaluadas.add(m)));
      if (scoresIndiv[alum.alumno]) Object.values(scoresIndiv[alum.alumno]).forEach(pS => Object.keys(pS).forEach(m => materiasEvaluadas.add(m)));
    });
    const materias = todasMaterias.filter(m => materiasEvaluadas.has(m));
    if (materias.length === 0) continue;

    const sheetName = `Sábana_${grupo}`;
    let sheetRep = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    sheetRep.clear();

    let fila1 = ["EQUIPO", "ESTUDIANTE"]; let fila2 = ["", ""];
    parciales.forEach(p => {
       materias.forEach(m => { fila1.push(`PARCIAL ${p}`); fila2.push(m); });
       fila1.push(`PARCIAL ${p}`); fila2.push("PROMEDIO");
    });
    const outputData = [fila1, fila2];
    alumnos.sort((a,b) => a.alumno.localeCompare(b.alumno));
    alumnos.forEach(alum => {
       const fila = [alum.equipo, alum.alumno];
       parciales.forEach(p => {
         let sub = 0; let c = 0;
         materias.forEach(m => {
            let s = "";
            if (scoresIndiv[alum.alumno] && scoresIndiv[alum.alumno][p] && scoresIndiv[alum.alumno][p][m] !== undefined) s = scoresIndiv[alum.alumno][p][m];
            else if (alum.scores[p] && alum.scores[p][m] !== undefined) s = alum.scores[p][m];
            fila.push(s); if(s !== "") { sub += Number(s); c++; }
         });
         fila.push(c > 0 ? (sub / c).toFixed(1) : "");
       });
       outputData.push(fila);
    });
    sheetRep.getRange(1, 1, outputData.length, outputData[0].length).setValues(outputData);
    sheetRep.getRange(1, 1, 2, outputData[0].length).setBackground('#e0f2fe').setFontWeight('bold');
  }
}
