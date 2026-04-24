/* ═══════════════════════════════════════════════════════════════
   CALIFICACIONES INTRASEMESTRALES — CEB 5/4
   Fuente: Google Apps Script (endpoint JSON)
   ─────────────────────────────────────────────────────────────
   CONFIGURACIÓN:  cambia GAS_URL por la URL de tu deployment.
   La hoja que se lee es "CONCENTRADO SUBDIRECCIÓN" del Sheets
   de Subdirección.  El GAS devuelve JSON con la forma:
     { status: "ok", total: N, registros: [ { nombre, grupo,
       asignatura, docente, tipo, calificacion, observacion } ] }
═══════════════════════════════════════════════════════════════ */

const GAS_URL = "https://script.google.com/macros/s/AKfycbyEjX4bOiwO04fBvoxGOm4ruX-goEy5SlyMvkT0N5_1Htky8hzQSbGl4tmNsc5nTUUc/exec"; // ← único punto de configuración

// Calificación mínima para acreditar (ajustable)
const CAL_MINIMA = 6;

/* ── Estado de la app ─────────────────────────────────────── */
let _allData   = [];   // todos los registros cargados
let _filtered  = [];   // registros después de aplicar filtros

/* ── Normalizar texto (quitar acentos, minúsculas) ───────── */
function norm(str) {
  return String(str || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

/* ── Determinar estado de acreditación ───────────────────── */
function getEstado(cal) {
  if (cal === null || cal === "" || cal === undefined) return "pendiente";
  const n = parseFloat(cal);
  if (isNaN(n)) return "pendiente";
  return n >= CAL_MINIMA ? "acreditado" : "no_acreditado";
}

/* ── Renderizar badge de estado ──────────────────────────── */
function badgeEstado(estado) {
  if (estado === "acreditado")    return `<span class="badge-estado badge-acred">✓ Acreditado</span>`;
  if (estado === "no_acreditado") return `<span class="badge-estado badge-no">✗ No acreditado</span>`;
  return `<span class="badge-estado badge-pend">⏳ Pendiente</span>`;
}

/* ── Renderizar badge de tipo ────────────────────────────── */
function badgeTipo(tipo) {
  const t = String(tipo || "").toUpperCase();
  if (t === "EXAMEN") return `<span class="badge-tipo badge-examen">Examen</span>`;
  return `<span class="badge-tipo badge-curso">Curso</span>`;
}

/* ── Clase CSS para la calificación ─────────────────────── */
function calClass(estado) {
  if (estado === "acreditado")    return "cal-acred";
  if (estado === "no_acreditado") return "cal-no";
  return "cal-pending";
}

/* ── Actualizar tarjetas resumen ─────────────────────────── */
function updateSummary(data) {
  const total  = data.length;
  const acred  = data.filter(r => getEstado(r.calificacion) === "acreditado").length;
  const noAcr  = data.filter(r => getEstado(r.calificacion) === "no_acreditado").length;
  const pend   = data.filter(r => getEstado(r.calificacion) === "pendiente").length;

  document.getElementById("cnt-total").textContent = total;
  document.getElementById("cnt-acred").textContent = acred;
  document.getElementById("cnt-no").textContent    = noAcr;
  document.getElementById("cnt-pend").textContent  = pend;
}

/* ── Poblar dropdowns de grupo y asignatura ──────────────── */
function populateDropdowns(data) {
  const grupos   = [...new Set(data.map(r => r.grupo).filter(Boolean))].sort();
  const asigs    = [...new Set(data.map(r => r.asignatura).filter(Boolean))].sort();
  const docentes = [...new Set(data.map(r => r.docente).filter(Boolean))].sort();

  const selGrupo   = document.getElementById("filter-grupo");
  const selAsig    = document.getElementById("filter-asig");
  const selDocente = document.getElementById("filter-docente");

  const selRmGrupo  = document.getElementById("rm-grupo");
  const dlCapGrupo  = document.getElementById("dl-cap-grupo");
  const dlCapAsig   = document.getElementById("dl-cap-asig");

  grupos.forEach(g => {
    const o = document.createElement("option");
    o.value = g; o.textContent = g;
    selGrupo.appendChild(o);
    selRmGrupo.appendChild(o.cloneNode(true));
    dlCapGrupo.appendChild(o.cloneNode(true));
  });
  asigs.forEach(a => {
    const o = document.createElement("option");
    o.value = a; o.textContent = a;
    selAsig.appendChild(o);
    dlCapAsig.appendChild(o.cloneNode(true));
  });
  docentes.forEach(d => {
    const o = document.createElement("option");
    o.value = d; o.textContent = d;
    selDocente.appendChild(o);
  });
}

/* ── Renderizar tabla ────────────────────────────────────── */
function renderTable(data) {
  const tbody = document.getElementById("table-body");
  const countEl = document.getElementById("results-count");
  const tableWrap  = document.getElementById("table-wrap");
  const stateEmpty = document.getElementById("state-empty");

  if (data.length === 0) {
    tableWrap.style.display  = "none";
    stateEmpty.style.display = "flex";
    countEl.textContent = "Sin resultados";
    return;
  }

  stateEmpty.style.display = "none";
  tableWrap.style.display  = "block";
  countEl.textContent = `${data.length} registro${data.length !== 1 ? "s" : ""} encontrado${data.length !== 1 ? "s" : ""}`;

  tbody.innerHTML = data.map(r => {
    const estado = getEstado(r.calificacion);
    const calDisplay = (r.calificacion !== null && r.calificacion !== "")
      ? parseFloat(r.calificacion).toFixed(1)
      : "—";
    return `
      <tr>
        <td class="td-alumno">${r.nombre}</td>
        <td class="td-grupo">${r.grupo || "—"}</td>
        <td class="td-asig">${r.asignatura || "—"}</td>
        <td class="td-docente">${r.docente || "—"}</td>
        <td>${badgeTipo(r.tipo)}</td>
        <td class="td-cal ${calClass(estado)}">${calDisplay}</td>
        <td>${badgeEstado(estado)}</td>
        <td class="td-obs">${r.observacion || ""}</td>
      </tr>`;
  }).join("");

  lucide.createIcons();
}

/* ── Leer filtros actuales y aplicar ─────────────────────── */
function applyFilters() {
  const query   = norm(document.getElementById("search-name").value);
  const grupo   = document.getElementById("filter-grupo").value;
  const asig    = document.getElementById("filter-asig").value;
  const docente = document.getElementById("filter-docente").value;
  const tipo    = document.querySelector("#tipo-group .tog-btn.active")?.dataset.tipo   || "";
  const estado  = document.querySelector("#estado-group .tog-btn.active")?.dataset.estado || "";

  _filtered = _allData.filter(r => {
    if (query   && !norm(r.nombre).includes(query))      return false;
    if (grupo   && r.grupo      !== grupo)               return false;
    if (asig    && r.asignatura !== asig)                return false;
    if (docente && r.docente    !== docente)             return false;
    if (tipo    && r.tipo.toUpperCase() !== tipo)        return false;
    if (estado  && getEstado(r.calificacion) !== estado) return false;
    return true;
  });

  updateSummary(_filtered);
  renderTable(_filtered);
}

/* ── Cargar datos desde GAS ──────────────────────────────── */
async function loadData() {
  // Mostrar loading
  document.getElementById("state-loading").style.display = "flex";
  document.getElementById("state-error").style.display   = "none";
  document.getElementById("state-empty").style.display   = "none";
  document.getElementById("table-wrap").style.display    = "none";

  // Verificar que la URL esté configurada
  if (!GAS_URL || GAS_URL.startsWith("PEGA_AQUI")) {
    showError("La URL del endpoint aún no está configurada. Edita intrasemestral.js y reemplaza GAS_URL.");
    return;
  }

  try {
    const url = `${GAS_URL}?action=getCalifIntrasemestral&_t=${Date.now()}`;
    const res  = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text);

    if (data.status !== "ok") throw new Error(data.message || "Respuesta inesperada del servidor");

    _allData = data.registros || [];

    // Ordenar: grupo → nombre alumno
    _allData.sort((a, b) => {
      const g = (a.grupo || "").localeCompare(b.grupo || "");
      return g !== 0 ? g : (a.nombre || "").localeCompare(b.nombre || "");
    });

    // Ocultar loading
    document.getElementById("state-loading").style.display = "none";

    populateDropdowns(_allData);
    applyFilters();

  } catch (err) {
    showError(`No fue posible cargar los datos. (${err.message})`);
  }
}

function showError(msg) {
  document.getElementById("state-loading").style.display = "none";
  document.getElementById("state-error").style.display   = "flex";
  document.getElementById("state-error-msg").textContent = msg;
  lucide.createIcons();
}

/* ── Clave de agrupación: norma + colapsa variantes ─────────── */
function keyAsig(str) {
  return norm(str).replace(/[\s_\-\/]+/g, " ").trim();
}

/* ── Tarjeta HTML genérica ───────────────────────────────── */
function rmCard({ title, subtitle, tipoBadge, total, acred, noAcr, pend, chips }) {
  const pct      = total > 0 ? Math.round(acred / total * 100) : 0;
  const barColor = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)";
  const chipsHtml = (chips || []).map(c =>
    `<span class="rm-chip">${c}</span>`
  ).join("");
  return `
    <div class="rm-card">
      <div class="rm-card-head">
        <div class="rm-card-asig">${title}</div>
        ${tipoBadge || ""}
      </div>
      ${subtitle ? `<div class="rm-card-sub">${subtitle}</div>` : ""}
      ${chipsHtml ? `<div class="rm-chips">${chipsHtml}</div>` : ""}
      <div class="rm-stats-row">
        <div class="rm-stat">
          <span class="rm-stat-num" style="color:var(--blue)">${total}</span>
          <span class="rm-stat-lbl">Total</span>
        </div>
        <div class="rm-stat">
          <span class="rm-stat-num" style="color:var(--green)">${acred}</span>
          <span class="rm-stat-lbl">Acred.</span>
        </div>
        <div class="rm-stat">
          <span class="rm-stat-num" style="color:var(--red)">${noAcr}</span>
          <span class="rm-stat-lbl">No acred.</span>
        </div>
        <div class="rm-stat">
          <span class="rm-stat-num" style="color:var(--amber)">${pend}</span>
          <span class="rm-stat-lbl">Pendiente</span>
        </div>
      </div>
      <div class="rm-progress-wrap">
        <div class="rm-progress-track">
          <div class="rm-progress-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <span class="rm-progress-pct">${pct}% acreditado</span>
      </div>
    </div>`;
}

