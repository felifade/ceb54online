/**
 * parser.js — Motor de extracción PDF para CEB 5/4
 * Lee concentrados de calificaciones y produce JSON estructurado
 * Fase 2 del Sistema de Analítica Académica
 */

window.PDFParser = (function () {

  // ── CURP válida: 4 letras + 6 dígitos + H/M + 5 letras + alfanum + dígito
  const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

  // ── Suffixing helper based on semester
  function aplicarSufijo(nombre, semestre) {
    if (!semestre) return nombre;
    // Evitar duplicar si ya tiene el sufijo
    const sufijo = `(Sem ${semestre})`;
    if (nombre.includes(sufijo)) return nombre;
    return `${nombre} ${sufijo}`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ENTRADA PRINCIPAL
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Parsea un archivo PDF y devuelve { meta, alumnos }
   * @param {File} file  Objeto File del input/drop
   * @returns {Promise<{meta: object, alumnos: array}>}
   */
  async function parsearArchivo(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const meta = {
      grupo: "", semestre: "", turno: "", ciclo: "",
      parcial: null, fecha: "", totalAlumnos: 0
    };
    const alumnos = [];

    // Columnas de materias detectadas desde la página 1
    let columnasX = null;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page    = await pdf.getPage(pageNum);
      const tc      = await page.getTextContent();
      const vp      = page.getViewport({ scale: 1 });

      // Normalizar ítems: convertir coordenadas PDF (origen abajo-izq) a pantalla (origen arriba-izq)
      const items = tc.items
        .filter(i => i.str && i.str.trim().length > 0)
        .map(i => ({
          str:  i.str.trim(),
          x:    Math.round(i.transform[4]),
          y:    Math.round(vp.height - i.transform[5]),  // y invertida
          w:    Math.round(i.width || 0),                // ancho del texto (útil para rango de columna)
        }))
        .sort((a, b) => a.y - b.y || a.x - b.x);

      if (pageNum === 1) {
        extraerMeta(items, meta);
        // Ahora devuelve [{x, name}, ...]
        columnasX = detectarColumnasMateria(items, meta.semestre);
      }

      const alumnosPagina = extraerAlumnos(items, columnasX, meta);
      alumnos.push(...alumnosPagina);
    }

    meta.totalAlumnos = alumnos.length;
    return { meta, alumnos };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // META — Encabezado del documento
  // ────────────────────────────────────────────────────────────────────────────

  function extraerMeta(items, meta) {
    const texto = items.map(i => i.str).join(" ");

    // Grupo (ej. M201, V301A)
    const grupoM = texto.match(/Grupo[:\s]+([A-Z]\d{3}[A-Z]?)/i);
    if (grupoM) meta.grupo = grupoM[1];

    // Turno
    if (/matutino/i.test(texto))   meta.turno = "Matutino";
    else if (/vespertino/i.test(texto)) meta.turno = "Vespertino";

    // Ciclo (ej. 2025-2026/2)
    const cicloM = texto.match(/Ciclo[:\s]+([\d]{4}-[\d]{4}\/\d)/i);
    if (cicloM) meta.ciclo = cicloM[1];

    // Parcial
    if (/1er|primer/i.test(texto))   meta.parcial = 1;
    else if (/2[do°]|segundo/i.test(texto)) meta.parcial = 2;
    else if (/3[er°]|tercer/i.test(texto))  meta.parcial = 3;

    // Semestre (ej. "Segundo Semestre")
    const semM = texto.match(/(primer|segundo|tercer|cuarto|quinto|sexto)\s+semestre/i);
    if (semM) {
      const mapa = { primer:1, segundo:2, tercer:3, cuarto:4, quinto:5, sexto:6 };
      meta.semestre = mapa[semM[1].toLowerCase()] || semM[1];
    }

    // Fecha (ej. 29/03/2026)
    const fechaM = texto.match(/Fecha[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
    if (fechaM) meta.fecha = fechaM[1];
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DETECCIÓN DE COLUMNAS — usa los "Cal/Fal" del encabezado de tabla
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Encuentra los X de todos los "Cal/Fal" en el header de la tabla.
   * Esos son los centros de cada columna de materia.
   */
  /**
   * Encuentra los X de todos los "Cal/Fal" en el header de la tabla.
   * Y busca hacia arriba los nombres de las materias.
   */
  function detectarColumnasMateria(items, semestre) {
    // 1. Encontrar los centros de cada columna (Cal/Fal)
    const calFalItems = items.filter(i =>
      i.str === "Cal/Fal" && i.y < 350
    );

    if (calFalItems.length === 0) return [];

    // Agrupar por X cercana para evitar duplicados en la misma columna
    // Guardamos también el ancho (w) para calcular el rango real de la columna
    const xsRaw = calFalItems.map(i => ({ x: i.x, y: i.y, w: i.w })).sort((a, b) => a.x - b.x);
    const cols = [];
    if (xsRaw.length > 0) {
      cols.push(xsRaw[0]);
      for (let i = 1; i < xsRaw.length; i++) {
        if (xsRaw[i].x - cols[cols.length - 1].x > 15) cols.push(xsRaw[i]);
      }
    }

    // 2. Para cada columna, buscar texto arriba (nombres de materias)
    // Los nombres suelen estar en un rango de X similar y Y menor al Cal/Fal
    return cols.map(c => {
      // Ancho real del texto "Cal/Fal"; si no se detectó, asumimos 40px (típico en estos PDFs)
      const colWidth = c.w > 10 ? c.w : 40;
      const TOL = 15;
      const textArriba = items
        .filter(i => Math.abs(i.x - c.x) <= TOL && i.y < c.y && i.y > 50)
        .sort((a,b) => a.y - b.y)
        .map(i => i.str)
        .join(" ")
        .trim();

      let nombre = textArriba || "Materia Desconocida";
      // Limpiar nombres comunes que no son materias
      if (nombre.includes("ASIGNATURA")) nombre = nombre.replace(/.*ASIGNATURA\s+/i, "");

      return {
        x: c.x,
        w: colWidth,
        name: aplicarSufijo(nombre, semestre)
      };
    }).slice(0, 9); // Normalmente son 9 materias en este formato
  }

  // ────────────────────────────────────────────────────────────────────────────
  // EXTRACCIÓN DE ALUMNOS
  // ────────────────────────────────────────────────────────────────────────────

  function extraerAlumnos(items, columnasX, meta) {
    const alumnos = [];

    // Cada alumno se identifica por su CURP, ordenados por Y (de arriba a abajo)
    const curpItems = items
      .filter(i => CURP_REGEX.test(i.str))
      .sort((a, b) => a.y - b.y);

    console.log(`[Parser] Detectados ${curpItems.length} alumnos en esta página.`);

    curpItems.forEach((curpItem, idx) => {
      const rowY   = curpItem.y;
      
      // --- CÁLCULO DINÁMICO DEL LÍMITE DE LA FILA ---
      // En lugar de un RANGO fijo, usamos la posición del siguiente CURP
      let nextRowY;
      if (idx < curpItems.length - 1) {
        // La fila termina justo antes del siguiente CURP
        nextRowY = curpItems[idx + 1].y - 2; 
      } else {
        // Para el último alumno, calculamos la altura promedio detectada en esta página
        const distancias = [];
        for(let i=0; i < curpItems.length - 1; i++) {
          distancias.push(curpItems[i+1].y - curpItems[i].y);
        }
        const alturaPromedio = distancias.length > 0 
          ? (distancias.reduce((a, b) => a + b, 0) / distancias.length) 
          : 25;
        nextRowY = rowY + Math.min(alturaPromedio, 35); 
      }

      // Todos los ítems en la banda de esta fila (desde un poco antes del CURP hasta el inicio de la siguiente)
      const banda = items.filter(i =>
        i.y >= rowY - 4 &&
        i.y <= nextRowY
      );

      const curp   = curpItem.str;
      const nombre = extraerNombre(banda, curpItem);
      const cals   = extraerCalificaciones(banda, columnasX);
      const prom   = calcularPromedio(cals);
      const tieneSd = banda.some(i => i.str === "SD") || cals.some(c => c.sinDatos);
      const sexo   = (curp[10] === "H") ? "Masculino" : "Femenino";

      if (idx === 0) {
        console.log(`[Parser] Ejemplo Fila 1: CURP=${curp}, Nombre=${nombre}, Items en banda=${banda.length}`);
      }

      alumnos.push({
        curp,
        nombre,
        grupo:    meta.grupo,
        semestre: meta.semestre,
        turno:    meta.turno,
        ciclo:    meta.ciclo,
        parcial:  meta.parcial,
        sexo,
        calificaciones: cals,
        promedio: prom,
        tieneSd,
        enRiesgo: prom !== null && prom < 6,
      });
    });

    return alumnos;
  }

  // ── Nombre: ítems entre CURP y primer número, ordenados por X
  function extraerNombre(banda, curpItem) {
    const SKIP = /^\d+(\.\d+)?$|^F:\d+$|^SD$|^-$|^#$|^Cal\/Fal$/;
    
    // El nombre suele estar en la misma línea que el CURP o muy cerca (Y similar)
    // Filtramos ítems que estén a la derecha del CURP y no sean números/marcadores
    const nameItems = banda.filter(i =>
      i.x > curpItem.x + 5 &&
      !SKIP.test(i.str) &&
      !CURP_REGEX.test(i.str)
    );

    // Intentar detectar dónde empiezan las calificaciones (el primer número a la derecha)
    const itemsNumericos = banda.filter(i => /^\d+(\.\d+)?$/.test(i.str) && i.x > curpItem.x + 50);
    const primerNumX = itemsNumericos.length > 0
      ? Math.min(...itemsNumericos.map(i => i.x))
      : 9999;

    // Solo tomamos los ítems que están entre el CURP y la primera calificación
    // Y que estén en la mitad superior de la banda (para evitar capturar el sexo "Femenino" si está abajo)
    const midY = curpItem.y + 10; 
    
    return nameItems
      .filter(i => i.x < primerNumX && i.y <= midY)
      .sort((a, b) => a.x - b.x)
      .map(i => i.str)
      .join(" ")
      .trim();
  }

  // ── Calificaciones: una por cada columna detectada
  function extraerCalificaciones(banda, columnasX) {
    if (!columnasX || columnasX.length === 0) return [];

    return columnasX.map(col => {
      const colX = col.x;
      const colW = col.w || 40;  // ancho real de la columna Cal/Fal
      const materia = col.name;

      // Buscar desde 5px antes del borde izquierdo hasta el final del ancho de columna + 5px
      // Esto captura tanto la calificación (mitad izquierda) como las faltas (mitad derecha)
      const colItems = banda
        .filter(i => i.x >= colX - 5 && i.x <= colX + colW + 5)
        .sort((a, b) => a.y - b.y); // Ordenar por Y (arriba -> abajo)

      let cal = null, faltas = 0, sinDatos = false;

      // Usualmente el primer número es la calificación y el segundo las faltas
      const numeros = [];
      
      colItems.forEach(i => {
        const s = i.str.trim();
        if (/^\d+(\.\d+)?$/.test(s)) {
          numeros.push(parseFloat(s));
        } else if (/^F:(\d+)$/.test(s)) {
          faltas = parseInt(s.slice(2));
        } else if (s === "SD") {
          sinDatos = true;
        } else if (s.includes(" ")) {
          // Si vienen pegados "9 0"
          const parts = s.split(/\s+/).filter(p => !isNaN(p));
          parts.forEach(p => numeros.push(parseFloat(p)));
        }
      });

      // Calificaciones pueden tener decimal (ej: 8.5), faltas son siempre entero
      if (numeros.length >= 1) cal = numeros[0];
      if (numeros.length >= 2) faltas = Math.round(numeros[1]);

      return { materia, cal, faltas, sinDatos };
    });
  }

  // ── Promedio: media de calificaciones capturadas (ignora null)
  function calcularPromedio(cals) {
    const vals = cals.filter(c => c.cal !== null && !c.sinDatos).map(c => c.cal);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // EXPORTAR
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Convierte el resultado a array de filas planas para tabla / Google Sheets
   * Una fila por alumno × materia
   */
  function aFilasPlanas(resultado) {
    const filas = [];
    resultado.alumnos.forEach(al => {
      al.calificaciones.forEach(c => {
        filas.push({
          curp:       al.curp,
          nombre:     al.nombre,
          grupo:      al.grupo,
          semestre:   al.semestre,
          turno:      al.turno,
          ciclo:      al.ciclo,
          parcial:    al.parcial,
          sexo:       al.sexo,
          materia:    c.materia,
          calificacion: c.cal,
          faltas:     c.faltas,
          sinDatos:   c.sinDatos,
          promedio:   al.promedio,
          enRiesgo:   al.enRiesgo,
        });
      });
    });
    return filas;
  }

  return { parsearArchivo, aFilasPlanas };

})();
