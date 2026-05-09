// Lector de documento — recibe ?id=N&page=P y muestra metadatos + iframe a Drive
import { loadCatalog, ICONS, escapeHtml } from "./app.js";
import { storage } from "./storage.js";
import { bookmarkButton } from "./bookmark.js";
import { renderMarkdown } from "./markdown.js";
import { openSummaryEditor } from "./summary-editor.js";

const $ = sel => document.querySelector(sel);

function getParams() {
  const u = new URL(location.href);
  return {
    id: parseInt(u.searchParams.get("id") || "0", 10),
    page: parseInt(u.searchParams.get("page") || "1", 10),
  };
}

function driveUrl(driveId, page = 1) {
  if (!driveId) return null;
  // El visor de Drive soporta #page=N (en algunos casos)
  return `https://drive.google.com/file/d/${driveId}/preview${page > 1 ? `#page=${page}` : ""}`;
}

function render(catalog, params) {
  const doc = catalog.documents.find(d => d.id === params.id);
  if (!doc) {
    document.body.innerHTML = `
      <main class="dir-main"><h1 class="dir-hero-h1">Documento no encontrado</h1>
      <p><a href="index.html">← Volver al catálogo</a></p></main>`;
    return;
  }
  const cat = catalog.categories[doc.category];

  // Título de la pestaña
  document.title = `${doc.abbr} · ${doc.short || doc.title}`;

  // Aside con metadatos
  const aside = $("#reader-aside");
  aside.style.setProperty("--cat-color", cat.color);
  aside.style.setProperty("--cat-color-soft", cat.tint);
  aside.innerHTML = `
    <a href="index.html" class="back-link">← Catálogo</a>
    <span class="doc-abbr-large">${escapeHtml(doc.abbr)}</span>
    <h1>${escapeHtml(doc.title)}</h1>

    <dl class="reader-meta">
      <dt>Categoría</dt>
      <dd>${escapeHtml(cat.name)}</dd>
      <dt>Emisor</dt>
      <dd>${escapeHtml(doc.issuer || "—")}</dd>
      <dt>Año</dt>
      <dd>${doc.year || "—"}</dd>
      <dt>Páginas</dt>
      <dd>${doc.pages}</dd>
      ${doc.scanned ? `<dt>Estado</dt><dd style="color:var(--gold)">⚠ OCR pendiente — búsqueda no disponible aún</dd>` : ""}
      ${doc.ocr ? `<dt>Estado</dt><dd style="color:var(--success)">✓ Documento escaneado con OCR aplicado — buscable</dd>` : ""}
    </dl>

    <div class="reader-actions">
      <a class="btn" href="leer.html?id=${doc.id}${params.page > 1 ? `&page=${params.page}` : ""}">
        📖 Leer texto (modo iBook)
      </a>
      <a class="btn btn-primary" href="buscar.html?q=&doc=${doc.id}">
        🔍 Buscar en este documento
      </a>
      ${doc.drive_id ? `<a class="btn" target="_blank" rel="noopener" href="https://drive.google.com/file/d/${doc.drive_id}/view">
        Abrir en Drive ↗
      </a>` : ""}
      <div id="bookmark-slot"></div>
    </div>

    <div id="my-summary-slot" style="margin-top:1.2rem"></div>

    ${doc.tags?.length ? `<p style="margin-top:1.2rem;font-size:0.78rem;color:var(--ink-3)">
      ${doc.tags.map(t => `<span style="display:inline-block;background:var(--bg-elev);border:1px solid var(--rule);padding:2px 8px;border-radius:9999px;margin:2px 3px 0 0">#${escapeHtml(t)}</span>`).join("")}
    </p>` : ""}
  `;

  // Banner de "Mi resumen"
  renderSummarySlot(doc);

  // Frame del PDF
  const frame = $("#reader-frame");
  if (doc.drive_id) {
    frame.src = driveUrl(doc.drive_id, params.page);
  } else {
    // Placeholder hasta que se conecten los IDs de Drive
    frame.outerHTML = `
      <div class="pending-banner" style="margin:2rem;max-width:600px;align-self:center">
        ${ICONS.warn}
        <div>
          <strong>Documento aún no enlazado a Drive.</strong><br>
          Sube el PDF a Drive y comparte el ID en el catálogo.<br>
          Mientras tanto, la búsqueda full-text sí funciona — usa el botón de arriba.
        </div>
      </div>`;
  }
}

function renderSummarySlot(doc) {
  const slot = $("#my-summary-slot");
  if (!slot) return;
  const text = storage.getSummary(doc.id);
  if (!text) {
    slot.innerHTML = `
      <div class="my-summary empty">
        <div class="my-summary-head">
          <h3 style="font-size:0.95rem">Mi resumen</h3>
          <button class="btn btn-sm btn-primary" id="rdr-sum-edit">✏️ Crear</button>
        </div>
        <div class="my-summary-body" style="font-size:0.85rem">
          Escribe tu propio resumen del documento.
        </div>
      </div>`;
  } else {
    slot.innerHTML = `
      <div class="my-summary">
        <div class="my-summary-head">
          <h3 style="font-size:0.95rem">Mi resumen</h3>
          <button class="btn btn-sm" id="rdr-sum-edit">✏️ Editar</button>
        </div>
        <div class="my-summary-body" style="font-size:0.88rem">${renderMarkdown(text)}</div>
      </div>`;
  }
  document.getElementById("rdr-sum-edit").onclick = () => {
    openSummaryEditor({ doc, onClose: () => renderSummarySlot(doc) });
  };
}

// Header dinámico (mismo que el resto del sitio)
function renderHeader() {
  const h = document.querySelector(".dir-header-inner");
  if (!h) return;
  // ya viene en el HTML
}

async function init() {
  try {
    await storage.init();
    const catalog = await loadCatalog();
    const params = getParams();
    render(catalog, params);
    // Insertar el botón de marcador en el slot
    const slot = $("#bookmark-slot");
    if (slot && params.id) {
      slot.appendChild(bookmarkButton({ doc: params.id, page: params.page, label: "Guardar" }));
    }
    // Marcar progreso de lectura (se quedó aquí)
    storage.setProgress(params.id, params.page);
  } catch (e) {
    console.error(e);
    $("#reader-aside").innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