/* ── Agrupar datos y calcular stats ──────────────────────── */
function groupBy(data, keyFn) {
  const map = {};
  data.forEach(r => {
    const k = keyFn(r);
    if (!map[k]) map[k] = [];
    map[k].push(r);
  });
  return map;
}
function stats(rows) {
  const total = rows.length;
  const acred = rows.filter(r => getEstado(r.calificacion) === "acreditado").length;
  const noAcr = rows.filter(r => getEstado(r.calificacion) === "no_acreditado").length;
  const pend  = rows.filter(r => getEstado(r.calificacion) === "pendiente").length;
  return { total, acred, noAcr, pend };
}

/* ── Datos filtrados para vistas de resumen ─────────────── */
function resFiltrado() {
  const grupo = document.getElementById("rm-grupo")?.value || "";
  return grupo ? _allData.filter(r => r.grupo === grupo) : _allData;
}

/* ── Vista: Por Materia ──────────────────────────────────── */
function renderMaterias(data) {
  const grid = document.getElementById("grid-materias");
  if (!grid) return;

  // Agrupar por asignatura+tipo normalizados
  const map = groupBy(data, r =>
    keyAsig(r.asignatura) + "||" + (r.tipo || "").toUpperCase()
  );

  if (!Object.keys(map).length) {
    grid.innerHTML = `<p class="rm-empty">Sin datos para mostrar.</p>`;
    return;
  }

  // Nombre a mostrar: el más frecuente dentro del grupo
  const groups = Object.values(map).map(rows => {
    const freq = {};
    rows.forEach(r => { const n = (r.asignatura||"").trim(); freq[n] = (freq[n]||0)+1; });
    const displayName = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0];
    const tipo = (rows[0].tipo || "").toUpperCase();
    return { displayName, tipo, rows };
  }).sort((a,b) => a.displayName.localeCompare(b.displayName));

  grid.innerHTML = groups.map(g => {
    const s = stats(g.rows);
    // docentes únicos como chips
    const docs = [...new Set(g.rows.map(r => (r.docente||"").trim()).filter(Boolean))].sort();
    return rmCard({
      title:     g.displayName,
      tipoBadge: badgeTipo(g.tipo),
      chips:     docs,
      ...s
    });
  }).join("");

  lucide.createIcons();
}

