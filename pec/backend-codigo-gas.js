/**
 * BACKEND PARA EL PEC - GOOGLE APPS SCRIPT
 * Copia esto en "Extensiones > Apps Script" dentro de tu Google Sheet.
 */

// Nombres de las pestañas en tu hoja de Google Sheets
const SHEET_ALUMNOS = "Alumnos";
const SHEET_EVALUACIONES = "Evaluaciones";
const SHEET_DIRECTORIO = "Directorio";
const SHEET_PROGRAMACION = "Programación";
const SHEET_TUTORIAS = "Tutorias";
const SHEET_CONFIGURACION = "Configuracion";
const SHEET_USUARIOS = "Usuarios";

const HEADERS_ALUMNOS = ["nombre_alumno", "grupo", "numero_equipo", "tema", "url_documento"];
const HEADERS_EVAL = ["fecha", "parcial", "grupoId", "equipoId", "equipoNombre", "materia", "docente", "puntaje", "observaciones", "alumno"];
const HEADERS_DIRECTORIO = ["Grupo", "Materia", "Docente", "Correo"];
const HEADERS_PROGRAMACION = ["Parcial", "Semestre", "Turno", "Materia", "Docente", "Ponderación"];
const HEADERS_TUTORIAS = ["fecha_registro", "parcial", "grupo", "nombre_estudiante", "sexo", "asignatura", "alumno_regular", "alumno_intra", "tema_asunto", "tutoria_grupal", "tutoria_individual"];

// === 1. CONFIGURACIÓN INICIAL ===
// Ejecuta esta función una sola vez para crear las hojas y cabeceras si no existen
function setupInitialize() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheetAlumnos = ss.getSheetByName(SHEET_ALUMNOS);
  if (!sheetAlumnos) {
    const s = ss.insertSheet(SHEET_ALUMNOS);
    s.appendRow(HEADERS_ALUMNOS);
  }
  
  const sheetEval = ss.getSheetByName(SHEET_EVALUACIONES);
  if (!sheetEval) {
    const s = ss.insertSheet(SHEET_EVALUACIONES);
    s.appendRow(HEADERS_EVAL);
  }

  const sheetDir = ss.getSheetByName(SHEET_DIRECTORIO);
  if (!sheetDir) {
    const s = ss.insertSheet(SHEET_DIRECTORIO);
    s.appendRow(HEADERS_DIRECTORIO);
  }

  const sheetProg = ss.getSheetByName(SHEET_PROGRAMACION);
  if (!sheetProg) {
    const s = ss.insertSheet(SHEET_PROGRAMACION);
    s.appendRow(HEADERS_PROGRAMACION);
  }

  const sheetTut = ss.getSheetByName(SHEET_TUTORIAS);
  if (!sheetTut) {
    const s = ss.insertSheet(SHEET_TUTORIAS);
    s.appendRow(HEADERS_TUTORIAS);
  }

  const sheetConf = ss.getSheetByName(SHEET_CONFIGURACION);
  if (!sheetConf) {
    const s = ss.insertSheet(SHEET_CONFIGURACION);
    s.appendRow(["Configuracion", "Valor"]);
    s.appendRow(["docente_nombre", "Felipe López Salazar"]);
  }

  const sheetUser = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheetUser) {
    const s = ss.insertSheet(SHEET_USUARIOS);
    s.appendRow(["Email", "Password", "Nombre"]);
    s.appendRow(["admin@ceb54.online", "ceb54admin", "Administrador"]);
  }
}

