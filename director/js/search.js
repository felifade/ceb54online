// Búsqueda full-text con MiniSearch — 1,187 páginas indexadas en cliente.
// MiniSearch se carga desde esm.sh (8KB gzip).
import MiniSearch from "https://esm.sh/minisearch@7.1.2";
import { loadCatalog, ICONS, escapeHtml } from "./app.js";

const $ = sel => document.querySelector(sel);

// Stop-words en español (lista corta — MiniSearch los excluye)
const STOPWORDS = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","y","o","u","en","a","al","con","por","para",
  "que","se","es","sus","su","lo","como","más","pero","no","sí","ni","ya","muy","fue","ser","han","han",
  "hay","entre","sobre","cuando","donde","cuyo","cuya","esta","este","estos","estas","esa","ese","esos","esas",
  "ha","he","han","si","ello","ella","él"
]);

// Normaliza: minúsculas + sin acentos para tolerar búsqueda con/sin tilde
function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

let MS = null;        // instancia MiniSearch
let RECORDS_BY_ID = {}; // acceso rápido al texto completo de cada página
let CATALOG = null;

async function buildIndex() {
  const start = performance.now();
  const [cat, idx] = await Promise.all([
    loadCatalog(),
    fetch("data/search-index.json").then(r => r.json()),
  ]);
  CATALOG = cat;

  MS = new MiniSearch({
    fields: ["text", "title", "abbr"],
    storeFields: ["doc", "abbr", "title", "page", "category"],
    idField: "id",
    processTerm: (term) => {
      const n = normalize(term);
      if (STOPWORDS.has(n)) return null;
      if (n.length < 2) return null;
      return n;
    },
    searchOptions: {
      boost: { title: 3, abbr: 5 },
      prefix: true,
      fuzzy: 0.15,
      combineWith: "AND",
    },
  });

  // Indexa por lotes para no congelar el UI
  const BATCH = 100;
  for (let i = 0; i < idx.records.length; i += BATCH) {
    MS.addAll(idx.records.slice(i, i + BATCH));
    if (i % 500 === 0) await new Promise(r => setTimeout(r, 0));
  }
  // Mapa id → texto completo (para snippets)
  idx.records.forEach(r => { RECORDS_BY_ID[r.id] = r.text; });

  const ms = (performance.now() - start).toFixed(0);
  console.log(`[search] índice listo: ${idx.records.length} páginas en ${ms} ms`);
  return { totalPages: idx.records.length, ms };
}

// Genera snippet con la palabra resaltada (~140 chars alrededor del primer match)
function makeSnippet(fullText, queryTerms) {
  const norm = normalize(fullText);
  const terms = queryTerms.map(normalize).filter(t => t.length >= 2);
  let bestIdx = -1, bestTerm = "";
  for (const t of terms) {
    const i = norm.indexOf(t);
    if (i !== -1 && (bestIdx === -1 || i < bestIdx)) {
      bestIdx = i;
      bestTerm = t;
    }
  }
  if (bestIdx === -1) {
    // Sin coincidencia exacta (fuzzy/prefix) → primer fragmento
    return escapeHtml(fullText.slice(0, 220)) + (fullText.length > 220 ? "…" : "");
  }
  const start = Math.max(0, bestIdx - 70);
  const end = Math.min(fullText.length, bestIdx + 170);
  let snippet = fullText.slice(start, end);
  // Resaltar todos los términos en el snippet (case-insensitive, sin acentos)
  let highlighted = escapeHtml(snippet);
  for (const t of terms) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "giu");
    // Para resaltar respetando acentos, hacemos el match sobre el texto normalizado
    // y mapeamos posiciones — versión simple: marcar por substring case-insensitive
    highlighted = highlighted.replace(
      new RegExp(`([\\wáéíóúñü]*${escapeRe(t)}[\\wáéíóúñü]*)`, "giu"),
      "<mark>$1</mark>"
    );
  }
  return (start > 0 ? "…" : "") + highlighted + (end < fullText.length ? "…" : "");
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Render de resultados
function renderResults(query, opts = {}) {
  const root = $("#results");
  if (!query || query.trim().length < 2) {
    root.innerHTML = `<div class="search-empty">
      <h3>Escribe para empezar</h3>
      <p>Busca por palabra, frase o referencia (ej. <em>"artículo 47"</em>, <em>"interés superior"</em>, <em>LGRA</em>).</p>
    </div>`;
    $("#summary").textContent = "";
    return;
  }
  const t0 = performance.now();
  let hits = MS.search(query);

  // Filtro por documento o categoría
  if (opts.docId) hits = hits.filter(h => h.doc === opts.docId);
  if (opts.category) hits = hits.filter(h => h.category === opts.category);

  const ms = (performance.now() - t0).toFixed(0);

  if (hits.length === 0) {
    root.innerHTML = `<div class="search-empty">
      <h3>Sin resultados para “${escapeHtml(query)}”</h3>
      <p>Prueba con menos palabras, sinónimos o quita los acentos.</p>
    </div>`;
    $("#summary").innerHTML = `<strong>0</strong> resultados · <strong>${ms}</strong> ms`;
    return;
  }

  // Limitar a 60 resultados para que no se sature el DOM
  const shown = hits.slice(0, 60);
  const queryTerms = query.split(/\s+/).filter(Boolean);

  root.innerHTML = shown.map(h => {
    const cat = CATALOG.categories[h.category] || {};
    const snippet = makeSnippet(RECORDS_BY_ID[h.id] || "", queryTerms);
    return `
      <a class="result"
         href="lector.html?id=${h.doc}&page=${h.page}"
         style="--cat-color:${cat.color || "#1e3a5f"}">
        <div class="result-head">
          <span class="doc-abbr" style="color:${cat.color};background:${cat.tint}">${escapeHtml(h.abbr)}</span>
          <span class="arrow">›</span>
          <span class="pg">página ${h.page}</span>
          <span class="arrow">·</span>
          <span>${escapeHtml(cat.short || h.category)}</span>
        </div>
        <h3 class="result-title">${escapeHtml(h.title)}</h3>
        <p class="result-snippet">${snippet}</p>
      </a>
    `;
  }).join("");

  $("#summary").innerHTML = `
    <strong>${hits.length}</strong> ${hits.length === 1 ? "resultado" : "resultados"}
    ${hits.length > 60 ? `(mostrando primeros 60)` : ""}
    para <strong>“${escapeHtml(query)}”</strong>
    · <strong>${ms}</strong> ms
  `;
}

