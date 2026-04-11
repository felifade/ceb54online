// pec/js/app_calificaciones.js

const CAL_API_URL = "https://script.google.com/macros/s/AKfycbz4q9VlhAvvVJ1XYOwqNTJ9eMkVRm3HgoyFJNpEQaPJsDdK1JcfhbTX1CRfDg38x79fsA/exec";

let state = {
  parcialActivo: 1,
  isAdmin: false,
  parciales: { p1: { activa: false, data: [] }, p2: { activa: false, data: [] }, p3: { activa: false, data: [] } },
  stats: { totalEquipos: 0, evaluadosP2: 0, evaluadosP3: 0 },
  fechas: { p1: "", p2: "", p3: "" },
  filtroGrupo: "todos"
};

// ── INICIALIZACIÓN ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();

  const userName = sessionStorage.getItem("user_name") || "Docente PEC";
  document.getElementById("topbar-user-name").textContent = userName;

  await cargarDatos();
  renderTabs();
  cambiarTab(1);
  renderBannerFecha();

  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
});

// ── FETCH DE DATOS ──────────────────────────────────────────────
async function cargarDatos() {
  const userEmail = sessionStorage.getItem("user_email") || "";
  const url = `${CAL_API_URL}?action=getCalificaciones&userEmail=${encodeURIComponent(userEmail)}&_t=${Date.now()}`;

  try {
    mostrarCargando(true);
    const res  = await fetch(url, { method: "GET", redirect: "follow" });
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message);

    state.isAdmin   = data.isAdmin;
    state.parciales = data.parciales;
    state.stats     = data.stats;
    state.fechas    = data.fechas || { p1: "", p2: "", p3: "" };
  } catch (err) {
    document.getElementById("contenido-tabla").innerHTML =
      `<p style="color:#ef4444;padding:2rem;">Error al cargar datos: ${err.message}</p>`;
  } finally {
    mostrarCargando(false);
  }
}

// ── RENDER TABS ─────────────────────────────────────────────────
function renderTabs() {
  [1, 2, 3].forEach(n => {
    const key    = "p" + n;
    const activa = state.parciales[key].activa;
    const btn    = document.getElementById(`tab-p${n}`);
    const badge  = document.getElementById(`badge-p${n}`);
    const toggle = document.getElementById(`toggle-p${n}`);

    // Icono y clase del tab
    btn.querySelector(".tab-icon").setAttribute("data-lucide", activa ? "unlock" : "lock");
    btn.classList.toggle("tab-activa",   activa);
    btn.classList.toggle("tab-bloqueada", !activa);
    btn.disabled = !activa && !state.isAdmin;

    // Badge de estado
    badge.textContent   = activa ? "Disponible" : "No disponible";
    badge.className     = "tab-badge " + (activa ? "badge-activa" : "badge-bloqueada");

    // Botón de admin
    if (toggle) {
      toggle.style.display    = state.isAdmin ? "inline-flex" : "none";
      toggle.textContent      = activa ? "🔒 Bloquear" : "🔓 Activar";
      toggle.className        = "btn-toggle " + (activa ? "btn-bloquear" : "btn-activar");
      toggle.onclick          = () => toggleParcial(n, !activa);
    }

    lucide.createIcons();
  });

  // Mostrar panel admin completo
  document.getElementById("panel-admin").style.display = state.isAdmin ? "block" : "none";

  // Progreso automático P2 y P3
  if (state.isAdmin) {
    document.getElementById("admin-stats").style.display = "flex";
    const { totalEquipos, evaluadosP2, evaluadosP3 } = state.stats;
    document.getElementById("stat-p2").textContent = `P2: ${evaluadosP2}/${totalEquipos} equipos evaluados`;
    document.getElementById("stat-p3").textContent = `P3: ${evaluadosP3}/${totalEquipos} equipos evaluados`;
  }
}