/* ── Vista: Por Profesor ─────────────────────────────────── */
function renderDocentes(data) {
  const grid = document.getElementById("grid-docentes");
  if (!grid) return;

  const map = groupBy(data, r => norm(r.docente || "sin docente"));

  if (!Object.keys(map).length) {
    grid.innerHTML = `<p class="rm-empty">Sin datos para mostrar.</p>`;
    return;
  }

  const groups = Object.values(map).map(rows => {
    const freq = {};
    rows.forEach(r => { const n=(r.docente||"Sin docente").trim(); freq[n]=(freq[n]||0)+1; });
    const displayName = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0];
    // materias únicas (nombre más frecuente por grupo normalizado)
    const asigMap = groupBy(rows, r => keyAsig(r.asignatura) + "||" + (r.tipo||"").toUpperCase());
    const materias = Object.values(asigMap).map(ar => {
      const f = {};
      ar.forEach(r => { const n=(r.asignatura||"").trim(); f[n]=(f[n]||0)+1; });
      return Object.entries(f).sort((a,b)=>b[1]-a[1])[0][0];
    }).sort();
    return { displayName, materias, rows };
  }).sort((a,b) => a.displayName.localeCompare(b.displayName));

  grid.innerHTML = groups.map(g => {
    const s = stats(g.rows);
    return rmCard({
      title:  g.displayName,
      subtitle: `<i data-lucide="graduation-cap" style="width:13px;height:13px;vertical-align:middle;"></i> ${g.rows.length} alumno${g.rows.length!==1?"s":""}`,
      chips:  g.materias,
      ...s
    });
  }).join("");

  lucide.createIcons();
}

