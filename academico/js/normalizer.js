/**
 * normalizer.js — Normalización de materias contra catálogo maestro (Acad_Materias)
 * Cargado en upload.html antes de parser.js
 * No tiene dependencias externas — es autocontenido.
 */
window.Normalizer = (function () {

  let _catalogo = [];  // filas de Acad_Materias cargadas desde GAS

  // ── Utilidad de normalización de texto (sin acentos, minúsculas) ──────────
  function norm(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim();
  }

  // ── Carga el catálogo desde GAS (acción getMaterias) ─────────────────────
  async function cargarCatalogo(gasUrl) {
    try {
      const res  = await fetch(`${gasUrl}?action=getMaterias`, { redirect: "follow" });
      const data = await res.json();
      // Normalizar nombres de columna: acepta tanto "nombre_completo" (viejo)
      // como "materia_nombre_completo" (nuevo catalogo_materias)
      _catalogo  = (data.materias || [])
        .filter(m => String(m.activa).toUpperCase() !== "NO")
        .map(m => ({
          ...m,
          nombre_completo: m.nombre_completo || m.materia_nombre_completo || "",
        }));
      console.log(`[Normalizer] Catálogo cargado: ${_catalogo.length} materias`);
    } catch (e) {
      console.warn("[Normalizer] No se pudo cargar catálogo. Se usarán nombres del PDF tal cual.", e.message);
      _catalogo = [];
    }
    return _catalogo;
  }

  // ── Resuelve un nombre de materia (raw PDF) al nombre completo del catálogo
  // colIndex: posición 0-based de la materia en el concentrado
  // semestre: número (2, 4, 6…)
  function resolverMateria(rawName, colIndex, semestre) {
    // Si no hay catálogo, no bloqueamos el flujo
    if (!_catalogo.length) return { normalizada: rawName, pendingReview: false };

    const posicion = colIndex + 1;                              // 1-based
    const sem      = parseInt(semestre) || 0;
    const rawClean = norm(rawName.replace(/\.+$/, ""));         // quitar "..." al final

    // Filtrar por semestre cuando sea conocido
    const porSem = sem ? _catalogo.filter(m => parseInt(m.semestre) === sem) : _catalogo;

    // ── Prioridad 1: coincidencia exacta del nombre completo ─────────────
    let m = porSem.find(m => norm(m.nombre_completo) === rawClean);
    if (m) return { normalizada: m.nombre_completo, pendingReview: false };

    // ── Prioridad 2: nombre completo empieza con el texto truncado del PDF ─
    // Solo aplica si la coincidencia es ÚNICA — si hay ambigüedad saltamos a posición
    const p2matches = porSem.filter(m => norm(m.nombre_completo).startsWith(rawClean));
    if (p2matches.length === 1) return { normalizada: p2matches[0].nombre_completo, pendingReview: false };

    // ── Prioridad 3: abreviatura registrada explícitamente en catálogo ─────
    // Acepta tanto "abreviatura_pdf" (nombre viejo) como "encabezado_pdf_abreviado" (nuevo)
    m = porSem.find(m => {
      const abrev = m.encabezado_pdf_abreviado || m.abreviatura_pdf;
      return abrev && norm(abrev) === rawClean;
    });
    if (m) return { normalizada: m.nombre_completo, pendingReview: false };

    // ── Prioridad 4: algún alias alterno coincide ─────────────────────────
    // Acepta "alias_alternos" (coma-separado), "alias_1" y "alias_2" (columnas separadas)
    m = porSem.find(m => {
      const candidatos = [];
      if (m.alias_alternos) candidatos.push(...String(m.alias_alternos).split(","));
      if (m.alias_1) candidatos.push(String(m.alias_1));
      if (m.alias_2) candidatos.push(String(m.alias_2));
      return candidatos.some(a => {
        const na = norm(a);
        return na && (na === rawClean || na.startsWith(rawClean) || rawClean.startsWith(na));
      });
    });
    if (m) return { normalizada: m.nombre_completo, pendingReview: false };

    // ── Prioridad 5: posición de columna + semestre (fallback determinista) ─
    // Acepta tanto "posicion_columna" (nombre viejo) como "orden_columna" (nuevo)
    m = porSem.find(m =>
      parseInt(m.orden_columna || m.posicion_columna) === posicion
    );
    if (m) return { normalizada: m.nombre_completo, pendingReview: false };

    // ── No resuelto: marcar para revisión manual ──────────────────────────
    return { normalizada: rawName, pendingReview: true };
  }

  // ── Normaliza todas las materias en el objeto resultado de parsearArchivo ─
  // Agrega .materiaNormalizada y .pendingReview a cada calificacion en alumnos.
  // Devuelve cuántas materias quedaron sin resolver (para mostrar alerta en UI).
  function normalizarResultado(resultado) {
    const { meta, alumnos } = resultado;
    let pendingCount = 0;

    alumnos.forEach(al => {
      al.calificaciones.forEach((c, idx) => {
        const res = resolverMateria(c.materia, idx, meta.semestre);
        c.materiaNormalizada = res.normalizada;
        c.pendingReview      = res.pendingReview;
        if (res.pendingReview) pendingCount++;
      });
    });

    return pendingCount;   // 0 = todo resuelto
  }

  // ── API pública ───────────────────────────────────────────────────────────
  return {
    cargarCatalogo,
    normalizarResultado,
    get catalogo() { return _catalogo; },
    get listo()    { return _catalogo.length > 0; },
  };

})();
