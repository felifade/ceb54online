// Consultor Director · CEB 5/4 — app principal
// Carga el catálogo, renderiza categorías + tarjetas, maneja filtros y atajos.

const CATALOG_URL = "data/catalog.json";

// === SVG icons (inline, para no depender de librerías) ===
const ICONS = {
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
  compass: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  warn: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// === Carga del catálogo ===
async function loadCatalog() {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error("No se pudo cargar el catálogo");
  return res.json();
}

// === Render del catálogo en la portada ===
function renderHomeStats(catalog) {
  const totalDocs = catalog.documents.length;
  const totalPages = catalog.documents.reduce((s, d) => s + d.pages, 0);
  const totalCats = Object.keys(catalog.categories).length;
  const stats = $("#hero-stats");
  if (!stats) return;
  stats.innerHTML = `
    <div class="dir-stat"><strong>${totalDocs}</strong><span>Documentos</span></div>
    <div class="dir-stat"><strong>${totalPages.toLocaleString("es-MX")}</strong><span>Páginas</span></div>
    <div class="dir-stat"><strong>${totalCats}</strong><span>Categorías</span></div>
  `;
}

function renderFilters(catalog, current) {
  const bar = $("#filters");
  if (!bar) return;
  const counts = countByCat(catalog);
  const chips = [
    `<button class="dir-chip ${current === "all" ? "active" : ""}" data-cat="all">Todos <span class="count">${catalog.documents.length}</span></button>`,
    ...Object.entries(catalog.categories).map(([key, cat]) => `
      <button class="dir-chip ${current === key ? "active" : ""}" data-cat="${key}">
        ${cat.short}
        <span class="count">${counts[key] || 0}</span>
      </button>
    `),
  ];
  bar.innerHTML = chips.join("");
  bar.querySelectorAll(".dir-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      renderCategories(catalog, cat);
      renderFilters(catalog, cat);
      // actualizar URL sin recargar
      const u = new URL(location.href);
      if (cat === "all") u.searchParams.delete("cat"); else u.searchParams.set("cat", cat);
      history.replaceState({}, "", u);
      // scroll suave a la primera sección
      requestAnimationFrame(() => {
        const first = document.querySelector(".cat-section");
        if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  });
}

function countByCat(catalog) {
  return catalog.documents.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});
}

function renderCategories(catalog, filter = "all") {
  const root = $("#categories");
  if (!root) return;
  const docsByCat = {};
  catalog.documents.forEach(d => {
    (docsByCat[d.category] ||= []).push(d);
  });

  const cats = filter === "all"
    ? Object.entries(catalog.categories)
    : [[filter, catalog.categories[filter]]];

  root.innerHTML = cats.map(([key, cat]) => {
    const docs = docsByCat[key] || [];
    if (docs.length === 0) return "";
    return `
      <section class="cat-section" style="--cat-color:${cat.color};--cat-color-soft:${cat.tint}">
        <header class="cat-header">
          <div class="cat-mark">${ICONS[cat.icon] || ICONS.book}</div>
          <div class="cat-info">
            <h2>${cat.name}</h2>
            <p>${cat.description}</p>
          </div>
          <div class="cat-count">${docs.length} ${docs.length === 1 ? "documento" : "documentos"}</div>
        </header>
        <div class="doc-grid">
          ${docs.map(docCard).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function docCard(d) {
  return `
    <a class="doc-card" href="lector.html?id=${d.id}" aria-label="${escapeAttr(d.title)}">
      <div class="doc-card-head">
        <span class="doc-abbr">${escapeHtml(d.abbr)}</span>
        <span class="doc-meta-pages">${d.pages} pp</span>
      </div>
      <h3 class="doc-title">${escapeHtml(d.short || d.title)}</h3>
      <div class="doc-card-foot">
        <span class="doc-issuer">${escapeHtml(d.issuer || "")}</span>
        <span class="doc-year">${d.year || ""}</span>
      </div>
      ${d.scanned ? `<span class="doc-warn">${ICONS.warn} OCR pendiente</span>` : ""}
      ${d.ocr ? `<span class="doc-warn" style="color:var(--success);background:#e8efe8;border-color:#3d5e3d33">✓ OCR aplicado</span>` : ""}
    </a>
  `;
}

// === Helpers ===
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }

// === Atajos de teclado ===
function setupShortcuts() {
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      const input = $("#hero-search") || $("#header-search");
      input?.focus();
    }
    if (e.key === "Escape") {
      const input = document.activeElement;
      if (input?.tagName === "INPUT") input.blur();
    }
  });
}

// === Buscador en hero/header → redirige a buscar.html ===
function wireSearchInputs() {
  const submit = (val) => {
    const q = val.trim();
    if (!q) return;
    location.href = `buscar.html?q=${encodeURIComponent(q)}`;
  };
  ["#hero-search", "#header-search"].forEach(sel => {
    const input = $(sel);
    if (!input) return;
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); submit(input.value); }
    });
  });
}

// === Bootstrap ===
async function init() {
  setupShortcuts();
  wireSearchInputs();
  try {
    const catalog = await loadCatalog();
    renderHomeStats(catalog);
    const initialCat = new URL(location.href).searchParams.get("cat") || "all";
    renderFilters(catalog, initialCat);
    renderCategories(catalog, initialCat);
  } catch (err) {
    console.error(err);
    const root = $("#categories");
    if (root) root.innerHTML = `<p style="color:var(--danger)">No se pudo cargar el catálogo: ${err.message}</p>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { loadCatalog, ICONS, escapeHtml };