/* ═══════════════════════════════════════════════════════════
   MÓDULO: CAPTURA DE CALIFICACIONES
═══════════════════════════════════════════════════════════ */

let _capLocales = []; // registros añadidos manualmente (no están en GAS)

/* ── Filtros de captura ──────────────────────────────────── */
function capFiltros() {
  const grupo = document.getElementById("cap-grupo").value.trim();
  const asig  = document.getElementById("cap-asig").value.trim();
  const tipo  = document.getElementById("cap-tipo").value;
  return { grupo, asig, tipo };
}

function capFiltrarGAS({ grupo, asig, tipo }) {
  return _allData.filter(r => {
    if (grupo && !r.grupo.toLowerCase().includes(grupo.toLowerCase()))       return false;
    if (asig  && !r.asignatura.toLowerCase().includes(asig.toLowerCase()))   return false;
    if (tipo  && r.tipo.toUpperCase() !== tipo)                              return false;
    return true;
  });
}

function capFiltrarLocal({ grupo, asig, tipo }) {
  return _capLocales.filter(r => {
    if (grupo && !r.grupo.toLowerCase().includes(grupo.toLowerCase()))       return false;
    if (asig  && !r.asignatura.toLowerCase().includes(asig.toLowerCase()))   return false;
    if (tipo  && r.tipo.toUpperCase() !== tipo)                              return false;
    return true;
  });
}

