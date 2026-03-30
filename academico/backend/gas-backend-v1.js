/**
 * GAS Backend — Sistema de Analítica Académica CEB 5/4
 * Google Apps Script — despliega como Web App (Ejecutar como: Yo, Acceso: Cualquiera)
 *
 * Versión: v1-antigravity (Corregida)
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
      case "getDiagnostic": 
        const ss = SpreadsheetApp.openById(SS_ID);
        const shCal = ss.getSheetByName("Acad_Calificaciones");
        const shConf = ss.getSheetByName("Configuracion");
        const headers = shCal ? shCal.getRange(1, 1, 1, shCal.getLastColumn()).getValues()[0] : [];
        const sampleRows = shCal && shCal.getLastRow() > 1 ? shCal.getRange(2, 1, 3, shCal.getLastColumn()).getValues() : [];
        
        // Obtener ciclos disponibles en la data
        let ciclosData = [];
        if (shCal && shCal.getLastRow() > 1) {
          const idxC = headers.map(h => String(h).toLowerCase()).indexOf("ciclo");
          if (idxC !== -1) {
            ciclosData = [...new Set(shCal.getRange(2, idxC + 1, shCal.getLastRow() - 1, 1).getValues().flat())].filter(Boolean);
          }
        }

        // Obtener muestra de Configuracion
        const confSample = shConf ? shConf.getRange(1, 1, Math.min(15, shConf.getLastRow()), 2).getValues() : [];

        return json({
          status: "diagnostic",
          documentName: ss.getName(),
          sheets: ss.getSheets().map(s => s.getName()),
          cicloActivo: getCicloActivo(),
          ciclosEnData: ciclosData,
          confSample: confSample,
          headers: headers,
          sample: sampleRows,
          hasCalificaciones: shCal ? "SI" : "NO",
          lastRowCal: shCal ? shCal.getLastRow() : 0
        });

      case "getDashboard":  return json(getDashboard(p));
      case "getAlumnos":    return json(getAlumnos(p));
      case "getGrupos":     return json(getGrupos());
      case "getMaterias":   return json(getMaterias());
      case "getIndicadores":return json(getIndicadores(p));
      default:              return json({ status: "ok", sistema: "CEB54 Academico v1.1 activa (incluye diagnóstico)" });
    }
  } catch (err) {
    return json({ status: "error", message: "Error de conexión o permisos: " + err.message });
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
// ════════════════════════════════════════════════════════════════════════════
function importarDesdeParser(data) {
  const ss = SpreadsheetApp.openById(SS_ID);

  const shAlumnos = getOrCreateSheet(ss, "Acad_Alumnos");
  const shCals    = getOrCreateSheet(ss, "Acad_Calificaciones");

  if (shAlumnos.getLastRow() === 0) {
    shAlumnos.appendRow(["curp","nombre","grupo","semestre","turno","ciclo","sexo","activo"]);
  }
  if (shCals.getLastRow() === 0) {
    shCals.appendRow(["id","curp","nombre","grupo","semestre","turno","ciclo",
                      "parcial","materia","calificacion","faltas","sinDatos",
                      "promedio","enRiesgo","fuente","timestamp"]);
  }

  const curpsExistentes = new Set(
    shAlumnos.getLastRow() > 1
      ? shAlumnos.getRange(2, 1, shAlumnos.getLastRow() - 1, 1).getValues().flat()
      : []
  );

  let calsExistentes = new Set();
  if (shCals.getLastRow() > 1) {
    const calsData = shCals.getRange(2, 2, shCals.getLastRow() - 1, 8).getValues();
    calsData.forEach(r => {
      calsExistentes.add(`${r[0]}|${r[5]}|${r[6]}|${r[7]}`);
    });
  }

  let insertadosAlumnos = 0;
  let insertadasCals    = 0;
  let duplicados        = 0;
  const errores         = [];

  const fuente    = `PDF_${data.meta.grupo}_p${data.meta.parcial}_${Utilities.formatDate(new Date(), "America/Mexico_City", "yyyyMMdd")}`;
  const timestamp = Utilities.formatDate(new Date(), "America/Mexico_City", "yyyy-MM-dd HH:mm:ss");

  const rowsAlumnos = [];
  const rowsCals    = [];
  let idBase        = shCals.getLastRow();

  data.alumnos.forEach(al => {
    if (!curpsExistentes.has(al.curp)) {
      rowsAlumnos.push([al.curp, al.nombre, al.grupo, al.semestre,
                        al.turno, al.ciclo, al.sexo, true]);
      curpsExistentes.add(al.curp);
      insertadosAlumnos++;
    }

    al.calificaciones.forEach(c => {
      const key = `${al.curp}|${al.ciclo}|${al.parcial}|${c.materia}`;
      if (calsExistentes.has(key)) {
        duplicados++;
        return;
      }
      idBase++;
      rowsCals.push([
        idBase,
        al.curp, al.nombre, al.grupo, al.semestre, al.turno, al.ciclo,
        al.parcial, c.materia,
        c.cal !== null ? c.cal : "",
        c.faltas || 0,
        c.sinDatos ? "SI" : "NO",
        al.promedio || "",
        al.enRiesgo ? "SI" : "NO",
        fuente, timestamp
      ]);
      calsExistentes.add(key);
      insertadasCals++;
    });
  });

  if (rowsAlumnos.length > 0) {
    shAlumnos.getRange(shAlumnos.getLastRow() + 1, 1, rowsAlumnos.length, rowsAlumnos[0].length)
             .setValues(rowsAlumnos);
  }
  if (rowsCals.length > 0) {
    shCals.getRange(shCals.getLastRow() + 1, 1, rowsCals.length, rowsCals[0].length)
          .setValues(rowsCals);
  }

  return {
    status: "success",
    insertadosAlumnos,
    insertadasCals,
    duplicados,
    errores,
    grupo:   data.meta.grupo,
    parcial: data.meta.parcial,
  };
}

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
  for (let i = data.length - 1; i >= 1; i--) {
    const matchParcial = String(data[i][iParcial]) === String(parcial);
    const matchCiclo   = String(data[i][iCiclo])   === String(ciclo);
    const matchGrupo   = !grupo || grupo === "TODOS" || String(data[i][iGrupo]) === String(grupo);
    if (matchParcial && matchCiclo && matchGrupo) {
      sh.deleteRow(i + 1);
      borradas++;
    }
  }

  if (!grupo || grupo === "TODOS") {
    const shA = ss.getSheetByName("Acad_Alumnos");
    if (shA && shA.getLastRow() > 1) {
      const dataA   = shA.getDataRange().getValues();
      const hdrsA   = dataA[0];
      const iCicloA = hdrsA.indexOf("ciclo");
      for (let i = dataA.length - 1; i >= 1; i--) {
        if (String(dataA[i][iCicloA]) === String(ciclo)) {
          shA.deleteRow(i + 1);
        }
      }
    }
  }
  return { status: "success", borradas };
}

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

function getIndicadores(p) {
  const ciclo   = p.ciclo   || getCicloActivo();
  const parcial = p.parcial ? parseInt(p.parcial) : null;
  const grupo   = p.grupo   || null;
  const cals = leerCalificaciones(ciclo, parcial, grupo);

  return {
    status: "success",
    alumnos: {
      total:       contarAlumnosUnicos(cals),
      enRiesgo:    calcEnRiesgo(cals),
      mejores:     calcTopAlumnos(cals, 10),
      historial:   calcHistorialParciales(ciclo, grupo),
    },
    docentes: {
      porDocente:  calcPorDocente(cals),
    },
    materias: {
      reprobacion: calcReprobacionMateria(cals),
      promedios:   calcPorMateria(cals),
    },
    general: {
      indiceReprobacion: calcIndiceReprobacion(cals),
      porGrupo:          calcPorGrupo(cals),
      rankingGrupos:     calcRankingGrupos(cals),
    },
  };
}

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
    semestre:     r[idx.semestre],
    turno:        r[idx.turno],
    ciclo:        r[idx.ciclo],
  }));
}

function getAlumnos(p) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Acad_Alumnos");
  if (!sh || sh.getLastRow() <= 1) return { status: "success", alumnos: [] };

  const data = sh.getDataRange().getValues();
  const [headers, ...rows] = data;
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
  const grupos = {}; 
  cals.forEach(c => {
    if (c.calificacion === null) return;
    const sem   = c.semestre || "—";
    const turno = c.turno    || "—";
    const key   = `${sem}|${turno}`;
    if (!grupos[key]) grupos[key] = { semestre: sem, turno, materias: {} };
    if (!grupos[key].materias[c.materia]) grupos[key].materias[c.materia] = { califs: [], grupo: c.grupo };
    grupos[key].materias[c.materia].califs.push(c.calificacion);
  });

  const filas = [];
  Object.values(grupos).sort((a,b) => {
    // Ordenamiento numérico seguro (maneja "—")
    const sA = parseInt(a.semestre) || 0;
    const sB = parseInt(b.semestre) || 0;
    if (sA !== sB) return sA - sB;
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

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim();
}

function leerDirectorioPEC() {
  const docMap  = {};
  const docMapM = {};
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Directorio");
  if (!sh || sh.getLastRow() <= 1) return { docMap, docMapM, rows: [] };
  const rows = sh.getDataRange().getValues().slice(1);
  rows.forEach(r => {
    const grupo   = String(r[0] || "").trim();
    const materia = String(r[1] || "").trim();
    const docente = String(r[2] || "").trim();
    if (!materia || !docente) return;
    docMap[`${norm(materia)}|${norm(grupo)}`] = docente;
    if (!docMapM[norm(materia)]) docMapM[norm(materia)] = docente;
  });
  return { docMap, docMapM, rows };
}

function buscarDocente(dir, materia, grupo) {
  const nm = norm(materia);
  const ng = norm(grupo);
  if (dir.docMap[`${nm}|${ng}`]) return dir.docMap[`${nm}|${ng}`];
  if (dir.docMapM[nm]) return dir.docMapM[nm];
  for (const key of Object.keys(dir.docMapM)) {
    if (key.startsWith(nm) || nm.startsWith(key)) return dir.docMapM[key];
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

function calcPorSemestreTurno(cals) {
  const dir     = leerDirectorioPEC();
  const bloques = {};

  cals.forEach(c => {
    // Deducir semestre si viene vacío (ej: M201 -> 2)
    let sem = c.semestre;
    if ((sem === null || sem === undefined || sem === "" || sem === "—") && c.grupo) {
      const matchS = String(c.grupo).match(/\d/);
      if (matchS) sem = parseInt(matchS[0]);
    }

    const sVal  = String(sem || "—");
    const tVal  = String(c.turno || "—");
    const key   = `${sVal}|${tVal}`;
    if (!bloques[key]) bloques[key] = {
      semestre: sVal, turno: tVal,
      califs: [], alumnos: {}, grupos: new Set(),
      materias: {}, docentes: {}
    };
    const b = bloques[key];

    if (c.calificacion !== null) b.califs.push(c.calificacion);
    b.grupos.add(c.grupo);

    if (!b.alumnos[c.curp]) b.alumnos[c.curp] = {
      curp: c.curp, nombre: c.nombre, grupo: c.grupo,
      promedio: c.promedio, enRiesgo: c.enRiesgo, materiasBajas: []
    };
    if (c.calificacion !== null && c.calificacion < 6 && c.enRiesgo) {
      b.alumnos[c.curp].materiasBajas.push({ materia: c.materia, cal: c.calificacion });
    }

    if (c.calificacion !== null) {
      if (!b.materias[c.materia]) b.materias[c.materia] = { califs: [], grupo: c.grupo };
      b.materias[c.materia].califs.push(c.calificacion);
    }

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
      // Ordenamiento numérico seguro
      const sA = parseInt(a.semestre) || 0;
      const sB = parseInt(b.semestre) || 0;
      if (sA !== sB) return sA - sB;
      return a.turno.localeCompare(b.turno);
    })
    .map(b => {
      const prom = b.califs.length
        ? Math.round(b.califs.reduce((s,v)=>s+v,0)/b.califs.length*100)/100 : null;
      const reprobacion = b.califs.length
        ? Math.round(b.califs.filter(v=>v<6).length/b.califs.length*100) : 0;

      const alumnosOrdenados = Object.values(b.alumnos)
        .filter(a => a.promedio !== null)
        .sort((a,z) => z.promedio - a.promedio);

      const topAlumnos = alumnosOrdenados.slice(0, 5);

      const enRiesgo = Object.values(b.alumnos)
        .filter(a => a.enRiesgo)
        .sort((a,z) => (a.promedio||0) - (z.promedio||0));

      const materias = Object.entries(b.materias).map(([materia, d]) => ({
        materia,
        docente:     buscarDocente(dir, materia, d.grupo || ""),
        promedio:    Math.round(d.califs.reduce((s,v)=>s+v,0)/d.califs.length*100)/100,
        reprobacion: Math.round(d.califs.filter(v=>v<6).length/d.califs.length*100),
        total:       d.califs.length,
      })).sort((a,z) => z.reprobacion - a.reprobacion);

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

function getOrCreateSheet(ss, nombre) {
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

function getCicloActivo() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName("Configuracion"); // Cambiado de Acad_Config a Configuracion
  if (!sh) return "";
  const data = sh.getDataRange().getValues();
  // En PEC se usa 'ciclo_escolar' o similar, buscaremos con normalización
  const row  = data.find(r => {
    const k = String(r[0]).trim().toLowerCase();
    return k === "ciclo_escolar" || k === "ciclo_activo";
  });
  return row ? String(row[1]).trim() : "";
}
