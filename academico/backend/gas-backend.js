/**
 * GAS Backend — Sistema de Analítica Académica CEB 5/4
 * Google Apps Script — despliega como Web App (Ejecutar como: Yo, Acceso: Cualquiera)
 *
 * HOJAS REQUERIDAS EN EL SPREADSHEET:
 *   Acad_Alumnos        — catálogo maestro de alumnos
 *   Acad_Calificaciones — tabla de hechos (una fila = alumno × materia × parcial)
 *   Acad_Materias       — catálogo de materias con docente
 *   Acad_Config         — parámetros del sistema
 */

// ── ID del Spreadsheet (hoja PEC — misma donde está el Directorio) ─────────
const SS_ID       = "1KR8f7ObGmO8F2dVgJepKpKYBeMEktBme2jTTbImS8nM";
const CLAVE_ADMIN = "ceb54admin2026";

// GAS maneja CORS automáticamente cuando el despliegue es "Cualquiera"
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ROUTER GET ─────────────────────────────────────────────────────────────
function doGet(e) {
  const p = e.parameter || {};
  try {
    switch (p.action) {
      case "getDashboard":  return json(getDashboard(p));
      case "getAlumnos":    return json(getAlumnos(p));
      case "getGrupos":     return json(getGrupos());
      case "getMaterias":   return json(getMaterias());
      case "getIndicadores":  return json(getIndicadores(p));
      case "getAlumnosGrupo": return json(getAlumnosGrupo(p));
      case "getCumpleanos":   return json(getCumpleanos());
      default:                return json({ status: "ok", sistema: "CEB54 Academico v1" });
    }
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}


// ── ROUTER POST ────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.clave !== CLAVE_ADMIN) return json({ status: "error", message: "No autorizado" });

    switch (body.action) {
      case "importarPDF":  return json(importarDesdeParser(body.data));
      case "limpiarParcial": return json(limpiarParcial(body.grupo, body.parcial, body.ciclo));
      default:             return json({ status: "error", message: "Acción desconocida" });
    }
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  IMPORTAR DESDE PARSER
//  Recibe el JSON que produce upload.html y escribe en Alumnos + Calificaciones
// ════════════════════════════════════════════════════════════════════════════
function importarDesdeParser(data) {
  const ss = SpreadsheetApp.openById(SS_ID);

  const shAlumnos = getOrCreateSheet(ss, "Acad_Alumnos");
  const shCals    = getOrCreateSheet(ss, "Acad_Calificaciones");
  const shNorm    = getOrCreateSheet(ss, "calificaciones_normalizadas");

  // Encabezados si la hoja está vacía
  if (shAlumnos.getLastRow() === 0) {
    shAlumnos.appendRow(["curp","nombre","grupo","semestre","turno","ciclo","sexo","activo"]);
  }
  if (shCals.getLastRow() === 0) {
    shCals.appendRow(["id","curp","nombre","grupo","semestre","turno","ciclo",
                      "parcial","materia","calificacion","faltas","sinDatos",
                      "promedio","enRiesgo","fuente","timestamp"]);
  }
  if (shNorm.getLastRow() === 0) {
    shNorm.appendRow([
      "id","ciclo","parcial","semestre","turno","grupo","curp","nombre_alumno","sexo",
      "materia_pdf_original","materia_normalizada","posicion_columna",
      "docente","correo_docente","calificacion","faltas","sd",
      "promedio_alumno","en_riesgo","pending_review","archivo_origen","fecha_importacion"
    ]);
  }

  // ── Leer CURPs ya registrados ────────────────────────────────────────────
  const curpsExistentes = new Set(
    shAlumnos.getLastRow() > 1
      ? shAlumnos.getRange(2, 1, shAlumnos.getLastRow() - 1, 1).getValues().flat()
      : []
  );

  // ── Leer combinaciones ya guardadas en Acad_Calificaciones ───────────────
  let calsExistentes = new Set();
  if (shCals.getLastRow() > 1) {
    const calsData = shCals.getRange(2, 2, shCals.getLastRow() - 1, 8).getValues();
    calsData.forEach(r => {
      // r: curp|nombre|grupo|semestre|turno|ciclo|parcial|materia
      calsExistentes.add(`${r[0]}|${r[5]}|${r[6]}|${r[7]}`);
    });
  }

  // ── Leer combinaciones ya guardadas en calificaciones_normalizadas ────────
  // Cols (0-based desde B): B=ciclo, C=parcial, D=semestre, E=turno, F=grupo,
  //                          G=curp, H=nombre, I=sexo, J=mat_orig, K=mat_norm
  let normExistentes = new Set();
  if (shNorm.getLastRow() > 1) {
    const normData = shNorm.getRange(2, 2, shNorm.getLastRow() - 1, 10).getValues();
    normData.forEach(r => {
      // key: curp(r[5]) | ciclo(r[0]) | parcial(r[1]) | materia_normalizada(r[9])
      normExistentes.add(`${r[5]}|${r[0]}|${r[1]}|${r[9]}`);
    });
  }

  // ── Directorio para lookup docente/correo ────────────────────────────────
  const dir = leerDirectorioPEC();

  let insertadosAlumnos = 0;
  let insertadasCals    = 0;
  let insertadasNorm    = 0;
  let duplicados        = 0;
  const errores         = [];

  const fuente    = `PDF_${data.meta.grupo}_p${data.meta.parcial}_${Utilities.formatDate(new Date(), "America/Mexico_City", "yyyyMMdd")}`;
  const timestamp = Utilities.formatDate(new Date(), "America/Mexico_City", "yyyy-MM-dd HH:mm:ss");

  const rowsAlumnos = [];
  const rowsCals    = [];
  const rowsNorm    = [];
  let idBase        = shCals.getLastRow();
  let idNorm        = shNorm.getLastRow();

  data.alumnos.forEach(al => {
    // ── Upsert Alumnos ─────────────────────────────────────────────────────
    if (!curpsExistentes.has(al.curp)) {
      rowsAlumnos.push([al.curp, al.nombre, al.grupo, al.semestre,
                        al.turno, al.ciclo, al.sexo, true]);
      curpsExistentes.add(al.curp);
      insertadosAlumnos++;
    }

    // ── Insertar Calificaciones ────────────────────────────────────────────
    al.calificaciones.forEach((c, colIdx) => {
      // Usar nombre normalizado si el frontend lo envió, si no usar el del PDF
      const materiaNorm = c.materiaNormalizada || c.materia;
      const materiaOrig = c.materia;

      // ── Acad_Calificaciones (tabla existente, sin cambio de estructura) ──
      const keyC = `${al.curp}|${al.ciclo}|${al.parcial}|${materiaNorm}`;
      if (calsExistentes.has(keyC)) {
        duplicados++;
      } else {
        idBase++;
        rowsCals.push([
          idBase,
          al.curp, al.nombre, al.grupo, al.semestre, al.turno, al.ciclo,
          al.parcial, materiaNorm,
          c.cal !== null ? c.cal : "",
          c.faltas || 0,
          c.sinDatos ? "SI" : "NO",
          al.promedio || "",
          al.enRiesgo ? "SI" : "NO",
          fuente, timestamp
        ]);
        calsExistentes.add(keyC);
        insertadasCals++;
      }

      // ── calificaciones_normalizadas (tabla nueva, enriquecida con docente) ─
      const keyN = `${al.curp}|${al.ciclo}|${al.parcial}|${materiaNorm}`;
      if (!normExistentes.has(keyN)) {
        const docente = buscarDocente(dir, materiaNorm, al.grupo);
        const correo  = buscarCorreo(dir, materiaNorm, al.grupo);
        idNorm++;
        rowsNorm.push([
          idNorm,
          al.ciclo, al.parcial, al.semestre, al.turno, al.grupo,
          al.curp, al.nombre, al.sexo || "",
          materiaOrig, materiaNorm, colIdx + 1,
          docente, correo,
          c.cal !== null ? c.cal : "",
          c.faltas || 0,
          c.sinDatos ? "SI" : "NO",
          al.promedio || "",
          al.enRiesgo ? "SI" : "NO",
          c.pendingReview ? "SI" : "NO",
          fuente, timestamp
        ]);
        normExistentes.add(keyN);
        insertadasNorm++;
      }
    });
  });

  // ── Escritura en bloque ──────────────────────────────────────────────────
  if (rowsAlumnos.length > 0) {
    shAlumnos.getRange(shAlumnos.getLastRow() + 1, 1, rowsAlumnos.length, rowsAlumnos[0].length)
             .setValues(rowsAlumnos);
  }
  if (rowsCals.length > 0) {
    shCals.getRange(shCals.getLastRow() + 1, 1, rowsCals.length, rowsCals[0].length)
          .setValues(rowsCals);
  }
  if (rowsNorm.length > 0) {
    shNorm.getRange(shNorm.getLastRow() + 1, 1, rowsNorm.length, rowsNorm[0].length)
          .setValues(rowsNorm);
  }

  return {
    status: "success",
    insertadosAlumnos,
    insertadasCals,
    insertadasNorm,
    duplicados,
    errores,
    grupo:   data.meta.grupo,
    parcial: data.meta.parcial,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  LIMPIAR PARCIAL — borra por parcial+ciclo (todos los grupos) o uno específico
// ════════════════════════════════════════════════════════════════════════════
function limpiarParcial(grupo, parcial, ciclo) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Acad_Calificaciones");
  if (!sh) return { status: "error", message: "Hoja Acad_Calificaciones no encontrada" };

  const data     = sh.getDataRange().getValues();
  const headers  = data[0];
  const iGrupo   = headers.indexOf("grupo");
  const iParcial = headers.indexOf("parcial");
  const iCiclo   = headers.indexOf("ciclo");

  let borradas = 0;
  // Recorrer de abajo a arriba para no corromper índices
  for (let i = data.length - 1; i >= 1; i--) {
    const matchParcial = String(data[i][iParcial]) === String(parcial);
    const matchCiclo   = String(data[i][iCiclo])   === String(ciclo);
    // Si grupo es vacío o "TODOS" → borra todo el parcial/ciclo sin importar grupo
    const matchGrupo   = !grupo || grupo === "TODOS" || String(data[i][iGrupo]) === String(grupo);
    if (matchParcial && matchCiclo && matchGrupo) {
      sh.deleteRow(i + 1);
      borradas++;
    }
  }

  // Limpiar calificaciones_normalizadas (mismos filtros)
  const shN = ss.getSheetByName("calificaciones_normalizadas");
  if (shN && shN.getLastRow() > 1) {
    const dataN   = shN.getDataRange().getValues();
    const hdrsN   = dataN[0];
    const iGN     = hdrsN.indexOf("grupo");
    const iPN     = hdrsN.indexOf("parcial");
    const iCN     = hdrsN.indexOf("ciclo");
    for (let i = dataN.length - 1; i >= 1; i--) {
      const matchP = String(dataN[i][iPN]) === String(parcial);
      const matchC = String(dataN[i][iCN]) === String(ciclo);
      const matchG = !grupo || grupo === "TODOS" || String(dataN[i][iGN]) === String(grupo);
      if (matchP && matchC && matchG) shN.deleteRow(i + 1);
    }
  }

  // Si limpiamos todo el parcial, también limpiar Acad_Alumnos para ese ciclo
  // (se vuelven a insertar en el siguiente import)
  if (!grupo || grupo === "TODOS") {
    const shA = ss.getSheetByName("Acad_Alumnos");
    if (shA && shA.getLastRow() > 1) {
      const dataA   = shA.getDataRange().getValues();
      const hdrsA   = dataA[0];
      const iCicloA = hdrsA.indexOf("ciclo");
      let borradasA = 0;
      for (let i = dataA.length - 1; i >= 1; i--) {
        if (String(dataA[i][iCicloA]) === String(ciclo)) {
          shA.deleteRow(i + 1);
          borradasA++;
        }
      }
    }
  }

  return { status: "success", borradas };
}

// ════════════════════════════════════════════════════════════════════════════
//  DASHBOARD — datos agregados para el frontend
// ════════════════════════════════════════════════════════════════════════════
function getDashboard(p) {
  const ciclo   = p.ciclo   || getCicloActivo();
  const parcial = p.parcial ? parseInt(p.parcial) : null;
  const grupo   = p.grupo   || null;

  const cals = leerCalificaciones(ciclo, parcial, grupo);

  return {
    status: "success",
    ciclo, parcial, grupo,
    resumen:           calcResumen(cals),
    porGrupo:          calcPorGrupo(cals),
    porMateria:        calcPorMateria(cals),
    enRiesgo:          calcEnRiesgo(cals),
    topAlumnos:        calcTopAlumnos(cals),
    tendencias:        calcTendencias(ciclo, grupo),
    porSemestreTurno:  calcPorSemestreTurno(cals),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  INDICADORES DETALLADOS
// ════════════════════════════════════════════════════════════════════════════
function getIndicadores(p) {
  const ciclo   = p.ciclo   || getCicloActivo();
  const parcial = p.parcial ? parseInt(p.parcial) : null;
  const grupo   = p.grupo   || null;

  const cals = leerCalificaciones(ciclo, parcial, grupo);

  return {
    status: "success",
    // ALUMNOS
    alumnos: {
      total:       contarAlumnosUnicos(cals),
      enRiesgo:    calcEnRiesgo(cals),
      mejores:     calcTopAlumnos(cals, 10),
      historial:   calcHistorialParciales(ciclo, grupo),
    },
    // DOCENTES
    docentes: {
      porDocente:  calcPorDocente(cals),
    },
    // MATERIAS
    materias: {
      reprobacion: calcReprobacionMateria(cals),
      promedios:   calcPorMateria(cals),
    },
    // GENERALES
    general: {
      indiceReprobacion: calcIndiceReprobacion(cals),
      porGrupo:          calcPorGrupo(cals),
      rankingGrupos:     calcRankingGrupos(cals),
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  ALUMNOS POR GRUPO — tabla detallada alumno × materia
// ════════════════════════════════════════════════════════════════════════════
function getAlumnosGrupo(p) {
  const ciclo   = p.ciclo   || getCicloActivo();
  const parcial = p.parcial ? parseInt(p.parcial) : null;
  const grupo   = p.grupo   || null;

  if (!grupo) return { status: "error", message: "Parámetro 'grupo' requerido" };

  const cals = leerCalificaciones(ciclo, parcial, grupo);
  if (!cals.length) return { status: "success", grupo, materias: [], alumnos: [] };

  // Ordenar materias por orden de aparición (primera vez que aparecen)
  const materias = [];
  const matSet   = new Set();
  cals.forEach(c => {
    if (c.materia && !matSet.has(c.materia)) {
      matSet.add(c.materia);
      materias.push(c.materia);
    }
  });

  // Agrupar por alumno
  const mapaAlumnos = {};
  cals.forEach(c => {
    if (!mapaAlumnos[c.curp]) {
      mapaAlumnos[c.curp] = {
        curp:     c.curp,
        nombre:   c.nombre,
        grupo:    c.grupo,
        promedio: c.promedio,
        enRiesgo: c.enRiesgo,
        cals:     {}   // materia → {cal, faltas, sinDatos}
      };
    }
    mapaAlumnos[c.curp].cals[c.materia] = {
      cal:      c.calificacion,
      faltas:   c.faltas,
      sinDatos: c.sinDatos,
    };
  });

  const alumnos = Object.values(mapaAlumnos)
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  return { status: "success", grupo, ciclo, parcial, materias, alumnos };
}

// ════════════════════════════════════════════════════════════════════════════
//  FUNCIONES DE LECTURA
// ════════════════════════════════════════════════════════════════════════════
function leerCalificaciones(ciclo, parcial, grupo) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Acad_Calificaciones");
  if (!sh || sh.getLastRow() <= 1) return [];

  const data    = sh.getDataRange().getValues();
  const headers = data[0];
  const idx     = {};
  headers.forEach((h, i) => idx[h] = i);

  return data.slice(1).filter(r => {
    if (ciclo  && String(r[idx.ciclo])   !== String(ciclo))   return false;
    if (parcial && parseInt(r[idx.parcial]) !== parcial)       return false;
    if (grupo  && String(r[idx.grupo])   !== String(grupo))   return false;
    return true;
  }).map(r => ({
    curp:         r[idx.curp],
    nombre:       r[idx.nombre],
    grupo:        r[idx.grupo],
    parcial:      parseInt(r[idx.parcial]),
    materia:      r[idx.materia],
    calificacion: r[idx.calificacion] !== "" ? parseFloat(r[idx.calificacion]) : null,
    faltas:       parseInt(r[idx.faltas] || 0),
    sinDatos:     r[idx.sinDatos] === "SI",
    promedio:     r[idx.promedio] !== "" ? parseFloat(r[idx.promedio]) : null,
    enRiesgo:     r[idx.enRiesgo] === "SI",
    ciclo:        r[idx.ciclo],
  }));
}

function getAlumnos(p) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Acad_Alumnos");
  if (!sh || sh.getLastRow() <= 1) return { status: "success", alumnos: [] };

  const data = sh.getDataRange().getValues();
  const [headers, ...rows] = data;
  // Normalizar headers a minúsculas para evitar problemas de capitalización
  const normHeaders = headers.map(h => String(h).toLowerCase().trim());
  const alumnos = rows.map(r => {
    const obj = {};
    normHeaders.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  if (p.grupo) return { status: "success", alumnos: alumnos.filter(a => String(a.grupo) === String(p.grupo)) };
  return { status: "success", alumnos };
}

function getGrupos() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Acad_Alumnos");
  if (!sh || sh.getLastRow() <= 1) return { status: "success", grupos: [] };

  const data = sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues().flat();
  const grupos = [...new Set(data.filter(Boolean))].sort();
  return { status: "success", grupos };
}

function getMaterias() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Acad_Materias");
  if (!sh || sh.getLastRow() <= 1) return { status: "success", materias: [] };

  const data = sh.getDataRange().getValues();
  const [headers, ...rows] = data;
  return {
    status: "success",
    materias: rows.map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    })
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  CALENDARIO (CUMPLEAÑOS)
// ════════════════════════════════════════════════════════════════════════════
function getCumpleanos() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("cumpleanos");
  
  if (!sh || sh.getLastRow() <= 1) {
    // Si la hoja no existe o está vacía, devuelve array vacío (el frontend usará fallback)
    return { status: "success", cumpleanos: [] };
  }

  const data = sh.getDataRange().getValues();
  const [headers, ...rows] = data;
  const normHeaders = headers.map(h => String(h).toLowerCase().trim());
  
  const cumpleanos = rows.map(r => {
    const obj = {};
    normHeaders.forEach((h, i) => {
      let val = r[i];
      // Si es un objeto de fecha nativo de Sheets, convertirlo a AAAA-MM-DD
      if (h === "fecha" && Object.prototype.toString.call(val) === "[object Date]") {
        val = Utilities.formatDate(val, "America/Mexico_City", "yyyy-MM-dd");
      }
      obj[h] = val;
    });
    return obj;
  });

  return { status: "success", cumpleanos };
}

// ════════════════════════════════════════════════════════════════════════════
//  CÁLCULOS DE INDICADORES
// ════════════════════════════════════════════════════════════════════════════

function calcResumen(cals) {
  const alumnosUnicos = new Set(cals.map(c => c.curp));
  const enRiesgo = new Set(cals.filter(c => c.enRiesgo).map(c => c.curp));
  const calsSinNull = cals.filter(c => c.calificacion !== null);
  const prom = calsSinNull.length
    ? calsSinNull.reduce((s, c) => s + c.calificacion, 0) / calsSinNull.length
    : null;
  const reprobadas = calsSinNull.filter(c => c.calificacion < 6).length;
  const idxRep = calsSinNull.length
    ? Math.round((reprobadas / calsSinNull.length) * 100)
    : 0;

  return {
    totalAlumnos:       alumnosUnicos.size,
    alumnosEnRiesgo:    enRiesgo.size,
    promedioGeneral:    prom ? Math.round(prom * 100) / 100 : null,
    indiceReprobacion:  idxRep,
    totalCalificaciones: calsSinNull.length,
    calificacionesRep:  reprobadas,
  };
}

function calcPorGrupo(cals) {
  const grupos = {};
  cals.forEach(c => {
    if (!grupos[c.grupo]) grupos[c.grupo] = { califs: [], alumnos: new Set(), enRiesgo: new Set() };
    if (c.calificacion !== null) grupos[c.grupo].califs.push(c.calificacion);
    grupos[c.grupo].alumnos.add(c.curp);
    if (c.enRiesgo) grupos[c.grupo].enRiesgo.add(c.curp);
  });

  return Object.entries(grupos).map(([grupo, d]) => ({
    grupo,
    totalAlumnos:  d.alumnos.size,
    enRiesgo:      d.enRiesgo.size,
    promedio:      d.califs.length ? Math.round(d.califs.reduce((s,v)=>s+v,0)/d.califs.length*100)/100 : null,
    reprobacion:   d.califs.length ? Math.round(d.califs.filter(v=>v<6).length/d.califs.length*100) : 0,
  })).sort((a,b) => (b.promedio||0) - (a.promedio||0));
}

function calcPorMateria(cals) {
  const dir = leerDirectorioPEC();
  // Agrupar por semestre → turno → materia
  const grupos = {}; // key: "sem|turno"
  cals.forEach(c => {
    if (c.calificacion === null) return;
    const sem   = c.semestre || "—";
    const turno = c.turno    || "—";
    const key   = `${sem}|${turno}`;
    if (!grupos[key]) grupos[key] = { semestre: sem, turno, materias: {} };
    if (!grupos[key].materias[c.materia]) grupos[key].materias[c.materia] = { califs: [], grupo: c.grupo };
    grupos[key].materias[c.materia].califs.push(c.calificacion);
  });

  // Convertir a array plano de {semestre, turno, materia, docente, promedio, reprobacion}
  const filas = [];
  Object.values(grupos).sort((a,b) => {
    if (a.semestre !== b.semestre) return a.semestre - b.semestre;
    return a.turno.localeCompare(b.turno);
  }).forEach(g => {
    Object.entries(g.materias).forEach(([materia, d]) => {
      const doc = buscarDocente(dir, materia, d.grupo || "");
      filas.push({
        semestre:    g.semestre,
        turno:       g.turno,
        materia,
        docente:     doc,
        promedio:    Math.round(d.califs.reduce((s,v)=>s+v,0)/d.califs.length*100)/100,
        reprobacion: Math.round(d.califs.filter(v=>v<6).length/d.califs.length*100),
        total:       d.califs.length,
      });
    });
  });
  return filas;
}

function calcReprobacionMateria(cals) {
  return calcPorMateria(cals);
}

function calcEnRiesgo(cals) {
  const mapa = {};
  cals.filter(c => c.enRiesgo).forEach(c => {
    if (!mapa[c.curp]) mapa[c.curp] = {
      curp: c.curp, nombre: c.nombre, grupo: c.grupo,
      promedio: c.promedio, materiasBajas: []
    };
    if (c.calificacion !== null && c.calificacion < 6) {
      mapa[c.curp].materiasBajas.push({ materia: c.materia, cal: c.calificacion });
    }
  });
  return Object.values(mapa).sort((a,b) => (a.promedio||0) - (b.promedio||0));
}

function calcTopAlumnos(cals, n = 10) {
  const mapa = {};
  cals.forEach(c => {
    if (!mapa[c.curp]) mapa[c.curp] = {
      curp: c.curp, nombre: c.nombre, grupo: c.grupo, promedio: c.promedio
    };
  });
  return Object.values(mapa)
    .filter(a => a.promedio !== null)
    .sort((a,b) => (b.promedio||0) - (a.promedio||0))
    .slice(0, n);
}

function calcIndiceReprobacion(cals) {
  // Por parcial
  const parciales = {};
  cals.filter(c => c.calificacion !== null).forEach(c => {
    if (!parciales[c.parcial]) parciales[c.parcial] = { total: 0, rep: 0 };
    parciales[c.parcial].total++;
    if (c.calificacion < 6) parciales[c.parcial].rep++;
  });
  return Object.entries(parciales).map(([p, d]) => ({
    parcial: parseInt(p),
    indice:  Math.round(d.rep / d.total * 100),
    total:   d.total,
    reprobados: d.rep,
  })).sort((a,b) => a.parcial - b.parcial);
}

// Normaliza texto: sin acentos, minúsculas, sin espacios extra
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim();
}

// Lee el Directorio y devuelve estructura para búsqueda flexible
function leerDirectorioPEC() {
  const docMap   = {}; // norm(materia)|norm(grupo) → docente
  const docMapM  = {}; // norm(materia) → docente (fallback sin grupo)
  const correoMap = {}; // norm(materia)|norm(grupo) → correo
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Directorio");
  if (!sh || sh.getLastRow() <= 1) return { docMap, docMapM, correoMap, rows: [] };
  const rows = sh.getDataRange().getValues().slice(1);
  rows.forEach(r => {
    const grupo   = String(r[0] || "").trim();
    const materia = String(r[1] || "").trim();
    const docente = String(r[2] || "").trim();
    const correo  = String(r[3] || "").trim();
    if (!materia || !docente) return;
    const key = `${norm(materia)}|${norm(grupo)}`;
    docMap[key]    = docente;
    correoMap[key] = correo;
    if (!docMapM[norm(materia)]) docMapM[norm(materia)] = docente;
  });
  return { docMap, docMapM, correoMap, rows };
}

// Busca docente con matching flexible: exacto → contiene → contenido en
function buscarDocente(dir, materia, grupo) {
  const nm = norm(materia);
  const ng = norm(grupo);
  // 1. Exacto con grupo
  if (dir.docMap[`${nm}|${ng}`]) return dir.docMap[`${nm}|${ng}`];
  // 2. Exacto sin grupo
  if (dir.docMapM[nm]) return dir.docMapM[nm];
  // 3. Materia del directorio empieza con el nombre del parser (o viceversa)
  for (const key of Object.keys(dir.docMapM)) {
    if (key.startsWith(nm) || nm.startsWith(key)) return dir.docMapM[key];
  }
  return "—";
}

// Busca correo docente con la misma lógica flexible que buscarDocente
function buscarCorreo(dir, materia, grupo) {
  const nm = norm(materia);
  const ng = norm(grupo);
  if (dir.correoMap[`${nm}|${ng}`]) return dir.correoMap[`${nm}|${ng}`];
  // fallback sin grupo
  for (const key of Object.keys(dir.correoMap)) {
    if (key.startsWith(`${nm}|`)) return dir.correoMap[key];
  }
  return "—";
}

function calcPorDocente(cals) {
  const dir = leerDirectorioPEC();
  const docentes = {};

  cals.filter(c => c.calificacion !== null).forEach(c => {
    const doc = buscarDocente(dir, c.materia, c.grupo);
    if (!docentes[doc]) docentes[doc] = { califs: [], reprobados: 0, materias: new Set(), grupos: new Set() };
    docentes[doc].califs.push(c.calificacion);
    docentes[doc].materias.add(c.materia);
    docentes[doc].grupos.add(c.grupo);
    if (c.calificacion < 6) docentes[doc].reprobados++;
  });

  return Object.entries(docentes).map(([docente, d]) => ({
    docente,
    promedio:    Math.round(d.califs.reduce((s,v)=>s+v,0)/d.califs.length*100)/100,
    reprobacion: Math.round(d.reprobados/d.califs.length*100),
    totalEvals:  d.califs.length,
    materias:    [...d.materias],
    grupos:      [...d.grupos].sort(),
  })).sort((a,b) => a.docente.localeCompare(b.docente));
}

function calcRankingGrupos(cals) {
  return calcPorGrupo(cals);
}

// Agrupa por semestre+turno: KPIs, top alumnos, en riesgo, materias, docentes
function calcPorSemestreTurno(cals) {
  const dir     = leerDirectorioPEC();
  const bloques = {};

  cals.forEach(c => {
    const sem   = String(c.semestre || "—");
    const turno = String(c.turno    || "—");
    const key   = `${sem}|${turno}`;
    if (!bloques[key]) bloques[key] = {
      semestre: sem, turno,
      califs: [], alumnos: {}, grupos: new Set(),
      materias: {}, docentes: {}
    };
    const b = bloques[key];

    if (c.calificacion !== null) b.califs.push(c.calificacion);
    b.grupos.add(c.grupo);

    // Alumnos
    if (!b.alumnos[c.curp]) b.alumnos[c.curp] = {
      curp: c.curp, nombre: c.nombre, grupo: c.grupo,
      promedio: c.promedio, enRiesgo: c.enRiesgo, materiasBajas: []
    };
    if (c.calificacion !== null && c.calificacion < 6 && c.enRiesgo) {
      b.alumnos[c.curp].materiasBajas.push({ materia: c.materia, cal: c.calificacion });
    }

    // Materias
    if (c.calificacion !== null) {
      if (!b.materias[c.materia]) b.materias[c.materia] = { califs: [], grupo: c.grupo };
      b.materias[c.materia].califs.push(c.calificacion);
    }

    // Docentes
    if (c.calificacion !== null) {
      const doc = buscarDocente(dir, c.materia, c.grupo);
      if (!b.docentes[doc]) b.docentes[doc] = { califs: [], reprobados: 0, materias: new Set() };
      b.docentes[doc].califs.push(c.calificacion);
      b.docentes[doc].materias.add(c.materia);
      if (c.calificacion < 6) b.docentes[doc].reprobados++;
    }
  });

  return Object.values(bloques)
    .sort((a, b) => {
      if (a.semestre !== b.semestre) return Number(a.semestre) - Number(b.semestre);
      return a.turno.localeCompare(b.turno);
    })
    .map(b => {
      const prom = b.califs.length
        ? Math.round(b.califs.reduce((s,v)=>s+v,0)/b.califs.length*100)/100 : null;
      const reprobacion = b.califs.length
        ? Math.round(b.califs.filter(v=>v<6).length/b.califs.length*100) : 0;

      // Todos los alumnos ordenados por promedio
      const alumnosOrdenados = Object.values(b.alumnos)
        .filter(a => a.promedio !== null)
        .sort((a,z) => z.promedio - a.promedio);

      // Top 5 mejores
      const topAlumnos = alumnosOrdenados.slice(0, 5);

      // En riesgo (promedio < 6) ordenados de menor a mayor
      const enRiesgo = Object.values(b.alumnos)
        .filter(a => a.enRiesgo)
        .sort((a,z) => (a.promedio||0) - (z.promedio||0));

      // Materias ordenadas por reprobación
      const materias = Object.entries(b.materias).map(([materia, d]) => ({
        materia,
        docente:     buscarDocente(dir, materia, d.grupo || ""),
        promedio:    Math.round(d.califs.reduce((s,v)=>s+v,0)/d.califs.length*100)/100,
        reprobacion: Math.round(d.califs.filter(v=>v<6).length/d.califs.length*100),
        total:       d.califs.length,
      })).sort((a,z) => z.reprobacion - a.reprobacion);

      // Docentes ordenados alfabéticamente
      const docentes = Object.entries(b.docentes).map(([docente, d]) => ({
        docente,
        promedio:    Math.round(d.califs.reduce((s,v)=>s+v,0)/d.califs.length*100)/100,
        reprobacion: Math.round(d.reprobados/d.califs.length*100),
        totalEvals:  d.califs.length,
        materias:    [...d.materias],
      })).sort((a,z) => a.docente.localeCompare(z.docente));

      return {
        semestre:        b.semestre,
        turno:           b.turno,
        promedio:        prom,
        reprobacion,
        totalAlumnos:    Object.keys(b.alumnos).length,
        alumnosEnRiesgo: enRiesgo.length,
        grupos:          [...b.grupos].sort(),
        topAlumnos,
        enRiesgo,
        materias,
        docentes,
      };
    });
}

function calcHistorialParciales(ciclo, grupo) {
  const todosCals = leerCalificaciones(ciclo, null, grupo);
  const parciales = {};
  todosCals.filter(c => c.calificacion !== null).forEach(c => {
    if (!parciales[c.parcial]) parciales[c.parcial] = [];
    parciales[c.parcial].push(c.calificacion);
  });
  return Object.entries(parciales).map(([p, vals]) => ({
    parcial:  parseInt(p),
    promedio: Math.round(vals.reduce((s,v)=>s+v,0)/vals.length*100)/100,
    total:    vals.length,
  })).sort((a,b) => a.parcial - b.parcial);
}

function contarAlumnosUnicos(cals) {
  return new Set(cals.map(c => c.curp)).size;
}

function calcTendencias(ciclo, grupo) {
  return calcHistorialParciales(ciclo, grupo);
}

// ════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ════════════════════════════════════════════════════════════════════════════
function getOrCreateSheet(ss, nombre) {
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

function getCicloActivo() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Acad_Config");
  if (!sh) return "";
  const data = sh.getDataRange().getValues();
  const row  = data.find(r => String(r[0]).trim().toLowerCase() === "ciclo_activo");
  return row ? String(row[1]).trim() : "";
}
