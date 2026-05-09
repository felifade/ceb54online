// "Mi Estudio" — marcadores, notas, progreso, sync con Drive.

import { loadCatalog, escapeHtml } from "./app.js";
import { storage, LocalBackend, DriveBackend } from "./storage.js";
import { driveSync } from "./drive-sync.js";

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let CATALOG = null;
let DOCS_BY_ID = {};

// === Render del estado de Drive Sync ===
function renderSyncBar() {
  const bar = $("#sync-bar");
  if (!driveSync.isConfigured()) {
    bar.innerHTML = `
      <span class="sync-state offline">📂 Solo en este dispositivo</span>
      <button class="btn btn-sm" id="btn-config-drive">Configurar Drive Sync</button>
      <button class="btn btn-sm" id="btn-export">⤓ Exportar</button>
      <button class="btn btn-sm" id="btn-import">⤴ Importar</button>
    `;
    $("#btn-config-drive").onclick = openDriveConfigModal;
  } else if (!driveSync.isSignedIn()) {
    bar.innerHTML = `
      <span class="sync-state offline">📂 Drive desconectado</span>
      <button class="btn btn-sm btn-primary" id="btn-signin-drive">Conectar mi Google Drive</button>
      <button class="btn btn-sm" id="btn-config-drive">⚙ Cambiar Client ID</button>
    `;
    $("#btn-signin-drive").onclick = doSignIn;
    $("#btn-config-drive").onclick = openDriveConfigModal;
  } else {
    bar.innerHTML = `
      <span class="sync-state online">☁️ Sincronizado con Google Drive</span>
      <button class="btn btn-sm" id="btn-signout-drive">Desconectar</button>
      <button class="btn btn-sm" id="btn-export">⤓ Exportar</button>
    `;
    $("#btn-signout-drive").onclick = doSignOut;
  }
  if ($("#btn-export")) $("#btn-export").onclick = doExport;
  if ($("#btn-import")) $("#btn-import").onclick = doImport;
}

function openDriveConfigModal() {
  $("#modal-root").innerHTML = `
    <div class="modal-backdrop" id="modal-bg">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Configurar Drive Sync</h2>
          <button class="close" id="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p>Pega el <strong>Client ID</strong> que creaste en Google Cloud Console.</p>
          <label for="cid">OAuth Client ID</label>
          <input type="text" id="cid" placeholder="123…apps.googleusercontent.com" value="${escapeHtml(driveSync.clientId)}">
          <p class="hint">¿Aún no lo tienes? Pídele a Claude las instrucciones (o ve a <a href="https://console.cloud.google.com/auth/clients" target="_blank">console.cloud.google.com/auth/clients</a>).</p>
          <p class="hint">Tu Client ID NO es secreto — está protegido por el dominio autorizado (ceb54.online).</p>
        </div>
        <div class="modal-footer">
          <button class="btn" id="modal-cancel">Cancelar</button>
          <button class="btn btn-primary" id="modal-save">Guardar y conectar</button>
        </div>
      </div>
    </div>
  `;
  const close = () => { $("#modal-root").innerHTML = ""; };
  $("#modal-close").onclick = close;
  $("#modal-cancel").onclick = close;
  $("#modal-bg").onclick = close;
  $("#modal-save").onclick = async () => {
    const id = $("#cid").value.trim();
    if (!id) return;
    driveSync.setClientId(id);
    close();
    renderSyncBar();
    await doSignIn();
  };
  setTimeout(() => $("#cid").focus(), 50);
}

async function doSignIn() {
  try {
    setBanner("Conectando con Google Drive…", "info");
    await driveSync.signIn();
    // Cambiar el backend del storage a Drive (sincroniza local↔drive)
    await storage.setBackend(new DriveBackend(driveSync));
    setBanner("✓ Conectado. Tus notas y marcadores ahora sincronizan entre dispositivos.", "success");
    renderSyncBar();
    renderAll();
    setTimeout(clearBanner, 4000);
  } catch (e) {
    setBanner(`No se pudo conectar: ${e.message}`, "error");
  }
}

async function doSignOut() {
  driveSync.signOut();
  await storage.setBackend(new LocalBackend());
  renderSyncBar();
  renderAll();
  setBanner("Desconectado. Los datos siguen en este dispositivo.", "info");
  setTimeout(clearBanner, 3000);
}