// Filtros (todos los docs / por categoría)
function renderFilterBar(catalog, current) {
  const bar = $("#search-filters");
  if (!bar) return;
  const chips = [
    `<button class="dir-chip ${!current ? "active" : ""}" data-cat="">Todas</button>`,
    ...Object.entries(catalog.categories).map(([key, c]) =>
      `<button class="dir-chip ${current === key ? "active" : ""}" data-cat="${key}">${c.short}</button>`
    ),
  ];
  bar.innerHTML = chips.join("");
  bar.querySelectorAll(".dir-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat || null;
      const u = new URL(location.href);
      if (cat) u.searchParams.set("cat", cat); else u.searchParams.delete("cat");
      history.replaceState({}, "", u);
      renderFilterBar(catalog, cat);
      const q = $("#hero-search").value;
      renderResults(q, { category: cat, docId: getDocFilter() });
    });
  });
}

function getDocFilter() {
  const id = parseInt(new URL(location.href).searchParams.get("doc") || "0", 10);
  return id || null;
}

async function init() {
  const params = new URL(location.href).searchParams;
  const initialQ = params.get("q") || "";
  const initialCat = params.get("cat") || null;
  const docFilter = getDocFilter();

  const input = $("#hero-search");
  input.value = initialQ;

  // Mostrar spinner mientras se construye el índice
  $("#summary").innerHTML = `<span class="spinner"></span> Cargando índice…`;

  try {
    await buildIndex();

    // Si hay filtro de doc específico, mostrar contexto
    if (docFilter) {
      const d = CATALOG.documents.find(x => x.id === docFilter);
      if (d) {
        const ctx = $("#doc-context");
        ctx.innerHTML = `Filtrado a: <strong>${escapeHtml(d.short || d.title)}</strong>
          <a href="?q=${encodeURIComponent(initialQ)}" style="margin-left:.6rem;font-size:.85rem">× quitar filtro</a>`;
        ctx.style.display = "block";
      }
    }

    renderFilterBar(CATALOG, initialCat);
    renderResults(initialQ, { category: initialCat, docId: docFilter });
  } catch (err) {
    console.error(err);
    $("#summary").innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
  }

  // Búsqueda en vivo (debounce 180ms)
  let t;
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const q = input.value;
      const cat = new URL(location.href).searchParams.get("cat");
      const u = new URL(location.href);
      if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
      history.replaceState({}, "", u);
      renderResults(q, { category: cat, docId: getDocFilter() });
    }, 180);
  });

  input.focus();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
