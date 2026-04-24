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
  const selCapGrupo = document.getElementById("cap-grupo");
  const selCapAsig  = document.getElementById("cap-asig");

  grupos.forEach(g => {
    const o = document.createElement("option");
    o.value = g; o.textContent = g;
    selGrupo.appendChild(o);
    selRmGrupo.appendChild(o.cloneNode(true));
    selCapGrupo.appendChild(o.cloneNode(true));
  });
  asigs.forEach(a => {
    const o = document.createElement("option");
    o.value = a; o.textContent = a;
    selAsig.appendChild(o);
    selCapAsig.appendChild(o.cloneNode(true));
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

function renderCaptura() {
  const grupo = document.getElementById("cap-grupo").value;
  const asig  = document.getElementById("cap-asig").value;
  const tipo  = document.getElementById("cap-tipo").value;

  const data = _allData.filter(r => {
    if (!grupo)                               return false; // grupo obligatorio
    if (r.grupo !== grupo)                    return false;
    if (asig && r.asignatura !== asig)        return false;
    if (tipo && r.tipo.toUpperCase() !== tipo) return false;
    return true;
  });

  const wrap  = document.getElementById("cap-wrap");
  const empty = document.getElementById("cap-empty");
  const info  = document.getElementById("cap-info");

  if (!grupo) {
    wrap.style.display  = "none";
    empty.style.display = "flex";
    info.textContent    = "Selecciona un grupo para comenzar";
    return;
  }

  if (data.length === 0) {
    wrap.style.display  = "none";
    empty.style.display = "flex";
    empty.querySelector("p").textContent = "Sin registros con los filtros seleccionados.";
    info.textContent = "0 registros";
    return;
  }

  empty.style.display = "none";
  wrap.style.display  = "";
  info.textContent    = `${data.length} registro${data.length !== 1 ? "s" : ""}`;
  setCapSaveBtn(false);

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
        <td class="cap-row-status" data-lucide-status></td>
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
        row.querySelector("[data-lucide-status]").textContent = dirty ? "·" : "";
        setCapSaveBtn(!!tbody.querySelector(".cap-dirty"));
      });
    });
  });

  lucide.createIcons();
}

function setCapSaveBtn(enabled) {
  const btn = document.getElementById("cap-btn-save");
  btn.disabled = !enabled;
}

async function saveAllDirty() {
  const btn      = document.getElementById("cap-btn-save");
  const info     = document.getElementById("cap-info");
  const dirtyRows = [...document.querySelectorAll(".cap-row.cap-dirty")];
  if (!dirtyRows.length) return;

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader"></i> Guardando…';
  lucide.createIcons();

  let saved = 0, errors = 0;

  for (const row of dirtyRows) {
    const clave  = row.dataset.clave;
    const cal    = row.querySelector(".cap-cal-input").value.trim();
    const obs    = row.querySelector(".cap-obs-input").value.trim();
    const statusEl = row.querySelector("[data-lucide-status]");

    statusEl.textContent = "⏳";

    try {
      const url = `${GAS_URL}?action=guardarCalif` +
        `&clave=${encodeURIComponent(clave)}` +
        `&calificacion=${encodeURIComponent(cal)}` +
        `&observacion=${encodeURIComponent(obs)}` +
        `&_t=${Date.now()}`;

      const res  = await fetch(url, { redirect: "follow" });
      const json = JSON.parse(await res.text());

      if (json.status === "ok") {
        row.classList.remove("cap-dirty", "cap-error");
        row.classList.add("cap-saved");
        row.dataset.calOrig = cal;
        row.dataset.obsOrig = obs;
        statusEl.textContent = "✓";
        statusEl.style.color = "var(--green)";
        // actualizar caché local
        const rec = _allData.find(r => r.clave === clave);
        if (rec) {
          rec.calificacion = cal !== "" ? parseFloat(cal) : null;
          rec.observacion  = obs;
        }
        saved++;
      } else {
        throw new Error(json.message || "Error del servidor");
      }
    } catch (err) {
      row.classList.remove("cap-dirty");
      row.classList.add("cap-error");
      statusEl.textContent = "✗";
      statusEl.style.color = "var(--red)";
      statusEl.title       = err.message;
      errors++;
    }
  }

  btn.innerHTML = '<i data-lucide="save"></i> Guardar cambios';
  lucide.createIcons();
  setCapSaveBtn(!!document.querySelector(".cap-dirty"));

  if (errors === 0) {
    info.textContent = `✓ ${saved} guardado${saved !== 1 ? "s" : ""}`;
    info.style.color = "var(--green)";
    setTimeout(() => {
      info.textContent = document.getElementById("cap-grupo").value
        ? `${document.querySelectorAll(".cap-row").length} registros` : "";
      info.style.color = "";
    }, 3000);
  } else {
    info.textContent = `${saved} guardado${saved!==1?"s":""}, ${errors} con error`;
    info.style.color = "var(--red)";
  }
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
    if (tab === "captura")  renderCaptura();
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

  // Filtros de captura
  ["cap-grupo", "cap-asig", "cap-tipo"].forEach(id =>
    document.getElementById(id).addEventListener("change", renderCaptura)
  );
  document.getElementById("cap-btn-save").addEventListener("click", saveAllDirty);

  // Carga inicial
  loadData();
});