// === 2. METODO GET: Obtener datos de lectura ===
// Cuando el Frontend (Javascript) pide información
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. LEER EVALUACIONES Y CREAR UN MAPA DE EQUIPOS YA EVALUADOS
    const sheetEv = ss.getSheetByName(SHEET_EVALUACIONES);
    let evaluaciones = [];
    const evaluadosMap = {}; // Para saber rápido qué equipo ya fue calificado
    
    if (sheetEv) {
      const dataEv = sheetEv.getDataRange().getValues();
      if (dataEv.length > 1) { // Si hay más que la cabecera
        const headersEv = dataEv.shift();
        evaluaciones = dataEv.map(row => {
          const eqId = String(row[3]); // Ahora el equipoId es la columna D (índice 3)
          evaluadosMap[eqId] = true; // Marcamos este equipo como Evaluado
          
          return {
            fecha: row[0],
            parcial: row[1],
            grupoId: String(row[2]),
            equipoId: eqId,
            equipoNombre: row[4],
            materia: row[5],
            docente: row[6],
            puntaje: Number(row[7]),
            observaciones: row[8],
            alumno: row[9] || ""
          };
        });
      }
    }

    // 2. LEER ALUMNOS Y AGRUPARLOS MÁGICAMENTE EN EQUIPOS
    const sheetAlum = ss.getSheetByName(SHEET_ALUMNOS);
    const equiposMap = {}; 
    let sinEquipo = [];
    
    if (sheetAlum) {
      const dataAlum = sheetAlum.getDataRange().getValues();
      dataAlum.shift(); // Quita cabeceras
      
      dataAlum.forEach(row => {
        const alumno = row[1]; // Columna B: Nombre del alumno
        const grupo = String(row[2]); // Columna C: Grupo (Ej: 201)
        const numEq = String(row[4]); // Columna E: Integrantes/Número de equipo
        const tema = row[3] || "Proyecto Comunitario"; // Columna D: Tema
        const link = row[5] || ""; // Columna F: Link
        
        // Si no tiene grupo, saltar fila vacía
        if (!grupo || !alumno) return;
        
        // Si no tiene equipo asignado, registrarlo
        if (!numEq || numEq === '0' || numEq === 'undefined') {
          sinEquipo.push({ alumno: alumno, grupo: grupo });
          return;
        }
        
        // Creamos un ID único combinando grupo y número de equipo (Ej: "201-3")
        const idUnico = `${grupo}-${numEq}`;
        
        // Si el equipo no existe en nuestra memoria, lo creamos
        if (!equiposMap[idUnico]) {
          equiposMap[idUnico] = {
            id: idUnico,
            nombre: `Equipo ${numEq}`,
            grupo: grupo,
            tema: tema,
            integrantes: [],
            urlDoc: link,
            estado: evaluadosMap[idUnico] ? "Evaluado" : "Pendiente"
          };
        }
        
        // Agregamos al alumno a la lista de integrantes de ese equipo
        if (alumno) {
          equiposMap[idUnico].integrantes.push(alumno);
        }
        
        // Si este alumno sí traía el link del documento, actualizar el link del equipo
        if (!equiposMap[idUnico].urlDoc && link) {
          equiposMap[idUnico].urlDoc = link;
        }
      });
    }

    // Convertimos el "Diccionario" de equipos en una simple Lista/Array
    const equipos = Object.values(equiposMap);
    
    // Obtener grupos únicos para el filtro del Dashboard
    const gruposUnicos = [...new Set(equipos.map(e => e.grupo))].sort();

    // 3. LEER DIRECTORIO
    let directorio = [];
    const sheetDir = ss.getSheetByName(SHEET_DIRECTORIO);
    if (sheetDir) {
       const dataDir = sheetDir.getDataRange().getValues();
       if (dataDir.length > 1) {
          dataDir.shift(); // Quita cabeceras
          directorio = dataDir.map(row => ({
             grupo: String(row[0] || '').trim(),
             materia: String(row[1] || '').trim(),
             docente: String(row[2] || '').trim(),
             correo: String(row[3] || '').trim()
          })).filter(d => d.grupo !== "");
       }
    }

    // 5. LEER TUTORÍAS
    let tutorias = [];
    const sheetTut = ss.getSheetByName(SHEET_TUTORIAS);
    if (sheetTut) {
       const dataTut = sheetTut.getDataRange().getValues();
       if (dataTut.length > 1) {
          dataTut.shift();
          tutorias = dataTut.map(row => ({
             fecha: row[0],
             parcial: String(row[1] || ''),
             grupo: String(row[2] || ''),
             alumno: String(row[3] || ''),
             sexo: String(row[4] || ''),
             asignatura: String(row[5] || ''),
             regular: row[6] === 'X' || row[6] === true,
             intra: row[7] === 'X' || row[7] === true,
             tema: String(row[8] || ''),
             grupal: row[9] === 'X' || row[9] === true,
             individual: row[10] === 'X' || row[10] === true
          }));
       }
    }

    // 6. LEER CONFIGURACIÓN
    let config = { docente: "Felipe López Salazar" };
    const sheetConf = ss.getSheetByName(SHEET_CONFIGURACION);
    if (sheetConf) {
       const dataConf = sheetConf.getDataRange().getValues();
       dataConf.shift();
       dataConf.forEach(row => {
          if (row[0] === "docente_nombre") config.docente = row[1];
       });
    }

    // 7. LEER LISTA COMPLETA DE ALUMNOS (para sugerencias)
    let alumnosFull = [];
    const sheetAlFull = ss.getSheetByName(SHEET_ALUMNOS);
    if (sheetAlFull) {
       const dataAlFull = sheetAlFull.getDataRange().getValues();
       dataAlFull.shift();
       alumnosFull = dataAlFull.map(row => ({
          nombre: row[1],
          grupo: String(row[2]),
          sexo: row[6] || "" // Asumimos columna G para sexo en el futuro
       })).filter(a => a.nombre && a.grupo);
    }

    // Preparar respuesta JSON
    const payload = {
      status: "success",
      grupos: gruposUnicos,
      equipos: equipos,
      evaluaciones: evaluaciones,
      directorio: directorio,
      programacion: [], // No se usa por ahora en tutorías
      tutorias: tutorias,
      config: config,
      alumnosFull: alumnosFull,
      sinEquipo: sinEquipo || []
    };
    
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// === 3. METODO POST: Guardar una evaluación ===
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    
    // CASO A: Exportación Masiva de Sábanas de Calificaciones
    if (body.action === "export") {
      generarConcentradoDeAsignaturas(ss);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Reportes en Excel generados." })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // CASO B: Login
    if (body.action === "login") {
      const sheetUser = ss.getSheetByName(SHEET_USUARIOS);
      const dataUser = sheetUser ? sheetUser.getDataRange().getValues() : [];
      if (dataUser.length > 0) dataUser.shift();
      const found = dataUser.find(row => row[0].toLowerCase() === body.email.toLowerCase() && String(row[1]) === String(body.password));
      
      if (found) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", nombre: found[2] })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Credenciales inválidas" })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // CASO C: Guardar tutoría
    if (body.action === "saveTutoria") {
      const sheetTut = ss.getSheetByName(SHEET_TUTORIAS);
      const rowTut = [
        new Date(),
        body.parcial,
        body.grupo,
        body.alumno,
        body.sexo,
        body.asignatura,
        body.regular ? "X" : "",
        body.intra ? "X" : "",
        body.tema,
        body.grupal ? "X" : "",
        body.individual ? "X" : ""
      ];
      sheetTut.appendRow(rowTut);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Tutoría guardada." })).setMimeType(ContentService.MimeType.JSON);
    }

    // CASO D: Guardar evaluación regular
    const sheet = ss.getSheetByName(SHEET_EVALUACIONES);
    
    // Plantilla de la fila
    const baseRow = [
      new Date(), // fecha exacta
      body.parcial,
      body.grupoId,
      body.equipoId,   // Ejemplo: "201-3"
      body.equipoNombre, // Ejemplo: "Equipo 3"
      body.materia,
      body.docente,
      "", // puntaje
      body.observaciones || "",
      ""  // alumno
    ];
    
    if (body.integrantes && body.integrantes.length > 0) {
       // Insertar múltiples filas (una por alumno del equipo)
       body.integrantes.forEach(indiv => {
          const rowCopy = [...baseRow];
          rowCopy[7] = indiv.puntaje;      // Puntaje específico del alumno
          rowCopy[9] = indiv.alumno;       // Nombre del alumno específico
          sheet.appendRow(rowCopy);
       });
    } else {
       // Retro-compatibilidad (Sin desglose individual)
       baseRow[7] = body.puntaje;
       sheet.appendRow(baseRow);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Guardado" })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// === 4. FUNCIÓN INTERNA: GENERAR CONCENTRADO TIPO "SÁBANA" ===
function generarConcentradoDeAsignaturas(ss) {
  // --- A) LEER EVALUACIONES ---
  const sheetEv = ss.getSheetByName(SHEET_EVALUACIONES);
  const dataEv = sheetEv ? sheetEv.getDataRange().getValues() : [];
  if (dataEv.length > 0) dataEv.shift(); // Remove headers
  
  const scoresObj = {};
  const scoresIndiv = {};
  
  dataEv.forEach(row => {
    const parcial = String(row[1]);
    const grupoEqId = String(row[3]); // Ej: "401-1"
    const materia = String(row[5]).trim();
    const puntaje = Number(row[7]);
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

  // --- B) LEER DIRECTORIO (para saber qué materias tiene cada grupo) ---
  const sheetDir = ss.getSheetByName(SHEET_DIRECTORIO);
  const directorioMap = {}; // { "201": ["Lengua y Com...", "Pensamiento Mat..."], "401": [...] }
  
  if (sheetDir) {
    const dataDir = sheetDir.getDataRange().getValues();
    if (dataDir.length > 1) {
      dataDir.shift();
      dataDir.forEach(row => {
        const grupoDir = String(row[0] || '').trim(); // Ej: "M401", "V207"
        const materia = String(row[1] || '').trim();
        if (!grupoDir || !materia) return;
        
        // Extraer parte numérica: "M401" -> "401", "V207" -> "207"
        const grupoNum = grupoDir.replace(/^[A-Za-z]+/, '');
        
        if (!directorioMap[grupoNum]) directorioMap[grupoNum] = [];
        // Evitar duplicados
        if (!directorioMap[grupoNum].includes(materia)) {
          directorioMap[grupoNum].push(materia);
        }
      });
    }
  }

  // --- C) LEER ALUMNOS Y AGRUPAR EN EQUIPOS ---
  const sheetAlum = ss.getSheetByName(SHEET_ALUMNOS);
  if (!sheetAlum) return;
  const dataAlum = sheetAlum.getDataRange().getValues();
  dataAlum.shift();
  
  const gruposObj = {}; 
  dataAlum.forEach(row => {
    const alumno = String(row[1]);
    const grupo = String(row[2]);
    const numEq = String(row[4]);
    if(!grupo || !alumno) return;
    
    if(!gruposObj[grupo]) gruposObj[grupo] = [];
    gruposObj[grupo].push({
      alumno: alumno,
      equipo: numEq,
      scores: scoresObj[`${grupo}-${numEq}`] || {}
    });
  });

  const parciales = ["1", "2", "3"];

  // --- D) GENERAR UNA SÁBANA POR CADA GRUPO ---
  for (const [grupo, alumnos] of Object.entries(gruposObj)) {
    
    // Obtener las materias ESPECÍFICAS de este grupo desde el Directorio
    const grupoNum = grupo.replace(/^[A-Za-z]+/, '');
    const todasMaterias = directorioMap[grupoNum] || [];
    
    // Filtrar: solo materias que YA fueron evaluadas para este grupo
    const materiasEvaluadas = new Set();
    alumnos.forEach(alum => {
      // Revisar scores por equipo
      Object.values(alum.scores).forEach(parcialScores => {
        Object.keys(parcialScores).forEach(mat => materiasEvaluadas.add(mat));
      });
      // Revisar scores individuales
      if (scoresIndiv[alum.alumno]) {
        Object.values(scoresIndiv[alum.alumno]).forEach(parcialScores => {
          Object.keys(parcialScores).forEach(mat => materiasEvaluadas.add(mat));
        });
      }
    });
    
    // Conservar el orden del directorio, pero solo las evaluadas
    const materias = todasMaterias.filter(m => materiasEvaluadas.has(m));
    
    // Si no hay ninguna materia evaluada aún, saltar este grupo
    if (materias.length === 0) continue;

    const sheetName = `Sábana_${grupo}`;
    let sheetRep = ss.getSheetByName(sheetName);
    
    if(!sheetRep) {
       sheetRep = ss.insertSheet(sheetName);
    } else {
       sheetRep.clear();
    }

    // Construir cabeceras
    let fila1 = ["EQUIPO", "ESTUDIANTE"];
    let fila2 = ["", ""];
    
    parciales.forEach(parcial => {
       materias.forEach(mat => {
          fila1.push(`PARCIAL ${parcial}`);
          fila2.push(mat); 
       });
       fila1.push(`PARCIAL ${parcial}`);
       fila2.push("PROMEDIO");
    });
    
    const outputData = [fila1, fila2];
    
    // Ordenar alumnos alfabéticamente
    alumnos.sort((a,b) => a.alumno.localeCompare(b.alumno));
    
    alumnos.forEach(alum => {
       const fila = [alum.equipo, alum.alumno];
       
       parciales.forEach(parcial => {
         let subtotal = 0; let countMat = 0;
         materias.forEach(mat => {
            // Buscar calificación: primero individual, luego por equipo
            let score = "";
            
            if (scoresIndiv[alum.alumno] && scoresIndiv[alum.alumno][parcial] && scoresIndiv[alum.alumno][parcial][mat] !== undefined) {
                 score = scoresIndiv[alum.alumno][parcial][mat];
            } else if (alum.scores[parcial] && alum.scores[parcial][mat] !== undefined) {
                 score = alum.scores[parcial][mat];
            }

            fila.push(score);
            if(score !== "") { subtotal += Number(score); countMat++; }
         });
         const prom = countMat > 0 ? (subtotal / countMat).toFixed(1) : "";
         fila.push(prom);
       });
       
       outputData.push(fila);
    });

    sheetRep.getRange(1, 1, outputData.length, outputData[0].length).setValues(outputData);
    
    // Formato
    const headerRange = sheetRep.getRange(1, 1, 2, outputData[0].length);
    headerRange.setBackground('#e0f2fe').setFontWeight('bold').setWrap(true);
    sheetRep.setColumnWidth(1, 65); sheetRep.setColumnWidth(2, 280);
    for(let i = 3; i <= outputData[0].length; i++) sheetRep.setColumnWidth(i, 85);
    sheetRep.setFrozenRows(2); sheetRep.setFrozenColumns(2);
  }
}