// ── RENDER TABLA ────────────────────────────────────────────────
function renderTabla() {
  const key    = "p" + state.parcialActivo;
  const par    = state.parciales[key];
  const cont   = document.getElementById("contenido-tabla");
  const grupos = document.getElementById("filtro-grupo");

  if (!par.activa) {
    cont.innerHTML = `
      <div class="estado-bloqueado">
        <i data-lucide="lock" style="width:48px;height:48px;color:#94a3b8;"></i>
        <p>Las calificaciones del Parcial ${state.parcialActivo} aún no están disponibles.</p>
        ${state.isAdmin ? "<p style='font-size:0.8rem;color:#64748b;'>Actívalas con el botón de arriba cuando estén listas.</p>" : ""}
      </div>`;
    lucide.createIcons();
    return;
  }

  let data = [...par.data];

  // Poblar filtro de grupos
  const gruposUnicos = [...new Set(data.map(r => r.grupo))].sort();
  grupos.innerHTML = `<option value="todos">Todos los grupos</option>` +
    gruposUnicos.map(g => `<option value="${g}" ${state.filtroGrupo === g ? "selected" : ""}>${g}</option>`).join("");

  // Aplicar filtro
  if (state.filtroGrupo !== "todos") data = data.filter(r => r.grupo === state.filtroGrupo);

  // Ordenar por grupo luego por nombre
  data.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.alumno.localeCompare(b.alumno));

  if (data.length === 0) {
    cont.innerHTML = `<p style="padding:2rem;color:#64748b;">No hay calificaciones registradas para este parcial.</p>`;
    return;
  }

  const filas = data.map((r, i) => {
    const reprobado = r.cal < 1.2;
    const color = r.cal >= 1.8 ? "#059669" : r.cal >= 1.2 ? "#d97706" : "#ef4444";
    const badge = reprobado
      ? `<span style="margin-left:8px;font-size:0.7rem;font-weight:700;background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:20px;">REPROBADO</span>`
      : "";
    const rowBg = reprobado ? "background:#fff5f5;" : "";

    // Desglose por materia — se muestra solo si la API devuelve r.materias
    const mats = Array.isArray(r.materias) ? r.materias : [];
    const desglose = mats.length > 0
      ? `<div style="margin-top:5px;font-size:0.68rem;color:#94a3b8;line-height:1.6;font-weight:400;">
           ${mats.map(m =>
             `<span style="white-space:nowrap;">${m.nombre}:&nbsp;<strong style="color:#64748b;">${typeof m.cal === 'number' ? m.cal.toFixed(1) : m.cal}</strong></span>`
           ).join('<span style="color:#e2e8f0;"> &middot; </span>')}
         </div>`
      : "";

    return `
      <tr style="${rowBg}">
        <td style="text-align:center;color:#64748b;font-size:0.85rem;">${i + 1}</td>
        <td>${r.alumno}${badge}</td>
        <td style="text-align:center;">${r.grupo}</td>
        <td style="text-align:center;font-weight:700;color:${color};">${r.cal.toFixed(2)}${desglose}</td>
      </tr>`;
  }).join("");

  cont.innerHTML = `
    <table id="tabla-calificaciones">
      <thead>
        <tr>
          <th style="width:40px;">#</th>
          <th>Alumno</th>
          <th style="width:80px;">Grupo</th>
          <th style="width:120px;">Cal. PEC</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

// ── CAMBIO DE TAB ───────────────────────────────────────────────
function cambiarTab(n) {
  state.parcialActivo = n;
  state.filtroGrupo   = "todos";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-selected"));
  document.getElementById(`tab-p${n}`).classList.add("tab-selected");
  renderBannerFecha();
  renderTabla();
}

// ── BANNER FECHA LÍMITE ─────────────────────────────────────────
function renderBannerFecha() {
  const key   = "p" + state.parcialActivo;
  const fecha = state.fechas[key] || "";
  const banner = document.getElementById("banner-fecha");

  if (!fecha && !state.isAdmin) { banner.style.display = "none"; return; }

  banner.style.display = "flex";
  document.getElementById("banner-fecha-texto").textContent =
    fecha ? `Parcial ${state.parcialActivo}: ${fecha}` : "Sin fecha definida para este parcial.";

  const adminDiv = document.getElementById("banner-fecha-admin");
  if (state.isAdmin) {
    adminDiv.style.display = "flex";
    document.getElementById("input-fecha").value = fecha;
  }
}

async function guardarFechaLimite() {
  const key   = "p" + state.parcialActivo;
  const fecha = document.getElementById("input-fecha").value.trim();
  const userEmail = sessionStorage.getItem("user_email") || "";

  try {
    const res = await fetch(CAL_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "setFechaLimite", parcial: state.parcialActivo, fecha, docente_email: userEmail }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message);
    state.fechas[key] = fecha;
    renderBannerFecha();
  } catch (err) {
    alert("Error al guardar: " + err.message);
  }
}

// ── FILTRO DE GRUPO ─────────────────────────────────────────────
document.addEventListener("change", e => {
  if (e.target.id === "filtro-grupo") {
    state.filtroGrupo = e.target.value;
    renderTabla();
  }
});

// ── TOGGLE ADMIN ────────────────────────────────────────────────
async function toggleParcial(parcial, activar) {
  const userEmail = sessionStorage.getItem("user_email") || "";
  try {
    const res = await fetch(CAL_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "toggleCalificacion", parcial, activa: activar, docente_email: userEmail }),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message);

    // Actualizar estado local y re-renderizar
    state.parciales["p" + parcial].activa = activar;
    renderTabs();
    renderTabla();
  } catch (err) {
    alert("Error al cambiar estado: " + err.message);
  }
}

// ── COPIAR SOLO CALIFICACIONES ───────────────────────────────────
function copiarSoloCalificaciones() {
  const key = "p" + state.parcialActivo;
  let data  = [...state.parciales[key].data];
  if (state.filtroGrupo !== "todos") data = data.filter(r => r.grupo === state.filtroGrupo);
  data.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.alumno.localeCompare(b.alumno));

  const texto = data.map(r => r.cal.toFixed(2)).join("\n");

  navigator.clipboard.writeText(texto).then(() => {
    const btn = document.getElementById("btn-copiar-cal");
    btn.textContent = "✓ Copiado";
    btn.style.background = "#059669";
    setTimeout(() => {
      btn.innerHTML = '<i data-lucide="hash" style="width:14px;height:14px;"></i> Solo calificaciones';
      btn.style.background = "#7c3aed";
      lucide.createIcons();
    }, 2000);
  });
}

// ── COPIAR DATOS AL PORTAPAPELES ─────────────────────────────────
function copiarDatos() {
  const key = "p" + state.parcialActivo;
  let data  = [...state.parciales[key].data];
  if (state.filtroGrupo !== "todos") data = data.filter(r => r.grupo === state.filtroGrupo);
  data.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.alumno.localeCompare(b.alumno));

  const tsv = ["Alumno\tGrupo\tCalificación PEC"]
    .concat(data.map(r => `${r.alumno}\t${r.grupo}\t${r.cal.toFixed(2)}`))
    .join("\n");

  navigator.clipboard.writeText(tsv).then(() => {
    const btn = document.getElementById("btn-copiar");
    btn.textContent = "✓ Copiado";
    btn.classList.add("copiado");
    setTimeout(() => {
      btn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px;"></i> Copiar datos';
      btn.classList.remove("copiado");
      lucide.createIcons();
    }, 2000);
  });
}

// ── UTILIDADES ───────────────────────────────────────────────────
function mostrarCargando(show) {
  document.getElementById("loading").style.display = show ? "flex" : "none";
  document.getElementById("contenido").style.display = show ? "none" : "block";
}