/* ── Renderizar tabla del concentrado ────────────────────── */
function renderCaptura() {
  const f    = capFiltros();
  const data = capFiltrarGAS(f);

  const wrap  = document.getElementById("cap-wrap");
  const empty = document.getElementById("cap-empty");
  const cnt   = document.getElementById("cap-cnt-gas");

  cnt.textContent = data.length;

  if (data.length === 0) {
    wrap.style.display  = "none";
    empty.style.display = "";
    empty.textContent   = "Sin registros con los filtros seleccionados.";
    return;
  }

  empty.style.display = "none";
  wrap.style.display  = "";

  const tbody = document.getElementById("cap-tbody");
  tbody.innerHTML = data.map(r => {
    const calVal = r.calificacion !== null && r.calificacion !== ""
      ? String(parseFloat(r.calificacion)) : "";
    const obsVal = r.observacion || "";
    return `
      <tr class="cap-row" data-clave="${r.clave}"
          data-cal-orig="${calVal}" data-obs-orig="${obsVal}">
        <td class="td-alumno">${r.nombre}</td>
        <td class="td-grupo">${r.grupo || "—"}</td>
        <td class="td-asig">${r.asignatura || "—"}</td>
        <td>${badgeTipo(r.tipo)}</td>
        <td style="text-align:center">
          <input class="cap-cal-input" type="number" min="0" max="10" step="0.5"
                 value="${calVal}" placeholder="—">
        </td>
        <td>
          <input class="cap-obs-input" type="text"
                 value="${obsVal}" placeholder="Observación…">
        </td>
        <td class="cap-row-status"></td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll(".cap-row").forEach(row => {
    const calInput = row.querySelector(".cap-cal-input");
    const obsInput = row.querySelector(".cap-obs-input");
    [calInput, obsInput].forEach(inp => {
      inp.addEventListener("input", () => {
        const dirty = calInput.value !== row.dataset.calOrig ||
                      obsInput.value !== row.dataset.obsOrig;
        row.classList.toggle("cap-dirty", dirty);
        row.classList.remove("cap-saved", "cap-error");
        row.querySelector(".cap-row-status").textContent = dirty ? "·" : "";
        document.getElementById("cap-btn-save").disabled =
          !tbody.querySelector(".cap-dirty");
      });
    });
  });

  updateCapInfo();
  lucide.createIcons();
}

/* ── Renderizar tabla de alumnos locales ─────────────────── */
function renderLocalTabla() {
  const f    = capFiltros();
  const data = capFiltrarLocal(f);
  const wrap  = document.getElementById("cap-local-wrap");
  const empty = document.getElementById("cap-local-empty");
  const cnt   = document.getElementById("cap-cnt-local");

  cnt.textContent = _capLocales.length;

  if (_capLocales.length === 0) {
    wrap.style.display  = "none";
    empty.style.display = "";
    return;
  }

  empty.style.display = "none";
  wrap.style.display  = "";

  document.getElementById("cap-local-tbody").innerHTML = data.map((r, i) => {
    const idx = _capLocales.indexOf(r);
    return `
      <tr>
        <td class="td-alumno">${r.nombre}</td>
        <td class="td-grupo">${r.grupo}</td>
        <td class="td-asig">${r.asignatura}</td>
        <td>${badgeTipo(r.tipo)}</td>
        <td style="text-align:center;font-family:var(--font-h);font-weight:800;font-size:1rem">
          ${r.calificacion !== "" ? r.calificacion : "—"}
        </td>
        <td>
          <button class="cap-btn-del" data-idx="${idx}" title="Eliminar">✕</button>
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll(".cap-btn-del").forEach(btn => {
    btn.addEventListener("click", () => {
      _capLocales.splice(parseInt(btn.dataset.idx), 1);
      renderLocalTabla();
      updateCapInfo();
    });
  });

  lucide.createIcons();
}

function updateCapInfo() {
  const gasN   = document.getElementById("cap-tbody")?.querySelectorAll(".cap-row").length || 0;
  const localN = _capLocales.length;
  const total  = gasN + localN;
  document.getElementById("cap-info").textContent =
    total > 0 ? `${total} registro${total !== 1 ? "s" : ""}` : "";
}

/* ── Agregar alumno local ─────────────────────────────────── */
function confirmAddLocal() {
  const nombre = document.getElementById("new-nombre").value.trim();
  const grupo  = document.getElementById("new-grupo").value.trim();
  const asig   = document.getElementById("new-asig").value.trim();
  const tipo   = document.getElementById("new-tipo").value;
  const cal    = document.getElementById("new-cal").value.trim();

  if (!nombre || !grupo || !asig) {
    alert("Nombre, grupo y asignatura son obligatorios.");
    return;
  }

  _capLocales.push({ nombre, grupo, asignatura: asig, tipo, calificacion: cal });

  // Limpiar form
  ["new-nombre","new-grupo","new-asig","new-cal"].forEach(id =>
    document.getElementById(id).value = ""
  );
  document.getElementById("new-nombre").focus();

  renderLocalTabla();
  updateCapInfo();
}

/* ── Guardar registros del concentrado (filas dirty) ─────── */
async function saveAllDirty() {
  const btn       = document.getElementById("cap-btn-save");
  const dirtyRows = [...document.querySelectorAll("#cap-tbody .cap-row.cap-dirty")];
  if (!dirtyRows.length) return;

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader"></i> Guardando…';
  lucide.createIcons();

  let saved = 0, errors = 0;

  for (const row of dirtyRows) {
    const clave    = row.dataset.clave;
    const cal      = row.querySelector(".cap-cal-input").value.trim();
    const obs      = row.querySelector(".cap-obs-input").value.trim();
    const statusEl = row.querySelector(".cap-row-status");
    statusEl.textContent = "⏳";

    try {
      const url = `${GAS_URL}?action=guardarCalif` +
        `&clave=${encodeURIComponent(clave)}` +
        `&calificacion=${encodeURIComponent(cal)}` +
        `&observacion=${encodeURIComponent(obs)}&_t=${Date.now()}`;
      const res  = await fetch(url, { redirect: "follow" });
      const json = JSON.parse(await res.text());

      if (json.status === "ok") {
        row.classList.remove("cap-dirty","cap-error");
        row.classList.add("cap-saved");
        row.dataset.calOrig = cal;
        row.dataset.obsOrig = obs;
        statusEl.textContent = "✓";
        statusEl.style.color = "var(--green)";
        const rec = _allData.find(r => r.clave === clave);
        if (rec) { rec.calificacion = cal !== "" ? parseFloat(cal) : null; rec.observacion = obs; }
        saved++;
      } else throw new Error(json.message || "Error del servidor");
    } catch (err) {
      row.classList.remove("cap-dirty");
      row.classList.add("cap-error");
      statusEl.textContent = "✗";
      statusEl.style.color = "var(--red)";
      statusEl.title = err.message;
      errors++;
    }
  }

  btn.innerHTML = '<i data-lucide="save"></i> Guardar al Sheet';
  lucide.createIcons();
  btn.disabled = !document.querySelector("#cap-tbody .cap-dirty");

  const info = document.getElementById("cap-info");
  if (errors === 0) {
    info.textContent = `✓ ${saved} guardado${saved!==1?"s":""}`;
    info.style.color = "var(--green)";
    setTimeout(() => { info.style.color = ""; updateCapInfo(); }, 3000);
  } else {
    info.textContent = `${saved} guardados, ${errors} con error`;
    info.style.color = "var(--red)";
  }
}

/* ── Generar PDF ─────────────────────────────────────────── */
async function generarPDF() {
  const tipo = document.getElementById("pdf-tipo").value;
  const { jsPDF } = window.jspdf;

  // Cargar logo (falla silenciosamente si no está disponible)
  let logoDataUrl = null;
  try {
    const blob = await fetch("../assets/logo.png").then(r => r.blob());
    logoDataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });
  } catch (_) { /* continuar sin logo */ }

  const NUM_ASIST = 8; // columnas de asistencia

  // Recopilar todos los registros visibles
  const gasRows = [...document.querySelectorAll("#cap-tbody .cap-row")].map(row => ({
    nombre:      row.cells[0].textContent.trim(),
    grupo:       row.cells[1].textContent.trim(),
    asignatura:  row.cells[2].textContent.trim(),
    docente:     "",
    tipo:        row.cells[3].textContent.trim(),
    calificacion: row.querySelector(".cap-cal-input")?.value?.trim() || "",
  }));

  gasRows.forEach(r => {
    const found = _allData.find(d => d.nombre === r.nombre && d.grupo === r.grupo && d.asignatura === r.asignatura);
    if (found) r.docente = found.docente || "";
  });

  const allRows = [
    ...gasRows,
    ..._capLocales.map(r => ({
      nombre: r.nombre, grupo: r.grupo, asignatura: r.asignatura,
      docente: "", tipo: r.tipo, calificacion: r.calificacion,
    }))
  ];

  if (!allRows.length) { alert("No hay registros para generar el PDF."); return; }

  let grupoFn, etiquetaFn, subTitulo;
  if (tipo === "grupo") {
    grupoFn    = r => r.grupo || "SIN GRUPO";
    etiquetaFn = k => `GRUPO: ${k}`;
    subTitulo  = "Por Grupo";
  } else if (tipo === "docente") {
    grupoFn    = r => r.docente || "SIN DOCENTE";
    etiquetaFn = k => `DOCENTE: ${k}`;
    subTitulo  = "Por Docente";
  } else if (tipo === "materia") {
    grupoFn    = r => r.asignatura || "SIN ASIGNATURA";
    etiquetaFn = k => `ASIGNATURA: ${k}`;
    subTitulo  = "Por Materia";
  } else {
    grupoFn    = () => "TODOS";
    etiquetaFn = () => "TODOS LOS GRUPOS";
    subTitulo  = "General";
  }

  const agrupado = {};
  allRows.forEach(r => {
    const k = grupoFn(r);
    if (!agrupado[k]) agrupado[k] = [];
    agrupado[k].push(r);
  });

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W     = doc.internal.pageSize.getWidth();
  const mes   = "MAYO DE 2026";
  const fecha = new Date().toISOString().slice(0, 10);
  let first   = true;

  Object.entries(agrupado).sort().forEach(([clave, registros]) => {
    if (!first) doc.addPage();
    first = false;

    const turno = tipo === "grupo"
      ? (/^V/i.test(clave) ? "TURNO VESPERTINO" : /^M/i.test(clave) ? "TURNO MATUTINO" : "")
      : "";
    const etiqueta = etiquetaFn(clave);

    // ── Logo ──
    if (logoDataUrl) {
      // Aspect ratio logo: 3093×4026 → portrait; ajustamos a 14mm de alto
      doc.addImage(logoDataUrl, "PNG", 14, 7, 10.7, 14);
    }

    // ── Encabezado de página ──
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text('CENTRO DE ESTUDIOS DE BACHILLERATO 5/4 "PROFR. RAFAEL RAMÍREZ"', W/2, 14, { align:"center" });
    doc.setFontSize(9.5);
    if (turno) { doc.text(turno, W/2, 20, { align:"center" }); }
    doc.setFont("helvetica", "normal");
    doc.text("LISTA ASISTENCIAS Y CALIFICACIONES", W/2, turno ? 26 : 20, { align:"center" });
    doc.setFont("helvetica", "bold");
    doc.text("EVALUACIÓN EXTRAORDINARIA", W/2, turno ? 32 : 26, { align:"center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(etiqueta, 14, turno ? 38 : 32);
    doc.text(mes, W - 14, turno ? 38 : 32, { align:"right" });

    const startY = turno ? 42 : 36;

    // ── Columnas según tipo de agrupación ──
    const showGrupo   = tipo !== "grupo";
    const showDocente = tipo !== "docente";
    const showAsig    = tipo !== "materia";

    // Estilo base de encabezado
    const HS = { valign: "middle", halign: "center", fontStyle: "bold" };

    // Fila 1: encabezados combinados
    const head1 = [
      { content: "No.",                   rowSpan: 2, styles: { ...HS } },
      { content: "NOMBRE DEL ALUMNO(A)",  rowSpan: 2, styles: { ...HS, halign: "left" } },
    ];
    if (showGrupo)   head1.push({ content: "GRUPO",      rowSpan: 2, styles: { ...HS } });
    if (showAsig)    head1.push({ content: "ASIGNATURA", rowSpan: 2, styles: { ...HS } });
    if (showDocente) head1.push({ content: "DOCENTE",    rowSpan: 2, styles: { ...HS } });
    head1.push(
      { content: "ASISTENCIAS",           colSpan: NUM_ASIST, styles: { ...HS } },
      { content: "TOTAL",                 rowSpan: 2, styles: { ...HS } },
      { content: "RASGOS DE EVALUACION",  colSpan: 5, styles: { ...HS } },
      { content: "CALIFICACION",          rowSpan: 2, styles: { ...HS } }
    );

    // Fila 2: sub-encabezados de asistencias (vacíos) y rasgos (1-5)
    const head2 = [
      ...Array(NUM_ASIST).fill({ content: "", styles: { halign: "center" } }),
      { content: "1", styles: { halign: "center" } },
      { content: "2", styles: { halign: "center" } },
      { content: "3", styles: { halign: "center" } },
      { content: "4", styles: { halign: "center" } },
      { content: "5", styles: { halign: "center" } },
    ];

    // Cuerpo de la tabla
    const body = registros.map((r, i) => {
      const row = [i + 1, r.nombre];
      if (showGrupo)   row.push(r.grupo   || "");
      if (showAsig)    row.push(r.asignatura || "");
      if (showDocente) row.push(r.docente || "");
      row.push(...Array(NUM_ASIST).fill("")); // asistencias
      row.push("");                            // total
      row.push("", "", "", "", "");            // rasgos 1-5
      row.push(r.calificacion || "");          // calificación
      return row;
    });

    // Anchos adaptados según cuántas columnas extra se muestran
    // (carta horizontal = 279mm; márgenes 14+14 = 251mm útiles)
    const nombreW = tipo === "general" ? 43 : tipo === "grupo" ? 54 : tipo === "docente" ? 58 : 62;
    const asigW   = tipo === "general" ? 34 : tipo === "grupo" ? 46 : 50;
    const docW    = tipo === "general" ? 28 : tipo === "grupo" ? 36 : 40;

    const colStyles = {
      0: { cellWidth: 7,      halign: "center" },
      1: { cellWidth: nombreW, overflow: "linebreak" },
    };
    let ci = 2;
    if (showGrupo)   { colStyles[ci] = { cellWidth: 11, halign: "center" }; ci++; }
    if (showAsig)    { colStyles[ci] = { cellWidth: asigW, overflow: "linebreak" }; ci++; }
    if (showDocente) { colStyles[ci] = { cellWidth: docW,  overflow: "linebreak" }; ci++; }
    for (let j = 0; j < NUM_ASIST; j++) { colStyles[ci] = { cellWidth: 5.5, halign: "center" }; ci++; }
    colStyles[ci] = { cellWidth: 9, halign: "center" }; ci++;    // total
    for (let j = 0; j < 5; j++) { colStyles[ci] = { cellWidth: 7, halign: "center" }; ci++; }
    colStyles[ci] = { cellWidth: 14, halign: "center" };          // calificación

    doc.autoTable({
      startY,
      head: [head1, head2],
      body,
      styles:       { fontSize: 7, cellPadding: 1.5 },
      headStyles:   { fillColor: [15, 23, 42], textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      columnStyles: colStyles,
      margin:       { left: 14, right: 14 },
      theme:        "grid",
    });

    // ── Firma del docente ──
    const tableEndY    = doc.lastAutoTable.finalY;
    const sigY         = tableEndY + 20;
    const docenteNombre = registros.find(r => r.docente)?.docente || "";
    const sigX         = W / 2;

    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.line(sigX - 45, sigY, sigX + 45, sigY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Firma del Docente", sigX, sigY + 5, { align: "center" });
    if (docenteNombre) {
      doc.setFont("helvetica", "bold");
      doc.text(docenteNombre, sigX, sigY + 10, { align: "center" });
    }
  });

  doc.save(`Eval_Extraordinaria_${subTitulo.replace(/ /g, "_")}_${fecha}.pdf`);
}

/* ── Inicializar eventos ─────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  // Pestañas
  const PANELS = ["registros", "materias", "docentes", "captura"];
  let _activeTab = "registros";

  function activateTab(tab) {
    _activeTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === tab)
    );
    PANELS.forEach(p => {
      document.getElementById("panel-" + p).style.display = p === tab ? "" : "none";
    });
    const filterBar = document.getElementById("resumen-filter-bar");
    filterBar.style.display = (tab === "materias" || tab === "docentes") ? "flex" : "none";
    if (tab === "materias") renderMaterias(resFiltrado());
    if (tab === "docentes") renderDocentes(resFiltrado());
    if (tab === "captura" && _allData.length) { renderCaptura(); renderLocalTabla(); }
  }

  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.addEventListener("click", () => activateTab(btn.dataset.tab))
  );

  // Filtro de grupo para resumen
  document.getElementById("rm-grupo").addEventListener("change", () => {
    if (_activeTab === "materias") renderMaterias(resFiltrado());
    if (_activeTab === "docentes") renderDocentes(resFiltrado());
  });

  // Búsqueda en tiempo real (debounce 300ms)
  let _searchTimer;
  document.getElementById("search-name").addEventListener("input", () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(applyFilters, 300);
  });

  // Dropdowns
  document.getElementById("filter-grupo").addEventListener("change",   applyFilters);
  document.getElementById("filter-asig").addEventListener("change",    applyFilters);
  document.getElementById("filter-docente").addEventListener("change", applyFilters);

  // Toggle buttons — tipo
  document.querySelectorAll("#tipo-group .tog-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tipo-group .tog-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilters();
    });
  });

  // Toggle buttons — estado
  document.querySelectorAll("#estado-group .tog-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#estado-group .tog-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilters();
    });
  });

  // Limpiar filtros
  document.getElementById("btn-clear").addEventListener("click", () => {
    document.getElementById("search-name").value      = "";
    document.getElementById("filter-grupo").value     = "";
    document.getElementById("filter-asig").value      = "";
    document.getElementById("filter-docente").value   = "";
    document.querySelectorAll("#tipo-group .tog-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
    document.querySelectorAll("#estado-group .tog-btn").forEach((b, i) => b.classList.toggle("active", i === 0));
    applyFilters();
  });

  // Filtros de captura (input para texto libre, change para select)
  let _capTimer;
  ["cap-grupo","cap-asig"].forEach(id =>
    document.getElementById(id).addEventListener("input", () => {
      clearTimeout(_capTimer);
      _capTimer = setTimeout(() => { renderCaptura(); renderLocalTabla(); }, 250);
    })
  );
  document.getElementById("cap-tipo").addEventListener("change", () => {
    renderCaptura(); renderLocalTabla();
  });

  // Guardar al Sheet
  document.getElementById("cap-btn-save").addEventListener("click", saveAllDirty);

  // PDF
  document.getElementById("cap-btn-pdf").addEventListener("click", generarPDF);

  // Agregar alumno local
  document.getElementById("cap-btn-add").addEventListener("click", () => {
    const form = document.getElementById("cap-add-form");
    form.style.display = form.style.display === "none" ? "" : "none";
    if (form.style.display !== "none") document.getElementById("new-nombre").focus();
  });
  document.getElementById("cap-confirm-add").addEventListener("click", confirmAddLocal);
  document.getElementById("cap-cancel-add").addEventListener("click", () => {
    document.getElementById("cap-add-form").style.display = "none";
  });
  document.getElementById("new-nombre").addEventListener("keydown", e => {
    if (e.key === "Enter") confirmAddLocal();
  });

  // Carga inicial
  loadData();
});