function doExport() {
  const blob = new Blob([storage.exportJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consultor-director-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function doImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    if (!confirm("Importar reemplaza tus datos actuales en este dispositivo. ¿Continuar?")) return;
    const text = await f.text();
    try {
      await storage.importJson(text);
      renderAll();
      setBanner("✓ Datos importados.", "success");
      setTimeout(clearBanner, 3000);
    } catch (e) {
      setBanner(`Error importando: ${e.message}`, "error");
    }
  };
  input.click();
}

function setBanner(msg, kind) {
  const b = $("#info-banner");
  b.className = `info-banner ${kind || ""}`;
  b.textContent = msg;
  b.style.display = "block";
}
function clearBanner() { $("#info-banner").style.display = "none"; }

// === Render de marcadores ===
function renderBookmarks() {
  const root = $("#bookmarks-list");
  const all = storage.getBookmarks();
  if (all.length === 0) {
    root.innerHTML = `<p class="empty-state">Aún no tienes marcadores. Toca la ⭐ en cualquier resultado de búsqueda o en el lector para guardar páginas clave.</p>`;
    return;
  }
  // Agrupar por documento
  const grouped = {};
  all.forEach(b => {
    if (!grouped[b.doc]) grouped[b.doc] = [];
    grouped[b.doc].push(b);
  });
  // Ordenar docs por categoría → mantener orden del catalog
  const orderedDocs = CATALOG.documents.filter(d => grouped[d.id]);
  root.innerHTML = orderedDocs.map(doc => {
    const cat = CATALOG.categories[doc.category];
    const marks = grouped[doc.id].sort((a, b) => a.page - b.page);
    return `
      <div class="bm-doc" style="--cat-color:${cat.color};--cat-color-soft:${cat.tint}">
        <header class="bm-doc-head">
          <span class="doc-abbr" style="color:${cat.color};background:${cat.tint}">${doc.abbr}</span>
          <h3>${escapeHtml(doc.short || doc.title)}</h3>
          <span class="bm-count">${marks.length} ${marks.length === 1 ? "página" : "páginas"}</span>
        </header>
        <ul class="bm-pages">
          ${marks.map(m => `
            <li>
              <a href="lector.html?id=${m.doc}&page=${m.page}">página ${m.page}</a>
              ${m.note ? `<span class="bm-note">${escapeHtml(m.note)}</span>` : ""}
              <button class="bm-remove" data-doc="${m.doc}" data-page="${m.page}" title="Quitar">×</button>
            </li>
          `).join("")}
        </ul>
      </div>
    `;
  }).join("");
  root.querySelectorAll(".bm-remove").forEach(b => {
    b.onclick = () => {
      storage.toggleBookmark(parseInt(b.dataset.doc), parseInt(b.dataset.page));
      renderBookmarks();
    };
  });
}

// === Render de notas ===
function renderNotes() {
  const root = $("#notes-list");
  const all = storage.getAllNotes();
  if (all.length === 0) {
    root.innerHTML = `<p class="empty-state">Aún no tienes notas. En el lector (modo iBook) puedes anotar lo que quieras recordar de cada página.</p>`;
    return;
  }
  // Ordenar por updatedAt desc
  const sorted = [...all].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  root.innerHTML = sorted.map(n => {
    const doc = DOCS_BY_ID[n.doc];
    if (!doc) return "";
    const cat = CATALOG.categories[doc.category];
    return `
      <article class="note-card" style="--cat-color:${cat.color}">
        <header class="note-head">
          <a href="lector.html?id=${n.doc}&page=${n.page}" class="doc-abbr" style="color:${cat.color};background:${cat.tint}">${doc.abbr} p.${n.page}</a>
          <span class="note-date">${formatDate(n.updatedAt)}</span>
        </header>
        <p>${escapeHtml(n.text).replace(/\n/g, "<br>")}</p>
      </article>
    `;
  }).join("");
}

// === Render de progreso de lectura ===
function renderProgress() {
  const root = $("#progress-list");
  const all = storage.getAllProgress();
  const entries = Object.entries(all);
  if (entries.length === 0) {
    root.innerHTML = `<p class="empty-state">Aún no has comenzado a leer. Abre cualquier documento del catálogo y aparecerá aquí.</p>`;
    return;
  }
  // Ordenar por lastReadAt desc
  entries.sort((a, b) => (b[1].lastReadAt || 0) - (a[1].lastReadAt || 0));
  root.innerHTML = entries.map(([docId, p]) => {
    const doc = DOCS_BY_ID[parseInt(docId)];
    if (!doc) return "";
    const cat = CATALOG.categories[doc.category];
    const pct = Math.min(100, Math.round((p.completedPages.length / doc.pages) * 100));
    return `
      <a href="lector.html?id=${doc.id}&page=${p.lastPage}" class="prog-card" style="--cat-color:${cat.color}">
        <div class="prog-head">
          <span class="doc-abbr" style="color:${cat.color};background:${cat.tint}">${doc.abbr}</span>
          <strong>${escapeHtml(doc.short || doc.title)}</strong>
        </div>
        <div class="prog-meta">
          Última: página ${p.lastPage} de ${doc.pages} · ${formatDate(p.lastReadAt)}
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
        <div class="prog-pct">${pct}% recorrido (${p.completedPages.length} de ${doc.pages} páginas)</div>
      </a>
    `;
  }).join("");
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = Date.now();
  const diffH = (now - ts) / 3600000;
  if (diffH < 1) return `hace ${Math.max(1, Math.round(diffH * 60))} min`;
  if (diffH < 24) return `hace ${Math.round(diffH)} h`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function renderAll() {
  renderBookmarks();
  renderNotes();
  renderProgress();
  renderStats();
}

function renderStats() {
  const totalBM = storage.getBookmarks().length;
  const totalNotes = storage.getAllNotes().length;
  const totalProgress = Object.keys(storage.getAllProgress()).length;
  const totalSim = storage.getSimulacros().length;
  $("#stats").innerHTML = `
    <div class="stat-block"><strong>${totalBM}</strong><span>Marcadores</span></div>
    <div class="stat-block"><strong>${totalNotes}</strong><span>Notas</span></div>
    <div class="stat-block"><strong>${totalProgress}</strong><span>Documentos abiertos</span></div>
    <div class="stat-block"><strong>${totalSim}</strong><span>Simulacros</span></div>
  `;
}

// === Bootstrap ===
async function init() {
  // Cargar storage; si Drive está configurado y con sesión, cambiar de backend
  if (driveSync.isConfigured() && driveSync.isSignedIn()) {
    await storage.setBackend(new DriveBackend(driveSync));
  } else {
    await storage.init();
  }

  CATALOG = await loadCatalog();
  CATALOG.documents.forEach(d => { DOCS_BY_ID[d.id] = d; });

  renderSyncBar();
  renderAll();

  // Re-render si cambian los datos
  storage.on(() => renderAll());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
